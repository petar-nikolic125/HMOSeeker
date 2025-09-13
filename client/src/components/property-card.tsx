import { Star, Percent, TrendingUp, Bath, Bed, Square, ExternalLink, Calculator, CheckCircle, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { PropertyListing } from "@shared/schema";

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
    <div className="group bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 overflow-hidden border border-gray-100 hover:border-blue-400 hover:-translate-y-2 backdrop-blur-sm">
      
      {/* Header section with property title and badges */}
      <div className="p-6 pb-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 text-xl leading-tight mb-3">
              {property.address || property.title || `Property in ${property.city || 'Unknown'}`}
            </h3>
            <div className="flex items-center gap-6 text-base text-gray-700">
              <span className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg">
                <Bed className="w-5 h-5 text-blue-600" />
                <span className="font-semibold">{property.bedrooms || 4}</span>
                <span className="text-sm text-gray-500">beds</span>
              </span>
              {property.bathrooms && (
                <span className="flex items-center gap-2 bg-green-50 px-3 py-2 rounded-lg">
                  <Bath className="w-5 h-5 text-green-600" />
                  <span className="font-semibold">{property.bathrooms}</span>
                  <span className="text-sm text-gray-500">baths</span>
                </span>
              )}
              {(property.area_sqm || property.predicted_sqm) && (
                <span className="flex items-center gap-2 bg-purple-50 px-3 py-2 rounded-lg">
                  <Square className="w-5 h-5 text-purple-600" />
                  <span className="font-semibold">{property.area_sqm || property.predicted_sqm}m²</span>
                  {property.area_estimated && (
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full" title="Estimated size based on bedrooms, location and property type">est</span>
                  )}
                </span>
              )}
            </div>
          </div>
          
          <div className="flex gap-3 ml-6">
            {property.hmo_candidate && (
              <span className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg">HMO Ready</span>
            )}
            {!property.article4_area && (
              <span className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg flex items-center gap-1" title="Non-Article 4 area - No planning restrictions for HMO conversion">
                <CheckCircle className="w-4 h-4" />
                Non-A4
              </span>
            )}
            {property.article4_area && (
              <span className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg flex items-center gap-1" title="Article 4 area - Planning permission required for HMO conversion">
                <AlertTriangle className="w-4 h-4" />
                Article 4
              </span>
            )}
            <span className={`px-4 py-2 rounded-lg text-sm font-bold shadow-lg text-white ${
              getYieldColor(estimatedYield) === 'from-emerald-500 to-green-500' ? 'bg-gradient-to-r from-emerald-500 to-green-500' : 
              getYieldColor(estimatedYield) === 'from-yellow-500 to-orange-500' ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
              'bg-gradient-to-r from-red-500 to-pink-500'}`}>
              {getYieldLabel(estimatedYield)} Yield
            </span>
          </div>
        </div>
      </div>

      {/* Property Image - Full width without map */}
      <div className="relative h-80 overflow-hidden">
        <img 
          src={property.image_url || "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&h=600&fit=crop&crop=entropy&q=80"}
          alt={property.title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 filter group-hover:brightness-105"
        />
        
        {/* Modern gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/70" />
        
        {/* Modern price overlay */}
        <div className="absolute bottom-6 left-6 right-6">
          <div className="text-4xl font-black text-white drop-shadow-2xl mb-2 tracking-tight">
            £{(property.price || 0).toLocaleString()}
          </div>
          <div className="text-white/90 text-lg font-medium">
            {property.property_type || 'Property'}
          </div>
        </div>
      </div>

      {/* Enhanced Metrics and Action buttons */}
      <div className="p-6 pt-4 space-y-6">
        {/* Investment Metrics Grid */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200 text-center">
            <div className="text-blue-700 font-black text-2xl mb-1">{estimatedYield.toFixed(1)}%</div>
            <div className="text-sm font-semibold text-blue-600">Gross Yield</div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl border border-green-200 text-center">
            <div className="text-green-700 font-black text-2xl mb-1">£{monthlyRent.toLocaleString()}</div>
            <div className="text-sm font-semibold text-green-600">Monthly Rent</div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200 text-center">
            <div className="text-purple-700 font-black text-2xl mb-1">{estimatedRoi.toFixed(1)}%</div>
            <div className="text-sm font-semibold text-purple-600">Est. ROI</div>
          </div>
        </div>
        
        {/* Modern Action buttons */}
        <div className="flex gap-3">
          <button 
            onClick={handleViewProperty}
            disabled={!property.property_url}
            className="flex-1 px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 text-white text-lg font-bold rounded-xl transition-all duration-300 hover:shadow-lg hover:-translate-y-1 flex items-center justify-center gap-3"
          >
            <ExternalLink className="w-5 h-5" />
            View Property
          </button>
          
          <button 
            onClick={() => onAnalyze(property)}
            className="flex-1 px-6 py-4 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white text-lg font-bold rounded-xl transition-all duration-300 hover:shadow-lg hover:-translate-y-1 flex items-center justify-center gap-3"
          >
            <Calculator className="w-5 h-5" />
            Analyze Deal
          </button>
        </div>
      </div>
    </div>
  );
}
