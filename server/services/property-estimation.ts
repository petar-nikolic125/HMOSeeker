/**
 * Property estimation module with location-based rent defaults for 25 UK cities.
 * Ported from Python script to TypeScript for server-side calculations.
 */

// Location-based defaults (monthly rent per bedroom + city average rent)
const locationRentDefaults: Record<string, { rent_per_bed: number; city_avg_monthly: number }> = {
  london: { rent_per_bed: 1000, city_avg_monthly: 1850 },
  birmingham: { rent_per_bed: 580, city_avg_monthly: 900 },
  manchester: { rent_per_bed: 650, city_avg_monthly: 980 },
  liverpool: { rent_per_bed: 520, city_avg_monthly: 760 },
  leeds: { rent_per_bed: 540, city_avg_monthly: 820 },
  sheffield: { rent_per_bed: 480, city_avg_monthly: 730 },
  bristol: { rent_per_bed: 700, city_avg_monthly: 1150 },
  glasgow: { rent_per_bed: 470, city_avg_monthly: 680 },
  leicester: { rent_per_bed: 460, city_avg_monthly: 700 },
  edinburgh: { rent_per_bed: 700, city_avg_monthly: 1100 },
  newcastle: { rent_per_bed: 480, city_avg_monthly: 720 },
  nottingham: { rent_per_bed: 500, city_avg_monthly: 750 },
  cardiff: { rent_per_bed: 520, city_avg_monthly: 780 },
  coventry: { rent_per_bed: 430, city_avg_monthly: 650 },
  bradford: { rent_per_bed: 390, city_avg_monthly: 600 },
  "stoke-on-trent": { rent_per_bed: 350, city_avg_monthly: 540 },
  wolverhampton: { rent_per_bed: 380, city_avg_monthly: 560 },
  plymouth: { rent_per_bed: 420, city_avg_monthly: 650 },
  southampton: { rent_per_bed: 500, city_avg_monthly: 800 },
  reading: { rent_per_bed: 780, city_avg_monthly: 1250 },
  derby: { rent_per_bed: 420, city_avg_monthly: 640 },
  dudley: { rent_per_bed: 380, city_avg_monthly: 560 },
  northampton: { rent_per_bed: 420, city_avg_monthly: 660 },
  portsmouth: { rent_per_bed: 460, city_avg_monthly: 700 },
  preston: { rent_per_bed: 360, city_avg_monthly: 560 },
};

export interface PropertyData {
  price: number;
  bedrooms?: number;
  bathrooms?: number;
  city?: string;
  postcode?: string;
  address?: string;
  description?: string;
  area_sqm?: number;
}

export interface Assumptions {
  method?: 'location' | 'per_bedroom' | 'one_percent_rule' | 'rent_per_sqm' | 'custom_rent';
  rent_per_bed?: number;
  one_percent_rate?: number;
  rent_per_sqm?: number;
  custom_rent_monthly?: number;
  annual_expense_rate?: number;
  void_rate?: number;
  management_fee_rate?: number;
  transaction_costs_rate?: number;
  income_tax_rate?: number;
  renovation_cost_per_room?: number;
  mortgage?: {
    loan_amount?: number;
    downpayment?: number;
    annual_interest_rate?: number;
    term_years?: number;
  };
}

export interface PropertyMetrics {
  address: string;
  city: string;
  postcode: string;
  price: number;
  bedrooms: number;
  bathrooms: number | null;
  rent_method_used: string;
  estimated_monthly_rent: number;
  effective_monthly_rent_after_voids: number;
  annual_gross_rent: number;
  annual_effective_rent: number;
  annual_operating_expenses: number;
  NOI: number;
  gross_yield_pct: number | null;
  net_yield_pct: number | null;
  transaction_costs: number;
  total_renovation_cost: number;
  total_investment: number;
  downpayment: number;
  annual_mortgage_payment: number;
  pre_tax_cash_flow: number;
  cash_on_cash_pct: number | null;
  simple_roi_pct: number | null;
  after_tax_cash_flow: number;
  cash_invested: number;
}

export function estimatePropertyMetrics(prop: PropertyData, assumptions?: Assumptions): PropertyMetrics {
  // Default assumptions
  const defaults: Required<Assumptions> = {
    method: 'location',
    rent_per_bed: 650,
    one_percent_rate: 0.01,
    rent_per_sqm: 0,
    custom_rent_monthly: 0,
    annual_expense_rate: 0.30,
    void_rate: 0.05,
    management_fee_rate: 0.10,
    transaction_costs_rate: 0.05,
    income_tax_rate: 0.20,
    renovation_cost_per_room: 17000,
    mortgage: {
      loan_amount: 0,
      downpayment: 0,
      annual_interest_rate: 0.055,
      term_years: 25,
    },
  };

  // Merge with provided assumptions
  const settings = { ...defaults, ...assumptions };
  if (assumptions?.mortgage) {
    settings.mortgage = { ...defaults.mortgage, ...assumptions.mortgage };
  }

  // Read property values
  const price = Number(prop.price || 0);
  const bedrooms = Number(prop.bedrooms || 0);
  const city = (prop.city || "").trim().toLowerCase();
  const area_sqm = prop.area_sqm;

  // Decide rent estimation method
  const method = settings.method;
  let rent_source = "";
  let est_monthly_rent = 0;

  // 1) Location-based rent if possible
  if (method === 'location' && city) {
    const loc = locationRentDefaults[city];
    if (loc) {
      if (bedrooms && loc.rent_per_bed) {
        est_monthly_rent = bedrooms * loc.rent_per_bed;
        rent_source = `location_per_bed (${city})`;
      } else {
        est_monthly_rent = loc.city_avg_monthly;
        rent_source = `location_city_avg (${city})`;
      }
    }
  }

  // 2) Per-bedroom fallback
  if (est_monthly_rent === 0 && (method === 'per_bedroom' || method === 'location')) {
    if (bedrooms) {
      est_monthly_rent = bedrooms * settings.rent_per_bed;
      rent_source = `per_bedroom (${settings.rent_per_bed}/bed)`;
    }
  }

  // 3) One-percent rule
  if (est_monthly_rent === 0 && method === 'one_percent_rule') {
    est_monthly_rent = price * settings.one_percent_rate;
    rent_source = `one_percent (${settings.one_percent_rate * 100}%)`;
  }

  // 4) Rent per sqm
  if (est_monthly_rent === 0 && method === 'rent_per_sqm' && area_sqm && settings.rent_per_sqm) {
    est_monthly_rent = area_sqm * settings.rent_per_sqm;
    rent_source = `rent_per_sqm (${settings.rent_per_sqm}/sqm)`;
  }

  // 5) Custom rent
  if (est_monthly_rent === 0 && method === 'custom_rent' && settings.custom_rent_monthly) {
    est_monthly_rent = settings.custom_rent_monthly;
    rent_source = "custom_rent";
  }

  // Final fallback
  if (est_monthly_rent === 0) {
    const per_bed = bedrooms ? bedrooms * settings.rent_per_bed : null;
    const one_pct = price ? price * settings.one_percent_rate : null;
    const candidates = [per_bed, one_pct].filter(c => c !== null) as number[];
    
    if (candidates.length > 0) {
      est_monthly_rent = candidates.reduce((a, b) => a + b, 0) / candidates.length;
      rent_source = "fallback_avg";
    } else {
      est_monthly_rent = settings.rent_per_bed * (bedrooms || 1);
      rent_source = "ultimate_fallback_per_bed";
    }
  }

  // Vacancy and effective rent
  const vacancy_loss = est_monthly_rent * settings.void_rate;
  const effective_monthly_rent = est_monthly_rent - vacancy_loss;

  const annual_gross_rent = est_monthly_rent * 12;
  const annual_effective_rent = effective_monthly_rent * 12;

  // Expenses
  const operating_expenses = annual_gross_rent * settings.annual_expense_rate;
  const management_fee = annual_gross_rent * settings.management_fee_rate;
  const total_operating_expenses = operating_expenses + management_fee;

  // NOI and yields
  const noi = annual_effective_rent - total_operating_expenses;
  const gross_yield = price ? (annual_gross_rent / price) : null;
  const net_yield = price ? (noi / price) : null;

  // Transaction costs and renovation
  const transaction_costs = price * settings.transaction_costs_rate;
  const total_renovation_cost = (bedrooms || 1) * settings.renovation_cost_per_room;
  const total_investment = price + transaction_costs + total_renovation_cost;

  // Mortgage calculations
  let downpayment = 0;
  let annual_mortgage_payment = 0;
  
  if (settings.mortgage && (settings.mortgage.loan_amount || settings.mortgage.downpayment)) {
    const loan_amount = settings.mortgage.loan_amount || (price - (settings.mortgage.downpayment || 0));
    const annual_interest_rate = settings.mortgage.annual_interest_rate || 0.055;
    const term_years = settings.mortgage.term_years || 25;
    
    downpayment = settings.mortgage.downpayment || (price - loan_amount);
    
    if (annual_interest_rate > 0 && term_years > 0) {
      const r = annual_interest_rate / 12;
      const n = term_years * 12;
      const monthly_payment = loan_amount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
      annual_mortgage_payment = monthly_payment * 12;
    } else {
      annual_mortgage_payment = term_years > 0 ? loan_amount / term_years : 0;
    }
  }

  // Cash flows & returns
  const cash_invested = downpayment + transaction_costs + total_renovation_cost;
  const pre_tax_cash_flow = noi - annual_mortgage_payment;
  const cash_on_cash = cash_invested > 0 ? (pre_tax_cash_flow / cash_invested) : null;
  const simple_roi = price ? (pre_tax_cash_flow / price) : null;

  const taxable_income = Math.max(0, noi - annual_mortgage_payment);
  const tax = taxable_income * settings.income_tax_rate;
  const after_tax_cash_flow = taxable_income - tax;

  return {
    address: prop.address || '',
    city: prop.city || '',
    postcode: prop.postcode || '',
    price,
    bedrooms,
    bathrooms: prop.bathrooms || null,
    rent_method_used: rent_source,
    estimated_monthly_rent: Math.round(est_monthly_rent * 100) / 100,
    effective_monthly_rent_after_voids: Math.round(effective_monthly_rent * 100) / 100,
    annual_gross_rent: Math.round(annual_gross_rent * 100) / 100,
    annual_effective_rent: Math.round(annual_effective_rent * 100) / 100,
    annual_operating_expenses: Math.round(total_operating_expenses * 100) / 100,
    NOI: Math.round(noi * 100) / 100,
    gross_yield_pct: gross_yield ? Math.round(gross_yield * 10000) / 100 : null,
    net_yield_pct: net_yield ? Math.round(net_yield * 10000) / 100 : null,
    transaction_costs: Math.round(transaction_costs * 100) / 100,
    total_renovation_cost: Math.round(total_renovation_cost * 100) / 100,
    total_investment: Math.round(total_investment * 100) / 100,
    downpayment: Math.round(downpayment * 100) / 100,
    annual_mortgage_payment: Math.round(annual_mortgage_payment * 100) / 100,
    pre_tax_cash_flow: Math.round(pre_tax_cash_flow * 100) / 100,
    cash_on_cash_pct: cash_on_cash ? Math.round(cash_on_cash * 10000) / 100 : null,
    simple_roi_pct: simple_roi ? Math.round(simple_roi * 10000) / 100 : null,
    after_tax_cash_flow: Math.round(after_tax_cash_flow * 100) / 100,
    cash_invested: Math.round(cash_invested * 100) / 100,
  };
}

export function scenarioReport(prop: PropertyData, baseAssumptions?: Assumptions) {
  const base = baseAssumptions || {};
  const scenarios = {
    conservative: {
      ...base,
      rent_per_bed: (base.rent_per_bed || 650) * 0.9,
      annual_expense_rate: (base.annual_expense_rate || 0.30) * 1.1,
    },
    typical: base,
    aggressive: {
      ...base,
      rent_per_bed: (base.rent_per_bed || 650) * 1.1,
      annual_expense_rate: (base.annual_expense_rate || 0.30) * 0.9,
    },
  };

  const results: Record<string, PropertyMetrics> = {};
  for (const [name, assumptions] of Object.entries(scenarios)) {
    results[name] = estimatePropertyMetrics(prop, assumptions);
  }
  return results;
}