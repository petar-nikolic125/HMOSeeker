import type { PropertyListing } from '@shared/schema';

export interface SearchFilters {
  city: string;
  minRooms?: number;
  maxPrice?: number;
  keywords?: string;
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
}

export interface CacheEntry {
  data: PropertyWithAnalytics[];
  timestamp: number;
  searchQuery: SearchFilters;
}