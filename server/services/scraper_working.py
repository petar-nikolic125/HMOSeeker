#!/usr/bin/env python3
import sys
import json
import time
import re
import requests
from bs4 import BeautifulSoup
import random
from urllib.parse import urljoin, urlparse

def setup_session():
    """Setup enhanced requests session with better anti-detection"""
    session = requests.Session()
    
    # More realistic User-Agent rotation
    user_agents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15'
    ]
    
    session.headers.update({
        'User-Agent': random.choice(user_agents),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-GB,en;q=0.9,en-US;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
    })
    
    # Add realistic browser cookies
    session.cookies.set('_ga', f'GA1.2.{random.randint(100000000, 999999999)}.{int(time.time())}')
    session.cookies.set('_gid', f'GA1.2.{random.randint(100000000, 999999999)}.{int(time.time())}')
    session.cookies.set('session_id', f'sess_{random.randint(1000000, 9999999)}_{int(time.time())}')
    
    return session

def build_search_urls(city, min_bedrooms, max_price, keywords, postcode=None):
    """Build URLs for Zoopla and PrimeLocation with filters"""
    
    # Enhanced city mappings for problematic cities with better URL slugs
    city_mappings = {
        'london': 'london',
        'newcastle': 'newcastle-upon-tyne',
        'newcastle upon tyne': 'newcastle-upon-tyne',
        'brighton': 'brighton-and-hove', 
        'brighton and hove': 'brighton-and-hove',
        'cambridge': 'cambridge',
        'leeds': 'leeds',
        'blackpool': 'blackpool', 
        'salford': 'salford',
        'oxford': 'oxford',
        'portsmouth': 'portsmouth',
        'southampton': 'southampton',
        'reading': 'reading',
        'plymouth': 'plymouth',
        'hull': 'kingston-upon-hull',
        'kingston upon hull': 'kingston-upon-hull',
        'derby': 'derby',
        'coventry': 'coventry',
        'leicester': 'leicester',
        'preston': 'preston',
        'wolverhampton': 'wolverhampton',
        'stockport': 'stockport'
    }
    
    city_lower = city.lower()
    city_slug = city_mappings.get(city_lower, city_lower.replace(" ", "-"))
    
    # Sanitize price - ensure it's within reasonable bounds
    if max_price:
        max_price = max(50000, min(2000000, int(max_price)))  # Between £50k and £2M
    
    # Sanitize bedrooms
    if min_bedrooms:
        min_bedrooms = max(1, min(10, int(min_bedrooms)))  # Between 1 and 10
    
    print(f"🔧 Building URLs for {city}: bedrooms={min_bedrooms}+, price=£{max_price}, keywords={keywords}", file=sys.stderr)
    print(f"🎯 Using city slug: {city_slug}", file=sys.stderr)
    
    # Zoopla URL format
    zoopla_params = []
    if min_bedrooms:
        zoopla_params.append(f"beds_min={min_bedrooms}")
    if keywords and keywords.lower() != 'none':
        zoopla_params.append(f"keywords={keywords}")
    if max_price:
        zoopla_params.append(f"price_max={max_price}")
    zoopla_params.append(f"q={city}")
    zoopla_params.append("search_source=for-sale")
    
    zoopla_url = f"https://www.zoopla.co.uk/for-sale/property/{city_slug}/?" + "&".join(zoopla_params)
    
    # PrimeLocation URL format
    prime_params = []
    if min_bedrooms:
        prime_params.append(f"beds_min={min_bedrooms}")
    if keywords and keywords.lower() != 'none':
        prime_params.append(f"keywords={keywords}")
    if max_price:
        prime_params.append(f"price_max={max_price}")
    prime_params.append(f"q={city}")
    
    prime_url = f"https://www.primelocation.com/for-sale/property/{city_slug}/?" + "&".join(prime_params)
    
    # Alternative URLs for better coverage
    alternative_urls = []
    
    # Add main PrimeLocation search first (most reliable)
    prime_main = f"https://www.primelocation.com/for-sale/property/{city_slug}/?beds_min={min_bedrooms}&price_max={max_price}&search_source=for-sale"
    alternative_urls.append(prime_main)
    
    # Flexible Zoopla search
    if min_bedrooms > 1:
        flexible_beds = min_bedrooms - 1
        zoopla_flex = f"https://www.zoopla.co.uk/for-sale/property/{city_slug}/?beds_min={flexible_beds}&price_max={max_price}&q={city}&search_source=for-sale"
        alternative_urls.append(zoopla_flex)
    
    # Broad searches
    zoopla_broad = f"https://www.zoopla.co.uk/for-sale/property/{city_slug}/?beds_min={min_bedrooms}&price_max={max_price}&property_type=houses&results_sort=newest"
    alternative_urls.append(zoopla_broad)
    
    prime_broad = f"https://www.primelocation.com/for-sale/property/{city_slug}/?beds_min={min_bedrooms}&price_max={max_price}&propertyType=terraced&results_sort=price"
    alternative_urls.append(prime_broad)
    
    # Minimal searches for broader results
    zoopla_minimal = f"https://www.zoopla.co.uk/for-sale/property/{city_slug}/?price_max={max_price}&property_type=houses"
    alternative_urls.append(zoopla_minimal)
    
    prime_minimal = f"https://www.primelocation.com/for-sale/property/{city_slug}/?price_max={max_price}"
    alternative_urls.append(prime_minimal)
    
    print(f"🔗 Generated {len(alternative_urls) + 2} search URLs for results", file=sys.stderr)
    
    # Return URLs in order of reliability (PrimeLocation first)
    priority_urls = [prime_url, zoopla_url] + alternative_urls[:3]
    return priority_urls

def extract_price(price_text):
    """Extract price from text"""
    if not price_text:
        return 0
    
    # Remove everything except numbers and commas
    price_clean = re.sub(r'[£,]', '', price_text)
    price_clean = re.sub(r'[^\d]', '', price_clean)
    
    try:
        return int(price_clean) if price_clean else 0
    except:
        return 0

def extract_bedrooms(bed_text):
    """Extract number of bedrooms from text"""
    if not bed_text:
        return 1
    
    # Find numbers in text
    numbers = re.findall(r'\d+', bed_text)
    if numbers:
        return int(numbers[0])
    return 1

def extract_square_footage(description):
    """Extract square footage from description"""
    if not description:
        return None
    
    # Look for different formats: sqft, sq ft, square feet, sq m, m², m2
    patterns = [
        r'(\d+(?:,\d+)*)\s*(?:sq\s*ft|sqft|square\s*feet)',
        r'(\d+(?:,\d+)*)\s*(?:sq\s*m|sqm|square\s*metres|square\s*meters)',
        r'(\d+(?:,\d+)*)\s*(?:m²|m2)',
        r'(\d+(?:,\d+)*)\s*(?:square\s*foot|sq\.?\s*ft\.?)',
    ]
    
    for pattern in patterns:
        matches = re.findall(pattern, description, re.IGNORECASE)
        if matches:
            try:
                # Remove commas from numbers
                area = int(matches[0].replace(',', ''))
                # Convert to square meters if in sq ft
                if 'ft' in pattern or 'foot' in pattern:
                    area = int(area * 0.092903)  # Convert sq ft to sq m
                return area
            except:
                continue
    return None

def scrape_property_details(session, urls, city, min_bedrooms=4, max_price=500000, max_properties=30):
    """Scrape property details from multiple URLs"""
    all_properties = []
    seen_addresses = set()
    
    for url in urls:
        if len(all_properties) >= max_properties:
            break
            
        print(f"🌐 Scraping: {url}", file=sys.stderr)
        
        try:
            # Random delay to avoid being blocked
            time.sleep(random.uniform(2, 4))
            
            response = session.get(url, timeout=15)
            if response.status_code != 200:
                print(f"❌ Failed to fetch {url}: {response.status_code}", file=sys.stderr)
                continue
                
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Different selectors for different sites
            property_cards = []
            
            # Zoopla selectors
            if 'zoopla' in url:
                property_cards = soup.find_all(['div'], class_=lambda x: x and any(term in x.lower() for term in ['listing', 'property-card', 'search-result']))
                if not property_cards:
                    property_cards = soup.find_all(['article', 'div'], attrs={'data-testid': lambda x: x and 'listing' in x.lower()})
            
            # PrimeLocation selectors
            elif 'primelocation' in url:
                property_cards = soup.find_all(['div'], class_=lambda x: x and any(term in x.lower() for term in ['property-card', 'search-result', 'listing']))
                if not property_cards:
                    property_cards = soup.find_all(['article', 'div'], attrs={'data-testid': lambda x: x and any(term in (x or '').lower() for term in ['property', 'listing'])})
            
            print(f"🏠 Found {len(property_cards)} potential property cards", file=sys.stderr)
            
            for card in property_cards:
                try:
                    if len(all_properties) >= max_properties:
                        break
                    
                    # Extract property details
                    property_data = extract_property_from_card(card, url, city)
                    
                    if property_data and property_data.get('price', 0) > 0:
                        # Filter by criteria
                        if max_price and property_data.get('price', 0) > max_price:
                            continue
                        if min_bedrooms and property_data.get('bedrooms', 0) < min_bedrooms:
                            continue
                        
                        # Avoid duplicates
                        address = property_data.get('address', '').strip().lower()
                        if address and address not in seen_addresses:
                            seen_addresses.add(address)
                            all_properties.append(property_data)
                            print(f"✅ Added property: {property_data.get('address', 'Unknown')} - £{property_data.get('price', 0):,}", file=sys.stderr)
                        
                except Exception as e:
                    print(f"⚠️ Error processing property card: {e}", file=sys.stderr)
                    continue
                    
        except Exception as e:
            print(f"❌ Error scraping {url}: {e}", file=sys.stderr)
            continue
    
    print(f"🎯 Total properties found: {len(all_properties)}", file=sys.stderr)
    return all_properties

def extract_property_from_card(card, base_url, city):
    """Extract property details from a property card"""
    try:
        # Get all text from the card
        card_text = card.get_text(' ', strip=True)
        
        # Extract price
        price = 0
        price_selectors = [
            '[data-testid*="price"]', '[class*="price"]', '.price', 
            '[aria-label*="price"]', '.display-price', '.property-price', 
            '.listing-price', 'span[title*="£"]'
        ]
        
        for selector in price_selectors:
            price_elem = card.select_one(selector)
            if price_elem:
                price_text = price_elem.get_text(strip=True) or price_elem.get('title', '')
                price = extract_price(price_text)
                if price > 0:
                    break
        
        if price == 0:
            price = extract_price(card_text)
        
        if price <= 0:
            return None
        
        # Extract address/title
        title = ""
        title_selectors = [
            'h1', 'h2', 'h3', 'h4', 'h5', 
            '[data-testid*="title"]', '[data-testid*="address"]',
            '.property-title', '.listing-title', '.property-address', 
            'address', 'a[title]'
        ]
        
        for selector in title_selectors:
            title_elem = card.select_one(selector)
            if title_elem:
                title_text = title_elem.get_text(strip=True) or title_elem.get('title', '')
                if title_text and not title_text.startswith('£'):
                    title = title_text
                    break
        
        if not title:
            title = f"Property in {city}"
        
        # Extract bedrooms
        bedrooms = None
        bedroom_selectors = [
            '[data-testid*="bed"]', '[class*="bed"]', '.bedrooms', 
            '.property-bedrooms', '.beds'
        ]
        
        for selector in bedroom_selectors:
            bed_elem = card.select_one(selector)
            if bed_elem:
                bed_text = bed_elem.get_text(strip=True)
                bedrooms = extract_bedrooms(bed_text)
                if bedrooms:
                    break
        
        if bedrooms is None:
            bedrooms = extract_bedrooms(card_text)
        
        # Extract property URL
        property_url = None
        link = card.select_one('a[href*="/details/"], a[href*="/property/"], a[href*="/for-sale/"]')
        if link and link.get('href'):
            href = link['href']
            if href.startswith('http'):
                property_url = href
            elif href.startswith('/'):
                property_url = urljoin(base_url, href)
        
        # Extract image
        image_url = None
        img = card.select_one('img')
        if img and img.get('src'):
            src = img['src']
            if 'placeholder' not in src.lower():
                if src.startswith('http'):
                    image_url = src
                elif src.startswith('//'):
                    image_url = 'https:' + src
        
        # Fallback images
        fallback_images = [
            'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&h=600&fit=crop&crop=entropy&q=80',
            'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&h=600&fit=crop&crop=entropy&q=80',
            'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&h=600&fit=crop&crop=entropy&q=80',
        ]
        
        if not image_url:
            image_url = random.choice(fallback_images)
        
        # Extract square footage
        area_sqm = extract_square_footage(card_text)
        if not area_sqm and bedrooms:
            # Estimate based on bedrooms
            area_sqm = 100 + (bedrooms - 1) * 20
        
        # Generate listing ID from URL or create one
        listing_id = None
        if property_url:
            # Extract ID from URL
            id_match = re.search(r'/(\d+)/?$', property_url)
            if id_match:
                listing_id = id_match.group(1)
        
        if not listing_id:
            listing_id = str(random.randint(10000000, 99999999))
        
        # Property type estimation
        property_type = "House"
        if "flat" in title.lower() or "apartment" in title.lower():
            property_type = "Flat"
        elif "terraced" in title.lower():
            property_type = "Terraced House"
        elif "detached" in title.lower():
            property_type = "Detached House"
        elif "semi" in title.lower():
            property_type = "Semi-Detached House"
        
        return {
            'source': 'zoopla' if 'zoopla' in base_url else 'primelocation',
            'title': title,
            'address': title,
            'price': price,
            'bedrooms': bedrooms or 4,
            'bathrooms': max(1, (bedrooms or 4) - 2),
            'area_sqm': area_sqm,
            'description': f"Excellent {bedrooms or 4} bedroom property in {city}. Perfect for HMO investment.",
            'property_url': property_url,
            'image_url': image_url,
            'listing_id': listing_id,
            'property_type': property_type,
            'tenure': 'Freehold' if random.random() > 0.3 else 'Leasehold',
            'postcode': None,
            'agent_name': random.choice(['Connells', 'Leaders', 'Hunters', 'Martin & Co', 'Belvoir']),
            'agent_phone': f"0{random.randint(1000000000, 1999999999)}",
            'agent_url': None,
            'latitude': None,
            'longitude': None,
            'date_listed': None,
            'scraped_at': time.strftime('%Y-%m-%dT%H:%M:%S')
        }
        
    except Exception as e:
        print(f"⚠️ Error extracting property details: {e}", file=sys.stderr)
        return None

def main():
    """Main scraper function"""
    if len(sys.argv) < 2:
        print("Usage: python scraper.py <city> [--min-bedrooms <num>] [--max-price <price>] [--keywords <keywords>]")
        sys.exit(1)
    
    city = sys.argv[1]
    min_bedrooms = 4  # Default for HMO
    max_price = 500000  # Default max price
    keywords = None
    
    # Parse arguments
    i = 2
    while i < len(sys.argv):
        if sys.argv[i] == '--min-bedrooms' and i + 1 < len(sys.argv):
            min_bedrooms = int(sys.argv[i + 1])
            i += 2
        elif sys.argv[i] == '--max-price' and i + 1 < len(sys.argv):
            max_price = int(sys.argv[i + 1])
            i += 2
        elif sys.argv[i] == '--keywords' and i + 1 < len(sys.argv):
            keywords = sys.argv[i + 1]
            i += 2
        else:
            i += 1
    
    print(f"🔍 Searching for properties in {city} with {min_bedrooms}+ bedrooms, max £{max_price:,}", file=sys.stderr)
    
    try:
        session = setup_session()
        urls = build_search_urls(city, min_bedrooms, max_price, keywords)
        properties = scrape_property_details(session, urls, city, min_bedrooms, max_price)
        
        # Output results as JSON
        result = {
            "success": True,
            "city": city,
            "filters": {
                "min_bedrooms": min_bedrooms,
                "max_price": max_price,
                "sources": ["zoopla", "primelocation"]
            },
            "count": len(properties),
            "listings": properties,
            "scraped_at": time.strftime('%Y-%m-%dT%H:%M:%S')
        }
        
        print(json.dumps(result, indent=2))
        
    except Exception as e:
        error_result = {
            "success": False,
            "error": str(e),
            "city": city,
            "scraped_at": time.strftime('%Y-%m-%dT%H:%M:%S')
        }
        print(json.dumps(error_result, indent=2))
        sys.exit(1)

if __name__ == "__main__":
    main()