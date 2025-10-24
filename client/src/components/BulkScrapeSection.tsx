import { Database, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from './ui/button';
import { useToast } from '@/hooks/use-toast';
import { Progress } from './ui/progress';

export default function BulkScrapeSection() {
  const { toast } = useToast();
  const [scrapingStarted, setScrapingStarted] = useState(false);

  const bulkScrapeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/bulk-scrape', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to start bulk scraping');
      return response.json();
    },
    onSuccess: (data) => {
      setScrapingStarted(true);
      toast({
        title: "Bulk Scraping Started! 🚀",
        description: `Scraping ${data.cities_count} UK cities with 2+ bedrooms, max £700k.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Scraping Failed ❌",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const { data: progress } = useQuery({
    queryKey: ['bulk-scrape-progress'],
    queryFn: async () => {
      const response = await fetch('/api/bulk-scrape/progress');
      return response.json();
    },
    enabled: scrapingStarted,
    refetchInterval: scrapingStarted ? 2000 : false,
  });

  const handleStartScraping = () => {
    bulkScrapeMutation.mutate();
  };

  const isRunning = progress?.progress?.isRunning;
  const progressPercent = progress?.progress?.total > 0 
    ? (progress.progress.current / progress.progress.total) * 100 
    : 0;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <Database className="w-6 h-6 text-white" />
              <h3 className="text-xl font-bold text-white">
                Bulk Property Scraper
              </h3>
            </div>
            <p className="text-white/90 text-sm mb-4">
              Automatically scrape and cache properties from all major UK cities. 
              Settings: 2+ bedrooms, max £700k per city.
            </p>
            
            {isRunning && progress?.progress && (
              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between text-sm text-white">
                  <span>Scraping: {progress.progress.currentCity}</span>
                  <span className="font-semibold">
                    {progress.progress.current} / {progress.progress.total} cities
                  </span>
                </div>
                <Progress value={progressPercent} className="h-2" />
              </div>
            )}

            {progress?.progress?.status === 'completed' && (
              <div className="flex items-center gap-2 text-green-400 text-sm mb-4">
                <CheckCircle className="w-4 h-4" />
                <span>All cities scraped successfully!</span>
              </div>
            )}

            {progress?.progress?.status === 'failed' && (
              <div className="flex items-center gap-2 text-red-400 text-sm mb-4">
                <AlertCircle className="w-4 h-4" />
                <span>Scraping failed. Please try again.</span>
              </div>
            )}
          </div>

          <Button
            onClick={handleStartScraping}
            disabled={bulkScrapeMutation.isPending || isRunning}
            size="lg"
            className="bg-white text-blue-600 hover:bg-gray-100 font-semibold shadow-lg"
            data-testid="button-bulk-scrape-main"
          >
            {bulkScrapeMutation.isPending || isRunning ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                {isRunning ? 'Scraping...' : 'Starting...'}
              </>
            ) : (
              <>
                <Database className="w-5 h-5 mr-2" />
                Scrape All Cities
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
