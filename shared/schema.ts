import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
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
  description: text("description"),
  property_url: text("property_url"),
  image_url: text("image_url"),
  listing_id: text("listing_id"),
  property_type: text("property_type"),
  tenure: text("tenure"),
  postcode: text("postcode"),
  agent_name: text("agent_name"),
  agent_phone: text("agent_phone"),
  agent_url: text("agent_url"),
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

export const searchFiltersSchema = z.object({
  city: z.string().min(1, "City is required"),
  max_price: z.number().positive().optional(),
  min_bedrooms: z.number().min(1).optional(),
  keywords: z.string().optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type PropertyListing = typeof propertyListings.$inferSelect;
export type InsertPropertyListing = z.infer<typeof insertPropertyListingSchema>;
export type SearchQuery = typeof searchQueries.$inferSelect;
export type InsertSearchQuery = z.infer<typeof insertSearchQuerySchema>;
export type CacheEntry = typeof cacheEntries.$inferSelect;
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
