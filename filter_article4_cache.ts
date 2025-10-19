import fs from 'fs/promises';
import path from 'path';
import { article4MapsApiService } from './server/services/article4maps-api-service';

interface CachedProperty {
  address: string;
  postcode: string | null;
  price: number;
  bedrooms: number;
  bathrooms: number;
  image_url: string;
  description: string;
  property_url: string;
  city: string;
  monthly_rent?: number;
  annual_rent?: number;
  gross_yield?: number;
}

const CACHE_BASE_DIR = 'cache/primelocation';

function extractPostcodeFromAddress(address: string): string | null {
  const postcodeRegex = /\b([A-Z]{1,2}\d{1,2}[A-Z]?)\s?\d[A-Z]{2}\b/i;
  const match = address.match(postcodeRegex);
  
  if (match) {
    return match[0].toUpperCase();
  }
  
  const outwardOnlyRegex = /\b([A-Z]{1,2}\d{1,2}[A-Z]?)\b/i;
  const outwardMatch = address.match(outwardOnlyRegex);
  
  if (outwardMatch) {
    return outwardMatch[0].toUpperCase();
  }
  
  return null;
}

async function filterCacheForCity(cityDir: string, cityName: string): Promise<void> {
  console.log(`\n🔍 Processing ${cityName}...`);
  
  try {
    const files = await fs.readdir(cityDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    
    console.log(`📁 Found ${jsonFiles.length} cache files`);
    
    let totalProperties = 0;
    let article4Properties = 0;
    let skippedNoPostcode = 0;
    const postcodeCache = new Map<string, boolean>();
    
    for (const file of jsonFiles) {
      const filePath = path.join(cityDir, file);
      const content = await fs.readFile(filePath, 'utf8');
      const properties: CachedProperty[] = JSON.parse(content);
      
      totalProperties += properties.length;
      
      const filteredProperties: CachedProperty[] = [];
      
      for (const property of properties) {
        const postcode = property.postcode || extractPostcodeFromAddress(property.address);
        
        if (!postcode) {
          skippedNoPostcode++;
          continue;
        }
        
        const outcodeOnly = postcode.split(' ')[0];
        
        let isArticle4 = false;
        if (postcodeCache.has(outcodeOnly)) {
          isArticle4 = postcodeCache.get(outcodeOnly)!;
        } else {
          try {
            const result = await article4MapsApiService.checkArticle4(outcodeOnly);
            isArticle4 = result.has_article4;
            postcodeCache.set(outcodeOnly, isArticle4);
            
            if (postcodeCache.size % 10 === 0) {
              console.log(`  ✓ Checked ${postcodeCache.size} unique postcodes...`);
            }
          } catch (error) {
            console.error(`  ❌ Error checking ${outcodeOnly}:`, error);
            continue;
          }
        }
        
        if (isArticle4) {
          filteredProperties.push(property);
          article4Properties++;
        }
      }
      
      if (filteredProperties.length > 0) {
        await fs.writeFile(filePath, JSON.stringify(filteredProperties, null, 2));
        console.log(`  ✅ ${file}: ${properties.length} → ${filteredProperties.length} properties`);
      } else {
        await fs.unlink(filePath);
        console.log(`  🗑️  ${file}: Deleted (no Article 4 properties)`);
      }
    }
    
    console.log(`\n📊 ${cityName} Summary:`);
    console.log(`  Total properties: ${totalProperties}`);
    console.log(`  Article 4 properties: ${article4Properties}`);
    console.log(`  Skipped (no postcode): ${skippedNoPostcode}`);
    console.log(`  Removal rate: ${((1 - article4Properties/totalProperties) * 100).toFixed(1)}%`);
    
  } catch (error) {
    console.error(`❌ Error processing ${cityName}:`, error);
  }
}

async function main() {
  console.log('🚀 Starting Article 4 cache filter...\n');
  
  if (!article4MapsApiService.isConfigured()) {
    console.error('❌ Article4Maps API key not configured!');
    console.error('Please set ARTICLE4MAPS_API_KEY environment variable.');
    process.exit(1);
  }
  
  const usage = await article4MapsApiService.getUsageStats();
  if (usage) {
    console.log(`📊 API Usage: ${usage.calls_used}/${usage.monthly_quota} calls this month`);
    console.log(`📅 Resets: ${usage.reset_date}\n`);
  }
  
  try {
    const cities = await fs.readdir(CACHE_BASE_DIR);
    
    for (const city of cities) {
      const cityDir = path.join(CACHE_BASE_DIR, city);
      const stat = await fs.stat(cityDir);
      
      if (stat.isDirectory()) {
        await filterCacheForCity(cityDir, city);
      }
    }
    
    console.log('\n✅ Article 4 cache filtering complete!');
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
