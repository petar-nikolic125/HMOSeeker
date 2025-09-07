import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Extract clean address from property description after "for sale"
 * Removes property type information like "3 bed attached house"
 * 
 * @param description - Full property description
 * @returns Clean address string or original if no "for sale" found
 * 
 * @example
 * extractAddressAfterForSale("3 bed attached house for sale 123 Main Street, London SW1A 1AA")
 * // Returns: "123 Main Street, London SW1A 1AA"
 * 
 * extractAddressAfterForSale("4 bed detached house for sale Wayne Close, Orpington BR6")
 * // Returns: "Wayne Close, Orpington BR6"
 */
export function extractAddressAfterForSale(description: string): string {
  if (!description || typeof description !== 'string') {
    return description || '';
  }
  
  // Find "for sale" position (case insensitive)
  const forSaleRegex = /\bfor\s+sale\s+/i;
  const forSaleMatch = description.match(forSaleRegex);
  
  if (!forSaleMatch) {
    // If no "for sale" found, return original description
    return description;
  }
  
  // Extract everything after "for sale"
  const afterForSale = description.substring(forSaleMatch.index! + forSaleMatch[0].length);
  
  // Clean up the address string
  return afterForSale.trim();
}
