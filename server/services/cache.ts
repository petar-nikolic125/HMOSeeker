import { storage } from "../storage";
import type { PropertyListing, SearchFilters } from "@shared/schema";

export class PropertyCache {
  private static readonly CACHE_TTL_HOURS = 2;
  private static readonly CACHE_PREFIX = "property_search:";

  private static getCacheKey(filters: SearchFilters): string {
    const key = `${this.CACHE_PREFIX}${filters.city}:${filters.max_price || 'any'}:${filters.min_bedrooms || 'any'}`;
    return key.toLowerCase();
  }

  static async get(filters: SearchFilters): Promise<PropertyListing[] | null> {
    const cacheKey = this.getCacheKey(filters);
    const entry = await storage.getCacheEntry(cacheKey);
    
    if (entry) {
      const data = entry.data as { listings: PropertyListing[] };
      return data.listings;
    }
    
    return null;
  }

  static async set(filters: SearchFilters, listings: PropertyListing[]): Promise<void> {
    const cacheKey = this.getCacheKey(filters);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.CACHE_TTL_HOURS);
    
    await storage.setCacheEntry(cacheKey, { listings }, expiresAt);
  }

  static async clear(filters: SearchFilters): Promise<void> {
    const cacheKey = this.getCacheKey(filters);
    await storage.deleteCacheEntry(cacheKey);
  }

  static async clearAll(): Promise<void> {
    await storage.cleanExpiredCache();
  }

  static async isExpired(filters: SearchFilters): Promise<boolean> {
    const cacheKey = this.getCacheKey(filters);
    const entry = await storage.getCacheEntry(cacheKey);
    return !entry;
  }
}
