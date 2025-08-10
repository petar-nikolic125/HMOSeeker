#!/usr/bin/env python3
"""
Direct bulk scraper runner - bypasses web interface for faster execution
"""
import requests
import time
import json

def run_bulk_scraper():
    """Run bulk scraper and monitor progress"""
    
    base_url = "http://localhost:5000"
    
    print("🚀 Starting HMO bulk scraper...")
    
    try:
        # Trigger bulk scrape
        response = requests.post(f"{base_url}/api/bulk-scrape")
        if response.status_code == 200:
            print("✅ Bulk scraping started successfully")
        else:
            print(f"❌ Failed to start bulk scraping: {response.status_code}")
            return
            
        # Monitor progress
        last_city = ""
        start_time = time.time()
        
        while True:
            try:
                response = requests.get(f"{base_url}/api/bulk-scrape/progress")
                if response.status_code == 200:
                    data = response.json()
                    progress = data.get("progress", {})
                    
                    current_city = progress.get("currentCity", "")
                    completed = progress.get("completedCities", 0)
                    total = progress.get("totalCities", 0)
                    
                    if current_city != last_city and current_city:
                        elapsed = int(time.time() - start_time)
                        avg_time = elapsed / max(completed, 1)
                        remaining = (total - completed) * avg_time
                        
                        print(f"📍 [{completed + 1}/{total}] {current_city} | "
                              f"Avg: {avg_time:.1f}s/city | "
                              f"ETA: {int(remaining/60)}m{int(remaining%60)}s")
                        last_city = current_city
                    
                    # Check if completed
                    if progress.get("completed", False):
                        total_time = int(time.time() - start_time)
                        print(f"\n🎉 Bulk scraping completed!")
                        print(f"⏱️  Total time: {total_time//60}m{total_time%60}s")
                        print(f"📊 Processed {total} cities")
                        break
                        
            except Exception as e:
                print(f"⚠️  Progress check error: {e}")
            
            time.sleep(2)
            
    except Exception as e:
        print(f"❌ Error running bulk scraper: {e}")

if __name__ == "__main__":
    print("HMO Bulk Scraper - Direct Runner")
    print("=" * 40)
    run_bulk_scraper()