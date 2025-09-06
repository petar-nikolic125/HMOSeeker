import fs from 'fs/promises';
import path from 'path';
import { PropertyListing } from '@shared/schema';
import { article4Service } from './article4-service';

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
      
      // Reduced verbose logging for performance
      
      let allProperties: any[] = [];
      
      for (const file of jsonFiles) {
        try {
          const filePath = path.join(cityDir, file);
          const content = await fs.readFile(filePath, 'utf8');
          const properties = JSON.parse(content);
          
          if (Array.isArray(properties)) {
            allProperties.push(...properties);
            // Reduced per-file logging
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
      
      // Reduced logging for performance
      if (uniqueProperties.length > 0) {
        console.log(`📊 ${city}: ${uniqueProperties.length} unique properties`);
      }
      
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
    
    // Optimization: Force single city search for performance  
    if (!filters.city) {
      console.log(`⚡ No city specified, using fast multi-city search`);
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
        // Only filter out properties with null/undefined prices if they're explicitly 0
        // Allow properties with valid prices <= max_price
        return price > 0 && price <= filters.max_price!;
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
      let explicitCount = 0;
      let areaBasedCount = 0;
      
      filtered = filtered.filter(p => {
        // Calculate if property is HMO candidate based on available data
        const hasAreaData = p.area_sqm && p.area_sqm >= 90;
        const notArticle4 = p.article4_area !== true;
        const explicitCandidate = p.hmo_candidate === true;
        
        if (explicitCandidate) explicitCount++;
        if (hasAreaData && notArticle4) areaBasedCount++;
        
        // Very strict HMO candidate logic: Only properties that are explicitly marked 
        // OR have confirmed area >= 90sqm in non-Article 4 areas
        const isCandidate = explicitCandidate || (hasAreaData && notArticle4);
        
        // Debug: Log first few properties to understand filtering
        if (beforeCount <= 115 && beforeCount > 110) {
          console.log(`  🔍 Property debug: beds=${p.bedrooms}, sqm=${p.area_sqm}, explicit=${explicitCandidate}, article4=${p.article4_area}, candidate=${isCandidate}`);
        }
        
        return filters.hmo_candidate ? isCandidate : !isCandidate;
      });
      console.log(`🏠 HMO candidate filter (${filters.hmo_candidate}): ${beforeCount} → ${filtered.length} (explicit: ${explicitCount}, area-based: ${areaBasedCount})`);
    }

    if (filters.min_sqm) {
      const beforeCount = filtered.length;
      filtered = filtered.filter(p => {
        const sqm = p.area_sqm;
        // If area_sqm is null/undefined, include the property (since cached data often lacks area)
        // Only filter out if we have area data that's below the minimum
        return sqm === null || sqm === undefined || sqm >= filters.min_sqm!;
      });
      console.log(`📐 Min sqm filter (${filters.min_sqm}): ${beforeCount} → ${filtered.length} (includes properties without area data)`);
    }

    // Default Article 4 filtering: Always exclude Article 4 properties unless explicitly requested
    if (!filters.article4_filter || filters.article4_filter === "non_article4") {
      const beforeCount = filtered.length;
      
      // Use comprehensive Article 4 database checking
      const article4FilteredProperties: any[] = [];
      
      for (const property of filtered) {
        try {
          // Extract postcode from property address or postcode field
          const postcode = CacheDatabase.extractPostcodeFromProperty(property);
          
          if (postcode) {
            // Check against comprehensive Article 4 database
            const article4Result = await article4Service.checkArticle4(postcode);
            if (!article4Result.inArticle4) {
              article4FilteredProperties.push(property);
            }
          } else {
            // If no postcode found, fall back to the old article4_area flag  
            if (property.article4_area !== true) {
              article4FilteredProperties.push(property);
            }
          }
        } catch (error) {
          // If Article 4 check fails, fall back to the old flag
          if (property.article4_area !== true) {
            article4FilteredProperties.push(property);
          }
        }
      }
      
      filtered = article4FilteredProperties;
      console.log(`📋 Article 4 filter (comprehensive database): ${beforeCount} → ${filtered.length}`);
    } else if (filters.article4_filter === "article4_only") {
      const beforeCount = filtered.length;
      
      // Use comprehensive Article 4 database checking for Article 4 only filter
      const article4OnlyProperties: any[] = [];
      
      for (const property of filtered) {
        try {
          const postcode = CacheDatabase.extractPostcodeFromProperty(property);
          
          if (postcode) {
            const article4Result = await article4Service.checkArticle4(postcode);
            if (article4Result.inArticle4) {
              article4OnlyProperties.push(property);
            }
          } else {
            // Fall back to old flag
            if (property.article4_area === true) {
              article4OnlyProperties.push(property);
            }
          }
        } catch (error) {
          // Fall back to old flag
          if (property.article4_area === true) {
            article4OnlyProperties.push(property);
          }
        }
      }
      
      filtered = article4OnlyProperties;
      console.log(`📋 Article 4 filter (article4_only - comprehensive): ${beforeCount} → ${filtered.length}`);
    }
    
    console.log(`🔍 Cache search: ${properties.length} total, ${filtered.length} after filters`);
    
    return filtered;
  }
  
  /**
   * Fast search across top 5 popular cities only (performance optimized)
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
      // Performance optimization: Search top cities with unlimited total and unlimited per city
      const priorityCities = ['london', 'manchester', 'birmingham', 'liverpool', 'leeds'];
      let allResults: any[] = [];
      const maxPerCity = Number.MAX_SAFE_INTEGER; // Unlimited properties per city
      
      console.log(`🔧 Fast multi-city search in top ${priorityCities.length} cities (unlimited per city, unlimited total)`);
      
      for (const cityName of priorityCities) {
        
        try {
          const cityProperties = await this.getPropertiesForCity(cityName);
          // Pre-filter during loading to reduce memory usage
          let filtered = cityProperties;
          
          // Apply filters immediately during city loading
          if (filters.min_bedrooms) {
            filtered = filtered.filter(p => (p.bedrooms || 0) >= filters.min_bedrooms!);
          }
          if (filters.max_price) {
            filtered = filtered.filter(p => (p.price || 0) <= filters.max_price!);
          }
          
          // Add all properties per city (no limit)
          allResults.push(...filtered);
          
        } catch (cityError) {
          console.log(`⚠️ Skipping ${cityName}: ${cityError}`);
          continue;
        }
      }
      
      // Apply remaining filters to the pre-filtered subset
      let finalFiltered = allResults;
      
      if (filters.max_sqm) {
        finalFiltered = finalFiltered.filter(p => {
          const sqm = p.area_sqm;
          return sqm === null || sqm === undefined || sqm <= filters.max_sqm!;
        });
      }
      
      if (filters.postcode) {
        const postcodeSearch = filters.postcode.toLowerCase().trim();
        finalFiltered = finalFiltered.filter(p => {
          const postcode = (p.postcode || '').toLowerCase();
          const address = (p.address || '').toLowerCase();
          return postcode.includes(postcodeSearch) || address.includes(postcodeSearch);
        });
      }
      
      if (filters.keywords) {
        const keywords = filters.keywords.toLowerCase();
        finalFiltered = finalFiltered.filter(p => 
          (p.address || '').toLowerCase().includes(keywords) ||
          (p.description || '').toLowerCase().includes(keywords)
        );
      }

      if (filters.hmo_candidate !== undefined) {
        finalFiltered = finalFiltered.filter(p => {
          const isCandidate = p.hmo_candidate === true || 
            (p.area_sqm >= 90 && p.article4_area !== true);
          return filters.hmo_candidate ? isCandidate : !isCandidate;
        });
      }

      if (filters.article4_filter && filters.article4_filter !== "all") {
        finalFiltered = finalFiltered.filter(p => {
          const isArticle4 = p.article4_area === true;
          return filters.article4_filter === "non_article4" ? !isArticle4 : isArticle4;
        });
      }
      
      // Remove duplicates efficiently  
      const uniqueFiltered = finalFiltered.filter((prop, index, arr) => 
        arr.findIndex(p => p.property_url === prop.property_url) === index
      );
      
      console.log(`📄 Found ${uniqueFiltered.length} total cached properties`);
      
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

  /**
   * Extract UK postcode from property data
   */
  static extractPostcodeFromProperty(property: any): string | null {
    // First try the dedicated postcode field
    if (property.postcode) {
      const cleaned = property.postcode.trim().toUpperCase();
      if (this.isValidUKPostcode(cleaned)) {
        return cleaned;
      }
    }

    // Then try extracting from address
    if (property.address) {
      const postcodeMatch = property.address.match(/\b([A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2})\b/i);
      if (postcodeMatch) {
        return postcodeMatch[1].toUpperCase().replace(/\s+/g, ' ');
      }
    }

    return null;
  }

  /**
   * Validate UK postcode format
   */
  static isValidUKPostcode(postcode: string): boolean {
    const ukPostcodeRegex = /^([A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2})$/i;
    return ukPostcodeRegex.test(postcode);
  }
}