/**
 * Property Size Predictor
 * Estimates property area in square meters when not available from listings
 */

interface PropertySizePredictionParams {
  bedrooms: number;
  bathrooms?: number;
  receptions?: number;
  price: number;
  city: string;
  propertyType?: string;
  address?: string;
}

interface PropertySizePrediction {
  predictedSqm: number;
  predictedSqft: number;
  sqmRange: { min: number; max: number };
  sqftRange: { min: number; max: number };
  confidence: 'low' | 'medium' | 'high';
  basis: string;
}

/**
 * UK property size averages by bedrooms (in square meters)
 * Based on government data and property surveys
 */
const UK_AVERAGE_SIZES: Record<number, { min: number; avg: number; max: number }> = {
  1: { min: 35, avg: 45, max: 60 },    // 1 bed: 375-650 sqft
  2: { min: 55, avg: 70, max: 85 },    // 2 bed: 590-915 sqft  
  3: { min: 75, avg: 93, max: 120 },   // 3 bed: 810-1290 sqft
  4: { min: 110, avg: 130, max: 160 }, // 4 bed: 1180-1720 sqft
  5: { min: 140, avg: 165, max: 200 }, // 5 bed: 1505-2150 sqft
  6: { min: 180, avg: 220, max: 280 }  // 6+ bed: 1935-3015 sqft
};

/**
 * Regional multipliers based on typical property sizes
 */
const REGIONAL_MULTIPLIERS: Record<string, number> = {
  // London properties tend to be smaller due to space constraints
  'london': 0.85,
  'central london': 0.75,
  'inner london': 0.80,
  'outer london': 0.90,
  
  // Major cities - slightly smaller than national average
  'manchester': 0.95,
  'birmingham': 0.95,
  'leeds': 0.95,
  'liverpool': 0.95,
  'bristol': 0.90,
  'edinburgh': 0.90,
  'glasgow': 0.95,
  'newcastle': 1.05,
  'sheffield': 1.05,
  'nottingham': 1.00,
  
  // Smaller cities and towns - typically larger properties
  'bradford': 1.10,
  'hull': 1.15,
  'kingston upon hull': 1.15,
  'preston': 1.10,
  'blackpool': 1.15,
  'stoke': 1.15,
  'plymouth': 1.05,
  'derby': 1.10,
  'wolverhampton': 1.10,
  'coventry': 1.05,
  'leicester': 1.00,
  
  // Home counties and expensive areas
  'oxford': 0.85,
  'cambridge': 0.85,
  'bath': 0.90,
  'brighton': 0.85,
  'reading': 0.90,
  'guildford': 0.85,
  'st albans': 0.85,
  'winchester': 0.90,
  
  // Default for other areas
  'default': 1.00
};

/**
 * Property type modifiers with range variations
 */
const PROPERTY_TYPE_MODIFIERS: Record<string, { base: number; variance: number }> = {
  'terraced': { base: 0.95, variance: 0.12 },
  'terrace': { base: 0.95, variance: 0.12 },
  'semi-detached': { base: 1.05, variance: 0.15 },
  'semi': { base: 1.05, variance: 0.15 },
  'detached': { base: 1.25, variance: 0.20 },
  'house': { base: 1.00, variance: 0.15 },
  'flat': { base: 0.75, variance: 0.10 },
  'apartment': { base: 0.70, variance: 0.08 },
  'maisonette': { base: 0.85, variance: 0.12 },
  'bungalow': { base: 1.15, variance: 0.18 },
  'cottage': { base: 0.90, variance: 0.15 },
  'townhouse': { base: 0.95, variance: 0.12 },
  'end terrace': { base: 1.00, variance: 0.12 },
  'mid terrace': { base: 0.95, variance: 0.10 }
};

/**
 * Price-based adjustments (higher price often means more space)
 */
function getPriceModifier(price: number, city: string): number {
  const cityLower = city.toLowerCase();
  
  // London has different price brackets due to higher property values
  if (cityLower.includes('london')) {
    if (price > 800000) return 1.3;
    if (price > 600000) return 1.15;
    if (price > 400000) return 1.0;
    if (price > 250000) return 0.9;
    return 0.8;
  }
  
  // Other major cities
  if (['manchester', 'birmingham', 'bristol', 'edinburgh', 'oxford', 'cambridge'].some(c => cityLower.includes(c))) {
    if (price > 500000) return 1.25;
    if (price > 300000) return 1.1;
    if (price > 200000) return 1.0;
    if (price > 150000) return 0.9;
    return 0.8;
  }
  
  // Other areas
  if (price > 400000) return 1.3;
  if (price > 250000) return 1.15;
  if (price > 180000) return 1.05;
  if (price > 120000) return 0.95;
  return 0.85;
}

/**
 * Extract number of receptions from title or address
 */
function extractReceptionsFromText(title: string, address: string): number | undefined {
  const text = `${title} ${address}`.toLowerCase();
  
  // Look for reception room patterns
  const receptionPatterns = [
    /(\d+)\s*reception/i,
    /(\d+)\s*rec\b/i,
    /(\d+)\s*living\s*room/i,
    /(\d+)\s*lounge/i,
    /reception\s*x\s*(\d+)/i,
    /(\d+)\s*public\s*room/i
  ];
  
  for (const pattern of receptionPatterns) {
    const match = text.match(pattern);
    if (match) {
      const count = parseInt(match[1]);
      if (count > 0 && count <= 10) { // Reasonable bounds
        return count;
      }
    }
  }
  
  // Default assumption based on bedrooms (if we can extract that)
  const bedroomMatch = text.match(/(\d+)\s*bed/i);
  if (bedroomMatch) {
    const bedrooms = parseInt(bedroomMatch[1]);
    if (bedrooms >= 3) return 2; // 3+ bed properties often have 2 receptions
    if (bedrooms >= 2) return 1; // 2 bed properties often have 1 reception
  }
  
  return undefined; // Can't determine
}

/**
 * Extract property type from title or address with enhanced detection
 */
function extractPropertyType(title: string, address: string): string {
  const text = `${title} ${address}`.toLowerCase();
  
  // Enhanced property type detection patterns
  const typePatterns = [
    { pattern: /\bdetached\s+house\b|\bdetached\s+home\b|\bdetached\s+property\b|\bdetached\b/, type: 'detached' },
    { pattern: /\bsemi[-\s]?detached\b|\bsemi\s+detached\b/, type: 'semi-detached' },
    { pattern: /\bterraced\s+house\b|\bterrace\s+house\b|\bterraced\b|\bterrace\b/, type: 'terraced' },
    { pattern: /\bend\s+terrace\b|\bend\s+of\s+terrace\b/, type: 'end terrace' },
    { pattern: /\bmid\s+terrace\b|\bmiddle\s+terrace\b/, type: 'mid terrace' },
    { pattern: /\bflat\b|\bapartment\b/, type: 'flat' },
    { pattern: /\bmaisonette\b/, type: 'maisonette' },
    { pattern: /\bbungalow\b/, type: 'bungalow' },
    { pattern: /\bcottage\b/, type: 'cottage' },
    { pattern: /\btownhouse\b|\btown\s+house\b/, type: 'townhouse' }
  ];
  
  for (const { pattern, type } of typePatterns) {
    if (pattern.test(text)) {
      return type;
    }
  }
  
  return 'house'; // default assumption
}

/**
 * Get regional multiplier for the city
 */
function getRegionalMultiplier(city: string): number {
  const cityLower = city.toLowerCase();
  
  // Check for exact matches first
  if (REGIONAL_MULTIPLIERS[cityLower]) {
    return REGIONAL_MULTIPLIERS[cityLower];
  }
  
  // Check for partial matches
  for (const [region, multiplier] of Object.entries(REGIONAL_MULTIPLIERS)) {
    if (cityLower.includes(region) || region.includes(cityLower)) {
      return multiplier;
    }
  }
  
  return REGIONAL_MULTIPLIERS.default;
}

/**
 * Main prediction function with enhanced range calculations
 */
export function predictPropertySize(params: PropertySizePredictionParams): PropertySizePrediction {
  const { bedrooms, bathrooms, receptions, price, city, propertyType, address } = params;
  
  // Get base size for bedroom count
  const bedroomCount = Math.min(Math.max(bedrooms, 1), 6);
  const baseSizes = UK_AVERAGE_SIZES[bedroomCount] || UK_AVERAGE_SIZES[3];
  
  // Start with average size for calculations
  let predictedSqm = baseSizes.avg;
  let minSqm = baseSizes.min;
  let maxSqm = baseSizes.max;
  
  // Apply regional multiplier
  const regionalMultiplier = getRegionalMultiplier(city);
  predictedSqm *= regionalMultiplier;
  minSqm *= regionalMultiplier;
  maxSqm *= regionalMultiplier;
  
  // Apply price modifier
  const priceModifier = getPriceModifier(price, city);
  predictedSqm *= priceModifier;
  minSqm *= (priceModifier * 0.85); // Price affects range
  maxSqm *= (priceModifier * 1.15);
  
  // Apply property type modifier with variance
  const detectedType = propertyType || extractPropertyType(address || '', address || '');
  const typeConfig = PROPERTY_TYPE_MODIFIERS[detectedType] || { base: 1.0, variance: 0.15 };
  
  predictedSqm *= typeConfig.base;
  minSqm *= (typeConfig.base - typeConfig.variance);
  maxSqm *= (typeConfig.base + typeConfig.variance);
  
  // Bathroom adjustment (more bathrooms usually means larger property)
  if (bathrooms && bathrooms > 1) {
    const bathroomBonus = Math.min((bathrooms - 1) * 0.1, 0.3); // Max 30% bonus
    predictedSqm *= (1 + bathroomBonus);
    minSqm *= (1 + bathroomBonus * 0.5);
    maxSqm *= (1 + bathroomBonus * 1.2);
  }
  
  // Reception room adjustment (living areas add significant space)
  if (receptions && receptions > 0) {
    const receptionBonus = Math.min(receptions * 0.08, 0.25); // Max 25% bonus
    predictedSqm *= (1 + receptionBonus);
    minSqm *= (1 + receptionBonus * 0.6);
    maxSqm *= (1 + receptionBonus * 1.3);
  }
  
  // Ensure reasonable bounds and prevent ranges from being too narrow or wide
  const absoluteMinimum = baseSizes.min * 0.7;
  const absoluteMaximum = baseSizes.max * 2.0;
  
  minSqm = Math.max(minSqm, absoluteMinimum);
  maxSqm = Math.min(maxSqm, absoluteMaximum);
  predictedSqm = Math.max(predictedSqm, minSqm);
  predictedSqm = Math.min(predictedSqm, maxSqm);
  
  // Ensure minimum range spread of 20 sqm
  if (maxSqm - minSqm < 20) {
    const center = (minSqm + maxSqm) / 2;
    minSqm = center - 10;
    maxSqm = center + 10;
  }
  
  // Round to reasonable precision
  predictedSqm = Math.round(predictedSqm);
  minSqm = Math.round(minSqm);
  maxSqm = Math.round(maxSqm);
  
  // Convert to square feet (1 sqm = 10.764 sqft)
  const predictedSqft = Math.round(predictedSqm * 10.764);
  const minSqft = Math.round(minSqm * 10.764);
  const maxSqft = Math.round(maxSqm * 10.764);
  
  // Determine confidence level
  let confidence: 'low' | 'medium' | 'high' = 'medium';
  
  if (propertyType && bathrooms && bathrooms > 0 && receptions && receptions > 0) {
    confidence = 'high'; // Have comprehensive data points
  } else if (propertyType && (bathrooms || receptions)) {
    confidence = 'medium'; // Have some good data points
  } else {
    confidence = 'low'; // Limited data
  }
  
  // Create basis explanation
  const factors = [];
  factors.push(`${bedrooms} bedrooms`);
  if (bathrooms) factors.push(`${bathrooms} bathrooms`);
  if (receptions) factors.push(`${receptions} receptions`);
  factors.push(`${city} area`);
  if (detectedType !== 'house') factors.push(`${detectedType} type`);
  
  const basis = `Based on ${factors.join(', ')} and UK property averages`;
  
  return {
    predictedSqm,
    predictedSqft,
    sqmRange: { min: minSqm, max: maxSqm },
    sqftRange: { min: minSqft, max: maxSqft },
    confidence,
    basis
  };
}

/**
 * Convenience function for use in property processing
 */
export function addSizePrediction(property: any): any {
  // Only predict if area is missing or zero
  if (property.area_sqm && property.area_sqm > 0) {
    return property;
  }
  
  const prediction = predictPropertySize({
    bedrooms: property.bedrooms || 3,
    bathrooms: property.bathrooms,
    receptions: property.receptions || extractReceptionsFromText(property.title || '', property.address || ''),
    price: property.price || 200000,
    city: property.city || 'UK',
    propertyType: property.property_type,
    address: property.address || property.title || ''
  });
  
  return {
    ...property,
    predicted_sqm: prediction.predictedSqm,
    predicted_sqft: prediction.predictedSqft,
    sqm_range_min: prediction.sqmRange.min,
    sqm_range_max: prediction.sqmRange.max,
    sqft_range_min: prediction.sqftRange.min,
    sqft_range_max: prediction.sqftRange.max,
    size_prediction_confidence: prediction.confidence,
    size_prediction_basis: prediction.basis,
    area_estimated: true
  };
}