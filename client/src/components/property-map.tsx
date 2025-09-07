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

// Extract postcode from address text - enhanced version
const extractPostcodeFromAddress = (address: string): string | null => {
  const postcodePatterns = [
    /\b([A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2})\b/i,
    /\b([A-Z]{1,2}[0-9][A-Z0-9]?)\b/i,
    /,\s*([A-Z]+\s+[A-Z]{1,2}[0-9][A-Z0-9]?)\b/i,
    /\b(BR[0-9]|HA[0-9]|SE[0-9]+|SW[0-9]+|N[0-9]+|E[0-9]+|W[0-9]+|NW[0-9]+|CR[0-9]+|RM[0-9]+|DA[0-9]+|IG[0-9]+|UB[0-9]+|EN[0-9]+|KT[0-9]+|SM[0-9]+)\b/i
  ];
  
  for (const pattern of postcodePatterns) {
    const match = address.match(pattern);
    if (match) {
      return match[1].replace(/\s+/g, '').toUpperCase();
    }
  }
  
  return null;
};

// Global rate limiter for API requests
let geocodingQueue: Promise<any> = Promise.resolve();
const queueGeocoding = <T,>(fn: () => Promise<T>): Promise<T> => {
  geocodingQueue = geocodingQueue.then(fn);
  return geocodingQueue;
};

// Simplified geocoding with rate limiting
const geocodeAddress = async (address: string, postcode?: string): Promise<[number, number] | null> => {
  return queueGeocoding(async () => {
    try {
      const cleanAddress = address
        .replace(/\d+\s+bed\s+(detached|link\s+detached|semi-detached|terraced|end\s+terrace)\s+house\s+for\s+sale\s+/i, '')
        .replace(/\d+\s+bed\s+(flat|apartment)\s+for\s+sale\s+/i, '')
        .trim();

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=gb&q=${encodeURIComponent(cleanAddress + ', UK')}`
      );
      
      if (response.ok) {
        const results = await response.json();
        if (results && results.length > 0) {
          return [parseFloat(results[0].lat), parseFloat(results[0].lon)];
        }
      }
    } catch (e) {
      // Silent failure
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    return null;
  });
};

// City fallback coordinates
const getCityFallbackCoords = (city: string): [number, number] => {
  const cityCoords: { [key: string]: [number, number] } = {
    london: [51.5074, -0.1278],
    manchester: [53.4808, -2.2426],
    birmingham: [52.4862, -1.8904],
    liverpool: [53.4084, -2.9916],
    leeds: [53.8008, -1.5491],
    glasgow: [55.8642, -4.2518],
    bristol: [51.4545, -2.5879],
    cardiff: [51.4816, -3.1791],
    edinburgh: [55.9533, -3.1883],
    newcastle: [54.9783, -1.6178],
    sheffield: [53.3811, -1.4701],
    nottingham: [52.9548, -1.1581],
    leicester: [52.6369, -1.1398],
    coventry: [52.4068, -1.5197],
    bradford: [53.7960, -1.7594],
    plymouth: [50.3755, -4.1427],
    'stoke-on-trent': [53.0027, -2.1794],
    wolverhampton: [52.5862, -2.1282],
    derby: [52.9225, -1.4746],
    southampton: [50.9097, -1.4044],
    portsmouth: [50.8198, -1.0880],
    preston: [53.7632, -2.7031],
    northampton: [52.2405, -0.9027],
    dudley: [52.5120, -2.0417],
    reading: [51.4543, -0.9781]
  };
  
  return cityCoords[city.toLowerCase()] || cityCoords.london;
};

const PropertyMap: React.FC<PropertyMapProps> = ({ 
  city, 
  address, 
  postcode, 
  className = "", 
  height = "300px",
  showArticle4Overlay = false 
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const [coordinates, setCoordinates] = useState<[number, number] | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;
    
    const initializeMap = async () => {
      if (!isMounted || !mapContainer.current) return;
      
      setIsGeocoding(true);
      
      // Clean up existing map
      if (map.current) {
        try {
          map.current.remove();
        } catch (e) {
          // Silent cleanup
        }
        map.current = null;
      }
      
      // Get coordinates
      let propertyCoords: [number, number] | null = null;
      
      if (address && isMounted) {
        propertyCoords = await geocodeAddress(address, postcode);
      }
      
      if (!propertyCoords && isMounted) {
        propertyCoords = getCityFallbackCoords(city);
      }
      
      if (!isMounted || !propertyCoords) return;
      
      setCoordinates(propertyCoords);
      
      // Wait for DOM readiness with timeout
      const waitForContainer = () => {
        return new Promise<boolean>((resolve) => {
          const checkContainer = () => {
            if (!isMounted || !mapContainer.current || !document.contains(mapContainer.current)) {
              resolve(false);
              return;
            }
            
            const rect = mapContainer.current.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              resolve(true);
            } else {
              timeoutId = setTimeout(checkContainer, 50);
            }
          };
          
          checkContainer();
          
          // Timeout after 3 seconds
          setTimeout(() => resolve(false), 3000);
        });
      };
      
      const containerReady = await waitForContainer();
      
      if (!containerReady || !isMounted || !mapContainer.current) {
        setIsGeocoding(false);
        return;
      }
      
      try {
        // Clear container and create map with minimal config
        mapContainer.current.innerHTML = '';
        
        map.current = L.map(mapContainer.current, {
          zoomControl: false,
          attributionControl: false,
          fadeAnimation: false,
          zoomAnimation: false
        }).setView(propertyCoords, 14);
        
        if (!isMounted || !map.current) return;
        
        // Add tiles and markers
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OSM'
        }).addTo(map.current);

        const marker = L.marker(propertyCoords).addTo(map.current);
        const displayPostcode = postcode || extractPostcodeFromAddress(address || '') || '';
        
        marker.bindPopup(`
          <div class="p-2">
            <h3 class="font-semibold text-sm">${city}</h3>
            ${address ? `<p class="text-xs text-gray-600 mt-1">${address}</p>` : ''}
            ${displayPostcode ? `<p class="text-xs text-blue-600 font-mono mt-1">${displayPostcode}</p>` : ''}
            <p class="text-xs text-green-600 font-semibold mt-2">✓ Non-Article 4 Property</p>
          </div>
        `);

        L.circle(propertyCoords, {
          color: '#059669',
          fillColor: '#d1fae5',
          fillOpacity: 0.3,
          radius: 300,
          weight: 2,
        }).addTo(map.current);

        if (showArticle4Overlay && (postcode || displayPostcode)) {
          try {
            loadArticle4Overlays(propertyCoords, map.current);
          } catch (e) {
            // Silent failure
          }
        }
        
      } catch (e) {
        // Silent map creation failure
      } finally {
        if (isMounted) {
          setIsGeocoding(false);
        }
      }
    };
    
    initializeMap();

    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (map.current) {
        try {
          map.current.remove();
        } catch (e) {
          // Silent cleanup
        }
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
        
        data.areas?.forEach((area: any) => {
          if (area.geometry && area.geometry.coordinates) {
            try {
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
                </div>
              `);
              
              polygon.addTo(mapInstance);
            } catch (e) {
              // Silent polygon failure
            }
          }
        });
      }
    } catch (e) {
      // Silent overlay failure
    }
  };

  return (
    <div className={`relative ${className}`} style={{ height }}>
      <div 
        ref={mapContainer} 
        className="w-full h-full rounded-lg"
        style={{ minHeight: '200px' }}
      />
      
      {isGeocoding && (
        <div className="absolute inset-0 bg-gray-100 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-sm text-gray-600 mt-2">Loading map...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default PropertyMap;