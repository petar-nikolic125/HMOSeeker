#!/usr/bin/env python3
"""
Enhanced Zoopla Property Scraper with HMO Detection and Article 4 Filtering
Usage: python zoopla_scraper.py <city> <min_bedrooms> <max_price> <keywords> [postcode] [max_sqm]

New Features:
- Excludes existing HMOs (listings with "HMO" in title/description)
- Flags HMO candidates (90+ sqm in non-Article 4 areas)
- Article 4 area detection for London boroughs and other cities
- Enhanced property details extraction
- London borough and district identification
- Optional postcode and max_sqm filtering
"""

import re
import json
import sys
import requests
import time
import random
from bs4 import BeautifulSoup
from urllib.parse import urlencode, quote_plus
from datetime import datetime

# Define known Article 4 areas for quick lookup
ARTICLE4_BOROUGHS = {
    # London boroughs with any Article 4 Direction for small HMOs (full or partial coverage)
    "Barking and Dagenham", "Barnet", "Bexley", "Brent", "Croydon", "Enfield",
    "Greenwich", "Havering", "Hounslow", "Newham", "Redbridge", "Tower Hamlets",
    "Waltham Forest", "Hillingdon", "Ealing", "Haringey", "Southwark", "Lewisham",
    "Merton", "Bromley", "Kingston upon Thames", "Sutton"
}

ARTICLE4_CITIES = {
    # Known cities (outside London) with city-wide HMO Article 4 Directions
    "Manchester", "Leeds", "Nottingham", "Birmingham", "Oxford", "Brighton", "Liverpool"
}

def is_article4_area(address, london_borough=None):
    """Determine if the address is in an Article 4 area (HMO planning restrictions)."""
    addr_lower = address.lower()
    if london_borough:
        # If we identified a London borough, use that
        article4_status = london_borough in ARTICLE4_BOROUGHS
        return "Full" if article4_status else "None"
    
    # If in London but borough not identified, assume no Article 4 by default
    if " london" in addr_lower:
        return "None"
    
    # For non-London addresses, check if any known Article 4 city name appears
    for city in ARTICLE4_CITIES:
        if re.search(rf"\b{city.lower()}\b", addr_lower):
            return "Full"
    return "None"

def parse_london_location(address):
    """Parse London address to identify borough, district, and postcode area."""
    borough = None
    district = None
    postcode_area = None
    postcode_district = None
    addr_clean = address.strip()
    addr_lower = addr_clean.lower()
    
    # Extract postcode area and district
    postcode_match = re.search(r"\b([A-Z]{1,2})(\d{1,2}[A-Z]?)\s*(\d[A-Z]{2})\b", addr_clean, flags=re.IGNORECASE)
    if postcode_match:
        postcode_area = postcode_match.group(1).upper()
        postcode_district = f"{postcode_match.group(1)}{postcode_match.group(2)}".upper()
    else:
        # Try to extract just the outcode
        outcode_match = re.search(r"\b([A-Z]{1,2}\d{1,2}[A-Z]?)\b", addr_clean, flags=re.IGNORECASE)
        if outcode_match:
            postcode_district = outcode_match.group(1).upper()
            postcode_match = re.match(r"^[A-Z]+", postcode_district)
            postcode_area = postcode_match.group(0) if postcode_match else None
    
    # London boroughs
    borough_names = [
        "Barking and Dagenham", "Barnet", "Bexley", "Brent", "Bromley", "Camden", "Croydon", 
        "Ealing", "Enfield", "Greenwich", "Hackney", "Hammersmith and Fulham", 
        "Haringey", "Harrow", "Havering", "Hillingdon", "Hounslow", "Islington", 
        "Kensington and Chelsea", "Kingston upon Thames", "Lambeth", "Lewisham", 
        "Merton", "Newham", "Redbridge", "Richmond upon Thames", "Southwark", 
        "Sutton", "Tower Hamlets", "Waltham Forest", "Wandsworth", "Westminster", "City of London"
    ]
    
    for name in borough_names:
        if re.search(rf"\b{name.lower()}\b", addr_lower):
            borough = name
            break
    
    # Extract district
    if borough:
        idx = addr_lower.find(borough.lower())
        if idx != -1:
            district_part = addr_clean[:idx].strip().strip(",")
            if district_part:
                district = district_part
            else:
                district = borough
    else:
        # Use part before "London" as district
        if " london" in addr_lower:
            idx = addr_lower.index(" london")
            district_part = addr_clean[:idx].strip().strip(",")
            if district_part:
                district = district_part
        
        # Try to infer borough from postcode
        if postcode_area:
            postcode_to_borough = {
                "EN": "Enfield", "HA": "Harrow", "UB": "Hillingdon", "KT": "Kingston upon Thames",
                "SM": "Sutton", "CR": "Croydon", "BR": "Bromley", "DA": "Bexley",
                "RM": "Havering", "IG": "Redbridge", "TW": "Hounslow"
            }
            if postcode_area in postcode_to_borough:
                borough = postcode_to_borough[postcode_area]
    
    return borough, district, postcode_area, postcode_district

def extract_area_from_text(text):
    """Extract area in square meters from text."""
    if not text:
        return None, False
    
    text_lower = text.lower()
    area_estimated = False
    
    # Look for sq m first
    sqm_match = re.search(r"([\d,\.]+)\s*(?:sq\s*m|sqm|square\s*metres?)", text_lower)
    if sqm_match:
        try:
            area_sqm = float(sqm_match.group(1).replace(",", ""))
            return round(area_sqm, 2), area_estimated
        except:
            pass
    
    # Look for sq ft and convert
    sqft_match = re.search(r"([\d,\.]+)\s*(?:sq\s*ft|sqft|square\s*feet?)", text_lower)
    if sqft_match:
        try:
            sqft_val = float(sqft_match.group(1).replace(",", ""))
            area_sqm = round(sqft_val * 0.092903, 2)
            return area_sqm, True  # Estimated because converted
        except:
            pass
    
    return None, False

def extract_property_details(title, description):
    """Extract property type, features, and other details."""
    title_lower = title.lower()
    desc_lower = description.lower()
    combined_text = f"{title_lower} {desc_lower}"
    
    # Property category and type
    property_category = None
    property_type = None
    
    if any(word in combined_text for word in ["flat", "apartment", "maisonette"]):
        property_category = "residential"
        property_type = "flat"
    elif any(word in combined_text for word in ["house", "cottage", "bungalow", "mews", "townhouse"]):
        property_category = "residential"
        property_type = "house"
    elif "commercial" in combined_text or "office" in combined_text:
        property_category = "commercial"
    else:
        property_category = "residential"
        property_type = "unknown"
    
    # Floor information for flats
    flat_floor = None
    if property_type == "flat":
        floor_phrases = ["ground floor", "first floor", "second floor", "third floor", 
                        "fourth floor", "fifth floor", "top floor", "lower ground", "basement"]
        for phrase in floor_phrases:
            if phrase in combined_text:
                flat_floor = phrase
                break
    
    # Garden and parking
    has_garden = bool(re.search(r"\bgarden\b", combined_text) and "no garden" not in combined_text)
    has_parking = bool(re.search(r"\b(?:parking|garage|driveway)\b", combined_text) and "no parking" not in combined_text)
    
    # Property age estimation
    property_age = None
    if re.search(r"\b(?:new|brand new|newly built)\b", combined_text):
        property_age = "new"
    elif re.search(r"\b(?:victorian|period|heritage|historic)\b", combined_text):
        property_age = "period"
    elif re.search(r"\b(?:modern|contemporary)\b", combined_text):
        property_age = "modern"
    
    return {
        "property_category": property_category,
        "property_type": property_type,
        "flat_floor": flat_floor,
        "has_garden": has_garden,
        "has_parking": has_parking,
        "property_age": property_age
    }

def scrape_zoopla_search(city, min_bedrooms, max_price, keywords, postcode=None, max_sqm=None):
    """Scrape Zoopla search results with enhanced filtering."""
    
    # Build search URL
    base_url = "https://www.zoopla.co.uk/for-sale/"
    params = {
        "q": f"{postcode}, {city}" if postcode else city,
        "beds_min": min_bedrooms,
        "price_max": max_price,
        "property_type": "houses,flats",
        "results_sort": "newest_listings",
        "search_source": "for-sale"
    }
    
    if keywords and keywords.lower() != "none":
        params["keywords"] = keywords
    
    search_url = f"{base_url}?{urlencode(params)}"
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    properties = []
    page = 1
    max_pages = 10  # Limit to prevent infinite loops
    
    try:
        while page <= max_pages:
            page_url = f"{search_url}&pn={page}" if page > 1 else search_url
            
            print(f"Scraping page {page}: {page_url}", file=sys.stderr)
            response = requests.get(page_url, headers=headers, timeout=30)
            
            if response.status_code != 200:
                print(f"HTTP {response.status_code} for page {page}", file=sys.stderr)
                break
                
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Find property listings
            listing_cards = soup.find_all('div', {'data-testid': 'search-result'}) or \
                           soup.find_all('article', class_=re.compile(r'listing'))
            
            if not listing_cards:
                print(f"No listings found on page {page}", file=sys.stderr)
                break
            
            for card in listing_cards:
                try:
                    property_data = extract_property_from_card(card, city, max_sqm)
                    if property_data:
                        properties.append(property_data)
                except Exception as e:
                    print(f"Error extracting property: {e}", file=sys.stderr)
                    continue
            
            page += 1
            time.sleep(random.uniform(1.0, 2.0))  # Respectful delay
            
            # Check if there are more pages
            next_button = soup.find('a', {'aria-label': 'Next page'}) or \
                         soup.find('button', text=re.compile(r'Next', re.I))
            if not next_button:
                break
    
    except Exception as e:
        print(f"Error during scraping: {e}", file=sys.stderr)
    
    return properties

def extract_property_from_card(card, city, max_sqm=None):
    """Extract property data from a single listing card."""
    
    # Extract basic information
    title_elem = card.find('h2') or card.find('a', class_=re.compile(r'title|link'))
    if not title_elem:
        return None
    
    title = title_elem.get_text(strip=True)
    
    # Skip existing HMOs
    title_lower = title.lower()
    if "hmo" in title_lower or "house in multiple occupation" in title_lower:
        return None
    
    # Extract address
    address_elem = card.find('address') or card.find('p', class_=re.compile(r'address'))
    address = address_elem.get_text(strip=True) if address_elem else ""
    
    # Extract price
    price_elem = card.find('p', class_=re.compile(r'price')) or \
                card.find('span', class_=re.compile(r'price'))
    price_text = price_elem.get_text(strip=True) if price_elem else "0"
    price = extract_price(price_text)
    
    # Extract bedrooms and bathrooms
    beds_elem = card.find('span', text=re.compile(r'\d+\s*bed')) or \
               card.find_all('span', class_=re.compile(r'bed|room'))
    bedrooms = extract_bedrooms(beds_elem) if beds_elem else 0
    
    # Extract description
    desc_elem = card.find('p', class_=re.compile(r'description|summary'))
    description = desc_elem.get_text(strip=True) if desc_elem else ""
    
    # Skip if description contains HMO references
    if "hmo" in description.lower() or "house in multiple occupation" in description.lower():
        return None
    
    # Extract area information
    area_sqm, area_estimated = extract_area_from_text(f"{title} {description}")
    
    # Apply max_sqm filter if specified
    if max_sqm and area_sqm and area_sqm > max_sqm:
        return None
    
    # Extract URL
    link_elem = card.find('a', href=True)
    property_url = link_elem['href'] if link_elem else ""
    if property_url and not property_url.startswith('http'):
        property_url = f"https://www.zoopla.co.uk{property_url}"
    
    # Extract image URL - try multiple strategies for better image capture
    image_url = ""
    # Strategy 1: Look for property-specific images first
    img_elem = card.find('img', {'alt': re.compile(r'property|house|flat', re.I)})
    if not img_elem:
        # Strategy 2: Look for any image with src or data-src
        img_elem = card.find('img', src=True) or card.find('img', attrs={'data-src': True})
    if not img_elem:
        # Strategy 3: Look for lazy-loaded images
        img_elem = card.find('img', attrs={'data-lazy': True}) or card.find('img', attrs={'data-original': True})
    
    if img_elem:
        # Try multiple attributes for image URL
        image_url = (img_elem.get('src') or 
                    img_elem.get('data-src') or 
                    img_elem.get('data-lazy') or 
                    img_elem.get('data-original') or 
                    img_elem.get('srcset', '').split(',')[0].strip().split(' ')[0] or "")
        
        # Clean up the URL - remove query parameters but keep essential ones
        if image_url and '?' in image_url:
            base_url, params = image_url.split('?', 1)
            # Keep only essential parameters for image sizing
            essential_params = []
            for param in params.split('&'):
                if any(key in param.lower() for key in ['w=', 'h=', 'width=', 'height=', 'fit=', 'crop=']):
                    essential_params.append(param)
            if essential_params:
                image_url = f"{base_url}?{'&'.join(essential_params)}"
            else:
                image_url = base_url
        
        # Ensure URL is absolute
        if image_url and not image_url.startswith('http'):
            if image_url.startswith('//'):
                image_url = f"https:{image_url}"
            elif image_url.startswith('/'):
                image_url = f"https://www.zoopla.co.uk{image_url}"
    
    # Determine location details
    london_borough = None
    london_district = None
    postcode_area = None
    postcode_district = None
    
    if city.lower() == "london" or "london" in address.lower():
        london_borough, london_district, postcode_area, postcode_district = parse_london_location(address)
    
    # Determine Article 4 status
    article4_status = is_article4_area(address, london_borough)
    article4_area = article4_status != "None"
    
    # Extract property details
    details = extract_property_details(title, description)
    
    # Determine HMO candidate status
    hmo_candidate = False
    if area_sqm and area_sqm >= 90 and not article4_area:
        hmo_candidate = True
    
    # Build property data
    property_data = {
        "address": address,
        "price": price,
        "bedrooms": bedrooms,
        "bathrooms": estimate_bathrooms(bedrooms),  # Estimate if not found
        "description": description,
        "property_url": property_url,
        "image_url": image_url,
        "listing_id": f"zoopla_{hash(property_url)}",
        "postcode": extract_postcode(address),
        "city": city,
        
        # New enhanced fields
        "area_sqm": area_sqm,
        "area_estimated": area_estimated,
        "article4_area": article4_area,
        "article4_status": article4_status,
        "hmo_candidate": hmo_candidate,
        
        # London-specific fields
        "london_borough": london_borough,
        "london_district": london_district,
        "postcode_district": postcode_district,
        "postcode_area": postcode_area,
        
        # Property details
        **details,
        
        # Metadata
        "scraped_at": datetime.now().isoformat(),
        "source": "zoopla"
    }
    
    return property_data

def extract_price(price_text):
    """Extract numeric price from text."""
    if not price_text:
        return 0
    
    # Remove non-numeric characters except digits, dots, and commas
    price_clean = re.sub(r'[^\d,.]', '', price_text)
    
    if not price_clean:
        return 0
    
    try:
        # Handle prices in millions or thousands
        if 'm' in price_text.lower():
            return int(float(price_clean.replace(',', '')) * 1000000)
        elif 'k' in price_text.lower():
            return int(float(price_clean.replace(',', '')) * 1000)
        else:
            return int(float(price_clean.replace(',', '')))
    except:
        return 0

def extract_bedrooms(beds_elem):
    """Extract number of bedrooms."""
    if isinstance(beds_elem, list):
        for elem in beds_elem:
            text = elem.get_text(strip=True)
            match = re.search(r'(\d+)\s*bed', text.lower())
            if match:
                return int(match.group(1))
    else:
        text = beds_elem.get_text(strip=True)
        match = re.search(r'(\d+)\s*bed', text.lower())
        if match:
            return int(match.group(1))
    
    return 0

def estimate_bathrooms(bedrooms):
    """Estimate bathrooms based on bedrooms."""
    if bedrooms <= 1:
        return 1
    elif bedrooms <= 3:
        return 1
    elif bedrooms <= 4:
        return 2
    else:
        return max(2, bedrooms // 2)

def extract_postcode(address):
    """Extract postcode from address."""
    match = re.search(r"\b([A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2})\b", address, flags=re.IGNORECASE)
    return match.group(1).upper() if match else ""

def main():
    """Main function to handle CLI arguments and run scraper."""
    
    if len(sys.argv) < 5:
        print("Usage: python zoopla_scraper.py <city> <min_bedrooms> <max_price> <keywords> [postcode] [max_sqm]")
        print("Example: python zoopla_scraper.py London 4 500000 none E15 150")
        sys.exit(1)
    
    city = sys.argv[1]
    min_bedrooms = int(sys.argv[2])
    max_price = int(sys.argv[3])
    keywords = sys.argv[4] if sys.argv[4].lower() != "none" else ""
    postcode = sys.argv[5] if len(sys.argv) > 5 else None
    max_sqm = int(sys.argv[6]) if len(sys.argv) > 6 and sys.argv[6].isdigit() else None
    
    print(f"Scraping {city} properties: {min_bedrooms}+ beds, max £{max_price:,}, keywords: '{keywords}'", file=sys.stderr)
    if postcode:
        print(f"Postcode filter: {postcode}", file=sys.stderr)
    if max_sqm:
        print(f"Max area: {max_sqm} sqm", file=sys.stderr)
    
    properties = scrape_zoopla_search(city, min_bedrooms, max_price, keywords, postcode, max_sqm)
    
    # Group London results by borough if city is London
    if city.lower() == "london" and properties:
        grouped = {}
        for prop in properties:
            borough = prop.get("london_borough", "Unknown")
            if borough not in grouped:
                grouped[borough] = []
            grouped[borough].append(prop)
        
        print(json.dumps(grouped, indent=2, ensure_ascii=False))
    else:
        print(json.dumps(properties, indent=2, ensure_ascii=False))
    
    print(f"Found {len(properties)} properties", file=sys.stderr)

if __name__ == "__main__":
    main()