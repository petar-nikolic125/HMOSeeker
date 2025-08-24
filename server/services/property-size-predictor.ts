/**
 * Property Size Predictor
 * Estimates property area in square meters when not available from listings
 */

interface PropertySizePredictionParams {
  bedrooms: number;
  bathrooms?: number;
  price: number;
  city: string;
  propertyType?: string;
  address?: string;
}

interface PropertySizePrediction {
  predictedSqm: number;
  predictedSqft: number;
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
 * Property type modifiers
 */
const PROPERTY_TYPE_MODIFIERS: Record<string, number> = {
  'terraced': 0.95,
  'terrace': 0.95,
  'semi-detached': 1.05,
  'semi': 1.05,
  'detached': 1.25,
  'house': 1.00,
  'flat': 0.75,
  'apartment': 0.70,
  'maisonette': 0.85,
  'bungalow': 1.15,
  'cottage': 0.90,
  'townhouse': 0.95,
  'end terrace': 1.00,
  'mid terrace': 0.95
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
 * Extract property type from title or address
 */
function extractPropertyType(title: string, address: string): string {
  const text = `${title} ${address}`.toLowerCase();
  
  for (const [type, _] of Object.entries(PROPERTY_TYPE_MODIFIERS)) {
    if (text.includes(type)) {
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
 * Main prediction function
 */
export function predictPropertySize(params: PropertySizePredictionParams): PropertySizePrediction {
  const { bedrooms, bathrooms, price, city, propertyType, address } = params;
  
  // Get base size for bedroom count
  const bedroomCount = Math.min(Math.max(bedrooms, 1), 6);
  const baseSizes = UK_AVERAGE_SIZES[bedroomCount] || UK_AVERAGE_SIZES[3];
  
  // Start with average size
  let predictedSqm = baseSizes.avg;
  
  // Apply regional multiplier
  const regionalMultiplier = getRegionalMultiplier(city);
  predictedSqm *= regionalMultiplier;
  
  // Apply price modifier
  const priceModifier = getPriceModifier(price, city);
  predictedSqm *= priceModifier;
  
  // Apply property type modifier
  const detectedType = propertyType || extractPropertyType(address || '', address || '');
  const typeModifier = PROPERTY_TYPE_MODIFIERS[detectedType] || 1.0;
  predictedSqm *= typeModifier;
  
  // Bathroom adjustment (more bathrooms usually means larger property)
  if (bathrooms && bathrooms > 1) {
    const bathroomBonus = Math.min((bathrooms - 1) * 0.1, 0.3); // Max 30% bonus
    predictedSqm *= (1 + bathroomBonus);
  }
  
  // Ensure reasonable bounds
  predictedSqm = Math.max(predictedSqm, baseSizes.min);
  predictedSqm = Math.min(predictedSqm, baseSizes.max * 1.5); // Allow some flexibility above max
  
  // Round to reasonable precision
  predictedSqm = Math.round(predictedSqm);
  
  // Convert to square feet (1 sqm = 10.764 sqft)
  const predictedSqft = Math.round(predictedSqm * 10.764);
  
  // Determine confidence level
  let confidence: 'low' | 'medium' | 'high' = 'medium';
  
  if (propertyType && bathrooms && bathrooms > 0) {
    confidence = 'high'; // Have good data points
  } else if (!propertyType && !bathrooms) {
    confidence = 'low'; // Limited data
  }
  
  // Create basis explanation
  const factors = [];
  factors.push(`${bedrooms} bedrooms`);
  if (bathrooms) factors.push(`${bathrooms} bathrooms`);
  factors.push(`${city} area`);
  if (detectedType !== 'house') factors.push(`${detectedType} type`);
  
  const basis = `Based on ${factors.join(', ')} and UK property averages`;
  
  return {
    predictedSqm,
    predictedSqft,
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
    price: property.price || 200000,
    city: property.city || 'UK',
    propertyType: property.property_type,
    address: property.address || property.title || ''
  });
  
  return {
    ...property,
    predicted_sqm: prediction.predictedSqm,
    predicted_sqft: prediction.predictedSqft,
    size_prediction_confidence: prediction.confidence,
    size_prediction_basis: prediction.basis,
    area_estimated: true
  };
}