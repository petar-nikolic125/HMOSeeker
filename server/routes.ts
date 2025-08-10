import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { ScraperManager } from "./services/scraper-manager";
import { BulkScraper } from "./services/bulk-scraper";
import { SyncScraper } from "./services/sync-scraper";
import { PropertyAnalyzer } from "./services/property-analyzer";
import { CacheDatabase } from "./services/cache-database";
import { searchFiltersSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoint for Railway deployment
  app.get("/health", (req, res) => {
    res.json({ 
      status: "healthy", 
      timestamp: new Date().toISOString(),
      service: "HMO Hunter API"
    });
  });

  // Get cached property listings (Quick cache search - cache je glavna baza!)
  app.get("/api/properties", async (req, res) => {
    try {
      const { city, max_price, min_bedrooms, keywords } = req.query;
      
      // Konvertuj max_price string u integer (1.5M -> 1500000)
      const parsePrice = (priceStr: string): number => {
        if (!priceStr) return 0;
        
        const str = priceStr.toString().toLowerCase().trim();
        
        // Ako je već prost broj
        if (/^\d+$/.test(str)) {
          return parseInt(str);
        }
        
        // Konvertuj format sa M (milioni)
        if (str.includes('m')) {
          const numPart = str.replace('m', '').replace(/[^\d.]/g, '');
          const num = parseFloat(numPart);
          return Math.round(num * 1000000);
        }
        
        // Konvertuj format sa K (hiljade)
        if (str.includes('k')) {
          const numPart = str.replace('k', '').replace(/[^\d.]/g, '');
          const num = parseFloat(numPart);
          return Math.round(num * 1000);
        }
        
        // Fallback - pokušaj osnovni parseInt
        const cleaned = str.replace(/[^\d]/g, '');
        return parseInt(cleaned) || 0;
      };

      const filters: any = {};
      if (city) filters.city = city as string;
      if (max_price) filters.max_price = parsePrice(max_price as string);
      if (min_bedrooms) filters.min_bedrooms = parseInt(min_bedrooms as string);
      if (keywords) filters.keywords = keywords as string;

      console.log(`🔍 Searching cache database for: ${JSON.stringify(filters)}`);
      
      // Koristi CacheDatabase umesto storage
      const properties = await CacheDatabase.searchProperties(filters);
      
      console.log(`📊 Found ${properties.length} properties in cache database`);
      
      // Transform properties to match frontend expectations
      const transformedListings = properties.map((prop, index) => ({
        id: `cache-${Date.now()}-${index}`,
        source: 'primelocation',
        title: prop.address || 'Property Listing',
        address: prop.address || '',
        price: prop.price || 0,
        bedrooms: prop.bedrooms || 0,
        bathrooms: prop.bathrooms || 0,
        description: prop.description || '',
        property_url: prop.property_url || '',
        image_url: prop.image_url || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&h=600&fit=crop',
        listing_id: prop.listing_id || `cache-${Date.now()}-${index}`,
        postcode: prop.postcode || '',
        city: prop.city || filters.city,
        // Add analytics data
        roi: Math.round((prop.gross_yield || 0) * 3.2),
        grossYield: prop.gross_yield || 0,
        profitabilityScore: (prop.gross_yield || 0) > 8 ? 'High' : (prop.gross_yield || 0) > 6 ? 'Medium' : 'Low',
        lhaWeekly: Math.round((prop.monthly_rent || 400) / 4.33),
        lhaMonthly: prop.monthly_rent || 400,
        imageUrl: prop.image_url || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&h=600&fit=crop',
        propertyUrl: prop.property_url,
        coordinates: [0, 0]
      }));
      
      res.json({
        success: true,
        count: transformedListings.length,
        cached: true,
        listings: transformedListings,
      });
    } catch (error) {
      console.error("Failed to get properties:", error);
      res.status(500).json({
        success: false,
        error: "Failed to retrieve properties",
      });
    }
  });

  // Search properties with refresh functionality
  app.get("/api/search", async (req, res) => {
    try {
      const { city, min_bedrooms, max_price, keywords, refresh } = req.query;
      
      if (!city) {
        return res.status(400).json({
          success: false,
          error: "City parameter is required",
        });
      }

      const filters = {
        city: city as string,
        min_bedrooms: min_bedrooms ? parseInt(min_bedrooms as string) : undefined,
        max_price: max_price ? parseInt(max_price as string) : undefined,
        keywords: keywords as string || undefined,
        refresh: refresh === 'true',
      };

      // Use the new scraper with refresh capability
      const result = await ScraperManager.searchProperties(filters);
      
      res.json({
        meta: {
          cached: result.cached,
          cache_path: result.cache_path,
        },
        results: result.listings,
      });
    } catch (error) {
      console.error("Search failed:", error);
      res.status(500).json({
        success: false,
        error: "Search failed",
      });
    }
  });

  // Sync properties - replaces old with current PrimeLocation listings
  app.post("/api/scrape", async (req, res) => {
    try {
      const { city } = req.body;
      
      if (!city) {
        return res.status(400).json({
          success: false,
          error: "City parameter is required",
        });
      }

      // Check if sync is already running
      if (SyncScraper.isSyncRunning()) {
        return res.status(409).json({
          success: false,
          error: "Sync is already running",
        });
      }

      // Start sync for specific city (don't await - let it run in background)
      SyncScraper.syncCity(city)
        .then((result) => {
          console.log(`✅ Sync completed for ${city}:`, result);
        })
        .catch((error) => {
          console.error(`❌ Sync failed for ${city}:`, error);
        });

      res.json({
        success: true,
        message: `Sync started for ${city}`,
        action: "sync_started",
      });
    } catch (error) {
      console.error("Sync failed:", error);
      res.status(500).json({
        success: false,
        error: "Failed to start sync",
      });
    }
  });

  // Bulk sync all cities
  app.post("/api/sync-all", async (req, res) => {
    try {
      // Check if sync is already running
      if (SyncScraper.isSyncRunning()) {
        return res.status(409).json({
          success: false,
          error: "Sync is already running",
        });
      }

      // Start bulk sync (don't await - let it run in background)
      SyncScraper.syncAllCities()
        .then(() => {
          console.log(`✅ Bulk sync completed`);
        })
        .catch((error) => {
          console.error(`❌ Bulk sync failed:`, error);
        });

      res.json({
        success: true,
        message: "Bulk sync started for all cities",
        action: "bulk_sync_started",
      });
    } catch (error) {
      console.error("Bulk sync failed:", error);
      res.status(500).json({
        success: false,
        error: "Failed to start bulk sync",
      });
    }
  });

  // Get sync progress
  app.get("/api/sync-progress", (req, res) => {
    const progress = SyncScraper.getProgress();
    res.json({
      success: true,
      progress,
    });
  });

  // Analyze property or properties with comprehensive financial metrics
  app.post("/api/analyze", async (req, res) => {
    try {
      const { properties, assumptions } = req.body;

      if (!properties || !Array.isArray(properties) || properties.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Properties array is required",
        });
      }

      // Default assumptions for HMO analysis
      const defaultAssumptions = {
        method: 'location' as const,
        annual_expense_rate: 0.30,    // 30% for maintenance, insurance, etc.
        void_rate: 0.05,              // 5% vacancy rate
        management_fee_rate: 0.10,    // 10% management fee
        transaction_costs_rate: 0.05, // 5% transaction costs
        income_tax_rate: 0.20,        // 20% income tax
        mortgage: {
          loan_amount: 0,             // Will be calculated based on LTV
          downpayment: 0,             // Will be calculated
          annual_interest_rate: 0.055, // 5.5% mortgage rate
          term_years: 25,
        },
        ...assumptions,
      };

      console.log(`🧮 Analyzing ${properties.length} properties...`);

      // Analyze each property
      const analysisResults = properties.map((prop: any, index: number) => {
        console.log(`📊 Analyzing property ${index + 1}: ${prop.address || 'Unknown address'}`);
        
        // Convert property to analyzer format
        const propertyInput = {
          price: prop.price || 0,
          bedrooms: prop.bedrooms || 0,
          bathrooms: prop.bathrooms || 0,
          city: prop.city || '',
          postcode: prop.postcode || '',
          address: prop.address || '',
          description: prop.description || '',
        };

        // Calculate mortgage details if needed
        const updatedAssumptions = { ...defaultAssumptions };
        if (propertyInput.price > 0 && defaultAssumptions.mortgage) {
          const ltv = 0.75; // 75% loan-to-value typical for HMO
          const loan_amount = propertyInput.price * ltv;
          const downpayment = propertyInput.price - loan_amount;
          
          updatedAssumptions.mortgage = {
            ...defaultAssumptions.mortgage,
            loan_amount,
            downpayment,
          };
        }

        // Get detailed analysis
        const metrics = PropertyAnalyzer.estimatePropertyMetrics(propertyInput, updatedAssumptions);
        
        // Get scenario analysis (conservative, typical, aggressive)
        const scenarios = PropertyAnalyzer.scenarioReport(propertyInput, updatedAssumptions);

        return {
          original_property: prop,
          analysis: {
            ...metrics,
            scenarios,
            assumptions_used: updatedAssumptions,
          },
        };
      });

      console.log(`✅ Analysis completed for ${analysisResults.length} properties`);

      res.json({
        success: true,
        count: analysisResults.length,
        results: analysisResults,
        summary: {
          total_properties: analysisResults.length,
          avg_gross_yield: analysisResults.reduce((sum, r) => sum + (r.analysis.gross_yield_pct || 0), 0) / analysisResults.length,
          avg_net_yield: analysisResults.reduce((sum, r) => sum + (r.analysis.net_yield_pct || 0), 0) / analysisResults.length,
          avg_cash_on_cash: analysisResults.reduce((sum, r) => sum + (r.analysis.cash_on_cash_pct || 0), 0) / analysisResults.length,
          price_range: {
            min: Math.min(...analysisResults.map(r => r.analysis.price)),
            max: Math.max(...analysisResults.map(r => r.analysis.price)),
          },
        },
      });
    } catch (error) {
      console.error("Analysis failed:", error);
      res.status(500).json({
        success: false,
        error: "Failed to analyze properties",
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get scraping status
  app.get("/api/scrape/:searchId/status", async (req, res) => {
    try {
      const { searchId } = req.params;
      const searchQuery = await storage.getSearchQuery(searchId);
      
      if (!searchQuery) {
        return res.status(404).json({
          success: false,
          error: "Search query not found",
        });
      }

      res.json({
        success: true,
        search_id: searchQuery.id,
        status: searchQuery.status,
        results_count: searchQuery.results_count,
        filters: {
          city: searchQuery.city,
          max_price: searchQuery.max_price,
          min_bedrooms: searchQuery.min_bedrooms,
          keywords: searchQuery.keywords,
        },
        created_at: searchQuery.created_at,
        updated_at: searchQuery.updated_at,
      });
    } catch (error) {
      console.error("Failed to get search status:", error);
      res.status(500).json({
        success: false,
        error: "Failed to retrieve search status",
      });
    }
  });

  // Get property analysis data
  app.get("/api/properties/:id/analysis", async (req, res) => {
    try {
      const { id } = req.params;
      
      console.log(`🔍 Analysis request for property ID: ${id}`);
      
      // Check if this is a cache-based property ID
      if (id.startsWith('cache-')) {
        console.log(`📊 Cache-based property ID detected: ${id}`);
        
        // Extract timestamp and index from cache ID format: cache-timestamp-index
        const parts = id.split('-');
        if (parts.length >= 3) {
          const timestamp = parts[1];
          const index = parseInt(parts[2]);
          
          console.log(`🕒 Extracted timestamp: ${timestamp}, index: ${index}`);
          
          // Try to find the actual property from cache by searching all properties
          // and matching by index position from the same timestamp
          try {
            console.log(`🔍 Searching cache for properties to match index ${index}...`);
            
            // Get all cached properties (without filters to find the exact one)
            const allProperties = await CacheDatabase.searchProperties({});
            console.log(`📄 Found ${allProperties.length} total cached properties`);
            
            // Use the index to get the specific property
            if (index < allProperties.length && allProperties[index]) {
              const cachedProperty = allProperties[index];
              console.log(`✅ Found cached property at index ${index}: ${cachedProperty.address}`);
              
              // Convert cache property to analysis format
              const propertyForAnalysis = {
                id: id,
                title: cachedProperty.address || 'HMO Property',
                address: cachedProperty.address || '',
                price: cachedProperty.price || 450000,
                bedrooms: cachedProperty.bedrooms || 4,
                bathrooms: cachedProperty.bathrooms || 2,
                city: cachedProperty.city || 'London',
                postcode: cachedProperty.postcode || '',
                description: cachedProperty.description || 'Multi-bedroom property'
              };
              
              console.log(`📈 Generating analysis for real cached property: ${propertyForAnalysis.address}`);
              
              // Use the existing analysis function
              const analysis = calculatePropertyAnalysis(propertyForAnalysis);
              
              console.log(`✅ Analysis completed for cached property ${id}`);
              
              return res.json({
                success: true,
                property: propertyForAnalysis,
                analysis,
                source: 'cache',
                cache_info: {
                  timestamp,
                  index,
                  original_cache_data: cachedProperty
                }
              });
            } else {
              console.log(`❌ Property index ${index} not found in cache (total: ${allProperties.length})`);
              return res.status(404).json({
                success: false,
                error: `Property index ${index} not found in cache`,
              });
            }
          } catch (cacheError) {
            console.error(`❌ Error accessing cache for property ${id}:`, cacheError);
            return res.status(500).json({
              success: false,
              error: "Failed to access cache data",
              details: cacheError instanceof Error ? cacheError.message : 'Unknown cache error'
            });
          }
        } else {
          console.log(`❌ Invalid cache ID format: ${id}`);
          return res.status(400).json({
            success: false,
            error: "Invalid cache property ID format",
          });
        }
      }
      
      // Try to get property from storage (legacy path)
      console.log(`🗄️ Looking up property in storage: ${id}`);
      const property = await storage.getPropertyListing(id);
      
      if (!property) {
        console.log(`❌ Property not found in storage: ${id}`);
        return res.status(404).json({
          success: false,
          error: "Property not found",
        });
      }

      // Calculate investment analysis
      const analysis = calculatePropertyAnalysis(property);
      
      console.log(`✅ Analysis completed for storage property ${id}`);
      
      res.json({
        success: true,
        property,
        analysis,
        source: 'storage'
      });
    } catch (error) {
      console.error("Failed to get property analysis:", error);
      res.status(500).json({
        success: false,
        error: "Failed to retrieve property analysis",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Bulk scraping endpoints
  app.post("/api/bulk-scrape", async (req, res) => {
    try {
      console.log("🚀 Starting bulk scrape for all UK cities...");
      
      // Start bulk scraping in background (don't await)
      BulkScraper.startBulkScrape().catch(error => {
        console.error("Bulk scraping failed:", error);
      });

      res.json({
        success: true,
        message: "Bulk scraping started for all UK cities",
        cities_count: BulkScraper.getCityList().length,
        status: "running"
      });
    } catch (error) {
      console.error("Failed to start bulk scraping:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to start bulk scraping",
      });
    }
  });

  // Get bulk scraping progress
  app.get("/api/bulk-scrape/progress", (req, res) => {
    const progress = BulkScraper.getProgress();
    res.json({
      success: true,
      progress
    });
  });

  // Stop bulk scraping
  app.post("/api/bulk-scrape/stop", (req, res) => {
    BulkScraper.stop();
    res.json({
      success: true,
      message: "Bulk scraping stopped"
    });
  });

  // Bulk insert properties endpoint (for cache population)
  app.post("/api/properties/bulk-insert", async (req, res) => {
    try {
      const { properties } = req.body;
      
      if (!Array.isArray(properties) || properties.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Properties array is required"
        });
      }

      console.log(`📥 Bulk inserting ${properties.length} properties...`);
      
      // Transform to storage format
      const propertyListings = properties.map((prop: any) => ({
        source: prop.source || 'primelocation',
        title: prop.title || 'Property Listing',
        address: prop.address || '',
        price: prop.price || 0,
        bedrooms: prop.bedrooms || 0,
        bathrooms: prop.bathrooms || 0,
        area_sqm: prop.area_sqm || null,
        description: prop.description || '',
        property_url: prop.property_url || '',
        image_url: prop.image_url || '',
        listing_id: prop.listing_id || `bulk-${Date.now()}-${Math.random()}`,
        property_type: prop.property_type || 'house',
        tenure: prop.tenure || null,
        postcode: prop.postcode || '',
        agent_name: prop.agent_name || null,
        agent_phone: prop.agent_phone || null,
        agent_url: prop.agent_url || null,
        latitude: prop.latitude || null,
        longitude: prop.longitude || null,
        date_listed: prop.date_listed || null,
      }));

      const saved = await storage.createPropertyListings(propertyListings);
      
      console.log(`✅ Successfully saved ${saved.length} properties to database`);
      
      res.json({
        success: true,
        saved_count: saved.length,
        message: `Successfully saved ${saved.length} properties`
      });
      
    } catch (error) {
      console.error("Bulk insert failed:", error);
      res.status(500).json({
        success: false,
        error: "Failed to save properties to database"
      });
    }
  });

  // Cache database statistics
  app.get("/api/cache/stats", async (req, res) => {
    try {
      const totalProperties = await CacheDatabase.getTotalPropertiesCount();
      const cachedCities = await CacheDatabase.getCachedCities();
      
      res.json({
        success: true,
        total_properties: totalProperties,
        cached_cities: cachedCities,
        cities_count: cachedCities.length
      });
    } catch (error) {
      console.error("Failed to get cache stats:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get cache statistics"
      });
    }
  });

  // Cleanup old data endpoint (for maintenance)
  app.post("/api/cleanup", async (req, res) => {
    try {
      await ScraperManager.cleanupOldData();
      res.json({
        success: true,
        message: "Cleanup completed",
      });
    } catch (error) {
      console.error("Cleanup failed:", error);
      res.status(500).json({
        success: false,
        error: "Cleanup failed",
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

function calculatePropertyAnalysis(property: any) {
  const purchasePrice = property.price;
  const renovationCostPerRoom = 17000; // Default value
  const bedrooms = property.bedrooms || 4;
  
  const totalRenovation = renovationCostPerRoom * bedrooms;
  const bridgingLoanFee = 30000;
  const legalCosts = 15000;
  const totalInvestment = purchasePrice + totalRenovation + bridgingLoanFee + legalCosts;
  
  // UK HMO rental estimates
  const monthlyRentalPerRoom = 400; // Local Housing Allowance rate
  const monthlyRentalIncome = monthlyRentalPerRoom * bedrooms;
  const annualRentalIncome = monthlyRentalIncome * 12;
  
  // Annual expenses (management, insurance, maintenance, etc.)
  const annualExpenses = annualRentalIncome * 0.25; // 25% of income
  const netAnnualProfit = annualRentalIncome - annualExpenses;
  
  // Financial metrics
  const grossYield = (annualRentalIncome / purchasePrice) * 100;
  const roi = (netAnnualProfit / totalInvestment) * 100;
  
  // Financing assumptions (75% LTV)
  const leftInDeal = totalInvestment * 0.25;
  const paybackPeriodYears = leftInDeal / netAnnualProfit;
  const cashFlowMonthly = netAnnualProfit / 12;

  return {
    property_id: property.id,
    purchase_price: purchasePrice,
    renovation_cost_per_room: renovationCostPerRoom,
    total_renovation: totalRenovation,
    bridging_loan_fee: bridgingLoanFee,
    legal_costs: legalCosts,
    total_investment: totalInvestment,
    monthly_rental_income: monthlyRentalIncome,
    annual_rental_income: annualRentalIncome,
    annual_expenses: annualExpenses,
    net_annual_profit: netAnnualProfit,
    gross_yield: Math.round(grossYield * 10) / 10,
    roi: Math.round(roi * 10) / 10,
    left_in_deal: leftInDeal,
    payback_period_years: Math.round(paybackPeriodYears * 10) / 10,
    cash_flow_monthly: Math.round(cashFlowMonthly),
  };
}
