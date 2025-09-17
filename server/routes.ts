import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { ScraperManager } from "./services/scraper-manager";
import { BulkScraper } from "./services/bulk-scraper";
import { SyncScraper } from "./services/sync-scraper";
import { PropertyAnalyzer } from "./services/property-analyzer";
import { CacheDatabase } from "./services/cache-database";
import { estimatePropertyMetrics, scenarioReport, type PropertyData, type Assumptions } from "./services/property-estimation";
import { predictPropertySize, extractReceptionsFromText } from "./services/property-size-predictor";
import { enhancedArticle4Service } from "./services/enhanced-article4-service";
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

  // Article 4 check endpoint
  app.get("/api/check", async (req, res) => {
    try {
      const { postcode } = req.query;

      if (!postcode || typeof postcode !== 'string') {
        return res.status(400).json({
          success: false,
          error: "Postcode parameter is required"
        });
      }

      // Validate postcode format - accepts both full postcodes (SW1A 1AA) and partial postcodes (SW1A, UB4, DA14)
      const postcodeRegex = /^[A-Z]{1,2}[0-9]{1,2}[A-Z]?(\s?[0-9][A-Z]{2})?$/i;
      if (!postcodeRegex.test(postcode.trim())) {
        return res.status(400).json({
          success: false,
          error: "Invalid postcode format"
        });
      }

      // Set cache headers for 60s CDN caching
      res.set({
        'Cache-Control': 'public, max-age=60, s-maxage=60',
        'Vary': 'Accept-Encoding'
      });

      const result = await enhancedArticle4Service.checkArticle4Status(postcode.trim());
      
      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error("Article 4 check failed:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to check Article 4 status"
      });
    }
  });

  // Enhanced health endpoint with Article 4 cache info
  app.get("/api/health", async (req, res) => {
    try {
      const systemHealth = await enhancedArticle4Service.getSystemHealth();

      res.json({
        success: true,
        status: "healthy",
        timestamp: new Date().toISOString(),
        service: "HMO Hunter API",
        systemHealth
      });
    } catch (error) {
      console.error("Health check failed:", error);
      res.status(500).json({
        success: false,
        status: "unhealthy",
        error: "Health check failed"
      });
    }
  });

  // Article 4 areas API endpoint for map overlays
  app.get("/api/article4-areas", async (req, res) => {
    try {
      const { lat, lng, radius } = req.query;
      
      if (!lat || !lng) {
        return res.status(400).json({
          success: false,
          error: "Latitude and longitude parameters are required"
        });
      }

      const latitude = parseFloat(lat as string);
      const longitude = parseFloat(lng as string);
      const radiusKm = parseFloat(radius as string) || 2; // Default 2km radius

      if (isNaN(latitude) || isNaN(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        return res.status(400).json({
          success: false,
          error: "Invalid latitude or longitude values"
        });
      }

      // Set cache headers for longer caching since Article 4 areas don't change frequently
      res.set({
        'Cache-Control': 'public, max-age=3600, s-maxage=3600', // 1 hour cache
        'Vary': 'Accept-Encoding'
      });

      // Get Article 4 areas in the specified region (simplified for now)
      const systemHealth = await enhancedArticle4Service.getSystemHealth();
      const areas = systemHealth.geographic.available ? 
        await getArticle4AreasForRegion(latitude, longitude, radiusKm) : [];
      
      res.json({
        success: true,
        count: areas.length,
        areas: areas,
        center: { lat: latitude, lng: longitude },
        radius_km: radiusKm
      });
    } catch (error) {
      console.error("Article 4 areas request failed:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch Article 4 areas"
      });
    }
  });

  // Helper function to get Article 4 areas in a region (simplified implementation)
  async function getArticle4AreasForRegion(lat: number, lng: number, radiusKm: number) {
    // For now, return an empty array since we need proper spatial indexing for production
    // In a production system, you would implement proper spatial queries
    return [];
  }

  // Get cached property listings (Quick cache search - cache je glavna baza!)
  app.get("/api/properties", async (req, res) => {
    try {
      const { city, max_price, min_bedrooms, min_sqm, max_sqm, postcode, keywords, hmo_candidate, article4_filter, page, limit, shuffle } = req.query;
      
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
      if (min_sqm) filters.min_sqm = parseInt(min_sqm as string);
      if (max_sqm) filters.max_sqm = parseInt(max_sqm as string);
      if (postcode) filters.postcode = postcode as string;
      if (keywords) filters.keywords = keywords as string;
      if (hmo_candidate !== undefined) filters.hmo_candidate = hmo_candidate === 'true';
      if (article4_filter && article4_filter !== "all") filters.article4_filter = article4_filter as "non_article4" | "article4_only";

      // Add pagination parameters
      const pageNum = parseInt(page as string) || 1;
      const pageSize = parseInt(limit as string) || 20;
      const offset = (pageNum - 1) * pageSize;

      console.log(`🔍 Searching cache database for: ${JSON.stringify(filters)}`);
      console.log(`📄 Pagination: page ${pageNum}, showing ${pageSize} results (offset: ${offset})`);
      
      // Get ALL properties first (for total count)
      let allProperties = await CacheDatabase.searchProperties(filters);
      const totalResults = allProperties.length;
      
      // Helper functions for property type extraction and sorting
      const getPropertyTypeFromTitle = (title: string): string => {
        const titleLower = title.toLowerCase();
        // Check for semi-detached first (more specific than detached)
        if (titleLower.includes('semi-detached') || titleLower.includes('semi detached')) return 'semi-detached';  
        if (titleLower.includes('detached house')) return 'detached';
        if (titleLower.includes('terraced house') || titleLower.includes('terrace house') || titleLower.includes('end terrace')) return 'terraced';
        if (titleLower.includes('house')) return 'house';
        if (titleLower.includes('flat') || titleLower.includes('apartment') || titleLower.includes('maisonette')) return 'flat';
        return 'unknown';
      };

      const getPropertyTypePriority = (type: string): number => {
        switch(type) {
          case 'detached': return 1;
          case 'house': return 2; 
          case 'terraced': return 3;
          case 'semi-detached': return 4;
          case 'flat': return 5;
          default: return 6;
        }
      };

      // Intelligent sorting and shuffling logic
      if (shuffle === 'true') {
        console.log(`🎲 Smart shuffling ${allProperties.length} properties (good properties prioritized)...`);
        
        // First, sort to identify quality tiers
        allProperties.sort((a, b) => {
          const typeA = getPropertyTypeFromTitle(a.address || a.title || '');
          const typeB = getPropertyTypeFromTitle(b.address || b.title || '');
          const priorityA = getPropertyTypePriority(typeA);
          const priorityB = getPropertyTypePriority(typeB);
          
          // Quality score calculation
          const getQualityScore = (prop: any, type: string, priority: number) => {
            const isHouse = priority <= 2; // detached or house
            const isNonArticle4 = !prop.article4_area;
            const sqm = prop.area_sqm || prop.predicted_sqm || 75;
            const distanceFrom90 = Math.abs(sqm - 90);
            const yield_score = prop.gross_yield_pct || 0;
            
            let score = 0;
            if (isHouse) score += 100;
            if (isNonArticle4) score += 50;
            score += Math.max(0, 40 - distanceFrom90); // More points for closer to 90sqm
            score += yield_score * 2; // Yield bonus
            
            return score;
          };
          
          const scoreA = getQualityScore(a, typeA, priorityA);
          const scoreB = getQualityScore(b, typeB, priorityB);
          return scoreB - scoreA; // Higher scores first
        });
        
        // Take top 40% as premium properties
        const premiumCount = Math.floor(allProperties.length * 0.4);
        const premiumProps = allProperties.slice(0, premiumCount);
        const regularProps = allProperties.slice(premiumCount);
        
        // Shuffle within tiers
        const shuffleArray = (arr: any[]) => {
          for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
          }
          return arr;
        };
        
        // Combine: shuffled premium props first, then shuffled regular props
        allProperties = [...shuffleArray([...premiumProps]), ...shuffleArray([...regularProps])];
        console.log(`✅ Smart shuffle: ${premiumCount} premium properties first, then ${regularProps.length} others`);
        
      } else {
        // Standard intelligent sorting (optimal HMO)
        allProperties.sort((a, b) => {
          const typeA = getPropertyTypeFromTitle(a.address || a.title || '');
          const typeB = getPropertyTypeFromTitle(b.address || b.title || '');
          const priorityA = getPropertyTypePriority(typeA);
          const priorityB = getPropertyTypePriority(typeB);
          
          // Primary sort: by property type priority (houses first)
          if (priorityA !== priorityB) {
            return priorityA - priorityB;
          }
          
          // Secondary sort: non-Article 4 areas first
          const article4A = a.article4_area || false;
          const article4B = b.article4_area || false;
          if (article4A !== article4B) {
            return article4A ? 1 : -1; // non-Article 4 (false) comes first
          }
          
          // Tertiary sort: proximity to 90 sqm (90 sqm first, then closest to 90)
          const sqmA = a.area_sqm || a.predicted_sqm || 75; // fallback to typical 3-bed size
          const sqmB = b.area_sqm || b.predicted_sqm || 75;
          
          // Calculate distance from ideal 90 sqm
          const distanceA = Math.abs(sqmA - 90);
          const distanceB = Math.abs(sqmB - 90);
          
          if (distanceA !== distanceB) {
            return distanceA - distanceB; // Closer to 90 sqm comes first
          }
          
          // If same distance from 90, prefer the larger property (e.g., 91 over 89)
          if (distanceA === distanceB && sqmA !== sqmB) {
            return sqmB - sqmA;
          }
          
          // Final sort: by gross yield (higher yield first)
          const yieldA = a.gross_yield_pct || 0;
          const yieldB = b.gross_yield_pct || 0;
          return yieldB - yieldA;
        });
        console.log(`🏠 Properties sorted by: 1) Houses first 2) Non-Article 4 areas 3) Proximity to 90 sqm 4) Gross yield`);
      }
      
      // Apply pagination to results
      const paginatedProperties = allProperties.slice(offset, offset + pageSize);
      
      console.log(`📊 Found ${totalResults} total properties, showing ${paginatedProperties.length} on page ${pageNum}`);
      
      // Transform properties to match frontend expectations with real calculations
      const transformedListings = paginatedProperties.map((prop, index) => {
        // Calculate real metrics for each property
        const propertyData: PropertyData = {
          price: prop.price || 0,
          bedrooms: prop.bedrooms || 0,
          bathrooms: prop.bathrooms || 0,
          city: prop.city || '',
          postcode: prop.postcode || '',
          address: prop.address || ''
        };

        const quickMetrics = estimatePropertyMetrics(propertyData, {
          method: 'location',
          annual_expense_rate: 0.30,
          void_rate: 0.05,
          management_fee_rate: 0.10,
          renovation_cost_per_room: 17000,
          mortgage: {
            loan_amount: (prop.price || 0) * 0.75,
            downpayment: (prop.price || 0) * 0.25,
            annual_interest_rate: 0.055,
            term_years: 25,
          },
        });

        const grossYield = quickMetrics.gross_yield_pct || 0;
        const monthlyRent = quickMetrics.estimated_monthly_rent || 400;
        const roi = quickMetrics.cash_on_cash_pct || 0;

        // Extract and enhance property type from title
        const extractedPropertyType = getPropertyTypeFromTitle(prop.address || prop.title || '');
        const finalPropertyType = extractedPropertyType !== 'unknown' ? extractedPropertyType : prop.property_type || 'unknown';

        // Always generate size prediction with ranges
        const prediction = predictPropertySize({
          bedrooms: prop.bedrooms || 0,
          bathrooms: prop.bathrooms,
          receptions: extractReceptionsFromText(prop.title || '', prop.address || ''),
          price: prop.price || 0,
          city: prop.city || '',
          propertyType: finalPropertyType,
          address: prop.address || ''
        });
        
        let areaSqm = prop.area_sqm;
        let predictedSqm, predictedSqft, areaEstimated;
        
        // Only use predicted values if actual area is missing
        if (!areaSqm || areaSqm === 0) {
          areaSqm = prediction.predictedSqm;
          predictedSqm = prediction.predictedSqm;
          predictedSqft = prediction.predictedSqft;
          areaEstimated = true;
        }

        return {
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
          
          // Enhanced HMO and Article 4 fields
          area_sqm: areaSqm,
          area_estimated: areaEstimated || prop.area_estimated || false,
          article4_area: prop.article4_area || false,
          article4_status: prop.article4_status || "None",
          hmo_candidate: prop.hmo_candidate || false,
          london_borough: prop.london_borough || null,
          london_district: prop.london_district || null,
          postcode_district: prop.postcode_district || null,
          postcode_area: prop.postcode_area || null,
          property_category: prop.property_category || "residential",
          property_type: finalPropertyType,
          flat_floor: prop.flat_floor || null,
          has_garden: prop.has_garden || false,
          has_parking: prop.has_parking || false,
          property_age: prop.property_age || null,
          
          // Real calculated analytics data
          roi: Math.round(roi * 10) / 10,
          grossYield: Math.round(grossYield * 10) / 10,
          profitabilityScore: grossYield > 8 ? 'High' : grossYield > 6 ? 'Medium' : 'Low',
          lhaWeekly: Math.round(monthlyRent / 4.33),
          lhaMonthly: Math.round(monthlyRent),
          imageUrl: prop.image_url || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&h=600&fit=crop',
          propertyUrl: prop.property_url,
          coordinates: [0, 0],
          // Include rent calculation method for debugging
          rentMethod: quickMetrics.rent_method_used,
          
          // Size-related fields with ranges
          size: areaSqm,
          predictedSqm,
          predictedSqft,
          sqm_range_min: prediction.sqmRange.min,
          sqm_range_max: prediction.sqmRange.max,
          sqft_range_min: prediction.sqftRange.min,
          sqft_range_max: prediction.sqftRange.max,
          sizePredictionConfidence: prediction.confidence,
          sizePredictionBasis: prediction.basis,
          areaEstimated: areaEstimated || prop.area_estimated || false
        };
      });
      
      res.json({
        success: true,
        count: transformedListings.length,
        total: totalResults,
        page: pageNum,
        limit: pageSize,
        hasMore: (pageNum * pageSize) < totalResults,
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

      // Default assumptions for HMO analysis using new system
      const defaultAssumptions: Assumptions = {
        method: 'location',
        annual_expense_rate: 0.30,
        void_rate: 0.05,
        management_fee_rate: 0.10,
        transaction_costs_rate: 0.05,
        income_tax_rate: 0.20,
        renovation_cost_per_room: 17000,
        mortgage: {
          annual_interest_rate: 0.055,
          term_years: 25,
        },
        ...assumptions,
      };

      console.log(`🧮 Analyzing ${properties.length} properties with new estimation system...`);

      // Analyze each property
      const analysisResults = properties.map((prop: any, index: number) => {
        console.log(`📊 Analyzing property ${index + 1}: ${prop.address || 'Unknown address'}`);
        
        // Convert property to new format
        const propertyData: PropertyData = {
          price: prop.price || 0,
          bedrooms: prop.bedrooms || 0,
          bathrooms: prop.bathrooms || 0,
          city: prop.city || '',
          postcode: prop.postcode || '',
          address: prop.address || '',
        };

        // Calculate mortgage details
        const updatedAssumptions = { ...defaultAssumptions };
        if (propertyData.price > 0) {
          const ltv = 0.75; // 75% loan-to-value typical for HMO
          const loan_amount = propertyData.price * ltv;
          const downpayment = propertyData.price - loan_amount;
          
          updatedAssumptions.mortgage = {
            ...updatedAssumptions.mortgage,
            loan_amount,
            downpayment,
          };
        }

        // Get detailed analysis using new system
        const metrics = estimatePropertyMetrics(propertyData, updatedAssumptions);
        
        // Get scenario analysis (conservative, typical, aggressive)
        const scenarios = scenarioReport(propertyData, updatedAssumptions);

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
      
      const renovationCost = req.query.renovation_cost ? Number(req.query.renovation_cost) : 17000;
      const rentPerBedroom = req.query.rent_per_bedroom ? Number(req.query.rent_per_bedroom) : null;
      
      console.log(`🔍 Analysis request for property ID: ${id}, renovation: £${renovationCost}, rent: £${rentPerBedroom || 'auto'}/bed`);
      
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
              
              // Use the new property estimation system with real city data
              const propertyData: PropertyData = {
                price: propertyForAnalysis.price,
                bedrooms: propertyForAnalysis.bedrooms,
                bathrooms: propertyForAnalysis.bathrooms,
                city: propertyForAnalysis.city,
                postcode: propertyForAnalysis.postcode,
                address: propertyForAnalysis.address
              };

              // Use renovation cost from earlier extraction

              const assumptions: Assumptions = {
                method: 'location',
                annual_expense_rate: 0.30,
                void_rate: 0.05,
                management_fee_rate: 0.10,
                transaction_costs_rate: 0.05,
                income_tax_rate: 0.20,
                renovation_cost_per_room: renovationCost,
                custom_rent_per_bedroom: rentPerBedroom || undefined, // Pass custom rent to estimation system
                mortgage: {
                  loan_amount: propertyForAnalysis.price * 0.75, // 75% LTV
                  downpayment: propertyForAnalysis.price * 0.25,
                  annual_interest_rate: 0.055,
                  term_years: 25,
                },
              };

              const metrics = estimatePropertyMetrics(propertyData, assumptions);
              const scenarios = scenarioReport(propertyData, assumptions);

              const analysis = {
                ...metrics,
                scenarios,
                assumptions_used: assumptions,
              };
              
              console.log(`✅ Analysis completed for cached property ${id} (${metrics.rent_method_used})`);
              
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
