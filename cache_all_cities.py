#!/usr/bin/env python3
"""
Comprehensive caching script to pre-populate property data for all supported cities.
This ensures all cities have cached data available for faster frontend responses.
"""

import subprocess
import json
import time
import sys
import os
from datetime import datetime

# All supported cities from the scraper
ALL_CITIES = [
    "Birmingham", "Bradford", "Brighton", "Bristol", "Cardiff", 
    "Coventry", "Derby", "Edinburgh", "Glasgow", "Hull",
    "Leeds", "Leicester", "Liverpool", "London", "Manchester",
    "Newcastle", "Nottingham", "Plymouth", "Portsmouth", "Preston",
    "Reading", "Sheffield", "Southampton", "Stockport", "Wolverhampton"
]

# Test parameters for comprehensive coverage
TEST_CONFIGS = [
    {"min_beds": 4, "max_price": 500000, "keywords": "hmo"},
    {"min_beds": 3, "max_price": 400000, "keywords": "hmo"},
    {"min_beds": 5, "max_price": 700000, "keywords": "hmo"},
    {"min_beds": 4, "max_price": 300000, "keywords": ""},
]

def cache_city_data(city, config, timeout=300):
    """Cache property data for a single city with given configuration"""
    print(f"🔍 Caching {city} - {config['min_beds']}+ beds, £{config['max_price']:,} max, '{config['keywords']}'")
    
    try:
        cmd = [
            "python", "server/services/scraper.py",
            city, str(config["min_beds"]), str(config["max_price"]), config["keywords"]
        ]
        
        # Force refresh to get fresh data
        env = os.environ.copy()
        env["REFRESH"] = "1"
        
        result = subprocess.run(
            cmd, 
            capture_output=True, 
            text=True, 
            timeout=timeout,
            cwd=".",
            env=env
        )
        
        if result.returncode == 0:
            try:
                properties = json.loads(result.stdout)
                count = len(properties)
                
                # Validate quality of results
                valid_properties = []
                for prop in properties:
                    price = prop.get("price", 0)
                    beds = prop.get("bedrooms", 0)
                    address = prop.get("address", "")
                    
                    if (price <= config["max_price"] and 
                        beds >= config["min_beds"] and 
                        address and len(address) > 10):
                        valid_properties.append(prop)
                
                valid_count = len(valid_properties)
                success_rate = (valid_count / count * 100) if count > 0 else 0
                
                return {
                    "status": "success",
                    "total": count,
                    "valid": valid_count,
                    "success_rate": success_rate,
                    "sample": valid_properties[:2] if valid_properties else []
                }
                
            except json.JSONDecodeError as e:
                return {"status": "json_error", "error": str(e), "output": result.stdout[:200]}
        else:
            return {"status": "scraper_error", "error": f"Exit code {result.returncode}", "stderr": result.stderr[:200]}
            
    except subprocess.TimeoutExpired:
        return {"status": "timeout", "error": f"Timed out after {timeout}s"}
    except Exception as e:
        return {"status": "exception", "error": str(e)}

def main():
    print("🏠 COMPREHENSIVE CITY CACHING SCRIPT")
    print("=" * 50)
    print(f"📊 Cities to cache: {len(ALL_CITIES)}")
    print(f"🔧 Configurations per city: {len(TEST_CONFIGS)}")
    print(f"📈 Total cache operations: {len(ALL_CITIES) * len(TEST_CONFIGS)}")
    print(f"⏰ Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    overall_results = {
        "start_time": datetime.now().isoformat(),
        "cities": {},
        "summary": {"total_operations": 0, "successful": 0, "failed": 0}
    }
    
    total_operations = len(ALL_CITIES) * len(TEST_CONFIGS)
    completed_operations = 0
    
    for city_idx, city in enumerate(ALL_CITIES, 1):
        print(f"\n[{city_idx:2d}/{len(ALL_CITIES)}] === CACHING {city.upper()} ===")
        city_results = {}
        city_successful = 0
        
        for config_idx, config in enumerate(TEST_CONFIGS, 1):
            completed_operations += 1
            progress = (completed_operations / total_operations) * 100
            
            print(f"  [{config_idx}/{len(TEST_CONFIGS)}] ", end="")
            result = cache_city_data(city, config)
            
            config_key = f"{config['min_beds']}bed_{config['max_price']}_{config['keywords'] or 'no_keywords'}"
            city_results[config_key] = result
            
            if result["status"] == "success":
                city_successful += 1
                overall_results["summary"]["successful"] += 1
                print(f"✅ {result['valid']}/{result['total']} valid properties ({result['success_rate']:.1f}%)")
            else:
                overall_results["summary"]["failed"] += 1
                print(f"❌ {result['status']}: {result['error'][:50]}...")
            
            overall_results["summary"]["total_operations"] += 1
            print(f"      Progress: {progress:.1f}% complete")
            
            # Brief delay between configurations
            time.sleep(3)
        
        overall_results["cities"][city] = {
            "results": city_results,
            "success_count": city_successful,
            "total_configs": len(TEST_CONFIGS),
            "success_rate": (city_successful / len(TEST_CONFIGS)) * 100
        }
        
        print(f"  📊 {city} Summary: {city_successful}/{len(TEST_CONFIGS)} configurations successful")
        
        # Longer delay between cities to be respectful
        if city_idx < len(ALL_CITIES):
            print(f"  ⏳ Waiting 10s before next city...")
            time.sleep(10)
    
    overall_results["end_time"] = datetime.now().isoformat()
    
    # Final summary
    print("\n" + "=" * 60)
    print("📋 FINAL CACHING RESULTS")
    print("=" * 60)
    
    successful_ops = overall_results["summary"]["successful"]
    total_ops = overall_results["summary"]["total_operations"]
    success_rate = (successful_ops / total_ops * 100) if total_ops > 0 else 0
    
    print(f"✅ Successful operations: {successful_ops}/{total_ops} ({success_rate:.1f}%)")
    print(f"❌ Failed operations: {overall_results['summary']['failed']}")
    
    # City-by-city breakdown
    print(f"\n🏆 CITY SUCCESS RATES:")
    city_stats = []
    for city, data in overall_results["cities"].items():
        city_stats.append((city, data["success_rate"], data["success_count"]))
    
    # Sort by success rate
    city_stats.sort(key=lambda x: x[1], reverse=True)
    
    for city, rate, count in city_stats:
        if rate >= 75:
            status = "🟢"
        elif rate >= 50:
            status = "🟡"
        else:
            status = "🔴"
        print(f"  {status} {city:15} - {count}/{len(TEST_CONFIGS)} configs ({rate:.1f}%)")
    
    # Top performing cities
    top_cities = [city for city, rate, _ in city_stats if rate >= 75]
    struggling_cities = [city for city, rate, _ in city_stats if rate < 50]
    
    if top_cities:
        print(f"\n🎉 EXCELLENT PERFORMERS ({len(top_cities)} cities):")
        print(f"   {', '.join(top_cities)}")
    
    if struggling_cities:
        print(f"\n⚠️  NEED ATTENTION ({len(struggling_cities)} cities):")
        print(f"   {', '.join(struggling_cities)}")
    
    # Save detailed results
    results_file = f"cache_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(results_file, "w") as f:
        json.dump(overall_results, f, indent=2)
    
    print(f"\n💾 Detailed results saved to: {results_file}")
    
    # Calculate time taken
    start_time = datetime.fromisoformat(overall_results["start_time"])
    end_time = datetime.fromisoformat(overall_results["end_time"])
    duration = end_time - start_time
    
    print(f"⏱️  Total time: {duration}")
    print(f"📈 Average per operation: {duration.total_seconds() / total_ops:.1f}s")
    
    if success_rate >= 80:
        print(f"\n🎉 EXCELLENT! {success_rate:.1f}% success rate - system is production ready!")
        sys.exit(0)
    elif success_rate >= 60:
        print(f"\n👍 GOOD! {success_rate:.1f}% success rate - minor issues to address")
        sys.exit(1)
    else:
        print(f"\n🚨 NEEDS WORK! {success_rate:.1f}% success rate - significant issues found")
        sys.exit(2)

if __name__ == "__main__":
    main()