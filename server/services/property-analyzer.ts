/**
 * Property estimation module with location-based rent defaults for 25 UK cities.
 * Adapted from Python algorithm for TypeScript/Node.js
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

interface PropertyInput {
  price: number;
  bedrooms?: number;
  bathrooms?: number;
  city?: string;
  postcode?: string;
  area_sqm?: number;
  address?: string;
  description?: string;
}

interface Assumptions {
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
  mortgage?: {
    loan_amount?: number;
    downpayment?: number;
    annual_interest_rate?: number;
    term_years?: number;
  };
}

interface PropertyMetrics {
  address: string;
  city: string;
  postcode: string;
  price: number;
  bedrooms: number;
  bathrooms?: number;
  rent_method_used: string;
  estimated_monthly_rent: number;
  effective_monthly_rent_after_voids: number;
  annual_gross_rent: number;
  annual_effective_rent: number;
  annual_operating_expenses: number;
  NOI: number;
  gross_yield_pct?: number;
  net_yield_pct?: number;
  transaction_costs: number;
  downpayment: number;
  annual_mortgage_payment: number;
  pre_tax_cash_flow: number;
  cash_on_cash_pct?: number;
  simple_roi_pct?: number;
  after_tax_cash_flow: number;
}

export class PropertyAnalyzer {
  /**
   * Estimate rent, ROI, yield and other stats for a property
   */
  static estimatePropertyMetrics(prop: PropertyInput, assumptions?: Assumptions): PropertyMetrics {
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
      mortgage: {
        loan_amount: 0,
        downpayment: 0,
        annual_interest_rate: 0.05,
        term_years: 25,
      },
      ...assumptions,
    };

    // Read property values
    const price = prop.price || 0;
    const bedrooms = prop.bedrooms || 0;
    const city = (prop.city || '').trim().toLowerCase();
    const area_sqm = prop.area_sqm;

    // Decide rent estimation method
    const method = defaults.method;
    let rent_source = '';
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
    if (!est_monthly_rent && (method === 'per_bedroom' || method === 'location')) {
      if (bedrooms) {
        est_monthly_rent = bedrooms * defaults.rent_per_bed;
        rent_source = `per_bedroom (${defaults.rent_per_bed}/bed)`;
      }
    }

    // 3) One-percent rule
    if (!est_monthly_rent && method === 'one_percent_rule') {
      est_monthly_rent = price * defaults.one_percent_rate;
      rent_source = `one_percent (${(defaults.one_percent_rate * 100).toFixed(2)}%)`;
    }

    // 4) Rent per sqm
    if (!est_monthly_rent && method === 'rent_per_sqm' && area_sqm && defaults.rent_per_sqm) {
      est_monthly_rent = area_sqm * defaults.rent_per_sqm;
      rent_source = `rent_per_sqm (${defaults.rent_per_sqm}/sqm)`;
    }

    // 5) Custom rent
    if (!est_monthly_rent && method === 'custom_rent' && defaults.custom_rent_monthly) {
      est_monthly_rent = defaults.custom_rent_monthly;
      rent_source = 'custom_rent';
    }

    // Final fallback
    if (!est_monthly_rent) {
      const per_bed = bedrooms ? bedrooms * defaults.rent_per_bed : null;
      const one_pct = price ? price * defaults.one_percent_rate : null;
      const candidates = [per_bed, one_pct].filter(c => c !== null) as number[];
      
      if (candidates.length > 0) {
        est_monthly_rent = candidates.reduce((a, b) => a + b, 0) / candidates.length;
        rent_source = 'fallback_avg';
      } else {
        est_monthly_rent = defaults.rent_per_bed * (bedrooms || 1);
        rent_source = 'ultimate_fallback_per_bed';
      }
    }

    // Vacancy and effective rent
    const vacancy_loss = est_monthly_rent * defaults.void_rate;
    const effective_monthly_rent = est_monthly_rent - vacancy_loss;

    const annual_gross_rent = est_monthly_rent * 12;
    const annual_effective_rent = effective_monthly_rent * 12;

    // Expenses
    const operating_expenses = annual_gross_rent * defaults.annual_expense_rate;
    const management_fee = annual_gross_rent * defaults.management_fee_rate;
    const total_operating_expenses = operating_expenses + management_fee;

    // NOI and yields
    const noi = annual_effective_rent - total_operating_expenses;
    const gross_yield = price > 0 ? (annual_gross_rent / price) : null;
    const net_yield = price > 0 ? (noi / price) : null;

    // Transaction costs
    const transaction_costs = price * defaults.transaction_costs_rate;

    // Mortgage calculations
    let downpayment = 0;
    let annual_mortgage_payment = 0;
    const mortgage = defaults.mortgage;
    
    if (mortgage && mortgage.loan_amount && mortgage.loan_amount > 0) {
      const loan_amount = mortgage.loan_amount;
      const annual_interest_rate = mortgage.annual_interest_rate || 0.05;
      const term_years = mortgage.term_years || 25;
      const r = annual_interest_rate / 12.0;
      const n = term_years * 12;
      
      if (r > 0 && n > 0) {
        const monthly_payment = loan_amount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
        annual_mortgage_payment = monthly_payment * 12;
      } else {
        annual_mortgage_payment = n > 0 ? (loan_amount / n) * 12 : 0;
      }
      
      downpayment = mortgage.downpayment || (price - loan_amount);
    }

    // Cash flows & returns
    const cash_invested = downpayment + transaction_costs;
    const pre_tax_cash_flow = noi - annual_mortgage_payment;
    const cash_on_cash = cash_invested > 0 ? (pre_tax_cash_flow / cash_invested) : null;
    const simple_roi = price > 0 ? (pre_tax_cash_flow / price) : null;

    const taxable_income = Math.max(0, noi - annual_mortgage_payment);
    const tax = taxable_income * defaults.income_tax_rate;
    const after_tax_cash_flow = taxable_income - tax;

    return {
      address: prop.address || '',
      city: prop.city || '',
      postcode: prop.postcode || '',
      price,
      bedrooms,
      bathrooms: prop.bathrooms,
      rent_method_used: rent_source,
      estimated_monthly_rent: Math.round(est_monthly_rent * 100) / 100,
      effective_monthly_rent_after_voids: Math.round(effective_monthly_rent * 100) / 100,
      annual_gross_rent: Math.round(annual_gross_rent * 100) / 100,
      annual_effective_rent: Math.round(annual_effective_rent * 100) / 100,
      annual_operating_expenses: Math.round(total_operating_expenses * 100) / 100,
      NOI: Math.round(noi * 100) / 100,
      gross_yield_pct: gross_yield ? Math.round(gross_yield * 10000) / 100 : undefined,
      net_yield_pct: net_yield ? Math.round(net_yield * 10000) / 100 : undefined,
      transaction_costs: Math.round(transaction_costs * 100) / 100,
      downpayment: Math.round(downpayment * 100) / 100,
      annual_mortgage_payment: Math.round(annual_mortgage_payment * 100) / 100,
      pre_tax_cash_flow: Math.round(pre_tax_cash_flow * 100) / 100,
      cash_on_cash_pct: cash_on_cash ? Math.round(cash_on_cash * 10000) / 100 : undefined,
      simple_roi_pct: simple_roi ? Math.round(simple_roi * 10000) / 100 : undefined,
      after_tax_cash_flow: Math.round(after_tax_cash_flow * 100) / 100,
    };
  }

  /**
   * Produce conservative / typical / aggressive scenarios
   */
  static scenarioReport(prop: PropertyInput, base_assumptions?: Assumptions): Record<string, PropertyMetrics> {
    const base = base_assumptions || {};
    const base_rent_per_bed = base.rent_per_bed || 650;
    const base_expense_rate = base.annual_expense_rate || 0.30;

    const scenarios = {
      conservative: {
        ...base,
        rent_per_bed: base_rent_per_bed * 0.9,
        annual_expense_rate: base_expense_rate * 1.1,
      },
      typical: base,
      aggressive: {
        ...base,
        rent_per_bed: base_rent_per_bed * 1.1,
        annual_expense_rate: base_expense_rate * 0.9,
      },
    };

    const results: Record<string, PropertyMetrics> = {};
    for (const [name, assumptions] of Object.entries(scenarios)) {
      results[name] = this.estimatePropertyMetrics(prop, assumptions);
    }

    return results;
  }

  /**
   * Analyze multiple properties and return comprehensive metrics
   */
  static analyzeProperties(properties: PropertyInput[], assumptions?: Assumptions): PropertyMetrics[] {
    return properties.map(prop => this.estimatePropertyMetrics(prop, assumptions));
  }
}