import { useState, useEffect } from 'react';
import { PropertyWithAnalytics } from '@/lib/types';
import { formatCurrency, formatPercentage } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bed, Bath, Square, TrendingUp, Percent, ExternalLink, MapPin, Star, Calculator } from 'lucide-react';
import { PropertyAnalysis } from './PropertyAnalysis';

interface PropertyCardProps {
  property: PropertyWithAnalytics;
  delay?: number;
}

export const PropertyCard = ({ property, delay = 0 }: PropertyCardProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  // Check if this is a demo property or has real scraped URL
  const isDemoProperty = () => {
    return !property.propertyUrl || 
           property.propertyUrl.startsWith('#demo-property-') ||
           property.propertyUrl === '#';
  };

  // Get appropriate portal URL - always use actual property URLs when available
  const getPortalUrl = () => {
    // If it's a real scraped property with actual URL, use it
    if (property.propertyUrl && 
        property.propertyUrl !== '#' && 
        !property.propertyUrl.startsWith('#demo-property-') &&
        (property.propertyUrl.includes('zoopla.co.uk') || 
         property.propertyUrl.includes('primelocation.com') ||
         property.propertyUrl.includes('rightmove.co.uk'))) {
      return property.propertyUrl;
    }
    
    // For demo properties, create search URLs based on property details
    const city = property.address.split(',').pop()?.trim() || 'Birmingham';
    const bedrooms = property.bedrooms || 4;
    const maxPrice = Math.ceil(property.price * 1.1); // Add 10% buffer for similar properties
    
    // Create Zoopla search URL for similar properties
    const zooplaSearchUrl = `https://www.zoopla.co.uk/for-sale/property/${city.toLowerCase().replace(/\s+/g, '-')}/?beds_min=${bedrooms}&price_max=${maxPrice}&property_type=houses&search_source=for-sale`;
    
    return zooplaSearchUrl;
  };

  const getProfitabilityColor = (score: string | undefined) => {
    const normalized = (score || '').toLowerCase();
    if (normalized === 'high') return 'from-emerald-500 to-green-500';
    if (normalized === 'medium') return 'from-yellow-500 to-orange-500';
    return 'from-gray-400 to-gray-500';
  };

  const getYieldColor = (yieldPercent: number | undefined) => {
    const yield_val = yieldPercent || 0;
    if (yield_val >= 8) return 'from-purple-600 to-blue-600';
    if (yield_val >= 5) return 'from-blue-500 to-indigo-500';
    return 'from-slate-500 to-gray-500';
  };

  return (
    <div 
      className={`transform transition-all duration-700 ease-out ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'
      }`}
      data-testid="card-property"
    >
      <div className="group relative bg-white rounded-2xl md:rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-500 overflow-hidden border border-gray-200/60 hover:border-blue-300/60 hover:-translate-y-1 md:hover:-translate-y-2 backdrop-blur-sm">
        
        {/* Modern Image Section */}
        <div className="relative h-80 overflow-hidden">
          <img 
            src={property.imageUrl} 
            alt={property.address}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 filter group-hover:brightness-105"
            data-testid="img-property"
          />
          
          {/* Modern gradient overlays */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/70" />
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          
          {/* Floating badges */}
          <div className="absolute top-5 left-5 flex flex-col gap-2">
            <Badge 
              className={`bg-gradient-to-r ${getProfitabilityColor(property.profitabilityScore)} text-white border-0 shadow-xl backdrop-blur-md px-4 py-2 font-bold text-sm flex items-center gap-1.5`}
              data-testid="badge-profitability"
            >
              <Star className="w-4 h-4 fill-current" />
              {property.profitabilityScore || 'N/A'}
            </Badge>
          </div>
          
          <div className="absolute top-5 right-5">
            <Badge 
              className={`bg-gradient-to-r ${getYieldColor(property.grossYield)} text-white border-0 shadow-xl backdrop-blur-md px-4 py-2 font-bold text-sm flex items-center gap-1.5`}
              data-testid="badge-yield"
            >
              <Percent className="w-4 h-4" />
              {formatPercentage(property.grossYield)} Yield
            </Badge>
          </div>

          {/* Price overlay with modern styling */}
          <div className="absolute bottom-6 left-6 right-6">
            <div 
              className="text-4xl font-black text-white drop-shadow-2xl mb-2 tracking-tight"
              data-testid="text-price"
            >
              {formatCurrency(property.price)}
            </div>
            <div 
              className="flex items-center text-white/90 text-sm font-medium"
              data-testid="text-address"
            >
              <MapPin className="w-4 h-4 mr-1.5" />
              {property.address}
            </div>
          </div>
        </div>

        {/* Enhanced Content Section */}
        <div className="p-4 md:p-6 space-y-4 md:space-y-6">
          
          {/* Property Features with Modern Icons */}
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap items-center gap-3 md:gap-6">
              <div 
                className="flex items-center gap-2 text-gray-700"
                data-testid="text-bedrooms"
              >
                <div className="p-2 bg-blue-50 rounded-xl">
                  <Bed className="w-5 h-5 text-blue-600" />
                </div>
                <span className="font-semibold">{property.bedrooms}</span>
                <span className="text-sm text-gray-500">bedrooms</span>
              </div>
              
              {property.bathrooms && (
                <div 
                  className="flex items-center gap-2 text-gray-700"
                  data-testid="text-bathrooms"
                >
                  <div className="p-2 bg-emerald-50 rounded-xl">
                    <Bath className="w-5 h-5 text-emerald-600" />
                  </div>
                  <span className="font-semibold">{property.bathrooms}</span>
                  <span className="text-sm text-gray-500">baths</span>
                </div>
              )}
              
              {(property.size || property.predictedSqm) && (
                <div 
                  className="flex items-center gap-2 text-gray-700"
                  data-testid="text-area"
                >
                  <div className="p-2 bg-purple-50 rounded-xl">
                    <Square className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{property.size || property.predictedSqm}</span>
                      <span className="text-sm text-gray-500">m²</span>
                      {property.areaEstimated && (
                        <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                          predicted
                        </span>
                      )}
                    </div>
                    {property.areaEstimated && property.predictedSqft && (
                      <span className="text-xs text-gray-400">
                        ~{property.predictedSqft} sqft
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Investment Metrics with Modern Cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-2xl border border-blue-100/60">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-semibold text-blue-900">ROI</span>
              </div>
              <div 
                className="text-2xl font-bold text-blue-800"
                data-testid="text-roi"
              >
                {formatPercentage(property.roi)}
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-emerald-50 to-green-50 p-4 rounded-2xl border border-emerald-100/60">
              <div className="flex items-center gap-2 mb-2">
                <Percent className="w-5 h-5 text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-900">Yield</span>
              </div>
              <div 
                className="text-2xl font-bold text-emerald-800"
                data-testid="text-yield"
              >
                {formatPercentage(property.grossYield)}
              </div>
            </div>
          </div>

          {/* Property Description */}
          {property.description && (
            <div className="space-y-2">
              <h4 className="font-semibold text-gray-900">Property Details</h4>
              <p 
                className="text-sm text-gray-600 leading-relaxed line-clamp-3"
                data-testid="text-description"
              >
                {property.description}
              </p>
            </div>
          )}

          {/* Modern CTA Buttons */}
          <div className="space-y-3">
            {/* Primary View Property Button - Centered */}
            <Button 
              onClick={() => window.open(getPortalUrl(), '_blank')}
              className="w-full h-14 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold text-lg rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] flex items-center justify-center gap-3"
              data-testid="button-view"
            >
              <span>{isDemoProperty() ? 'Search Similar Properties' : 'View Property'}</span>
              <ExternalLink className="w-5 h-5" />
            </Button>
            
            {/* Demo Property Notice */}
            {isDemoProperty() && (
              <div className="text-xs text-gray-500 text-center bg-gray-50 px-3 py-2 rounded-lg">
                <span className="inline-flex items-center gap-1">
                  <Star className="w-3 h-3" />
                  Demo property - Click to search similar listings on property portals
                </span>
              </div>
            )}
            
            {/* Secondary Analyze Button - Smaller and Below */}
            <Button 
              onClick={() => setIsAnalysisOpen(true)}
              className="w-full h-10 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold text-sm rounded-xl shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02] flex items-center justify-center gap-2"
              data-testid="button-analyze"
            >
              <Calculator className="w-4 h-4" />
              <span>Analyze</span>
            </Button>
          </div>
        </div>

        {/* Subtle corner decoration */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      </div>

      {/* Property Analysis Modal */}
      <PropertyAnalysis 
        property={property}
        isOpen={isAnalysisOpen}
        onClose={() => setIsAnalysisOpen(false)}
      />
    </div>
  );
};