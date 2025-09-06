import { Star, Percent, TrendingUp, Bath, Bed, Square, ExternalLink, Calculator, CheckCircle, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { PropertyListing } from "@shared/schema";
import PropertyMap from "./property-map";

interface PropertyCardProps {
  property: any; // Using any to handle the scraper's data format
  onAnalyze: (property: any) => void;
  delay?: number;
}

export default function PropertyCard({ property, onAnalyze, delay = 0 }: PropertyCardProps) {
  // Fetch real analysis data for this property
  const { data: analysisData } = useQuery({
    queryKey: ['analysis', property.id],
    queryFn: async () => {
      const response = await fetch(`/api/properties/${property.id}/analysis`);
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!property.id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Use real analysis data if available, otherwise fallback to estimates
  const realYield = analysisData?.analysis?.gross_yield_pct;
  const realMonthlyRent = analysisData?.analysis?.estimated_monthly_rent;
  const realROI = analysisData?.analysis?.simple_roi_pct;

  const grossYield = realYield || property.gross_yield || 0;
  const monthlyRent = realMonthlyRent || property.monthly_rent || (property.bedrooms || 4) * 400;
  const estimatedYield = grossYield || (property.price > 0 ? (monthlyRent * 12 / property.price * 100) : 0);
  const estimatedRoi = realROI || estimatedYield * 1.5; // Use real ROI if available

  const getYieldColor = (yieldValue: number) => {
    if (yieldValue >= 8) return "from-emerald-500 to-green-500";
    if (yieldValue >= 6) return "from-yellow-500 to-orange-500";
    return "from-red-500 to-pink-500";
  };

  const getYieldLabel = (yieldValue: number) => {
    if (yieldValue >= 8) return "High";
    if (yieldValue >= 6) return "Medium";
    return "Low";
  };

  const handleViewProperty = () => {
    if (property.property_url) {
      window.open(property.property_url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="group bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden border border-gray-200 hover:border-blue-300">
      
      {/* Header section with property title and badges */}
      <div className="p-3 pb-2 border-b border-gray-100">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 text-lg leading-tight mb-1">
              {property.address || property.title || `Property in ${property.city || 'Unknown'}`}
            </h3>
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <Bed className="w-4 h-4" />
                {property.bedrooms || 4}
              </span>
              {property.bathrooms && (
                <span className="flex items-center gap-1">
                  <Bath className="w-4 h-4" />
                  {property.bathrooms}
                </span>
              )}
              {(property.area_sqm || property.predicted_sqm) && (
                <span className="flex items-center gap-1">
                  <Square className="w-4 h-4" />
                  {property.area_sqm || property.predicted_sqm}m²
                  {property.area_estimated && (
                    <span className="text-gray-400 ml-0.5" title="Estimated size based on bedrooms, location and property type">~</span>
                  )}
                </span>
              )}
            </div>
          </div>
          
          <div className="flex gap-2 ml-4">
            {property.hmo_candidate && (
              <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-sm font-medium">HMO</span>
            )}
            {!property.article4_area && (
              <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-sm font-medium" title="Non-Article 4 area - No planning restrictions for HMO conversion">
                <CheckCircle className="w-4 h-4 inline mr-1" />
                Non-A4
              </span>
            )}
            {property.article4_area && (
              <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-sm font-medium" title="Article 4 area - Planning permission required for HMO conversion">
                <AlertTriangle className="w-4 h-4 inline mr-1" />
                Article 4
              </span>
            )}
            <span className={`${getYieldColor(estimatedYield) === 'from-emerald-500 to-green-500' ? 'bg-green-100 text-green-700' : 
                             getYieldColor(estimatedYield) === 'from-yellow-500 to-orange-500' ? 'bg-yellow-100 text-yellow-700' :
                             'bg-red-100 text-red-700'} px-2 py-1 rounded text-sm font-medium`}>
              {getYieldLabel(estimatedYield)}
            </span>
          </div>
        </div>
      </div>

      {/* Main content area with image and map side by side */}
      <div className="flex h-64">
        {/* Property Image - Left side */}
        <div className="relative flex-1 overflow-hidden">
          <img 
            src={property.image_url || "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&h=600&fit=crop&crop=entropy&q=80"}
            alt={property.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          
          {/* Price overlay */}
          <div className="absolute bottom-3 left-3 bg-black/75 text-white px-3 py-2 rounded text-lg font-bold">
            £{(property.price || 0).toLocaleString()}
          </div>
        </div>

        {/* Map Section - Right side */}
        <div className="flex-1 relative">
          <PropertyMap 
            city={property.city || 'London'} 
            address={property.address || property.title}
            postcode={property.postcode}
            height="100%"
            className="h-full"
          />
        </div>
      </div>

      {/* Metrics and Action buttons */}
      <div className="p-3 pt-2 flex items-center justify-between">
        <div className="flex gap-6">
          <div className="text-center">
            <div className="text-blue-600 font-bold text-lg">{estimatedYield.toFixed(1)}%</div>
            <div className="text-sm text-gray-500">Yield</div>
          </div>
          <div className="text-center">
            <div className="text-green-600 font-bold text-lg">£{monthlyRent.toLocaleString()}</div>
            <div className="text-sm text-gray-500">Month</div>
          </div>
          <div className="text-center">
            <div className="text-purple-600 font-bold text-lg">{estimatedRoi.toFixed(1)}%</div>
            <div className="text-sm text-gray-500">ROI</div>
          </div>
        </div>
        
        {/* Action buttons */}
        <div className="flex gap-2">
          <button 
            onClick={handleViewProperty}
            disabled={!property.property_url}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm font-medium rounded transition-colors duration-200 flex items-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            View
          </button>
          
          <button 
            onClick={() => onAnalyze(property)}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded transition-colors duration-200 flex items-center gap-2"
          >
            <Calculator className="w-4 h-4" />
            Analyze
          </button>
        </div>
      </div>
    </div>
  );
}
