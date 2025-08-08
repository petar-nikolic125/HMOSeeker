import NavigationHeader from "@/components/navigation-header";
import HeroSection from "@/components/hero-section";
import PropertyResults from "@/components/property-results";
import PropertyAnalysisModal from "@/components/property-analysis-modal";
import { Footer } from "@/components/Footer";
import { SamplePropertiesSection } from "@/components/SamplePropertiesSection";
import { useState, useCallback } from "react";
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
  const [currentFilters, setCurrentFilters] = useState<SearchFilters>({ city: "" });
  const [lastSearchTime, setLastSearchTime] = useState<number>(0);

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

  const handlePropertyAnalysis = (property: PropertyListing) => {
    setSelectedProperty(property);
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <NavigationHeader />
      <HeroSection 
        onSearch={handleSearch} 
        isLoading={searchState.isLoading}
      />
      
      {showResults && (
        <PropertyResults 
          properties={searchState.properties} 
          filters={currentFilters}
          onAnalyze={handlePropertyAnalysis}
          onRefresh={handleRefresh}
          searchState={searchState}
        />
      )}
      
      {/* Sample Properties Section - replacing SystemArchitecture */}
      <SamplePropertiesSection />
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
