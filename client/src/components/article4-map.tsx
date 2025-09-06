import { useEffect, useRef } from 'react';
import { MapPin, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in Leaflet with Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface Article4MapProps {
  lat: number;
  lon: number;
  postcode?: string;
  article4Areas?: Array<{
    name: string;
    council: string;
    reference: string;
  }>;
  className?: string;
}

export default function Article4Map({ lat, lon, postcode, article4Areas, className = '' }: Article4MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);

  const openInGoogleMaps = () => {
    window.open(`https://www.google.com/maps?q=${lat},${lon}`, '_blank');
  };

  const openInOSM = () => {
    window.open(`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}&zoom=15`, '_blank');
  };

  useEffect(() => {
    if (!mapContainer.current) return;

    // Initialize map
    map.current = L.map(mapContainer.current).setView([lat, lon], 15);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map.current);

    // Add marker for the postcode location
    const marker = L.marker([lat, lon]).addTo(map.current);
    
    if (postcode) {
      marker.bindPopup(`
        <div class="p-3">
          <h3 class="font-semibold text-lg">${postcode}</h3>
          <p class="text-sm text-gray-600 mt-1">Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}</p>
          ${article4Areas && article4Areas.length > 0 
            ? `<div class="mt-3">
                <span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-800">
                  Article 4 Area
                </span>
                <div class="mt-2 space-y-1">
                  ${article4Areas.map(area => `
                    <div class="text-xs">
                      <strong>${area.name}</strong><br>
                      <span class="text-gray-600">${area.council}</span>
                    </div>
                  `).join('')}
                </div>
              </div>`
            : `<div class="mt-3">
                <span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                  No Article 4 Restrictions
                </span>
              </div>`
          }
        </div>
      `);
    }

    // If there are Article 4 areas, show a visual indication with a circle
    if (article4Areas && article4Areas.length > 0) {
      L.circle([lat, lon], {
        color: '#f59e0b',
        fillColor: '#fbbf24',
        fillOpacity: 0.3,
        radius: 500, // 500 meter radius as visual indicator
      }).addTo(map.current).bindPopup(`
        <div class="p-3">
          <h3 class="font-semibold text-amber-800">Article 4 Direction Area</h3>
          <p class="text-sm text-amber-700 mt-1">This location is within an Article 4 area:</p>
          <ul class="mt-2 space-y-1">
            ${article4Areas.map(area => `
              <li class="text-xs">
                <strong>${area.name}</strong><br>
                <span class="text-gray-600">${area.council}</span>
              </li>
            `).join('')}
          </ul>
        </div>
      `);
    }

    // Cleanup function
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [lat, lon, postcode, article4Areas]);

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-3">
          <MapPin className="h-5 w-5 text-blue-600" />
          <div>
            <p className="font-semibold">{postcode || 'Location'}</p>
            <p className="text-sm text-gray-600">
              {lat.toFixed(4)}, {lon.toFixed(4)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={openInOSM}
            className="flex items-center gap-1"
          >
            <ExternalLink className="h-3 w-3" />
            OpenStreetMap
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={openInGoogleMaps}
            className="flex items-center gap-1"
          >
            <ExternalLink className="h-3 w-3" />
            Google Maps
          </Button>
        </div>
      </div>

      {/* Interactive Leaflet Map */}
      <div 
        ref={mapContainer} 
        className="h-64 w-full rounded-lg border"
        style={{ minHeight: '300px' }}
      />

      {article4Areas && article4Areas.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm font-medium text-amber-800 mb-2">
            This location is within {article4Areas.length} Article 4 Direction area{article4Areas.length > 1 ? 's' : ''}:
          </p>
          <div className="space-y-2">
            {article4Areas.map((area, index) => (
              <div key={index} className="text-sm text-amber-700">
                <span className="font-medium">{area.name}</span> - {area.council}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-xs text-gray-500">
        <p>• Interactive map shows exact postcode location with Article 4 indication</p>
        <p>• Orange circle indicates Article 4 direction coverage area</p>
        <p>• Click markers and areas for detailed information</p>
      </div>
    </div>
  );
}