import { MapPin, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
  const openInGoogleMaps = () => {
    window.open(`https://www.google.com/maps?q=${lat},${lon}`, '_blank');
  };

  const openInOSM = () => {
    window.open(`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}&zoom=15`, '_blank');
  };

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
        <p>• Click the map buttons above to view the exact location on interactive maps</p>
        <p>• Article 4 direction boundaries are determined by point-in-polygon analysis</p>
      </div>
    </div>
  );
}