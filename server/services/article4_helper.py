#!/usr/bin/env python3
"""
Article 4 Helper - brza provera da li je postcode u Article 4 zoni
Koristi sačuvane JSON podatke iz cache/article4-*-postcodes.json
"""

import os
import json
import re
from pathlib import Path

CACHE_DIR = Path(__file__).parent.parent.parent / "cache"
LONDON_CACHE = CACHE_DIR / "article4-london-postcodes.json"
MANCHESTER_CACHE = CACHE_DIR / "article4-manchester-postcodes.json"

_article4_data = None

def load_article4_data():
    """Učitaj Article 4 podatke iz cache fajlova"""
    global _article4_data
    
    if _article4_data is not None:
        return _article4_data
    
    _article4_data = {
        'london': set(),
        'manchester': set()
    }
    
    # Učitaj London podatke
    if LONDON_CACHE.exists():
        try:
            with open(LONDON_CACHE, 'r') as f:
                london_data = json.load(f)
                for item in london_data:
                    if item.get('hasArticle4Current'):
                        _article4_data['london'].add(item['postcode'].upper())
            print(f"✅ Učitano {len(_article4_data['london'])} London Article 4 oblasti", flush=True)
        except Exception as e:
            print(f"⚠️ Greška učitavanja London Article 4 podataka: {e}", flush=True)
    else:
        print(f"⚠️ London Article 4 cache ne postoji: {LONDON_CACHE}", flush=True)
    
    # Učitaj Manchester podatke
    if MANCHESTER_CACHE.exists():
        try:
            with open(MANCHESTER_CACHE, 'r') as f:
                manchester_data = json.load(f)
                for item in manchester_data:
                    if item.get('hasArticle4Current'):
                        _article4_data['manchester'].add(item['postcode'].upper())
            print(f"✅ Učitano {len(_article4_data['manchester'])} Manchester Article 4 oblasti", flush=True)
        except Exception as e:
            print(f"⚠️ Greška učitavanja Manchester Article 4 podataka: {e}", flush=True)
    else:
        print(f"⚠️ Manchester Article 4 cache ne postoji: {MANCHESTER_CACHE}", flush=True)
    
    return _article4_data

def extract_postcode_district(address):
    """
    Izvuci postcode district iz adrese
    Primeri: "E1 4AA" -> "E1", "SW1A 1AA" -> "SW1A", "M1 1AB" -> "M1"
    """
    if not address:
        return None
    
    # Traži UK postcode pattern
    # Format: 1-2 slova, 1-2 broja, opciono slovo (outward code)
    match = re.search(r'\b([A-Z]{1,2}\d{1,2}[A-Z]?)\s*\d[A-Z]{2}\b', address.upper())
    if match:
        return match.group(1)
    
    # Pokušaj samo outward code bez inward dela
    match = re.search(r'\b([A-Z]{1,2}\d{1,2}[A-Z]?)\b', address.upper())
    if match:
        return match.group(1)
    
    return None

def is_article4_area(postcode_or_address, city=None):
    """
    Proveri da li je postcode/adresa u Article 4 zoni
    
    Args:
        postcode_or_address: Postcode (npr. "E1") ili puna adresa
        city: Grad (npr. "London", "Manchester") - opciono
    
    Returns:
        bool: True ako je u Article 4 zoni, False ako nije
    """
    data = load_article4_data()
    
    # Izvuci postcode district
    postcode_district = extract_postcode_district(postcode_or_address)
    
    if not postcode_district:
        # Ako nema validan postcode, pretpostavi da nije Article 4
        return False
    
    # Proveri u odgovarajućem setu
    if city:
        city_lower = city.lower()
        if 'london' in city_lower:
            return postcode_district in data['london']
        elif 'manchester' in city_lower:
            return postcode_district in data['manchester']
    
    # Ako grad nije specificiran, proveri oba
    return (postcode_district in data['london'] or 
            postcode_district in data['manchester'])

def get_article4_status(postcode_or_address, city=None):
    """
    Dobij detaljan status Article 4
    
    Returns:
        dict: {
            'is_article4': bool,
            'postcode_district': str or None,
            'city': str or None
        }
    """
    data = load_article4_data()
    postcode_district = extract_postcode_district(postcode_or_address)
    
    if not postcode_district:
        return {
            'is_article4': False,
            'postcode_district': None,
            'city': None
        }
    
    detected_city = None
    is_article4 = False
    
    if postcode_district in data['london']:
        detected_city = 'London'
        is_article4 = True
    elif postcode_district in data['manchester']:
        detected_city = 'Manchester'
        is_article4 = True
    
    return {
        'is_article4': is_article4,
        'postcode_district': postcode_district,
        'city': detected_city
    }

# Test ako se pokrene direktno
if __name__ == "__main__":
    test_addresses = [
        ("E1 4AA", "London"),
        ("SW1A 1AA", "London"),
        ("M1 1AB", "Manchester"),
        ("N14 5QP", "London"),
        ("EC1A 1BB", "London"),
    ]
    
    print("\n🧪 TEST Article 4 Helper:\n")
    for address, city in test_addresses:
        result = is_article4_area(address, city)
        status = get_article4_status(address, city)
        print(f"{address} ({city}): {'🔴 Article 4' if result else '✅ OK'}")
        print(f"   Detalji: {status}\n")
