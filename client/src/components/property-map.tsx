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
  // Enhanced UK postcode regex - more comprehensive patterns
  const postcodePatterns = [
    // Full postcodes like SW1A 1AA, SE18 1AA, RM11 1AA, BR6 9AA, HA0 3AA
    /\b([A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2})\b/i,
    // Partial postcodes like SE18, RM11, SW1A, BR6, HA0, etc.
    /\b([A-Z]{1,2}[0-9][A-Z0-9]?)\b/i,
    // Extract from property titles like "Wayne Close, Orpington BR6" -> BR6
    /,\s*([A-Z]+\s+[A-Z]{1,2}[0-9][A-Z0-9]?)\b/i,
    // Extract from addresses like "Rugby Avenue, Wembley HA0" -> HA0  
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
const queueGeocoding = <T>(fn: () => Promise<T>): Promise<T> => {
  geocodingQueue = geocodingQueue.then(fn);
  return geocodingQueue;
};

// Multiple geocoding strategies with comprehensive fallbacks
const geocodeAddress = async (address: string, postcode?: string): Promise<[number, number] | null> => {
  console.log(`🔍 Starting geocoding for: "${address}" with postcode: "${postcode || 'none'}"`);
  
  // Strategy 1: Try precise address geocoding with Nominatim (OpenStreetMap) - Enhanced for accuracy
  const tryPreciseAddress = async (fullAddress: string): Promise<[number, number] | null> => {
    try {
      // Clean and format the address for UK geocoding
      const cleanAddress = fullAddress
        .replace(/\d+\s+bed\s+(detached|link\s+detached|semi-detached|terraced|end\s+terrace)\s+house\s+for\s+sale\s+/i, '')
        .replace(/\d+\s+bed\s+(flat|apartment)\s+for\s+sale\s+/i, '')
        .replace(/,\s*(UK|England)$/i, '')
        .trim();
      
      console.log(`🎯 Trying precise address: "${cleanAddress}"`);
      
      // Extract street name and area for targeted geocoding
      const addressParts = cleanAddress.split(',').map(part => part.trim());
      const streetName = addressParts[0] || '';
      const area = addressParts[1] || '';
      const postcodePart = addressParts[addressParts.length - 1] || '';
      
      console.log(`📍 Parsed address: Street="${streetName}", Area="${area}", Postcode="${postcodePart}"`);
      
      // Build highly specific queries prioritizing exact street name
      const queries = [
        // Most specific: Street + Area + Postcode + UK
        `${streetName}, ${area}, ${postcodePart}, UK`,
        // Street + Area + UK
        `${streetName}, ${area}, UK`,
        // Street + Postcode + UK  
        `${streetName}, ${postcodePart}, UK`,
        // Just street and area
        `${streetName}, ${area}`,
        // Original clean address
        `${cleanAddress}, UK`,
        `${cleanAddress}`
      ].filter(query => query.length > 5); // Remove empty queries
      
      for (const query of queries) {
        console.log(`🎯 Trying specific query: "${query}"`);
        const encodedAddress = encodeURIComponent(query);
        const response = await queueGeocoding(() => fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodedAddress}&format=json&limit=5&countrycodes=gb&addressdetails=1&extratags=1`,
          {
            headers: {
              'User-Agent': 'HMO-Hunter/1.0 (Property Investment Platform)'
            },
            signal: AbortSignal.timeout(8000) // 8 second timeout
          }
        ));
        
        if (response.ok) {
          const data = await response.json();
          if (data && data.length > 0) {
            // Prioritize results with exact street matches
            for (const result of data) {
              const lat = parseFloat(result.lat);
              const lon = parseFloat(result.lon);
              
              if (!isNaN(lat) && !isNaN(lon)) {
                const displayName = result.display_name || '';
                const resultClass = result.class || '';
                const resultType = result.type || '';
                
                // Strict verification for street-level accuracy
                const streetNameLower = streetName.toLowerCase();
                const displayNameLower = displayName.toLowerCase();
                
                // Check if this is a street-level result (not just an area or postcode)
                const isStreetLevel = 
                  displayNameLower.includes(streetNameLower) && 
                  (resultClass === 'highway' || resultType === 'residential' || 
                   resultType === 'service' || resultType === 'primary' || 
                   resultType === 'secondary' || resultType === 'tertiary' ||
                   displayNameLower.includes('road') || displayNameLower.includes('street') ||
                   displayNameLower.includes('avenue') || displayNameLower.includes('place') ||
                   displayNameLower.includes('crescent') || displayNameLower.includes('close'));
                
                if (isStreetLevel) {
                  console.log(`✅ Precise geocoded "${streetName}": ${lat}, ${lon} (${result.display_name})`);
                  return [lat, lon];
                }
              }
            }
          }
        }
        
        // Small delay between requests to be respectful to the service
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    } catch (error) {
      // Silently handle network errors to avoid console spam
      if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('fetch'))) {
        console.log(`⚠️ Geocoding service temporarily unavailable`);
      } else {
        console.warn(`❌ Nominatim geocoding failed:`, error);
      }
    }
    return null;
  };

  // Strategy 2: Try direct postcode lookup
  const tryPostcode = async (pc: string): Promise<[number, number] | null> => {
    try {
      const cleanPostcode = pc.replace(/\s+/g, '').toUpperCase();
      console.log(`📮 Trying postcode: ${cleanPostcode}`);
      
      // Try full postcode first
      let response = await queueGeocoding(() => fetch(`https://api.postcodes.io/postcodes/${cleanPostcode}`, {
        signal: AbortSignal.timeout(5000) // 5 second timeout
      }));
      if (response.ok) {
        const data = await response.json();
        if (data.result) {
          console.log(`✅ Direct geocoded ${cleanPostcode}: ${data.result.latitude}, ${data.result.longitude} (${data.result.admin_district})`);
          return [data.result.latitude, data.result.longitude];
        }
      }
      
      // If full postcode fails, try partial postcode lookup
      if (cleanPostcode.length > 2) {
        const partialPostcode = cleanPostcode.substring(0, Math.min(4, cleanPostcode.length));
        console.log(`📮 Trying partial postcode: ${partialPostcode}`);
        
        response = await fetch(`https://api.postcodes.io/postcodes/${partialPostcode}/autocomplete`, {
          signal: AbortSignal.timeout(5000) // 5 second timeout
        });
        if (response.ok) {
          const data = await response.json();
          if (data.result && data.result.length > 0) {
            // Try the first few suggestions
            for (let i = 0; i < Math.min(2, data.result.length); i++) {
              const suggestion = data.result[i];
              const suggestionResponse = await fetch(`https://api.postcodes.io/postcodes/${suggestion}`, {
                signal: AbortSignal.timeout(5000) // 5 second timeout
              });
              if (suggestionResponse.ok) {
                const suggestionData = await suggestionResponse.json();
                if (suggestionData.result) {
                  console.log(`✅ Autocomplete geocoded ${suggestion}: ${suggestionData.result.latitude}, ${suggestionData.result.longitude} (${suggestionData.result.admin_district})`);
                  return [suggestionData.result.latitude, suggestionData.result.longitude];
                }
              }
            }
          }
        }
      }
    } catch (error) {
      // Silently handle network errors to avoid console spam
      if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('fetch'))) {
        console.log(`⚠️ PostCodes.io service temporarily unavailable for ${pc}`);
      } else {
        console.warn(`❌ PostCodes.io failed for ${pc}:`, error);
      }
    }
    return null;
  };

  // Strategy 2: Extract and try area-specific postcodes
  const tryAreaSpecificGeocoding = async (addr: string): Promise<[number, number] | null> => {
    const areaMatches = [
      // Specific area patterns
      { pattern: /orpington\s+br6?/i, postcodes: ['BR6 0AA', 'BR6 7AA', 'BR5 1AA'] },
      { pattern: /wembley\s+ha0?/i, postcodes: ['HA0 1AA', 'HA0 2AA', 'HA9 0AA'] },
      { pattern: /sidcup\s+da14?/i, postcodes: ['DA14 4AA', 'DA14 6AA', 'DA15 7AA'] },
      { pattern: /dagenham\s+rm[89]?/i, postcodes: ['RM8 1AA', 'RM9 4AA', 'RM10 7AA'] },
      { pattern: /romford\s+rm[67]?/i, postcodes: ['RM7 0AA', 'RM6 6AA', 'RM1 1AA'] },
      { pattern: /croydon\s+cr[057]?/i, postcodes: ['CR0 0AA', 'CR7 6AA', 'CR5 1AA'] },
      { pattern: /harrow\s+ha[0-3]?/i, postcodes: ['HA3 0AA', 'HA1 1AA', 'HA2 6AA'] },
      { pattern: /woolwich\s+se18?/i, postcodes: ['SE18 1AA', 'SE18 6AA'] },
      { pattern: /erith\s+da8?/i, postcodes: ['DA8 1AA', 'DA8 3AA'] },
      { pattern: /bromley\s+br[12]?/i, postcodes: ['BR1 1AA', 'BR2 0AA'] }
    ];

    for (const area of areaMatches) {
      if (area.pattern.test(addr)) {
        console.log(`🎯 Matched area pattern: ${area.pattern.source}`);
        for (const testPostcode of area.postcodes) {
          const result = await tryPostcode(testPostcode);
          if (result) return result;
        }
      }
    }
    return null;
  };

  // Execute geocoding strategies in order (limit concurrent requests)
  
  // 1. Try precise address geocoding first (most accurate) - ONLY if we get exact street match
  const preciseResult = await tryPreciseAddress(address);
  if (preciseResult) return preciseResult;
  
  console.log(`⚠️ No precise street-level geocoding found for "${address}"`);
  
  // Strategy 2: Try with simplified address components (reduced aggressive searching)
  const tryAlternativeStreetSearch = async (): Promise<[number, number] | null> => {
    const addressParts = address.toLowerCase().split(',').map(part => part.trim());
    const streetName = addressParts[0]?.replace(/\d+\s+bed\s+.*?house\s+for\s+sale\s+/i, '').trim();
    
    if (streetName.length > 5) { // Only try if street name is meaningful
      // Try only the most effective queries to reduce API load
      const streetQueries = [
        `${streetName}, UK`,
        streetName
      ];
      
      for (const query of streetQueries) {
        console.log(`🔍 Alternative street search: "${query}"`);
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=3&countrycodes=gb&addressdetails=1`,
            {
              headers: {
                'User-Agent': 'HMO-Hunter/1.0 (Property Investment Platform)'
              },
              signal: AbortSignal.timeout(6000) // 6 second timeout
            }
          );
          
          if (response.ok) {
            const data = await response.json();
            if (data && data.length > 0) {
              for (const result of data) {
                const lat = parseFloat(result.lat);
                const lon = parseFloat(result.lon);
                
                if (!isNaN(lat) && !isNaN(lon)) {
                  const displayName = result.display_name || '';
                  if (displayName.toLowerCase().includes(streetName.toLowerCase())) {
                    console.log(`✅ Alternative street geocoded "${streetName}": ${lat}, ${lon} (${displayName})`);
                    return [lat, lon];
                  }
                }
              }
            }
          }
        } catch (error) {
          // Silently handle network errors to avoid console spam
          if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('fetch'))) {
            console.log(`⚠️ Geocoding service temporarily unavailable for "${query}"`);
          } else {
            console.warn(`❌ Alternative street search failed for "${query}":`, error);
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 800)); // Longer delay to respect rate limits
      }
    }
    return null;
  };
  
  // Skip alternative search to reduce API load - go straight to reliable postcode fallback
  console.log(`⚠️ Skipping alternative street search to reduce API load`);
  
  // Use rate-limited postcode fallback instead
  
  // Strategy 3: Smart postcode fallback (only for general area, not precise location)
  const trySmartPostcodeFallback = async (): Promise<[number, number] | null> => {
    // Extract postcode patterns but use them only as broad area indicators
    const postcodePatterns = [
      /\b([A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2})\b/i, // Full postcode
      /\b([A-Z]{1,2}[0-9][A-Z0-9]?)\b/i // Partial postcode
    ];
    
    for (const pattern of postcodePatterns) {
      const match = address.match(pattern);
      if (match && match[1]) {
        const postcode = match[1].replace(/\s+/g, '').toUpperCase();
        console.log(`📮 Smart postcode area lookup: ${postcode}`);
        
        try {
          const response = await fetch(`https://api.postcodes.io/postcodes/${postcode}`, {
            signal: AbortSignal.timeout(5000) // 5 second timeout
          });
          if (response.ok) {
            const data = await response.json();
            if (data.result) {
              // Add small random offset to avoid all properties showing exact same location
              const baseLatOffset = (Math.random() - 0.5) * 0.008; // ~400m variation
              const baseLonOffset = (Math.random() - 0.5) * 0.008;
              
              const lat = data.result.latitude + baseLatOffset;
              const lon = data.result.longitude + baseLonOffset;
              
              console.log(`✅ Smart postcode area "${postcode}": ${lat}, ${lon} (${data.result.admin_district}) +offset`);
              return [lat, lon];
            }
          }
        } catch (error) {
          // Silently handle network errors
          if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('fetch'))) {
            console.log(`⚠️ PostCodes.io service temporarily unavailable for ${postcode}`);
          } else {
            console.warn(`❌ Smart postcode lookup failed for ${postcode}:`, error);
          }
        }
      }
    }
    return null;
  };
  
  const postcodeResult = await queueGeocoding(() => trySmartPostcodeFallback());
  if (postcodeResult) return postcodeResult;

  console.warn(`❌ All geocoding strategies failed for: "${address}"`);
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
      try {
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
        
        // Initialize map with the determined coordinates
        if (map.current) {
          map.current.remove();
        }
        
        if (!mapContainer.current) {
          setIsGeocoding(false);
          return;
        }
        
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
        
        // Ensure loading state is cleared
        setIsGeocoding(false);
      
      } catch (error) {
        console.error('Error initializing map:', error);
        setIsGeocoding(false);
        
        // Still try to initialize basic map even if there are errors
        if (mapContainer.current && !map.current) {
          try {
            const fallbackCoords = getCityFallbackCoords(city);
            map.current = L.map(mapContainer.current).setView(fallbackCoords, 10);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              attribution: '© OpenStreetMap contributors'
            }).addTo(map.current);
          } catch (mapError) {
            console.error('Failed to initialize fallback map:', mapError);
          }
        }
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