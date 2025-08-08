import { Home } from "lucide-react";

export default function NavigationHeader() {
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
            <a href="#" className="text-gray-700 hover:text-blue-600 transition-colors font-medium">Properties</a>
            <a href="#" className="text-gray-700 hover:text-blue-600 transition-colors font-medium">Analysis</a>
            <a href="#" className="text-gray-700 hover:text-blue-600 transition-colors font-medium">About</a>
            <button className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-xl font-medium hover:shadow-lg transition-all">
              Sign In
            </button>
          </nav>
          <button className="md:hidden text-gray-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
