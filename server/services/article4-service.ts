import fs from 'fs';
import path from 'path';
import cron from 'node-cron';
import { booleanPointInPolygon } from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';

interface Article4Area {
  name: string;
  council: string;
  reference: string;
  geometry: any; // GeoJSON Feature
}

interface PostcodeResponse {
  status: number;
  result: {
    postcode: string;
    latitude: number;
    longitude: number;
  } | null;
}

interface Article4Response {
  inArticle4: boolean;
  areas: Array<{
    name: string;
    council: string;
    reference: string;
  }>;
  lat: number;
  lon: number;
  postcode?: string;
}

class Article4Service {
  private article4Areas: Article4Area[] = [];
  private cacheTimestamp: Date | null = null;
  private readonly CACHE_TTL_HOURS = 24; // Refresh daily
  private readonly CACHE_FILE_PATH = path.join(process.cwd(), 'cache', 'article4-areas.json');
  private readonly GEOJSON_URL = process.env.ARTICLE4_GEOJSON_URL || 
    'https://raw.githubusercontent.com/digital-land/article-4-direction-area-collection/main/collection/article-4-direction-area.geojson';

  constructor() {
    this.initializeCache();
    this.scheduleDailyRefresh();
  }

  private async initializeCache(): Promise<void> {
    try {
      // Try to load from cache file first
      if (await this.loadFromCacheFile()) {
        console.log('📂 Article 4 areas loaded from cache file');
        return;
      }

      // If no cache file, fetch fresh data
      await this.refreshCache();
    } catch (error) {
      console.error('❌ Failed to initialize Article 4 cache:', error);
    }
  }

  private async loadFromCacheFile(): Promise<boolean> {
    try {
      if (!fs.existsSync(this.CACHE_FILE_PATH)) {
        return false;
      }

      const cacheData = JSON.parse(fs.readFileSync(this.CACHE_FILE_PATH, 'utf-8'));
      const cacheAge = Date.now() - new Date(cacheData.timestamp).getTime();
      const isExpired = cacheAge > (this.CACHE_TTL_HOURS * 60 * 60 * 1000);

      if (isExpired) {
        console.log('⏰ Cache file expired, will refresh');
        return false;
      }

      this.article4Areas = cacheData.areas;
      this.cacheTimestamp = new Date(cacheData.timestamp);
      return true;
    } catch (error) {
      console.error('❌ Failed to load cache file:', error);
      return false;
    }
  }

  private async saveToCacheFile(): Promise<void> {
    try {
      const cacheDir = path.dirname(this.CACHE_FILE_PATH);
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }

      const cacheData = {
        timestamp: this.cacheTimestamp?.toISOString(),
        areas: this.article4Areas,
        count: this.article4Areas.length
      };

      fs.writeFileSync(this.CACHE_FILE_PATH, JSON.stringify(cacheData, null, 2));
      console.log(`💾 Article 4 cache saved to file (${this.article4Areas.length} areas)`);
    } catch (error) {
      console.error('❌ Failed to save cache file:', error);
    }
  }

  public async refreshCache(): Promise<void> {
    try {
      console.log('🔄 Refreshing Article 4 areas from planning.data.gov.uk...');
      
      const response = await fetch(this.GEOJSON_URL);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const geoJsonData = await response.json();
      
      if (!geoJsonData.features || !Array.isArray(geoJsonData.features)) {
        throw new Error('Invalid GeoJSON format');
      }

      this.article4Areas = geoJsonData.features
        .filter((feature: any) => 
          feature.geometry && 
          (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon')
        )
        .map((feature: any) => ({
          name: feature.properties?.name || feature.properties?.title || 'Unknown Area',
          council: feature.properties?.organisation || feature.properties?.council || 'Unknown Council',
          reference: feature.properties?.reference || feature.properties?.id || 'No Reference',
          geometry: {
            type: 'Feature',
            properties: feature.properties,
            geometry: feature.geometry
          }
        }));

      this.cacheTimestamp = new Date();
      await this.saveToCacheFile();
      
      console.log(`✅ Article 4 cache refreshed: ${this.article4Areas.length} areas loaded`);
    } catch (error) {
      console.error('❌ Failed to refresh Article 4 cache:', error);
      throw error;
    }
  }

  private scheduleDailyRefresh(): void {
    // Run daily at 3 AM
    cron.schedule('0 3 * * *', async () => {
      console.log('🕐 Scheduled Article 4 cache refresh starting...');
      try {
        await this.refreshCache();
      } catch (error) {
        console.error('❌ Scheduled cache refresh failed:', error);
      }
    });
  }

  public async geocodePostcode(postcode: string): Promise<{ lat: number; lon: number } | null> {
    try {
      const cleanPostcode = postcode.replace(/\s/g, '').toUpperCase();
      const response = await fetch(`https://api.postcodes.io/postcodes/${cleanPostcode}`);
      
      if (!response.ok) {
        console.log(`⚠️ Postcode ${postcode} not found`);
        return null;
      }

      const data: PostcodeResponse = await response.json();
      if (data.result) {
        return {
          lat: data.result.latitude,
          lon: data.result.longitude
        };
      }
      
      return null;
    } catch (error) {
      console.error('❌ Postcode geocoding failed:', error);
      return null;
    }
  }

  public async checkArticle4(postcode: string): Promise<Article4Response> {
    // Geocode the postcode
    const coordinates = await this.geocodePostcode(postcode);
    if (!coordinates) {
      throw new Error(`Invalid or unknown postcode: ${postcode}`);
    }

    const { lat, lon } = coordinates;
    const searchPoint = point([lon, lat]);

    // Find all overlapping Article 4 areas
    const overlappingAreas: Array<{
      name: string;
      council: string;
      reference: string;
    }> = [];

    for (const area of this.article4Areas) {
      try {
        const isInside = booleanPointInPolygon(searchPoint, area.geometry);
        if (isInside) {
          overlappingAreas.push({
            name: area.name,
            council: area.council,
            reference: area.reference
          });
        }
      } catch (error) {
        // Skip invalid geometries
        console.warn(`⚠️ Skipping invalid geometry for area: ${area.name}`);
        continue;
      }
    }

    return {
      inArticle4: overlappingAreas.length > 0,
      areas: overlappingAreas,
      lat,
      lon,
      postcode: postcode.toUpperCase()
    };
  }

  public getCacheInfo(): { age: number; count: number; lastRefresh: Date | null } {
    const age = this.cacheTimestamp 
      ? Math.floor((Date.now() - this.cacheTimestamp.getTime()) / (1000 * 60 * 60))
      : -1;

    return {
      age,
      count: this.article4Areas.length,
      lastRefresh: this.cacheTimestamp
    };
  }

  public async checkPostcodesIoHealth(): Promise<boolean> {
    try {
      const response = await fetch('https://api.postcodes.io/postcodes/SW1A1AA');
      return response.ok;
    } catch {
      return false;
    }
  }
}

export const article4Service = new Article4Service();