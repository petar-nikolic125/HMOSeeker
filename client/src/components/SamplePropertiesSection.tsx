import { useState } from 'react';
import { PropertyCard } from './PropertyCard';
import { PropertyWithAnalytics } from '@/lib/types';
import { TrendingUp, MapPin, Calculator, Sparkles } from 'lucide-react';

// Sample property data with real-looking data for demonstration
const sampleProperties: PropertyWithAnalytics[] = [
  {
    id: '1',
    address: '45 Victoria Street, Liverpool L1 6BX',
    price: 180000,
    bedrooms: 5,
    bathrooms: 2,

    description: 'Victorian terraced house in prime Liverpool location, perfect for HMO conversion. Close to universities and transport links. Recently refurbished ground floor.',
    imageUrl: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&h=600&fit=crop',
    propertyUrl: 'https://www.zoopla.co.uk/property/liverpool/',
    agentName: 'Preston Baker',
    agentPhone: '0151 123 4567',
    agentEmail: 'info@prestonbaker.co.uk',
    source: 'demo',
    title: 'Victorian Terraced House - HMO Opportunity',
    listing_id: 'demo-001',
    coordinates: [53.4084, -2.9916],
    roi: 24.5,
    grossYield: 8.2,
    profitabilityScore: 'High',
    lhaWeekly: 95,
    lhaMonthly: 410,
    rightmoveUrl: 'https://www.rightmove.co.uk/properties/liverpool',
    zooplaUrl: 'https://www.zoopla.co.uk/property/liverpool/',
    primeLocationUrl: 'https://www.primelocation.com/property/liverpool'
  },
  {
    id: '2',
    address: '12 Kensington Road, Manchester M14 7NH',
    price: 165000,
    bedrooms: 6,
    bathrooms: 3,

    description: 'Spacious double-fronted property in sought-after Fallowfield area. Ideal for student accommodation with excellent rental yields. Walking distance to universities.',
    imageUrl: 'https://images.unsplash.com/photo-1565402170291-8491f14678db?w=800&h=600&fit=crop',
    propertyUrl: 'https://www.rightmove.co.uk/properties/manchester/',
    agentName: 'City Properties',
    agentPhone: '0161 234 5678',
    agentEmail: 'sales@cityproperties.co.uk',
    source: 'demo',
    title: 'Double-Fronted Student Property',
    listing_id: 'demo-002',
    coordinates: [53.4808, -2.2426],
    roi: 28.3,
    grossYield: 9.1,
    profitabilityScore: 'High',
    lhaWeekly: 88,
    lhaMonthly: 380,
    rightmoveUrl: 'https://www.rightmove.co.uk/properties/manchester/',
    zooplaUrl: 'https://www.zoopla.co.uk/property/manchester/',
    primeLocationUrl: 'https://www.primelocation.com/property/manchester'
  },
  {
    id: '3',
    address: '78 Granby Street, Leicester LE1 3DQ',
    price: 135000,
    bedrooms: 4,
    bathrooms: 2,

    description: 'Traditional terraced property in established residential area. Great potential for HMO conversion with strong rental demand from local professionals and students.',
    imageUrl: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=800&h=600&fit=crop',
    propertyUrl: 'https://www.primelocation.com/property/leicester',
    agentName: 'Midlands Estate Agency',
    agentPhone: '0116 345 6789',
    agentEmail: 'info@midlandsea.co.uk',
    source: 'demo', 
    title: 'Traditional Terraced Property',
    listing_id: 'demo-003',
    coordinates: [52.6369, -1.1398],
    roi: 22.7,
    grossYield: 7.8,
    profitabilityScore: 'Medium',
    lhaWeekly: 82,
    lhaMonthly: 355,
    rightmoveUrl: 'https://www.rightmove.co.uk/properties/leicester/',
    zooplaUrl: 'https://www.zoopla.co.uk/property/leicester/',
    primeLocationUrl: 'https://www.primelocation.com/property/leicester'
  }
];

export const SamplePropertiesSection = () => {
  const [selectedProperty, setSelectedProperty] = useState<PropertyWithAnalytics | null>(null);

  return (
    <section className="py-20 bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="container mx-auto px-4">
        
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-medium mb-4">
            <Sparkles className="w-4 h-4" />
            Featured Investment Opportunities
          </div>
          
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            High-Yield HMO Properties
          </h2>
          
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            Discover carefully selected investment properties with exceptional ROI potential. 
            Our AI analyzes thousands of listings to find the most profitable HMO opportunities across the UK.
          </p>
          
          {/* Stats */}
          <div className="flex flex-wrap justify-center gap-8 mt-10">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">8.5%</div>
              <div className="text-sm text-gray-600">Average Yield</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">25.8%</div>
              <div className="text-sm text-gray-600">Average ROI</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">2.1</div>
              <div className="text-sm text-gray-600">Years Payback</div>
            </div>
          </div>
        </div>

        {/* Property Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {sampleProperties.map((property, index) => (
            <PropertyCard 
              key={property.id}
              property={property}
              delay={index * 150}
            />
          ))}
        </div>

        {/* Call to Action */}
        <div className="text-center">
          <div className="bg-white rounded-2xl p-8 shadow-xl border border-gray-200 max-w-4xl mx-auto">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              Ready to Find Your Perfect Investment?
            </h3>
            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
              Access our complete database of HMO-suitable properties with detailed analytics, 
              ROI calculations, and comprehensive market data.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 flex items-center justify-center gap-2">
                <Calculator className="w-5 h-5" />
                Start Property Search
              </button>
              
              <button className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-8 py-3 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center gap-2">
                <TrendingUp className="w-5 h-5" />
                View Market Analysis
              </button>
            </div>
          </div>
        </div>

        {/* Location Highlights */}
        <div className="mt-20">
          <h3 className="text-2xl font-bold text-center text-gray-900 mb-8">
            Top HMO Investment Locations
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 hover:border-blue-300 transition-colors">
              <div className="flex items-center gap-3 mb-3">
                <MapPin className="w-6 h-6 text-blue-600" />
                <h4 className="font-semibold text-gray-900">Liverpool</h4>
              </div>
              <p className="text-gray-600 text-sm mb-3">Strong student population and excellent transport links</p>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Avg. Yield:</span>
                <span className="font-semibold text-green-600">8.2%</span>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 hover:border-blue-300 transition-colors">
              <div className="flex items-center gap-3 mb-3">
                <MapPin className="w-6 h-6 text-blue-600" />
                <h4 className="font-semibold text-gray-900">Manchester</h4>
              </div>
              <p className="text-gray-600 text-sm mb-3">Thriving business district with high rental demand</p>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Avg. Yield:</span>
                <span className="font-semibold text-green-600">9.1%</span>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 hover:border-blue-300 transition-colors">
              <div className="flex items-center gap-3 mb-3">
                <MapPin className="w-6 h-6 text-blue-600" />
                <h4 className="font-semibold text-gray-900">Leicester</h4>
              </div>
              <p className="text-gray-600 text-sm mb-3">Growing economy and affordable property prices</p>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Avg. Yield:</span>
                <span className="font-semibold text-green-600">7.8%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};