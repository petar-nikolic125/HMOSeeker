import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';

export const Footer = () => {
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);

  return (
    <footer className="mt-20 bg-gradient-to-t from-zinc-50 to-transparent dark:from-zinc-900/50 dark:to-transparent border-t border-border/30">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Company Info */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              HMO Hunter
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Professional property investment analysis platform for the UK market. 
              Find, analyze, and invest in HMO properties with confidence.
            </p>
            <div className="flex space-x-4">
              <a 
                href="https://pnikolic-dev.vercel.app/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
                data-testid="link-petar-portfolio"
                title="Petar Nikolić - Portfolio"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
              </a>
              <a 
                href="https://vasilijestankovic.tech" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
                data-testid="link-vasilije-portfolio"
                title="Vasilije Stankovic - Portfolio"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
              </a>
              <a 
                href="mailto:contact@hmohunter.co.uk" 
                className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
                data-testid="link-email"
                title="Contact HMO Hunter"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Legal Links */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Legal</h4>
            <nav className="flex flex-col space-y-2">
              <Dialog open={isTermsOpen} onOpenChange={setIsTermsOpen}>
                <DialogTrigger asChild>
                  <button 
                    className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 text-left transition-colors"
                    data-testid="button-terms"
                  >
                    Terms of Service
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Terms of Service</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 text-sm">
                    <p><strong>Last updated:</strong> August 2025</p>
                    <h3 className="font-semibold">1. Acceptance of Terms</h3>
                    <p>By accessing and using HMO Hunter, you accept and agree to be bound by the terms and provision of this agreement.</p>
                    <h3 className="font-semibold">2. Use License</h3>
                    <p>Permission is granted to temporarily use HMO Hunter for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title.</p>
                    <h3 className="font-semibold">3. Disclaimer</h3>
                    <p>The information on HMO Hunter is provided on an 'as is' basis. To the fullest extent permitted by law, this Company excludes all representations, warranties, conditions and terms.</p>
                    <h3 className="font-semibold">4. Investment Disclaimer</h3>
                    <p>Property investment involves risk. All financial calculations and investment analysis provided are for informational purposes only and should not be considered as financial advice. Always consult with qualified professionals before making investment decisions.</p>
                    <h3 className="font-semibold">5. Limitations</h3>
                    <p>In no event shall HMO Hunter or its suppliers be liable for any damages arising out of the use or inability to use the materials on this website.</p>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={isPrivacyOpen} onOpenChange={setIsPrivacyOpen}>
                <DialogTrigger asChild>
                  <button 
                    className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 text-left transition-colors"
                    data-testid="button-privacy"
                  >
                    Privacy Policy
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Privacy Policy</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 text-sm">
                    <p><strong>Last updated:</strong> August 2025</p>
                    <h3 className="font-semibold">Information We Collect</h3>
                    <p>We collect information you provide directly to us, such as when you use our search features or contact us for support.</p>
                    <h3 className="font-semibold">How We Use Your Information</h3>
                    <p>We use the information we collect to provide, maintain, and improve our services, process transactions, and communicate with you.</p>
                    <h3 className="font-semibold">Information Sharing</h3>
                    <p>We do not sell, trade, or otherwise transfer your personal information to third parties without your consent, except as described in this policy.</p>
                    <h3 className="font-semibold">Data Security</h3>
                    <p>We implement appropriate security measures to protect against unauthorized access, alteration, disclosure, or destruction of your personal information.</p>
                    <h3 className="font-semibold">Contact Us</h3>
                    <p>If you have any questions about this Privacy Policy, please contact us at contact@hmohunter.co.uk</p>
                  </div>
                </DialogContent>
              </Dialog>

              <div className="space-y-1">
                <a 
                  href="https://pnikolic-dev.vercel.app/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                  data-testid="link-contact-petar"
                >
                  Contact Petar Nikolić
                </a>
                <a 
                  href="https://vasilijestankovic.tech" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                  data-testid="link-contact-vasilije"
                >
                  Contact Vasilije Stankovic
                </a>
                <a 
                  href="mailto:contact@hmohunter.co.uk" 
                  className="block text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                  data-testid="link-general-contact"
                >
                  General Inquiries
                </a>
              </div>
            </nav>
          </div>

          {/* Technical Info */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Technical</h4>
            <div className="space-y-2 text-xs text-zinc-500 dark:text-zinc-400">
              <p>Real-time property data</p>
              <p>Advanced investment analytics</p>
              <p>UK-wide coverage</p>
              <p className="pt-2 border-t border-border/30">
                <span className="text-zinc-400 dark:text-zinc-500">API Status:</span>{' '}
                <span className="text-green-600 dark:text-green-400">● Operational</span>
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="mt-12 pt-8 border-t border-border/30">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="text-center md:text-left">
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Built by{' '}
                <span className="text-zinc-900 dark:text-zinc-100">Petar Nikolić</span> &{' '}
                <span className="text-zinc-900 dark:text-zinc-100">Vasilije Stankovic</span>
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Commissioned for Nathan Fonteijn
              </p>
            </div>
            <div className="text-center md:text-right">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                © 2025 HMO Hunter. All rights reserved.
              </p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                Made with precision in the UK
              </p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                Version: 1.3
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};