import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { ScraperManager } from "./services/scraper-manager";
import { BulkScraper } from "./services/bulk-scraper";
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

  // Get cached property listings (Quick cache search - no scraping)
  app.get("/api/properties", async (req, res) => {
    try {
      const { city, max_price, min_bedrooms, keywords } = req.query;
      
      const filters: any = {};
      if (city) filters.city = city as string;
      if (max_price) filters.max_price = parseInt(max_price as string);
      if (min_bedrooms) filters.min_bedrooms = parseInt(min_bedrooms as string);
      if (keywords) filters.keywords = keywords as string;

      console.log(`🔍 Searching cache for: ${JSON.stringify(filters)}`);
      const listings = await storage.getPropertyListings(filters);
      
      console.log(`📊 Found ${listings.length} properties in cache`);
      
      // Transform listings to match frontend expectations
      const transformedListings = listings.map((listing, index) => ({
        id: listing.id || `cache-${Date.now()}-${index}`,
        source: listing.source || 'cache',
        title: listing.title,
        address: listing.address,
        price: listing.price,
        bedrooms: listing.bedrooms,
        bathrooms: listing.bathrooms,
        description: listing.description,
        property_url: listing.property_url,
        image_url: listing.image_url || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&h=600&fit=crop',
        listing_id: listing.listing_id,
        postcode: listing.postcode,
        city: listing.address?.split(',').pop()?.trim() || filters.city,
        // Add analytics data
        roi: Math.round((13500 / listing.price) * 100) || 2,
        grossYield: Math.round(((13500 / listing.price) * 100) * 10) / 10 || 0.6,
        profitabilityScore: listing.price < 200000 ? "High" : listing.price < 400000 ? "Medium" : "Low",
        lhaWeekly: Math.round((225 * 12) / 52),
        lhaMonthly: 225,
        imageUrl: listing.image_url || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&h=600&fit=crop',
        propertyUrl: listing.property_url,
        coordinates: [listing.latitude || 0, listing.longitude || 0]
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

  // Start property scraping
  app.post("/api/scrape", async (req, res) => {
    try {
      const filters = searchFiltersSchema.parse(req.body);
      
      // Create search query record
      const searchQuery = await storage.createSearchQuery(filters);
      
      // Start scraping (don't await - let it run in background)
      ScraperManager.scrapeProperties({ ...filters, refresh: false })
        .then(async (result) => {
          await storage.updateSearchQuery(searchQuery.id, {
            status: result.success ? 'completed' : 'failed',
            results_count: result.count,
            cache_expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
          });
        })
        .catch(async (error) => {
          console.error("Scraping failed:", error);
          await storage.updateSearchQuery(searchQuery.id, {
            status: 'failed',
            results_count: 0,
          });
        });

      // Update status to running
      await storage.updateSearchQuery(searchQuery.id, { status: 'running' });

      res.json({
        success: true,
        search_id: searchQuery.id,
        message: "Scraping started",
        filters,
      });
    } catch (error) {
      console.error("Failed to start scraping:", error);
      res.status(400).json({
        success: false,
        error: error instanceof z.ZodError ? error.errors : "Invalid request parameters",
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
      const property = await storage.getPropertyListing(id);
      
      if (!property) {
        return res.status(404).json({
          success: false,
          error: "Property not found",
        });
      }

      // Calculate investment analysis
      const analysis = calculatePropertyAnalysis(property);
      
      res.json({
        success: true,
        property,
        analysis,
      });
    } catch (error) {
      console.error("Failed to get property analysis:", error);
      res.status(500).json({
        success: false,
        error: "Failed to retrieve property analysis",
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
