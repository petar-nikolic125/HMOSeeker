import { Database, Globe, ServerCog, Monitor } from "lucide-react";

export default function SystemArchitecture() {
  return (
    <section className="py-16 bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            System Architecture
          </h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Intelligent caching system for efficient property data management
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {/* Web Scraper */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-4">
              <Globe className="text-white text-xl" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Python Web Scraper</h3>
            <ul className="text-gray-600 text-sm space-y-2">
              <li>• Rightmove data extraction</li>
              <li>• Zoopla property scraping</li>
              <li>• PrimeLocation integration</li>
              <li>• HMO filtering logic</li>
              <li>• Rate limiting & compliance</li>
            </ul>
          </div>

          {/* Cache System */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mb-4">
              <Database className="text-white text-xl" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Caching System</h3>
            <ul className="text-gray-600 text-sm space-y-2">
              <li>• JSON file storage</li>
              <li>• SQLite fallback database</li>
              <li>• Automatic cache refresh</li>
              <li>• Data expiration handling</li>
              <li>• Background sync jobs</li>
            </ul>
          </div>

          {/* React Frontend */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
            <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-green-600 rounded-xl flex items-center justify-center mb-4">
              <Monitor className="text-white text-xl" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">React Frontend</h3>
            <ul className="text-gray-600 text-sm space-y-2">
              <li>• TypeScript components</li>
              <li>• Real-time data display</li>
              <li>• Investment calculators</li>
              <li>• Responsive design</li>
              <li>• Error handling & fallbacks</li>
            </ul>
          </div>
        </div>

        {/* Data Flow Diagram */}
        <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200">
          <h3 className="text-xl font-bold text-gray-900 mb-6 text-center">Data Flow Process</h3>
          <div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0 md:space-x-8">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center">
                <Globe className="text-blue-600 text-2xl" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Property Portals</h4>
                <p className="text-sm text-gray-600">Rightmove, Zoopla, PrimeLocation</p>
              </div>
            </div>
            
            <svg className="w-6 h-6 text-gray-400 hidden md:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-purple-100 rounded-xl flex items-center justify-center">
                <ServerCog className="text-purple-600 text-2xl" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Scraper + Cache</h4>
                <p className="text-sm text-gray-600">Data processing & storage</p>
              </div>
            </div>
            
            <svg className="w-6 h-6 text-gray-400 hidden md:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-green-100 rounded-xl flex items-center justify-center">
                <Monitor className="text-green-600 text-2xl" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Frontend Display</h4>
                <p className="text-sm text-gray-600">User interface & analysis</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
