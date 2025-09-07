import { useState } from 'react';
import { Search, MapPin, AlertTriangle, CheckCircle, Info } from 'lucide-react';
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
}

interface Article4Result {
  inArticle4: boolean;
  areas: Article4Area[];
  lat: number;
  lon: number;
  postcode?: string;
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
          Check if a postcode falls within an Article 4 direction area that restricts HMO conversions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Enter postcode (e.g., SW1A, UB4, or SW1A 1AA)"
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
          >
            {isLoading ? (
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Check
          </Button>
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
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                {result.inArticle4 ? (
                  <AlertTriangle className="h-6 w-6 text-amber-600" />
                ) : (
                  <CheckCircle className="h-6 w-6 text-green-600" />
                )}
                <div>
                  <p className="font-semibold">
                    {result.postcode}
                  </p>
                  <p className="text-sm text-gray-600">
                    Lat: {result.lat.toFixed(4)}, Lon: {result.lon.toFixed(4)}
                  </p>
                </div>
              </div>
              <Badge 
                variant={result.inArticle4 ? "destructive" : "default"}
                className={result.inArticle4 ? "bg-amber-100 text-amber-800 hover:bg-amber-100" : "bg-green-100 text-green-800 hover:bg-green-100"}
              >
                {result.inArticle4 ? "Article 4 Area" : "No Restrictions"}
              </Badge>
            </div>

            {result.inArticle4 && result.areas.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm text-gray-700">Article 4 Direction Areas:</h4>
                {result.areas.map((area, index) => (
                  <div key={index} className="p-3 border border-amber-200 bg-amber-50 rounded-lg">
                    <h5 className="font-medium text-amber-900">{area.name}</h5>
                    <p className="text-sm text-amber-700">Council: {area.council}</p>
                    {area.reference && (
                      <p className="text-sm text-amber-700">Reference: {area.reference}</p>
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

        <div className="text-xs text-gray-500 space-y-1">
          <p>• Data sourced from planning.data.gov.uk and postcodes.io</p>
          <p>• This tool provides guidance only - always verify with local planning authorities</p>
        </div>
      </CardContent>
    </Card>
  );
}