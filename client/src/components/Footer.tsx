import { Home, Mail, Phone, MapPin, Github, Twitter, Linkedin, Calculator } from 'lucide-react';

export const Footer = () => {
  return (
    <footer className="bg-gray-900 text-white">
      {/* Main Footer */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          
          {/* Company Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                <Home className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold">HMO Hunter</h3>
                <p className="text-sm text-gray-400">Property Investment Analysis</p>
              </div>
            </div>
            <p className="text-gray-400 leading-relaxed">
              Advanced AI-powered property analysis platform for HMO investment opportunities across the UK. 
              Make informed decisions with real-time data and comprehensive ROI calculations.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-blue-600 transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-blue-600 transition-colors">
                <Linkedin className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-gray-700 transition-colors">
                <Github className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold">Platform</h4>
            <ul className="space-y-2">
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Property Search</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Investment Analysis</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Portfolio Tracker</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Market Insights</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">HMO Calculator</a></li>
            </ul>
          </div>

          {/* Resources */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold">Resources</h4>
            <ul className="space-y-2">
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Investment Guide</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Market Reports</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">HMO Regulations</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Tax Optimization</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">API Documentation</a></li>
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold">Contact</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-gray-400">
                <Mail className="w-5 h-5" />
                <span>hello@hmohunter.co.uk</span>
              </div>
              <div className="flex items-center gap-3 text-gray-400">
                <Phone className="w-5 h-5" />
                <span>+44 20 7123 4567</span>
              </div>
              <div className="flex items-center gap-3 text-gray-400">
                <MapPin className="w-5 h-5" />
                <span>London, United Kingdom</span>
              </div>
            </div>
            
            {/* Newsletter Signup */}
            <div className="mt-6 p-4 bg-gray-800 rounded-lg">
              <h5 className="font-medium mb-2">Weekly Market Updates</h5>
              <p className="text-sm text-gray-400 mb-3">Get the latest HMO investment opportunities delivered to your inbox.</p>
              <div className="flex gap-2">
                <input 
                  type="email" 
                  placeholder="Enter email"
                  className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-sm font-medium rounded-lg hover:from-blue-700 hover:to-purple-700 transition-colors">
                  Subscribe
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Bottom */}
      <div className="border-t border-gray-800">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-6 text-sm text-gray-400">
              <span>© 2024 HMO Hunter. All rights reserved.</span>
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-white transition-colors">Cookie Policy</a>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Calculator className="w-4 h-4" />
              <span>Powered by Advanced Property Analytics</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};