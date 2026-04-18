/**
 * Application state — represents one property investment being evaluated.
 * All monetary values in SEK. All rates as percentages (e.g. 3.5 for 3.5%).
 *
 * @typedef {Object} AppState
 * @property {number}  currentStep
 * @property {string|null} propertyType
 * @property {string}  propertyName
 * @property {number}  purchasePrice
 * @property {boolean} isNewBuild
 * @property {Array<{lbl: string, url: string}>} propertyLinks
 * @property {number}  taxeringsvarde
 * @property {number}  existingPantbrev
 * @property {number}  monthlyManavgift
 * @property {number}  monthlyDriftkostnad
 * @property {number}  monthlyGaFee
 * @property {number}  annualHusRunningCosts
 * @property {number}  monthlyInsurance
 * @property {number}  monthlyWater
 * @property {number}  monthlyElectricity
 * @property {number}  monthlyHeating
 * @property {number}  monthlyOtherCosts
 * @property {number}  monthlyRent
 * @property {number}  monthlyUtilityReimbursement
 * @property {number}  andrahandAvgiftAnnual
 * @property {number}  bostadsrattPantsattning
 * @property {number}  bostadsrattOverlatelseAvgift
 * @property {number}  downPayment
 * @property {number}  newMortgageInterestRate
 * @property {number}  newMortgageAmortizationRate
 * @property {boolean} hasAlt2
 * @property {number}  alt2ExtraLoan
 * @property {number}  alt2InterestRate
 * @property {number}  alt2AmortizationRate
 * @property {number}  alt2ExistingApartmentValue
 * @property {number}  alt2ExistingApartmentLoan
 * @property {boolean} hasAlt3
 * @property {number}  alt3ExtraLoan
 * @property {number}  alt3InterestRate
 * @property {number}  alt3AmortizationRate
 * @property {number}  alt3ExistingApartmentValue
 * @property {number}  alt3ExistingApartmentLoan
 * @property {number|null} lagfartOverride
 * @property {number|null} pantbrevAlt1Override
 * @property {number|null} pantbrevAlt2Override
 * @property {number|null} pantbrevAlt3Override
 * @property {number}  expectedAppreciationRate
 * @property {number}  alternativeReturnRate
 * @property {string}  sessionName
 */

/**
 * Create a fresh default state object with all fields initialized.
 *
 * @returns {AppState}
 */
export function createDefaultState() {
  return {
    // Wizard navigation
    currentStep: 0,

    // Property identity
    propertyType: null,          // 'agarlagenhet' | 'bostadsratt' | 'hus'
    propertyName: '',
    purchasePrice: 0,
    isNewBuild: true,
    propertyLinks: [],

    // Property-type-specific
    taxeringsvarde: 0,           // hus: actual value from Lantmäteriet/Skatteverket
    existingPantbrev: 0,         // hus + ägarlägenhet: existing pantbrev on property

    // Monthly costs — BRF / GA
    monthlyManavgift: 0,         // bostadsrätt BRF fee
    monthlyDriftkostnad: 0,      // bostadsrätt additional running costs
    monthlyGaFee: 0,             // ägarlägenhet GA/samfällighet
    annualHusRunningCosts: 0,    // hus/villa: annual driftkostnad

    // Monthly costs — utilities (all types)
    monthlyInsurance: 0,
    monthlyWater: 0,
    monthlyElectricity: 0,
    monthlyHeating: 0,
    monthlyOtherCosts: 0,

    // Rental income
    monthlyRent: 0,
    monthlyUtilityReimbursement: 0,
    andrahandAvgiftAnnual: 5880, // bostadsrätt subletting fee (kr/yr)

    // Bostadsrätt one-time purchase costs
    bostadsrattPantsattning: 0,
    bostadsrattOverlatelseAvgift: 0,

    // Financing — Alt 1: new bank loan
    downPayment: 0,
    newMortgageInterestRate: 0,
    newMortgageAmortizationRate: 0,

    // Financing — Alt 2: large existing apartment top-up
    hasAlt2: false,
    alt2ExtraLoan: 0,
    alt2InterestRate: 0,
    alt2AmortizationRate: 0,
    alt2ExistingApartmentValue: 0,
    alt2ExistingApartmentLoan: 0,

    // Financing — Alt 3: small existing apartment top-up
    hasAlt3: false,
    alt3ExtraLoan: 0,
    alt3InterestRate: 0,
    alt3AmortizationRate: 0,
    alt3ExistingApartmentValue: 0,
    alt3ExistingApartmentLoan: 0,

    // One-time cost overrides (null = use formula)
    lagfartOverride: null,
    pantbrevAlt1Override: null,
    pantbrevAlt2Override: null,
    pantbrevAlt3Override: null,

    // Advanced analysis (optional)
    expectedAppreciationRate: 0,
    alternativeReturnRate: 0,

    // Session metadata
    sessionName: '',
  };
}

/**
 * The single mutable application state object.
 * All modules read from and write to this object.
 */
export const appState = createDefaultState();

/**
 * Reset the application state to defaults, preserving no fields.
 * Used when starting a new calculation.
 */
export function resetState() {
  Object.assign(appState, createDefaultState());
}
