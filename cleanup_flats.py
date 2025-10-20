#!/usr/bin/env python3
"""
Clean up flats from cache files - keep only houses
"""
import json
import os
from pathlib import Path

def cleanup_flats_from_cache():
    """Remove all flat properties from cache files, keeping only houses"""
    cache_dir = Path("cache/primelocation")
    
    if not cache_dir.exists():
        print(f"❌ Cache directory not found: {cache_dir}")
        return
    
    total_files = 0
    total_properties_before = 0
    total_properties_after = 0
    total_flats_removed = 0
    
    # Process all JSON files in all city subdirectories
    for json_file in cache_dir.rglob("*.json"):
        if json_file.is_file():
            total_files += 1
            
            try:
                # Read the file
                with open(json_file, 'r', encoding='utf-8') as f:
                    properties = json.load(f)
                
                if not isinstance(properties, list):
                    print(f"⚠️  Skipping {json_file} - not a list")
                    continue
                
                before_count = len(properties)
                total_properties_before += before_count
                
                # Filter out flats - keep only houses and unknown types
                houses_only = [
                    prop for prop in properties 
                    if prop.get('property_type', '').lower() not in ['flat', 'apartment', 'maisonette']
                ]
                
                after_count = len(houses_only)
                total_properties_after += after_count
                flats_removed = before_count - after_count
                total_flats_removed += flats_removed
                
                if flats_removed > 0:
                    # Write back only houses
                    with open(json_file, 'w', encoding='utf-8') as f:
                        json.dump(houses_only, f, indent=2, ensure_ascii=False)
                    
                    print(f"✅ {json_file.relative_to(cache_dir)}: {before_count} → {after_count} ({flats_removed} flats removed)")
                else:
                    print(f"✓  {json_file.relative_to(cache_dir)}: {before_count} properties (no flats)")
                    
            except json.JSONDecodeError as e:
                print(f"❌ Error reading {json_file}: {e}")
            except Exception as e:
                print(f"❌ Error processing {json_file}: {e}")
    
    print("\n" + "="*60)
    print(f"📊 Cleanup Summary:")
    print(f"   Files processed: {total_files}")
    print(f"   Total properties before: {total_properties_before:,}")
    print(f"   Total properties after: {total_properties_after:,}")
    print(f"   🗑️  Total flats removed: {total_flats_removed:,}")
    print(f"   📉 Reduction: {(total_flats_removed/total_properties_before*100) if total_properties_before > 0 else 0:.1f}%")
    print("="*60)

if __name__ == "__main__":
    print("🧹 Cleaning up flats from cache files...")
    print("Keeping only: houses, terraced, semi-detached, detached, bungalow, cottage")
    print("Removing: flats, apartments, maisonettes\n")
    
    cleanup_flats_from_cache()
    
    print("\n✅ Cleanup complete!")
