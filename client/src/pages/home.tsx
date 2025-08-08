import NavigationHeader from "@/components/navigation-header";
import HeroSection from "@/components/hero-section";
import PropertyResults from "@/components/property-results";
import PropertyAnalysisModal from "@/components/property-analysis-modal";
import Footer from "@/components/footer";
import { useState, useCallback, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { PropertyListing } from "@shared/schema";
import type { SearchFilters } from "@/lib/types";

interface SearchState {
  properties: any[];
  isLoading: boolean;
  isCached: boolean;
  lastRefreshed: Date | null;
  error: string | null;
}

export default function Home() {
  const [searchState, setSearchState] = useState<SearchState>({
    properties: [],
    isLoading: false,
    isCached: false,
    lastRefreshed: null,
    error: null,
  });
  const [showResults, setShowResults] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<PropertyListing | null>(null);
  const [currentFilters, setCurrentFilters] = useState<SearchFilters>({ city: "London" });
  const [lastSearchTime, setLastSearchTime] = useState<number>(0);
  const [sortBy, setSortBy] = useState<string>("yield_desc");
  const [sortedProperties, setSortedProperties] = useState<any[]>([]);

  const searchMutation = useMutation({
    mutationFn: async ({ filters, refresh }: { filters: SearchFilters; refresh?: boolean }) => {
      const params = new URLSearchParams();
      if (filters.city) params.append('city', filters.city);
      if (filters.minRooms) params.append('min_bedrooms', filters.minRooms.toString());
      if (filters.maxPrice) params.append('max_price', filters.maxPrice.toString());
      if (filters.keywords) params.append('keywords', filters.keywords);
      if (refresh) params.append('refresh', 'true');
      
      const response = await fetch(`/api/search?${params.toString()}`);
      if (!response.ok) throw new Error('Search failed');
      return response.json();
    },
    onMutate: () => {
      setSearchState(prev => ({ ...prev, isLoading: true, error: null }));
    },
    onSuccess: (data) => {
      setSearchState({
        properties: data.results || [],
        isLoading: false,
        isCached: data.meta?.cached || false,
        lastRefreshed: new Date(),
        error: null,
      });
      setShowResults(true);
    },
    onError: (error: Error) => {
      setSearchState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message,
      }));
    },
  });

  const handleSearch = useCallback((filters: SearchFilters, refresh = false) => {
    // Debounce search - prevent spam clicking
    const now = Date.now();
    if (now - lastSearchTime < 1000) return; // 1 second debounce
    
    setLastSearchTime(now);
    setCurrentFilters(filters);
    searchMutation.mutate({ filters, refresh });
  }, [searchMutation, lastSearchTime]);

  const handleRefresh = useCallback(() => {
    if (currentFilters.city) {
      handleSearch(currentFilters, true);
    }
  }, [currentFilters, handleSearch]);

  // Sorting functionality
  const sortProperties = useCallback((properties: any[], sortType: string) => {
    const sorted = [...properties].sort((a, b) => {
      switch (sortType) {
        case "yield_desc":
          return (b.grossYield || 0) - (a.grossYield || 0);
        case "yield_asc":
          return (a.grossYield || 0) - (b.grossYield || 0);
        case "price_asc":
          return (a.price || 0) - (b.price || 0);
        case "price_desc":
          return (b.price || 0) - (a.price || 0);
        case "roi_desc":
          return (b.roi || 0) - (a.roi || 0);
        case "bedrooms_desc":
          return (b.bedrooms || 0) - (a.bedrooms || 0);
        default:
          return (b.grossYield || 0) - (a.grossYield || 0);
      }
    });
    return sorted;
  }, []);

  // Update sorted properties when properties or sort type changes
  useEffect(() => {
    if (searchState.properties.length > 0) {
      const sorted = sortProperties(searchState.properties, sortBy);
      setSortedProperties(sorted);
    }
  }, [searchState.properties, sortBy, sortProperties]);

  // Auto-load properties when page loads with London
  useEffect(() => {
    const autoLoadProperties = () => {
      if (currentFilters.city && !showResults && !searchState.isLoading) {
        handleSearch(currentFilters);
      }
    };

    // Auto-load after a short delay to ensure the page is fully mounted
    const timer = setTimeout(autoLoadProperties, 500);
    return () => clearTimeout(timer);
  }, [currentFilters, showResults, searchState.isLoading, handleSearch]);

  const handlePropertyAnalysis = (property: PropertyListing) => {
    setSelectedProperty(property);
  };

  const handleSortChange = (sortType: string) => {
    setSortBy(sortType);
  };

  const handleLocationChange = (location: string) => {
    const newFilters = { ...currentFilters, city: location };
    setCurrentFilters(newFilters);
    if (location) {
      handleSearch(newFilters);
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <NavigationHeader 
        onLocationChange={handleLocationChange}
        currentLocation={currentFilters.city}
      />
      <HeroSection 
        onSearch={handleSearch} 
        isLoading={searchState.isLoading}
      />
      
      {showResults && (
        <PropertyResults 
          properties={sortedProperties.length > 0 ? sortedProperties : searchState.properties} 
          filters={currentFilters}
          onAnalyze={handlePropertyAnalysis}
          onRefresh={handleRefresh}
          searchState={searchState}
          onSortChange={handleSortChange}
          currentSort={sortBy}
        />
      )}
      
      <Footer />
      
      {selectedProperty && (
        <PropertyAnalysisModal 
          property={selectedProperty}
          onClose={() => setSelectedProperty(null)}
        />
      )}
    </div>
  );
}
