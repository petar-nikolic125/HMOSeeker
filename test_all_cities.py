#!/usr/bin/env python3
"""
Comprehensive test script to verify property scraping works across all supported cities.
Tests with 4+ bedrooms, £500k max price, and "hmo" keywords.
"""

import subprocess
import json
import time
import sys
from datetime import datetime

# Unique cities to test (removing duplicates)
CITIES_TO_TEST = [
    "Birmingham", "Bradford", "Brighton", "Bristol", "Cardiff", 
    "Coventry", "Derby", "Edinburgh", "Glasgow", "Hull",
    "Leeds", "Leicester", "Liverpool", "London", "Manchester",
    "Newcastle", "Nottingham", "Plymouth", "Portsmouth", "Preston",
    "Reading", "Sheffield", "Southampton", "Stockport", "Wolverhampton"
]

def test_city_scraping(city, min_bedrooms=4, max_price=500000, keywords="hmo"):
    """Test scraping for a single city and return results"""
    print(f"\n🔍 Testing {city}...")
    
    try:
        # Run scraper with timeout
        cmd = [
            "python", "server/services/scraper.py",
            city, str(min_bedrooms), str(max_price), keywords
        ]
        
        result = subprocess.run(
            cmd, 
            capture_output=True, 
            text=True, 
            timeout=180,  # 3 minute timeout per city
            cwd="."
        )
        
        if result.returncode == 0:
            try:
                # Parse JSON output
                properties = json.loads(result.stdout)
                count = len(properties)
                
                # Validate properties meet criteria
                valid_properties = []
                for prop in properties:
                    price = prop.get("price", 0)
                    beds = prop.get("bedrooms", 0)
                    
                    if price <= max_price and beds >= min_bedrooms:
                        valid_properties.append(prop)
                
                valid_count = len(valid_properties)
                
                return {
                    "city": city,
                    "status": "success",
                    "total_properties": count,
                    "valid_properties": valid_count,
                    "properties": valid_properties[:3] if valid_properties else [],  # Sample
                    "error": None
                }
                
            except json.JSONDecodeError as e:
                return {
                    "city": city,
                    "status": "json_error",
                    "error": f"Failed to parse JSON: {str(e)}",
                    "stdout": result.stdout[:500],
                    "stderr": result.stderr[:500]
                }
        else:
            return {
                "city": city,
                "status": "scraper_error",
                "error": f"Scraper failed with code {result.returncode}",
                "stdout": result.stdout[:500],
                "stderr": result.stderr[:500]
            }
            
    except subprocess.TimeoutExpired:
        return {
            "city": city,
            "status": "timeout",
            "error": "Scraper timed out after 3 minutes"
        }
    except Exception as e:
        return {
            "city": city,
            "status": "exception",
            "error": str(e)
        }

def main():
    print(f"🏠 Starting comprehensive city scraping test")
    print(f"📊 Testing {len(CITIES_TO_TEST)} cities")
    print(f"🔍 Parameters: 4+ bedrooms, £500k max, 'hmo' keywords")
    print(f"⏰ Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    results = []
    successful = 0
    failed = 0
    
    for i, city in enumerate(CITIES_TO_TEST, 1):
        print(f"\n[{i:2d}/{len(CITIES_TO_TEST)}] Testing {city}...")
        
        result = test_city_scraping(city)
        results.append(result)
        
        if result["status"] == "success":
            successful += 1
            count = result["total_properties"]
            valid = result["valid_properties"]
            print(f"  ✅ Success: {count} total, {valid} valid properties")
        else:
            failed += 1
            print(f"  ❌ Failed: {result['status']} - {result['error']}")
        
        # Brief delay between cities to be respectful
        time.sleep(2)
    
    # Summary report
    print(f"\n" + "="*60)
    print(f"📋 COMPREHENSIVE TEST RESULTS")
    print(f"="*60)
    print(f"✅ Successful: {successful}/{len(CITIES_TO_TEST)} ({successful/len(CITIES_TO_TEST)*100:.1f}%)")
    print(f"❌ Failed: {failed}/{len(CITIES_TO_TEST)} ({failed/len(CITIES_TO_TEST)*100:.1f}%)")
    
    if successful > 0:
        print(f"\n🏆 SUCCESSFUL CITIES:")
        for result in results:
            if result["status"] == "success":
                print(f"  ✅ {result['city']:15} - {result['valid_properties']:2d} properties")
    
    if failed > 0:
        print(f"\n💥 FAILED CITIES:")
        for result in results:
            if result["status"] != "success":
                print(f"  ❌ {result['city']:15} - {result['status']}: {result['error'][:50]}...")
    
    # Save detailed results
    with open("city_test_results.json", "w") as f:
        json.dump({
            "timestamp": datetime.now().isoformat(),
            "summary": {
                "total_cities": len(CITIES_TO_TEST),
                "successful": successful,
                "failed": failed,
                "success_rate": successful/len(CITIES_TO_TEST)*100
            },
            "results": results
        }, f, indent=2)
    
    print(f"\n💾 Detailed results saved to: city_test_results.json")
    
    # Exit with appropriate code
    if failed == 0:
        print(f"🎉 ALL CITIES WORKING PERFECTLY!")
        sys.exit(0)
    elif successful > failed:
        print(f"⚠️  Most cities working, {failed} need attention")
        sys.exit(1)
    else:
        print(f"🚨 Many cities failing, needs investigation")
        sys.exit(2)

if __name__ == "__main__":
    main()