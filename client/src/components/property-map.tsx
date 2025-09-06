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
  className?: string;
  height?: string;
}

// City coordinates for UK cities
const CITY_COORDINATES: Record<string, [number, number]> = {
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

export default function PropertyMap({ city, address, className = '', height = '200px' }: PropertyMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    // Get city coordinates
    const coordinates = CITY_COORDINATES[city] || CITY_COORDINATES['London'];
    
    // Initialize map
    map.current = L.map(mapContainer.current).setView(coordinates, 11);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map.current);

    // Add marker for the city center
    const marker = L.marker(coordinates).addTo(map.current);
    
    marker.bindPopup(`
      <div class="p-2">
        <h3 class="font-semibold">${city}</h3>
        ${address ? `<p class="text-sm text-gray-600 mt-1">${address}</p>` : ''}
        <p class="text-xs text-gray-500 mt-2">Property location area</p>
      </div>
    `);

    // Add a circle to show the general area
    L.circle(coordinates, {
      color: '#3b82f6',
      fillColor: '#dbeafe',
      fillOpacity: 0.2,
      radius: 5000, // 5km radius
    }).addTo(map.current);

    // Cleanup function
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [city, address]);

  return (
    <div 
      ref={mapContainer} 
      className={`w-full rounded-lg border ${className}`}
      style={{ height }}
    />
  );
}