import React from "react";
import { Clock, Filter, RefreshCw, CheckCircle, Database, AlertCircle } from "lucide-react";
import PropertyCard from "./property-card";
import type { PropertyListing } from "@shared/schema";
import type { SearchFilters, PropertyWithAnalytics } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

interface SearchState {
  properties: any[];
  isLoading: boolean;
  isCached: boolean;
  lastRefreshed: Date | null;
  error: string | null;
}

interface PropertyResultsProps {
  properties: any[];
  filters: SearchFilters;
  onAnalyze: (property: PropertyListing) => void;
  onRefresh: () => void;
  searchState: SearchState;
  onSortChange?: (sortBy: string) => void;
  currentSort?: string;
}

export default function PropertyResults({ properties, filters, onAnalyze, onRefresh, searchState, onSortChange, currentSort }: PropertyResultsProps) {
  const { isLoading, isCached, lastRefreshed, error } = searchState;
  const { toast } = useToast();

  // Show toast when no results due to filters
  const hasActiveFilters = filters.maxPrice || filters.minRooms || filters.keywords;
  
  React.useEffect(() => {
    if (!isLoading && properties.length === 0 && hasActiveFilters && !error) {
      toast({
        title: "Nema rezultata za trenutne filtere",
        description: `Pronađeno je 0 nekretnina u ${filters.city} koje zadovoljavaju vaše kriterijume. Pokušajte da ublažite filtere ili promenite grad.`,
        variant: "destructive",
        duration: 4000,
      });
    }
  }, [isLoading, properties.length, hasActiveFilters, filters.city, error, toast]);

  const formatTime = (date: Date | null) => {
    if (!date) return 'Never';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };
  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            HMO Investment Opportunities
          </h2>
          <div className="space-y-3">
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              Found <span className="font-semibold text-blue-600">{properties.length}</span> properties matching your criteria with high investment potential
            </p>

            {/* Search Status */}
            <div className="flex items-center justify-center gap-6 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <Clock className="w-4 h-4" />
                <span>Updated {formatTime(lastRefreshed)}</span>
              </div>
            </div>

            {error && (
              <div className="mx-auto max-w-md p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                Error: {error}
              </div>
            )}
          </div>
        </div>

        {/* Filters Bar */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 p-4 bg-gray-50 rounded-2xl">
          <div className="flex items-center gap-4">
            <select 
              value={currentSort || "yield_desc"}
              onChange={(e) => onSortChange?.(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              data-testid="select-sort"
            >
              <option value="yield_desc">Sort by: Yield (High to Low)</option>
              <option value="yield_asc">Sort by: Yield (Low to High)</option>
              <option value="price_asc">Sort by: Price (Low to High)</option>
              <option value="price_desc">Sort by: Price (High to Low)</option>
              <option value="roi_desc">Sort by: ROI (High to Low)</option>
              <option value="bedrooms_desc">Sort by: Bedrooms (Most First)</option>
            </select>
            <button className="flex items-center gap-2 text-gray-600 hover:text-blue-600 text-sm" data-testid="button-more-filters">
              <Filter className="w-4 h-4" />
              More Filters
            </button>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock className="w-4 h-4" />
            Last updated {formatTime(lastRefreshed)}
          </div>
        </div>

        {/* Property Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" data-testid="loading-spinner"></div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Searching Properties...</h3>
            <p className="text-gray-600">
              {isCached ? 'Loading cached results...' : 'Scraping latest property data from PrimeLocation...'}
            </p>
            <div className="mt-4 max-w-md mx-auto">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <span className="font-medium">Live Search in Progress</span>
                </div>
                <p>Fetching the latest HMO opportunities from multiple property portals...</p>
              </div>
            </div>
          </div>
        ) : properties.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {properties.map((property, index) => (
              <PropertyCard 
                key={property.property_url || index} 
                property={property} 
                onAnalyze={onAnalyze}
                delay={index * 100}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-24 h-24 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {error ? 'Search Failed' : hasActiveFilters ? 'Nema rezultata za filtere' : 'No Properties Found'}
            </h3>
            <p className="text-gray-600 mb-6">
              {error 
                ? 'There was an error searching for properties. Please try a different search or check your connection.'
                : hasActiveFilters 
                  ? `Trenutni filteri su previše restriktivni za ${filters.city}. Pokušajte da ublažite kriterijume pretrage.`
                  : `No HMO-suitable properties found in ${filters.city}. Try searching in a different area.`
              }
            </p>
          </div>
        )}

        {/* Results Summary */}
        {properties.length > 0 && (
          <div className="text-center">
            <div className="text-sm text-gray-600 mb-4">
              Showing {properties.length} properties • {isCached ? 'From cache' : 'Fresh from PrimeLocation'}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}