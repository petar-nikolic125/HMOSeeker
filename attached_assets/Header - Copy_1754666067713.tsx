import { Home, MapPin, HelpCircle, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useState } from 'react';
import { useCities } from '@/hooks/useProperties';

interface HeaderProps {
  selectedCity: string;
  onCityChange: (city: string) => void;
  onShowTutorial: () => void;
}

export const Header = ({ selectedCity, onCityChange, onShowTutorial }: HeaderProps) => {
  const { data: cities = [] } = useCities();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-hero-gradient">
              <Home className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800 dark:text-white">
                HMO HUNTER
              </h1>
              <p className="text-sm text-muted-foreground hidden sm:block">
                Updated weekly • UK property data compliance
              </p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onShowTutorial}
              className="flex items-center gap-2"
              aria-label="Open tutorial"
            >
              <HelpCircle className="w-4 h-4" />
              <span>Tutorial</span>
            </Button>
            
            <div className="flex items-center space-x-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <Select value={selectedCity} onValueChange={onCityChange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select city..." />
                </SelectTrigger>
                <SelectContent>
                  {cities.map((city) => (
                    <SelectItem key={city} value={city}>
                      {city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Mobile Hamburger Menu */}
          <div className="md:hidden">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-2"
                  aria-label="Open menu"
                >
                  <Menu className="w-6 h-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] sm:w-[300px]">
                <div className="flex flex-col space-y-6 mt-6">
                  {/* City Selection */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Select City
                    </label>
                    <Select value={selectedCity} onValueChange={(city) => {
                      onCityChange(city);
                      setIsMobileMenuOpen(false);
                    }}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select city..." />
                      </SelectTrigger>
                      <SelectContent>
                        {cities.map((city) => (
                          <SelectItem key={city} value={city}>
                            {city}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Tutorial Button */}
                  <Button
                    variant="outline"
                    onClick={() => {
                      onShowTutorial();
                      setIsMobileMenuOpen(false);
                    }}
                    className="flex items-center gap-2 justify-start"
                  >
                    <HelpCircle className="w-4 h-4" />
                    <span>Tutorial</span>
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
};