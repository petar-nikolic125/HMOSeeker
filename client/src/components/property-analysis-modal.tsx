import { useState, useEffect } from "react";
import { X, Calculator, TrendingUp, Percent, Coins, CheckCircle, PoundSterling } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { PropertyListing } from "@shared/schema";
import "./slider-styles.css";
// Analysis type will be inferred from API response

interface PropertyAnalysisModalProps {
  property: any; // Using any to handle the scraper's data format
  onClose: () => void;
}

export default function PropertyAnalysisModal({ property, onClose }: PropertyAnalysisModalProps) {
  const [renovationCostPerRoom, setRenovationCostPerRoom] = useState(17000);
  // Set initial rent based on property city
  const getInitialRent = (city: string) => {
    const cityLower = city.toLowerCase();
    if (cityLower.includes('london')) return 1000;
    if (cityLower.includes('birmingham')) return 580;
    if (cityLower.includes('manchester')) return 550;
    if (cityLower.includes('liverpool')) return 520;
    if (cityLower.includes('leeds')) return 520;
    if (cityLower.includes('bristol')) return 650;
    return 580; // Default fallback
  };

  const [rentPerBedroom, setRentPerBedroom] = useState(getInitialRent(property.city || ''));
  const [analysis, setAnalysis] = useState<any>(null);

  const analysisMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("GET", `/api/properties/${property.id}/analysis?renovation_cost=${renovationCostPerRoom}&rent_per_bedroom=${rentPerBedroom}`);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setAnalysis(data.analysis);
      }
    },
  });

  useEffect(() => {
    analysisMutation.mutate();
  }, [property.id, renovationCostPerRoom, rentPerBedroom]);

  // Real-time parameter updates
  const handleRenovationCostChange = (newCost: number) => {
    setRenovationCostPerRoom(newCost);
    // Trigger immediate re-fetch for real-time updates
    analysisMutation.mutate();
  };

  const handleRentChange = (newRent: number) => {
    setRentPerBedroom(newRent);
    // Trigger immediate re-fetch for real-time updates
    analysisMutation.mutate();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const getPaybackPeriodText = (years: number) => {
    if (years < 1) return "< 1 year";
    if (years < 2) return "1-2 years";
    if (years < 3) return "2-3 years";
    return "3+ years";
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={handleBackdropClick}>
      <div className="fixed inset-4 md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[90vw] md:max-w-4xl md:h-[85vh] bg-white rounded-2xl shadow-2xl z-50 overflow-hidden">
        <div className="h-full flex flex-col">
          {/* Compact Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calculator className="w-6 h-6" />
                <div>
                  <h2 className="text-lg font-bold">Investment Analysis</h2>
                  <p className="text-blue-100 text-sm truncate max-w-md">{property.address}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-white hover:bg-white/20 rounded-full p-1.5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-4">
            {analysisMutation.isPending ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : analysis ? (
              <div className="space-y-4">
                {/* Compact Control Sliders */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Renovation Slider */}
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <PoundSterling className="w-4 h-4 text-orange-500" />
                      <h3 className="text-sm font-semibold">Renovation Cost per Room</h3>
                    </div>
                    <div className="space-y-3">
                      <input 
                        type="range" 
                        min="10000" 
                        max="30000" 
                        value={renovationCostPerRoom}
                        step="1000"
                        onChange={(e) => handleRenovationCostChange(parseInt(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                        style={{
                          background: `linear-gradient(to right, #f97316 0%, #f97316 ${((renovationCostPerRoom - 10000) / (30000 - 10000)) * 100}%, #e5e7eb ${((renovationCostPerRoom - 10000) / (30000 - 10000)) * 100}%, #e5e7eb 100%)`
                        }}
                      />
                      <div className="text-center">
                        <span className="inline-block bg-gray-100 border border-gray-300 rounded px-3 py-1 text-sm font-semibold">
                          £{renovationCostPerRoom.toLocaleString()}/room
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Rent Price Slider */}
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="w-4 h-4 text-green-500" />
                      <h3 className="text-sm font-semibold">Monthly Rent per Bedroom</h3>
                    </div>
                    <div className="space-y-3">
                      <input 
                        type="range" 
                        min="400" 
                        max="1200" 
                        value={rentPerBedroom}
                        step="50"
                        onChange={(e) => handleRentChange(parseInt(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                        style={{
                          background: `linear-gradient(to right, #10b981 0%, #10b981 ${((rentPerBedroom - 400) / (1200 - 400)) * 100}%, #e5e7eb ${((rentPerBedroom - 400) / (1200 - 400)) * 100}%, #e5e7eb 100%)`
                        }}
                      />
                      <div className="text-center">
                        <span className="inline-block bg-gray-100 border border-gray-300 rounded px-3 py-1 text-sm font-semibold">
                          £{rentPerBedroom.toLocaleString()}/bed
                        </span>
                      </div>
                      <div className="text-center text-xs text-gray-600">
                        Total: £{(rentPerBedroom * (property.bedrooms || 4)).toLocaleString()}/month
                      </div>
                    </div>
                  </div>
                </div>

                {/* Key Metrics - Top Priority */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-3 rounded-xl border border-blue-200 text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Percent className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-semibold text-blue-900">ROI</span>
                    </div>
                    <div className="text-xl font-bold text-blue-800">{analysis.cash_on_cash_pct?.toFixed(1) || 'N/A'}%</div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-green-50 to-green-100 p-3 rounded-xl border border-green-200 text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <TrendingUp className="w-4 h-4 text-green-600" />
                      <span className="text-xs font-semibold text-green-900">Yield</span>
                    </div>
                    <div className="text-xl font-bold text-green-800">{analysis.gross_yield_pct?.toFixed(1) || 'N/A'}%</div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-3 rounded-xl border border-purple-200 text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Coins className="w-4 h-4 text-purple-600" />
                      <span className="text-xs font-semibold text-purple-900">Monthly</span>
                    </div>
                    <div className="text-xl font-bold text-purple-800">£{Math.round((analysis.after_tax_cash_flow || 0) / 12).toLocaleString()}</div>
                  </div>
                </div>

                {/* Compact Financial Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Costs */}
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <PoundSterling className="w-4 h-4 text-red-500" />
                      <h3 className="text-sm font-semibold">Investment Costs</h3>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span>Property Price:</span>
                        <span className="font-semibold">£{property.price.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Renovation:</span>
                        <span className="font-semibold">£{analysis.total_renovation_cost?.toLocaleString() || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Transaction Costs:</span>
                        <span className="font-semibold">£{analysis.transaction_costs?.toLocaleString() || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Down Payment (25%):</span>
                        <span className="font-semibold">£{analysis.downpayment?.toLocaleString() || 'N/A'}</span>
                      </div>
                      <div className="border-t pt-2 flex justify-between font-bold">
                        <span>Cash Required:</span>
                        <span>£{analysis.cash_invested?.toLocaleString() || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Returns */}
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="w-4 h-4 text-green-500" />
                      <h3 className="text-sm font-semibold">Income & Returns</h3>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span>Monthly Rent:</span>
                        <span className="font-semibold">£{analysis.estimated_monthly_rent?.toLocaleString() || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Annual Income:</span>
                        <span className="font-semibold">£{analysis.annual_gross_rent?.toLocaleString() || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Operating Costs:</span>
                        <span className="font-semibold">£{analysis.annual_operating_expenses?.toLocaleString() || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Net Operating Income:</span>
                        <span className="font-semibold">£{analysis.NOI?.toLocaleString() || 'N/A'}</span>
                      </div>
                      <div className="border-t pt-2 flex justify-between font-bold">
                        <span>Annual Cash Flow:</span>
                        <span className="text-green-600">£{analysis.after_tax_cash_flow?.toLocaleString() || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Compact Analysis Summary */}
                <div className="bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle className="text-white w-3 h-3" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-emerald-900 text-sm mb-1">Investment Summary</h4>
                      <p className="text-emerald-800 text-xs leading-relaxed">
                        This property shows strong HMO potential with good ROI and yield figures. 
                        Consider viewing as a priority investment opportunity.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-600">Failed to load analysis data</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
