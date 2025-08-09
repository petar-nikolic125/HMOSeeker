#!/usr/bin/env python3
"""
Quick targeted caching test for key cities with regional qualifiers
"""

import subprocess
import json
import time
import sys
from datetime import datetime

# Focus on cities mentioned by user and high-value targets
PRIORITY_CITIES = [
    "Leeds",        # User mentioned: Leeds, West Yorkshire
    "Brighton",     # User mentioned: Brighton, East Sussex  
    "Manchester",   # Major city - should work well
    "Liverpool",    # Major city - should work well
    "London",       # Major city - always important
    "Birmingham",   # Already confirmed working
    "Bristol",      # Already confirmed working
    "Sheffield",    # Already confirmed working
    "Edinburgh",    # Already confirmed working
    "Glasgow",      # Scotland coverage
]

def quick_cache_city(city, min_beds=4, max_price=500000):
    """Quick cache test for a single city"""
    print(f"Testing {city}... ", end="", flush=True)
    
    try:
        cmd = ["python", "server/services/scraper.py", city, str(min_beds), str(max_price), "hmo"]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=180, cwd=".")
        
        if result.returncode == 0:
            try:
                properties = json.loads(result.stdout)
                count = len(properties)
                print(f"✅ {count} properties")
                return {"city": city, "status": "success", "count": count}
            except json.JSONDecodeError:
                print("❌ JSON error")
                return {"city": city, "status": "json_error"}
        else:
            print("❌ Scraper error")
            return {"city": city, "status": "scraper_error"}
            
    except subprocess.TimeoutExpired:
        print("❌ Timeout")
        return {"city": city, "status": "timeout"}
    except Exception as e:
        print(f"❌ Exception: {e}")
        return {"city": city, "status": "exception"}

def main():
    print("🚀 QUICK CACHE TEST FOR PRIORITY CITIES")
    print(f"Testing {len(PRIORITY_CITIES)} cities with regional qualifiers")
    print("=" * 50)
    
    results = []
    successful = 0
    
    for i, city in enumerate(PRIORITY_CITIES, 1):
        print(f"[{i:2d}/{len(PRIORITY_CITIES)}] ", end="")
        result = quick_cache_city(city)
        results.append(result)
        
        if result["status"] == "success":
            successful += 1
        
        time.sleep(3)  # Brief delay between cities
    
    print("\n" + "=" * 50)
    print("📋 RESULTS SUMMARY")
    print("=" * 50)
    
    success_rate = (successful / len(PRIORITY_CITIES)) * 100
    print(f"✅ Successful: {successful}/{len(PRIORITY_CITIES)} ({success_rate:.1f}%)")
    
    # Show successful cities
    successful_cities = [r for r in results if r["status"] == "success"]
    if successful_cities:
        print(f"\n🎉 WORKING CITIES:")
        for r in successful_cities:
            print(f"  ✅ {r['city']:15} - {r['count']} properties")
    
    # Show problematic cities
    failed_cities = [r for r in results if r["status"] != "success"]
    if failed_cities:
        print(f"\n⚠️  NEED ATTENTION:")
        for r in failed_cities:
            print(f"  ❌ {r['city']:15} - {r['status']}")
    
    # Save results
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    with open(f"quick_cache_results_{timestamp}.json", "w") as f:
        json.dump({
            "timestamp": datetime.now().isoformat(),
            "success_rate": success_rate,
            "results": results
        }, f, indent=2)
    
    print(f"\n💾 Results saved to: quick_cache_results_{timestamp}.json")
    
    if success_rate >= 80:
        print(f"🎉 EXCELLENT! Regional qualifiers working well")
    elif success_rate >= 60:
        print(f"👍 GOOD! Most cities working")
    else:
        print(f"🚨 ISSUES! Need to investigate")

if __name__ == "__main__":
    main()