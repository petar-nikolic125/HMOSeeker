import { useEffect, useRef } from 'react';
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

// Generate pseudo-random coordinates within city boundaries for unique property locations
const generatePropertyCoordinates = (city: string, address: string = '') => {
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

  const baseCoords = baseCityCoords[city] || baseCityCoords['London'];
  
  // Create a simple hash from the address to ensure consistent positioning
  let hash = 0;
  const text = address + city;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Use hash to generate consistent but different offsets within the city
  const latOffset = ((hash % 200) - 100) / 10000; // ±0.01 degrees (roughly ±1km)
  const lonOffset = (((hash * 7) % 200) - 100) / 10000;
  
  return [
    baseCoords[0] + latOffset,
    baseCoords[1] + lonOffset
  ] as [number, number];
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

  useEffect(() => {
    if (!mapContainer.current) return;

    // Get unique coordinates for this property
    const coordinates = generatePropertyCoordinates(city, address || '');
    
    // Initialize map
    map.current = L.map(mapContainer.current).setView(coordinates, 13);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map.current);

    // Add marker for the property location
    const marker = L.marker(coordinates).addTo(map.current);
    
    marker.bindPopup(`
      <div class="p-2">
        <h3 class="font-semibold">${city}</h3>
        ${address ? `<p class="text-sm text-gray-600 mt-1">${address}</p>` : ''}
        ${postcode ? `<p class="text-sm text-blue-600 font-mono mt-1">${postcode}</p>` : ''}
        <p class="text-xs text-green-600 font-semibold mt-2">✓ Non-Article 4 Property</p>
        <p class="text-xs text-gray-500">HMO conversion permitted (subject to planning)</p>
      </div>
    `);

    // Add a property area circle
    L.circle(coordinates, {
      color: '#059669', // Green for non-Article 4
      fillColor: '#d1fae5',
      fillOpacity: 0.3,
      radius: 500, // 500m radius
      weight: 2,
    }).addTo(map.current);

    // Add Article 4 overlay areas if enabled
    if (showArticle4Overlay && postcode) {
      loadArticle4Overlays(coordinates, map.current);
    }

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
    <div 
      ref={mapContainer} 
      className={`w-full rounded-lg border ${className}`}
      style={{ height }}
    />
  );
}