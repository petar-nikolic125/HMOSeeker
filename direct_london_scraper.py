
#!/usr/bin/env python3
"""
Direct London Property Scraper
Scrapes PrimeLocation for London properties with specific filters
"""

import sys
import json
import subprocess
import time
from datetime import datetime

def run_london_scrape():
    """Run direct scraping for London with the specified parameters"""
    
    print(f"🏠 Starting direct London property scraping")
    print(f"🔍 Parameters: 1+ bedrooms, £1,500,000 max, HMO keywords")
    print(f"⏰ Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Use the property_scraper_core.py from attached_assets
    scraper_path = "attached_assets/property_scraper_core_1754665869415.py"
    
    # Parameters matching your URL
    args = [
        "python3", scraper_path,
        "London",          # city
        "1",              # min_bedrooms 
        "1500000",        # max_price
        "HMO",            # keywords
        "--site", "primelocation",
        "--max-pages", "4",
        "--limit", "50",
        "--detail-enrich", "20",
        "--concurrency", "6",
        "--verbosity", "2"
    ]
    
    print(f"🚀 Running command: {' '.join(args)}")
    
    try:
        # Run the scraper
        result = subprocess.run(
            args,
            capture_output=True,
            text=True,
            timeout=300  # 5 minutes timeout
        )
        
        if result.returncode == 0:
            print(f"✅ Scraping completed successfully!")
            
            # Parse the JSON output
            try:
                properties = json.loads(result.stdout)
                print(f"📊 Found {len(properties)} properties")
                
                # Save to cache file with timestamp
                timestamp = int(time.time() * 1000)
                cache_file = f"cache/primelocation/london/direct_scrape_{timestamp}.json"
                
                # Ensure directory exists
                import os
                os.makedirs(os.path.dirname(cache_file), exist_ok=True)
                
                with open(cache_file, 'w', encoding='utf-8') as f:
                    json.dump(properties, f, indent=2, ensure_ascii=False)
                
                print(f"💾 Saved to: {cache_file}")
                
                # Show sample properties
                print(f"\n🏡 Sample properties:")
                for i, prop in enumerate(properties[:5]):
                    print(f"  {i+1}. {prop.get('title', 'N/A')} - £{prop.get('price', 0):,}")
                
                return properties
                
            except json.JSONDecodeError as e:
                print(f"❌ Failed to parse JSON output: {e}")
                print(f"Raw output: {result.stdout[:500]}...")
                return []
                
        else:
            print(f"❌ Scraping failed with exit code: {result.returncode}")
            print(f"Error: {result.stderr}")
            return []
            
    except subprocess.TimeoutExpired:
        print(f"❌ Scraping timed out after 5 minutes")
        return []
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return []

if __name__ == "__main__":
    properties = run_london_scrape()
    
    if properties:
        print(f"\n🎉 Successfully scraped {len(properties)} London properties!")
        
        # Print summary statistics
        prices = [p.get('price', 0) for p in properties if p.get('price')]
        bedrooms = [p.get('bedrooms', 0) for p in properties if p.get('bedrooms')]
        
        if prices:
            print(f"💰 Price range: £{min(prices):,} - £{max(prices):,}")
            print(f"📊 Average price: £{sum(prices)//len(prices):,}")
        
        if bedrooms:
            print(f"🛏️  Bedroom range: {min(bedrooms)} - {max(bedrooms)}")
            
        # Count HMO properties (4+ bedrooms)
        hmo_count = len([p for p in properties if (p.get('bedrooms') or 0) >= 4])
        print(f"🏠 Potential HMO properties (4+ beds): {hmo_count}")
        
    else:
        print(f"❌ No properties found")
        sys.exit(1)
