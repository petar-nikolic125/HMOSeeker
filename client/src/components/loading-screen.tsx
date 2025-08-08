import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { SearchFilters, ScrapeStatus } from "@/lib/types";
import type { PropertyListing } from "@shared/schema";
import { IntelligentLoadingScreen } from "./IntelligentLoadingScreen";

interface LoadingScreenProps {
  isVisible: boolean;
  filters: SearchFilters;
  onComplete: (results: PropertyListing[]) => void;
  onError: () => void;
}

export default function LoadingScreen({ isVisible, filters, onComplete, onError }: LoadingScreenProps) {
  const [searchId, setSearchId] = useState<string | null>(null);

  const startScrapeMutation = useMutation({
    mutationFn: async (filters: SearchFilters) => {
      const response = await apiRequest("POST", "/api/scrape", filters);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setSearchId(data.search_id);
      } else {
        onError();
      }
    },
    onError: () => {
      onError();
    },
  });

  const checkStatusMutation = useMutation({
    mutationFn: async (searchId: string) => {
      const response = await apiRequest("GET", `/api/scrape/${searchId}/status`);
      return response.json();
    },
  });

  const getPropertiesMutation = useMutation({
    mutationFn: async (filters: SearchFilters) => {
      const params = new URLSearchParams();
      if (filters.city) params.append('city', filters.city);
      if (filters.max_price) params.append('max_price', filters.max_price.toString());
      if (filters.min_bedrooms) params.append('min_bedrooms', filters.min_bedrooms.toString());
      
      const response = await apiRequest("GET", `/api/properties?${params.toString()}`);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        onComplete(data.listings);
      } else {
        onError();
      }
    },
    onError: () => {
      onError();
    },
  });

  useEffect(() => {
    if (!isVisible || !filters.city) return;

    // Start scraping
    startScrapeMutation.mutate(filters);
  }, [isVisible, filters]);

  // Poll search status
  useEffect(() => {
    if (!searchId) return;

    const pollInterval = setInterval(() => {
      checkStatusMutation.mutate(searchId, {
        onSuccess: (data: ScrapeStatus) => {
          if (data.status === 'completed') {
            setTimeout(() => {
              getPropertiesMutation.mutate(filters);
            }, 3000); // Allow time for intelligent loading animation
            clearInterval(pollInterval);
          } else if (data.status === 'failed') {
            onError();
            clearInterval(pollInterval);
          }
        },
        onError: () => {
          onError();
          clearInterval(pollInterval);
        },
      });
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [searchId]);

  if (!isVisible) return null;

  return (
    <IntelligentLoadingScreen
      isVisible={isVisible}
      city={filters.city}
      searchParams={{
        minRooms: filters.min_bedrooms,
        maxPrice: filters.max_price
      }}
      onComplete={() => {
        // This will be called when animation completes
        // But the actual data handling is done by mutations above
      }}
    />
  );
}
