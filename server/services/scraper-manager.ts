import { spawn } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { PropertyListing, SearchFilters } from "@shared/schema";

export interface ExtendedSearchFilters extends SearchFilters {
  refresh?: boolean;
}
import { PropertyCache } from "./cache";
import { PropertyDataAPI } from "./property-data-api";
import { storage } from "../storage";
import { PythonSetup } from "./python-setup";

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
  cached?: boolean;
  cache_path?: string;
  error?: string;
}

export class ScraperManager {
  private static readonly PYTHON_SCRIPT_PATH = join(__dirname, "scraper.py");

   //scraper.py
  private static readonly PYTHON_CMD = process.env.NODE_ENV === 'production' ? 'python3' : 'python3';
  private static readonly DEFAULT_TIMEOUT = 1800000; // 30 minutes

  static async searchProperties(filters: ExtendedSearchFilters): Promise<ScrapeResult> {
    return this.runPrimeLocationScraper(filters);
  }

  static async scrapeProperties(filters: ExtendedSearchFilters): Promise<ScrapeResult> {
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

  private static async runPrimeLocationScraper(filters: ExtendedSearchFilters): Promise<ScrapeResult> {
    // Automatski setup Python biblioteka pre pokretanja scrapera
    try {
      await PythonSetup.ensurePythonDependencies();
    } catch (setupError) {
      console.error("❌ Greška pri Python setup-u:", setupError);
      return {
        success: false,
        city: filters.city,
        filters: {
          min_bedrooms: filters.min_bedrooms,
          max_price: filters.max_price,
          sources: ["primelocation"],
        },
        count: 0,
        listings: [],
        scraped_at: new Date().toISOString(),
        error: `Python setup failed: ${setupError}`,
      };
    }

    console.log(`Running PrimeLocation scraper for ${filters.city}...`);
    console.log('Filters:', JSON.stringify(filters));
    
    return new Promise((resolve, reject) => {
      const args = [
        this.PYTHON_SCRIPT_PATH,
        filters.city,
        (filters.min_bedrooms || 1).toString(),
        (filters.max_price || 500000).toString(),
        filters.keywords || ""
      ];

      // Set environment variables for refresh and other settings
      const env = { ...process.env };
      if (filters.refresh) {
        env.REFRESH = "1";
        console.log('Refresh flag set - forcing fresh scrape');
      }
      
      console.log('Spawning Python process with args:', args);
      const pythonProcess = spawn(this.PYTHON_CMD, args, {
        // cwd: __dirname,
        timeout: this.DEFAULT_TIMEOUT,
        env: {
          ...env,
          // Default wider scraping parameters
          PL_EXPAND_SORTS: env.PL_EXPAND_SORTS || "1",
          PL_TYPES: env.PL_TYPES || "property,houses,flats",
          PL_MAX_PAGES_TOTAL: env.PL_MAX_PAGES_TOTAL || "400",
          PL_MIN_RESULTS: env.PL_MIN_RESULTS || "8000",
          PL_WORKERS: env.PL_WORKERS || "12",
          ARTICLE4_MODE: env.ARTICLE4_MODE || "relaxed",
          REQUESTS_TIMEOUT: env.REQUESTS_TIMEOUT || "25",
          PL_PAGE_SIZE: env.PL_PAGE_SIZE || "100",
          PL_MAX_PAGES: env.PL_MAX_PAGES || "60",
        },
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
        console.log(`Python process closed with code: ${code}`);
        console.log('Stdout:', stdout);
        console.log('Stderr:', stderr);
        
        if (code === 0) {
          try {
            let properties;
            try {
              properties = JSON.parse(stdout);
              console.log(`Successfully parsed ${properties?.length || 0} properties from stdout`);
            } catch (parseError) {
              console.error('Failed to parse stdout as JSON:', parseError);
              console.log('Raw stdout:', stdout);
              properties = [];
            }
            
            // Check if we have cached results (the scraper returns cached flag from stderr)
            const cached = stderr.includes("Using cached results");
            const cache_path = stderr.match(/cache\/primelocation\/[^\s]+/)?.[0];
            console.log('Cache status:', { cached, cache_path });
            
            if (properties && properties.length > 0) {
              console.log('Transforming properties for frontend...');
              console.log('Sample property before transform:', JSON.stringify(properties[0], null, 2));
              
              // Transform scraper output to match PropertyWithAnalytics interface
              const transformedProperties = properties.map((prop: any, index: number) => {
                const transformed = {
                  id: `pl-${Date.now()}-${index}`,
                  source: 'primelocation',
                  title: prop.address || 'Property Listing',
                  address: prop.address || '',
                  price: prop.price || 0,
                  bedrooms: prop.bedrooms || 0,
                  bathrooms: prop.bathrooms || 0,
                  description: prop.description || '',
                  property_url: prop.property_url || '',
                  image_url: prop.image_url || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&h=600&fit=crop',
                  listing_id: `pl-${Date.now()}-${index}`,
                  postcode: prop.postcode || '',
                  city: prop.city || filters.city,
                  // Add analytics data from scraper
                  roi: Math.round((prop.gross_yield || 0) * 3.2), // Rough ROI estimate
                  grossYield: prop.gross_yield || 0,
                  profitabilityScore: (prop.gross_yield || 0) > 8 ? 'High' : (prop.gross_yield || 0) > 6 ? 'Medium' : 'Low',
                  lhaWeekly: Math.round((prop.monthly_rent || 0) / 4.33),
                  lhaMonthly: prop.monthly_rent || 0,
                  // Map scraper fields to UI properties
                  imageUrl: prop.image_url,
                  propertyUrl: prop.property_url,
                  coordinates: [0, 0], // Default coordinates
                };
                
                if (index === 0) {
                  console.log('Sample transformed property:', JSON.stringify(transformed, null, 2));
                }
                
                return transformed;
              });
              
              console.log(`Successfully transformed ${transformedProperties.length} properties`);
              
              // KLJUČNO: Sačuvaj podatke u PostgreSQL bazu!
              try {
                console.log('💾 Saving properties to database...');
                
                // Transform to PropertyListing format for database
                const propertyListings = transformedProperties.map((prop: any) => ({
                  source: prop.source || 'primelocation',
                  title: prop.title,
                  address: prop.address,
                  price: prop.price,
                  bedrooms: prop.bedrooms,
                  bathrooms: prop.bathrooms,
                  area_sqm: null,
                  description: prop.description,
                  property_url: prop.property_url,
                  image_url: prop.image_url,
                  listing_id: prop.listing_id,
                  property_type: 'house',
                  tenure: null,
                  postcode: prop.postcode,
                  agent_name: null,
                  agent_phone: null,
                  agent_url: null,
                  latitude: null,
                  longitude: null,
                  date_listed: null,
                }));

                const stored = await storage.createPropertyListings(propertyListings);
                console.log(`✅ Successfully saved ${stored.length} properties to database`);
                
              } catch (dbError) {
                console.error('❌ Failed to save properties to database:', dbError);
                // Continue with transformed data even if DB save fails
              }
              
              const result = {
                success: true,
                city: filters.city,
                filters: {
                  min_bedrooms: filters.min_bedrooms,
                  max_price: filters.max_price,
                  sources: ["primelocation"],
                },
                count: transformedProperties.length,
                listings: transformedProperties,
                scraped_at: new Date().toISOString(),
                cached,
                cache_path,
              };
              
              console.log('Final result:', { 
                success: result.success, 
                count: result.count, 
                cached: result.cached,
                listingsPreview: result.listings.slice(0, 2).map((p: any) => ({ address: p.address, price: p.price })) 
              });
              
              resolve(result);
            } else {
              console.log('No properties found or empty array');
              resolve({
                success: true,
                city: filters.city,
                filters: {
                  min_bedrooms: filters.min_bedrooms,
                  max_price: filters.max_price,
                  sources: ["primelocation"],
                },
                count: 0,
                listings: [],
                scraped_at: new Date().toISOString(),
                cached,
              });
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

  private static async fallbackToPythonScraper(filters: ExtendedSearchFilters): Promise<ScrapeResult> {
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

      const pythonProcess = spawn(this.PYTHON_CMD, args, {
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
