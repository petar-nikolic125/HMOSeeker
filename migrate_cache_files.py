#!/usr/bin/env python3
"""
Migration script to update existing cache files with new HMO and Article 4 fields
This script adds the new enhanced fields to existing cached properties
"""

import json
import os
import glob
import re
import sys
from datetime import datetime

# Define known Article 4 areas for quick lookup
ARTICLE4_BOROUGHS = {
    "Barking and Dagenham", "Barnet", "Bexley", "Brent", "Croydon", "Enfield",
    "Greenwich", "Havering", "Hounslow", "Newham", "Redbridge", "Tower Hamlets",
    "Waltham Forest", "Hillingdon", "Ealing", "Haringey", "Southwark", "Lewisham",
    "Merton", "Bromley", "Kingston upon Thames", "Sutton"
}

ARTICLE4_CITIES = {
    "Manchester", "Leeds", "Nottingham", "Birmingham", "Oxford", "Brighton", "Liverpool"
}

def is_article4_area(address, london_borough=None):
    """Determine if the address is in an Article 4 area."""
    addr_lower = address.lower()
    if london_borough:
        article4_status = london_borough in ARTICLE4_BOROUGHS
        return "Full" if article4_status else "None"
    
    if " london" in addr_lower:
        return "None"
    
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
    
    # Extract postcode
    postcode_match = re.search(r"\b([A-Z]{1,2})(\d{1,2}[A-Z]?)\s*(\d[A-Z]{2})\b", addr_clean, flags=re.IGNORECASE)
    if postcode_match:
        postcode_area = postcode_match.group(1).upper()
        postcode_district = f"{postcode_match.group(1)}{postcode_match.group(2)}".upper()
    else:
        outcode_match = re.search(r"\b([A-Z]{1,2}\d{1,2}[A-Z]?)\b", addr_clean, flags=re.IGNORECASE)
        if outcode_match:
            postcode_district = outcode_match.group(1).upper()
            postcode_area = re.match(r"^[A-Z]+", postcode_district).group(0)
    
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
        if " london" in addr_lower:
            idx = addr_lower.index(" london")
            district_part = addr_clean[:idx].strip().strip(",")
            if district_part:
                district = district_part
        
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
    
    # Look for sq m first
    sqm_match = re.search(r"([\d,\.]+)\s*(?:sq\s*m|sqm|square\s*metres?)", text_lower)
    if sqm_match:
        try:
            area_sqm = float(sqm_match.group(1).replace(",", ""))
            return round(area_sqm, 2), False
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

def migrate_property(prop):
    """Add new fields to a property object."""
    address = prop.get("address", "")
    title = prop.get("title", "")
    description = prop.get("description", "")
    
    # Skip if already migrated
    if "hmo_candidate" in prop:
        return prop
    
    # Extract area information if not present
    if "area_sqm" not in prop or prop["area_sqm"] is None:
        area_sqm, area_estimated = extract_area_from_text(f"{title} {description}")
        prop["area_sqm"] = area_sqm
        prop["area_estimated"] = area_estimated
    else:
        prop["area_estimated"] = prop.get("area_estimated", False)
    
    # Determine location details
    london_borough = None
    london_district = None
    postcode_area = None
    postcode_district = None
    
    if "london" in address.lower():
        london_borough, london_district, postcode_area, postcode_district = parse_london_location(address)
    
    # Add London-specific fields
    prop["london_borough"] = london_borough
    prop["london_district"] = london_district
    prop["postcode_district"] = postcode_district
    prop["postcode_area"] = postcode_area
    
    # Determine Article 4 status
    article4_status = is_article4_area(address, london_borough)
    prop["article4_area"] = article4_status != "None"
    prop["article4_status"] = article4_status
    
    # Extract property details
    details = extract_property_details(title, description)
    prop.update(details)
    
    # Determine HMO candidate status
    hmo_candidate = False
    area_sqm = prop.get("area_sqm")
    if area_sqm and area_sqm >= 90 and not prop["article4_area"]:
        hmo_candidate = True
    prop["hmo_candidate"] = hmo_candidate
    
    # Add migration timestamp
    prop["migrated_at"] = datetime.now().isoformat()
    
    return prop

def migrate_cache_file(file_path):
    """Migrate a single cache file."""
    print(f"Migrating: {file_path}")
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if not isinstance(data, list):
            print(f"  ❌ Skipping {file_path} - not a list")
            return False
        
        migrated_count = 0
        for prop in data:
            if "hmo_candidate" not in prop:
                migrate_property(prop)
                migrated_count += 1
        
        if migrated_count > 0:
            # Create backup
            backup_path = f"{file_path}.backup"
            with open(backup_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            
            # Save migrated file
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            
            print(f"  ✅ Migrated {migrated_count}/{len(data)} properties")
            return True
        else:
            print(f"  ℹ️  No properties to migrate (already up to date)")
            return False
            
    except Exception as e:
        print(f"  ❌ Error migrating {file_path}: {e}")
        return False

def main():
    """Main migration function."""
    cache_dir = "cache/primelocation"
    
    if not os.path.exists(cache_dir):
        print(f"❌ Cache directory not found: {cache_dir}")
        return
    
    print(f"🔄 Starting migration of cache files in {cache_dir}")
    print("=" * 60)
    
    # Find all JSON files in cache directories
    json_files = []
    for root, dirs, files in os.walk(cache_dir):
        for file in files:
            if file.endswith('.json') and not file.endswith('.backup'):
                json_files.append(os.path.join(root, file))
    
    if not json_files:
        print("❌ No JSON cache files found")
        return
    
    print(f"📁 Found {len(json_files)} cache files to migrate")
    print()
    
    migrated_files = 0
    for file_path in json_files:
        if migrate_cache_file(file_path):
            migrated_files += 1
    
    print()
    print("=" * 60)
    print(f"✅ Migration complete: {migrated_files}/{len(json_files)} files migrated")
    print(f"📦 Backup files created with .backup extension")

if __name__ == "__main__":
    main()