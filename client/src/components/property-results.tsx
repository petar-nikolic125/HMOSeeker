import { Clock, Filter, RefreshCw, CheckCircle, Database } from "lucide-react";
import { PropertyCard } from "./PropertyCard";
import type { PropertyListing } from "@shared/schema";
import type { SearchFilters, PropertyWithAnalytics } from "@/lib/types";

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
}

export default function PropertyResults({ properties, filters, onAnalyze, onRefresh, searchState }: PropertyResultsProps) {
  const { isLoading, isCached, lastRefreshed, error } = searchState;
  
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
            
            {/* Search Status and Refresh */}
            <div className="flex items-center justify-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                {isCached ? (
                  <>
                    <Database className="w-4 h-4 text-amber-600" />
                    <span className="text-amber-700 font-medium">Cached Data</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-green-700 font-medium">Fresh Data</span>
                  </>
                )}
              </div>
              
              <div className="flex items-center gap-2 text-gray-600">
                <Clock className="w-4 h-4" />
                <span>Updated {formatTime(lastRefreshed)}</span>
              </div>
              
              <button
                onClick={onRefresh}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                {isLoading ? 'Refreshing...' : 'Refresh'}
              </button>
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
            <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option>Sort by: Yield (High to Low)</option>
              <option>Sort by: Price (Low to High)</option>
              <option>Sort by: ROI</option>
            </select>
            <button className="flex items-center gap-2 text-gray-600 hover:text-blue-600 text-sm">
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
            <div className="w-16 h-16 mx-auto mb-4 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Searching Properties...</h3>
            <p className="text-gray-600">
              {isCached ? 'Loading cached results...' : 'Scraping latest property data from PrimeLocation...'}
            </p>
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
              <Clock className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {error ? 'Search Failed' : 'No Properties Found'}
            </h3>
            <p className="text-gray-600 mb-6">
              {error 
                ? 'There was an error searching for properties. Please try again.'
                : `No HMO-suitable properties found for your search criteria in ${filters.city}. ${isCached ? 'Showing cached results if available.' : 'Try adjusting your filters or searching in a different area.'}`
              }
            </p>
            <button 
              onClick={onRefresh}
              className="bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors"
            >
              {error ? 'Try Again' : 'Refresh Search'}
            </button>
          </div>
        )}

        {/* Load More Button */}
        {properties.length > 0 && (
          <div className="text-center">
            <div className="text-sm text-gray-600 mb-4">
              Showing {properties.length} properties • {isCached ? 'From cache' : 'Fresh from PrimeLocation'}
            </div>
            <button 
              onClick={() => onRefresh()}
              disabled={isLoading}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 text-white px-8 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:transform-none disabled:scale-100"
            >
              {isLoading ? 'Refreshing...' : 'Refresh Results'}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
