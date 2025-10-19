interface PostcodeData {
  latitude: number;
  longitude: number;
  postcode: string;
  admin_district?: string;
  country?: string;
}

export class PostcodeGeocoder {
  private static cache = new Map<string, PostcodeData>();
  
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
    postcode: string,
    radiusMiles: number
  ): Promise<any[]> {
    console.log(`📍 Filtering properties within ${radiusMiles} miles of ${postcode}`);
    
    const MAX_PROPERTIES_FOR_RADIUS = 100;
    if (properties.length > MAX_PROPERTIES_FOR_RADIUS) {
      console.log(`⚠️  Too many properties (${properties.length}) for radius search. Please narrow your search with price/bedroom filters first.`);
      console.log(`📋 Limiting radius search to first ${MAX_PROPERTIES_FOR_RADIUS} properties`);
      properties = properties.slice(0, MAX_PROPERTIES_FOR_RADIUS);
    }
    
    const centerPoint = await this.geocode(postcode);
    
    if (!centerPoint) {
      console.error(`❌ Could not geocode postcode: ${postcode}`);
      return properties;
    }
    
    console.log(`✅ Center point: ${centerPoint.latitude}, ${centerPoint.longitude}`);
    
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
          center_postcode: postcode,
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
