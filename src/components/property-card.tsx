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
    <div className="group relative bg-white rounded-2xl md:rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-500 overflow-hidden border border-gray-200/60 hover:border-blue-300/60 hover:-translate-y-1 md:hover:-translate-y-2 backdrop-blur-sm">
      
      {/* Image Section */}
      <div className="relative h-80 overflow-hidden">
        <img 
          src={property.image_url || "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&h=600&fit=crop&crop=entropy&q=80"}
          alt={property.title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 filter group-hover:brightness-105"
        />
        
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/70"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
        
        {/* Badges */}
        <div className="absolute top-5 left-5 flex flex-col gap-2">
          <div className={`bg-gradient-to-r ${getYieldColor(estimatedYield)} text-white border-0 shadow-xl backdrop-blur-md px-4 py-2 font-bold text-sm flex items-center gap-1.5 rounded-full`}>
            <Star className="w-4 h-4" />
            {getYieldLabel(estimatedYield)}
          </div>
          
          {/* HMO Candidate Badge */}
          {property.hmo_candidate && (
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white border-0 shadow-xl backdrop-blur-md px-4 py-2 font-bold text-sm flex items-center gap-1.5 rounded-full">
              <CheckCircle className="w-4 h-4" />
              HMO Candidate
            </div>
          )}
          
          {/* Article 4 Status Badge */}
          {property.article4_area === false && (
            <div className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white border-0 shadow-xl backdrop-blur-md px-4 py-2 font-bold text-sm flex items-center gap-1.5 rounded-full">
              <CheckCircle className="w-4 h-4" />
              Non-Article 4
            </div>
          )}
          {property.article4_area === true && (
            <div className="bg-gradient-to-r from-orange-600 to-red-600 text-white border-0 shadow-xl backdrop-blur-md px-4 py-2 font-bold text-sm flex items-center gap-1.5 rounded-full">
              <AlertTriangle className="w-4 h-4" />
              Article 4 Area
            </div>
          )}
        </div>
        
        <div className="absolute top-5 right-5 flex flex-col gap-2">
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white border-0 shadow-xl backdrop-blur-md px-4 py-2 font-bold text-sm flex items-center gap-1.5 rounded-full">
            <Percent className="w-4 h-4" />
            {estimatedYield.toFixed(1)}% Yield
          </div>
          <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white border-0 shadow-xl backdrop-blur-md px-4 py-2 font-bold text-sm flex items-center gap-1.5 rounded-full">
            <TrendingUp className="w-4 h-4" />
            £{monthlyRent.toLocaleString()}/mo
          </div>
        </div>

        {/* Price overlay */}
        <div className="absolute bottom-6 left-6 right-6">
          <div className="text-4xl font-black text-white drop-shadow-2xl mb-2 tracking-tight">
            £{(property.price || 0).toLocaleString()}
          </div>
          <div className="flex items-center text-white/90 text-sm font-medium">
            <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
            {property.address || property.title || `Property in ${property.city || 'Unknown'}`}
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        
        {/* Property Features */}
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap items-center gap-3 md:gap-6">
            <div className="flex items-center gap-2 text-gray-700">
              <div className="p-2 bg-blue-50 rounded-xl">
                <Bed className="w-5 h-5 text-blue-600" />
              </div>
              <span className="font-semibold">{property.bedrooms || 4}</span>
              <span className="text-sm text-gray-500">bedrooms</span>
            </div>
            
            {property.bathrooms && (
              <div className="flex items-center gap-2 text-gray-700">
                <div className="p-2 bg-emerald-50 rounded-xl">
                  <Bath className="w-5 h-5 text-emerald-600" />
                </div>
                <span className="font-semibold">{property.bathrooms}</span>
                <span className="text-sm text-gray-500">baths</span>
              </div>
            )}
            
            {property.area_sqm && (
              <div className="flex items-center gap-2 text-gray-700">
                <div className="p-2 bg-purple-50 rounded-xl">
                  <Square className="w-5 h-5 text-purple-600" />
                </div>
                <span className="font-semibold">{property.area_sqm}</span>
                <span className="text-sm text-gray-500">m²</span>
              </div>
            )}
          </div>
        </div>

        {/* Investment Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-2xl border border-blue-100/60">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-semibold text-blue-900">ROI</span>
            </div>
            <div className="text-2xl font-bold text-blue-800">
              {estimatedRoi.toFixed(1)}%
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-emerald-50 to-green-50 p-4 rounded-2xl border border-emerald-100/60">
            <div className="flex items-center gap-2 mb-2">
              <Percent className="w-5 h-5 text-emerald-600" />
              <span className="text-sm font-semibold text-emerald-900">Yield</span>
            </div>
            <div className="text-2xl font-bold text-emerald-800">
              {estimatedYield.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Investment Metrics Display */}
        {(monthlyRent || grossYield) && (
          <div className="space-y-2">
            <h4 className="font-semibold text-gray-900">Investment Potential</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {monthlyRent && (
                <div className="text-center p-2 bg-blue-50 rounded-lg">
                  <div className="font-semibold text-blue-800">Monthly Rent</div>
                  <div className="text-blue-600">£{monthlyRent}</div>
                </div>
              )}
              {grossYield > 0 && (
                <div className="text-center p-2 bg-green-50 rounded-lg">
                  <div className="font-semibold text-green-800">Gross Yield</div>
                  <div className="text-green-600">{grossYield.toFixed(1)}%</div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Property Description */}
        <div className="space-y-2">
          <h4 className="font-semibold text-gray-900">Property Details</h4>
          <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">
            {property.description || `${property.bedrooms || 4}-bed property in ${property.city || 'Unknown'}. Great potential for HMO conversion with strong rental demand in the area.`}
          </p>
          {property.postcode && (
            <div className="text-xs text-gray-500">
              Postcode: {property.postcode}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button 
            onClick={handleViewProperty}
            disabled={!property.property_url}
            className="w-full h-14 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold text-lg rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] flex items-center justify-center gap-3"
          >
            <span>View Property</span>
            <ExternalLink className="w-5 h-5" />
          </button>
          
          <button 
            onClick={() => onAnalyze(property)}
            className="w-full h-10 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold text-sm rounded-xl shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02] flex items-center justify-center gap-2"
          >
            <Calculator className="w-4 h-4" />
            <span>Analyze</span>
          </button>
        </div>
      </div>

      {/* Corner decoration */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
    </div>
  );
}
