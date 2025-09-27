import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Map, List, Bookmark, User, Home, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useLocation } from 'wouter';
import type { SearchFilters } from '@/lib/types';

interface StickyHeaderProps {
  onSearch?: (filters: SearchFilters) => void;
  currentFilters?: SearchFilters;
  isLoading?: boolean;
  searchResultsCount?: number;
  onViewModeChange?: (mode: 'map' | 'list') => void;
  currentViewMode?: 'map' | 'list';
}

export default function StickyHeader({
  onSearch,
  currentFilters,
  isLoading = false,
  searchResultsCount = 0,
  onViewModeChange,
  currentViewMode = 'list'
}: StickyHeaderProps) {
  const [, setLocation] = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [searchQuery, setSearchQuery] = useState(currentFilters?.city || '');
  const [isFocused, setIsFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);

  // UK cities for location suggestions
  const ukCities = [
    'London', 'Birmingham', 'Manchester', 'Liverpool', 'Leeds', 'Sheffield', 
    'Bristol', 'Glasgow', 'Leicester', 'Edinburgh', 'Newcastle', 'Nottingham', 
    'Cardiff', 'Coventry', 'Bradford', 'Stoke-on-Trent', 'Wolverhampton', 
    'Plymouth', 'Southampton', 'Reading', 'Derby', 'Portsmouth', 'Preston',
    'Brighton', 'Cambridge', 'Oxford', 'Hull', 'Salford', 'Bolton', 'Rochdale'
  ];

  // Handle scroll for sticky effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Sync search query with current filters
  useEffect(() => {
    if (currentFilters?.city !== searchQuery) {
      setSearchQuery(currentFilters?.city || '');
    }
  }, [currentFilters?.city]);

  // Update URL query parameters
  const updateUrlParams = useCallback((filters: SearchFilters) => {
    const params = new URLSearchParams(window.location.search);
    
    if (filters.city) params.set('q', filters.city);
    else params.delete('q');
    
    if (filters.minRooms) params.set('minRooms', filters.minRooms.toString());
    else params.delete('minRooms');
    
    if (filters.maxPrice) params.set('maxPrice', filters.maxPrice.toString());
    else params.delete('maxPrice');
    
    // Update URL without triggering navigation
    const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
    window.history.replaceState({}, '', newUrl);
  }, []);

  // Debounced search function
  const debouncedSearch = useCallback((query: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      if (query.trim() && onSearch) {
        const filters: SearchFilters = {
          ...currentFilters,
          city: query.trim()
        };
        onSearch(filters);
        updateUrlParams(filters);
      }
    }, 300);
  }, [onSearch, currentFilters, updateUrlParams]);

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    
    // Filter suggestions based on input
    if (value.length > 0) {
      const filtered = ukCities.filter(city =>
        city.toLowerCase().includes(value.toLowerCase())
      ).slice(0, 5);
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
    
    // Trigger debounced search
    debouncedSearch(value);
  };

  // Handle search input submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim() && onSearch) {
      const filters: SearchFilters = {
        ...currentFilters,
        city: searchQuery.trim()
      };
      onSearch(filters);
      updateUrlParams(filters);
      setSuggestions([]);
      setIsFocused(false);
      searchInputRef.current?.blur();
    }
  };

  // Handle suggestion selection
  const selectSuggestion = (city: string) => {
    setSearchQuery(city);
    setSuggestions([]);
    setIsFocused(false);
    setActiveSuggestionIndex(-1);
    
    if (onSearch) {
      const filters: SearchFilters = {
        ...currentFilters,
        city
      };
      onSearch(filters);
      updateUrlParams(filters);
    }
  };

  // Keyboard navigation for suggestions
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveSuggestionIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveSuggestionIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (activeSuggestionIndex >= 0) {
          selectSuggestion(suggestions[activeSuggestionIndex]);
        } else {
          handleSearchSubmit(e);
        }
        break;
      case 'Escape':
        setSuggestions([]);
        setIsFocused(false);
        setActiveSuggestionIndex(-1);
        searchInputRef.current?.blur();
        break;
    }
  };

  // Focus suggestion with keyboard navigation
  useEffect(() => {
    if (activeSuggestionIndex >= 0 && suggestionRefs.current[activeSuggestionIndex]) {
      suggestionRefs.current[activeSuggestionIndex]?.focus();
    }
  }, [activeSuggestionIndex]);

  // Handle view mode toggle
  const handleViewModeToggle = () => {
    const newMode = currentViewMode === 'map' ? 'list' : 'map';
    onViewModeChange?.(newMode);
  };

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        isScrolled
          ? "bg-white/95 backdrop-blur-md shadow-lg border-b border-border"
          : "bg-white/90 backdrop-blur-sm"
      )}
      role="banner"
    >
      {/* Skip link for accessibility */}
      <a
        href="#main-content"
        className="skip-link sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[60] bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium"
      >
        Skip to main content
      </a>

      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Branding */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl flex items-center justify-center shadow-sm">
              <Home className="w-5 h-5 text-white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold text-foreground">
                HMO Finder
              </h1>
              <p className="text-xs text-muted-foreground">
                UK Property Investment
              </p>
            </div>
          </div>

          {/* Search Section */}
          <div className="flex-1 max-w-md mx-6 relative" role="search">
            <form onSubmit={handleSearchSubmit} className="relative">
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search location or postcode..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onFocus={() => setIsFocused(true)}
                  onBlur={(e) => {
                    // Delay hiding suggestions to allow clicking
                    setTimeout(() => {
                      if (!e.currentTarget.contains(document.activeElement)) {
                        setIsFocused(false);
                        setSuggestions([]);
                        setActiveSuggestionIndex(-1);
                      }
                    }, 150);
                  }}
                  onKeyDown={handleKeyDown}
                  className={cn(
                    "pl-10 pr-10 h-10 bg-input border-border",
                    "focus:ring-2 focus:ring-ring focus:border-transparent",
                    "transition-all duration-200"
                  )}
                  aria-label="Search location or postcode"
                  aria-describedby={searchResultsCount > 0 ? "search-results-count" : undefined}
                  aria-expanded={suggestions.length > 0}
                  aria-autocomplete="list"
                  autoComplete="off"
                  data-testid="input-location-search"
                />
                <Button
                  type="submit"
                  size="sm"
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                  disabled={isLoading || !searchQuery.trim()}
                  aria-label="Search"
                  data-testid="button-search-submit"
                >
                  <Search className="w-4 h-4" />
                </Button>
              </div>

              {/* Search Suggestions Dropdown */}
              {isFocused && suggestions.length > 0 && (
                <div
                  className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-y-auto z-50"
                  role="listbox"
                  aria-label="Location suggestions"
                >
                  {suggestions.map((city, index) => (
                    <button
                      key={city}
                      ref={(el) => {
                        suggestionRefs.current[index] = el;
                      }}
                      onClick={() => selectSuggestion(city)}
                      className={cn(
                        "w-full text-left px-4 py-3 hover:bg-accent focus:bg-accent transition-colors",
                        "flex items-center gap-2 text-sm",
                        activeSuggestionIndex === index && "bg-accent"
                      )}
                      role="option"
                      aria-selected={activeSuggestionIndex === index}
                      data-testid={`suggestion-${city.toLowerCase()}`}
                    >
                      <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="truncate">{city}</span>
                    </button>
                  ))}
                </div>
              )}
            </form>

            {/* Search Results Count */}
            {searchResultsCount > 0 && (
              <div
                id="search-results-count"
                className="absolute -bottom-5 left-0 text-xs text-muted-foreground"
                aria-live="polite"
              >
                {searchResultsCount} properties found
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Map/List Toggle */}
            <div
              className="hidden sm:flex bg-muted rounded-lg p-1"
              role="radiogroup"
              aria-label="View mode"
            >
              <Button
                variant={currentViewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onViewModeChange?.('list')}
                className="h-8 px-3"
                aria-pressed={currentViewMode === 'list'}
                role="radio"
                data-testid="button-view-list"
              >
                <List className="w-4 h-4 mr-1" />
                List
              </Button>
              <Button
                variant={currentViewMode === 'map' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onViewModeChange?.('map')}
                className="h-8 px-3"
                aria-pressed={currentViewMode === 'map'}
                role="radio"
                data-testid="button-view-map"
              >
                <Map className="w-4 h-4 mr-1" />
                Map
              </Button>
            </div>

            {/* Mobile View Toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleViewModeToggle}
              className="sm:hidden h-10 w-10 p-0"
              aria-label={`Switch to ${currentViewMode === 'map' ? 'list' : 'map'} view`}
              data-testid="button-view-toggle-mobile"
            >
              {currentViewMode === 'map' ? (
                <List className="w-4 h-4" />
              ) : (
                <Map className="w-4 h-4" />
              )}
            </Button>

            {/* Saved Button */}
            <Button
              variant="outline"
              size="sm"
              className="hidden md:flex h-10 px-4"
              data-testid="button-saved"
            >
              <Bookmark className="w-4 h-4 mr-2" />
              Saved
            </Button>

            {/* Login Button */}
            <Button
              variant="outline"
              size="sm"
              className="h-10 px-4"
              data-testid="button-login"
            >
              <User className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">Login</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}