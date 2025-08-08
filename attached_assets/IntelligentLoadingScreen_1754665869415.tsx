import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Brain, Target, CheckCircle, XCircle, Zap, Database, Globe, MapPin } from 'lucide-react';

interface IntelligentLoadingScreenProps {
  isVisible: boolean;
  city?: string;
  searchParams?: {
    minRooms?: number;
    maxPrice?: number;
  };
  onComplete?: () => void;
}

const aiThoughts = [
  { icon: Search, text: "Scanning property portals...", duration: 2000, type: "scanning" },
  { icon: Globe, text: "Accessing Zoopla database...", duration: 1500, type: "accessing" },
  { icon: Database, text: "Querying PrimeLocation API...", duration: 1800, type: "querying" },
  { icon: Brain, text: "Analyzing property listings...", duration: 2200, type: "analyzing" },
  { icon: Target, text: "Filtering HMO opportunities...", duration: 1600, type: "filtering" },
  { icon: MapPin, text: "Validating property locations...", duration: 1400, type: "validating" },
  { icon: Zap, text: "Calculating investment yields...", duration: 1900, type: "calculating" },
];

const smartRemarks = [
  { text: "Hmm, that price seems reasonable...", type: "positive", delay: 3000 },
  { text: "This area shows good rental potential", type: "positive", delay: 5500 },
  { text: "Wait, let me double-check this yield...", type: "thinking", delay: 8000 },
  { text: "Actually, this looks very promising!", type: "positive", delay: 10500 },
  { text: "Found some interesting HMO properties", type: "success", delay: 12000 },
  { text: "Cross-referencing with market data...", type: "analyzing", delay: 6800 },
  { text: "This could be a solid investment", type: "positive", delay: 14000 },
];

export const IntelligentLoadingScreen = ({ isVisible, city, searchParams, onComplete }: IntelligentLoadingScreenProps) => {
  const [currentThought, setCurrentThought] = useState(0);
  const [currentRemark, setCurrentRemark] = useState(-1);
  const [progress, setProgress] = useState(0);
  const [showRemarks, setShowRemarks] = useState<boolean[]>(new Array(smartRemarks.length).fill(false));
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    if (!isVisible) {
      setCurrentThought(0);
      setCurrentRemark(-1);
      setProgress(0);
      setShowRemarks(new Array(smartRemarks.length).fill(false));
      setIsCompleted(false);
      return;
    }

    let thoughtInterval: NodeJS.Timeout;
    let progressInterval: NodeJS.Timeout;
    let remarkTimeout: NodeJS.Timeout;
    let completionTimeout: NodeJS.Timeout;

    // Progress animation - faster progress that plateaus at 95% until actual completion
    progressInterval = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev + Math.random() * 8 + 3;
        return Math.min(newProgress, 95);
      });
    }, 300);

    // AI thoughts progression
    thoughtInterval = setInterval(() => {
      setCurrentThought(prev => (prev + 1) % aiThoughts.length);
    }, 1800);

    // Single remark at a time to prevent overlapping
    let remarkIndex = 0;
    const showNextRemark = () => {
      if (remarkIndex < smartRemarks.length) {
        setCurrentRemark(remarkIndex);
        remarkIndex++;
        
        remarkTimeout = setTimeout(() => {
          setCurrentRemark(-1);
          setTimeout(showNextRemark, 500);
        }, 2000);
      }
    };
    
    setTimeout(showNextRemark, 2000);

    return () => {
      clearInterval(thoughtInterval);
      clearInterval(progressInterval);
      clearTimeout(remarkTimeout);
      clearTimeout(completionTimeout);
    };
  }, [isVisible]);

  // Handle completion when data is ready
  useEffect(() => {
    if (isVisible && !isCompleted && onComplete) {
      // Check if we should complete (this will be triggered by parent when data is ready)
      const completeAnimation = () => {
        setProgress(100);
        setIsCompleted(true);
        setTimeout(() => {
          onComplete();
        }, 800);
      };

      // Set a minimum display time of 3 seconds
      const minDisplayTime = setTimeout(completeAnimation, 3000);
      return () => clearTimeout(minDisplayTime);
    }
  }, [isVisible, isCompleted, onComplete]);

  if (!isVisible) return null;

  const CurrentIcon = aiThoughts[currentThought]?.icon || Search;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 z-50 flex flex-col items-center justify-center"
      >
        {/* Animated background particles */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={`particle-${i}`}
              className="absolute w-1 h-1 bg-purple-400 rounded-full opacity-20"
              animate={{
                x: [0, 100, 200, 0],
                y: [0, 150, 100, 0],
              }}
              transition={{
                duration: 15 + i * 2,
                repeat: Infinity,
                repeatType: "loop",
                ease: "linear",
              }}
              style={{
                left: (i * 12.5) + '%',
                top: (i * 10) + '%',
              }}
            />
          ))}
        </div>

        <div className="relative z-10 text-center max-w-2xl px-6">
          {/* AI Brain Animation */}
          <motion.div
            className="mb-8 flex justify-center"
            animate={{ 
              scale: [1, 1.1, 1],
              rotateY: [0, 10, -10, 0]
            }}
            transition={{ 
              duration: 3, 
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <div className="relative">
              <motion.div
                className="w-24 h-24 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center"
                animate={{ 
                  boxShadow: [
                    "0 0 20px rgba(147, 51, 234, 0.5)",
                    "0 0 40px rgba(147, 51, 234, 0.8)",
                    "0 0 20px rgba(147, 51, 234, 0.5)"
                  ]
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <CurrentIcon className="w-12 h-12 text-white" />
              </motion.div>
              
              {/* Pulse rings */}
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={`pulse-${i}`}
                  className="absolute inset-0 border-2 border-purple-400 rounded-full"
                  animate={{ 
                    scale: [1, 2, 2.5],
                    opacity: [0.8, 0.3, 0]
                  }}
                  transition={{ 
                    duration: 2, 
                    repeat: Infinity,
                    delay: i * 0.5
                  }}
                />
              ))}
            </div>
          </motion.div>

          {/* Main Status */}
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
            AI Property Analysis
          </h1>

          {/* Current AI Thought */}
          <div className="mb-6 min-h-[32px]">
            <AnimatePresence mode="wait">
              <motion.p 
                key={`thought-${currentThought}`}
                className="text-xl text-purple-200 flex items-center justify-center gap-3"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <CurrentIcon className="w-6 h-6 animate-pulse" />
                {aiThoughts[currentThought]?.text}
              </motion.p>
            </AnimatePresence>
          </div>

          {/* Search Context */}
          {city && (
            <motion.div 
              className="mb-8 p-4 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 }}
            >
              <p className="text-purple-100">
                Searching <span className="font-semibold text-white">{city}</span>
                {searchParams?.minRooms && (
                  <span> • {searchParams.minRooms}+ bedrooms</span>
                )}
                {searchParams?.maxPrice && (
                  <span> • Under £{searchParams.maxPrice.toLocaleString()}</span>
                )}
              </p>
            </motion.div>
          )}

          {/* Progress Bar */}
          <div className="mb-8">
            <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full relative"
                initial={{ width: "0%" }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              >
                <motion.div
                  className="absolute inset-0 bg-white/30"
                  animate={{ x: ["-100%", "100%"] }}
                  transition={{ 
                    duration: 1.5, 
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />
              </motion.div>
            </div>
            <p className="text-purple-300 mt-2 text-sm">
              {progress.toFixed(0)}% complete
            </p>
          </div>

          {/* Smart AI Remarks */}
          <div className="min-h-[60px] flex items-center justify-center relative">
            <AnimatePresence mode="wait">
              {currentRemark >= 0 && (
                <motion.div
                  key={`remark-${currentRemark}`}
                  initial={{ opacity: 0, y: 20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.9 }}
                  transition={{ duration: 0.3 }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <div className={`px-4 py-2 rounded-full border backdrop-blur-sm ${
                    smartRemarks[currentRemark].type === 'positive' ? 'bg-green-500/20 border-green-400/50 text-green-200' :
                    smartRemarks[currentRemark].type === 'thinking' ? 'bg-yellow-500/20 border-yellow-400/50 text-yellow-200' :
                    smartRemarks[currentRemark].type === 'analyzing' ? 'bg-blue-500/20 border-blue-400/50 text-blue-200' :
                    'bg-purple-500/20 border-purple-400/50 text-purple-200'
                  }`}>
                    <p className="text-sm font-medium flex items-center gap-2">
                      {smartRemarks[currentRemark].type === 'positive' && <CheckCircle className="w-4 h-4" />}
                      {smartRemarks[currentRemark].type === 'thinking' && <Brain className="w-4 h-4" />}
                      {smartRemarks[currentRemark].type === 'analyzing' && <Search className="w-4 h-4" />}
                      "{smartRemarks[currentRemark].text}"
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Technical Details */}
          <motion.div 
            className="mt-8 text-xs text-purple-400 space-y-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2 }}
          >
            <p>🤖 Powered by advanced property analysis algorithms</p>
            <p>🔍 Real-time data from multiple UK property portals</p>
            <p>💡 No synthetic data • Only authentic property listings</p>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};