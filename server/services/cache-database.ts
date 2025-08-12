import fs from 'fs/promises';
import path from 'path';
import { PropertyListing } from '@shared/schema';

/**
 * Cache-based Database - koristi JSON fajlove kao glavnu bazu podataka
 * Podaci se nikad ne brišu, samo se dodaju i updatuju
 */
export class CacheDatabase {
  private static readonly CACHE_DIR = 'cache/primelocation';
  
  /**
   * Učitaj sve properties iz cache-a za određeni grad
   */
  static async getPropertiesForCity(city: string): Promise<any[]> {
    // Pokušaj različite varijante naziva grada - prvo tačno ime, zatim varijacije
    const possibleDirNames = [
      city.toLowerCase().trim(),
      city.toLowerCase().replace(/\s+/g, '-'),
      city.toLowerCase().replace(/\s+/g, '_'),
      city.toLowerCase().replace(/[^a-z-]/g, ''),
      city.toLowerCase().replace(/\s+/g, '').replace(/[^a-z]/g, ''),
      // Dodatne varijacije za slučajeve kao što su "Greater Manchester"
      city.toLowerCase().split(' ')[0], // Prvi deo imena (npr "greater" za "Greater Manchester")
      city.toLowerCase().split(' ').pop() // Poslednji deo imena (npr "manchester" za "Greater Manchester")
    ];
    
    let cityDir = '';
    let found = false;
    
    // Pronađi postojeći direktorijum
    for (const dirName of possibleDirNames) {
      if (!dirName) continue; // Skip undefined/empty directory names
      const testDir = path.join(this.CACHE_DIR, dirName);
      try {
        await fs.access(testDir);
        cityDir = testDir;
        found = true;
        console.log(`📁 Found cache directory: ${testDir}`);
        break;
      } catch {
        // direktorijum ne postoji
      }
    }
    
    if (!found) {
      console.log(`📁 No cache directory found for ${city} (tried: ${possibleDirNames.join(', ')})`);
      return [];
    }
    
    try {
      const files = await fs.readdir(cityDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      
      console.log(`📄 Found ${jsonFiles.length} JSON files in ${cityDir}`);
      console.log(`📂 File list: ${jsonFiles.join(', ')}`);
      
      let allProperties: any[] = [];
      
      for (const file of jsonFiles) {
        try {
          const filePath = path.join(cityDir, file);
          const content = await fs.readFile(filePath, 'utf8');
          const properties = JSON.parse(content);
          
          if (Array.isArray(properties)) {
            allProperties.push(...properties);
            console.log(`  📄 ${file}: ${properties.length} properties`);
          } else {
            console.log(`  📄 ${file}: Invalid format (not array)`);
          }
        } catch (fileError) {
          console.error(`❌ Error reading cache file ${file}:`, fileError);
        }
      }
      
      // Ukloni duplikate na osnovu property_url
      const uniqueProperties = allProperties.filter((prop, index, arr) => 
        arr.findIndex(p => p.property_url === prop.property_url) === index
      );
      
      console.log(`📊 ${city}: ${allProperties.length} total, ${uniqueProperties.length} unique properties`);
      
      return uniqueProperties;
      
    } catch (error) {
      console.error(`❌ Error reading cache directory ${cityDir}:`, error);
      return [];
    }
  }
  
  /**
   * Pretraži properties iz cache-a sa filterima
   */
  static async searchProperties(filters: {
    city?: string;
    min_bedrooms?: number;
    max_price?: number;
    min_sqm?: number;
    max_sqm?: number;
    postcode?: string;
    keywords?: string;
    hmo_candidate?: boolean;
    article4_filter?: "all" | "non_article4" | "article4_only";
  }): Promise<any[]> {
    
    if (!filters.city) {
      // Ako nema grada, traži u svim gradovima
      return this.searchAllCities(filters);
    }
    
    const properties = await this.getPropertiesForCity(filters.city);
    
    // Primeni filtere
    let filtered = properties;
    
    console.log(`🔧 Applying filters:`, filters);
    
    if (filters.min_bedrooms) {
      const beforeCount = filtered.length;
      filtered = filtered.filter(p => {
        const bedrooms = p.bedrooms || 0;
        return bedrooms >= filters.min_bedrooms!;
      });
      console.log(`🛏️  Min bedrooms filter (${filters.min_bedrooms}): ${beforeCount} → ${filtered.length}`);
    }
    
    if (filters.max_price) {
      const beforeCount = filtered.length;
      filtered = filtered.filter(p => {
        const price = p.price || 0;
        return price <= filters.max_price!;
      });
      console.log(`💰 Max price filter (£${filters.max_price}): ${beforeCount} → ${filtered.length}`);
    }

    if (filters.max_sqm) {
      const beforeCount = filtered.length;
      filtered = filtered.filter(p => {
        const sqm = p.area_sqm;
        // If area_sqm is null/undefined, include the property (don't filter out)
        // Only filter out if we have a valid sqm value that exceeds the limit
        return sqm === null || sqm === undefined || sqm <= filters.max_sqm!;
      });
      console.log(`📐 Max sqm filter (${filters.max_sqm}): ${beforeCount} → ${filtered.length} (includes properties without area data)`);
    }
    
    if (filters.postcode) {
      const beforeCount = filtered.length;
      const postcodeSearch = filters.postcode.toLowerCase().trim();
      filtered = filtered.filter(p => {
        const postcode = (p.postcode || '').toLowerCase();
        const address = (p.address || '').toLowerCase();
        return postcode.includes(postcodeSearch) || address.includes(postcodeSearch);
      });
      console.log(`📮 Postcode filter ("${filters.postcode}"): ${beforeCount} → ${filtered.length}`);
    }
    
    if (filters.keywords) {
      const beforeCount = filtered.length;
      const keywords = filters.keywords.toLowerCase();
      filtered = filtered.filter(p => 
        (p.address || '').toLowerCase().includes(keywords) ||
        (p.description || '').toLowerCase().includes(keywords)
      );
      console.log(`🔍 Keywords filter ("${keywords}"): ${beforeCount} → ${filtered.length}`);
    }

    if (filters.hmo_candidate !== undefined) {
      const beforeCount = filtered.length;
      filtered = filtered.filter(p => {
        // Calculate if property is HMO candidate based on available data
        const hasAreaData = p.area_sqm && p.area_sqm >= 90;
        const notArticle4 = p.article4_area !== true;
        const explicitCandidate = p.hmo_candidate === true;
        const has4PlusBeds = (p.bedrooms || 0) >= 4; // 4+ bedrooms often indicates HMO potential
        
        // Property is HMO candidate if:
        // 1. Explicitly marked as HMO candidate, OR
        // 2. Has area >= 90sqm and not Article 4, OR
        // 3. Has 4+ bedrooms and not Article 4 (for properties without area data)
        const isCandidate = explicitCandidate || 
                          (hasAreaData && notArticle4) || 
                          (has4PlusBeds && notArticle4);
        
        return filters.hmo_candidate ? isCandidate : !isCandidate;
      });
      console.log(`🏠 HMO candidate filter (${filters.hmo_candidate}): ${beforeCount} → ${filtered.length}`);
    }

    if (filters.min_sqm) {
      const beforeCount = filtered.length;
      filtered = filtered.filter(p => {
        const sqm = p.area_sqm;
        // If area_sqm is null/undefined, exclude the property for minSqm filtering
        return sqm !== null && sqm !== undefined && sqm >= filters.min_sqm!;
      });
      console.log(`📐 Min sqm filter (${filters.min_sqm}): ${beforeCount} → ${filtered.length} (excludes properties without area data)`);
    }

    if (filters.article4_filter && filters.article4_filter !== "all") {
      const beforeCount = filtered.length;
      filtered = filtered.filter(p => {
        const isArticle4 = p.article4_area === true;
        return filters.article4_filter === "non_article4" ? !isArticle4 : isArticle4;
      });
      console.log(`📋 Article 4 filter ("${filters.article4_filter}"): ${beforeCount} → ${filtered.length}`);
    }
    
    console.log(`🔍 Cache search: ${properties.length} total, ${filtered.length} after filters`);
    
    return filtered;
  }
  
  /**
   * Pretraži sve gradove
   */
  static async searchAllCities(filters: {
    min_bedrooms?: number;
    max_price?: number;
    max_sqm?: number;
    postcode?: string;
    keywords?: string;
    hmo_candidate?: boolean;
    article4_filter?: "all" | "non_article4" | "article4_only";
  }): Promise<any[]> {
    
    try {
      const cityDirs = await fs.readdir(this.CACHE_DIR);
      let allResults: any[] = [];
      
      for (const cityDir of cityDirs) {
        const cityProperties = await this.getPropertiesForCity(cityDir);
        allResults.push(...cityProperties);
      }
      
      // Primeni filtere
      let filtered = allResults;
      
      console.log(`🔧 Multi-city applying filters:`, filters);
      
      if (filters.min_bedrooms) {
        const beforeCount = filtered.length;
        filtered = filtered.filter(p => {
          const bedrooms = p.bedrooms || 0;
          return bedrooms >= filters.min_bedrooms!;
        });
        console.log(`🛏️  Min bedrooms filter (${filters.min_bedrooms}): ${beforeCount} → ${filtered.length}`);
      }
      
      if (filters.max_price) {
        const beforeCount = filtered.length;
        filtered = filtered.filter(p => {
          const price = p.price || 0;
          return price <= filters.max_price!;
        });
        console.log(`💰 Max price filter (£${filters.max_price}): ${beforeCount} → ${filtered.length}`);
      }
      
      if (filters.max_sqm) {
        const beforeCount = filtered.length;
        filtered = filtered.filter(p => {
          const sqm = p.area_sqm;
          // If area_sqm is null/undefined, include the property (don't filter out)
          // Only filter out if we have a valid sqm value that exceeds the limit
          return sqm === null || sqm === undefined || sqm <= filters.max_sqm!;
        });
        console.log(`📐 Multi-city Max sqm filter (${filters.max_sqm}): ${beforeCount} → ${filtered.length} (includes properties without area data)`);
      }
      
      if (filters.postcode) {
        const beforeCount = filtered.length;
        const postcodeSearch = filters.postcode.toLowerCase().trim();
        filtered = filtered.filter(p => {
          const postcode = (p.postcode || '').toLowerCase();
          const address = (p.address || '').toLowerCase();
          return postcode.includes(postcodeSearch) || address.includes(postcodeSearch);
        });
        console.log(`📮 Postcode filter ("${filters.postcode}"): ${beforeCount} → ${filtered.length}`);
      }
      
      if (filters.keywords) {
        const beforeCount = filtered.length;
        const keywords = filters.keywords.toLowerCase();
        filtered = filtered.filter(p => 
          (p.address || '').toLowerCase().includes(keywords) ||
          (p.description || '').toLowerCase().includes(keywords)
        );
        console.log(`🔍 Keywords filter ("${keywords}"): ${beforeCount} → ${filtered.length}`);
      }

      if (filters.hmo_candidate !== undefined) {
        const beforeCount = filtered.length;
        filtered = filtered.filter(p => {
          const isCandidate = p.hmo_candidate === true || 
            (p.area_sqm >= 90 && p.article4_area !== true);
          return filters.hmo_candidate ? isCandidate : !isCandidate;
        });
        console.log(`🏠 Multi-city HMO candidate filter (${filters.hmo_candidate}): ${beforeCount} → ${filtered.length}`);
      }

      if (filters.article4_filter && filters.article4_filter !== "all") {
        const beforeCount = filtered.length;
        filtered = filtered.filter(p => {
          const isArticle4 = p.article4_area === true;
          return filters.article4_filter === "non_article4" ? !isArticle4 : isArticle4;
        });
        console.log(`📋 Multi-city Article 4 filter ("${filters.article4_filter}"): ${beforeCount} → ${filtered.length}`);
      }
      
      // Ukloni duplikate
      const uniqueFiltered = filtered.filter((prop, index, arr) => 
        arr.findIndex(p => p.property_url === prop.property_url) === index
      );
      
      console.log(`🔍 Multi-city search: ${allResults.length} total, ${uniqueFiltered.length} after filters`);
      
      return uniqueFiltered;
      
    } catch (error) {
      console.error('❌ Error searching all cities:', error);
      return [];
    }
  }
  
  /**
   * Dodaj nove properties u cache (preskače duplikate)
   */
  static async addPropertiesToCache(city: string, newProperties: any[]): Promise<void> {
    const cityDir = path.join(this.CACHE_DIR, city.toLowerCase().replace(/\s+/g, '-'));
    
    // Kreiraj direktorijum ako ne postoji
    await fs.mkdir(cityDir, { recursive: true });
    
    // Učitaj postojeće properties
    const existingProperties = await this.getPropertiesForCity(city);
    const existingUrls = new Set(existingProperties.map(p => p.property_url));
    
    // Filtriraj nove properties (preskači duplikate)
    const uniqueNewProperties = newProperties.filter(p => 
      p.property_url && !existingUrls.has(p.property_url)
    );
    
    if (uniqueNewProperties.length === 0) {
      console.log(`📦 No new properties to add for ${city}`);
      return;
    }
    
    // Sačuvaj nove properties u novi fajl
    const timestamp = Date.now();
    const filename = `update_${timestamp}.json`;
    const filePath = path.join(cityDir, filename);
    
    await fs.writeFile(filePath, JSON.stringify(uniqueNewProperties, null, 2));
    
    console.log(`✅ Added ${uniqueNewProperties.length} new properties for ${city} (skipped ${newProperties.length - uniqueNewProperties.length} duplicates)`);
  }
  
  /**
   * Prebroj ukupan broj properties u cache-u
   */
  static async getTotalPropertiesCount(): Promise<number> {
    try {
      const cityDirs = await fs.readdir(this.CACHE_DIR);
      let total = 0;
      
      for (const cityDir of cityDirs) {
        const properties = await this.getPropertiesForCity(cityDir);
        total += properties.length;
      }
      
      return total;
    } catch (error) {
      return 0;
    }
  }
  
  /**
   * Lista svih gradova u cache-u
   */
  static async getCachedCities(): Promise<string[]> {
    try {
      const cityDirs = await fs.readdir(this.CACHE_DIR);
      return cityDirs.map(dir => 
        dir.split('-').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ')
      );
    } catch (error) {
      return [];
    }
  }
}