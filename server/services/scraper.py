#!/usr/bin/env python3
"""
PrimeLocation scraper (99%-style reliability, caching, anti-403, proxy support)

- Input:  python primelocation_scraper.py <city> <min_bedrooms> <max_price> <keywords>
  * <keywords> can be free text (e.g. "hmo") or key:value pairs separated by semicolons:
      "postcode:SW1A 1AA;baths_min:2;keywords:hmo"
  * City may be any UK city name; we'll slug it for PrimeLocation.

- Output: prints JSON to stdout AND writes a cache file under ./cache/primelocation/<slug>/
  that is safe to commit to GitHub as a fallback dataset.

- What it does:
  1) Builds real PrimeLocation search URLs with q/city, beds_min, price_max, page_size=50 & pn pagination.
  2) Collects detail links from each search page ("/for-sale/details/<id>/").
  3) Visits each details page and extracts: address, postcode, price, bedrooms, bathrooms, description,
     image, plus some investment metrics (optional).
  4) Robust anti-403 (UA rotation, referer spoofing, randomized delays/jitter, optional proxies via env).

Environment (optional):
  PROXY_LIST="http://user:pass@ip:port, http://ip2:port2"
  REQUESTS_TIMEOUT=25
  PL_MAX_PAGES=4          # how many search pages to walk (50 results per page requested)
  PL_MIN_RESULTS=50       # target number of properties per search before stopping
  PL_CACHE_TTL_HOURS=12   # skip re-scrape if cache is fresh unless REFRESH=1
  REFRESH=1               # force a refresh even if cache exists
"""

import sys
import os
import re
import json
import time
import math
import random
import hashlib
from datetime import datetime, timedelta
from urllib.parse import urljoin, quote_plus

import requests
from bs4 import BeautifulSoup


# ---------- Config & helpers ----------

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64; rv:123.0) Gecko/20100101 Firefox/123.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edg/121.0.0.0 Safari/537.36",
]

CITY_MAPPINGS = {
    "london": "london",
    "newcastle": "newcastle-upon-tyne",
    "newcastle upon tyne": "newcastle-upon-tyne",
    "brighton": "brighton-and-hove",
    "brighton and hove": "brighton-and-hove",
    "hull": "kingston-upon-hull",
    "kingston upon hull": "kingston-upon-hull",
    "birmingham": "birmingham",
    "manchester": "manchester",
    "leeds": "leeds",
    "sheffield": "sheffield",
    "bristol": "bristol",
    "nottingham": "nottingham",
    "liverpool": "liverpool",
    "leicester": "leicester",
    "coventry": "coventry",
    "bradford": "bradford",
    "cardiff": "cardiff",
    "glasgow": "glasgow",
    "edinburgh": "edinburgh",
    "portsmouth": "portsmouth",
    "southampton": "southampton",
    "reading": "reading",
    "plymouth": "plymouth",
    "derby": "derby",
    "preston": "preston",
    "wolverhampton": "wolverhampton",
    "stockport": "stockport",
}

def slug_city(city: str) -> str:
    city_lower = (city or "").strip().lower()
    return CITY_MAPPINGS.get(city_lower, city_lower.replace(" ", "-"))

def parse_keywords_blob(blob: str):
    """
    Accepts free text or semi-structured "k:v;k:v" and returns dict:
      {
        'keywords': 'hmo ...',
        'postcode': 'SW1A 1AA',
        'baths_min': 2,
        ...
      }
    """
    out = {}
    if not blob:
        return out
    # try parse k:v pairs first
    parts = [p.strip() for p in blob.split(";") if p.strip()]
    kv_found = False
    for p in parts:
        if ":" in p:
            kv_found = True
            k, v = p.split(":", 1)
            out[k.strip().lower()] = v.strip()
    if not kv_found:  # treat it as free keywords
        out["keywords"] = blob.strip()
    # normalize ints
    if "baths_min" in out:
        try:
            out["baths_min"] = int(out["baths_min"])
        except:
            del out["baths_min"]
    return out

def as_int(val, default=None):
    try:
        return int(val)
    except:
        return default

def rand_delay(a=0.6, b=1.8):
    time.sleep(random.uniform(a, b))


# ---------- Session & anti-403 ----------

def setup_session():
    s = requests.Session()
    # Enhanced headers to better mimic real browsers
    ua = random.choice(USER_AGENTS)
    s.headers.update({
        "User-Agent": ua,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Sec-CH-UA": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
        "Sec-CH-UA-Mobile": "?0",
        "Sec-CH-UA-Platform": '"Windows"',
        "Cache-Control": "max-age=0",
        "DNT": "1",
        "Connection": "keep-alive",
    })
    
    # Enhanced cookies to appear more realistic
    timestamp = int(time.time())
    random_id = random.randint(1000000000, 9999999999)
    s.cookies.set("_ga", f"GA1.2.{random_id}.{timestamp}")
    s.cookies.set("_gid", f"GA1.2.{random.randint(100000000, 999999999)}.{timestamp}")
    s.cookies.set("_gat_gtag_UA_12345_1", "1")
    s.cookies.set("session_token", f"st_{random.randint(100000, 999999)}_{timestamp}")
    s.cookies.set("cookieconsent_status", "allow")
    s.cookies.set("primelocation_session", f"pl_sess_{random.randint(1000000, 9999999)}")
    
    return s

def with_proxy(session: requests.Session, proxies_list, attempt):
    if proxies_list:
        proxy_choice = proxies_list[attempt % len(proxies_list)]
        session.proxies = {"http": proxy_choice, "https": proxy_choice}
    else:
        session.proxies = {}
    session.headers.update({"User-Agent": random.choice(USER_AGENTS)})


# ---------- Cache ----------

def cache_path_for(city_slug, min_beds, max_price, filters: dict):
    cache_dir = os.path.join("cache", "primelocation", city_slug)
    os.makedirs(cache_dir, exist_ok=True)
    # hash the filter dict for stability
    key = json.dumps({"min_beds": min_beds, "max_price": max_price, **filters}, sort_keys=True)
    stamp = hashlib.sha1(key.encode("utf-8")).hexdigest()[:16]
    return os.path.join(cache_dir, f"search_{stamp}.json")

def cache_fresh(path):
    ttl_hours = as_int(os.getenv("PL_CACHE_TTL_HOURS", 12), 12)
    if not os.path.isfile(path):
        return False
    mtime = datetime.fromtimestamp(os.path.getmtime(path))
    return datetime.utcnow() - mtime < timedelta(hours=ttl_hours)


# ---------- Parsing helpers ----------

PRICE_RE = re.compile(r"[£]\s?([\d,]+)")
BED_RE = re.compile(r"(\d+)\s*bed", re.I)
BATH_RE = re.compile(r"(\d+)\s*bath", re.I)
POSTCODE_RE = re.compile(r"\b([A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})\b", re.I)

def extract_price(text):
    if not text:
        return 0
    m = PRICE_RE.search(text)
    if not m:
        # sometimes price appears like "600,000"
        m2 = re.search(r"\b(\d{3,3}(?:,\d{3})+)\b", text)
        if not m2:
            return 0
        digits = m2.group(1).replace(",", "")
    else:
        digits = m.group(1).replace(",", "")
    try:
        return int(digits)
    except:
        return 0

def extract_first_int(regex, text):
    if not text:
        return None
    m = regex.search(text)
    return int(m.group(1)) if m else None

def extract_postcode(text):
    if not text:
        return None
    m = POSTCODE_RE.search(text)
    return m.group(1).upper() if m else None


# ---------- Investment calcs (unchanged from your flow, trimmed) ----------

def estimate_monthly_rent(city, address, bedrooms):
    # super-simple, conservative stub so we don't overfit here.
    baseline = {
        "london": 225, "oxford": 165, "cambridge": 160, "bristol": 150,
        "manchester": 120, "leeds": 110, "birmingham": 115,
        "liverpool": 110, "sheffield": 100, "newcastle": 95
    }
    per_room = baseline.get((city or "").lower(), 110)
    return per_room * bedrooms

def add_investment_metrics(rec, city):
    price = rec.get("price") or 0
    beds = rec.get("bedrooms") or 1
    monthly = estimate_monthly_rent(city, rec.get("address",""), beds)
    annual = monthly * 12
    gross_yield = (annual / price * 100) if price else 0
    rec["monthly_rent"] = monthly
    rec["annual_rent"] = annual
    rec["gross_yield"] = round(gross_yield, 2)
    return rec


# ---------- Build real search URLs ----------

def build_search_urls(city, min_beds, max_price, filters):
    """
    Mirrors PrimeLocation's search URL shape with fallback patterns:
      https://www.primelocation.com/for-sale/property/<city-slug>/?q=<city or postcode>&beds_min=<n>&price_max=<n>&page_size=50&pn=<page>
    """
    city_slug = slug_city(city)
    q = filters.get("postcode") or city
    max_pages = as_int(os.getenv("PL_MAX_PAGES", 4), 4)
    
    # Primary URL pattern
    base_params = {
        "q": q,
        "page_size": "50",
    }
    if min_beds:
        base_params["beds_min"] = str(min_beds)
    if max_price:
        base_params["price_max"] = str(max_price)
    
    qs_base = "&".join([f"{k}={quote_plus(v)}" for k, v in base_params.items() if v])
    
    urls = []
    
    # Try multiple URL patterns for better compatibility
    url_patterns = [
        f"https://www.primelocation.com/for-sale/property/{city_slug}/",
        f"https://www.primelocation.com/for-sale/property/",  # Generic search
        f"https://www.primelocation.com/for-sale/",  # Fallback
    ]
    
    for pattern in url_patterns:
        for pn in range(1, min(max_pages + 1, 3)):  # Limit fallback pages
            if pn == 1:
                urls.append(f"{pattern}?{qs_base}")
            else:
                urls.append(f"{pattern}?{qs_base}&pn={pn}")
        
        # Only try first pattern initially, others are fallbacks
        if pattern == url_patterns[0]:
            break
    
    return urls


def build_fallback_urls(city, min_beds, max_price, filters):
    """Build alternative URL patterns when primary patterns fail"""
    q = filters.get("postcode") or city
    
    base_params = {
        "q": q,
    }
    if min_beds:
        base_params["beds_min"] = str(min_beds)
    if max_price:
        base_params["price_max"] = str(max_price)
    
    qs_base = "&".join([f"{k}={quote_plus(v)}" for k, v in base_params.items() if v])
    
    # Alternative URL patterns
    fallback_patterns = [
        f"https://www.primelocation.com/for-sale/property/?{qs_base}",  # Generic search
        f"https://www.primelocation.com/for-sale/?{qs_base}",  # Simplified
        f"https://www.primelocation.com/for-sale/property/{city.lower()}/?{qs_base}",  # Simple city
    ]
    
    return fallback_patterns


# ---------- Network fetch with retries/backoff ----------

def get_html(session, url, proxies_list=None, max_attempts=4):
    timeout = as_int(os.getenv("REQUESTS_TIMEOUT", 25), 25)
    last_exc = None
    last_status = None
    
    for attempt in range(max_attempts):
        try:
            with_proxy(session, proxies_list, attempt)
            
            # Longer delay between requests to avoid rate limiting
            rand_delay(2.0, 4.0)
            
            # Update headers for each attempt
            session.headers.update({
                "User-Agent": random.choice(USER_AGENTS),
                "Sec-Fetch-Site": "none" if attempt == 0 else "same-origin",
                "Referer": "https://www.google.com/" if attempt == 0 else url.split('?')[0],
            })
            
            r = session.get(url, timeout=timeout, allow_redirects=True)
            last_status = r.status_code
            
            if r.status_code == 200 and r.content:
                return r.text
            elif r.status_code in (403, 429):
                # Anti-bot protection hit - increase backoff significantly
                backoff_time = 5.0 + (attempt * 3.0)
                print(f"❌ Error on search page {attempt + 1}: Status {r.status_code}, backing off {backoff_time}s", file=sys.stderr)
                time.sleep(backoff_time)
                
                # Create new session for next attempt
                if attempt < max_attempts - 1:
                    session = setup_session()
                continue
            else:
                # Other HTTP errors
                time.sleep(1.5 + attempt * 1.0)
                
        except requests.RequestException as e:
            last_exc = e
            print(f"❌ Network error on attempt {attempt + 1}: {str(e)}", file=sys.stderr)
            time.sleep(2.0 + attempt * 1.5)
            continue
    
    # Log final failure
    if last_status:
        raise RuntimeError(f"Failed to fetch {url} - final status: {last_status}")
    elif last_exc:
        raise last_exc
    else:
        raise RuntimeError(f"Failed to fetch {url}")


# ---------- Listing page parsing ----------

def collect_detail_links(listing_html):
    """
    Don't trust classes; harvest anchors to details pages and de-dupe.
    """
    soup = BeautifulSoup(listing_html, "html.parser")
    links = set()
    # Any anchor that points at /for-sale/details/<id>/
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "/for-sale/details/" in href:
            if href.startswith("http"):
                links.add(href.split("?")[0])
            else:
                links.add(urljoin("https://www.primelocation.com", href.split("?")[0]))
    return list(links)


# ---------- Details page parsing ----------

def parse_details(detail_html):
    soup = BeautifulSoup(detail_html, "html.parser")
    text = soup.get_text(" ", strip=True)

    # Title / address
    # Prefer the <h1> if present; else fallback to og:title/twitter:title
    address = None
    h1 = soup.find("h1")
    if h1:
        at = h1.get_text(" ", strip=True)
        if at and len(at) > 8:
            address = at
    if not address:
        mt = soup.find("meta", attrs={"property": "og:title"})
        if mt and mt.name == "meta":
            content = mt.get("content")
            if content:
                address = content
    if not address:
        mt = soup.find("meta", attrs={"name": "twitter:title"})
        if mt and mt.name == "meta":
            content = mt.get("content")
            if content:
                address = content

    # Price
    price = 0
    # Price widgets often render with "£" — grab the first reasonable £-amount
    price = extract_price(text)

    # Bedrooms / bathrooms
    bedrooms = extract_first_int(BED_RE, text) or 0
    bathrooms = extract_first_int(BATH_RE, text) or None

    # Postcode
    postcode = extract_postcode(address or text)

    # Primary image (best-effort)
    image_url = None
    og_image = soup.find("meta", attrs={"property": "og:image"})
    if og_image and og_image.name == "meta":
        content = og_image.get("content")
        if content:
            image_url = content
    if not image_url:
        img = soup.find("img")
        if img and img.name == "img":
            src = img.get("src")
            if src:
                image_url = src

    # Description (trim to something reasonable)
    desc = None
    desc_blocks = soup.select("div[class*='description'], section[class*='description'], article p")
    if desc_blocks:
        bits = []
        for el in desc_blocks:
            t = el.get_text(" ", strip=True)
            if t and len(t) > 40:
                bits.append(t)
        if bits:
            desc = " ".join(bits)[:2000]

    return {
        "address": address,
        "postcode": postcode,
        "price": price,
        "bedrooms": bedrooms if bedrooms else None,
        "bathrooms": bathrooms,
        "image_url": image_url,
        "description": desc,
    }


# ---------- Main scrape flow ----------

def scrape_primelocation(city, min_bedrooms, max_price, keywords_blob):
    print(f"🔍 Starting PrimeLocation scrape for: city={city}, min_beds={min_bedrooms}, max_price={max_price}, keywords={keywords_blob}", file=sys.stderr)
    
    filters = parse_keywords_blob(keywords_blob)
    min_beds = as_int(min_bedrooms, 1) or 1
    max_price_int = as_int(max_price, None)
    
    print(f"📊 Parsed filters: min_beds={min_beds}, max_price_int={max_price_int}, filters={filters}", file=sys.stderr)

    city_slug = slug_city(city)
    cache_file = cache_path_for(city_slug, min_beds, max_price_int, filters)
    print(f"💾 Cache file path: {cache_file}", file=sys.stderr)

    if not os.getenv("REFRESH") and cache_fresh(cache_file):
        print(f"✅ Using fresh cache from {cache_file}", file=sys.stderr)
        with open(cache_file, "r", encoding="utf-8") as f:
            cached = json.load(f)
        print(f"📋 Loaded {len(cached)} cached properties", file=sys.stderr)
        return cached, {"cached": True, "cache_path": cache_file}

    proxies_env = os.getenv("PROXY_LIST", "")
    proxies_list = [p.strip() for p in proxies_env.split(",") if p.strip()]
    target_min_results = as_int(os.getenv("PL_MIN_RESULTS", 25), 25)

    session = setup_session()

    # 1) Build search URLs (pages)
    urls = build_search_urls(city, min_beds, max_price_int, filters)
    print(f"🌐 Built {len(urls)} search URLs:", file=sys.stderr)
    for i, url in enumerate(urls, 1):
        print(f"  {i}. {url}", file=sys.stderr)

    # 2) Visit each search page, collect details links
    all_detail_links = []
    print(f"🔗 Collecting property detail links from search pages...", file=sys.stderr)
    
    failed_attempts = 0
    for i, u in enumerate(urls, 1):
        try:
            print(f"  📄 Fetching search page {i}/{len(urls)}: {u}", file=sys.stderr)
            html = get_html(session, u, proxies_list)
            links = collect_detail_links(html)
            print(f"    Found {len(links)} property links on page {i}", file=sys.stderr)
            
            all_detail_links.extend(links)
            all_detail_links = list(dict.fromkeys(all_detail_links))  # de-dupe, preserve order
            print(f"    Total unique links so far: {len(all_detail_links)}", file=sys.stderr)
            
            if len(all_detail_links) >= target_min_results:
                print(f"✅ Reached target of {target_min_results} properties, stopping search", file=sys.stderr)
                break
                
            # Reset failed attempts on success
            failed_attempts = 0
            
        except Exception as e:
            failed_attempts += 1
            print(f"❌ Error on search page {i}: {str(e)}", file=sys.stderr)
            
            # If all primary URLs fail, try fallback patterns
            if failed_attempts >= 3 and len(all_detail_links) == 0:
                print(f"🔄 Primary URLs failing, trying fallback patterns...", file=sys.stderr)
                fallback_urls = build_fallback_urls(city, min_beds, max_price_int, filters)
                
                for j, fallback_url in enumerate(fallback_urls):
                    try:
                        print(f"  🔄 Trying fallback {j+1}: {fallback_url}", file=sys.stderr)
                        html = get_html(session, fallback_url, proxies_list)
                        links = collect_detail_links(html)
                        if links:
                            print(f"    ✅ Fallback successful! Found {len(links)} links", file=sys.stderr)
                            all_detail_links.extend(links)
                            break
                    except Exception as fe:
                        print(f"    ❌ Fallback {j+1} failed: {str(fe)}", file=sys.stderr)
                        continue
                        
                if all_detail_links:
                    break
            continue

    # safety: cap to 250 to avoid hammering
    detail_links = all_detail_links[:max(target_min_results, 50)]
    print(f"🎯 Processing {len(detail_links)} property detail pages (capped from {len(all_detail_links)} found)", file=sys.stderr)

    # 3) Visit each detail page and extract fields
    results = []
    print(f"🏠 Extracting property details...", file=sys.stderr)
    
    for i, dlink in enumerate(detail_links):
        try:
            print(f"  🔍 Processing property {i+1}/{len(detail_links)}: {dlink}", file=sys.stderr)
            html = get_html(session, dlink, proxies_list)
            rec = parse_details(html)
            
            rec["property_url"] = dlink
            rec["city"] = city
            
            # Log extracted data
            print(f"    ✏️  Extracted: {rec.get('address', 'No address')} - £{rec.get('price', 0):,} - {rec.get('bedrooms', 0)} beds", file=sys.stderr)
            
            # Apply price filter - skip properties above max_price
            property_price = rec.get("price", 0)
            if max_price_int and property_price > max_price_int:
                print(f"    ⏭️  Skipped: £{property_price:,} exceeds max price £{max_price_int:,}", file=sys.stderr)
                continue
                
            # Apply minimum bedrooms filter
            property_beds = rec.get("bedrooms", 0)
            if min_beds and property_beds < min_beds:
                print(f"    ⏭️  Skipped: {property_beds} beds less than minimum {min_beds}", file=sys.stderr)
                continue
            
            # best-effort infer baths filter: if user required min baths, skip non-matching
            if "baths_min" in filters and rec.get("bathrooms") is not None:
                if rec["bathrooms"] < int(filters["baths_min"]):
                    print(f"    ⏭️  Skipped: only {rec['bathrooms']} baths, need {filters['baths_min']}+", file=sys.stderr)
                    continue
            
            # Add a plain description if none found
            if not rec.get("description"):
                beds = rec.get("bedrooms") or min_beds
                rec["description"] = f"{beds}-bed property in {city}."
                
            # add investment metrics
            add_investment_metrics(rec, city)
            print(f"    💰 Added metrics: {rec.get('gross_yield', 0):.1f}% yield, £{rec.get('monthly_rent', 0)}/month", file=sys.stderr)
            
            results.append(rec)
            # polite pacing between details
            rand_delay(0.4, 1.1)
            
        except Exception as e:
            print(f"    ❌ Error processing property {i+1}: {str(e)}", file=sys.stderr)
            # skip bad pages and continue
            continue

    # 4) De-dup & clean
    print(f"🧹 Deduplicating {len(results)} properties...", file=sys.stderr)
    seen = set()
    unique = []
    duplicates = 0
    
    for r in results:
        sig = (r.get("property_url"), r.get("price"), r.get("bedrooms"))
        if sig in seen:
            duplicates += 1
            continue
        seen.add(sig)
        unique.append(r)
    
    print(f"✨ Final results: {len(unique)} unique properties ({duplicates} duplicates removed)", file=sys.stderr)

    # 5) Persist cache
    print(f"💾 Writing {len(unique)} properties to cache: {cache_file}", file=sys.stderr)
    with open(cache_file, "w", encoding="utf-8") as f:
        json.dump(unique, f, ensure_ascii=False, indent=2)
    
    print(f"✅ Scraping complete! Found {len(unique)} properties in {city}", file=sys.stderr)
    return unique, {"cached": False, "cache_path": cache_file}


# ---------- CLI ----------

def main():
    if len(sys.argv) != 5:
        print("Usage: python primelocation_scraper.py <city> <min_bedrooms> <max_price> <keywords>", file=sys.stderr)
        print('  Example keywords: "postcode:SW1A 1AA;baths_min:2;keywords:hmo"', file=sys.stderr)
        sys.exit(1)

    city = sys.argv[1]
    min_beds = sys.argv[2]
    max_price = sys.argv[3]
    keywords = sys.argv[4]

    data, meta = scrape_primelocation(city, min_beds, max_price, keywords)

    # Be verbose (stderr) about cache
    if meta.get("cached"):
        print(f"⚠️ Using cached results: {meta['cache_path']}", file=sys.stderr)
    else:
        print(f"💾 Wrote cache: {meta['cache_path']}", file=sys.stderr)

    print(json.dumps(data, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()