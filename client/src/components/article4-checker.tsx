import { useState } from 'react';
import { Search, MapPin, AlertTriangle, CheckCircle, Info, Clock, Database, Lightbulb, Shield, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import Article4Map from './article4-map';

interface Article4Area {
  name: string;
  council: string;
  reference: string;
  status?: string;
  dateImplemented?: string;
  restrictions?: string[];
  confidence: number;
}

interface Article4Result {
  inArticle4: boolean;
  areas: Article4Area[];
  lat: number;
  lon: number;
  postcode?: string;
  geocodeAccuracy?: string;
  source: string;
  processingTime?: number;
  fallback?: boolean;
  confidence?: number;
  status: string;
  suggestions?: string[];
}

export default function Article4Checker() {
  const [postcode, setPostcode] = useState('');
  const [result, setResult] = useState<Article4Result | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheck = async () => {
    if (!postcode.trim()) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`/api/check?postcode=${encodeURIComponent(postcode.trim())}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to check Article 4 status');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check Article 4 status');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCheck();
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto bg-gradient-to-br from-blue-50 via-white to-blue-50 border-blue-200">
      <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <MapPin className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-white text-xl">
                Article 4 Direction Checker
              </CardTitle>
              <CardDescription className="text-blue-100">
                Powered by article4map.com API • 307 English councils monitored daily
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Enter postcode (e.g., SW1A, UB4, B5 5SE, or SW1A 1AA)"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              className="flex-1 border-blue-300 focus:border-blue-500 focus:ring-blue-500"
              disabled={isLoading}
            />
            <Button 
              onClick={handleCheck} 
              disabled={isLoading || !postcode.trim()}
              className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="button-check"
            >
              {isLoading ? (
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Check
            </Button>
          </div>
          
          <div className="flex flex-wrap gap-2 text-sm text-gray-600">
            <span className="text-xs text-blue-600 font-medium">Quick examples:</span>
            <button 
              onClick={() => setPostcode('B5 5SE')} 
              className="px-3 py-1 bg-blue-100 hover:bg-blue-200 rounded-md text-blue-700 text-xs transition-colors font-medium"
              data-testid="button-example"
            >
              B5 5SE (Birmingham)
            </button>
            <button 
              onClick={() => setPostcode('SW1A 1AA')} 
              className="px-3 py-1 bg-blue-100 hover:bg-blue-200 rounded-md text-blue-700 text-xs transition-colors font-medium"
              data-testid="button-example"
            >
              SW1A 1AA (London)
            </button>
            <button 
              onClick={() => setPostcode('M1 1AA')} 
              className="px-3 py-1 bg-blue-100 hover:bg-blue-200 rounded-md text-blue-700 text-xs transition-colors font-medium"
              data-testid="button-example"
            >
              M1 1AA (Manchester)
            </button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        )}

        {result && !isLoading && (
          <div className="space-y-4">
            {/* Main Result Card */}
            <div className="p-5 bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl shadow-sm" data-testid="result-main">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  {result.inArticle4 ? (
                    <div className="bg-red-100 p-2 rounded-lg">
                      <AlertTriangle className="h-6 w-6 text-red-600" />
                    </div>
                  ) : (
                    <div className="bg-green-100 p-2 rounded-lg">
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-xl text-blue-900" data-testid="text-postcode">
                      {result.postcode}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-blue-700">
                      <MapPin className="h-3 w-3" />
                      {result.lat && result.lon ? (
                        <span>Lat: {result.lat.toFixed(4)}, Lon: {result.lon.toFixed(4)}</span>
                      ) : (
                        <span>Location verified</span>
                      )}
                      {result.confidence && (
                        <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700 border-blue-300">
                          {Math.round(result.confidence * 100)}% confidence
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <Badge 
                  variant={result.inArticle4 ? "destructive" : "default"}
                  className={result.inArticle4 ? "bg-red-500 text-white hover:bg-red-600 px-4 py-2 text-sm" : "bg-green-500 text-white hover:bg-green-600 px-4 py-2 text-sm"}
                  data-testid="badge-status"
                >
                  {result.inArticle4 ? "⚠️ Article 4 Area" : "✓ No Restrictions"}
                </Badge>
              </div>
              
              {/* Data Quality Indicators */}
              <div className="flex items-center gap-4 text-xs text-blue-600 border-t border-blue-200 pt-3 mt-3">
                <div className="flex items-center gap-1 bg-white/50 px-2 py-1 rounded">
                  <Database className="h-3 w-3" />
                  <span className="font-medium">article4map.com API</span>
                </div>
                {result.processingTime && (
                  <div className="flex items-center gap-1 bg-white/50 px-2 py-1 rounded">
                    <Clock className="h-3 w-3" />
                    <span>{result.processingTime}ms</span>
                  </div>
                )}
                {result.fallback && (
                  <div className="flex items-center gap-1 bg-white/50 px-2 py-1 rounded">
                    <Info className="h-3 w-3" />
                    <span>Fallback mode</span>
                  </div>
                )}
              </div>
            </div>

            {/* Enhanced Suggestions */}
            {result.suggestions && result.suggestions.length > 0 && (
              <div className="p-5 bg-gradient-to-br from-blue-100 to-blue-50 border-2 border-blue-300 rounded-xl" data-testid="suggestions">
                <div className="flex items-center gap-2 mb-3">
                  <div className="bg-blue-600 p-1.5 rounded-lg">
                    <Lightbulb className="h-4 w-4 text-white" />
                  </div>
                  <h4 className="font-bold text-blue-900">Key Insights</h4>
                </div>
                <div className="space-y-2">
                  {result.suggestions.map((suggestion, index) => (
                    <div key={index} className="flex items-start gap-2 text-sm text-blue-800">
                      <span className="text-blue-600 mt-0.5 font-bold">•</span>
                      <span className="font-medium">{suggestion}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Detailed Article 4 Areas */}
            {result.inArticle4 && result.areas.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-amber-600" />
                  <h4 className="font-medium text-amber-900">Article 4 Direction Details</h4>
                </div>
                {result.areas.map((area, index) => (
                  <div key={index} className="p-4 border border-amber-200 bg-amber-50 rounded-lg space-y-3" data-testid={`area-${index}`}>
                    <div className="flex items-center justify-between">
                      <h5 className="font-medium text-amber-900 flex-1">{area.name}</h5>
                      <Badge variant="outline" className="text-amber-700 border-amber-300">
                        {Math.round(area.confidence * 100)}% confidence
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-amber-700">
                      <div>
                        <span className="font-medium">Council:</span> {area.council}
                      </div>
                      {area.reference && (
                        <div>
                          <span className="font-medium">Reference:</span> {area.reference}
                        </div>
                      )}
                      {area.status && (
                        <div>
                          <span className="font-medium">Status:</span> 
                          <Badge variant="outline" className="ml-1 text-xs">
                            {area.status}
                          </Badge>
                        </div>
                      )}
                      {area.dateImplemented && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span className="font-medium">Since:</span> 
                          {new Date(area.dateImplemented).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    
                    {area.restrictions && area.restrictions.length > 0 && (
                      <div className="border-t border-amber-200 pt-2">
                        <p className="text-xs font-medium text-amber-800 mb-1">Restrictions:</p>
                        <div className="flex flex-wrap gap-1">
                          {area.restrictions.map((restriction, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs bg-amber-100 text-amber-800 border-amber-300">
                              {restriction}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {result.lat && result.lon && typeof result.lat === 'number' && typeof result.lon === 'number' && (
              <Article4Map
                lat={result.lat}
                lon={result.lon}
                postcode={result.postcode}
                article4Areas={result.areas}
              />
            )}

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                {result.inArticle4 
                  ? "This postcode is within an Article 4 Direction area. HMO conversions may require planning permission. Contact the local planning authority for specific requirements."
                  : "This postcode is not within any known Article 4 Direction areas. Standard permitted development rights for HMO conversions may apply, subject to other planning regulations."
                }
              </AlertDescription>
            </Alert>
          </div>
        )}

        <div className="text-xs text-blue-700 space-y-1 bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg border-2 border-blue-200">
          <div className="flex items-center gap-2 mb-2">
            <Database className="h-4 w-4 text-blue-600" />
            <p className="font-bold text-blue-900">Powered by article4map.com API</p>
          </div>
          <p className="font-medium">• 307 English councils monitored with daily updates</p>
          <p className="font-medium">• Multi-source verification from planning.data.gov.uk and official council databases</p>
          <p className="font-medium">• Real-time geocoding with precision location matching</p>
          <p className="text-red-600 font-bold pt-2 flex items-start gap-1">
            <span>⚠️</span>
            <span>Always verify with local planning authorities before making investment decisions</span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}