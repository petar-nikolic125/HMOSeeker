import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, boolean, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const propertyListings = pgTable("property_listings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  source: text("source").notNull(), // 'zoopla', 'primelocation', etc.
  title: text("title").notNull(),
  address: text("address").notNull(),
  price: integer("price").notNull(),
  bedrooms: integer("bedrooms"),
  bathrooms: integer("bathrooms"),
  area_sqm: integer("area_sqm"),
  area_estimated: boolean("area_estimated").default(false),
  description: text("description"),
  property_url: text("property_url"),
  image_url: text("image_url"),
  listing_id: text("listing_id"),
  property_type: text("property_type"),
  property_category: text("property_category"),
  tenure: text("tenure"),
  postcode: text("postcode"),
  
  // Article 4 and HMO fields
  article4_area: boolean("article4_area").default(false),
  article4_status: text("article4_status"), // "Full", "Partial", "None"
  hmo_candidate: boolean("hmo_candidate").default(false),
  
  // London-specific fields
  london_borough: text("london_borough"),
  london_district: text("london_district"),
  postcode_district: text("postcode_district"),
  postcode_area: text("postcode_area"),
  
  // Property features
  flat_floor: text("flat_floor"),
  has_garden: boolean("has_garden").default(false),
  has_parking: boolean("has_parking").default(false),
  property_age: text("property_age"),
  
  // Agent information
  agent_name: text("agent_name"),
  agent_phone: text("agent_phone"),
  agent_url: text("agent_url"),
  
  // Location
  latitude: real("latitude"),
  longitude: real("longitude"),
  date_listed: text("date_listed"),
  scraped_at: timestamp("scraped_at").defaultNow().notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const searchQueries = pgTable("search_queries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  city: text("city").notNull(),
  max_price: integer("max_price"),
  min_bedrooms: integer("min_bedrooms"),
  keywords: text("keywords"),
  status: text("status").notNull().default('pending'), // 'pending', 'running', 'completed', 'failed'
  results_count: integer("results_count").default(0),
  cache_expires_at: timestamp("cache_expires_at"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const cacheEntries = pgTable("cache_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cache_key: text("cache_key").notNull().unique(),
  data: jsonb("data").notNull(),
  expires_at: timestamp("expires_at").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// Comprehensive UK Postcodes table for 99.9% accurate Article 4 checking
export const ukPostcodes = pgTable("uk_postcodes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postcode: text("postcode").notNull().unique(), // Full postcode (e.g., "SW1A 1AA")
  outcode: text("outcode").notNull(), // Area code (e.g., "SW1A")
  incode: text("incode").notNull(), // District code (e.g., "1AA")
  
  // Geographic data
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  easting: integer("easting"),
  northing: integer("northing"),
  grid_ref: text("grid_ref"),
  
  // Administrative areas
  country: text("country").notNull().default('England'),
  region: text("region"),
  county: text("county"),
  district: text("district"),
  ward: text("ward"),
  parish: text("parish"),
  
  // London specific
  london_borough: text("london_borough"),
  london_ward: text("london_ward"),
  
  // Article 4 Direction information
  article4_status: text("article4_status").notNull().default('None'), // 'None', 'Full', 'Partial', 'City-Wide'
  article4_areas: jsonb("article4_areas").default('[]'), // Array of overlapping Article 4 areas
  hmo_license_required: boolean("hmo_license_required").default(false),
  
  // Data quality and sources
  accuracy: text("accuracy").notNull().default('high'), // 'high', 'medium', 'low'
  data_sources: jsonb("data_sources").default('[]'), // Sources used for verification
  last_verified: timestamp("last_verified").defaultNow(),
  confidence_score: real("confidence_score").default(0.99), // 0.0 to 1.0
  
  // Metadata
  in_use: boolean("in_use").default(true), // Is postcode active/in use
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  postcodeIdx: index("uk_postcodes_postcode_idx").on(table.postcode),
  outcodeIdx: index("uk_postcodes_outcode_idx").on(table.outcode),
  article4StatusIdx: index("uk_postcodes_article4_status_idx").on(table.article4_status),
  locationIdx: index("uk_postcodes_location_idx").on(table.latitude, table.longitude),
}));

// Article 4 Direction Areas table for detailed area information
export const article4Areas = pgTable("article4_areas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  reference: text("reference").notNull().unique(),
  council: text("council").notNull(),
  
  // Geographic boundary (stored as GeoJSON)
  geometry: jsonb("geometry").notNull(),
  
  // Article 4 details
  status: text("status").notNull().default('Active'), // 'Active', 'Pending', 'Expired', 'Draft'
  direction_type: text("direction_type").notNull().default('HMO'), // 'HMO', 'Extensions', 'Other'
  restrictions: jsonb("restrictions").default('[]'), // Array of specific restrictions
  exemptions: jsonb("exemptions").default('[]'), // Array of exemptions if any
  
  // Implementation dates
  date_made: timestamp("date_made"),
  date_effective: timestamp("date_effective"),
  date_expires: timestamp("date_expires"),
  
  // Coverage area
  is_city_wide: boolean("is_city_wide").default(false),
  postcodes_covered: jsonb("postcodes_covered").default('[]'), // For quick lookup
  
  // Data quality
  data_source: text("data_source").notNull().default('planning.data.gov.uk'),
  verified: boolean("verified").default(false),
  verification_date: timestamp("verification_date"),
  
  // Metadata
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  referenceIdx: index("article4_areas_reference_idx").on(table.reference),
  councilIdx: index("article4_areas_council_idx").on(table.council),
  statusIdx: index("article4_areas_status_idx").on(table.status),
  cityWideIdx: index("article4_areas_city_wide_idx").on(table.is_city_wide),
}));

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertPropertyListingSchema = createInsertSchema(propertyListings).omit({
  id: true,
  created_at: true,
  scraped_at: true,
});

export const insertSearchQuerySchema = createInsertSchema(searchQueries).omit({
  id: true,
  status: true,
  results_count: true,
  cache_expires_at: true,
  created_at: true,
  updated_at: true,
});

export const insertUkPostcodeSchema = createInsertSchema(ukPostcodes).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const insertArticle4AreaSchema = createInsertSchema(article4Areas).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const searchFiltersSchema = z.object({
  city: z.string().min(1, "City is required"),
  max_price: z.number().positive().optional(),
  min_bedrooms: z.number().min(1).optional(),
  max_sqm: z.number().positive().optional(),
  postcode: z.string().optional(),
  keywords: z.string().optional(),
  hmo_candidate: z.boolean().optional(),
  article4_filter: z.enum(["all", "non_article4", "article4_only"]).optional(),
});

export const propertySchema = z.object({
  id: z.string(),
  title: z.string(),
  address: z.string(),
  price: z.number().min(0),
  bedrooms: z.number().min(0),
  bathrooms: z.number().min(0),
  description: z.string().optional(),
  image_url: z.string().optional(),
  property_url: z.string().optional(),
  listing_id: z.string(),
  postcode: z.string().optional(),
  city: z.string(),
  
  // Enhanced HMO and Article 4 fields
  area_sqm: z.number().nullable().optional(),
  area_estimated: z.boolean().optional().default(false),
  article4_area: z.boolean().optional().default(false),
  article4_status: z.string().optional().default("None"),
  hmo_candidate: z.boolean().optional().default(false),
  london_borough: z.string().nullable().optional(),
  london_district: z.string().nullable().optional(),
  postcode_district: z.string().nullable().optional(),
  postcode_area: z.string().nullable().optional(),
  property_category: z.string().optional().default("residential"),
  property_type: z.string().optional().default("unknown"),
  flat_floor: z.string().nullable().optional(),
  has_garden: z.boolean().optional().default(false),
  has_parking: z.boolean().optional().default(false),
  property_age: z.string().nullable().optional(),
  
  // Financial data
  roi: z.number().optional(),
  grossYield: z.number().optional(),
  profitabilityScore: z.string().optional(),
  lhaWeekly: z.number().optional(),
  lhaMonthly: z.number().optional(),
  coordinates: z.array(z.number()).optional(),
  rentMethod: z.string().optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type PropertyListing = typeof propertyListings.$inferSelect;
export type InsertPropertyListing = z.infer<typeof insertPropertyListingSchema>;
export type SearchQuery = typeof searchQueries.$inferSelect;
export type InsertSearchQuery = z.infer<typeof insertSearchQuerySchema>;
export type CacheEntry = typeof cacheEntries.$inferSelect;
export type UkPostcode = typeof ukPostcodes.$inferSelect;
export type InsertUkPostcode = z.infer<typeof insertUkPostcodeSchema>;
export type Article4Area = typeof article4Areas.$inferSelect;
export type InsertArticle4Area = z.infer<typeof insertArticle4AreaSchema>;
export type SearchFilters = z.infer<typeof searchFiltersSchema>;

// Investment analysis types
export type PropertyAnalysis = {
  property_id: string;
  purchase_price: number;
  renovation_cost_per_room: number;
  total_renovation: number;
  bridging_loan_fee: number;
  legal_costs: number;
  total_investment: number;
  monthly_rental_income: number;
  annual_rental_income: number;
  annual_expenses: number;
  net_annual_profit: number;
  gross_yield: number;
  roi: number;
  left_in_deal: number;
  payback_period_years: number;
  cash_flow_monthly: number;
};
