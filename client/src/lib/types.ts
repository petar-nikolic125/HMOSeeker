export interface PropertyAnalysis {
  property_id: string;
  purchase_price: number;
  renovation_cost_per_room: number;
  total_renovation: number;
  bridging_loan_fee: number;
  legal_costs: number;
  total_investment: number;
  monthly_rental_income: number;
  annual_rental_income: number;
  annual_expenses: number;
  net_annual_profit: number;
  gross_yield: number;
  roi: number;
  left_in_deal: number;
  payback_period_years: number;
  cash_flow_monthly: number;
}

export interface ScrapeStatus {
  success: boolean;
  search_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  results_count: number;
  filters: {
    city: string;
    max_price?: number;
    min_bedrooms?: number;
    keywords?: string;
  };
  created_at: string;
  updated_at: string;
}

export interface SearchFilters {
  city: string;
  max_price?: number;
  min_bedrooms?: number;
  keywords?: string;
}
