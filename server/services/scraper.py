#!/usr/bin/env python3
"""
PrimeLocation scraper v2
- Removes forced HMO 'keywords' injection
- Optimised to collect more ads by:
  * optional larger page_size (env PL_PAGE_SIZE)
  * optional expanding across multiple sort modes to surface different pools
  * parallel detail page fetching (ThreadPoolExecutor)
  * improved link harvesting (ld+json, anchors, data attributes)
  * safer per-worker sessions and UA rotation
- DEFAULT FOCUS: Properties under £500k (no minimum price), 3+ bedrooms
- LIMIT: Max 5000 properties per city, no total limit across cities

Usage remains the same as v1. Environment tweaks (optional):
  PL_PAGE_SIZE=100
  PL_MAX_PAGES=24
  PL_MIN_RESULTS=5000     # links to collect per city
  PL_MAX_FETCH=5000       # max properties to process per city (no total limit)
  PL_EXPAND_SORTS=1       # enable trying different sort orders to surface more listings
  PL_WORKERS=8            # number of threads to fetch detail pages
  REFRESH=1               # force refresh

Note: be mindful of target site politeness and anti-bot protections. V2 aims to increase coverage while keeping anti-403 mitigations.
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
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from bs4 import BeautifulSoup, Tag


# ---------- Config & helpers ----------

def safe_get_attr(element, attr_name, default=None):
    """Safely get attribute from BeautifulSoup element"""
    if hasattr(element, 'get') and callable(getattr(element, 'get')):
        return element.get(attr_name, default)
    elif hasattr(element, 'attrs') and isinstance(element.attrs, dict):
        return element.attrs.get(attr_name, default)
    return default
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
    "manchester": "greater-manchester",
    "greater manchester": "greater-manchester",
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
    Accepts free text or semi-structured "k:v;k:v" and returns dict.
    NOTE: V2 intentionally does NOT inject 'keywords' into the PrimeLocation search URL.
    The parser still allows user metadata like postcode:bla and baths_min.
    """
    out = {}
    if not blob:
        return out
    parts = [p.strip() for p in blob.split(";") if p.strip()]
    kv_found = False
    for p in parts:
        if ":" in p:
            kv_found = True
            k, v = p.split(":", 1)
            out[k.strip().lower()] = v.strip()
    if not kv_found:  # treat it as free keywords but store as 'raw_keywords' only
        out["raw_keywords"] = blob.strip()
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


def rand_delay(a=0.1, b=0.3):
    time.sleep(random.uniform(a, b))


# ---------- Session & anti-403 ----------

def setup_session():
    s = requests.Session()
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
        "Cache-Control": "max-age=0",
        "DNT": "1",
        "Connection": "keep-alive",
    })

    # realistic-ish cookies
    timestamp = int(time.time())
    random_id = random.randint(1000000000, 9999999999)
    s.cookies.set("_ga", f"GA1.2.{random_id}.{timestamp}")
    s.cookies.set("_gid", f"GA1.2.{random.randint(100000000, 999999999)}.{timestamp}")
    s.cookies.set("cookieconsent_status", "allow")
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
        m2 = re.search(r"\b(\d{1,3}(?:,\d{3})+)\b", text)
        if not m2:
            # last ditch: contiguous digits
            m3 = re.search(r"\b(\d{4,})\b", text)
            if not m3:
                return 0
            digits = m3.group(1)
        else:
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


# ---------- Investment calcs ----------

def estimate_monthly_rent(city, address, bedrooms):
    baseline = {
        "london": 225, "oxford": 165, "cambridge": 160, "bristol": 150,
        "manchester": 120, "leeds": 110, "birmingham": 115,
        "liverpool": 110, "sheffield": 100, "newcastle": 95
    }
    per_room = baseline.get((city or "").lower(), 110)
    return per_room * max(1, int(bedrooms or 1))


def add_investment_metrics(rec, city):
    price = rec.get("price") or 0
    beds = rec.get("bedrooms") or 1
    monthly = estimate_monthly_rent(city, rec.get("address", ""), beds)
    annual = monthly * 12
    gross_yield = (annual / price * 100) if price else 0
    rec["monthly_rent"] = monthly
    rec["annual_rent"] = annual
    rec["gross_yield"] = round(gross_yield, 2)
    return rec


# ---------- Build real search URLs (expanded) ----------

def build_search_urls(city, min_beds, max_price, filters):
    city_slug = slug_city(city)
    q = filters.get("postcode") or get_search_query_for_city(city)
    max_pages = as_int(os.getenv("PL_MAX_PAGES", 100), 100)
    page_size = as_int(os.getenv("PL_PAGE_SIZE", 50), 50)

    # Focus on properties under £500k (no minimum price)
    default_max_price = "500000"  # £500k upper bound to get more affordable properties
    default_min_price = None  # No minimum price to get all properties under £500k
    
    base_params = {
        "q": q,
        "price_max": str(max_price) if max_price else default_max_price,  # £500k max for more affordable properties
        "is_auction": "include",
        "is_retirement_home": "include",
        "is_shared_ownership": "include",
        "radius": "0",
        "page_size": str(page_size),
        "search_source": "for-sale"
    }
    
    # Only add price_min if we have a minimum price set
    if default_min_price:
        base_params["price_min"] = default_min_price

    if min_beds:
        base_params["beds_min"] = str(min_beds)

    qs_base = "&".join([f"{k}={quote_plus(v)}" for k, v in base_params.items() if v])

    urls = []

    # Primary pattern
    pattern = f"https://www.primelocation.com/for-sale/property/{city_slug}/"

    # Optionally try multiple sort orders to surface different subsets
    expand_sorts = os.getenv("PL_EXPAND_SORTS", "0") == "1"
    sort_modes = ["highest_price"]
    if expand_sorts:
        sort_modes = ["highest_price", "newest", "lowest_price"]

    # Distribute pages across sorts so we don't request the same page repeatedly
    pages_per_sort = max(1, math.ceil(max_pages / len(sort_modes)))

    for sort in sort_modes:
        params = qs_base + f"&results_sort={quote_plus(sort)}"
        for pn in range(1, pages_per_sort + 1):
            if pn == 1:
                urls.append(f"{pattern}?{params}")
            else:
                urls.append(f"{pattern}?{params}&pn={pn}")

    # Add a couple fallback first-page patterns to increase coverage
    fallbacks = [
        f"https://www.primelocation.com/for-sale/property/?{qs_base}",
        f"https://www.primelocation.com/for-sale/?{qs_base}",
        f"https://www.primelocation.com/for-sale/property/{city.lower()}/?{qs_base}",
    ]
    urls.extend(fallbacks)

    # De-dupe while preserving order
    seen = set()
    final = []
    for u in urls:
        if u not in seen:
            seen.add(u)
            final.append(u)

    return final


def get_search_query_for_city(city):
    city_lower = city.lower()
    regional_queries = {
        "leeds": "Leeds, West Yorkshire",
        "brighton": "Brighton, East Sussex",
        "hull": "Hull, East Yorkshire",
        "bradford": "Bradford, West Yorkshire",
        "sheffield": "Sheffield, South Yorkshire",
        "manchester": "Manchester",
        "greater manchester": "Greater Manchester",
        "liverpool": "Liverpool, Merseyside",
        "birmingham": "Birmingham, West Midlands",
    }
    return regional_queries.get(city_lower, city)


# ---------- Network fetch with retries/backoff (unchanged behaviour)
def get_html(session, url, proxies_list=None, max_attempts=4):
    timeout = as_int(os.getenv("REQUESTS_TIMEOUT", 25), 25)
    last_exc = None
    last_status = None

    for attempt in range(max_attempts):
        try:
            with_proxy(session, proxies_list, attempt)
            rand_delay(0.15, 0.6)
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
                backoff_time = 1.0 + (attempt * 0.8) + random.random()
                print(f"❌ Anti-bot status {r.status_code} on attempt {attempt+1}; backing off {backoff_time:.1f}s", file=sys.stderr)
                time.sleep(backoff_time)
                if attempt < max_attempts - 1:
                    session = setup_session()
                continue
            else:
                time.sleep(0.2 + attempt * 0.2)
        except requests.RequestException as e:
            last_exc = e
            print(f"❌ Network error on attempt {attempt + 1}: {str(e)}", file=sys.stderr)
            time.sleep(1.0 + attempt * 1.0)
            continue

    if last_status:
        raise RuntimeError(f"Failed to fetch {url} - final status: {last_status}")
    elif last_exc:
        raise last_exc
    else:
        raise RuntimeError(f"Failed to fetch {url}")


# ---------- Listing page parsing (improved) ----------

def collect_detail_links(listing_html):
    soup = BeautifulSoup(listing_html, "html.parser")
    links = []
    seen = set()

    # 1) anchors
    for a in soup.find_all("a", href=True):
        href_attr = safe_get_attr(a, "href")
        if href_attr:
            href = str(href_attr).split("?")[0]
            if "/for-sale/details/" in href:
                full = href if href.startswith("http") else urljoin("https://www.primelocation.com", href)
                if full not in seen:
                    seen.add(full)
                    links.append(full)

    # 2) JSON-LD entries
    for s in soup.find_all("script", type="application/ld+json"):
        try:
            script_content = s.get_text() if s else ""
            j = json.loads(script_content or "{}")
            # if this is a list
            if isinstance(j, list):
                for obj in j:
                    if isinstance(obj, dict) and obj.get("@type") in ("Product","Offer","Residence","House"):
                        u = obj.get("url")
                        if u and "/for-sale/details/" in u and u not in seen:
                            seen.add(u)
                            links.append(u)
            elif isinstance(j, dict):
                u = j.get("url") or j.get("mainEntityOfPage")
                if isinstance(u, str) and "/for-sale/details/" in u and u not in seen:
                    seen.add(u)
                    links.append(u)
        except Exception:
            continue

    # 3) data attributes or inline JS (best-effort)
    text = soup.get_text(" ", strip=True)
    for m in re.finditer(r"(/for-sale/details/[\w\-\d]+)/?", text):
        u = urljoin("https://www.primelocation.com", m.group(1))
        if u not in seen:
            seen.add(u)
            links.append(u)

    return links


# ---------- Details page parsing (unchanged core, with small robustness tweaks) ----------

def parse_details(detail_html):
    soup = BeautifulSoup(detail_html, "html.parser")
    text = soup.get_text(" ", strip=True)

    address = None
    h1 = soup.find("h1")
    if h1:
        at = h1.get_text(" ", strip=True)
        if at and len(at) > 8:
            address = at
    if not address:
        mt = soup.find("meta", attrs={"property": "og:title"})
        if mt:
            content = safe_get_attr(mt, "content")
            if content:
                address = str(content)
    if not address:
        mt = soup.find("meta", attrs={"name": "twitter:title"})
        if mt:
            content = safe_get_attr(mt, "content")
            if content:
                address = str(content)

    price = extract_price(text)
    bedrooms = extract_first_int(BED_RE, text) or None
    bathrooms = extract_first_int(BATH_RE, text) or None
    postcode = extract_postcode(address or text)

    image_url = None
    og_image = soup.find("meta", attrs={"property": "og:image"})
    if og_image:
        content = safe_get_attr(og_image, "content")
        if content:
            image_url = str(content)
    if not image_url:
        imgs = soup.find_all("img")
        for img in imgs:
            src = safe_get_attr(img, "src") or safe_get_attr(img, "data-src")
            if src and str(src).startswith("http"):
                image_url = str(src)
                break

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
        "bedrooms": bedrooms,
        "bathrooms": bathrooms,
        "image_url": image_url,
        "description": desc,
    }


# ---------- Main scrape flow (parallel detail fetch) ----------

def scrape_primelocation(city, min_bedrooms, max_price, keywords_blob):
    print(f"🔍 Starting PrimeLocation scrape for: city={city}, min_beds={min_bedrooms}, max_price={max_price}", file=sys.stderr)

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
    target_min_results = as_int(os.getenv("PL_MIN_RESULTS", 5000), 5000)
    
    print(f"🎯 Target: {target_min_results} links per city, max fetch: 5000 properties", file=sys.stderr)

    # 1) Build search URLs
    urls = build_search_urls(city, min_beds, max_price_int, filters)
    print(f"🌐 Built {len(urls)} search URLs:", file=sys.stderr)
    for i, url in enumerate(urls, 1):
        print(f"  {i}. {url}", file=sys.stderr)

    # 2) Visit search pages and collect links (serial - cheaper for anti-bot)
    all_detail_links = []
    session = setup_session()
    failed_attempts = 0
    for i, u in enumerate(urls, 1):
        try:
            print(f"  📄 Fetching search page {i}/{len(urls)}: {u}", file=sys.stderr)
            html = get_html(session, u, proxies_list)
            links = collect_detail_links(html)
            print(f"    Found {len(links)} property links on page {i}", file=sys.stderr)
            all_detail_links.extend(links)
            # preserve order, de-dupe
            all_detail_links = list(dict.fromkeys(all_detail_links))
            print(f"    Total unique links so far: {len(all_detail_links)}", file=sys.stderr)
            failed_attempts = 0
            # polite pause
            rand_delay(0.2, 0.6)
            # Continue collecting until we have enough links for 5000 properties per city
            if len(all_detail_links) >= 7000:  # Collect more links to ensure 5000 good properties after filtering
                print(f"✅ Collected {len(all_detail_links)} links; sufficient for 5000 property target per city", file=sys.stderr)
        except Exception as e:
            failed_attempts += 1
            print(f"❌ Error on search page {i}: {str(e)}", file=sys.stderr)
            if failed_attempts >= 3 and len(all_detail_links) == 0:
                print(f"🔄 Primary URLs failing, trying simpler fallbacks...", file=sys.stderr)
                fallback_urls = build_search_urls(city, min_beds, max_price_int, {**filters})
                for j, fallback_url in enumerate(fallback_urls[:3]):
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
            continue

    # cap how many detail pages to actually fetch
    max_fetch = as_int(os.getenv("PL_MAX_FETCH", 5000), 5000)
    detail_links = all_detail_links[:max_fetch]
    print(f"🎯 Processing {len(detail_links)} property detail pages (capped from {len(all_detail_links)} found)", file=sys.stderr)

    # 3) Parallel fetch details
    results = []
    workers = as_int(os.getenv("PL_WORKERS", 8), 8)
    print(f"🏠 Extracting property details with {workers} workers...", file=sys.stderr)

    def fetch_and_parse(url):
        # Each worker uses its own session to reduce contention and rotate UAs
        s = setup_session()
        try:
            html = get_html(s, url, proxies_list)
            rec = parse_details(html)
            rec["property_url"] = url
            rec["city"] = city
            return rec
        except Exception as e:
            print(f"    ❌ Worker error fetching {url}: {e}", file=sys.stderr)
            return None

    with ThreadPoolExecutor(max_workers=workers) as ex:
        futures = {ex.submit(fetch_and_parse, url): url for url in detail_links}
        for fut in as_completed(futures):
            url = futures[fut]
            try:
                rec = fut.result()
                if not rec:
                    continue
                # Filters
                property_price = rec.get("price", 0)
                if max_price_int and property_price and property_price > max_price_int:
                    print(f"    ⏭️  Skipped {url}: £{property_price:,} > £{max_price_int:,}", file=sys.stderr)
                    continue
                property_beds = rec.get("bedrooms") or 0
                if min_beds and property_beds < min_beds:
                    print(f"    ⏭️  Skipped {url}: {property_beds} beds < {min_beds}", file=sys.stderr)
                    continue
                if "baths_min" in filters and rec.get("bathrooms") is not None:
                    if rec["bathrooms"] < int(filters["baths_min"]):
                        print(f"    ⏭️  Skipped {url}: only {rec['bathrooms']} baths", file=sys.stderr)
                        continue
                if not rec.get("description"):
                    rec["description"] = f"{property_beds or min_beds}-bed property in {city}."
                add_investment_metrics(rec, city)
                print(f"    ✏️  Collected: {rec.get('address','No address')} - £{rec.get('price',0):,} - {rec.get('bedrooms',0)} beds", file=sys.stderr)
                results.append(rec)
                rand_delay(0.1, 0.6)
            except Exception as e:
                print(f"    ❌ Error processing future for {url}: {e}", file=sys.stderr)
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
        print('  Example keywords: "postcode:SW1A 1AA;baths_min:2"', file=sys.stderr)
        sys.exit(1)

    city = sys.argv[1]
    min_beds = sys.argv[2]
    max_price = sys.argv[3]
    keywords = sys.argv[4]

    data, meta = scrape_primelocation(city, min_beds, max_price, keywords)

    if meta.get("cached"):
        print(f"⚠️ Using cached results: {meta['cache_path']}", file=sys.stderr)
    else:
        print(f"💾 Wrote cache: {meta['cache_path']}", file=sys.stderr)

    print(json.dumps(data, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()