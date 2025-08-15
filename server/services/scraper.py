#!/usr/bin/env python3
"""
PrimeLocation async scraper — single-site, high-throughput but polite.

Usage:
    python scraper.py "<city>" <min_bedrooms> <max_price> ""

Notes:
- This version focuses ONLY on primelocation.com (no HMO keyword logic).
- Tune concurrency & timeouts via env vars:
    PL_CONCURRENCY (default 12)
    REQUESTS_TIMEOUT (default 25)
    PL_MAX_PAGES (default 12)
    PL_MIN_RESULTS (default 200)
    PL_CACHE_TTL_HOURS (default 12)
    PROXY_LIST -> comma-separated proxies (http://user:pass@ip:port,...)
    REFRESH=1 -> force refresh even if cache is fresh
"""

import sys
import os
import re
import json
import time
import random
import hashlib
import asyncio
import async_timeout
from datetime import datetime, timedelta
from urllib.parse import urljoin, quote_plus

# network & parsing
import aiohttp
import requests
from bs4 import BeautifulSoup

# ---------- Config & helpers ----------
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64; rv:123.0) Gecko/20100101 Firefox/123.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edg/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
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

def as_int(val, default=None):
    try:
        return int(val)
    except:
        return default

def rand_delay(a=0.05, b=0.2):
    time.sleep(random.uniform(a, b))

# ---------- Cache ----------
def cache_path_for(city_slug, min_beds, max_price):
    cache_dir = os.path.join("cache", "primelocation", city_slug)
    os.makedirs(cache_dir, exist_ok=True)
    key = json.dumps({"min_beds": min_beds, "max_price": max_price}, sort_keys=True)
    stamp = hashlib.sha1(key.encode("utf-8")).hexdigest()[:16]
    return os.path.join(cache_dir, f"search_{stamp}.json")

def cache_fresh(path):
    ttl_hours = as_int(os.getenv("PL_CACHE_TTL_HOURS", 12), 12)
    if not os.path.isfile(path):
        return False
    mtime = datetime.fromtimestamp(os.path.getmtime(path))
    return datetime.utcnow() - mtime < timedelta(hours=ttl_hours)

# ---------- Parsers ----------
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

# ---------- Investment helper (kept minimal) ----------
def estimate_monthly_rent(city, address, bedrooms):
    baseline = {"london":225, "oxford":165, "cambridge":160, "bristol":150, "manchester":120}
    per_room = baseline.get((city or "").lower(), 110)
    return per_room * max(1, bedrooms or 1)

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

# ---------- URL builders ----------
def get_search_query_for_city(city):
    city_lower = city.lower()
    regional_queries = {
        "leeds": "Leeds, West Yorkshire",
        "brighton": "Brighton, East Sussex",
        "hull": "Hull, East Yorkshire",
        "bradford": "Bradford, West Yorkshire",
        "sheffield": "Sheffield, South Yorkshire",
        "manchester": "Manchester",
        "liverpool": "Liverpool, Merseyside",
        "birmingham": "Birmingham, West Midlands",
        "nottingham": "Nottingham, Nottinghamshire",
        "leicester": "Leicester, Leicestershire",
        "coventry": "Coventry, West Midlands",
        "stockport": "Stockport, Greater Manchester",
        "cardiff": "Cardiff, Wales",
        "glasgow": "Glasgow, Scotland",
        "edinburgh": "Edinburgh, Scotland",
        "newcastle": "Newcastle upon Tyne, Tyne and Wear",
    }
    return regional_queries.get(city_lower, city)

def build_search_urls(city, min_beds, max_price):
    city_slug = slug_city(city)
    q = get_search_query_for_city(city)
    max_pages = as_int(os.getenv("PL_MAX_PAGES", 12), 12)

    base_params = {
        "q": q,
        "price_max": str(max_price) if max_price else "1500000",
        "is_auction": "include",
        "is_retirement_home": "include",
        "is_shared_ownership": "include",
        "radius": "0",
        "results_sort": "highest_price",
        "search_source": "for-sale",
    }
    if min_beds:
        base_params["beds_min"] = str(min_beds)

    qs_base = "&".join([f"{k}={quote_plus(v)}" for k, v in base_params.items() if v])

    urls = []
    pattern = f"https://www.primelocation.com/for-sale/property/{city_slug}/"
    for pn in range(1, max_pages + 1):
        if pn == 1:
            urls.append(f"{pattern}?{qs_base}")
        else:
            urls.append(f"{pattern}?{qs_base}&pn={pn}")

    # fallback first pages
    urls.append(f"https://www.primelocation.com/for-sale/property/?{qs_base}")
    urls.append(f"https://www.primelocation.com/for-sale/?{qs_base}")
    urls.append(f"https://www.primelocation.com/for-sale/property/{city.lower()}/?{qs_base}")

    return urls

# ---------- collect detail links ----------
def collect_detail_links_from_html(html):
    soup = BeautifulSoup(html, "lxml")
    links = set()
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "/for-sale/details/" in href:
            if href.startswith("http"):
                links.add(href.split("?")[0])
            else:
                links.add(urljoin("https://www.primelocation.com", href.split("?")[0]))
    return list(links)

# ---------- parse detail page ----------
def parse_details(detail_html):
    soup = BeautifulSoup(detail_html, "lxml")
    text = soup.get_text(" ", strip=True)

    address = None
    h1 = soup.find("h1")
    if h1:
        at = h1.get_text(" ", strip=True)
        if at and len(at) > 8:
            address = at
    if not address:
        mt = soup.find("meta", attrs={"property":"og:title"})
        if mt:
            content = mt.get("content")
            if content:
                address = content
    if not address:
        mt = soup.find("meta", attrs={"name":"twitter:title"})
        if mt:
            content = mt.get("content")
            if content:
                address = content

    price = extract_price(text)
    bedrooms = extract_first_int(BED_RE, text) or None
    bathrooms = extract_first_int(BATH_RE, text) or None
    postcode = extract_postcode(address or text)

    image_url = None
    og_image = soup.find("meta", attrs={"property":"og:image"})
    if og_image:
        content = og_image.get("content")
        if content:
            image_url = content
    if not image_url:
        img = soup.find("img")
        if img:
            src = img.get("src")
            if src:
                image_url = src

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

# ---------- main scrape flow ----------
async def scrape_primelocation_async(city, min_bedrooms, max_price):
    print(f"🔍 Starting PrimeLocation scrape for: city={city}, min_beds={min_bedrooms}, max_price={max_price}", file=sys.stderr)
    city_slug = slug_city(city)
    cache_file = cache_path_for(city_slug, min_bedrooms, max_price)
    print(f"💾 Cache file path: {cache_file}", file=sys.stderr)

    if not os.getenv("REFRESH") and cache_fresh(cache_file):
        print(f"✅ Using fresh cache from {cache_file}", file=sys.stderr)
        with open(cache_file, "r", encoding="utf-8") as f:
            cached = json.load(f)
        return cached, {"cached": True, "cache_path": cache_file}

    proxies_env = os.getenv("PROXY_LIST", "")
    proxies_list = [p.strip() for p in proxies_env.split(",") if p.strip()]
    target_min_results = as_int(os.getenv("PL_MIN_RESULTS", 200), 200)

    # Build search URLs
    urls = build_search_urls(city, min_bedrooms, max_price)
    print(f"🌐 Built {len(urls)} search URLs (including fallbacks):", file=sys.stderr)
    for i, u in enumerate(urls, 1):
        print(f"  {i}. {u}", file=sys.stderr)

    # Session config for aiohttp
    CONCURRENCY = as_int(os.getenv("PL_CONCURRENCY", 12), 12)
    REQUEST_TIMEOUT = as_int(os.getenv("REQUESTS_TIMEOUT", 25), 25)

    connector = aiohttp.TCPConnector(limit=CONCURRENCY, ssl=False, ttl_dns_cache=300)
    base_headers = {
        "User-Agent": random.choice(USER_AGENTS),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-GB,en;q=0.9",
        "Connection": "keep-alive",
        "Referer": "https://www.google.com/",
    }
    adaptive_concurrency = CONCURRENCY
    total_403 = 0

    async with aiohttp.ClientSession(connector=connector, headers=base_headers, trust_env=True) as session:
        all_detail_links = []
        failed_attempts = 0

        # fetch search pages serially (sa retry/backoff). We keep this serial to reduce bot-detection surface.
        for i, u in enumerate(urls, 1):
            attempts = 0
            success = False
            while attempts < 4 and not success:
                attempts += 1
                # rotate UA / Referer per-request
                hdrs = {
                    "User-Agent": random.choice(USER_AGENTS),
                    "Referer": random.choice(["https://www.google.com/", "https://www.bing.com/", "https://search.yahoo.com/"])
                }
                proxy_choice = None
                if proxies_list:
                    proxy_choice = proxies_list[(i + attempts) % len(proxies_list)]

                try:
                    async with async_timeout.timeout(REQUEST_TIMEOUT):
                        if proxy_choice:
                            async with session.get(u, proxy=proxy_choice, allow_redirects=True, headers=hdrs) as resp:
                                status = resp.status
                                txt = await resp.text()
                        else:
                            async with session.get(u, allow_redirects=True, headers=hdrs) as resp:
                                status = resp.status
                                txt = await resp.text()
                    if status == 200 and txt:
                        links = collect_detail_links_from_html(txt)
                        print(f"  📄 Fetching search page {i}/{len(urls)}: found {len(links)} links", file=sys.stderr)
                        all_detail_links.extend(links)
                        all_detail_links = list(dict.fromkeys(all_detail_links))
                        success = True
                        failed_attempts = 0
                        await asyncio.sleep(0.12 + random.random()*0.18)
                    elif status in (403, 429):
                        total_403 += 1
                        backoff_time = 1.0 + attempts * 0.5 + random.random()*0.6
                        print(f"❌ Error on search page {i}: Status {status}, backing off {backoff_time}s", file=sys.stderr)
                        await asyncio.sleep(backoff_time)
                    else:
                        backoff_time = 0.2 + attempts*0.2
                        print(f"⚠️ Search page {i} returned {status}; backoff {backoff_time}s", file=sys.stderr)
                        await asyncio.sleep(backoff_time)
                except asyncio.TimeoutError:
                    print(f"❌ Timeout fetching search page {i} attempt {attempts}", file=sys.stderr)
                    await asyncio.sleep(0.5 + attempts*0.6)
                except Exception as e:
                    print(f"❌ Network error on search page {i} attempt {attempts}: {e}", file=sys.stderr)
                    await asyncio.sleep(0.6 + attempts*0.6)

            if not success:
                print(f"❌ Failed to fetch search page {i} after retries", file=sys.stderr)
                failed_attempts += 1
                if total_403 >= 4 and adaptive_concurrency > 2:
                    adaptive_concurrency = max(2, adaptive_concurrency // 2)
                    print(f"⚙️ Detected many 403s; reducing target concurrency to {adaptive_concurrency}", file=sys.stderr)

            if len(all_detail_links) >= target_min_results:
                print(f"✅ Reached target of {target_min_results} links (continuing to collect for coverage)", file=sys.stderr)

        detail_links = all_detail_links[:max(target_min_results, min(len(all_detail_links), 1000))]
        print(f"🎯 Processing {len(detail_links)} property detail pages (from {len(all_detail_links)} found)", file=sys.stderr)

        results = []
        sem = asyncio.Semaphore(adaptive_concurrency)

        async def fetch_parse(url, idx):
            nonlocal results, total_403
            async with sem:
                hdr = {
                    "User-Agent": random.choice(USER_AGENTS),
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "en-GB,en;q=0.9",
                    "Referer": random.choice(["https://www.google.com/", "https://www.bing.com/"]),
                    "Connection": "keep-alive",
                }
                proxy_choice = None
                if proxies_list:
                    proxy_choice = proxies_list[idx % len(proxies_list)]

                attempt = 0
                while attempt < 5:
                    attempt += 1
                    try:
                        async with async_timeout.timeout(REQUEST_TIMEOUT):
                            if proxy_choice:
                                async with session.get(url, headers=hdr, proxy=proxy_choice, allow_redirects=True) as resp:
                                    status = resp.status
                                    html = await resp.text()
                            else:
                                async with session.get(url, headers=hdr, allow_redirects=True) as resp:
                                    status = resp.status
                                    html = await resp.text()
                        if status == 200 and html:
                            rec = parse_details(html)
                            rec["property_url"] = url
                            rec["city"] = city
                            price_val = rec.get("price", 0) or 0
                            if max_price and price_val and price_val > max_price:
                                return
                            beds_val = rec.get("bedrooms") or 0
                            if min_bedrooms and beds_val < min_bedrooms:
                                return
                            if not rec.get("description"):
                                rec["description"] = f"{beds_val or 1}-bed property in {city}."
                            add_investment_metrics(rec, city)
                            results.append(rec)
                            await asyncio.sleep(0.02 + random.random()*0.05)
                            return
                        elif status in (403, 429):
                            total_403 += 1
                            backoff = 0.8 + attempt * 0.6 + random.random()*0.6
                            print(f"    ❌ HTTP {status} for {url} attempt {attempt}; backoff {backoff}s", file=sys.stderr)
                            await asyncio.sleep(backoff)
                            # if many 403s, be more polite
                            if total_403 > 10:
                                await asyncio.sleep(1.0 + random.random()*1.5)
                            continue
                        else:
                            await asyncio.sleep(0.2 + attempt*0.2)
                            continue
                    except asyncio.TimeoutError:
                        print(f"    ❌ Timeout for {url} attempt {attempt}", file=sys.stderr)
                        await asyncio.sleep(0.3 + attempt*0.3)
                    except Exception as e:
                        print(f"    ❌ Network error for {url} attempt {attempt}: {e}", file=sys.stderr)
                        await asyncio.sleep(0.4 + attempt*0.4)
                print(f"    ❌ Failed to fetch {url} after retries", file=sys.stderr)

        # schedule tasks
        tasks = [asyncio.create_task(fetch_parse(link, idx)) for idx, link in enumerate(detail_links)]
        await asyncio.gather(*tasks, return_exceptions=True)

        print(f"🏁 Detail fetch complete. Collected {len(results)} records (before dedupe). Total 403s seen: {total_403}", file=sys.stderr)

        seen = set()
        unique = []
        for r in results:
            sig = (r.get("property_url"), r.get("price"), r.get("bedrooms"))
            if sig in seen:
                continue
            seen.add(sig)
            unique.append(r)

        print(f"✨ Final results: {len(unique)} unique properties", file=sys.stderr)
        with open(cache_file, "w", encoding="utf-8") as f:
            json.dump(unique, f, ensure_ascii=False, indent=2)
        print(f"💾 Wrote cache: {cache_file}", file=sys.stderr)
        return unique, {"cached": False, "cache_path": cache_file}

# Synchronous fallback for environments without aiohttp installed / emergency
def scrape_primelocation_sync(city, min_bedrooms, max_price):
    print("⚠️ Running synchronous fallback (requests). This is slower.", file=sys.stderr)
    city_slug = slug_city(city)
    cache_file = cache_path_for(city_slug, min_bedrooms, max_price)
    if not os.getenv("REFRESH") and cache_fresh(cache_file):
        with open(cache_file, "r", encoding="utf-8") as f:
            return json.load(f), {"cached": True, "cache_path": cache_file}

    urls = build_search_urls(city, min_bedrooms, max_price)
    session = requests.Session()
    session.headers.update({"User-Agent": random.choice(USER_AGENTS), "Accept-Language": "en-GB,en;q=0.9"})
    proxies_env = os.getenv("PROXY_LIST", "")
    proxies_list = [p.strip() for p in proxies_env.split(",") if p.strip()]

    all_links = []
    for u in urls:
        try:
            r = session.get(u, timeout=as_int(os.getenv("REQUESTS_TIMEOUT", 25), 25))
            if r.status_code == 200:
                links = collect_detail_links_from_html(r.text)
                all_links.extend(links)
            else:
                print(f"⚠️ Sync search page {u} returned {r.status_code}", file=sys.stderr)
        except Exception as e:
            print(f"❌ Sync error fetching {u}: {e}", file=sys.stderr)

    detail_links = list(dict.fromkeys(all_links))
    results = []
    for d in detail_links[:500]:
        try:
            r = session.get(d, timeout=as_int(os.getenv("REQUESTS_TIMEOUT", 25), 25))
            if r.status_code == 200:
                rec = parse_details(r.text)
                rec["property_url"] = d
                rec["city"] = city
                add_investment_metrics(rec, city)
                results.append(rec)
            rand_delay(0.05, 0.2)
        except Exception as e:
            print(f"❌ Sync detail error {d}: {e}", file=sys.stderr)
            continue

    unique = []
    seen = set()
    for r in results:
        sig = (r.get("property_url"), r.get("price"), r.get("bedrooms"))
        if sig in seen:
            continue
        seen.add(sig)
        unique.append(r)
    with open(cache_file, "w", encoding="utf-8") as f:
        json.dump(unique, f, ensure_ascii=False, indent=2)
    return unique, {"cached": False, "cache_path": cache_file}

# CLI entry
def main():
    if len(sys.argv) < 4:
        print("Usage: python scraper.py <city> <min_bedrooms> <max_price>", file=sys.stderr)
        sys.exit(1)

    city = sys.argv[1]
    min_beds = as_int(sys.argv[2], 1) or 1
    max_price = as_int(sys.argv[3], None)

    try:
        results, meta = asyncio.run(scrape_primelocation_async(city, min_beds, max_price))
    except KeyboardInterrupt:
        print("Interrupted by user", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"⚠️ Async scrape failed or aiohttp not available: {e}", file=sys.stderr)
        results, meta = scrape_primelocation_sync(city, min_beds, max_price)

    if meta.get("cached"):
        print(f"⚠️ Using cached results: {meta['cache_path']}", file=sys.stderr)
    else:
        print(f"💾 Wrote cache: {meta['cache_path']}", file=sys.stderr)

    print(json.dumps(results, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
