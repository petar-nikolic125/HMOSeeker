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
  geocodeAccuracy: string;
  dataSource: string[];
  lastChecked: string;
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
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-blue-600" />
          Article 4 Direction Check
        </CardTitle>
        <CardDescription>
          Check if a postcode falls within an Article 4 direction area that restricts HMO conversions. Free tool using official government data.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Enter postcode (e.g., SW1A, UB4, B5 5SE, or SW1A 1AA)"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              className="flex-1"
              disabled={isLoading}
            />
            <Button 
              onClick={handleCheck} 
              disabled={isLoading || !postcode.trim()}
              className="shrink-0"
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
            <span className="text-xs">Quick examples:</span>
            <button 
              onClick={() => setPostcode('B5 5SE')} 
              className="px-2 py-1 bg-blue-50 hover:bg-blue-100 rounded text-blue-700 text-xs transition-colors"
              data-testid="button-example"
            >
              B5 5SE (Birmingham)
            </button>
            <button 
              onClick={() => setPostcode('SW1A 1AA')} 
              className="px-2 py-1 bg-blue-50 hover:bg-blue-100 rounded text-blue-700 text-xs transition-colors"
              data-testid="button-example"
            >
              SW1A 1AA (London)
            </button>
            <button 
              onClick={() => setPostcode('M1 1AA')} 
              className="px-2 py-1 bg-blue-50 hover:bg-blue-100 rounded text-blue-700 text-xs transition-colors"
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
            <div className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 border rounded-lg" data-testid="result-main">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  {result.inArticle4 ? (
                    <AlertTriangle className="h-6 w-6 text-amber-600" />
                  ) : (
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  )}
                  <div>
                    <p className="font-semibold text-lg" data-testid="text-postcode">
                      {result.postcode}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <MapPin className="h-3 w-3" />
                      <span>Lat: {result.lat.toFixed(4)}, Lon: {result.lon.toFixed(4)}</span>
                      <Badge variant="outline" className="text-xs">
                        {result.geocodeAccuracy} match
                      </Badge>
                    </div>
                  </div>
                </div>
                <Badge 
                  variant={result.inArticle4 ? "destructive" : "default"}
                  className={result.inArticle4 ? "bg-amber-100 text-amber-800 hover:bg-amber-100" : "bg-green-100 text-green-800 hover:bg-green-100"}
                  data-testid="badge-status"
                >
                  {result.inArticle4 ? "Article 4 Area" : "No Restrictions"}
                </Badge>
              </div>
              
              {/* Data Quality Indicators */}
              <div className="flex items-center gap-4 text-xs text-gray-500 border-t pt-2">
                <div className="flex items-center gap-1">
                  <Database className="h-3 w-3" />
                  <span>Sources: {result.dataSource.join(", ")}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>Checked: {new Date(result.lastChecked).toLocaleTimeString()}</span>
                </div>
              </div>
            </div>

            {/* Enhanced Suggestions */}
            {result.suggestions && result.suggestions.length > 0 && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg" data-testid="suggestions">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="h-4 w-4 text-blue-600" />
                  <h4 className="font-medium text-blue-900">Key Insights</h4>
                </div>
                <div className="space-y-2">
                  {result.suggestions.map((suggestion, index) => (
                    <div key={index} className="flex items-start gap-2 text-sm text-blue-800">
                      <span className="text-blue-400 mt-0.5">•</span>
                      <span>{suggestion}</span>
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

            <Article4Map
              lat={result.lat}
              lon={result.lon}
              postcode={result.postcode}
              article4Areas={result.areas}
            />

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

        <div className="text-xs text-gray-500 space-y-1 bg-gray-50 p-3 rounded border">
          <p className="font-medium text-gray-700 mb-1">Data Sources & Accuracy:</p>
          <p>• Enhanced multi-source data from planning.data.gov.uk, postcodes.io, and verified city-wide databases</p>
          <p>• Real-time geocoding with multiple fallback strategies for maximum coverage</p>
          <p>• City-wide Article 4 directions verified and updated regularly</p>
          <p className="text-amber-600 font-medium pt-1">⚠️ This tool provides guidance only - always verify with local planning authorities before making investment decisions</p>
        </div>
      </CardContent>
    </Card>
  );
}