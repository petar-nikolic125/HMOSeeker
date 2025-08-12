#!/usr/bin/env python3
"""
Enhanced London bulk scraper for HMO properties
Specifically designed to find HMO opportunities in London with advanced filtering
"""

import subprocess
import json
import os
import time
from datetime import datetime

def scrape_london_hmo_properties():
    """Scrape London for HMO properties with different search parameters."""
    print("🏠 Starting Enhanced London HMO Scrape")
    print("=" * 50)
    print(f"📅 {datetime.now()}")
    
    # London-specific search parameters for HMO opportunities
    search_configs = [
        {
            "name": "London HMO Houses 4+ bed",
            "params": ["london", "4", "800000", "house OR terraced OR detached"]
        },
        {
            "name": "London HMO Houses 5+ bed", 
            "params": ["london", "5", "900000", "house OR terraced"]
        },
        {
            "name": "London HMO Houses 6+ bed",
            "params": ["london", "6", "1200000", "house OR terraced"]
        },
        {
            "name": "London Large Houses under 700k",
            "params": ["london", "4", "700000", "large OR spacious OR house"]
        },
        {
            "name": "London conversion opportunities",
            "params": ["london", "3", "600000", "conversion OR potential OR development"]
        }
    ]
    
    total_found = 0
    
    for i, config in enumerate(search_configs, 1):
        print(f"\n📍 Search {i}/{len(search_configs)}: {config['name']}")
        print("=" * 40)
        
        try:
            cmd = ["python", "zoopla_scraper.py"] + config["params"]
            print(f"🔍 Command: {' '.join(cmd)}")
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
            
            if result.returncode == 0:
                output = result.stdout
                lines = output.strip().split('\n')
                
                # Count properties found
                found_count = 0
                for line in lines:
                    if "found" in line.lower() and "properties" in line.lower():
                        # Extract number from output
                        import re
                        numbers = re.findall(r'\d+', line)
                        if numbers:
                            found_count = int(numbers[0])
                            break
                
                if found_count > 0:
                    print(f"✅ Found {found_count} properties")
                    total_found += found_count
                else:
                    print("ℹ️  No new properties found (may be duplicates)")
                    
            else:
                print(f"⚠️  Search failed with code {result.returncode}")
                if result.stderr:
                    print(f"Error: {result.stderr[:200]}")
            
            # Wait between searches to be respectful
            if i < len(search_configs):
                print("⏳ Waiting 10 seconds...")
                time.sleep(10)
                
        except subprocess.TimeoutExpired:
            print("⏰ Search timeout (2 minutes) - continuing...")
        except Exception as e:
            print(f"❌ Error: {e}")
    
    print(f"\n🎉 London HMO Scrape Complete!")
    print(f"📊 Total properties found: {total_found}")
    
    # Check final cache count
    try:
        cache_dir = "cache/primelocation/london"
        if os.path.exists(cache_dir):
            cache_files = [f for f in os.listdir(cache_dir) if f.endswith('.json') and not f.endswith('.backup')]
            cache_count = 0
            for file in cache_files:
                filepath = os.path.join(cache_dir, file)
                with open(filepath, 'r') as f:
                    props = json.load(f)
                    cache_count += len(props) if isinstance(props, list) else 0
            
            print(f"💾 London cache now contains: {cache_count} properties")
    except Exception as e:
        print(f"⚠️  Could not count cache: {e}")

if __name__ == "__main__":
    scrape_london_hmo_properties()