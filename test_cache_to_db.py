#!/usr/bin/env python3
"""
Test script to load cached data from JSON files and populate the database
"""
import json
import os
import requests
from pathlib import Path

def load_cache_and_populate_db():
    """Load cached JSON data and send to database via API"""
    
    cache_dir = Path("cache/primelocation")
    
    if not cache_dir.exists():
        print("❌ Cache directory not found")
        return
    
    city_dirs = [d for d in cache_dir.iterdir() if d.is_dir()]
    print(f"📁 Found {len(city_dirs)} city directories")
    
    total_properties = 0
    
    for city_dir in city_dirs:
        city_name = city_dir.name.capitalize()
        json_files = list(city_dir.glob("*.json"))
        
        print(f"\n🏙️  Processing {city_name} - {len(json_files)} cache files")
        
        for json_file in json_files:
            try:
                with open(json_file, 'r') as f:
                    properties = json.load(f)
                
                if isinstance(properties, list) and len(properties) > 0:
                    print(f"  📄 {json_file.name}: {len(properties)} properties")
                    
                    # Transform properties to match API format
                    transformed_properties = []
                    for prop in properties:
                        transformed = {
                            "source": "primelocation",
                            "title": prop.get("address", "Property Listing"),
                            "address": prop.get("address", ""),
                            "price": prop.get("price", 0),
                            "bedrooms": prop.get("bedrooms", 0),
                            "bathrooms": prop.get("bathrooms", 0),
                            "description": prop.get("description", ""),
                            "property_url": prop.get("property_url", ""),
                            "image_url": prop.get("image_url", ""),
                            "listing_id": f"cache-{prop.get('property_url', '').split('/')[-2] if prop.get('property_url') else 'unknown'}",
                            "postcode": prop.get("postcode", ""),
                            "property_type": "house",
                        }
                        transformed_properties.append(transformed)
                    
                    # Send to database via direct storage call
                    try:
                        response = requests.post(
                            "http://localhost:5000/api/properties/bulk-insert",
                            json={"properties": transformed_properties},
                            headers={"Content-Type": "application/json"}
                        )
                        
                        if response.status_code == 200:
                            result = response.json()
                            saved_count = result.get("saved_count", 0)
                            print(f"    ✅ Saved {saved_count} properties to database")
                            total_properties += saved_count
                        else:
                            print(f"    ❌ API call failed: {response.status_code}")
                            
                    except Exception as api_error:
                        print(f"    ❌ API error: {api_error}")
                
                else:
                    print(f"  📄 {json_file.name}: Empty or invalid data")
                    
            except Exception as e:
                print(f"  ❌ Error processing {json_file}: {e}")
    
    print(f"\n🎉 Total properties saved: {total_properties}")

if __name__ == "__main__":
    load_cache_and_populate_db()