#!/usr/bin/env python3
"""
Property Image Updater for Cached Properties

This script updates existing cached property JSON files with better image URLs
based on property characteristics like type, bedrooms, and location.

Usage: python update_property_images.py
"""

import json
import os
import glob
import re
from typing import Dict, Any

def get_smart_property_image(property_data: Dict[str, Any]) -> str:
    """
    Generate an appropriate image URL based on property characteristics.
    """
    address = property_data.get('address', '').lower()
    title = property_data.get('title', property_data.get('address', '')).lower()
    bedrooms = property_data.get('bedrooms', 3)
    
    # Analyze property type from address and title
    is_flat = 'flat' in address or 'flat' in title or 'apartment' in address or 'apartment' in title
    is_detached = 'detached' in address or 'detached' in title
    is_terraced = 'terrace' in address or 'terrace' in title or 'terraced' in address or 'terraced' in title
    is_semi = 'semi' in address or 'semi-detached' in title
    is_bungalow = 'bungalow' in address or 'bungalow' in title
    is_cottage = 'cottage' in address or 'cottage' in title
    is_mansion = 'mansion' in address or 'mansion' in title or bedrooms >= 6
    
    # High-quality property images from Unsplash with consistent sizing
    images = {
        # Large properties (5+ bedrooms)
        'mansion': "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&h=600&fit=crop&crop=center&q=85",
        'detached_large': "https://images.unsplash.com/photo-1449844908441-8829872d2607?w=800&h=600&fit=crop&crop=center&q=85",
        
        # Medium detached houses (3-4 bedrooms)  
        'detached_medium': "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800&h=600&fit=crop&crop=center&q=85",
        
        # Terraced houses
        'terraced': "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&h=600&fit=crop&crop=center&q=85",
        'terraced_period': "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=600&fit=crop&crop=center&q=85",
        
        # Semi-detached houses
        'semi_detached': "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&h=600&fit=crop&crop=center&q=85",
        
        # Flats/apartments
        'flat_modern': "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&h=600&fit=crop&crop=center&q=85",
        'flat_period': "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=600&fit=crop&crop=center&q=85",
        'flat_luxury': "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&h=600&fit=crop&crop=center&q=85",
        
        # Special property types
        'bungalow': "https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=800&h=600&fit=crop&crop=center&q=85",
        'cottage': "https://images.unsplash.com/photo-1523217582562-09d0def993a6?w=800&h=600&fit=crop&crop=center&q=85",
        
        # Default fallback
        'default': "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&h=600&fit=crop&crop=center&q=85"
    }
    
    # Property type selection logic
    if is_mansion or bedrooms >= 6:
        return images['mansion']
    elif is_cottage:
        return images['cottage']
    elif is_bungalow:
        return images['bungalow']
    elif is_flat:
        if bedrooms >= 4:
            return images['flat_luxury']
        elif bedrooms >= 3:
            return images['flat_modern'] 
        else:
            return images['flat_period']
    elif is_detached:
        return images['detached_large'] if bedrooms >= 4 else images['detached_medium']
    elif is_terraced:
        # Use period terraced for London properties or if indicators suggest period
        is_period = ('london' in address or 'victorian' in address or 'period' in address or
                    'georgian' in address or 'edwardian' in address)
        return images['terraced_period'] if is_period else images['terraced']
    elif is_semi:
        return images['semi_detached']
    else:
        # Default based on bedroom count
        if bedrooms >= 5:
            return images['detached_large']
        elif bedrooms >= 4:
            return images['detached_medium']
        else:
            return images['semi_detached']

def update_cache_file(file_path: str) -> int:
    """
    Update a single cache file with better images.
    Returns the number of properties updated.
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            properties = json.load(f)
        
        if not isinstance(properties, list):
            print(f"Skipping {file_path}: Not a list of properties")
            return 0
        
        updated_count = 0
        for prop in properties:
            if isinstance(prop, dict):
                # Update image URL with smart selection
                new_image_url = get_smart_property_image(prop)
                old_image_url = prop.get('image_url', '')
                
                # Only update if current image is placeholder or generic
                if (not old_image_url or 
                    old_image_url.startswith('https://images.unsplash.com/photo-1560518883-ce09059eeffa') or
                    'placeholder' in old_image_url.lower() or
                    old_image_url == new_image_url):
                    
                    prop['image_url'] = new_image_url
                    updated_count += 1
        
        if updated_count > 0:
            # Write back to file
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(properties, f, indent=2, ensure_ascii=False)
            
            print(f"✅ Updated {updated_count} properties in {os.path.basename(file_path)}")
        else:
            print(f"📋 No updates needed for {os.path.basename(file_path)}")
        
        return updated_count
        
    except Exception as e:
        print(f"❌ Error processing {file_path}: {e}")
        return 0

def main():
    """
    Main function to update all cached property files.
    """
    print("🚀 Starting Property Image Update...")
    
    # Find all JSON cache files
    cache_pattern = "cache/primelocation/*/*.json"
    cache_files = glob.glob(cache_pattern)
    
    if not cache_files:
        print("❌ No cache files found in cache/primelocation/")
        return
    
    total_updated = 0
    total_files = 0
    
    for file_path in sorted(cache_files):
        total_files += 1
        updated = update_cache_file(file_path)
        total_updated += updated
    
    print(f"\n🎉 Image update completed!")
    print(f"📊 Files processed: {total_files}")
    print(f"🖼️ Properties updated: {total_updated}")
    
    if total_updated > 0:
        print("\n✨ Property images have been enhanced with smart selection based on:")
        print("   • Property type (flat, detached, terraced, etc.)")
        print("   • Bedroom count")
        print("   • Location characteristics")
        print("   • Architectural style indicators")

if __name__ == "__main__":
    main()