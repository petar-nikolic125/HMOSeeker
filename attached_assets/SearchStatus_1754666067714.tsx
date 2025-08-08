import { Clock, Search } from 'lucide-react';
import { format } from 'date-fns';

interface SearchStatusProps {
  count: number;
  isLoading: boolean;
  lastUpdated: number;
}

export const SearchStatus = ({ count, isLoading, lastUpdated }: SearchStatusProps) => {
  const formatTime = (timestamp: number) => {
    return format(new Date(timestamp), 'h:mm a');
  };

  return (
    <div 
      className="flex items-center justify-between bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 mb-6"
      role="status"
      aria-live="polite"
      aria-label={isLoading ? "Searching for properties" : `Found ${count} properties`}
    >
      <div className="flex items-center gap-2">
        {isLoading ? (
          <>
            <Search className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-spin" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 animate-pulse">
              Searching for HMOs matching your criteria...
            </span>
          </>
        ) : (
          <>
            <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Fetched {count} HMO{count !== 1 ? "'s" : ""} matching your criteria
            </span>
          </>
        )}
      </div>
      
      {!isLoading && (
        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          <Clock className="h-3 w-3" />
          <span>Last updated: {formatTime(lastUpdated)}</span>
        </div>
      )}
    </div>
  );
};