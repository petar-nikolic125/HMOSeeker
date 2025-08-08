#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HMO Property Scraper for Node.js Integration
-------------------------------------------
Adapted from the original property_scraper_core.py for JSON output
and Node.js child_process integration.
"""

import argparse
import concurrent.futures as cf
import dataclasses
from dataclasses import dataclass, field, asdict
import datetime as dt
import json
import logging
import random
import re
import sys
import time
from typing import Any, Dict, Iterable, List, Optional, Tuple, Union, Callable
from urllib.parse import urlencode, urljoin, urlparse, urlunparse, parse_qsl, quote

import requests
from bs4 import BeautifulSoup

# Configuration
DEFAULT_TIMEOUT = 30
DEFAULT_BACKOFF_FACTOR = 0.7
DEFAULT_MAX_RETRIES = 3
DEFAULT_CONCURRENCY = 4
DEFAULT_LISTING_LIMIT = 50
DEFAULT_MAX_PAGES = 3

DEFAULT_USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64; rv:124.0) Gecko/20100101 Firefox/124.0",
]

DEFAULT_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "DNT": "1",
}

IMG_FALLBACKS = [
    "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&h=600&fit=crop&crop=entropy&q=80",
    "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&h=600&fit=crop&crop=entropy&q=80",
    "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&h=600&fit=crop&crop=entropy&q=80",
]

# Logging setup
def setup_logging(verbosity: int = 1) -> None:
    level = logging.WARNING
    if verbosity == 1:
        level = logging.INFO
    elif verbosity >= 2:
        level = logging.DEBUG
    
    logging.basicConfig(
        level=level,
        format="%(asctime)s | %(levelname)-8s | %(message)s",
        datefmt="%H:%M:%S",
    )

# Utility functions
def clean_text(s: Optional[str]) -> str:
    if not s:
        return ""
    return re.sub(r"\s+", " ", s).strip()

def extract_int(text: str) -> Optional[int]:
    if not text:
        return None
    m = re.search(r"(\d+)", text)
    return int(m.group(1)) if m else None

def extract_price(text: str) -> int:
    """Extract integer GBP price from text like '£350,000 Guide price'"""
    if not text:
        return 0
    t = text.replace("\xa0", " ")
    m = re.search(r"£\s*([\d,]+)", t)
    if not m:
        m2 = re.search(r"\b([\d,]{3,})\b", t)
        if not m2:
            return 0
        val = m2.group(1)
    else:
        val = m.group(1)
    try:
        return int(val.replace(",", ""))
    except ValueError:
        return 0

def extract_bedrooms(text: str) -> Optional[int]:
    if not text:
        return None
    m = re.search(r"(\d+)\s*(?:bed|bedroom)s?\b", text, re.IGNORECASE)
    if m:
        return int(m.group(1))
    lone = re.search(r"\b(\d+)\b", text)
    return int(lone.group(1)) if lone else None

def extract_bathrooms(text: str) -> Optional[int]:
    if not text:
        return None
    m = re.search(r"(\d+)\s*(?:bath|bathroom)s?\b", text, re.IGNORECASE)
    return int(m.group(1)) if m else None

def extract_area_sqm(text: str) -> Optional[int]:
    if not text:
        return None
    t = text.replace("\xa0", " ")
    
    # Square meters patterns
    sqm_patterns = [
        r"(\d{2,4}(?:,\d{3})?)\s*(?:sq\.?\s*m|sqm|square\s*metres|square\s*meters)",
        r"(\d{2,4}(?:,\d{3})?)\s*(?:m²|m2)\b",
    ]
    
    for pat in sqm_patterns:
        m = re.search(pat, t, re.IGNORECASE)
        if m:
            try:
                val = int(m.group(1).replace(",", ""))
                return val if val > 0 else None
            except ValueError:
                pass
    
    # Square feet patterns - convert to sqm
    sqft_patterns = [
        r"(\d{2,4}(?:,\d{3})?)\s*(?:sq\.?\s*ft|sqft|square\s*feet)",
        r"(\d{2,4}(?:,\d{3})?)\s*(?:square\s*foot|sq\s*ft)",
    ]
    
    for pat in sqft_patterns:
        m = re.search(pat, t, re.IGNORECASE)
        if m:
            try:
                sqft = int(m.group(1).replace(",", ""))
                sqm = int(round(sqft * 0.092903))
                return sqm if sqm > 0 else None
            except ValueError:
                pass
    return None

def ensure_absolute(base: str, href: str) -> str:
    if href.startswith(("http://", "https://")):
        return href
    return urljoin(base, href)

def listing_id_from_url(u: str) -> Optional[str]:
    try:
        path = urlparse(u).path
        m = re.search(r"/details/(\d+)", path)
        if m: return m.group(1)
        m = re.search(r"/property/(\d+)", path)
        if m: return m.group(1)
        return None
    except Exception:
        return None

# Data model
@dataclass
class PropertyListing:
    source: str
    title: str
    address: str
    price: int
    bedrooms: Optional[int] = None
    bathrooms: Optional[int] = None
    area_sqm: Optional[int] = None
    description: Optional[str] = None
    property_url: Optional[str] = None
    image_url: Optional[str] = None
    listing_id: Optional[str] = None
    property_type: Optional[str] = None
    tenure: Optional[str] = None
    postcode: Optional[str] = None
    agent_name: Optional[str] = None
    agent_phone: Optional[str] = None
    agent_url: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    date_listed: Optional[str] = None
    scraped_at: str = field(default_factory=lambda: dt.datetime.utcnow().isoformat())

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

# Rate limiter
class SimpleRateLimiter:
    def __init__(self, per_host_delay: float = 1.0):
        self.per_host_delay = per_host_delay
        self._last: Dict[str, float] = {}

    def wait(self, url: str) -> None:
        host = urlparse(url).netloc
        now = time.time()
        last = self._last.get(host, 0.0)
        delta = now - last
        if delta < self.per_host_delay:
            sleep_time = self.per_host_delay - delta + random.uniform(0.1, 0.3)
            time.sleep(sleep_time)
        self._last[host] = time.time()

# HTTP Client
class HttpClient:
    def __init__(
        self,
        timeout: int = DEFAULT_TIMEOUT,
        backoff_factor: float = DEFAULT_BACKOFF_FACTOR,
        max_retries: int = DEFAULT_MAX_RETRIES,
        user_agents: Optional[List[str]] = None,
        headers: Optional[Dict[str, str]] = None,
        rate_limiter: Optional[SimpleRateLimiter] = None,
    ) -> None:
        self.session = requests.Session()
        self.timeout = timeout
        self.backoff_factor = backoff_factor
        self.max_retries = max_retries
        self.user_agents = user_agents or DEFAULT_USER_AGENTS[:]
        self.base_headers = headers or DEFAULT_HEADERS.copy()
        self.rate_limiter = rate_limiter or SimpleRateLimiter()

    def _headers(self, extra: Optional[Dict[str, str]] = None) -> Dict[str, str]:
        hdrs = dict(self.base_headers)
        hdrs["User-Agent"] = random.choice(self.user_agents)
        if extra:
            hdrs.update(extra)
        return hdrs

    def get(self, url: str) -> Optional[requests.Response]:
        self.rate_limiter.wait(url)
        
        attempt = 0
        while attempt < self.max_retries:
            try:
                resp = self.session.get(
                    url,
                    headers=self._headers(),
                    timeout=self.timeout,
                    allow_redirects=True,
                )
                if resp.status_code == 200:
                    return resp
                if resp.status_code in (429, 500, 502, 503, 504):
                    attempt += 1
                    sleep_s = (2 ** attempt) * self.backoff_factor + random.uniform(0.2, 0.6)
                    logging.warning(f"HTTP {resp.status_code} for {url} — retry {attempt}/{self.max_retries} in {sleep_s:.1f}s")
                    time.sleep(sleep_s)
                    continue
                logging.info(f"HTTP {resp.status_code} for {url} — no retry")
                return resp
            except requests.RequestException as e:
                attempt += 1
                sleep_s = (2 ** attempt) * self.backoff_factor + random.uniform(0.2, 0.6)
                logging.warning(f"Network error on {url}: {e} — retry {attempt}/{self.max_retries} in {sleep_s:.1f}s")
                time.sleep(sleep_s)
        
        logging.error(f"Failed to GET after {self.max_retries} attempts: {url}")
        return None

# URL builders
def build_url(base: str, path: str, params: Dict[str, Any]) -> str:
    q = urlencode({k: v for k, v in params.items() if v not in (None, "", False)}, doseq=True)
    if path and not base.endswith("/"):
        base = base.rstrip("/") + "/"
    return urljoin(base, path.lstrip("/")) + (("?" + q) if q else "")

def build_zoopla_urls(city: str, min_bedrooms: Optional[int], max_price: Optional[int], max_pages: int) -> List[str]:
    city_slug = city.lower().replace(" ", "-")
    base = "https://www.zoopla.co.uk"
    path = f"/for-sale/property/{city_slug}/"
    
    params_base: Dict[str, Any] = {
        "q": city.replace(" ", "+"),
        "property_type": "houses",
    }
    
    if min_bedrooms is not None:
        params_base["beds_min"] = min_bedrooms
    if max_price is not None:
        params_base["price_max"] = max_price

    urls = []
    for page in range(1, min(max_pages + 1, 4)):  # Limit to 3 pages max
        params = dict(params_base)
        if page > 1:
            params["pn"] = page
        urls.append(build_url(base, path, params))
    return urls

def build_primelocation_urls(city: str, min_bedrooms: Optional[int], max_price: Optional[int], max_pages: int) -> List[str]:
    city_slug = city.lower().replace(" ", "-")
    base = "https://www.primelocation.com"
    path = f"/for-sale/property/{city_slug}/"
    
    params_base: Dict[str, Any] = {
        "q": city,
        "search_source": "for-sale",
    }
    
    if min_bedrooms is not None:
        params_base["beds_min"] = min_bedrooms
    if max_price is not None:
        params_base["price_max"] = max_price

    urls = []
    for page in range(1, min(max_pages + 1, 3)):  # Limit to 2 pages max
        params = dict(params_base)
        if page > 1:
            params["pn"] = page
        urls.append(build_url(base, path, params))
    return urls

# Base parser
class BaseParser:
    SOURCE: str = "base"

    def parse_list(self, soup: BeautifulSoup, page_url: str) -> List[PropertyListing]:
        raise NotImplementedError

# Zoopla parser
class ZooplaParser(BaseParser):
    SOURCE = "zoopla"

    def parse_list(self, soup: BeautifulSoup, page_url: str) -> List[PropertyListing]:
        listings: List[PropertyListing] = []
        
        # Find property cards
        selectors = [
            '[data-testid*="search-result"]',
            '[data-testid*="listing"]',
            'article[data-testid]',
            '.search-results .property-listing',
            '.property-listing',
            'article',
        ]
        
        blocks = []
        for sel in selectors:
            found = soup.select(sel)
            if found:
                blocks = found
                logging.debug(f"Zoopla: found {len(found)} blocks with '{sel}'")
                break

        if not blocks:
            # Fallback: find price elements and go up
            price_elems = soup.select('[data-testid*="listing-price"], .listing-price, .display-price, [class*="price"]')
            parents = []
            for pe in price_elems:
                parent = pe.parent
                steps = 0
                while parent and steps < 4 and parent.name not in ("html", "body"):
                    if len(clean_text(parent.get_text(" ", strip=True))) > 40:
                        parents.append(parent)
                        break
                    parent = parent.parent
                    steps += 1
            blocks = parents

        base_url = "https://www.zoopla.co.uk"
        for block in blocks:
            item = self._parse_card(block, base_url)
            if item:
                listings.append(item)

        return listings

    def _parse_card(self, block, base_url: str) -> Optional[PropertyListing]:
        text = clean_text(block.get_text(" ", strip=True))
        if not text or len(text) < 20:
            return None

        # Extract price
        price = 0
        price_selectors = [
            '[data-testid*="price"]', '[class*="price"]', '.price', 
            '[aria-label*="price"]', '.display-price', '.property-price', 
            '.listing-price', 'span[title*="£"]'
        ]
        
        for sel in price_selectors:
            for pc in block.select(sel):
                pv = extract_price(pc.get_text(" ", strip=True) or pc.get("title", ""))
                if pv > 0:
                    price = pv
                    break
            if price > 0:
                break
                
        if price == 0:
            price = extract_price(text)
        if price <= 0:
            return None

        # Extract title/address
        title = None
        title_selectors = [
            "h1", "h2", "h3", "h4", "h5",
            '[data-testid*="title"]', '[data-testid*="address"]',
            ".property-title", ".listing-title", ".property-address", "address",
            'a[title]', 'a[href*="/details/"] span', 'a[href*="/property/"] span'
        ]
        
        for sel in title_selectors:
            el = block.select_one(sel)
            if el:
                tx = clean_text(el.get_text(" ", strip=True) or el.get("title", ""))
                if tx and not tx.startswith("£"):
                    title = tx
                    break
        
        if not title:
            title = "Property"

        # Extract property URL
        prop_url = None
        link = block.select_one('a[href*="/details/"], a[href*="/property/"], a[href*="/for-sale/"]')
        if link and link.get("href"):
            prop_url = ensure_absolute(base_url, link["href"])

        # Extract bedrooms
        beds = None
        bed_selectors = [
            '[data-testid*="bed"]', '[data-testid*="room"]', '[class*="bed"]',
            '[aria-label*="bed"]', ".bedrooms", ".property-bedrooms", ".beds",
            'span[title*="bed"]'
        ]
        
        for sel in bed_selectors:
            el = block.select_one(sel)
            if el:
                beds = extract_bedrooms(clean_text(el.get_text(" ", strip=True) or el.get("title", "")))
                if beds:
                    break
        
        if beds is None:
            beds = extract_bedrooms(text)

        # Extract image
        img = None
        imgtag = block.select_one("img")
        if imgtag and imgtag.get("src") and "placeholder" not in (imgtag["src"] or "").lower():
            src = imgtag["src"]
            if src.startswith(("http", "//")):
                img = src if src.startswith("http") else "https:" + src

        # Extract bathrooms from text
        baths = extract_bathrooms(text)
        
        # Extract area
        area = extract_area_sqm(text)

        return PropertyListing(
            source=self.SOURCE,
            title=title,
            address=title,
            price=price,
            bedrooms=beds,
            bathrooms=baths,
            area_sqm=area,
            property_url=prop_url,
            image_url=img or random.choice(IMG_FALLBACKS),
            listing_id=listing_id_from_url(prop_url) if prop_url else None,
        )

# PrimeLocation parser
class PrimeLocationParser(BaseParser):
    SOURCE = "primelocation"

    def parse_list(self, soup: BeautifulSoup, page_url: str) -> List[PropertyListing]:
        listings: List[PropertyListing] = []
        
        selectors = [
            ".property-card", ".search-property-result", ".property-item",
            '[class*="PropertyCard"]', '[class*="property-card"]', "article",
        ]
        
        blocks = []
        for sel in selectors:
            found = soup.select(sel)
            if found:
                blocks = found
                logging.debug(f"PrimeLocation: found {len(found)} blocks with '{sel}'")
                break

        if not blocks:
            price_elems = soup.select('[data-testid*="listing-price"], .listing-price, .display-price, [class*="price"]')
            parents = []
            for pe in price_elems:
                parent = pe.parent
                steps = 0
                while parent and steps < 4 and parent.name not in ("html", "body"):
                    if len(clean_text(parent.get_text(" ", strip=True))) > 40:
                        parents.append(parent)
                        break
                    parent = parent.parent
                    steps += 1
            blocks = parents

        base_url = "https://www.primelocation.com"
        for block in blocks:
            item = self._parse_card(block, base_url)
            if item:
                listings.append(item)

        return listings

    def _parse_card(self, block, base_url: str) -> Optional[PropertyListing]:
        text = clean_text(block.get_text(" ", strip=True))
        if not text or len(text) < 20:
            return None

        # Similar logic to Zoopla parser
        price = 0
        for pc in block.select('[data-testid*="price"], [class*="price"], .price, [aria-label*="price"], .display-price, .property-price, .listing-price, span[title*="£"]'):
            pv = extract_price(pc.get_text(" ", strip=True) or pc.get("title", ""))
            if pv > 0:
                price = pv
                break
        
        if price == 0:
            price = extract_price(text)
        if price <= 0:
            return None

        # Title extraction
        title = None
        for sel in ["h1", "h2", "h3", "h4", "h5", '[data-testid*="title"]', '[data-testid*="address"]', ".property-title", ".listing-title", ".property-address", "address", 'a[title]']:
            el = block.select_one(sel)
            if el:
                tx = clean_text(el.get_text(" ", strip=True) or el.get("title", ""))
                if tx and not tx.startswith("£"):
                    title = tx
                    break
        
        if not title:
            title = "Property"

        # URL extraction
        prop_url = None
        link = block.select_one('a[href*="/details/"], a[href*="/property/"], a[href*="/for-sale/"]')
        if link and link.get("href"):
            prop_url = ensure_absolute(base_url, link["href"])

        # Bedrooms
        beds = None
        for sel in ['[data-testid*="bed"]', '[class*="bed"]', ".bedrooms", ".property-bedrooms", ".beds"]:
            el = block.select_one(sel)
            if el:
                beds = extract_bedrooms(clean_text(el.get_text(" ", strip=True)))
                if beds:
                    break
        
        if beds is None:
            beds = extract_bedrooms(text)

        # Image
        img = None
        imgtag = block.select_one("img")
        if imgtag and imgtag.get("src") and "placeholder" not in (imgtag["src"] or "").lower():
            src = imgtag["src"]
            if src.startswith(("http", "//")):
                img = src if src.startswith("http") else "https:" + src

        baths = extract_bathrooms(text)
        area = extract_area_sqm(text)

        return PropertyListing(
            source=self.SOURCE,
            title=title,
            address=title,
            price=price,
            bedrooms=beds,
            bathrooms=baths,
            area_sqm=area,
            property_url=prop_url,
            image_url=img or random.choice(IMG_FALLBACKS),
            listing_id=listing_id_from_url(prop_url) if prop_url else None,
        )

# Main scraper class
class PropertyScraper:
    def __init__(
        self,
        concurrency: int = DEFAULT_CONCURRENCY,
        timeout: int = DEFAULT_TIMEOUT,
        max_retries: int = DEFAULT_MAX_RETRIES,
        listing_limit: int = DEFAULT_LISTING_LIMIT,
        max_pages: int = DEFAULT_MAX_PAGES,
    ):
        self.concurrency = concurrency
        self.timeout = timeout
        self.max_retries = max_retries
        self.listing_limit = listing_limit
        self.max_pages = max_pages
        
        self.client = HttpClient(
            timeout=timeout,
            max_retries=max_retries,
            rate_limiter=SimpleRateLimiter(per_host_delay=1.5)
        )
        
        self.parsers = {
            "zoopla": ZooplaParser(),
            "primelocation": PrimeLocationParser(),
        }

    def scrape(
        self,
        city: str,
        min_bedrooms: Optional[int] = None,
        max_price: Optional[int] = None,
        sources: Optional[List[str]] = None,
    ) -> List[PropertyListing]:
        """Scrape properties from specified sources"""
        
        if sources is None:
            sources = ["zoopla", "primelocation"]
        
        # Build URLs for all sources
        all_urls = []
        for source in sources:
            if source == "zoopla":
                urls = build_zoopla_urls(city, min_bedrooms, max_price, self.max_pages)
                all_urls.extend([(url, source) for url in urls])
            elif source == "primelocation":
                urls = build_primelocation_urls(city, min_bedrooms, max_price, self.max_pages)
                all_urls.extend([(url, source) for url in urls])

        if not all_urls:
            logging.warning("No URLs generated for scraping")
            return []

        logging.info(f"Generated {len(all_urls)} URLs to scrape")
        
        # Fetch pages concurrently
        all_listings = []
        with cf.ThreadPoolExecutor(max_workers=self.concurrency) as executor:
            future_to_url = {
                executor.submit(self._scrape_page, url, source): (url, source)
                for url, source in all_urls
            }
            
            for future in cf.as_completed(future_to_url):
                url, source = future_to_url[future]
                try:
                    listings = future.result()
                    all_listings.extend(listings)
                    logging.info(f"Scraped {len(listings)} listings from {source}: {url}")
                except Exception as e:
                    logging.error(f"Failed to scrape {url}: {e}")

        # Deduplicate listings
        seen = set()
        unique_listings = []
        for listing in all_listings:
            key = (listing.title.lower(), listing.price, listing.listing_id)
            if key not in seen:
                seen.add(key)
                unique_listings.append(listing)

        # Apply HMO filtering (4+ bedrooms minimum)
        hmo_listings = [
            listing for listing in unique_listings
            if listing.bedrooms and listing.bedrooms >= 4
        ]

        logging.info(f"Found {len(all_listings)} total listings, {len(unique_listings)} unique, {len(hmo_listings)} HMO suitable")
        
        # Limit results
        return hmo_listings[:self.listing_limit]

    def _scrape_page(self, url: str, source: str) -> List[PropertyListing]:
        """Scrape a single page"""
        resp = self.client.get(url)
        if not resp:
            return []

        try:
            soup = BeautifulSoup(resp.text, 'html.parser')
            parser = self.parsers.get(source)
            if not parser:
                logging.warning(f"No parser for source: {source}")
                return []
            
            return parser.parse_list(soup, url)
        except Exception as e:
            logging.error(f"Failed to parse {url}: {e}")
            return []

def main():
    parser = argparse.ArgumentParser(description="HMO Property Scraper")
    parser.add_argument("city", help="City to search for properties")
    parser.add_argument("--min-bedrooms", type=int, help="Minimum number of bedrooms")
    parser.add_argument("--max-price", type=int, help="Maximum price in GBP")
    parser.add_argument("--sources", nargs="+", choices=["zoopla", "primelocation"], 
                      default=["zoopla", "primelocation"], help="Sources to scrape")
    parser.add_argument("--limit", type=int, default=DEFAULT_LISTING_LIMIT, help="Maximum listings to return")
    parser.add_argument("--max-pages", type=int, default=DEFAULT_MAX_PAGES, help="Maximum pages per source")
    parser.add_argument("--concurrency", type=int, default=DEFAULT_CONCURRENCY, help="Concurrent requests")
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT, help="Request timeout")
    parser.add_argument("--verbose", "-v", action="count", default=1, help="Increase verbosity")
    
    args = parser.parse_args()
    
    setup_logging(args.verbose)
    
    scraper = PropertyScraper(
        concurrency=args.concurrency,
        timeout=args.timeout,
        listing_limit=args.limit,
        max_pages=args.max_pages,
    )
    
    try:
        listings = scraper.scrape(
            city=args.city,
            min_bedrooms=args.min_bedrooms,
            max_price=args.max_price,
            sources=args.sources,
        )
        
        # Output JSON for Node.js consumption
        result = {
            "success": True,
            "city": args.city,
            "filters": {
                "min_bedrooms": args.min_bedrooms,
                "max_price": args.max_price,
                "sources": args.sources,
            },
            "count": len(listings),
            "listings": [listing.to_dict() for listing in listings],
            "scraped_at": dt.datetime.utcnow().isoformat(),
        }
        
        print(json.dumps(result, indent=2))
        
    except Exception as e:
        error_result = {
            "success": False,
            "error": str(e),
            "city": args.city,
            "scraped_at": dt.datetime.utcnow().isoformat(),
        }
        print(json.dumps(error_result, indent=2))
        sys.exit(1)

if __name__ == "__main__":
    main()
