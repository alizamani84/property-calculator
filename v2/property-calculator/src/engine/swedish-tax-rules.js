/**
 * Swedish property tax rules and rates — Income year 2026.
 * Update this file when tax rules change.
 */

export const LAGFART_RATE = 0.015;           // 1.5% of purchase price
export const LAGFART_FEE_SEK = 825;          // fixed expeditionsavgift

export const PANTBREV_RATE = 0.02;           // 2% of new mortgage
export const PANTBREV_FEE_SEK = 375;         // fixed registration fee

export const FASTIGHETSAVGIFT_RATE = 0.0075; // 0.75% of taxeringsvärde
export const FASTIGHETSAVGIFT_CAP_SEK = 10_425; // annual cap, 2026

export const SCHABLONAVDRAG_FIXED_SEK = 40_000;  // fixed annual deduction (rises to 50 000 from 1 July 2026)
export const SCHABLONAVDRAG_VARIABLE_RATE = 0.20; // 20% of gross rent for hus/ägarlägenhet
// Bostadsrätt: variable deduction = månadsavgift × 12 (NOT 20%)

export const RENTAL_INCOME_TAX_RATE = 0.30;  // 30%

export const INTEREST_DEDUCTION_THRESHOLD_SEK = 100_000; // annual interest threshold
export const INTEREST_DEDUCTION_RATE_BELOW_THRESHOLD = 0.30;  // ränteavdrag rate ≤ 100k
export const INTEREST_DEDUCTION_RATE_ABOVE_THRESHOLD = 0.21;  // ränteavdrag rate > 100k

export const MIN_DOWN_PAYMENT_RATE = 0.10;   // 10% minimum (bolånetak 2026)
export const MAX_LTV = 0.90;                 // 90% max LTV (from April 2026)

// Amorteringskravet thresholds
export const AMORTIZATION_LTV_THRESHOLD_LOW  = 0.50; // below 50% LTV → 0%/yr
export const AMORTIZATION_LTV_THRESHOLD_HIGH = 0.70; // below 70% LTV → 1%/yr, above → 2%/yr
export const AMORTIZATION_RATE_NONE   = 0;
export const AMORTIZATION_RATE_LOW    = 0.01; // 1%/yr
export const AMORTIZATION_RATE_HIGH   = 0.02; // 2%/yr

// New-build fastighetsavgift exemption: värdeår >= this year is exempt for 15 years
export const NEW_BUILD_EXEMPTION_YEAR = 2011; // for income year 2026

export const TAXERINGSVARDE_ESTIMATE_RATE = 0.75; // estimated as 75% of purchase price (for ägarlägenhet when actual value unknown)

// Bostadsrätt andrahand default subletting fee
export const DEFAULT_ANDRAHAND_AVGIFT_SEK = 5_880; // per year
