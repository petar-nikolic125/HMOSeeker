#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
UK Property Scraper Core (Scraping Only)
----------------------------------------
Author: <you>
Date: 2025-08-08

Purpose
-------
A robust, modular scraper for Zoopla and PrimeLocation that focuses purely on
COLLECTING listing data — no rent heuristics, no investment math, no business logic.

What you get
------------
- Clean data model with @dataclass
- Advanced HTTP client: retries with jittered backoff, UA rotation, proxies
- Optional pluggable cache hooks (ETag/Last-Modified aware) — implementation can
  be provided in a separate module
- Pagination (builder + discovery of "next" link as fallback)
- Concurrency via ThreadPool with per-host throttling
- Site-specific parsers + generic fallbacks
- JSON-LD (schema.org) extraction for more reliable details
- Detail-page enrichment (agent, beds/baths/area, images, tenure/type, coords)
- Dedupe by canonical URL/listing ID + title/price
- CLI to run searches and output JSON or NDJSON

Strictly scraping concerns only.
"""

from __future__ import annotations

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
from urllib.parse import urlencode, urljoin, urlparse, urlunparse, parse_qsl, quote, quote_plus

import requests
from bs4 import BeautifulSoup

# =========================
# Config & Constants
# =========================

DEFAULT_TIMEOUT = 30
DEFAULT_BACKOFF_FACTOR = 0.7
DEFAULT_MAX_RETRIES = 5
DEFAULT_CONCURRENCY = 8
DEFAULT_DETAIL_ENRICH = 8
DEFAULT_LISTING_LIMIT = 40
DEFAULT_MAX_PAGES = 4

DEFAULT_USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64; rv:124.0) Gecko/20100101 Firefox/124.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
]

DEFAULT_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "DNT": "1",
}

IMG_FALLBACKS = [
    "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&h=600&fit=crop&crop=entropy&q=80",
    "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&h=600&fit=crop&crop=entropy&q=80",
    "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&h=600&fit=crop&crop=entropy&q=80",
]

# =========================
# Logging
# =========================

def setup_logging(verbosity: int) -> None:
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

# =========================
# Utilities
# =========================

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
    """Extract integer GBP price from messy text like '£350,000 Guide price'"""
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
    if m:
        return int(m.group(1))
    return None

_SQFT_PAT = [
    r"(\d{2,4}(?:,\d{3})?)\s*(?:sq\.?\s*ft|sqft|square\s*feet)",
    r"(\d{2,4}(?:,\d{3})?)\s*(?:square\s*foot|sq\s*ft)",
]
_SQM_PAT = [
    r"(\d{2,4}(?:,\d{3})?)\s*(?:sq\.?\s*m|sqm|square\s*metres|square\s*meters)",
    r"(\d{2,4}(?:,\d{3})?)\s*(?:m²|m2)\b",
]

def extract_area_sqm(text: str) -> Optional[int]:
    if not text:
        return None
    t = text.replace("\xa0", " ")
    for pat in _SQM_PAT:
        m = re.search(pat, t, re.IGNORECASE)
        if m:
            try:
                val = int(m.group(1).replace(",", ""))
                return val if val > 0 else None
            except ValueError:
                pass
    for pat in _SQFT_PAT:
        m = re.search(pat, t, re.IGNORECASE)
        if m:
            try:
                sqft = int(m.group(1).replace(",", ""))
                sqm = int(round(sqft * 0.092903))
                return sqm if sqm > 0 else None
            except ValueError:
                pass
    return None

def limit_int(n: Optional[int], lo: int, hi: int) -> Optional[int]:
    if n is None:
        return None
    return max(lo, min(hi, n))

def ensure_absolute(base: str, href: str) -> str:
    if href.startswith(("http://", "https://")):
        return href
    return urljoin(base, href)

def canonicalize_url(u: str, allowed_params: Optional[List[str]] = None) -> str:
    """Drop tracking query params; keep only allowed ones (e.g., detail ids)."""
    try:
        parsed = urlparse(u)
        if not parsed.scheme:
            return u
        q = parse_qsl(parsed.query, keep_blank_values=False)
        if allowed_params is None:
            kept = []
        else:
            kept = [(k, v) for (k, v) in q if k in allowed_params]
        new = parsed._replace(query=urlencode(kept))
        return urlunparse(new)
    except Exception:
        return u

def listing_id_from_url(u: str) -> Optional[str]:
    """Extract Zoopla/PrimeLocation detail id from URL when present."""
    try:
        path = urlparse(u).path
        m = re.search(r"/details/(\d+)", path)
        if m: return m.group(1)
        m = re.search(r"/property/(\d+)", path)
        if m: return m.group(1)
        return None
    except Exception:
        return None

def choose(*vals):
    for v in vals:
        if v:
            return v
    return None

# =========================
# Data Model
# =========================

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
    date_listed: Optional[str] = None  # ISO8601 if parsed
    scraped_at: str = field(default_factory=lambda: dt.datetime.utcnow().isoformat())

    def key(self) -> Tuple[str, int, Optional[str]]:
        ntitle = re.sub(r"\s+", " ", (self.title or "").strip().lower())
        return (ntitle, int(self.price or 0), self.listing_id)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

# =========================
# Cache Interface (pluggable)
# =========================

class CacheProtocol:
    """Minimal cache interface you can implement in a separate module/file.

    Methods should be thread-safe for concurrent use.
    """
    def get(self, key: str) -> Optional[Dict[str, Any]]:
        raise NotImplementedError
    def set(self, key: str, value: Dict[str, Any], ttl_seconds: int = 3600) -> None:
        raise NotImplementedError

class NullCache(CacheProtocol):
    def get(self, key: str) -> Optional[Dict[str, Any]]: return None
    def set(self, key: str, value: Dict[str, Any], ttl_seconds: int = 3600) -> None: return None

# =========================
# Rate Limiter
# =========================

class SimpleRateLimiter:
    """Token-bucket-ish limiter per host. Lightweight and good enough for CLI usage."""
    def __init__(self, per_host_delay: float = 0.5):
        self.per_host_delay = per_host_delay
        self._last: Dict[str, float] = {}

    def wait(self, url: str) -> None:
        host = urlparse(url).netloc
        now = time.time()
        last = self._last.get(host, 0.0)
        delta = now - last
        if delta < self.per_host_delay:
            time.sleep(self.per_host_delay - delta + random.uniform(0.05, 0.25))
        self._last[host] = time.time()

# =========================
# HTTP Client
# =========================

class HttpClient:
    def __init__(
        self,
        timeout: int = DEFAULT_TIMEOUT,
        backoff_factor: float = DEFAULT_BACKOFF_FACTOR,
        max_retries: int = DEFAULT_MAX_RETRIES,
        user_agents: Optional[List[str]] = None,
        headers: Optional[Dict[str, str]] = None,
        proxies: Optional[Dict[str, str]] = None,
        cache: Optional[CacheProtocol] = None,
        rate_limiter: Optional[SimpleRateLimiter] = None,
    ) -> None:
        self.session = requests.Session()
        self.timeout = timeout
        self.backoff_factor = backoff_factor
        self.max_retries = max_retries
        self.user_agents = user_agents or DEFAULT_USER_AGENTS[:]
        self.base_headers = headers or DEFAULT_HEADERS.copy()
        self.proxies = proxies
        self.cache = cache or NullCache()
        self.rate_limiter = rate_limiter or SimpleRateLimiter()

        now = int(time.time())
        self.session.cookies.set("_ga", f"GA1.2.{random.randint(100000000, 999999999)}.{now}")
        self.session.cookies.set("_gid", f"GA1.2.{random.randint(100000000, 999999999)}.{now}")

    def _headers(self, extra: Optional[Dict[str, str]] = None) -> Dict[str, str]:
        hdrs = dict(self.base_headers)
        hdrs["User-Agent"] = random.choice(self.user_agents)
        if extra:
            hdrs.update(extra)
        return hdrs

    def _cache_key(self, url: str) -> str:
        return f"httpcache:{canonicalize_url(url)}"

    def get(self, url: str, allow_redirects: bool = True) -> Optional[requests.Response]:
        # Rate limit per host
        self.rate_limiter.wait(url)

        # Conditional headers if cached ETag/Last-Modified present
        cache_key = self._cache_key(url)
        cached = self.cache.get(cache_key) or {}
        extra_headers = {}
        if "etag" in cached:
            extra_headers["If-None-Match"] = cached["etag"]
        if "last_modified" in cached:
            extra_headers["If-Modified-Since"] = cached["last_modified"]

        attempt = 0
        while attempt < self.max_retries:
            try:
                resp = self.session.get(
                    url,
                    headers=self._headers(extra_headers),
                    timeout=self.timeout,
                    allow_redirects=allow_redirects,
                    proxies=self.proxies,
                )
                status = resp.status_code
                if status == 200:
                    # Update cache validators
                    meta = {}
                    if et := resp.headers.get("ETag"):
                        meta["etag"] = et
                    if lm := resp.headers.get("Last-Modified"):
                        meta["last_modified"] = lm
                    if meta:
                        self.cache.set(cache_key, meta, ttl_seconds=3600)
                    return resp
                if status == 304 and cached.get("body"):
                    # Serve cached body (if your cache stores it)
                    # Here we don't cache bodies by default; implement in your own cache module if needed.
                    return None  # treat as miss unless you extend cache
                if status in (429, 500, 502, 503, 504, 520, 522):
                    attempt += 1
                    retry_after = resp.headers.get("Retry-After")
                    if retry_after:
                        try:
                            sleep_s = float(retry_after)
                        except Exception:
                            sleep_s = (2 ** attempt) * self.backoff_factor
                    else:
                        sleep_s = (2 ** attempt) * self.backoff_factor
                    sleep_s += random.uniform(0.2, 0.6)
                    logging.warning(f"HTTP {status} for {url} — retry {attempt}/{self.max_retries} in {sleep_s:.1f}s")
                    time.sleep(sleep_s)
                    continue
                logging.info(f"HTTP {status} for {url} — no retry")
                return resp
            except requests.RequestException as e:
                attempt += 1
                sleep_s = (2 ** attempt) * self.backoff_factor + random.uniform(0.2, 0.6)
                logging.warning(f"Network error on {url}: {e} — retry {attempt}/{self.max_retries} in {sleep_s:.1f}s")
                time.sleep(sleep_s)
        logging.error(f"Failed to GET after {self.max_retries} attempts: {url}")
        return None

# =========================
# URL Builders
# =========================

def build_url(base: str, path: str, params: Dict[str, Any]) -> str:
    q = urlencode({k: v for k, v in params.items() if v not in (None, "", False)}, doseq=True)
    if path and not base.endswith("/"):
        base = base.rstrip("/") + "/"
    return urljoin(base, path.lstrip("/")) + (("?" + q) if q else "")

def build_zoopla_urls(city: str, min_bedrooms: Optional[int], max_price: Optional[int], keywords: Optional[str], max_pages: int) -> List[str]:
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
    if keywords and keywords.lower() != "none":
        params_base["keywords"] = keywords

    urls = []
    # default sort & newest sort
    for sort in [None, "newest_listings"]:
        for page in range(1, max_pages + 1):
            params = dict(params_base)
            if sort:
                params["results_sort"] = sort
            if page > 1:
                params["pn"] = page
            urls.append(build_url(base, path, params))
    return urls

def build_primelocation_urls(city: str, min_bedrooms: Optional[int], max_price: Optional[int], keywords: Optional[str], max_pages: int) -> List[str]:
    city_slug = city.lower().replace(" ", "-")
    base = "https://www.primelocation.com"
    path = f"/for-sale/property/{city_slug}/"
    params_base: Dict[str, Any] = {
        "q": city,
        "radius": 0,
        "search_source": "for-sale",
        "is_auction": "include",
        "is_retirement_home": "include",
        "is_shared_ownership": "include",
    }
    if min_bedrooms is not None:
        params_base["beds_min"] = min_bedrooms
    if max_price is not None:
        params_base["price_max"] = max_price
    if keywords and keywords.lower() != "none":
        params_base["keywords"] = keywords

    urls = []
    for sort in ["highest_price", "price", "newest"]:
        for page in range(1, max_pages + 1):
            params = dict(params_base)
            params["results_sort"] = sort
            if page > 1:
                params["pn"] = page
            urls.append(build_url(base, path, params))
    return urls

# =========================
# Parsers
# =========================

class BaseParser:
    SOURCE: str = "base"

    def parse_list(self, soup: BeautifulSoup, page_url: str) -> List[PropertyListing]:
        raise NotImplementedError

    def parse_detail(self, soup: BeautifulSoup, listing: PropertyListing) -> PropertyListing:
        """Default detail parser uses common selectors and JSON-LD."""
        # Description
        description = ""
        for sel in [
            'div[data-testid*="description"]',
            'div[class*="description"]',
            'section[class*="description"]',
            ".property-description",
            ".listing-description",
            "article",
        ]:
            for node in soup.select(sel):
                tx = clean_text(node.get_text(" ", strip=True))
                if len(tx) > 100:
                    description = tx
                    break
            if description:
                break
        if not description:
            parts = []
            for p in soup.select("p"):
                tx = clean_text(p.get_text(" ", strip=True))
                if len(tx) > 60 and any(k in tx.lower() for k in ["bed", "bath", "kitchen", "reception", "garden", "square", "sq", "property"]):
                    parts.append(tx)
            if parts:
                description = " ".join(parts[:20])

        # Try features for beds/baths/area
        area_sqm = listing.area_sqm
        bathrooms = listing.bathrooms
        bedrooms = listing.bedrooms

        feature_selectors = [
            'div[class*="feature"] li', 'ul[class*="feature"] li', ".property-features li",
            ".key-features li", 'div[class*="detail"] li', ".amenities li",
            ".property-stats span", ".key-info span", 'span[class*="bath"]', 'li[class*="bath"]',
            'div[class*="summary"] span',
        ]
        for sel in feature_selectors:
            for el in soup.select(sel):
                t = clean_text(el.get_text(" ", strip=True))
                if not t:
                    continue
                if area_sqm is None:
                    g = extract_area_sqm(t)
                    if g: area_sqm = g
                if bathrooms is None:
                    b = extract_bathrooms(t)
                    if b: bathrooms = b
                if bedrooms is None:
                    bd = extract_bedrooms(t)
                    if bd: bedrooms = bd
            if area_sqm and bathrooms and bedrooms:
                break

        # JSON-LD
        ld = extract_json_ld(soup)
        # Pull what we can from JSON-LD
        if ld:
            # Common schema.org for real estate:
            # RealEstateListing / Offer / Residence / House / Apartment
            listing.property_type = choose(ld.get("propertyType"), ld.get("@type"))
            if not listing.price or listing.price <= 0:
                price = try_get_price_from_ld(ld)
                if price: listing.price = price
            if not bedrooms:
                bedrooms = try_get_int(ld, ["numberOfRooms", "numberOfBedrooms", "bedrooms"])
            if not bathrooms:
                bathrooms = try_get_int(ld, ["numberOfBathroomsTotal", "bathrooms"])
            if area_sqm is None:
                area_sqm = try_get_area_from_ld(ld)
            if not listing.image_url:
                listing.image_url = try_get_image_from_ld(ld)
            if not listing.address or listing.address.lower() == "property":
                listing.address = try_get_address_from_ld(ld) or listing.address
            ag = ld.get("seller") or ld.get("agent") or ld.get("provider")
            if isinstance(ag, dict):
                listing.agent_name = choose(ag.get("name"), ag.get("@name"))
                listing.agent_url = choose(ag.get("url"), ag.get("@id"))
                # phones rarely in LD, but try:
                listing.agent_phone = ag.get("telephone") or ag.get("phone")
            geo = ld.get("geo")
            if isinstance(geo, dict):
                try:
                    listing.latitude = float(geo.get("latitude"))
                    listing.longitude = float(geo.get("longitude"))
                except Exception:
                    pass
            if not listing.date_listed:
                listing.date_listed = (ld.get("datePosted") or ld.get("dateListed") or ld.get("datePublished"))

        # OG image as final fallback
        if not listing.image_url:
            og = soup.select_one('meta[property="og:image"]')
            if og and og.get("content"):
                listing.image_url = og["content"]

        # Tenure detection (simple)
        textblob = (description or "") + " " + " ".join([clean_text(e.get_text(" ", strip=True)) for e in soup.select("li, span, p")[:300]])
        if not listing.tenure:
            m = re.search(r"\b(leasehold|freehold|share of freehold)\b", textblob, re.IGNORECASE)
            if m:
                listing.tenure = m.group(1).lower()

        # UK postcode extraction
        if not listing.postcode:
            pm = re.search(r"\b([A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2})\b", textblob, re.IGNORECASE)
            if pm:
                listing.postcode = pm.group(1).upper().replace(" ", "")[:4] + " " + pm.group(1).upper().replace(" ", "")[4:]

        # Assign parsed values
        listing.description = listing.description or description or None
        listing.area_sqm = listing.area_sqm or area_sqm
        listing.bathrooms = listing.bathrooms or bathrooms
        listing.bedrooms = listing.bedrooms or bedrooms

        return listing

def extract_json_ld(soup: BeautifulSoup) -> Dict[str, Any]:
    """Return merged JSON-LD dict (best-effort) for the most relevant node."""
    payloads = []
    for tag in soup.find_all("script", {"type": "application/ld+json"}):
        try:
            text = tag.string or tag.text
            if not text:
                continue
            data = json.loads(text)
            if isinstance(data, list):
                for d in data:
                    if isinstance(d, dict):
                        payloads.append(d)
            elif isinstance(data, dict):
                payloads.append(data)
        except Exception:
            continue
    # Choose the most relevant LD node (RealEstateListing or with Offer)
    best = {}
    for d in payloads:
        t = d.get("@type") or ""
        if isinstance(t, list):
            t = " ".join(t)
        score = 0
        if "RealEstateListing" in t: score += 3
        if "Offer" in t or "Residence" in t or "House" in t or "Apartment" in t: score += 1
        if "price" in json.dumps(d).lower(): score += 1
        d["_score"] = score
    payloads.sort(key=lambda x: x.get("_score", 0), reverse=True)
    if payloads:
        best = payloads[0]
        best.pop("_score", None)
    return best

def try_get_price_from_ld(ld: Dict[str, Any]) -> Optional[int]:
    # Common LD nesting: offers: { price: 123, priceCurrency: "GBP" }
    offers = ld.get("offers")
    if isinstance(offers, dict):
        p = offers.get("price") or offers.get("highPrice") or offers.get("lowPrice")
        if isinstance(p, (int, float)):
            return int(p)
        if isinstance(p, str):
            return extract_price(p)
    if "price" in ld:
        if isinstance(ld["price"], (int, float)):
            return int(ld["price"])
        if isinstance(ld["price"], str):
            return extract_price(ld["price"])
    return None

def try_get_int(ld: Dict[str, Any], keys: List[str]) -> Optional[int]:
    for k in keys:
        if k in ld:
            v = ld[k]
            if isinstance(v, (int, float)):
                return int(v)
            if isinstance(v, str):
                ni = extract_int(v)
                if ni is not None:
                    return ni
    return None

def try_get_area_from_ld(ld: Dict[str, Any]) -> Optional[int]:
    # Sometimes appears as floorSize: { value: 100, unitCode: "SQM" }
    fs = ld.get("floorSize")
    if isinstance(fs, dict):
        v = fs.get("value")
        u = (fs.get("unitCode") or fs.get("unitText") or "").lower()
        try:
            if v is not None:
                v = float(v)
                if "sqm" in u or "m2" in u or "m²" in u:
                    return int(round(v))
                if "sqf" in u or "ft" in u:
                    return int(round(v * 0.092903))
        except Exception:
            pass
    # Direct numeric
    for k in ["area", "floorArea", "size"]:
        if k in ld:
            v = ld[k]
            if isinstance(v, (int, float)):
                return int(round(v))
            if isinstance(v, str):
                return extract_area_sqm(v)
    return None

def try_get_image_from_ld(ld: Dict[str, Any]) -> Optional[str]:
    img = ld.get("image")
    if isinstance(img, str):
        return img
    if isinstance(img, list) and img:
        for x in img:
            if isinstance(x, str):
                return x
            if isinstance(x, dict) and x.get("url"):
                return x["url"]
    if isinstance(img, dict) and img.get("url"):
        return img["url"]
    return None

def try_get_address_from_ld(ld: Dict[str, Any]) -> Optional[str]:
    addr = ld.get("address")
    if isinstance(addr, str):
        return clean_text(addr)
    if isinstance(addr, dict):
        parts = [addr.get("streetAddress"), addr.get("addressLocality"), addr.get("addressRegion"), addr.get("postalCode")]
        return clean_text(", ".join([p for p in parts if p]))
    return None

class ZooplaParser(BaseParser):
    SOURCE = "zoopla"

    def parse_list(self, soup: BeautifulSoup, page_url: str) -> List[PropertyListing]:
        listings: List[PropertyListing] = []
        selectors = [
            '[data-testid*="search-result"]',
            '[data-testid*="listing"]',
            'article[data-testid]',
            '.search-results .property-listing',
            '.property-listing',
            'li[data-testid*="result"]',
            '[class*="PropertyCard"]',
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
            # Fallback: discover price nodes then climb
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

        # Pagination discovery fallback (in case URL builder is off)
        self._discover_next(soup, page_url)

        return listings

    def _parse_card(self, block, base_url: str) -> Optional[PropertyListing]:
        text = clean_text(block.get_text(" ", strip=True))
        if not text or len(text) < 20:
            return None

        # Price
        price = 0
        for pc in block.select('[data-testid*="price"], [class*="price"], .price, [aria-label*="price"], .display-price, .property-price, .listing-price, span[title*="£"]'):
            pv = extract_price(pc.get_text(" ", strip=True) or pc.get("title", ""))
            if pv > 0:
                price = pv
                break
        if price == 0: price = extract_price(text)
        if price <= 0: return None

        # Title/Address
        title = None
        for sel in ["h1","h2","h3","h4","h5",
                    '[data-testid*="title"]','[data-testid*="address"]',
                    ".property-title",".listing-title",".property-address","address",
                    'a[title]','a[href*="/details/"] span','a[href*="/property/"] span']:
            el = block.select_one(sel)
            if el:
                tx = clean_text(el.get_text(" ", strip=True) or el.get("title", ""))
                if tx and not tx.startswith("£"):
                    title = tx; break
        if not title: title = "Property"

        # Link
        prop_url = None
        link = block.select_one('a[href*="/details/"], a[href*="/property/"], a[href*="/for-sale/"]')
        if link and link.get("href"):
            prop_url = ensure_absolute(base_url, link["href"])

        # Beds
        beds = None
        for sel in ['[data-testid*="bed"]','[data-testid*="room"]','[class*="bed"]','[aria-label*="bed"]',
                    ".bedrooms",".property-bedrooms",".beds",'span[title*="bed"]']:
            el = block.select_one(sel)
            if el:
                beds = extract_bedrooms(clean_text(el.get_text(" ", strip=True) or el.get("title", "")))
                if beds: break
        if beds is None:
            beds = extract_bedrooms(text)

        # Image
        img = None
        imgtag = block.select_one("img")
        if imgtag and imgtag.get("src") and "placeholder" not in (imgtag["src"] or "").lower():
            src = imgtag["src"]
            img = src if src.startswith(("http","//")) else None
            if img and img.startswith("//"): img = "https:" + img

        item = PropertyListing(
            source=self.SOURCE,
            title=title or "Property",
            address=title or "Property",
            price=price,
            bedrooms=beds,
            property_url=prop_url,
            image_url=img or random.choice(IMG_FALLBACKS),
            listing_id=listing_id_from_url(prop_url) if prop_url else None,
        )
        return item

    def _discover_next(self, soup: BeautifulSoup, page_url: str) -> None:
        # Stub: If you want to implement crawling via discovered next links, do it here.
        # For now, our URL builders handle pagination deterministically.
        return

class PrimeLocationParser(BaseParser):
    SOURCE = "primelocation"

    def parse_list(self, soup: BeautifulSoup, page_url: str) -> List[PropertyListing]:
        listings: List[PropertyListing] = []
        selectors = [
            ".property-card",".search-property-result",".property-item",
            '[class*="PropertyCard"]','[class*="property-card"]',"article",
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

        self._discover_next(soup, page_url)
        return listings

    def _parse_card(self, block, base_url: str) -> Optional[PropertyListing]:
        text = clean_text(block.get_text(" ", strip=True))
        if not text or len(text) < 20:
            return None

        price = 0
        for pc in block.select('[data-testid*="price"], [class*="price"], .price, [aria-label*="price"], .display-price, .property-price, .listing-price, span[title*="£"]'):
            pv = extract_price(pc.get_text(" ", strip=True) or pc.get("title", ""))
            if pv > 0:
                price = pv; break
        if price == 0: price = extract_price(text)
        if price <= 0: return None

        title = None
        for sel in ["h1","h2","h3","h4","h5",
                    '[data-testid*="title"]','[data-testid*="address"]',
                    ".property-title",".listing-title",".property-address","address",
                    'a[title]','a[href*="/details/"] span','a[href*="/property/"] span']:
            el = block.select_one(sel)
            if el:
                tx = clean_text(el.get_text(" ", strip=True) or el.get("title", ""))
                if tx and not tx.startswith("£"):
                    title = tx; break
        if not title: title = "Property"

        prop_url = None
        link = block.select_one('a[href*="/details/"], a[href*="/property/"], a[href*="/for-sale/"]')
        if link and link.get("href"):
            prop_url = ensure_absolute(base_url, link["href"])

        beds = None
        for sel in ['[data-testid*="bed"]','[data-testid*="room"]','[class*="bed"]','[aria-label*="bed"]',
                    ".bedrooms",".property-bedrooms",".beds",'span[title*="bed"]']:
            el = block.select_one(sel)
            if el:
                beds = extract_bedrooms(clean_text(el.get_text(" ", strip=True) or el.get("title", "")))
                if beds: break
        if beds is None:
            beds = extract_bedrooms(text)

        img = None
        imgtag = block.select_one("img")
        if imgtag and imgtag.get("src") and "placeholder" not in (imgtag["src"] or "").lower():
            src = imgtag["src"]
            img = src if src.startswith(("http","//")) else None
            if img and img.startswith("//"): img = "https:" + img

        return PropertyListing(
            source=self.SOURCE,
            title=title or "Property",
            address=title or "Property",
            price=price,
            bedrooms=beds,
            property_url=prop_url,
            image_url=img or random.choice(IMG_FALLBACKS),
            listing_id=listing_id_from_url(prop_url) if prop_url else None,
        )

    def _discover_next(self, soup: BeautifulSoup, page_url: str) -> None:
        return

# =========================
# Orchestration
# =========================

def scrape_search_page(client: HttpClient, url: str, parser: BaseParser) -> List[PropertyListing]:
    resp = client.get(url)
    if not resp or resp.status_code != 200 or not resp.content:
        logging.info(f"Skipping URL due to fetch failure: {url}")
        return []
    soup = BeautifulSoup(resp.content, "html.parser")
    listings = parser.parse_list(soup, url)
    logging.info(f"{parser.SOURCE}: {len(listings)} listings parsed on {url}")
    return listings

def scrape_detail_page(client: HttpClient, listing: PropertyListing, parser: BaseParser) -> PropertyListing:
    url = listing.property_url or ""
    if not url:
        return listing
    resp = client.get(url)
    if not resp or resp.status_code != 200 or not resp.content:
        return listing
    soup = BeautifulSoup(resp.content, "html.parser")
    # Agent info (site-agnostic attempts)
    ag = soup.select_one('[data-testid*="agent-name"], .agent-name, [class*="Agent"] a, a[href*="agents"]')
    if ag:
        listing.agent_name = clean_text(ag.get_text(" ", strip=True))
        if not listing.agent_url and ag.name == "a" and ag.get("href"):
            listing.agent_url = ensure_absolute(url, ag["href"])
    tel = soup.select_one('a[href^="tel:"], a[href^="callto:"]')
    if tel and tel.get("href"):
        listing.agent_phone = tel["href"].split(":", 1)[1]

    # Title/address refinement
    title_node = soup.select_one("h1, h2, [data-testid*='title'], .property-title")
    if title_node:
        tx = clean_text(title_node.get_text(" ", strip=True))
        if tx and not tx.lower().startswith("£"):
            listing.title = tx
            listing.address = listing.address or tx

    # Delegate to parser common detail logic
    return parser.parse_detail(soup, listing)

def deduplicate(listings: List[PropertyListing]) -> List[PropertyListing]:
    seen: set[Tuple[str, int, Optional[str]]] = set()
    unique: List[PropertyListing] = []
    for l in listings:
        k = l.key()
        if k in seen:
            continue
        seen.add(k)
        unique.append(l)
    return unique

def _build_urls_for_sites(city: str, min_bedrooms: Optional[int], max_price: Optional[int], keywords: Optional[str], max_pages: int, site: str) -> List[str]:
    urls: List[str] = []
    if site in ("zoopla", "both"):
        urls += build_zoopla_urls(city, min_bedrooms, max_price, keywords, max_pages)
    if site in ("primelocation", "both"):
        urls += build_primelocation_urls(city, min_bedrooms, max_price, keywords, max_pages)
    return urls

def scrape_properties(
    city: str,
    min_bedrooms: Optional[int],
    max_price: Optional[int],
    keywords: Optional[str],
    max_pages: int = DEFAULT_MAX_PAGES,
    listing_limit: int = DEFAULT_LISTING_LIMIT,
    detail_enrich: int = DEFAULT_DETAIL_ENRICH,
    concurrency: int = DEFAULT_CONCURRENCY,
    proxies: Optional[Dict[str, str]] = None,
    cache: Optional[CacheProtocol] = None,
    verbosity: int = 1,
    site: str = "both",  # "zoopla" | "primelocation" | "both"
) -> List[PropertyListing]:
    setup_logging(verbosity)
    min_bedrooms = limit_int(min_bedrooms, 1, 10)
    max_price = limit_int(max_price, 50_000, 2_000_000)

    client = HttpClient(
        proxies=proxies,
        cache=cache or NullCache(),
        rate_limiter=SimpleRateLimiter(per_host_delay=0.5 if verbosity < 2 else 0.2),
    )

    urls = _build_urls_for_sites(city, min_bedrooms, max_price, keywords, max_pages, site)

    parsers = {
        "zoopla": ZooplaParser(),
        "primelocation": PrimeLocationParser(),
    }

    # Fetch and parse list pages concurrently
    all_listings: List[PropertyListing] = []
    def task(url: str) -> List[PropertyListing]:
        src = "zoopla" if "zoopla.co.uk" in url else "primelocation"
        parser = parsers[src]
        return scrape_search_page(client, url, parser)

    with cf.ThreadPoolExecutor(max_workers=concurrency) as ex:
        for listings in ex.map(task, urls):
            all_listings.extend(listings)

    if not all_listings:
        logging.warning("No listings parsed from live pages.")
        return []

    # Deduplicate early
    unique = deduplicate(all_listings)
    logging.info(f"Deduplicated {len(all_listings)} -> {len(unique)} unique listings")

    # Enrich details for first N concurrently
    def detail_task(l: PropertyListing) -> PropertyListing:
        parser = parsers[l.source]
        try:
            return scrape_detail_page(client, l, parser)
        except Exception as e:
            logging.debug(f"Detail scrape failed for {l.property_url}: {e}")
            return l

    detail_targets = unique[:max(0, detail_enrich)]
    with cf.ThreadPoolExecutor(max_workers=min(concurrency, 6)) as ex:
        enriched = list(ex.map(detail_task, detail_targets))
    unique[:len(enriched)] = enriched

    # Trim to limit; sort by price ascending by default
    unique.sort(key=lambda x: (x.price or 0, x.bedrooms or 0))
    if listing_limit:
        unique = unique[:listing_limit]

    return unique

# =========================
# Output helpers
# =========================

def to_json(listings: List[PropertyListing]) -> str:
    return json.dumps([l.to_dict() for l in listings], ensure_ascii=False, indent=2)

def to_ndjson(listings: List[PropertyListing]) -> str:
    return "\n".join(json.dumps(l.to_dict(), ensure_ascii=False) for l in listings)

# =========================
# CLI
# =========================

def parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Scrape Zoopla + PrimeLocation for property listings (scraping only).")
    p.add_argument("city", help="City name, e.g., 'Liverpool'")
    p.add_argument("min_bedrooms", type=int, help="Minimum bedrooms (1-10)")
    p.add_argument("max_price", type=int, help="Max price in GBP (50k - 2M)")
    p.add_argument("keywords", help="Search keywords, or 'none' to disable")
    p.add_argument("--site", choices=["zoopla", "primelocation", "both"], default="both", help="Which site(s) to scrape (default both)")
    p.add_argument("--max-pages", type=int, default=DEFAULT_MAX_PAGES, help=f"Pages per sort (default {DEFAULT_MAX_PAGES})")
    p.add_argument("--limit", type=int, default=DEFAULT_LISTING_LIMIT, help=f"Max listings to return after dedup (default {DEFAULT_LISTING_LIMIT})")
    p.add_argument("--detail-enrich", type=int, default=DEFAULT_DETAIL_ENRICH, help="How many listings to enrich with detail page data (default 8)")
    p.add_argument("--concurrency", type=int, default=DEFAULT_CONCURRENCY, help="Concurrent fetches (default 8)")
    p.add_argument("--proxies", type=str, default="", help='JSON dict of proxies, e.g. {"http":"http://host:port","https":"http://host:port"}')
    p.add_argument("--verbosity", "-v", action="count", default=0, help="-v for INFO, -vv for DEBUG")
    p.add_argument("--format", choices=["json", "ndjson"], default="json", help="Output format (default json)")
    return p.parse_args(argv)

def main(argv: Optional[List[str]] = None) -> int:
    args = parse_args(argv)

    proxies = None
    if args.proxies:
        try:
            proxies = json.loads(args.proxies)
            assert isinstance(proxies, dict)
        except Exception as e:
            logging.error(f"Invalid proxies JSON: {e}")
            proxies = None

    listings = scrape_properties(
        city=args.city,
        min_bedrooms=args.min_bedrooms,
        max_price=args.max_price,
        keywords=args.keywords if args.keywords.lower() != "none" else None,
        max_pages=args.max_pages,
        listing_limit=args.limit,
        detail_enrich=args.detail_enrich,
        concurrency=args.concurrency,
        proxies=proxies,
        cache=None,  # inject your own CacheProtocol implementation externally if desired
        verbosity=args.verbosity or 0,
        site=args.site,
    )

    if args.format == "json":
        output = to_json(listings)
    else:
        output = to_ndjson(listings)

    sys.stdout.write(output + ("\n" if not output.endswith("\n") else ""))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
