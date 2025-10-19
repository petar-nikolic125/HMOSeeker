import { article4MapsApiService } from './article4maps-api-service';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface Article4CachedArea {
  postcode: string;
  inArticle4: boolean;
  council: string;
  areaName: string;
  reference: string;
  checkedAt: string;
}

interface Article4Cache {
  lastUpdated: string;
  areas: Article4CachedArea[];
  stats: {
    totalChecked: number;
    article4Count: number;
    nonArticle4Count: number;
  };
}

/**
 * Article 4 Cache Service
 * Minimizes API calls by caching Article 4 area data
 * Refreshes once per day
 */
export class Article4CacheService {
  private readonly CACHE_FILE = join(__dirname, '..', '..', 'cache', 'article4-areas.json');
  private readonly CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
  private cache: Article4Cache | null = null;
  private loading: Promise<Article4Cache> | null = null;

  constructor() {
    this.ensureCacheDirectory();
  }

  private async ensureCacheDirectory(): Promise<void> {
    const dir = dirname(this.CACHE_FILE);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
  }

  /**
   * Load cache from disk
   */
  private async loadCache(): Promise<Article4Cache | null> {
    try {
      if (!existsSync(this.CACHE_FILE)) {
        return null;
      }

      const content = await readFile(this.CACHE_FILE, 'utf-8');
      const cache = JSON.parse(content) as Article4Cache;

      // Check if cache is stale
      const lastUpdated = new Date(cache.lastUpdated);
      const age = Date.now() - lastUpdated.getTime();

      if (age > this.CACHE_DURATION_MS) {
        console.log('📅 Article 4 cache is stale, needs refresh');
        return null;
      }

      return cache;
    } catch (error) {
      console.error('❌ Failed to load Article 4 cache:', error);
      return null;
    }
  }

  /**
   * Save cache to disk
   */
  private async saveCache(cache: Article4Cache): Promise<void> {
    try {
      await this.ensureCacheDirectory();
      await writeFile(this.CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
      console.log(`✅ Saved Article 4 cache with ${cache.areas.length} areas`);
    } catch (error) {
      console.error('❌ Failed to save Article 4 cache:', error);
    }
  }

  /**
   * Get common London postcodes to check
   */
  private getLondonPostcodesToCheck(): string[] {
    // List of major London postcode districts to check
    // This covers the main areas where Article 4 restrictions exist
    return [
      // Inner London
      'E1', 'E2', 'E3', 'E5', 'E8', 'E9', 'E10', 'E11', 'E14', 'E15', 'E17',
      'N1', 'N4', 'N5', 'N7', 'N8', 'N15', 'N16', 'N17', 'N19', 'N22',
      'NW1', 'NW3', 'NW5', 'NW6', 'NW8', 'NW10',
      'SE1', 'SE4', 'SE5', 'SE8', 'SE10', 'SE11', 'SE13', 'SE14', 'SE15', 'SE16', 'SE17', 'SE21', 'SE22', 'SE23', 'SE24',
      'SW2', 'SW4', 'SW8', 'SW9', 'SW11', 'SW12', 'SW16',
      'W2', 'W3', 'W6', 'W9', 'W10', 'W11', 'W12', 'W14',
      
      // Outer London boroughs with Article 4
      'BR1', 'BR2', 'BR3', // Bromley
      'CR0', 'CR4', 'CR7', 'CR8', // Croydon
      'EN1', 'EN2', 'EN3', // Enfield
      'HA0', 'HA1', 'HA3', 'HA8', 'HA9', // Brent/Harrow
      'IG1', 'IG2', 'IG3', 'IG6', 'IG11', // Barking & Dagenham
      'RM6', 'RM8', 'RM9', 'RM10', // Barking & Dagenham
      'TW3', 'TW7', 'TW8', // Hounslow
      'UB1', 'UB2', 'UB3', 'UB4', 'UB5', 'UB6', // Ealing
      'WD6', 'WD23', // Borehamwood
    ];
  }

  /**
   * Refresh the cache with latest Article 4 data
   */
  public async refreshCache(): Promise<Article4Cache> {
    console.log('🔄 Refreshing Article 4 cache...');

    if (!article4MapsApiService.isConfigured()) {
      throw new Error('Article4Maps API key not configured');
    }

    // Get API usage stats first
    const stats = await article4MapsApiService.getUsageStats();
    if (stats) {
      console.log(`📊 API Usage: ${stats.calls_used}/${stats.calls_remaining + stats.calls_used} calls this month`);
      
      if (stats.calls_remaining < 50) {
        console.warn('⚠️ Low API calls remaining! Consider reducing cache refresh frequency.');
      }
    }

    const postcodesToCheck = this.getLondonPostcodesToCheck();
    console.log(`🔍 Checking ${postcodesToCheck.length} postcodes for Article 4 status...`);

    const areas: Article4CachedArea[] = [];
    let article4Count = 0;
    let nonArticle4Count = 0;

    // Check postcodes in batches to avoid overwhelming the API
    const batchSize = 10;
    for (let i = 0; i < postcodesToCheck.length; i += batchSize) {
      const batch = postcodesToCheck.slice(i, i + batchSize);
      
      try {
        const results = await Promise.all(
          batch.map(async (postcode) => {
            try {
              // Add a small delay between requests to be polite
              await new Promise(resolve => setTimeout(resolve, 100));
              return await article4MapsApiService.checkArticle4(postcode);
            } catch (error) {
              console.error(`❌ Error checking ${postcode}:`, error);
              return null;
            }
          })
        );

        for (const result of results) {
          if (!result) continue;

          if (result.inArticle4) {
            article4Count++;
            areas.push({
              postcode: result.postcode || '',
              inArticle4: true,
              council: result.areas[0]?.council || 'Unknown',
              areaName: result.areas[0]?.name || 'Article 4 Area',
              reference: result.areas[0]?.reference || '',
              checkedAt: new Date().toISOString()
            });
          } else {
            nonArticle4Count++;
          }
        }

        console.log(`✓ Checked batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(postcodesToCheck.length / batchSize)}`);
      } catch (error) {
        console.error(`❌ Error processing batch:`, error);
      }
    }

    const cache: Article4Cache = {
      lastUpdated: new Date().toISOString(),
      areas,
      stats: {
        totalChecked: postcodesToCheck.length,
        article4Count,
        nonArticle4Count
      }
    };

    await this.saveCache(cache);
    this.cache = cache;

    console.log(`✅ Cache refreshed: ${article4Count} Article 4 areas, ${nonArticle4Count} non-Article 4 areas`);

    return cache;
  }

  /**
   * Get the current cache (load from disk if needed)
   */
  public async getCache(): Promise<Article4Cache> {
    // If already loading, wait for that
    if (this.loading) {
      return this.loading;
    }

    // If cache in memory, return it
    if (this.cache) {
      return this.cache;
    }

    // Load from disk
    this.loading = (async () => {
      const cached = await this.loadCache();
      
      if (cached) {
        this.cache = cached;
        return cached;
      }

      // No valid cache, refresh it
      return await this.refreshCache();
    })();

    const result = await this.loading;
    this.loading = null;
    return result;
  }

  /**
   * Check if a postcode is in an Article 4 area (using cache)
   */
  public async isArticle4Area(postcode: string): Promise<boolean> {
    if (!postcode) return false;

    const cache = await this.getCache();
    const cleanPostcode = postcode.replace(/\s/g, '').toUpperCase();

    // Extract postcode district (e.g., "E1" from "E1 6AN")
    const district = cleanPostcode.match(/^([A-Z]{1,2}\d{1,2})/)?.[1];
    
    if (!district) return false;

    // Check if this district is in our Article 4 cache
    return cache.areas.some(area => {
      const areaDistrict = area.postcode.replace(/\s/g, '').toUpperCase().match(/^([A-Z]{1,2}\d{1,2})/)?.[1];
      return areaDistrict === district;
    });
  }

  /**
   * Get cache statistics
   */
  public async getStats(): Promise<{
    lastUpdated: string;
    age_hours: number;
    totalAreas: number;
    article4Count: number;
    nonArticle4Count: number;
  }> {
    const cache = await this.getCache();
    const age = Date.now() - new Date(cache.lastUpdated).getTime();
    const ageHours = Math.floor(age / (1000 * 60 * 60));

    return {
      lastUpdated: cache.lastUpdated,
      age_hours: ageHours,
      totalAreas: cache.stats.totalChecked,
      article4Count: cache.stats.article4Count,
      nonArticle4Count: cache.stats.nonArticle4Count
    };
  }
}

export const article4CacheService = new Article4CacheService();
