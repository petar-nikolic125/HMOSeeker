import { useEffect, useState } from "react";
import { Brain, Search, CheckCircle } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { SearchFilters, ScrapeStatus } from "@/lib/types";
import type { PropertyListing } from "@shared/schema";

interface LoadingScreenProps {
  isVisible: boolean;
  filters: SearchFilters;
  onComplete: (results: PropertyListing[]) => void;
  onError: () => void;
}

export default function LoadingScreen({ isVisible, filters, onComplete, onError }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [thoughtIndex, setThoughtIndex] = useState(0);
  const [showRemark, setShowRemark] = useState(false);
  const [searchId, setSearchId] = useState<string | null>(null);

  const thoughts = [
    "Scanning property portals...",
    "Accessing Zoopla database...",
    "Querying PrimeLocation API...",
    "Analyzing property listings...",
    "Filtering HMO opportunities...",
    "Calculating investment yields..."
  ];

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

    // Progress animation
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev + Math.random() * 8 + 3;
        return newProgress > 95 ? 95 : newProgress;
      });
    }, 300);

    // Thoughts rotation
    const thoughtInterval = setInterval(() => {
      setThoughtIndex(prev => (prev + 1) % thoughts.length);
    }, 1800);

    // Show remark
    const remarkTimeout = setTimeout(() => {
      setShowRemark(true);
      setTimeout(() => setShowRemark(false), 3000);
    }, 3000);

    return () => {
      clearInterval(progressInterval);
      clearInterval(thoughtInterval);
      clearTimeout(remarkTimeout);
    };
  }, [isVisible, filters]);

  // Poll search status
  useEffect(() => {
    if (!searchId) return;

    const pollInterval = setInterval(() => {
      checkStatusMutation.mutate(searchId, {
        onSuccess: (data: ScrapeStatus) => {
          if (data.status === 'completed') {
            setProgress(100);
            setTimeout(() => {
              getPropertiesMutation.mutate(filters);
            }, 800);
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
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 z-50 flex flex-col items-center justify-center">
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute w-1 h-1 bg-purple-400 rounded-full opacity-20 animate-float" style={{left: '10%', top: '20%'}}></div>
        <div className="absolute w-1 h-1 bg-purple-400 rounded-full opacity-20 animate-float" style={{left: '80%', top: '30%', animationDelay: '2s'}}></div>
        <div className="absolute w-1 h-1 bg-purple-400 rounded-full opacity-20 animate-float" style={{left: '60%', top: '60%', animationDelay: '1s'}}></div>
      </div>

      <div className="relative z-10 text-center max-w-2xl px-6">
        {/* AI Brain Animation */}
        <div className="mb-8 flex justify-center">
          <div className="relative">
            <div className="w-24 h-24 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center animate-pulse-slow">
              <Brain className="text-white text-3xl" />
            </div>
            
            {/* Pulse rings */}
            <div className="absolute inset-0 border-2 border-purple-400 rounded-full animate-ping opacity-20"></div>
            <div className="absolute inset-0 border-2 border-purple-400 rounded-full animate-ping opacity-20" style={{animationDelay: '0.5s'}}></div>
          </div>
        </div>

        {/* Main Status */}
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
          AI Property Analysis
        </h1>

        {/* Current AI Thought */}
        <div className="mb-6 min-h-[32px]">
          <p className="text-xl text-purple-200 flex items-center justify-center gap-3">
            <Search className="w-6 h-6 animate-pulse" />
            <span>{thoughts[thoughtIndex]}</span>
          </p>
        </div>

        {/* Search Context */}
        <div className="mb-8 p-4 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
          <p className="text-purple-100">
            Searching <span className="font-semibold text-white">{filters.city}</span>
            {filters.min_bedrooms && <span> • {filters.min_bedrooms}+ bedrooms</span>}
            {filters.max_price && <span> • Under £{filters.max_price.toLocaleString()}</span>}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all duration-500"
              style={{width: `${progress}%`}}
            >
              <div className="absolute inset-0 bg-white/30 animate-pulse"></div>
            </div>
          </div>
          <p className="text-purple-300 mt-2 text-sm">
            {Math.round(progress)}% complete
          </p>
        </div>

        {/* Smart AI Remarks */}
        <div className="min-h-[60px] flex items-center justify-center">
          {showRemark && (
            <div className="px-4 py-2 rounded-full border backdrop-blur-sm bg-green-500/20 border-green-400/50">
              <p className="text-sm font-medium flex items-center gap-2 text-green-200">
                <CheckCircle className="w-4 h-4" />
                <span>"Hmm, that price seems reasonable..."</span>
              </p>
            </div>
          )}
        </div>

        {/* Technical Details */}
        <div className="mt-8 text-xs text-purple-400 space-y-1">
          <p>🤖 Powered by advanced property analysis algorithms</p>
          <p>🔍 Real-time data from multiple UK property portals</p>
          <p>💡 No synthetic data • Only authentic property listings</p>
        </div>
      </div>
    </div>
  );
}
