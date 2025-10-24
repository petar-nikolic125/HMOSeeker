import StickyHeader from "@/components/StickyHeader";
import HeroSection from "@/components/hero-section";
import PropertyResults from "@/components/property-results";
import PropertyAnalysisModal from "@/components/property-analysis-modal";
import Article4Checker from "@/components/article4-checker";
import { Footer } from "@/components/Footer";
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
  totalResults: number;
  currentPage: number;
  hasMore: boolean;
}

export default function Home() {
  const [searchState, setSearchState] = useState<SearchState>({
    properties: [],
    isLoading: false,
    isCached: false,
    lastRefreshed: null,
    error: null,
    totalResults: 0,
    currentPage: 1,
    hasMore: false,
  });
  const [selectedProperty, setSelectedProperty] = useState<PropertyListing | null>(null);
  const [currentFilters, setCurrentFilters] = useState<SearchFilters>({ 
    city: "London",
    minRooms: 3,
    hmo_candidate: false,
    article4_filter: "non_article4"
  });
  const [lastSearchTime, setLastSearchTime] = useState<number>(0);
  const [sortBy, setSortBy] = useState<string>("optimal_hmo");
  const [sortedProperties, setSortedProperties] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('list');

  const searchMutation = useMutation({
    mutationFn: async ({ filters, page = 1, append = false, shuffle = false }: { filters: SearchFilters; page?: number; append?: boolean; shuffle?: boolean }) => {
      const params = new URLSearchParams();
      if (filters.city) params.append('city', filters.city);
      if (filters.minRooms) params.append('min_bedrooms', filters.minRooms.toString());
      if (filters.maxPrice) params.append('max_price', filters.maxPrice.toString());
      if (filters.keywords) params.append('keywords', filters.keywords);
      if (filters.minSqm) params.append('min_sqm', filters.minSqm.toString());
      if (filters.maxSqm) params.append('max_sqm', filters.maxSqm.toString());
      if (filters.postcode) params.append('postcode', filters.postcode);
      if (filters.hmo_candidate) params.append('hmo_candidate', 'true');
      if (filters.article4_filter && filters.article4_filter !== 'all') params.append('article4_filter', filters.article4_filter);
      
      // Add pagination parameters
      params.append('page', page.toString());
      params.append('limit', '20');
      
      // Add shuffle parameter
      if (shuffle) params.append('shuffle', 'true');
      
      // Use cache endpoint instead of search (no scraping)
      const response = await fetch(`/api/properties?${params.toString()}`);
      if (!response.ok) throw new Error('Cache search failed');
      return { ...await response.json(), append };
    },
    onMutate: () => {
      setSearchState(prev => ({ ...prev, isLoading: true, error: null }));
    },
    onSuccess: (data) => {
      console.log('Search API response:', data);
      console.log('Properties count:', data.properties?.length || 0);
      
      const properties = data.listings || data.properties || [];
      console.log('Properties count:', properties.length);
      
      setSearchState(prev => ({
        properties: data.append ? [...prev.properties, ...properties] : properties,
        isLoading: false,
        isCached: data.cached || true,
        lastRefreshed: new Date(),
        error: null,
        totalResults: data.total || properties.length,
        currentPage: data.page || 1,
        hasMore: data.hasMore || false,
      }));
    },
    onError: (error: Error) => {
      setSearchState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message,
      }));
    },
  });

  const handleSearch = useCallback((filters: SearchFilters) => {
    // Debounce search - prevent spam clicking
    const now = Date.now();
    if (now - lastSearchTime < 1000) return; // 1 second debounce
    
    setLastSearchTime(now);
    setCurrentFilters(filters);
    // Reset pagination for new searches
    searchMutation.mutate({ filters, page: 1, append: false });
  }, [searchMutation, lastSearchTime]);

  const handlePageChange = useCallback((page: number) => {
    if (searchState.isLoading || page === searchState.currentPage) return;
    
    searchMutation.mutate({ 
      filters: currentFilters, 
      page, 
      append: false  // Always replace results for pagination, not append
    });
  }, [searchMutation, currentFilters, searchState.isLoading, searchState.currentPage]);

  const handleRefresh = useCallback(() => {
    if (currentFilters.city) {
      handleSearch(currentFilters);
    }
  }, [currentFilters, handleSearch]);

  // Sorting functionality
  const sortProperties = useCallback((properties: any[], sortType: string) => {
    // For optimal HMO sorting, don't re-sort - just return the backend-ordered array
    if (sortType === "optimal_hmo") {
      return [...properties]; // Return copy without sorting
    }
    
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
          return 0;
      }
    });
    return sorted;
  }, []);

  // Update sorted properties when properties or sort type changes
  useEffect(() => {
    if (searchState.properties.length > 0) {
      const sorted = sortProperties(searchState.properties, sortBy);
      setSortedProperties(sorted);
    } else {
      setSortedProperties([]);
    }
  }, [searchState.properties, sortBy, sortProperties]);

  // Auto-load properties when page loads with London
  useEffect(() => {
    const autoLoadProperties = () => {
      if (currentFilters.city && searchState.properties.length === 0 && !searchState.isLoading) {
        // Set loading state immediately to show the loading UI
        setSearchState(prev => ({ ...prev, isLoading: true, error: null }));
        handleSearch(currentFilters);
      }
    };

    // Auto-load immediately when page loads
    const timer = setTimeout(autoLoadProperties, 100);
    return () => clearTimeout(timer);
  }, []); // Empty dependency array to run only once on mount

  const handlePropertyAnalysis = (property: PropertyListing) => {
    setSelectedProperty(property);
  };

  const handleSortChange = (sortType: string) => {
    setSortBy(sortType);
    // Trigger a fresh search when sorting changes to get new results
    if (currentFilters.city) {
      searchMutation.mutate({ 
        filters: currentFilters, 
        page: 1, 
        append: false,
        shuffle: sortType !== "optimal_hmo" // Shuffle for all sorts except optimal HMO
      });
    }
  };

  const handleShuffle = useCallback(() => {
    if (searchState.isLoading) return;
    
    searchMutation.mutate({ 
      filters: currentFilters, 
      page: 1,  // Reset to first page when shuffling
      append: false,
      shuffle: true
    });
  }, [searchMutation, currentFilters, searchState.isLoading]);

  const handleLocationChange = (location: string) => {
    const newFilters = { ...currentFilters, city: location };
    setCurrentFilters(newFilters);
    if (location) {
      handleSearch(newFilters);
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <StickyHeader 
        onSearch={handleSearch}
        currentFilters={currentFilters}
        isLoading={searchState.isLoading}
        searchResultsCount={searchState.properties.length}
        onViewModeChange={setViewMode}
        currentViewMode={viewMode}
      />
      {/* Add padding top to account for sticky header */}
      <main id="main-content" className="pt-16">
        <HeroSection 
          onSearch={handleSearch} 
          isLoading={searchState.isLoading}
          searchResults={{ count: searchState.properties.length, error: searchState.error || undefined }}
        />
        
        {/* Article 4 Direction Checker Section - Moved above property listings */}
        <section className="py-8 bg-white border-b">
          <div className="container mx-auto px-4">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                Article 4 Direction Checker
              </h2>
              <p className="text-sm text-gray-600 max-w-2xl mx-auto">
                Check if a postcode falls within an Article 4 direction area that may restrict HMO conversions. 
                Free tool using official government data.
              </p>
            </div>
            <Article4Checker />
          </div>
        </section>
        
        <PropertyResults 
          properties={sortedProperties.length > 0 ? sortedProperties : searchState.properties} 
          totalResults={searchState.totalResults}
          hasMore={searchState.hasMore}
          onLoadMore={handlePageChange}
          onShuffle={handleShuffle}
          filters={currentFilters}
          onAnalyze={handlePropertyAnalysis}
          onRefresh={handleRefresh}
          searchState={searchState}
          onSortChange={handleSortChange}
          currentSort={sortBy}
        />
        
        <Footer />
      </main>
      
      {selectedProperty && (
        <PropertyAnalysisModal 
          property={selectedProperty}
          onClose={() => setSelectedProperty(null)}
        />
      )}
    </div>
  );
}
