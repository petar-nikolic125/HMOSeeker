import { Clock, Filter } from "lucide-react";
import PropertyCard from "./property-card";
import type { PropertyListing } from "@shared/schema";
import type { SearchFilters } from "@/lib/types";

interface PropertyResultsProps {
  properties: PropertyListing[];
  filters: SearchFilters;
  onAnalyze: (property: PropertyListing) => void;
}

export default function PropertyResults({ properties, filters, onAnalyze }: PropertyResultsProps) {
  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            HMO Investment Opportunities
          </h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Found <span className="font-semibold text-blue-600">{properties.length}</span> properties matching your criteria with high investment potential
          </p>
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
            Data refreshed 5 minutes ago
          </div>
        </div>

        {/* Property Grid */}
        {properties.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {properties.map((property) => (
              <PropertyCard 
                key={property.id} 
                property={property} 
                onAnalyze={onAnalyze}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-24 h-24 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <Clock className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Properties Found</h3>
            <p className="text-gray-600 mb-6">
              No HMO-suitable properties found for your search criteria in {filters.city}.
              Try adjusting your filters or searching in a different area.
            </p>
            <button className="bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors">
              Refine Search
            </button>
          </div>
        )}

        {/* Load More Button */}
        {properties.length > 0 && (
          <div className="text-center">
            <button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
              Load More Properties
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
