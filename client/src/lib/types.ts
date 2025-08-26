import type { PropertyListing } from '@shared/schema';

export interface SearchFilters {
  city: string;
  minRooms?: number;
  maxPrice?: number;
  minSqm?: number;
  maxSqm?: number;
  postcode?: string;
  keywords?: string;
  hmo_candidate?: boolean;
  article4_filter?: "all" | "non_article4" | "article4_only";
}

export interface PropertyWithAnalytics extends PropertyListing {
  // Investment analytics
  roi?: number;
  grossYield?: number;
  profitabilityScore?: string;

  // LHA and rental data
  lhaWeekly?: number;
  lhaMonthly?: number;

  // Property URLs for different portals
  rightmoveUrl?: string;
  zooplaUrl?: string;
  primeLocationUrl?: string;

  // UI properties that map to schema fields
  imageUrl?: string;  // Maps to image_url
  propertyUrl?: string; // Maps to property_url
  agentName?: string; // Maps to agent_name
  agentPhone?: string; // Maps to agent_phone
  agentEmail?: string; // Not in schema but can be added
  coordinates?: [number, number]; // Maps to latitude/longitude
  size?: number; // Property size in sqm (from area_sqm or predicted)

  // Property size fields
  area_sqm?: number;
  predicted_sqm?: number;
  predicted_sqft?: number;
  area_estimated?: boolean;
  sqm_range_min?: number;
  sqm_range_max?: number;
  sqft_range_min?: number;
  sqft_range_max?: number;
  size_prediction_confidence?: string;
  size_prediction_basis?: string;
}

export interface CacheEntry {
  data: PropertyWithAnalytics[];
  timestamp: number;
  searchQuery: SearchFilters;
}