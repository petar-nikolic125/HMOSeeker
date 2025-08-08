export const formatCurrency = (amount: number | undefined): string => {
  if (!amount || isNaN(amount)) return '£0';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatPercentage = (percentage: number | undefined): string => {
  if (percentage === null || percentage === undefined || isNaN(percentage)) return '0%';
  return `${percentage.toFixed(1)}%`;
};

export const formatNumber = (num: number | undefined): string => {
  if (!num || isNaN(num)) return '0';
  return num.toLocaleString('en-GB');
};

export const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};