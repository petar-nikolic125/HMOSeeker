/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Property Cache System (TypeScript, Node)
 * ----------------------------------------
 * - Append-only JSONL shards on disk (no external deps)
 * - In-memory index for 1k–50k listings
 * - TTL + stale-while-revalidate helpers
 * - Query APIs, sorting, limits
 * - Compaction & pruning
 * - Snapshot export/import (gzip JSON)
 *
 * Designed for Next.js/Node backends (not the browser).
 */

import * as fs from 'fs/promises';
import * as fssync from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { createHash } from 'crypto';

// ------------ Types shared with your app -------------

export interface PropertyListing {
  source: 'zoopla' | 'primelocation' | string;
  title: string;
  address: string;
  price: number;
  bedrooms?: number | null;
  bathrooms?: number | null;
  area_sqm?: number | null;
  description?: string | null;
  property_url?: string | null;
  image_url?: string | null;
  listing_id?: string | null;
  property_type?: string | null;
  tenure?: string | null;
  postcode?: string | null;
  agent_name?: string | null;
  agent_phone?: string | null;
  agent_url?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  date_listed?: string | null; // ISO
  scraped_at?: string | null;  // ISO
}

export interface CacheMeta {
  key: string;                 // stable cache key
  shard: string;               // two-hex shard prefix
  etag?: string;
  lastModified?: string;
  fetchedAt: string;           // ISO
  ttlSec: number;              // TTL for "freshness"
  // append-only bookkeeping
  file: string;                // shard file path
  offset?: number;             // reserved for future random access
  length?: number;             // reserved
}

export interface CachedRecord {
  listing: PropertyListing;
  meta: CacheMeta;
}

// ------------ Options & Defaults -------------

export interface PropertyCacheOptions {
  rootDir: string;
  shards?: number;            // must be power of 16 (maps to hex prefixes); default 256 (00..ff)
  defaultTTLSeconds?: number; // default freshness window
  maxInMemory?: number;       // soft cap for in-memory index (default 30k)
  staleWhileRevalidateSeconds?: number; // treat slightly expired as usable while background refresh occurs
}

const DEFAULTS = {
  shards: 256,
  defaultTTLSeconds: 60 * 60 * 24, // 1 day
  maxInMemory: 30_000,
  staleWhileRevalidateSeconds: 60 * 10, // 10 min
};

// ------------ Utility -------------

function ensureDirSync(dir: string) {
  if (!fssync.existsSync(dir)) fssync.mkdirSync(dir, { recursive: true });
}

function hashKey(s: string): string {
  return createHash('sha1').update(s).digest('hex');
}

function canonicalKey(listing: PropertyListing): string {
  const parts: string[] = [listing.source || 'unknown'];
  if (listing.listing_id) {
    parts.push(`id:${listing.listing_id}`);
  } else if (listing.property_url) {
    parts.push(`url:${listing.property_url}`);
  } else {
    const title = (listing.title || '').trim().toLowerCase().replace(/\s+/g, ' ');
    parts.push(`title:${title}`);
    parts.push(`price:${listing.price ?? 0}`);
  }
  return parts.join('|');
}

function nowISO(): string {
  return new Date().toISOString();
}

function isFresh(meta: CacheMeta): boolean {
  const fetched = new Date(meta.fetchedAt).getTime();
  const ageSec = (Date.now() - fetched) / 1000;
  return ageSec <= meta.ttlSec;
}

function isStaleButServeable(meta: CacheMeta, sMaxAge: number): boolean {
  const fetched = new Date(meta.fetchedAt).getTime();
  const ageSec = (Date.now() - fetched) / 1000;
  return ageSec <= (meta.ttlSec + sMaxAge);
}

// ------------ Core Class -------------

export class PropertyCache {
  private opts: Required<PropertyCacheOptions>;
  private shardsDir: string;
  private catalogFile: string;

  // In-memory index: key -> CachedRecord
  private index: Map<string, CachedRecord> = new Map();

  constructor(options: PropertyCacheOptions) {
    this.opts = {
      rootDir: options.rootDir,
      shards: options.shards ?? DEFAULTS.shards,
      defaultTTLSeconds: options.defaultTTLSeconds ?? DEFAULTS.defaultTTLSeconds,
      maxInMemory: options.maxInMemory ?? DEFAULTS.maxInMemory,
      staleWhileRevalidateSeconds: options.staleWhileRevalidateSeconds ?? DEFAULTS.staleWhileRevalidateSeconds,
    };
    this.shardsDir = path.join(this.opts.rootDir, 'shards');
    this.catalogFile = path.join(this.opts.rootDir, 'catalog.json');
    ensureDirSync(this.opts.rootDir);
    ensureDirSync(this.shardsDir);
  }

  // --------- Public API ---------

  public async loadCatalog(): Promise<void> {
    try {
      const buf = await fs.readFile(this.catalogFile, 'utf8');
      const catalog = JSON.parse(buf);
      if (catalog?.entries && Array.isArray(catalog.entries)) {
        for (const rec of catalog.entries as CachedRecord[]) {
          if (rec && rec.meta && rec.listing) {
            this.index.set(rec.meta.key, rec);
          }
        }
      }
    } catch {
      // no-op
    }
  }

  public async saveCatalog(): Promise<void> {
    const entries: CachedRecord[] = Array.from(this.index.values()).slice(0, this.opts.maxInMemory);
    const payload = JSON.stringify({ savedAt: nowISO(), entries }, null, 2);
    ensureDirSync(this.opts.rootDir);
    await fs.writeFile(this.catalogFile, payload, 'utf8');
  }

  /**
   * Upsert a batch of listings. Append-only JSONL per shard file.
   * Returns counts and keys written.
   */
  public async upsertListings(
    listings: PropertyListing[],
    opts?: { ttlSec?: number; etagByKey?: Record<string, string>; lastModByKey?: Record<string, string> }
  ): Promise<{ inserted: number; updated: number; skipped: number; keys: string[] }> {
    const ttlSec = opts?.ttlSec ?? this.opts.defaultTTLSeconds;
    let inserted = 0, updated = 0, skipped = 0;
    const keys: string[] = [];

    // Group lines by shard file to minimize fs appends
    const byFile: Record<string, string[]> = {};

    for (const listing of listings) {
      if (!listing || !listing.title || !listing.price) { skipped++; continue; }
      const key = canonicalKey(listing);
      const h = hashKey(key);
      const shard = h.slice(0, 2);
      const file = path.join(this.shardsDir, shard, 'data.jsonl');
      ensureDirSync(path.dirname(file));

      const prev = this.index.get(key);
      const meta: CacheMeta = {
        key, shard, file,
        fetchedAt: nowISO(),
        ttlSec,
        etag: opts?.etagByKey?.[key],
        lastModified: opts?.lastModByKey?.[key],
      };

      const rec: CachedRecord = { listing, meta };
      this.index.set(key, rec);

      const line = JSON.stringify(rec) + '\n';
      if (!byFile[file]) byFile[file] = [];
      byFile[file].push(line);

      if (prev) updated++; else inserted++;
      keys.push(key);
    }

    // Append for each shard file
    await Promise.all(Object.entries(byFile).map(async ([file, lines]) => {
      await fs.appendFile(file, lines.join(''), 'utf8');
    }));

    // Soft memory cap: if we exceed, randomly evict older entries (we still keep them on disk).
    if (this.index.size > this.opts.maxInMemory) {
      const surplus = this.index.size - this.opts.maxInMemory;
      const keysArr = Array.from(this.index.keys());
      // naive eviction: drop first N keys; you can improve to LRU if needed
      for (let i = 0; i < surplus; i++) this.index.delete(keysArr[i]);
    }

    // Persist small catalog for warm start
    await this.saveCatalog();

    return { inserted, updated, skipped, keys };
  }

  /**
   * Query from the in-memory index. If index is empty, lazily hydrate from shards.
   */
  public async query(q?: {
    site?: string;
    minBedrooms?: number;
    maxPrice?: number;
    cityIncludes?: string;      // naive string check against address/title
    freshWithinSec?: number;    // only return listings fresh within this window
    limit?: number;
    sort?: 'priceAsc' | 'priceDesc' | 'freshnessDesc';
  }): Promise<PropertyListing[]> {
    if (this.index.size === 0) {
      await this.hydrateFromShards();
    }
    const freshWithin = q?.freshWithinSec ?? 0;
    const list: CachedRecord[] = [];

    for (const rec of this.index.values()) {
      if (q?.site && rec.listing.source !== q.site) continue;
      if (q?.minBedrooms && (rec.listing.bedrooms ?? 0) < q.minBedrooms) continue;
      if (q?.maxPrice && (rec.listing.price ?? 0) > q.maxPrice) continue;
      if (q?.cityIncludes) {
        const blob = (rec.listing.address || rec.listing.title || '').toLowerCase();
        if (!blob.includes(q.cityIncludes.toLowerCase())) continue;
      }
      if (freshWithin > 0) {
        const fetched = new Date(rec.meta.fetchedAt).getTime();
        const ageSec = (Date.now() - fetched) / 1000;
        if (ageSec > freshWithin) continue;
      }
      list.push(rec);
    }

    // sort
    const sort = q?.sort ?? 'priceAsc';
    if (sort === 'priceAsc') list.sort((a, b) => (a.listing.price ?? 0) - (b.listing.price ?? 0));
    if (sort === 'priceDesc') list.sort((a, b) => (b.listing.price ?? 0) - (a.listing.price ?? 0));
    if (sort === 'freshnessDesc') list.sort((a, b) => new Date(b.meta.fetchedAt).getTime() - new Date(a.meta.fetchedAt).getTime());

    const limit = q?.limit ?? 1000;
    return list.slice(0, limit).map(r => r.listing);
  }

  /**
   * Indicates whether a listing (by key) is fresh, stale-while-revalidate, or expired.
   */
  public getFreshness(key: string): 'fresh' | 'stale-serveable' | 'expired' | 'missing' {
    const rec = this.index.get(key);
    if (!rec) return 'missing';
    if (isFresh(rec.meta)) return 'fresh';
    if (isStaleButServeable(rec.meta, this.opts.staleWhileRevalidateSeconds)) return 'stale-serveable';
    return 'expired';
  }

  /**
   * Mark a listing as refreshed by updating its fetchedAt/validators and TTL (without writing a duplicate record).
   * (Use upsertListings if you have an updated listing payload.)
   */
  public async touch(key: string, ttlSec?: number, validators?: { etag?: string; lastModified?: string }): Promise<boolean> {
    const rec = this.index.get(key);
    if (!rec) return false;
    rec.meta.fetchedAt = nowISO();
    if (ttlSec !== undefined) rec.meta.ttlSec = ttlSec;
    if (validators?.etag) rec.meta.etag = validators.etag;
    if (validators?.lastModified) rec.meta.lastModified = validators.lastModified;
    // append a no-op line for audit trail
    const noop: CachedRecord = { listing: rec.listing, meta: rec.meta };
    await fs.appendFile(rec.meta.file, JSON.stringify(noop) + '\n', 'utf8');
    await this.saveCatalog();
    return true;
  }

  /**
   * Export a gzipped JSON snapshot of the latest version of each listing.
   */
  public async exportSnapshot(filePath: string): Promise<void> {
    if (this.index.size === 0) await this.hydrateFromShards();
    const data = Array.from(this.index.values()).map(r => r);
    const json = JSON.stringify({ exportedAt: nowISO(), count: data.length, records: data });
    await new Promise<void>((resolve, reject) => {
      const gz = zlib.createGzip({ level: zlib.constants.Z_BEST_SPEED });
      const out = fssync.createWriteStream(filePath);
      gz.on('error', reject);
      out.on('error', reject);
      out.on('finish', () => resolve());
      gz.pipe(out);
      gz.end(Buffer.from(json, 'utf8'));
    });
  }

  /**
   * Import from a gzipped JSON snapshot.
   * If replace=true, clears existing shards first; otherwise merges.
   */
  public async importSnapshot(filePath: string, replace = false): Promise<void> {
    const buf = await fs.readFile(filePath);
    const json = zlib.gunzipSync(buf).toString('utf8');
    const payload = JSON.parse(json);
    const records: CachedRecord[] = payload.records ?? [];
    if (replace) {
      await this.clearAll();
    }
    await this.upsertListings(records.map(r => r.listing), {
      ttlSec: this.opts.defaultTTLSeconds,
    });
  }

  /**
   * Compact shards: rewrite each shard to contain only the latest record per key.
   * Optionally prune by maxAgeDays or keepLastN.
   */
  public async compactAndPrune(opts?: { maxAgeDays?: number; keepLastN?: number }): Promise<void> {
    const shards = await this._listShardDirs();
    for (const shard of shards) {
      const file = path.join(this.shardsDir, shard, 'data.jsonl');
      if (!fssync.existsSync(file)) continue;
      const map: Map<string, CachedRecord> = new Map();

      // Read all lines in shard
      const data = await fs.readFile(file, 'utf8');
      for (const line of data.split('\n')) {
        if (!line.trim()) continue;
        try {
          const rec = JSON.parse(line) as CachedRecord;
          map.set(rec.meta.key, rec);
        } catch {}
      }

      // Apply pruning
      const outRecords: CachedRecord[] = [];
      const cutoff = opts?.maxAgeDays ? Date.now() - (opts.maxAgeDays * 86400000) : 0;
      let arr = Array.from(map.values());
      if (cutoff) {
        arr = arr.filter(r => new Date(r.meta.fetchedAt).getTime() >= cutoff);
      }
      if (opts?.keepLastN && arr.length > opts.keepLastN) {
        // Keep most recent N by fetchedAt
        arr.sort((a, b) => new Date(b.meta.fetchedAt).getTime() - new Date(a.meta.fetchedAt).getTime());
        arr = arr.slice(0, opts.keepLastN);
      }
      outRecords.push(...arr);

      // Rewrite shard
      const tmp = file + '.tmp';
      await fs.writeFile(tmp, outRecords.map(r => JSON.stringify(r)).join('\n') + '\n', 'utf8');
      await fs.rename(tmp, file);
    }

    // Rebuild in-memory index from compacted shards
    this.index.clear();
    await this.hydrateFromShards();
    await this.saveCatalog();
  }

  /**
   * Remove all on-disk shards and reset the index.
   */
  public async clearAll(): Promise<void> {
    if (fssync.existsSync(this.shardsDir)) {
      await fs.rm(this.shardsDir, { recursive: true, force: true });
    }
    ensureDirSync(this.shardsDir);
    this.index.clear();
    await this.saveCatalog();
  }

  // --------- Integration helpers ---------

  /**
   * Compute cache key for a listing (exported so you can check freshness per key).
   */
  public static keyFor(listing: PropertyListing): string {
    return canonicalKey(listing);
  }

  /**
   * Return whether a listing in cache should be refreshed.
   * - 'fresh'  => don't refetch
   * - 'stale-serveable' => can serve now, refresh in background
   * - 'expired' => should refetch now
   * - 'missing' => definitely fetch
   */
  public freshnessStatusFor(listing: PropertyListing): 'fresh' | 'stale-serveable' | 'expired' | 'missing' {
    const key = canonicalKey(listing);
    return this.getFreshness(key);
  }

  // --------- Private internals ---------

  private async hydrateFromShards(): Promise<void> {
    const shards = await this._listShardDirs();
    for (const shard of shards) {
      const file = path.join(this.shardsDir, shard, 'data.jsonl');
      if (!fssync.existsSync(file)) continue;
      const data = await fs.readFile(file, 'utf8');
      for (const line of data.split('\n')) {
        if (!line.trim()) continue;
        try {
          const rec = JSON.parse(line) as CachedRecord;
          this.index.set(rec.meta.key, rec); // last write wins
        } catch {}
      }
    }
    await this.saveCatalog();
  }

  private async _listShardDirs(): Promise<string[]> {
    const dirs: string[] = [];
    try {
      const items = await fs.readdir(this.shardsDir, { withFileTypes: true });
      for (const it of items) if (it.isDirectory()) dirs.push(it.name);
      // Ensure full shard set exists
      if (dirs.length === 0) {
        for (let i = 0; i < this.opts.shards; i++) {
          const shard = (i).toString(16).padStart(2, '0');
          ensureDirSync(path.join(this.shardsDir, shard));
          dirs.push(shard);
        }
      }
    } catch {
      // initialize
      for (let i = 0; i < this.opts.shards; i++) {
        const shard = (i).toString(16).padStart(2, '0');
        ensureDirSync(path.join(this.shardsDir, shard));
        dirs.push(shard);
      }
    }
    return dirs;
  }
}

// ------------- Example usage (remove/adjust in production) -------------
// (async () => {
//   const cache = new PropertyCache({ rootDir: '.cache/properties' });
//   await cache.loadCatalog();
//   await cache.upsertListings([{
//     source: 'zoopla',
//     title: '123 Example Road, Liverpool L1',
//     address: '123 Example Road, Liverpool L1',
//     price: 250000, bedrooms: 6,
//     property_url: 'https://www.zoopla.co.uk/for-sale/details/12345678',
//     listing_id: '12345678', scraped_at: new Date().toISOString()
//   }], { ttlSec: 86400 });
//   const list = await cache.query({ cityIncludes: 'liverpool', maxPrice: 300000, limit: 50, sort: 'freshnessDesc' });
//   console.log('Query returned', list.length, 'items');
//   await cache.exportSnapshot('.cache/properties/snap.gz');
// })();
