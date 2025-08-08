import { useState, useEffect } from "react";
import { X, Calculator, TrendingUp, Percent, Coins, CheckCircle, PoundSterling } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { PropertyListing } from "@shared/schema";
import type { PropertyAnalysis } from "@/lib/types";

interface PropertyAnalysisModalProps {
  property: PropertyListing;
  onClose: () => void;
}

export default function PropertyAnalysisModal({ property, onClose }: PropertyAnalysisModalProps) {
  const [renovationCostPerRoom, setRenovationCostPerRoom] = useState(17000);
  const [analysis, setAnalysis] = useState<PropertyAnalysis | null>(null);

  const analysisMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("GET", `/api/properties/${property.id}/analysis`);
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
  }, [property.id]);

  // Update analysis when renovation cost changes
  useEffect(() => {
    if (analysis) {
      const bedrooms = property.bedrooms || 4;
      const totalRenovation = renovationCostPerRoom * bedrooms;
      const totalInvestment = property.price + totalRenovation + 30000 + 15000; // bridging + legal
      const leftInDeal = totalInvestment * 0.25; // 25% down
      const netAnnualProfit = 21600; // Fixed for simplicity
      const paybackYears = leftInDeal / netAnnualProfit;

      setAnalysis({
        ...analysis,
        renovation_cost_per_room: renovationCostPerRoom,
        total_renovation: totalRenovation,
        total_investment: totalInvestment,
        left_in_deal: leftInDeal,
        payback_period_years: paybackYears,
      });
    }
  }, [renovationCostPerRoom, analysis?.purchase_price]);

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
      <div className="fixed inset-4 md:inset-8 bg-white rounded-3xl shadow-2xl z-50 overflow-hidden">
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calculator className="text-2xl" />
                <div>
                  <h2 className="text-2xl font-bold">Property Analysis</h2>
                  <p className="text-blue-100">{property.address}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
              >
                <X className="text-xl" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-6">
            {analysisMutation.isPending ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : analysis ? (
              <div className="space-y-6">
                {/* Renovation Slider */}
                <div className="bg-white border border-gray-200 rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <PoundSterling className="text-orange-500" />
                    <h3 className="text-lg font-semibold">Renovation Cost per Room</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="px-4">
                      <input 
                        type="range" 
                        min="10000" 
                        max="30000" 
                        value={renovationCostPerRoom}
                        step="1000"
                        onChange={(e) => setRenovationCostPerRoom(parseInt(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                    <div className="text-center">
                      <span className="inline-block bg-gray-100 border border-gray-300 rounded-lg px-4 py-2 text-lg font-semibold">
                        £{renovationCostPerRoom.toLocaleString()} per room
                      </span>
                    </div>
                  </div>
                </div>

                {/* Financial Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Costs */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <PoundSterling className="text-red-500" />
                      <h3 className="text-lg font-semibold">Investment Breakdown</h3>
                    </div>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span>Property Sale Price:</span>
                        <span className="font-semibold">£{property.price.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>HMO Evaluation ({property.bedrooms || 4} bedrooms):</span>
                        <span className="font-semibold text-xs">Max {property.bedrooms || 4} bedrooms</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Renovation:</span>
                        <span className="font-semibold">£{analysis.total_renovation.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Bridging Loan Fee:</span>
                        <span className="font-semibold">£{analysis.bridging_loan_fee.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Legal Costs:</span>
                        <span className="font-semibold">£{analysis.legal_costs.toLocaleString()}</span>
                      </div>
                      <div className="border-t pt-2 flex justify-between font-bold">
                        <span>Total Investment:</span>
                        <span>£{analysis.total_investment.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Returns */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <TrendingUp className="text-green-500" />
                      <h3 className="text-lg font-semibold">Projected Returns</h3>
                    </div>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span>Local LHA Rate:</span>
                        <span className="font-semibold">£400/month</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Income (PA):</span>
                        <span className="font-semibold">£{analysis.annual_rental_income.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Net Profit (PA):</span>
                        <span className="font-semibold">£{analysis.net_annual_profit.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Left in Deal:</span>
                        <span className="font-semibold">£{Math.round(analysis.left_in_deal).toLocaleString()}</span>
                      </div>
                      <div className="border-t pt-2 flex justify-between font-bold">
                        <span>Money Out Within:</span>
                        <span className="text-green-600">{getPaybackPeriodText(analysis.payback_period_years)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-2xl border border-blue-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Percent className="text-blue-600" />
                      <span className="text-sm font-semibold text-blue-900">ROI</span>
                    </div>
                    <div className="text-3xl font-bold text-blue-800">{analysis.roi.toFixed(1)}%</div>
                    <p className="text-xs text-blue-600 mt-1">Annual return on investment</p>
                  </div>
                  
                  <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-2xl border border-green-200">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="text-green-600" />
                      <span className="text-sm font-semibold text-green-900">Yield</span>
                    </div>
                    <div className="text-3xl font-bold text-green-800">{analysis.gross_yield.toFixed(1)}%</div>
                    <p className="text-xs text-green-600 mt-1">Gross rental yield</p>
                  </div>
                  
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-2xl border border-purple-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Coins className="text-purple-600" />
                      <span className="text-sm font-semibold text-purple-900">Cash Flow</span>
                    </div>
                    <div className="text-3xl font-bold text-purple-800">£{analysis.cash_flow_monthly}</div>
                    <p className="text-xs text-purple-600 mt-1">Monthly net income</p>
                  </div>
                </div>

                {/* Analysis Summary */}
                <div className="bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-2xl p-6">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="text-white text-sm" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-emerald-900 mb-2">Investment Recommendation</h4>
                      <p className="text-emerald-800 text-sm leading-relaxed">
                        This property shows strong potential for HMO investment with excellent ROI and yield figures. 
                        The location provides stable rental demand. Consider viewing this property as a priority investment opportunity.
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
