import { Search, MapPin, Home, TrendingUp } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { SearchFilters } from '@/lib/types';

interface HeroSectionProps {
  onSearch: (filters: SearchFilters) => void;
  isLoading: boolean;
  searchResults?: { count: number; error?: string } | null;
}

export default function HeroSection({ onSearch, isLoading, searchResults }: HeroSectionProps) {
  const [city, setCity] = useState("London");
  const [maxPrice, setMaxPrice] = useState(500000);
  const [minBedrooms, setMinBedrooms] = useState(3);
  const [minSqm, setMinSqm] = useState<number | ''>('');
  const [maxSqm, setMaxSqm] = useState<number | undefined>(undefined);
  const [postcode, setPostcode] = useState<string>("");
  const [hmo_candidate, setHmoCandidate] = useState<boolean>(false);
  const [article4Filter, setArticle4Filter] = useState<"all" | "non_article4" | "article4_only">("all");
  const { toast } = useToast();
  const [lastSearchFilters, setLastSearchFilters] = useState<SearchFilters | null>(null);

  const handleSearch = () => {
    if (!city) return;

    const filters: SearchFilters = {
      city,
      maxPrice: maxPrice,
      minRooms: minBedrooms,
      minSqm: typeof minSqm === 'number' ? minSqm : undefined,
      maxSqm: maxSqm,
      postcode: postcode.trim() || undefined,
      hmo_candidate: hmo_candidate,
      article4_filter: article4Filter,
    };

    setLastSearchFilters(filters);
    onSearch(filters);
  };

  // Auto-filter when parameters change
  useEffect(() => {
    if (city) {
      const timer = setTimeout(() => {
        handleSearch();
      }, 300); // Debounce by 300ms
      return () => clearTimeout(timer);
    }
  }, [city, maxPrice, minBedrooms, minSqm, maxSqm, postcode, hmo_candidate, article4Filter]);

  // Show popup when search completes with no results
  useEffect(() => {
    if (searchResults && !isLoading && lastSearchFilters) {
      if (searchResults.count === 0 && !searchResults.error) {
        const hasFilters = lastSearchFilters.minRooms || lastSearchFilters.maxPrice || lastSearchFilters.keywords;

        toast({
          title: "Nema rezultata za pretragu",
          description: hasFilters 
            ? `Pronađeno je 0 nekretnina u ${lastSearchFilters.city} koje zadovoljavaju vaše kriterijume. Pokušajte da ublažite filtere.`
            : `Nema HMO nekretnina u ${lastSearchFilters.city}. Pokušajte drugi grad.`,
          variant: "destructive",
          duration: 5000,
        });
      }
      setLastSearchFilters(null); // Reset after showing toast
    }
  }, [searchResults, isLoading, lastSearchFilters, toast]);

  return (
    <section className="relative overflow-hidden py-20 min-h-[80vh] flex items-center">
      {/* Background with overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `linear-gradient(135deg, rgba(99, 102, 241, 0.9) 0%, rgba(168, 85, 247, 0.8) 50%, rgba(244, 114, 182, 0.7) 100%), url('https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1920&h=1080')`,
          backgroundAttachment: 'fixed'
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-black/30"></div>
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute w-1 h-1 bg-blue-400 rounded-full animate-float opacity-60" style={{left: '10%', top: '20%', animationDelay: '0s'}}></div>
        <div className="absolute w-1 h-1 bg-purple-400 rounded-full animate-float opacity-60" style={{left: '80%', top: '30%', animationDelay: '2s'}}></div>
        <div className="absolute w-1 h-1 bg-pink-400 rounded-full animate-float opacity-60" style={{left: '60%', top: '60%', animationDelay: '1s'}}></div>
        <div className="absolute w-2 h-2 bg-blue-300 rounded-full animate-float opacity-40" style={{left: '30%', top: '70%', animationDelay: '3s'}}></div>
      </div>

      <div className="relative container mx-auto px-4 z-10">
        <div className="text-center mb-12 animate-fade-in">
          <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full text-white text-sm font-medium border border-white/30 shadow-lg hover:bg-white/30 transition-all duration-300">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            Live HMO Property Finder
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight tracking-tight">
            Find Your Next
            <span className="block text-transparent bg-gradient-to-r from-cyan-300 to-blue-300 bg-clip-text animate-gradient">
              HMO Investment
            </span>
          </h1>
          <p className="text-white/90 text-lg md:text-xl max-w-3xl mx-auto leading-relaxed">
            Search Rightmove, Zoopla & PrimeLocation for profitable HMO opportunities
            <span className="block mt-2 text-white/70 text-base">
              Real-time property data • Investment analysis • ROI calculations
            </span>
          </p>
        </div>

        <div className="max-w-5xl mx-auto animate-slide-up">
          <div className="bg-white/95 backdrop-blur-sm rounded-3xl p-4 md:p-8 shadow-2xl border border-white/20 hover:shadow-3xl transition-all duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6 mb-6 md:mb-8">
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  Location
                </label>
                <select 
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full h-12 text-base border-2 border-gray-200 hover:border-blue-400 focus:border-blue-500 transition-colors rounded-xl px-4 bg-white"
                >
                  <option value="">Select a city</option>
                  <option value="London">London</option>
                  <option value="Birmingham">Birmingham</option>
                  <option value="Manchester">Manchester</option>
                  <option value="Liverpool">Liverpool</option>
                  <option value="Leeds">Leeds</option>
                  <option value="Sheffield">Sheffield</option>
                  <option value="Bristol">Bristol</option>
                  <option value="Glasgow">Glasgow</option>
                  <option value="Leicester">Leicester</option>
                  <option value="Edinburgh">Edinburgh</option>
                  <option value="Newcastle">Newcastle</option>
                  <option value="Nottingham">Nottingham</option>
                  <option value="Cardiff">Cardiff</option>
                  <option value="Coventry">Coventry</option>
                  <option value="Bradford">Bradford</option>
                  <option value="Stoke-on-Trent">Stoke-on-Trent</option>
                  <option value="Wolverhampton">Wolverhampton</option>
                  <option value="Plymouth">Plymouth</option>
                  <option value="Southampton">Southampton</option>
                  <option value="Reading">Reading</option>
                  <option value="Derby">Derby</option>
                  <option value="Dudley">Dudley</option>
                  <option value="Northampton">Northampton</option>
                  <option value="Portsmouth">Portsmouth</option>
                  <option value="Preston">Preston</option>
                  <option value="Sheffield">Sheffield</option>
                  <option value="Newcastle">Newcastle</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  Max Price (£)
                </label>
                <select 
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(parseInt(e.target.value))}
                  className="w-full h-12 text-base border-2 border-gray-200 hover:border-green-400 focus:border-green-500 transition-colors rounded-xl px-4 bg-white"
                >
                  <option value={250000}>£250k</option>
                  <option value={300000}>£300k</option>
                  <option value={400000}>£400k</option>
                  <option value={500000}>£500k</option>
                  <option value={600000}>£600k</option>
                  <option value={700000}>£700k</option>
                  <option value={800000}>£800k</option>
                  <option value={900000}>£900k</option>
                  <option value={1000000}>£1m</option>
                  <option value={1200000}>£1.2m</option>
                  <option value={1500000}>£1.5m</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  Min Bedrooms
                </label>
                <select 
                  value={minBedrooms}
                  onChange={(e) => setMinBedrooms(parseInt(e.target.value))}
                  className="w-full h-12 text-base border-2 border-gray-200 hover:border-purple-400 focus:border-purple-500 transition-colors rounded-xl px-4 bg-white"
                >
                  <option value={1}>1 bedroom</option>
                  <option value={2}>2 bedrooms</option>
                  <option value={3}>3 bedrooms</option>
                  <option value={4}>4 bedrooms</option>
                  <option value={5}>5+ bedrooms</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  Min Sqm (HMO)
                </label>
                <input 
                  type="number"
                  value={minSqm}
                  onChange={(e) => setMinSqm(e.target.value ? parseInt(e.target.value) : '')}
                  placeholder="90+ for HMO (optional)"
                  className="w-full h-12 text-base border-2 border-gray-200 hover:border-orange-400 focus:border-orange-500 transition-colors rounded-xl px-4 bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  Postcode
                </label>
                <input 
                  type="text"
                  value={postcode}
                  onChange={(e) => setPostcode(e.target.value)}
                  placeholder="e.g. SW1A 1AA"
                  className="w-full h-12 text-base border-2 border-gray-200 hover:border-red-400 focus:border-red-500 transition-colors rounded-xl px-4 bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={hmo_candidate}
                    onChange={(e) => setHmoCandidate(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  Show only HMO candidates (90+ sqm, non-Article 4)
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Article 4 Filter</label>
                <select
                  value={article4Filter}
                  onChange={(e) => setArticle4Filter(e.target.value as "all" | "non_article4" | "article4_only")}
                  className="w-full h-10 text-sm border-2 border-gray-200 hover:border-blue-400 focus:border-blue-500 transition-colors rounded-xl px-3 bg-white"
                >
                  <option value="all">All areas</option>
                  <option value="non_article4">Non-Article 4 only</option>
                  <option value="article4_only">Article 4 areas only</option>
                </select>
              </div>
            </div>

            <div className="flex justify-center">
              <button 
                onClick={handleSearch}
                disabled={!city || isLoading}
                className="w-full sm:w-auto h-14 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:from-gray-400 disabled:to-gray-500 text-white text-base sm:text-lg font-semibold shadow-xl hover:shadow-2xl transform hover:scale-105 disabled:transform-none disabled:scale-100 transition-all duration-300 rounded-xl flex items-center justify-center gap-3 px-8 sm:px-12"
                data-testid="button-search"
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    Find HMO Properties
                  </>
                )}
              </button>
            </div>

            <div className="mt-6 text-center space-y-2">
              <div className="flex justify-center items-center gap-6 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  Article 4 Filtered
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  HMO Suitable Only
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Last updated: <span>{new Date().toLocaleTimeString()}</span> • UK property data compliance
              </p>
              <p className="text-xs text-amber-600 font-medium">
                ⚖️ All property URLs comply with UK data protection laws
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}