/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * HMO Rent & Investment Calculator (TypeScript, scraping-agnostic)
 * ----------------------------------------------------------------
 * Focus: Business logic only — plug this into your React/Next app or backend.
 * No DOM, no fetch, no framework dependencies.
 *
 * Core ideas:
 * - Accept either ARV directly OR an uplift % on purchase price to compute ARV.
 * - Model bridging finance (LTV, arrangement fee as flat/percent, monthly interest & hold months).
 * - Model refinance (new BTL mortgage at LTV of ARV).
 * - Compute total cash input (deposit, reno if not financed, fees, interest, legals, stamp duty, etc.).
 * - Compute cash pulled out at refinance, cash left in the deal.
 * - Compute income (LHA per-room OR market per-room), voids/occupancy, and operating expenses.
 * - Compute annual cash flow, ROI on cash left, and payback period ("money out within X years").
 */

// ----------------------------- Types -----------------------------

export type Fee =
  | { kind: 'flat'; amount: number }                 // e.g., £30,000
  | { kind: 'percent'; percent: number; min?: number; max?: number }; // e.g., 2% of loan

export interface PurchaseFinanceInputs {
  /** Purchase price of the property (GBP). */
  purchasePrice: number;

  /** Number of bedrooms planned (default 6 for HMO). */
  bedrooms: number;

  /** Renovation cost per room (GBP). Example: £17,000 per room. */
  renovationPerRoom: number;

  /** Are renovation costs funded by the bridge (true) or from cash (false)? */
  financeRenovationFromBridge: boolean;

  /** Bridging: share of purchase price funded by bridge (0..1). Example: 0.75 for 75% LTV. */
  bridgingLTV: number;

  /** Bridging arrangement fee (flat or percent of the bridging principal). */
  bridgingArrangementFee: Fee;

  /** Bridging monthly interest rate (e.g., 0.009 for 0.9%/mo). */
  bridgingMonthlyRate: number;

  /** Months you will hold the bridge before refinance (e.g., 6). */
  bridgingHoldMonths: number;

  /** If true, add arrangement fee to bridge principal (rolled up); else paid in cash at start. */
  rollArrangementIntoBridge: boolean;

  /** Legal fees on purchase (GBP). Example: £15,000. */
  legals: number;

  /** Stamp duty land tax (GBP) — pass 0 if you model this elsewhere. */
  stampDuty: number;

  /** Any other acquisition costs (brokers, surveys, etc.). */
  otherAcqCosts?: number;
}

export interface RefinanceInputs {
  /** Provide ARV directly… */
  arv?: number;
  /** …or provide uplift % to compute ARV from purchase price (e.g., 0.25 for +25%). */
  upliftPct?: number;
  /** New BTL LTV at refinance (0..1). Example: 0.75. */
  refinanceLTV: number;
  /** New BTL mortgage interest rate (per annum, e.g., 0.06 for 6%). Interest-only assumed. */
  newMortgageInterestRatePA: number;
  /** BTL product/arrangement fee (optional). */
  btlProductFee?: Fee;
  /** If true, roll the BTL product fee into the new mortgage principal. */
  rollBtlFeeIntoMortgage?: boolean;
}

export interface IncomeInputs {
  /** If true, use LHA rate (per room per month); otherwise use market rent per room per month. */
  useLHA: boolean;
  /** LHA shared accommodation rate per room per month. */
  lhaSharedRateMonthly?: number;
  /** Market rent per room per month. */
  marketRentPerRoomMonthly?: number;
  /** Expected occupancy rate (0..1), e.g., 0.95 for 95% (voids of 5%). */
  occupancyRate: number;
  /** Other monthly income (e.g., parking, laundry). */
  otherIncomeMonthly?: number;
}

export interface OperatingCostsInputs {
  /** Letting/management fee as a % of collected rent (0..1). */
  managementPct: number;
  /** Repairs & maintenance allowance as % of collected rent (0..1). */
  maintenancePct: number;
  /** Building insurance (per annum). */
  insurancePA: number;
  /** Utilities (gas/electric/water/internet) per month (landlord paid). */
  billsMonthly: number;
  /** Council tax per month, if landlord-paid (many HMOs: 0). */
  councilTaxMonthly: number;
  /** HMO license cost (per annum; you may amortize multi-year licenses manually). */
  licensePA: number;
  /** Any other fixed operating expenses per annum. */
  otherOpexPA?: number;
}

export interface CalculatorInputs {
  purchase: PurchaseFinanceInputs;
  refinance: RefinanceInputs;
  income: IncomeInputs;
  opex: OperatingCostsInputs;
}

// Computed breakdowns

export interface AcquisitionBreakdown {
  renovationTotal: number;
  bridgePrincipal: number;
  bridgeArrangementFeeCash: number;
  bridgeArrangementFeeRolled: number;
  bridgeInterestDuringHold: number;
  cashDepositOnPurchase: number;
  totalAcquisitionCash: number; // all cash required through refinance day
}

export interface RefinanceBreakdown {
  arv: number;
  newMortgage: number;
  btlProductFeeCash: number;
  btlProductFeeRolled: number;
  bridgeRepaymentAtRefi: number; // principal + any rolled fees
  cashPulledAtRefi: number; // proceeds after repaying bridge
  cashLeftInDeal: number; // totalAcquisitionCash - cashPulledAtRefi
}

export interface IncomeExpenseBreakdown {
  grossRentMonthly: number;
  effectiveRentMonthly: number; // after occupancy
  otherIncomeMonthly: number;
  totalIncomePA: number;

  managementPA: number;
  maintenancePA: number;
  insurancePA: number;
  billsPA: number;
  councilTaxPA: number;
  licensePA: number;
  otherOpexPA: number;
  totalOpexPA: number;

  annualMortgageInterest: number;
  netProfitPA: number;
  netProfitMonthly: number;
}

export interface InvestmentMetrics {
  roiOnCashLeft: number; // netProfitPA / cashLeftInDeal
  yearsToRecoverCash: number | null; // null if netProfit<=0
  moneyOutWithin: string; // "<1 year", "1-2 years", "2-3 years", ">3 years", or "N/A"
  grossYieldOnARV: number; // totalIncomePA / ARV
}

export interface CalculatorResult {
  acquisition: AcquisitionBreakdown;
  refinance: RefinanceBreakdown;
  cashSummary: {
    totalInput: number;   // alias of acquisition.totalAcquisitionCash
    leftInDeal: number;   // alias of refinance.cashLeftInDeal
  };
  incomeExpense: IncomeExpenseBreakdown;
  metrics: InvestmentMetrics;
}

// ----------------------------- Defaults -----------------------------

export const DEFAULTS = {
  bedrooms: 6,
  renovationPerRoom: 17_000,
  bridging: {
    ltv: 0.75,
    arrangementFee: { kind: 'flat', amount: 30_000 } as Fee,
    monthlyRate: 0.009, // 0.9% / month
    holdMonths: 6,
    rollArrangementIntoBridge: false,
  },
  legals: 15_000,
  stampDuty: 0, // supply real SDLT if you choose
  refinance: {
    ltv: 0.75,
    newMortgageInterestRatePA: 0.06,
  },
  income: {
    useLHA: true,
    lhaSharedRateMonthly: 450,       // sensible placeholder
    marketRentPerRoomMonthly: 550,   // sensible placeholder
    occupancyRate: 0.95,
    otherIncomeMonthly: 0,
  },
  opex: {
    managementPct: 0.1,
    maintenancePct: 0.08,
    insurancePA: 600,
    billsMonthly: 700,
    councilTaxMonthly: 0,
    licensePA: 0,
    otherOpexPA: 0,
  },
} as const;

// ----------------------------- Helpers -----------------------------

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function computeFee(base: number, fee: Fee): number {
  if (fee.kind === 'flat') return Math.max(0, fee.amount);
  const raw = base * fee.percent;
  const bounded =
    (fee.min !== undefined ? Math.max(fee.min, raw) : raw) &&
    (fee.max !== undefined ? Math.min(fee.max, raw) : raw);
  return Math.max(0, bounded);
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function sum(...vals: number[]): number {
  return vals.reduce((a, b) => a + b, 0);
}

// ----------------------------- Core Calculation -----------------------------

export function calculateHmoDeal(inputs: CalculatorInputs): CalculatorResult {
  const p = inputs.purchase;
  const r = inputs.refinance;
  const i = inputs.income;
  const o = inputs.opex;

  // Validate critical inputs
  if (p.purchasePrice <= 0) throw new Error('purchasePrice must be > 0');
  if (p.bedrooms <= 0) throw new Error('bedrooms must be > 0');
  if (p.renovationPerRoom < 0) throw new Error('renovationPerRoom must be >= 0');
  if (p.bridgingLTV <= 0 || p.bridgingLTV >= 1) {
    // allow edge 0.8 etc.
  }
  if (r.refinanceLTV <= 0 || r.refinanceLTV >= 1) {
    // standard BTL LTVs like 0.75
  }
  if (i.useLHA && (i.lhaSharedRateMonthly ?? 0) <= 0) {
    throw new Error('LHA rate must be provided when useLHA=true');
  }
  if (!i.useLHA && (i.marketRentPerRoomMonthly ?? 0) <= 0) {
    throw new Error('marketRentPerRoomMonthly must be provided when useLHA=false');
  }
  const bedrooms = p.bedrooms;

  // --- Acquisition & Bridge ---
  const renovationTotal = p.renovationPerRoom * bedrooms;

  const bridgeOnPurchase = p.purchasePrice * p.bridgingLTV;
  const bridgeOnReno = p.financeRenovationFromBridge ? renovationTotal : 0;
  const bridgePrincipalPreFee = bridgeOnPurchase + bridgeOnReno;

  const arrangementFee = computeFee(bridgePrincipalPreFee, p.bridgingArrangementFee);
  const bridgePrincipal = p.rollArrangementIntoBridge
    ? bridgePrincipalPreFee + arrangementFee
    : bridgePrincipalPreFee;

  const bridgeInterestDuringHold = round2(bridgePrincipal * p.bridgingMonthlyRate * p.bridgingHoldMonths);

  const bridgeArrangementFeeCash = p.rollArrangementIntoBridge ? 0 : arrangementFee;
  const bridgeArrangementFeeRolled = p.rollArrangementIntoBridge ? arrangementFee : 0;

  const cashDepositOnPurchase = p.purchasePrice - bridgeOnPurchase;
  const renovationCash = p.financeRenovationFromBridge ? 0 : renovationTotal;

  const totalAcquisitionCash = round2(sum(
    cashDepositOnPurchase,
    renovationCash,
    p.legals,
    p.stampDuty,
    bridgeArrangementFeeCash,
    bridgeInterestDuringHold,
    p.otherAcqCosts ?? 0,
  ));

  const acquisition: AcquisitionBreakdown = {
    renovationTotal: round2(renovationTotal),
    bridgePrincipal: round2(bridgePrincipal),
    bridgeArrangementFeeCash: round2(bridgeArrangementFeeCash),
    bridgeArrangementFeeRolled: round2(bridgeArrangementFeeRolled),
    bridgeInterestDuringHold: round2(bridgeInterestDuringHold),
    cashDepositOnPurchase: round2(cashDepositOnPurchase),
    totalAcquisitionCash,
  };

  // --- Refinance ---
  const arv = r.arv !== undefined
    ? r.arv
    : (r.upliftPct !== undefined ? round2(p.purchasePrice * (1 + r.upliftPct)) : 0);
  if (arv <= 0) {
    throw new Error('Provide either refinance.arv or refinance.upliftPct');
  }

  const newMortgagePreFee = round2(arv * r.refinanceLTV);
  const btlFee = r.btlProductFee ? computeFee(newMortgagePreFee, r.btlProductFee) : 0;
  const newMortgage = r.rollBtlFeeIntoMortgage ? newMortgagePreFee + btlFee : newMortgagePreFee;

  // Bridge repayment excludes interest (already paid in cash), but includes any rolled arrangement fee
  const bridgeRepaymentAtRefi = round2(bridgePrincipal);

  // Cash pulled from refinance = mortgage proceeds minus bridge repayment, minus cash BTL fee (if not rolled)
  const cashPulledAtRefi = round2(Math.max(0, newMortgagePreFee - bridgeRepaymentAtRefi - (r.rollBtlFeeIntoMortgage ? 0 : btlFee)));

  const cashLeftInDeal = round2(Math.max(0, totalAcquisitionCash - cashPulledAtRefi));

  const refinance: RefinanceBreakdown = {
    arv: round2(arv),
    newMortgage: round2(newMortgage),
    btlProductFeeCash: round2(r.rollBtlFeeIntoMortgage ? 0 : btlFee),
    btlProductFeeRolled: round2(r.rollBtlFeeIntoMortgage ? btlFee : 0),
    bridgeRepaymentAtRefi,
    cashPulledAtRefi,
    cashLeftInDeal,
  };

  // --- Income & Expenses ---
  const perRoomMonthly = i.useLHA ? (i.lhaSharedRateMonthly as number) : (i.marketRentPerRoomMonthly as number);
  const grossRentMonthly = perRoomMonthly * bedrooms;
  const effectiveRentMonthly = grossRentMonthly * clamp(i.occupancyRate, 0, 1);
  const totalIncomeMonthly = effectiveRentMonthly + (i.otherIncomeMonthly ?? 0);
  const totalIncomePA = round2(totalIncomeMonthly * 12);

  const managementPA = round2(totalIncomePA * clamp(o.managementPct, 0, 1));
  const maintenancePA = round2(totalIncomePA * clamp(o.maintenancePct, 0, 1));
  const billsPA = round2(o.billsMonthly * 12);
  const councilTaxPA = round2(o.councilTaxMonthly * 12);
  const otherOpexPA = round2(o.otherOpexPA ?? 0);

  const totalOpexPA = round2(sum(
    managementPA, maintenancePA, o.insurancePA, billsPA, councilTaxPA, o.licensePA, otherOpexPA
  ));

  const annualMortgageInterest = round2(newMortgage * r.newMortgageInterestRatePA);
  const netProfitPA = round2(totalIncomePA - totalOpexPA - annualMortgageInterest);
  const netProfitMonthly = round2(netProfitPA / 12);

  const incomeExpense: IncomeExpenseBreakdown = {
    grossRentMonthly: round2(grossRentMonthly),
    effectiveRentMonthly: round2(effectiveRentMonthly),
    otherIncomeMonthly: round2(i.otherIncomeMonthly ?? 0),
    totalIncomePA,
    managementPA, maintenancePA, insurancePA: o.insurancePA, billsPA, councilTaxPA, licensePA: o.licensePA,
    otherOpexPA, totalOpexPA,
    annualMortgageInterest,
    netProfitPA, netProfitMonthly,
  };

  // --- Metrics ---
  const roiOnCashLeft = cashLeftInDeal > 0 ? round2(netProfitPA / cashLeftInDeal) : (netProfitPA > 0 ? Infinity : 0);
  const yearsToRecoverCash = netProfitPA > 0 ? round2(cashLeftInDeal / netProfitPA) : null;

  function bucketYears(y: number | null): string {
    if (y === null || !isFinite(y)) return 'N/A';
    if (y < 1) return '<1 year';
    if (y < 2) return '1-2 years';
    if (y < 3) return '2-3 years';
    return '>3 years';
  }

  const grossYieldOnARV = arv > 0 ? round2((totalIncomePA / arv) * 100) : 0;

  const metrics: InvestmentMetrics = {
    roiOnCashLeft,
    yearsToRecoverCash,
    moneyOutWithin: bucketYears(yearsToRecoverCash),
    grossYieldOnARV,
  };

  return {
    acquisition,
    refinance,
    cashSummary: {
      totalInput: acquisition.totalAcquisitionCash,
      leftInDeal: refinance.cashLeftInDeal,
    },
    incomeExpense,
    metrics,
  };
}

// ----------------------------- Convenience Factory -----------------------------

/**
 * Helper: build a standard inputs object with sensible defaults.
 * You can override any field you want.
 */
export function makeDefaultInputs(params: Partial<CalculatorInputs> & {
  purchasePrice: number;
  bedrooms?: number;
  /** Provide either arv or upliftPct inside 'refinance' if you don't pass a full refinance object. */
}): CalculatorInputs {
  const bedrooms = params.purchase?.bedrooms ?? params.bedrooms ?? DEFAULTS.bedrooms;

  const purchase: PurchaseFinanceInputs = {
    purchasePrice: params.purchasePrice,
    bedrooms,
    renovationPerRoom: params.purchase?.renovationPerRoom ?? DEFAULTS.renovationPerRoom,
    financeRenovationFromBridge: params.purchase?.financeRenovationFromBridge ?? false,
    bridgingLTV: params.purchase?.bridgingLTV ?? DEFAULTS.bridging.ltv,
    bridgingArrangementFee: params.purchase?.bridgingArrangementFee ?? DEFAULTS.bridging.arrangementFee,
    bridgingMonthlyRate: params.purchase?.bridgingMonthlyRate ?? DEFAULTS.bridging.monthlyRate,
    bridgingHoldMonths: params.purchase?.bridgingHoldMonths ?? DEFAULTS.bridging.holdMonths,
    rollArrangementIntoBridge: params.purchase?.rollArrangementIntoBridge ?? DEFAULTS.bridging.rollArrangementIntoBridge,
    legals: params.purchase?.legals ?? DEFAULTS.legals,
    stampDuty: params.purchase?.stampDuty ?? DEFAULTS.stampDuty,
    otherAcqCosts: params.purchase?.otherAcqCosts ?? 0,
  };

  const refinance: RefinanceInputs = {
    arv: params.refinance?.arv,
    upliftPct: params.refinance?.upliftPct,
    refinanceLTV: params.refinance?.refinanceLTV ?? DEFAULTS.refinance.ltv,
    newMortgageInterestRatePA: params.refinance?.newMortgageInterestRatePA ?? DEFAULTS.refinance.newMortgageInterestRatePA,
    btlProductFee: params.refinance?.btlProductFee,
    rollBtlFeeIntoMortgage: params.refinance?.rollBtlFeeIntoMortgage ?? true,
  };

  const income: IncomeInputs = {
    useLHA: params.income?.useLHA ?? DEFAULTS.income.useLHA,
    lhaSharedRateMonthly: params.income?.lhaSharedRateMonthly ?? DEFAULTS.income.lhaSharedRateMonthly,
    marketRentPerRoomMonthly: params.income?.marketRentPerRoomMonthly ?? DEFAULTS.income.marketRentPerRoomMonthly,
    occupancyRate: params.income?.occupancyRate ?? DEFAULTS.income.occupancyRate,
    otherIncomeMonthly: params.income?.otherIncomeMonthly ?? DEFAULTS.income.otherIncomeMonthly,
  };

  const opex: OperatingCostsInputs = {
    managementPct: params.opex?.managementPct ?? DEFAULTS.opex.managementPct,
    maintenancePct: params.opex?.maintenancePct ?? DEFAULTS.opex.maintenancePct,
    insurancePA: params.opex?.insurancePA ?? DEFAULTS.opex.insurancePA,
    billsMonthly: params.opex?.billsMonthly ?? DEFAULTS.opex.billsMonthly,
    councilTaxMonthly: params.opex?.councilTaxMonthly ?? DEFAULTS.opex.councilTaxMonthly,
    licensePA: params.opex?.licensePA ?? DEFAULTS.opex.licensePA,
    otherOpexPA: params.opex?.otherOpexPA ?? DEFAULTS.opex.otherOpexPA,
  };

  return { purchase, refinance, income, opex };
}

// ----------------------------- Example (remove in production) -----------------------------
// Example usage (ts-node or in unit tests):
// const inputs = makeDefaultInputs({
//   purchasePrice: 300_000,
//   bedrooms: 6,
//   refinance: { upliftPct: 0.3 }, // 30% uplift -> ARV
//   income: { useLHA: true, lhaSharedRateMonthly: 450 },
// });
// const result = calculateHmoDeal(inputs);
// console.log(JSON.stringify(result, null, 2));
