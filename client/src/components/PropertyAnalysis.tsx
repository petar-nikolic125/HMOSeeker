import { useState, useEffect } from 'react';
import { PropertyWithAnalytics } from '@/lib/types';
import { formatCurrency, formatPercentage } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { X, Calculator, TrendingUp, PoundSterling, Clock, Home, Wrench, FileText, Banknote } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PropertyAnalysisProps {
  property: PropertyWithAnalytics;
  isOpen: boolean;
  onClose: () => void;
}

interface AnalysisData {
  salePricePounds: number;
  hmoEvaluationBeds: number;
  renovationPerRoom: number;
  totalRenovation: number;
  bridgingLoanFee: number;
  legals: number;
  totalInput: number;
  leftInDeal: number;
  localLHARate: number;
  totalIncomePA: number;
  netProfitPA: number;
  moneyOutWithin: string;
}

export const PropertyAnalysis = ({ property, isOpen, onClose }: PropertyAnalysisProps) => {
  const [isCalculating, setIsCalculating] = useState(false);
  const [renovationPerRoom, setRenovationPerRoom] = useState([17000]);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);

  // Jarvis-style calculating animation
  const [calculatingStep, setCalculatingStep] = useState(0);
  const calculatingSteps = [
    "Analyzing property data...",
    "Calculating HMO potential...",
    "Processing renovation costs...",
    "Evaluating financial metrics...",
    "Computing yield projections...",
    "Finalizing analysis..."
  ];

  useEffect(() => {
    if (isOpen && !analysisData) {
      setIsCalculating(true);
      setCalculatingStep(0);
      
      // Simulate Jarvis-style calculation with step progression
      const interval = setInterval(() => {
        setCalculatingStep(prev => {
          if (prev < calculatingSteps.length - 1) {
            return prev + 1;
          } else {
            clearInterval(interval);
            calculateAnalysis();
            return prev;
          }
        });
      }, 800);

      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const calculateAnalysis = () => {
    // Calculate based on bedrooms (HMO evaluation)
    const bedroomCount = property.bedrooms;
    const hmoEvaluationBeds = bedroomCount >= 6 ? 6 : bedroomCount; // Max out at 6 for HMO
    
    // Financial calculations
    const salePricePounds = property.price;
    const totalRenovation = renovationPerRoom[0] * hmoEvaluationBeds;
    const bridgingLoanFee = 30000;
    const legals = 15000;
    const totalInput = salePricePounds + totalRenovation + bridgingLoanFee + legals;
    
    // Use the same LHA rate calculation from the backend (from property analytics)
    // Get LHA from property data if available, otherwise use Liverpool default
    const localLHARate = property.lhaWeekly ? (property.lhaWeekly * 52 / 12) : 400;
    const totalIncomePA = localLHARate * hmoEvaluationBeds * 12;
    
    // Net profit calculation (assuming 25% for taxes, maintenance, voids, management)
    const netProfitPA = totalIncomePA * 0.75;
    
    // Left in deal calculation (assuming 75% LTV)
    const leftInDeal = totalInput * 0.25;
    
    // Payback calculation
    const paybackYears = leftInDeal / netProfitPA;
    const moneyOutWithin = paybackYears < 1 ? "< 1 year" : 
                          paybackYears < 2 ? "1-2 years" : 
                          paybackYears < 3 ? "2-3 years" : "3+ years";
    
    const analysis: AnalysisData = {
      salePricePounds,
      hmoEvaluationBeds,
      renovationPerRoom: renovationPerRoom[0],
      totalRenovation,
      bridgingLoanFee,
      legals,
      totalInput,
      leftInDeal,
      localLHARate,
      totalIncomePA,
      netProfitPA,
      moneyOutWithin
    };

    setTimeout(() => {
      setAnalysisData(analysis);
      setIsCalculating(false);
    }, 1000);
  };

  // Recalculate when renovation slider changes
  useEffect(() => {
    if (analysisData) {
      const bedroomCount = property.bedrooms;
      const hmoEvaluationBeds = bedroomCount >= 6 ? 6 : bedroomCount;
      const totalRenovation = renovationPerRoom[0] * hmoEvaluationBeds;
      const totalInput = property.price + totalRenovation + 30000 + 15000;
      const leftInDeal = totalInput * 0.25;
      // Use the same LHA rate as initial calculation
      const localLHARate = property.lhaWeekly ? (property.lhaWeekly * 52 / 12) : 400;
      const totalIncomePA = localLHARate * hmoEvaluationBeds * 12;
      const netProfitPA = totalIncomePA * 0.75;
      const paybackYears = leftInDeal / netProfitPA;
      const moneyOutWithin = paybackYears < 1 ? "< 1 year" : 
                            paybackYears < 2 ? "1-2 years" : 
                            paybackYears < 3 ? "2-3 years" : "3+ years";

      setAnalysisData(prev => prev ? {
        ...prev,
        renovationPerRoom: renovationPerRoom[0],
        totalRenovation,
        totalInput,
        leftInDeal,
        netProfitPA,
        moneyOutWithin
      } : null);
    }
  }, [renovationPerRoom, property.price, property.bedrooms, property.lhaWeekly]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          
          {/* Analysis Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="fixed inset-4 md:inset-8 bg-white rounded-3xl shadow-2xl z-50 overflow-hidden"
          >
            <div className="h-full flex flex-col">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Calculator className="w-8 h-8" />
                    <div>
                      <h2 className="text-2xl font-bold">Property Analysis</h2>
                      <p className="text-blue-100">{property.address}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClose}
                    className="text-white hover:bg-white/20 rounded-full p-2"
                  >
                    <X className="w-6 h-6" />
                  </Button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-auto p-6">
                {isCalculating ? (
                  // Jarvis-style loading
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center space-y-8">
                      <motion.div
                        animate={{ 
                          rotateY: [0, 360],
                          scale: [1, 1.1, 1]
                        }}
                        transition={{ 
                          duration: 2, 
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                        className="w-24 h-24 mx-auto bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center"
                      >
                        <Calculator className="w-12 h-12 text-white" />
                      </motion.div>
                      
                      <div className="space-y-4">
                        <motion.h3 
                          className="text-2xl font-bold text-gray-800"
                          animate={{ opacity: [0.5, 1, 0.5] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        >
                          JARVIS Computing Analysis
                        </motion.h3>
                        
                        <div className="space-y-2">
                          {calculatingSteps.map((step, index) => (
                            <motion.div
                              key={index}
                              className={`text-left p-3 rounded-lg transition-all duration-300 ${
                                index <= calculatingStep 
                                  ? 'bg-blue-50 text-blue-700 font-medium' 
                                  : 'bg-gray-50 text-gray-500'
                              }`}
                              initial={{ x: -20, opacity: 0 }}
                              animate={{ 
                                x: index <= calculatingStep ? 0 : -20, 
                                opacity: index <= calculatingStep ? 1 : 0.5
                              }}
                              transition={{ delay: index * 0.1 }}
                            >
                              {index <= calculatingStep && (
                                <motion.span
                                  className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-3"
                                  animate={{ scale: [1, 1.5, 1] }}
                                  transition={{ duration: 0.8, repeat: Infinity }}
                                />
                              )}
                              {step}
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : analysisData ? (
                  // Analysis Results
                  <div className="space-y-6">
                    {/* Renovation Slider */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Wrench className="w-5 h-5 text-orange-500" />
                          Renovation Cost per Room
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="px-4">
                            <Slider
                              value={renovationPerRoom}
                              onValueChange={setRenovationPerRoom}
                              max={30000}
                              min={10000}
                              step={1000}
                              className="w-full"
                            />
                          </div>
                          <div className="text-center">
                            <Badge variant="outline" className="text-lg px-4 py-2">
                              {formatCurrency(renovationPerRoom[0])} per room
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Financial Breakdown */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Costs */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <PoundSterling className="w-5 h-5 text-red-500" />
                            Investment Breakdown
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Property Sale Price:</span>
                            <span className="font-semibold text-xs">{formatCurrency(analysisData.salePricePounds)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>HMO Evaluation ({analysisData.hmoEvaluationBeds} bedrooms):</span>
                            <span className="font-semibold text-xs">Max 6 bedrooms</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Renovation Total:</span>
                            <span className="font-semibold text-xs">{formatCurrency(analysisData.totalRenovation)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Bridging Loan Fee:</span>
                            <span className="font-semibold text-xs">{formatCurrency(analysisData.bridgingLoanFee)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Legal Fees:</span>
                            <span className="font-semibold text-xs">{formatCurrency(analysisData.legals)}</span>
                          </div>
                          <hr className="my-2" />
                          <div className="flex justify-between text-sm font-bold">
                            <span>Total Input:</span>
                            <span className="text-red-600">{formatCurrency(analysisData.totalInput)}</span>
                          </div>
                          <div className="flex justify-between text-sm font-bold">
                            <span>Left in Deal:</span>
                            <span className="text-orange-600">{formatCurrency(analysisData.leftInDeal)}</span>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Returns */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-green-500" />
                            Returns Analysis
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Local LHA Rate (monthly):</span>
                            <span className="font-semibold text-xs">{formatCurrency(analysisData.localLHARate)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Total Income (annual):</span>
                            <span className="font-semibold text-xs">{formatCurrency(analysisData.totalIncomePA)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Net Profit (annual):</span>
                            <span className="font-semibold text-xs">{formatCurrency(analysisData.netProfitPA)}</span>
                          </div>
                          <hr className="my-2" />
                          <div className="flex justify-between text-sm font-bold">
                            <span>ROI on Cash Left:</span>
                            <span className="text-green-600">{formatPercentage((analysisData.netProfitPA / analysisData.leftInDeal) * 100)}</span>
                          </div>
                          <div className="flex justify-between text-sm font-bold">
                            <span>Money Out Within:</span>
                            <span className="text-blue-600">{analysisData.moneyOutWithin}</span>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Investment Summary */}
                    <Card className="bg-gradient-to-r from-blue-50 to-purple-50">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Banknote className="w-5 h-5 text-purple-600" />
                          Investment Summary
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                          <div className="p-3 bg-white rounded-lg">
                            <div className="text-2xl font-bold text-blue-600">{formatPercentage((analysisData.netProfitPA / analysisData.leftInDeal) * 100)}</div>
                            <div className="text-xs text-gray-600">Cash on Cash ROI</div>
                          </div>
                          <div className="p-3 bg-white rounded-lg">
                            <div className="text-2xl font-bold text-green-600">{formatCurrency(analysisData.netProfitPA / 12)}</div>
                            <div className="text-xs text-gray-600">Monthly Profit</div>
                          </div>
                          <div className="p-3 bg-white rounded-lg">
                            <div className="text-2xl font-bold text-orange-600">{formatCurrency(analysisData.leftInDeal)}</div>
                            <div className="text-xs text-gray-600">Cash Required</div>
                          </div>
                          <div className="p-3 bg-white rounded-lg">
                            <div className="text-2xl font-bold text-purple-600">{analysisData.moneyOutWithin}</div>
                            <div className="text-xs text-gray-600">Payback Period</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ) : null}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};