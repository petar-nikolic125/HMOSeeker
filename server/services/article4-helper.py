#!/usr/bin/env python3
"""
Article 4 Helper - Python module to check Article 4 areas from cache
This is used by scraper.py to filter properties during scraping
"""

import json
import os
from pathlib import Path
from datetime import datetime, timedelta

class Article4Helper:
    def __init__(self):
        # Cache file path
        self.cache_dir = Path(__file__).parent.parent.parent / "cache"
        self.cache_file = self.cache_dir / "article4-areas.json"
        self.cache = None
        self.load_cache()
    
    def load_cache(self):
        """Load Article 4 cache from disk"""
        try:
            if not self.cache_file.exists():
                print("⚠️ No Article 4 cache found. Will use fallback detection.", flush=True)
                self.cache = None
                return
            
            with open(self.cache_file, 'r') as f:
                self.cache = json.load(f)
            
            # Check cache age
            last_updated = datetime.fromisoformat(self.cache['lastUpdated'].replace('Z', '+00:00'))
            age = datetime.now(last_updated.tzinfo) - last_updated
            
            if age > timedelta(hours=24):
                print(f"⚠️ Article 4 cache is {age.total_seconds() / 3600:.1f} hours old. Consider refreshing.", flush=True)
            else:
                print(f"✅ Article 4 cache loaded: {len(self.cache.get('areas', []))} Article 4 areas", flush=True)
                
        except Exception as e:
            print(f"❌ Error loading Article 4 cache: {e}", flush=True)
            self.cache = None
    
    def extract_postcode_district(self, postcode):
        """Extract postcode district (e.g., E1 from E1 6AN)"""
        if not postcode:
            return None
        
        # Remove spaces and convert to uppercase
        clean = postcode.replace(' ', '').upper()
        
        # Extract district part (e.g., E1, SW11, NW10)
        import re
        match = re.match(r'^([A-Z]{1,2}\d{1,2})', clean)
        if match:
            return match.group(1)
        return None
    
    def is_article4_area(self, address, postcode=None):
        """
        Check if property is in Article 4 area using cache.
        Returns True if property IS in Article 4 area (should be filtered out).
        """
        # If no cache, use fallback detection
        if not self.cache or not self.cache.get('areas'):
            return self._fallback_detection(address, postcode)
        
        # Extract postcode district
        district = None
        if postcode:
            district = self.extract_postcode_district(postcode)
        
        # If no postcode, try to extract from address
        if not district and address:
            # Try to find postcode pattern in address
            import re
            postcode_match = re.search(r'\b([A-Z]{1,2}\d{1,2}[A-Z]?)\s*\d[A-Z]{2}\b', address.upper())
            if postcode_match:
                district = self.extract_postcode_district(postcode_match.group(0))
        
        if not district:
            return False
        
        # Check against cache
        for area in self.cache['areas']:
            area_district = self.extract_postcode_district(area.get('postcode', ''))
            if area_district == district:
                return True
        
        return False
    
    def _fallback_detection(self, address, postcode=None):
        """
        Fallback Article 4 detection using address/postcode patterns.
        This is less accurate but works without API cache.
        """
        if not address:
            return False
        
        address_upper = address.upper()
        
        # Known Article 4 boroughs
        article4_boroughs = [
            "BARKING AND DAGENHAM", "BARNET", "BEXLEY", "BRENT", "CROYDON", "ENFIELD",
            "HARINGEY", "HARROW", "HOUNSLOW", "NEWHAM", "REDBRIDGE", "WALTHAM FOREST",
            "HACKNEY", "ISLINGTON", "TOWER HAMLETS", "CAMDEN", "LAMBETH", "SOUTHWARK",
            "LEWISHAM", "GREENWICH", "EALING", "HAMMERSMITH AND FULHAM", "WANDSWORTH"
        ]
        
        # Check if any borough name is in address
        for borough in article4_boroughs:
            if borough in address_upper:
                return True
        
        # Check postcode districts known to have Article 4
        if postcode:
            district = self.extract_postcode_district(postcode)
            if district:
                article4_districts = {
                    'E1', 'E2', 'E3', 'E5', 'E8', 'E9', 'E10', 'E11', 'E14', 'E15', 'E17',
                    'N1', 'N4', 'N5', 'N7', 'N8', 'N15', 'N16', 'N17', 'N19', 'N22',
                    'NW1', 'NW3', 'NW5', 'NW6', 'NW8', 'NW10',
                    'SE1', 'SE4', 'SE5', 'SE8', 'SE10', 'SE11', 'SE13', 'SE14', 'SE15', 'SE16', 'SE17', 'SE21', 'SE22', 'SE23', 'SE24',
                    'SW2', 'SW4', 'SW8', 'SW9', 'SW11', 'SW12', 'SW16',
                    'W2', 'W3', 'W6', 'W9', 'W10', 'W11', 'W12', 'W14',
                    'BR1', 'BR2', 'BR3', 'CR0', 'CR4', 'CR7', 'CR8',
                    'EN1', 'EN2', 'EN3', 'HA0', 'HA1', 'HA3', 'HA8', 'HA9',
                    'IG1', 'IG2', 'IG3', 'IG6', 'IG11',
                    'RM6', 'RM8', 'RM9', 'RM10',
                    'TW3', 'TW7', 'TW8',
                    'UB1', 'UB2', 'UB3', 'UB4', 'UB5', 'UB6'
                }
                return district in article4_districts
        
        return False

# Global instance
_article4_helper = None

def get_article4_helper():
    """Get global Article4Helper instance"""
    global _article4_helper
    if _article4_helper is None:
        _article4_helper = Article4Helper()
    return _article4_helper

def is_article4_area(address, postcode=None):
    """
    Check if property is in Article 4 area.
    This is the main function used by scraper.py
    """
    helper = get_article4_helper()
    return helper.is_article4_area(address, postcode)
