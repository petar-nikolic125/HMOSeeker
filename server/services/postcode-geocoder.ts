interface PostcodeData {
  latitude: number;
  longitude: number;
  postcode: string;
  admin_district?: string;
  country?: string;
}

interface LocationData {
  latitude: number;
  longitude: number;
  display_name: string;
  type: 'postcode' | 'city' | 'address';
}

export class PostcodeGeocoder {
  private static cache = new Map<string, PostcodeData>();
  private static locationCache = new Map<string, LocationData>();
  private static lastNominatimCall = 0;
  
  /**
   * Rate limiter for Nominatim API (max 1 req/sec as per their usage policy)
   */
  private static async waitForNominatimRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastNominatimCall;
    const minInterval = 1000; // 1 second
    
    if (timeSinceLastCall < minInterval) {
      const waitTime = minInterval - timeSinceLastCall;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastNominatimCall = Date.now();
  }
  
  /**
   * Geocode any location: postcode, city name, or address
   * This intelligently detects the input type and uses the appropriate API
   */
  static async geocodeLocation(location: string): Promise<LocationData | null> {
    const cleanLocation = location.trim();
    
    // Check cache first
    if (this.locationCache.has(cleanLocation.toUpperCase())) {
      return this.locationCache.get(cleanLocation.toUpperCase())!;
    }
    
    // Try postcode first (UK postcode pattern, including short outcodes like "M7")
    const postcodePattern = /^[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9]?[A-Z]{0,2}$/i;
    if (postcodePattern.test(cleanLocation.replace(/\s+/g, ''))) {
      const postcodeData = await this.geocode(cleanLocation);
      if (postcodeData) {
        const locationData: LocationData = {
          latitude: postcodeData.latitude,
          longitude: postcodeData.longitude,
          display_name: postcodeData.postcode,
          type: 'postcode'
        };
        this.locationCache.set(cleanLocation.toUpperCase(), locationData);
        return locationData;
      }
    }
    
    // Require minimum length for city/address lookups to avoid wasteful Nominatim calls
    if (cleanLocation.length < 3) {
      return null;
    }
    
    // Try Nominatim (OpenStreetMap) for city names and addresses
    // Rate limit: max 1 req/sec
    await this.waitForNominatimRateLimit();
    
    try {
      const encodedLocation = encodeURIComponent(cleanLocation);
      const url = `https://nominatim.openstreetmap.org/search?q=${encodedLocation}&countrycodes=gb&format=json&limit=1`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'HMO-Hunter-PropertyApp/1.0'
        }
      });
      
      if (!response.ok) {
        return null;
      }
      
      const results = await response.json();
      
      if (results && results.length > 0) {
        const result = results[0];
        const locationData: LocationData = {
          latitude: parseFloat(result.lat),
          longitude: parseFloat(result.lon),
          display_name: result.display_name,
          type: result.type === 'city' || result.type === 'town' ? 'city' : 'address'
        };
        this.locationCache.set(cleanLocation.toUpperCase(), locationData);
        console.log(`✅ Geocoded "${cleanLocation}" via Nominatim: ${locationData.latitude}, ${locationData.longitude}`);
        return locationData;
      }
      
      return null;
    } catch (error) {
      console.error(`Error geocoding location ${cleanLocation}:`, error);
      return null;
    }
  }
  
  static async geocode(postcode: string): Promise<PostcodeData | null> {
    const cleanPostcode = postcode.toUpperCase().replace(/\s+/g, '');
    
    if (this.cache.has(cleanPostcode)) {
      return this.cache.get(cleanPostcode)!;
    }
    
    try {
      const encodedPostcode = encodeURIComponent(postcode);
      const url = `https://api.postcodes.io/postcodes/${encodedPostcode}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const outcode = postcode.split(' ')[0];
        const outcodeUrl = `https://api.postcodes.io/outcodes/${encodeURIComponent(outcode)}`;
        const outcodeResponse = await fetch(outcodeUrl);
        
        if (outcodeResponse.ok) {
          const outcodeData = await outcodeResponse.json();
          if (outcodeData.result) {
            const data: PostcodeData = {
              latitude: outcodeData.result.latitude,
              longitude: outcodeData.result.longitude,
              postcode: outcode,
              admin_district: outcodeData.result.admin_district,
              country: outcodeData.result.country,
            };
            this.cache.set(cleanPostcode, data);
            return data;
          }
        }
        
        return null;
      }
      
      const result = await response.json();
      
      if (result.result) {
        const data: PostcodeData = {
          latitude: result.result.latitude,
          longitude: result.result.longitude,
          postcode: result.result.postcode,
          admin_district: result.result.admin_district,
          country: result.result.country,
        };
        this.cache.set(cleanPostcode, data);
        return data;
      }
      
      return null;
    } catch (error) {
      console.error(`Error geocoding postcode ${postcode}:`, error);
      return null;
    }
  }
  
  static extractPostcode(address: string): string | null {
    const postcodePatterns = [
      /\b([A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2})\b/i,
      /\b([A-Z]{1,2}[0-9][A-Z0-9]?)\b/i,
    ];
    
    for (const pattern of postcodePatterns) {
      const match = address.match(pattern);
      if (match) {
        return match[1].replace(/\s+/g, '').toUpperCase();
      }
    }
    
    return null;
  }
  
  static calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 3959;
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return distance;
  }
  
  private static toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }
  
  static async filterPropertiesByRadius(
    properties: any[],
    location: string,
    radiusMiles: number
  ): Promise<any[]> {
    console.log(`📍 Filtering properties within ${radiusMiles} miles of "${location}"`);
    
    const MAX_PROPERTIES_FOR_RADIUS = 100;
    if (properties.length > MAX_PROPERTIES_FOR_RADIUS) {
      console.log(`⚠️  Too many properties (${properties.length}) for radius search. Please narrow your search with price/bedroom filters first.`);
      console.log(`📋 Limiting radius search to first ${MAX_PROPERTIES_FOR_RADIUS} properties`);
      properties = properties.slice(0, MAX_PROPERTIES_FOR_RADIUS);
    }
    
    // Use the new geocodeLocation method that supports postcodes, cities, and addresses
    const centerPoint = await this.geocodeLocation(location);
    
    if (!centerPoint) {
      console.error(`❌ Could not geocode location: ${location}`);
      return properties;
    }
    
    console.log(`✅ Center point for "${location}": ${centerPoint.latitude}, ${centerPoint.longitude} (${centerPoint.type})`);
    
    const uniquePostcodes = new Map<string, { lat: number; lon: number }>();
    const propertiesWithDistances = [];
    let geocodedCount = 0;
    let withinRadiusCount = 0;
    let skippedNoPostcode = 0;
    
    for (const property of properties) {
      const propertyPostcode =
        property.postcode || this.extractPostcode(property.address || property.title || '');
      
      if (!propertyPostcode) {
        skippedNoPostcode++;
        continue;
      }
      
      const outcode = propertyPostcode.split(' ')[0];
      
      let propertyLocation;
      if (uniquePostcodes.has(outcode)) {
        propertyLocation = uniquePostcodes.get(outcode)!;
      } else {
        const geocoded = await this.geocode(propertyPostcode);
        if (!geocoded) {
          continue;
        }
        propertyLocation = { lat: geocoded.latitude, lon: geocoded.longitude };
        uniquePostcodes.set(outcode, propertyLocation);
        geocodedCount++;
      }
      
      const distance = this.calculateDistance(
        centerPoint.latitude,
        centerPoint.longitude,
        propertyLocation.lat,
        propertyLocation.lon
      );
      
      if (distance <= radiusMiles) {
        propertiesWithDistances.push({
          ...property,
          distance_miles: parseFloat(distance.toFixed(2)),
          center_location: location,
        });
        withinRadiusCount++;
      }
    }
    
    propertiesWithDistances.sort((a, b) => (a.distance_miles || 0) - (b.distance_miles || 0));
    
    console.log(`📊 Radius filter results:`);
    console.log(`  Properties checked: ${properties.length}`);
    console.log(`  Unique postcodes geocoded: ${geocodedCount}`);
    console.log(`  Skipped (no postcode): ${skippedNoPostcode}`);
    console.log(`  Within ${radiusMiles} miles: ${withinRadiusCount}`);
    
    return propertiesWithDistances;
  }
}
