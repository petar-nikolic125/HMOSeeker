import { ScraperManager } from "./scraper-manager";
import { CacheDatabase } from "./cache-database";
import fs from 'fs/promises';
import path from 'path';

/**
 * Sync Scraper - synchronizes cache with current PrimeLocation listings
 * Deletes outdated properties and adds new ones
 */
export class SyncScraper {
  
  private static readonly CACHE_DIR = 'cache/primelocation';
  private static syncRunning = false;
  private static progress = {
    current: 0,
    total: 0,
    currentCity: '',
    status: 'idle' as 'idle' | 'running' | 'completed' | 'failed',
    removed: 0,
    added: 0,
    kept: 0
  };

  /**
   * Sync a single city with current PrimeLocation listings
   */
  static async syncCity(city: string): Promise<{
    success: boolean;
    removed: number;
    added: number;
    kept: number;
    total: number;
    error?: string;
  }> {
    console.log(`🔄 Syncing ${city} with current PrimeLocation listings...`);

    try {
      // 1. Get current live listings from PrimeLocation
      const liveResult = await ScraperManager.searchProperties({
        city: city,
        min_bedrooms: 1,
        max_price: 1500000,
        keywords: "hmo",
        refresh: true
      });

      if (!liveResult.success || !liveResult.listings) {
        throw new Error(`Failed to fetch live listings: ${liveResult.error}`);
      }

      // 2. Get current cached properties
      const cachedProperties = await CacheDatabase.getPropertiesForCity(city);
      
      // 3. Create lookup sets for comparison
      const liveUrls = new Set(liveResult.listings.map(p => p.property_url));
      const cachedUrls = new Set(cachedProperties.map(p => p.property_url));

      // 4. Determine what to keep, remove, and add
      const toKeep = cachedProperties.filter(p => liveUrls.has(p.property_url));
      const toAdd = liveResult.listings.filter(p => !cachedUrls.has(p.property_url));
      const removedCount = cachedProperties.length - toKeep.length;

      // 5. Create new synchronized dataset
      const syncedProperties = [
        ...toKeep, // Keep existing properties still available
        ...toAdd.map(prop => ({  // Add new properties
          address: prop.address,
          price: prop.price,
          bedrooms: prop.bedrooms,
          bathrooms: prop.bathrooms,
          description: prop.description,
          property_url: prop.property_url,
          image_url: prop.image_url,
          postcode: prop.postcode,
          city: city,
          monthly_rent: 400,
          annual_rent: 4800,
          gross_yield: prop.price > 0 ? (4800 / prop.price) * 100 : 0,
          listing_id: prop.property_url?.split('/').pop() || `sync-${Date.now()}`
        }))
      ];

      // 6. Replace all cache files with single synchronized file
      const cityDir = path.join(this.CACHE_DIR, city.toLowerCase().replace(/\s+/g, '-'));
      
      // Ensure directory exists
      await fs.mkdir(cityDir, { recursive: true });

      // Remove all old cache files
      try {
        const existingFiles = await fs.readdir(cityDir);
        const jsonFiles = existingFiles.filter(f => f.endsWith('.json'));
        
        for (const file of jsonFiles) {
          await fs.unlink(path.join(cityDir, file));
        }
      } catch (error) {
        console.log(`📁 No existing cache files to remove for ${city}`);
      }

      // Save new synchronized file
      const timestamp = Date.now();
      const syncFile = path.join(cityDir, `sync_${timestamp}.json`);
      await fs.writeFile(syncFile, JSON.stringify(syncedProperties, null, 2));

      console.log(`✅ Synced ${city}: ${removedCount} removed, ${toAdd.length} added, ${toKeep.length} kept`);

      return {
        success: true,
        removed: removedCount,
        added: toAdd.length,
        kept: toKeep.length,
        total: syncedProperties.length
      };

    } catch (error) {
      console.error(`❌ Error syncing ${city}:`, error);
      return {
        success: false,
        removed: 0,
        added: 0,
        kept: 0,
        total: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Sync all major UK cities with current listings
   */
  static async syncAllCities(): Promise<void> {
    if (this.syncRunning) {
      throw new Error("Sync is already running");
    }

    const UK_CITIES = [
      "London", "Birmingham", "Bristol", "Manchester", "Liverpool", 
      "Leeds", "Sheffield", "Newcastle", "Nottingham", "Leicester"
    ];

    this.syncRunning = true;
    this.progress = {
      current: 0,
      total: UK_CITIES.length,
      currentCity: '',
      status: 'running',
      removed: 0,
      added: 0,
      kept: 0
    };

    console.log(`🔄 Starting sync for ${UK_CITIES.length} cities...`);

    try {
      for (let i = 0; i < UK_CITIES.length; i++) {
        const city = UK_CITIES[i];
        this.progress.current = i + 1;
        this.progress.currentCity = city;

        const result = await this.syncCity(city);
        
        if (result.success) {
          this.progress.removed += result.removed;
          this.progress.added += result.added;
          this.progress.kept += result.kept;
        }

        // Small delay between cities
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      this.progress.status = 'completed';
      console.log(`✅ Sync completed: ${this.progress.removed} removed, ${this.progress.added} added, ${this.progress.kept} kept`);

    } catch (error) {
      this.progress.status = 'failed';
      console.error('❌ Sync failed:', error);
      throw error;
    } finally {
      this.syncRunning = false;
    }
  }

  /**
   * Get current sync progress
   */
  static getProgress() {
    return { ...this.progress };
  }

  /**
   * Check if sync is currently running
   */
  static isSyncRunning() {
    return this.syncRunning;
  }
}