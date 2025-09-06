import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in Leaflet with Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface PropertyMapProps {
  city: string;
  address?: string;
  postcode?: string;
  className?: string;
  height?: string;
  showArticle4Overlay?: boolean;
}

// Extract postcode from address text
const extractPostcodeFromAddress = (address: string): string | null => {
  // UK postcode regex - matches most UK postcode formats
  const postcodeRegex = /([A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2})/i;
  const match = address.match(postcodeRegex);
  return match ? match[1].replace(/\s+/g, '').toUpperCase() : null;
};

// Geocode address using PostCodes.io API
const geocodeAddress = async (address: string, postcode?: string): Promise<[number, number] | null> => {
  // First try with postcode if available
  if (postcode) {
    try {
      const cleanPostcode = postcode.replace(/\s+/g, '').toUpperCase();
      const response = await fetch(`https://api.postcodes.io/postcodes/${cleanPostcode}`);
      if (response.ok) {
        const data = await response.json();
        if (data.result) {
          return [data.result.latitude, data.result.longitude];
        }
      }
    } catch (error) {
      console.warn('PostCodes.io geocoding failed:', error);
    }
  }

  // Try to extract postcode from address if not provided
  if (!postcode) {
    const extractedPostcode = extractPostcodeFromAddress(address);
    if (extractedPostcode) {
      try {
        const response = await fetch(`https://api.postcodes.io/postcodes/${extractedPostcode}`);
        if (response.ok) {
          const data = await response.json();
          if (data.result) {
            return [data.result.latitude, data.result.longitude];
          }
        }
      } catch (error) {
        console.warn('PostCodes.io geocoding with extracted postcode failed:', error);
      }
    }
  }

  return null;
};

// Fallback coordinates for cities when geocoding fails
const getCityFallbackCoords = (city: string): [number, number] => {
  const baseCityCoords: Record<string, [number, number]> = {
    'London': [51.5074, -0.1278],
    'Manchester': [53.4808, -2.2426],
    'Birmingham': [52.4862, -1.8904],
    'Liverpool': [53.4084, -2.9916],
    'Leeds': [53.8008, -1.5491],
    'Sheffield': [53.3811, -1.4701],
    'Bristol': [51.4545, -2.5879],
    'Newcastle': [54.9783, -1.6178],
    'Nottingham': [52.9548, -1.1581],
    'Glasgow': [55.8642, -4.2518],
    'Edinburgh': [55.9533, -3.1883],
    'Cardiff': [51.4816, -3.1791],
    'Belfast': [54.5973, -5.9301],
  };

  return baseCityCoords[city] || baseCityCoords['London'];
};

export default function PropertyMap({ 
  city, 
  address, 
  postcode,
  className = '', 
  height = '200px',
  showArticle4Overlay = true 
}: PropertyMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const [coordinates, setCoordinates] = useState<[number, number] | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(true);

  useEffect(() => {
    if (!mapContainer.current) return;

    const initializeMap = async () => {
      setIsGeocoding(true);
      
      // Try to geocode the actual property address
      let propertyCoords: [number, number] | null = null;
      
      if (address) {
        propertyCoords = await geocodeAddress(address, postcode);
      }
      
      // Fallback to city coordinates if geocoding fails
      if (!propertyCoords) {
        propertyCoords = getCityFallbackCoords(city);
        console.warn(`Geocoding failed for "${address || 'no address'}", using city fallback for ${city}`);
      }
      
      setCoordinates(propertyCoords);
      setIsGeocoding(false);
      
      // Initialize map with the determined coordinates
      if (map.current) {
        map.current.remove();
      }
      
      if (!mapContainer.current) return;
      
      map.current = L.map(mapContainer.current).setView(propertyCoords, 14);

      // Add OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map.current);

      // Add marker for the property location
      const marker = L.marker(propertyCoords).addTo(map.current);
      
      // Extract postcode from address if not provided separately
      const displayPostcode = postcode || extractPostcodeFromAddress(address || '') || '';
      
      marker.bindPopup(`
        <div class="p-2">
          <h3 class="font-semibold text-sm">${city}</h3>
          ${address ? `<p class="text-xs text-gray-600 mt-1">${address}</p>` : ''}
          ${displayPostcode ? `<p class="text-xs text-blue-600 font-mono mt-1">${displayPostcode}</p>` : ''}
          <p class="text-xs text-green-600 font-semibold mt-2">✓ Non-Article 4 Property</p>
          <p class="text-xs text-gray-500">HMO conversion permitted (subject to planning)</p>
        </div>
      `);

      // Add a property area circle
      L.circle(propertyCoords, {
        color: '#059669', // Green for non-Article 4
        fillColor: '#d1fae5',
        fillOpacity: 0.3,
        radius: 300, // 300m radius
        weight: 2,
      }).addTo(map.current);

      // Add Article 4 overlay areas if enabled
      if (showArticle4Overlay && (postcode || displayPostcode)) {
        loadArticle4Overlays(propertyCoords, map.current);
      }
    };
    
    initializeMap();

    // Cleanup function
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [city, address, postcode, showArticle4Overlay]);

  // Function to load nearby Article 4 areas for context
  const loadArticle4Overlays = async (coordinates: [number, number], mapInstance: L.Map) => {
    try {
      const [lat, lng] = coordinates;
      const response = await fetch(`/api/article4-areas?lat=${lat}&lng=${lng}&radius=2`);
      
      if (response.ok) {
        const data = await response.json();
        
        // Add Article 4 areas as red overlays for context
        data.areas?.forEach((area: any, index: number) => {
          if (area.geometry && area.geometry.coordinates) {
            try {
              // Simple polygon rendering (this is a basic implementation)
              const polygon = L.polygon(
                area.geometry.coordinates[0].map((coord: number[]) => [coord[1], coord[0]]),
                {
                  color: '#dc2626',
                  fillColor: '#fef2f2',
                  fillOpacity: 0.2,
                  weight: 1,
                  dashArray: '5, 5'
                }
              );
              
              polygon.bindPopup(`
                <div class="p-2">
                  <h4 class="font-semibold text-red-600">⚠️ Article 4 Direction Area</h4>
                  <p class="text-sm mt-1">${area.name || 'Article 4 Area'}</p>
                  <p class="text-xs text-gray-600 mt-1">${area.council || 'Local Authority'}</p>
                  <p class="text-xs text-red-600 mt-2">HMO conversions restricted</p>
                </div>
              `);
              
              polygon.addTo(mapInstance);
            } catch (e) {
              console.warn('Could not render Article 4 area:', e);
            }
          }
        });
      }
    } catch (error) {
      console.warn('Could not load Article 4 overlays:', error);
      // Fail silently - map still works without overlays
    }
  };

  return (
    <div className={`relative w-full rounded-lg border ${className}`} style={{ height }}>
      {isGeocoding && (
        <div className="absolute inset-0 bg-gray-100 rounded-lg flex items-center justify-center z-10">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            Loading map...
          </div>
        </div>
      )}
      <div 
        ref={mapContainer} 
        className="w-full h-full rounded-lg"
        style={{ opacity: isGeocoding ? 0 : 1 }}
      />
    </div>
  );
}