import { Home, MapPin } from "lucide-react";

interface NavigationHeaderProps {
  onLocationChange?: (location: string) => void;
  currentLocation?: string;
}

export default function NavigationHeader({ onLocationChange, currentLocation }: NavigationHeaderProps) {
  return (
    <header className="relative bg-white/95 backdrop-blur-sm border-b border-gray-200/60 sticky top-0 z-40">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
              <Home className="text-white text-lg" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">HMO Finder</h1>
              <p className="text-xs text-gray-600">UK Property Investment</p>
            </div>
          </div>
          
          <nav className="hidden md:flex items-center gap-6">
            <a href="#" className="text-gray-700 hover:text-blue-600 transition-colors font-medium" data-testid="link-properties">Properties</a>
            <a href="#" className="text-gray-700 hover:text-blue-600 transition-colors font-medium" data-testid="link-analysis">Analysis</a>
            <a href="#" className="text-gray-700 hover:text-blue-600 transition-colors font-medium" data-testid="link-about">About</a>
            
            <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
              <MapPin className="w-4 h-4 text-gray-500" />
              <select 
                value={currentLocation || ""}
                onChange={(e) => onLocationChange?.(e.target.value)}
                className="bg-transparent border-none outline-none text-sm text-gray-700 min-w-[100px]"
                data-testid="select-location-nav"
              >
                <option value="">Select city</option>
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
              </select>
            </div>
          </nav>
          
          <button className="md:hidden text-gray-700" data-testid="button-menu-mobile">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
