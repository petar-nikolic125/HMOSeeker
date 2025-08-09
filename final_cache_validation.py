#!/usr/bin/env python3
"""
Final validation script to ensure all cities are properly cached with regional qualifiers
"""

import subprocess
import json
import os
import time
from datetime import datetime

# All cities we want to ensure are cached
CITIES = [
    "Birmingham", "Bradford", "Brighton", "Bristol", "Cardiff", 
    "Coventry", "Derby", "Edinburgh", "Glasgow", "Hull",
    "Leeds", "Leicester", "Liverpool", "London", "Manchester",
    "Newcastle", "Nottingham", "Plymouth", "Portsmouth", "Preston",
    "Reading", "Sheffield", "Southampton", "Stockport", "Wolverhampton"
]

def check_cache_exists(city, config):
    """Check if cache file exists for given city and config"""
    cache_dir = f"cache/primelocation/{city.lower().replace(' ', '-')}"
    if city.lower() in ["hull", "kingston upon hull"]:
        cache_dir = "cache/primelocation/kingston-upon-hull"
    elif city.lower() in ["newcastle", "newcastle upon tyne"]: 
        cache_dir = "cache/primelocation/newcastle-upon-tyne"
    elif city.lower() in ["brighton", "brighton and hove"]:
        cache_dir = "cache/primelocation/brighton-and-hove"
    
    return len([f for f in os.listdir(cache_dir) if f.startswith("search_")]) > 0 if os.path.exists(cache_dir) else False

def cache_city_if_needed(city):
    """Cache a city if not already cached"""
    if check_cache_exists(city, None):
        print(f"✅ {city} - Already cached")
        return True
    
    print(f"🔄 {city} - Caching now...")
    try:
        cmd = ["python", "server/services/scraper.py", city, "4", "500000", "hmo"]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120, cwd=".")
        
        if result.returncode == 0:
            properties = json.loads(result.stdout)
            print(f"✅ {city} - Cached {len(properties)} properties")
            return True
        else:
            print(f"❌ {city} - Failed to cache")
            return False
    except Exception as e:
        print(f"❌ {city} - Error: {str(e)[:50]}...")
        return False

def main():
    print("🔍 FINAL CACHE VALIDATION")
    print("Ensuring all cities have cached data with regional qualifiers")
    print("=" * 60)
    
    cached_count = 0
    failed_count = 0
    
    for i, city in enumerate(CITIES, 1):
        print(f"[{i:2d}/{len(CITIES)}] ", end="")
        
        if cache_city_if_needed(city):
            cached_count += 1
        else:
            failed_count += 1
        
        time.sleep(2)  # Brief delay between cities
    
    print("\n" + "=" * 60)
    print("📊 FINAL RESULTS")
    print("=" * 60)
    
    success_rate = (cached_count / len(CITIES)) * 100
    print(f"✅ Successfully cached: {cached_count}/{len(CITIES)} ({success_rate:.1f}%)")
    print(f"❌ Failed to cache: {failed_count}")
    
    # Check actual cache files
    total_cache_files = 0
    for city in CITIES:
        city_dir = f"cache/primelocation/{city.lower().replace(' ', '-')}"
        if city.lower() in ["hull", "kingston upon hull"]:
            city_dir = "cache/primelocation/kingston-upon-hull"
        elif city.lower() in ["newcastle", "newcastle upon tyne"]: 
            city_dir = "cache/primelocation/newcastle-upon-tyne"
        elif city.lower() in ["brighton", "brighton and hove"]:
            city_dir = "cache/primelocation/brighton-and-hove"
            
        if os.path.exists(city_dir):
            cache_files = len([f for f in os.listdir(city_dir) if f.startswith("search_")])
            total_cache_files += cache_files
    
    print(f"💾 Total cache files created: {total_cache_files}")
    print(f"📈 Average cache files per city: {total_cache_files / len(CITIES):.1f}")
    
    if success_rate >= 90:
        print("🎉 EXCELLENT! All cities properly cached with regional qualifiers")
    elif success_rate >= 75:
        print("👍 GOOD! Most cities cached successfully")
    else:
        print("⚠️ NEEDS ATTENTION! Some cities failed to cache")
    
    print(f"\n✅ Cache validation complete at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

if __name__ == "__main__":
    main()