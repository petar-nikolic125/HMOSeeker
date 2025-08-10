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
    // Pokušaj različite varijante naziva grada
    const possibleDirNames = [
      city.toLowerCase(),
      city.toLowerCase().replace(/\s+/g, '-'),
      city.toLowerCase().replace(/\s+/g, '_'),
      city.toLowerCase().replace(/[^a-z]/g, ''),
      city.toLowerCase().replace(/\s+/g, '').replace(/[^a-z]/g, '')
    ];
    
    let cityDir = '';
    let found = false;
    
    // Pronađi postojeći direktorijum
    for (const dirName of possibleDirNames) {
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
    keywords?: string;
  }): Promise<any[]> {
    
    if (!filters.city) {
      // Ako nema grada, traži u svim gradovima
      return this.searchAllCities(filters);
    }
    
    const properties = await this.getPropertiesForCity(filters.city);
    
    // Primeni filtere
    let filtered = properties;
    
    if (filters.min_bedrooms) {
      filtered = filtered.filter(p => (p.bedrooms || 0) >= filters.min_bedrooms!);
    }
    
    if (filters.max_price) {
      filtered = filtered.filter(p => (p.price || 0) <= filters.max_price!);
    }
    
    if (filters.keywords) {
      const keywords = filters.keywords.toLowerCase();
      filtered = filtered.filter(p => 
        (p.address || '').toLowerCase().includes(keywords) ||
        (p.description || '').toLowerCase().includes(keywords)
      );
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
    keywords?: string;
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
      
      if (filters.min_bedrooms) {
        filtered = filtered.filter(p => (p.bedrooms || 0) >= filters.min_bedrooms!);
      }
      
      if (filters.max_price) {
        filtered = filtered.filter(p => (p.price || 0) <= filters.max_price!);
      }
      
      if (filters.keywords) {
        const keywords = filters.keywords.toLowerCase();
        filtered = filtered.filter(p => 
          (p.address || '').toLowerCase().includes(keywords) ||
          (p.description || '').toLowerCase().includes(keywords)
        );
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