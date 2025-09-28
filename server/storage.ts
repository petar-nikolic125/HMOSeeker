import { type User, type InsertUser, type PropertyListing, type InsertPropertyListing, type SearchQuery, type InsertSearchQuery, type CacheEntry, type SearchFilters, users, propertyListings, searchQueries, cacheEntries } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, and, like, lte, gte, desc, isNull, or } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Property listing methods
  getPropertyListings(filters?: Partial<SearchFilters>): Promise<PropertyListing[]>;
  getPropertyListing(id: string): Promise<PropertyListing | undefined>;
  createPropertyListings(listings: InsertPropertyListing[]): Promise<PropertyListing[]>;
  deleteOldListings(olderThan: Date): Promise<void>;

  // Search query methods
  createSearchQuery(query: InsertSearchQuery): Promise<SearchQuery>;
  getSearchQuery(id: string): Promise<SearchQuery | undefined>;
  updateSearchQuery(id: string, updates: Partial<SearchQuery>): Promise<SearchQuery | undefined>;
  getActiveSearchQueries(): Promise<SearchQuery[]>;

  // Cache methods
  getCacheEntry(key: string): Promise<CacheEntry | undefined>;
  setCacheEntry(key: string, data: any, expiresAt: Date): Promise<CacheEntry>;
  deleteCacheEntry(key: string): Promise<void>;
  cleanExpiredCache(): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private propertyListings: Map<string, PropertyListing>;
  private searchQueries: Map<string, SearchQuery>;
  private cacheEntries: Map<string, CacheEntry>;

  constructor() {
    this.users = new Map();
    this.propertyListings = new Map();
    this.searchQueries = new Map();
    this.cacheEntries = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getPropertyListings(filters?: Partial<SearchFilters>): Promise<PropertyListing[]> {
    let listings = Array.from(this.propertyListings.values());
    
    if (filters) {
      if (filters.city) {
        listings = listings.filter(listing => 
          listing.address.toLowerCase().includes(filters.city!.toLowerCase())
        );
      }
      if (filters.max_price) {
        listings = listings.filter(listing => listing.price <= filters.max_price!);
      }
      if (filters.min_bedrooms) {
        listings = listings.filter(listing => 
          listing.bedrooms && listing.bedrooms >= filters.min_bedrooms!
        );
      }
      if (filters.keywords) {
        listings = listings.filter(listing =>
          listing.title.toLowerCase().includes(filters.keywords!.toLowerCase()) ||
          (listing.description && listing.description.toLowerCase().includes(filters.keywords!.toLowerCase()))
        );
      }
    }

    return listings.sort((a, b) => 
      new Date(b.scraped_at).getTime() - new Date(a.scraped_at).getTime()
    );
  }

  async getPropertyListing(id: string): Promise<PropertyListing | undefined> {
    return this.propertyListings.get(id);
  }

  async createPropertyListings(listings: InsertPropertyListing[]): Promise<PropertyListing[]> {
    const created: PropertyListing[] = [];
    
    for (const listingData of listings) {
      const id = randomUUID();
      const now = new Date();
      const listing: PropertyListing = {
        ...listingData,
        id,
        scraped_at: now,
        created_at: now,
        description: listingData.description ?? null,
        bedrooms: listingData.bedrooms ?? null,
        bathrooms: listingData.bathrooms ?? null,
        area_sqm: listingData.area_sqm ?? null,
        property_url: listingData.property_url ?? null,
        image_url: listingData.image_url ?? null,
        listing_id: listingData.listing_id ?? null,
        property_type: listingData.property_type ?? null,
        property_category: listingData.property_category ?? null,
        tenure: listingData.tenure ?? null,
        postcode: listingData.postcode ?? null,
        agent_name: listingData.agent_name ?? null,
        agent_phone: listingData.agent_phone ?? null,
        agent_url: listingData.agent_url ?? null,
        latitude: listingData.latitude ?? null,
        longitude: listingData.longitude ?? null,
        date_listed: listingData.date_listed ?? null,
        area_estimated: listingData.area_estimated ?? false,
        hmo_candidate: listingData.hmo_candidate ?? false,
      };
      this.propertyListings.set(id, listing);
      created.push(listing);
    }
    
    return created;
  }

  async deleteOldListings(olderThan: Date): Promise<void> {
    for (const [id, listing] of Array.from(this.propertyListings.entries())) {
      if (new Date(listing.scraped_at) < olderThan) {
        this.propertyListings.delete(id);
      }
    }
  }

  async createSearchQuery(query: InsertSearchQuery): Promise<SearchQuery> {
    const id = randomUUID();
    const now = new Date();
    const searchQuery: SearchQuery = {
      ...query,
      id,
      status: 'pending',
      results_count: 0,
      cache_expires_at: null,
      created_at: now,
      updated_at: now,
      max_price: query.max_price ?? null,
      min_bedrooms: query.min_bedrooms ?? null,
      keywords: query.keywords ?? null,
    };
    this.searchQueries.set(id, searchQuery);
    return searchQuery;
  }

  async getSearchQuery(id: string): Promise<SearchQuery | undefined> {
    return this.searchQueries.get(id);
  }

  async updateSearchQuery(id: string, updates: Partial<SearchQuery>): Promise<SearchQuery | undefined> {
    const existing = this.searchQueries.get(id);
    if (!existing) return undefined;

    const updated: SearchQuery = {
      ...existing,
      ...updates,
      updated_at: new Date(),
    };
    this.searchQueries.set(id, updated);
    return updated;
  }

  async getActiveSearchQueries(): Promise<SearchQuery[]> {
    return Array.from(this.searchQueries.values())
      .filter(query => query.status === 'pending' || query.status === 'running');
  }

  async getCacheEntry(key: string): Promise<CacheEntry | undefined> {
    const entry = this.cacheEntries.get(key);
    if (entry && new Date(entry.expires_at) > new Date()) {
      return entry;
    }
    if (entry) {
      this.cacheEntries.delete(key);
    }
    return undefined;
  }

  async setCacheEntry(key: string, data: any, expiresAt: Date): Promise<CacheEntry> {
    const id = randomUUID();
    const entry: CacheEntry = {
      id,
      cache_key: key,
      data,
      expires_at: expiresAt,
      created_at: new Date(),
    };
    this.cacheEntries.set(key, entry);
    return entry;
  }

  async deleteCacheEntry(key: string): Promise<void> {
    this.cacheEntries.delete(key);
  }

  async cleanExpiredCache(): Promise<void> {
    const now = new Date();
    for (const [key, entry] of Array.from(this.cacheEntries.entries())) {
      if (new Date(entry.expires_at) <= now) {
        this.cacheEntries.delete(key);
      }
    }
  }
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Property listing methods
  async getPropertyListings(filters?: Partial<SearchFilters>): Promise<PropertyListing[]> {
    let query = db.select().from(propertyListings);
    const conditions: any[] = [];

    if (filters) {
      if (filters.city) {
        conditions.push(like(propertyListings.address, `%${filters.city}%`));
      }
      if (filters.max_price) {
        conditions.push(lte(propertyListings.price, filters.max_price));
      }
      if (filters.min_bedrooms) {
        conditions.push(gte(propertyListings.bedrooms, filters.min_bedrooms));
      }
      if (filters.keywords) {
        conditions.push(
          or(
            like(propertyListings.title, `%${filters.keywords}%`),
            like(propertyListings.description, `%${filters.keywords}%`)
          )
        );
      }
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const listings = await query.orderBy(desc(propertyListings.scraped_at));
    return listings;
  }

  async getPropertyListing(id: string): Promise<PropertyListing | undefined> {
    const [listing] = await db.select().from(propertyListings).where(eq(propertyListings.id, id));
    return listing || undefined;
  }

  async createPropertyListings(listings: InsertPropertyListing[]): Promise<PropertyListing[]> {
    const created = await db.insert(propertyListings).values(listings).returning();
    return created;
  }

  async deleteOldListings(olderThan: Date): Promise<void> {
    await db.delete(propertyListings).where(lte(propertyListings.scraped_at, olderThan));
  }

  // Search query methods
  async createSearchQuery(query: InsertSearchQuery): Promise<SearchQuery> {
    const [searchQuery] = await db.insert(searchQueries).values(query).returning();
    return searchQuery;
  }

  async getSearchQuery(id: string): Promise<SearchQuery | undefined> {
    const [query] = await db.select().from(searchQueries).where(eq(searchQueries.id, id));
    return query || undefined;
  }

  async updateSearchQuery(id: string, updates: Partial<SearchQuery>): Promise<SearchQuery | undefined> {
    const [updated] = await db
      .update(searchQueries)
      .set({ ...updates, updated_at: new Date() })
      .where(eq(searchQueries.id, id))
      .returning();
    return updated || undefined;
  }

  async getActiveSearchQueries(): Promise<SearchQuery[]> {
    const queries = await db
      .select()
      .from(searchQueries)
      .where(or(eq(searchQueries.status, 'pending'), eq(searchQueries.status, 'running')));
    return queries;
  }

  // Cache methods
  async getCacheEntry(key: string): Promise<CacheEntry | undefined> {
    const [entry] = await db
      .select()
      .from(cacheEntries)
      .where(and(eq(cacheEntries.cache_key, key), gte(cacheEntries.expires_at, new Date())));
    return entry || undefined;
  }

  async setCacheEntry(key: string, data: any, expiresAt: Date): Promise<CacheEntry> {
    const [entry] = await db
      .insert(cacheEntries)
      .values({
        cache_key: key,
        data,
        expires_at: expiresAt,
      })
      .returning();
    return entry;
  }

  async deleteCacheEntry(key: string): Promise<void> {
    await db.delete(cacheEntries).where(eq(cacheEntries.cache_key, key));
  }

  async cleanExpiredCache(): Promise<void> {
    await db.delete(cacheEntries).where(lte(cacheEntries.expires_at, new Date()));
  }
}

export const storage = new DatabaseStorage();
