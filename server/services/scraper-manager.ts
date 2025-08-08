import { spawn } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { PropertyListing, SearchFilters } from "@shared/schema";
import { PropertyCache } from "./cache";
import { PropertyDataAPI } from "./property-data-api";
import { storage } from "../storage";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface ScrapeResult {
  success: boolean;
  city: string;
  filters: {
    min_bedrooms?: number;
    max_price?: number;
    sources: string[];
  };
  count: number;
  listings: PropertyListing[];
  scraped_at: string;
  error?: string;
}

export class ScraperManager {
  private static readonly PYTHON_SCRIPT_PATH = join(__dirname, "scraper.py");
  private static readonly DEFAULT_TIMEOUT = 120000; // 2 minutes

  static async scrapeProperties(filters: SearchFilters): Promise<ScrapeResult> {
    // Check cache first
    const cachedListings = await PropertyCache.get(filters);
    if (cachedListings) {
      console.log(`Cache hit for ${filters.city}`);
      return {
        success: true,
        city: filters.city,
        filters: {
          min_bedrooms: filters.min_bedrooms,
          max_price: filters.max_price,
          sources: ["property_data", "land_registry"],
        },
        count: cachedListings.length,
        listings: cachedListings,
        scraped_at: new Date().toISOString(),
      };
    }

    console.log(`Cache miss for ${filters.city}, fetching property data...`);

    try {
      // Try authentic property data API first
      const listings = await PropertyDataAPI.searchProperties(filters);
      
      if (listings && listings.length > 0) {
        // Store in database
        const propertyListings = listings.map(listing => ({
          source: listing.source,
          title: listing.title,
          address: listing.address,
          price: listing.price,
          bedrooms: listing.bedrooms,
          bathrooms: listing.bathrooms,
          area_sqm: listing.area_sqm,
          description: listing.description,
          property_url: listing.property_url,
          image_url: listing.image_url,
          listing_id: listing.listing_id,
          property_type: listing.property_type,
          tenure: listing.tenure,
          postcode: listing.postcode,
          agent_name: listing.agent_name,
          agent_phone: listing.agent_phone,
          agent_url: listing.agent_url,
          latitude: listing.latitude,
          longitude: listing.longitude,
          date_listed: listing.date_listed,
        }));

        const stored = await storage.createPropertyListings(propertyListings);
        
        // Cache the results
        await PropertyCache.set(filters, stored);
        
        return {
          success: true,
          city: filters.city,
          filters: {
            min_bedrooms: filters.min_bedrooms,
            max_price: filters.max_price,
            sources: ["zoopla", "primelocation"],
          },
          count: stored.length,
          listings: stored,
          scraped_at: new Date().toISOString(),
        };
      }
      
      // If no properties found, return empty result
      return {
        success: true,
        city: filters.city,
        filters: {
          min_bedrooms: filters.min_bedrooms,
          max_price: filters.max_price,
          sources: ["zoopla", "primelocation"],
        },
        count: 0,
        listings: [],
        scraped_at: new Date().toISOString(),
      };
      
    } catch (error) {
      console.error("Python scraper error:", error);
      
      // Return error result
      return {
        success: false,
        city: filters.city,
        filters: {
          min_bedrooms: filters.min_bedrooms,
          max_price: filters.max_price,
          sources: ["zoopla", "primelocation"],
        },
        count: 0,
        listings: [],
        scraped_at: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private static async fallbackToPythonScraper(filters: SearchFilters): Promise<ScrapeResult> {
    console.log("Falling back to Python scraper...");
    
    return new Promise((resolve, reject) => {
      const args = [this.PYTHON_SCRIPT_PATH, filters.city];
      
      if (filters.min_bedrooms) {
        args.push("--min-bedrooms", filters.min_bedrooms.toString());
      }
      if (filters.max_price) {
        args.push("--max-price", filters.max_price.toString());
      }
      
      args.push("--sources", "zoopla", "primelocation");
      args.push("--limit", "30");
      args.push("--max-pages", "2");
      args.push("--verbose");

      const pythonProcess = spawn("python3", args, {
        cwd: __dirname,
        timeout: this.DEFAULT_TIMEOUT,
      });

      let stdout = "";
      let stderr = "";

      pythonProcess.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      pythonProcess.on("close", async (code) => {
        if (code === 0) {
          try {
            const result: ScrapeResult = JSON.parse(stdout);
            
            if (result.success && result.listings.length > 0) {
              // Store in database
              const propertyListings = result.listings.map(listing => ({
                source: listing.source,
                title: listing.title,
                address: listing.address,
                price: listing.price,
                bedrooms: listing.bedrooms,
                bathrooms: listing.bathrooms,
                area_sqm: listing.area_sqm,
                description: listing.description,
                property_url: listing.property_url,
                image_url: listing.image_url,
                listing_id: listing.listing_id,
                property_type: listing.property_type,
                tenure: listing.tenure,
                postcode: listing.postcode,
                agent_name: listing.agent_name,
                agent_phone: listing.agent_phone,
                agent_url: listing.agent_url,
                latitude: listing.latitude,
                longitude: listing.longitude,
                date_listed: listing.date_listed,
              }));

              const stored = await storage.createPropertyListings(propertyListings);
              
              // Cache the results
              await PropertyCache.set(filters, stored);
              
              resolve({
                ...result,
                listings: stored,
              });
            } else {
              resolve(result);
            }
          } catch (parseError) {
            console.error("Failed to parse scraper output:", parseError);
            console.error("Stdout:", stdout);
            console.error("Stderr:", stderr);
            reject(new Error(`Failed to parse scraper output: ${parseError}`));
          }
        } else {
          console.error("Scraper failed with code:", code);
          console.error("Stderr:", stderr);
          reject(new Error(`Scraper failed with exit code ${code}: ${stderr}`));
        }
      });

      pythonProcess.on("error", (error) => {
        console.error("Failed to start Python scraper:", error);
        reject(new Error(`Failed to start scraper: ${error.message}`));
      });
    });
  }

  static async cleanupOldData(): Promise<void> {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    await storage.deleteOldListings(oneDayAgo);
    await PropertyCache.clearAll();
  }
}
