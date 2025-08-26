import { useState, useEffect } from 'react';
import { Menu, X, Calculator, Home, Search, TrendingUp, User } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`fixed top-0 w-full z-50 transition-all duration-300 ${
      isScrolled 
        ? 'bg-white/95 backdrop-blur-md shadow-lg border-b border-gray-200/60' 
        : 'bg-transparent'
    }`}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl flex items-center justify-center">
              <Home className="w-6 h-6 text-white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                HMO Hunter
              </h1>
              <p className="text-xs text-gray-600">Property Investment Analysis</p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <a href="#search" className="flex items-center gap-2 text-gray-700 hover:text-blue-600 transition-colors font-medium">
              <Search className="w-4 h-4" />
              Search
            </a>
            <a href="#analysis" className="flex items-center gap-2 text-gray-700 hover:text-blue-600 transition-colors font-medium">
              <Calculator className="w-4 h-4" />
              Analysis
            </a>
            <a href="#portfolio" className="flex items-center gap-2 text-gray-700 hover:text-blue-600 transition-colors font-medium">
              <TrendingUp className="w-4 h-4" />
              Portfolio
            </a>
          </nav>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center space-x-4">
            <Button variant="ghost" size="sm" className="text-gray-700 hover:text-blue-600">
              <User className="w-4 h-4 mr-2" />
              Login
            </Button>
            <Button size="sm" className="bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900">
              Get Started
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden absolute top-16 left-0 right-0 bg-white shadow-lg border-t">
            <nav className="flex flex-col p-4 space-y-4">
              <a href="#search" className="flex items-center gap-3 text-gray-700 hover:text-blue-600 transition-colors font-medium py-2">
                <Search className="w-5 h-5" />
                Search Properties
              </a>
              <a href="#analysis" className="flex items-center gap-3 text-gray-700 hover:text-blue-600 transition-colors font-medium py-2">
                <Calculator className="w-5 h-5" />
                Investment Analysis
              </a>
              <a href="#portfolio" className="flex items-center gap-3 text-gray-700 hover:text-blue-600 transition-colors font-medium py-2">
                <TrendingUp className="w-5 h-5" />
                Portfolio Tracking
              </a>
              <div className="pt-4 border-t space-y-2">
                <Button variant="outline" className="w-full">
                  <User className="w-4 h-4 mr-2" />
                  Login
                </Button>
                <Button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                  Get Started
                </Button>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};