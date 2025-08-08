import NavigationHeader from "@/components/navigation-header";
import HeroSection from "@/components/hero-section";
import LoadingScreen from "@/components/loading-screen";
import PropertyResults from "@/components/property-results";
import PropertyAnalysisModal from "@/components/property-analysis-modal";
import SystemArchitecture from "@/components/system-architecture";
import Footer from "@/components/footer";
import { useState } from "react";
import type { PropertyListing } from "@shared/schema";
import type { SearchFilters } from "@/lib/types";

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<PropertyListing[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<PropertyListing | null>(null);
  const [currentFilters, setCurrentFilters] = useState<SearchFilters>({ city: "" });

  const handleSearch = (filters: SearchFilters) => {
    setCurrentFilters(filters);
    setIsLoading(true);
    setShowResults(false);
  };

  const handleSearchComplete = (results: PropertyListing[]) => {
    setSearchResults(results);
    setIsLoading(false);
    setShowResults(true);
  };

  const handleSearchError = () => {
    setIsLoading(false);
    setShowResults(false);
  };

  const handlePropertyAnalysis = (property: PropertyListing) => {
    setSelectedProperty(property);
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <NavigationHeader />
      <HeroSection onSearch={handleSearch} />
      
      <LoadingScreen 
        isVisible={isLoading} 
        filters={currentFilters}
        onComplete={handleSearchComplete}
        onError={handleSearchError}
      />
      
      {showResults && (
        <PropertyResults 
          properties={searchResults} 
          filters={currentFilters}
          onAnalyze={handlePropertyAnalysis}
        />
      )}
      
      <SystemArchitecture />
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
