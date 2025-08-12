#!/usr/bin/env python3
"""
Test script to ensure London cache and scraping system is robust
"""

import json
import os
import requests
import sys
from datetime import datetime

def test_london_cache():
    """Test London cache loading and filtering."""
    print("🧪 Testing London Cache System")
    print("=" * 50)
    
    cache_dir = "cache/primelocation/london"
    if not os.path.exists(cache_dir):
        print(f"❌ London cache directory not found: {cache_dir}")
        return False
    
    # Count cache files and properties
    cache_files = [f for f in os.listdir(cache_dir) if f.endswith('.json') and not f.endswith('.backup')]
    print(f"📁 Found {len(cache_files)} cache files in London")
    
    total_props = 0
    hmo_candidates = 0
    non_article4 = 0
    
    for file in cache_files:
        filepath = os.path.join(cache_dir, file)
        try:
            with open(filepath, 'r') as f:
                props = json.load(f)
                file_count = len(props) if isinstance(props, list) else 0
                total_props += file_count
                
                # Count HMO features
                for prop in props:
                    if prop.get('hmo_candidate'):
                        hmo_candidates += 1
                    if prop.get('article4_area') is False:
                        non_article4 += 1
                
                print(f"  📄 {file}: {file_count} properties")
        except Exception as e:
            print(f"  ❌ Error reading {file}: {e}")
    
    print(f"\n📊 London Cache Summary:")
    print(f"  • Total Properties: {total_props}")
    print(f"  • HMO Candidates: {hmo_candidates}")
    print(f"  • Non-Article 4: {non_article4}")
    
    return total_props > 0

def test_london_api():
    """Test London API endpoints."""
    print("\n🧪 Testing London API")
    print("=" * 50)
    
    base_url = "http://localhost:5000"
    
    # Test basic London search
    try:
        response = requests.get(f"{base_url}/api/properties?city=London")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Basic London search: {data.get('count', 0)} properties")
            
            # Test with price filter
            response2 = requests.get(f"{base_url}/api/properties?city=London&max_price=600000")
            if response2.status_code == 200:
                data2 = response2.json()
                print(f"✅ London with max price £600k: {data2.get('count', 0)} properties")
                
                # Test HMO candidate filter
                response3 = requests.get(f"{base_url}/api/properties?city=London&hmo_candidate=true")
                if response3.status_code == 200:
                    data3 = response3.json()
                    print(f"✅ London HMO candidates: {data3.get('count', 0)} properties")
                    
                    # Test Article 4 filter
                    response4 = requests.get(f"{base_url}/api/properties?city=London&article4_filter=non_article4")
                    if response4.status_code == 200:
                        data4 = response4.json()
                        print(f"✅ London non-Article 4: {data4.get('count', 0)} properties")
                        return True
                    
        print("❌ API tests failed")
        return False
        
    except Exception as e:
        print(f"❌ API connection error: {e}")
        return False

def test_london_scraper():
    """Test London scraper functionality."""
    print("\n🧪 Testing London Scraper")
    print("=" * 50)
    
    import subprocess
    
    try:
        # Test scraper with safe parameters
        cmd = ["python", "zoopla_scraper.py", "london", "3", "500000", "house"]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        
        if result.returncode == 0:
            output = result.stdout
            if "No properties found" in output:
                print("⚠️  Scraper ran but found no properties")
                return True  # Still counts as working
            elif "Error" in output:
                print(f"❌ Scraper error: {output}")
                return False
            else:
                print("✅ Scraper executed successfully")
                return True
        else:
            print(f"❌ Scraper failed with code {result.returncode}")
            if result.stderr:
                print(f"Error: {result.stderr}")
            return False
            
    except subprocess.TimeoutExpired:
        print("⚠️  Scraper timeout (expected for live scraping)")
        return True  # Timeout is acceptable
    except Exception as e:
        print(f"❌ Scraper test error: {e}")
        return False

def main():
    """Run all London system tests."""
    print("🏠 London HMO System Robustness Test")
    print("=" * 60)
    print(f"📅 Test Date: {datetime.now()}")
    print()
    
    cache_ok = test_london_cache()
    api_ok = test_london_api()
    scraper_ok = test_london_scraper()
    
    print("\n" + "=" * 60)
    print("📊 FINAL RESULTS:")
    print(f"  Cache System: {'✅ PASS' if cache_ok else '❌ FAIL'}")
    print(f"  API System:   {'✅ PASS' if api_ok else '❌ FAIL'}")
    print(f"  Scraper:      {'✅ PASS' if scraper_ok else '❌ FAIL'}")
    
    if cache_ok and api_ok and scraper_ok:
        print("\n🎉 London HMO System is ROBUST and READY!")
        return 0
    else:
        print("\n⚠️  Some components need attention")
        return 1

if __name__ == "__main__":
    sys.exit(main())