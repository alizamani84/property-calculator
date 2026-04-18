/**
 * Pure calculation engine for Swedish property investment analysis.
 * No DOM access, no side effects — safe to import in Node.js tests.
 */

import * as TaxRules from './swedish-tax-rules.js';

/**
 * @typedef {'agarlagenhet' | 'bostadsratt' | 'hus'} PropertyType
 */

/**
 * Inputs for a single property investment calculation.
 * All monetary values are in SEK. Rates are percentages (e.g. 3.5 for 3.5%).
 *
 * @typedef {Object} PropertyInvestmentInputs
 * @property {PropertyType} propertyType
 * @property {number}  purchasePrice
 * @property {boolean} isNewBuild                    - true = fastighetsavgift exempt (first 15 yrs)
 * @property {number}  downPayment
 * @property {number}  newMortgageInterestRate        - % per year
 * @property {number}  newMortgageAmortizationRate    - % per year
 * @property {number}  monthlyRent
 * @property {number}  monthlyUtilityReimbursement    - paid by tenant on top of rent
 *
 * @property {number}  monthlyGaFee                  - ägarlägenhet GA/samfällighet fee
 * @property {number}  monthlyManavgift               - bostadsrätt BRF monthly fee
 * @property {number}  monthlyDriftkostnad            - bostadsrätt extra running cost
 * @property {number}  annualHusRunningCosts          - hus/villa annual driftkostnad
 * @property {number}  taxeringsvarde                 - hus: actual taxeringsvärde (0 = use estimate)
 * @property {number}  existingPantbrev               - existing pantbrev on property (SEK)
 *
 * @property {number}  monthlyInsurance
 * @property {number}  monthlyWater
 * @property {number}  monthlyElectricity
 * @property {number}  monthlyHeating
 * @property {number}  monthlyOtherCosts
 *
 * @property {number}  andrahandAvgiftAnnual          - bostadsrätt subletting fee SEK/yr
 *
 * @property {number}  bostadsrattPantsattning        - one-time BRF pledge fee
 * @property {number}  bostadsrattOverlatelseAvgift   - one-time BRF transfer fee
 *
 * @property {number|null} lagfartOverride            - null = use formula
 * @property {number|null} pantbrevOverride           - null = use formula
 *
 * @property {number}  extraLoanAmount               - Alt 2/3: extra loan from existing apartment
 * @property {number}  extraLoanInterestRate         - % per year
 * @property {number}  extraLoanAmortizationRate     - % per year
 *
 * @property {number}  expectedAppreciationRate      - % per year (optional)
 * @property {number}  alternativeReturnRate         - % per year opportunity cost (optional)
 */

/**
 * Results for one financing scenario.
 *
 * @typedef {Object} ScenarioResults
 * @property {number} newMortgage
 * @property {number} loanToValueRatio             - as decimal, e.g. 0.72
 * @property {number} pantbrevCost
 * @property {number} lagfartCost
 * @property {number} totalCapitalInvested
 * @property {number} monthlyInterestOnNewMortgage
 * @property {number} monthlyInterestOnExtraLoan
 * @property {number} monthlyAmortizationOnNewMortgage
 * @property {number} monthlyAmortizationOnExtraLoan
 * @property {number} monthlyOwnershipCost         - all recurring property costs excl. bank payments
 * @property {number} monthlyAndrahandAvgift
 * @property {number} monthlyCashFlow              - before tax adjustment
 * @property {number} annualGrossRentalIncome
 * @property {number} annualSchablonavdragVariable
 * @property {number} annualRentalTaxableSurplus
 * @property {number} annualRentalTax
 * @property {number} annualRanteavdrag
 * @property {number} annualReturnAfterTax
 * @property {number} monthlyTakeHome
 * @property {number} returnOnInvestedCapitalPct   - ROI
 * @property {number} leveredReturnOnPropertyPct   - levered return on property value
 * @property {number} direktavkastningPct          - cap rate, financing-independent
 * @property {number} grossRentalYieldPct
 * @property {number} annualAppreciationValue      - 0 if no rate given
 * @property {number} annualOpportunityCost        - 0 if no rate given
 * @property {number} trueEconomicReturn           - annualReturn + appreciation - opportunityCost
 */

/**
 * Calculate one financing scenario for a Swedish rental property investment.
 * Pure function — no DOM access, no side effects.
 *
 * @param {PropertyInvestmentInputs} inputs
 * @returns {ScenarioResults}
 */
export function calculateScenario(inputs) {
  const isBostadsratt  = inputs.propertyType === 'bostadsratt';
  const isHus          = inputs.propertyType === 'hus';
  const isAgarlagenhet = inputs.propertyType === 'agarlagenhet';

  // ── Fastighetsavgift ──────────────────────────────────────────────
  const annualFastighetsavgift = calculateFastighetsavgift(inputs, isHus, isBostadsratt);
  const monthlyFastighetsavgift = Math.round(annualFastighetsavgift / 12);

  // ── Monthly ownership cost (recurring, excl. bank payments) ──────
  const monthlyHusDriftkostnad = isHus ? Math.round((inputs.annualHusRunningCosts || 0) / 12) : 0;
  const monthlyFastighetsavgiftForAgarlagenhet = calculateAgarlagenhetFastighetsavgift(inputs, isAgarlagenhet);

  const monthlyOwnershipCost =
    (isBostadsratt ? (inputs.monthlyManavgift || 0) + (inputs.monthlyDriftkostnad || 0)
     : isHus       ? monthlyHusDriftkostnad + monthlyFastighetsavgift
                   : (inputs.monthlyGaFee || 0) + monthlyFastighetsavgiftForAgarlagenhet)
    + (inputs.monthlyInsurance   || 0)
    + (inputs.monthlyWater       || 0)
    + (inputs.monthlyElectricity || 0)
    + (inputs.monthlyHeating     || 0)
    + (inputs.monthlyOtherCosts  || 0);

  const monthlyAndrahandAvgift = isBostadsratt
    ? Math.round((inputs.andrahandAvgiftAnnual || TaxRules.DEFAULT_ANDRAHAND_AVGIFT_SEK) / 12)
    : 0;

  // ── One-time costs ────────────────────────────────────────────────
  const lagfartCost = calculateLagfart(inputs, isBostadsratt);

  const newMortgage = Math.max(0, inputs.purchasePrice - inputs.downPayment - (inputs.extraLoanAmount || 0));

  const pantbrevCost = calculatePantbrev(newMortgage, inputs, isBostadsratt);

  const bostadsrattOneTimeCosts = isBostadsratt
    ? (inputs.bostadsrattPantsattning || 0) + (inputs.bostadsrattOverlatelseAvgift || 0)
    : 0;

  const totalCapitalInvested = isBostadsratt
    ? inputs.downPayment + bostadsrattOneTimeCosts
    : inputs.downPayment + lagfartCost + pantbrevCost;

  // ── Monthly bank payments ─────────────────────────────────────────
  const monthlyInterestOnNewMortgage     = Math.round(newMortgage * (inputs.newMortgageInterestRate  / 100) / 12);
  const monthlyAmortizationOnNewMortgage = Math.round(newMortgage * (inputs.newMortgageAmortizationRate / 100) / 12);

  const extraLoan = inputs.extraLoanAmount || 0;
  const monthlyInterestOnExtraLoan     = extraLoan > 0 ? Math.round(extraLoan * (inputs.extraLoanInterestRate     / 100) / 12) : 0;
  const monthlyAmortizationOnExtraLoan = extraLoan > 0 ? Math.round(extraLoan * (inputs.extraLoanAmortizationRate / 100) / 12) : 0;

  // ── Rental income & tax ───────────────────────────────────────────
  const monthlyTotalIncome    = (inputs.monthlyRent || 0) + (inputs.monthlyUtilityReimbursement || 0);
  const annualGrossRentalIncome = monthlyTotalIncome * 12;

  const annualSchablonavdragVariable = calculateSchablonavdragVariable(inputs, isBostadsratt, annualGrossRentalIncome);
  const annualRentalTaxableSurplus   = Math.max(0, annualGrossRentalIncome - TaxRules.SCHABLONAVDRAG_FIXED_SEK - annualSchablonavdragVariable);
  const annualRentalTax              = Math.round(annualRentalTaxableSurplus * TaxRules.RENTAL_INCOME_TAX_RATE);

  // ── Ränteavdrag ───────────────────────────────────────────────────
  const annualTotalInterest = (monthlyInterestOnNewMortgage + monthlyInterestOnExtraLoan) * 12;
  const annualRanteavdrag   = calculateRanteavdrag(annualTotalInterest);

  // ── Monthly cash flow & annual return ────────────────────────────
  const monthlyCashFlow = monthlyTotalIncome
    - monthlyOwnershipCost
    - monthlyAndrahandAvgift
    - monthlyInterestOnNewMortgage
    - monthlyInterestOnExtraLoan
    - monthlyAmortizationOnNewMortgage
    - monthlyAmortizationOnExtraLoan;

  const annualReturnAfterTax = monthlyCashFlow * 12 - annualRentalTax + annualRanteavdrag;
  const monthlyTakeHome      = annualReturnAfterTax / 12;

  // ── Performance metrics ───────────────────────────────────────────
  const price = inputs.purchasePrice || 1; // avoid division by zero
  const grossRentalYieldPct        = annualGrossRentalIncome / price * 100;
  const direktavkastningPct        = (annualGrossRentalIncome - monthlyOwnershipCost * 12 - monthlyAndrahandAvgift * 12 - annualRentalTax) / price * 100;
  const leveredReturnOnPropertyPct = annualReturnAfterTax / price * 100;
  const returnOnInvestedCapitalPct = totalCapitalInvested > 0 ? annualReturnAfterTax / totalCapitalInvested * 100 : 0;

  // ── Advanced: appreciation & opportunity cost ─────────────────────
  const annualAppreciationValue = inputs.purchasePrice * (inputs.expectedAppreciationRate  || 0) / 100;
  const annualOpportunityCost   = totalCapitalInvested  * (inputs.alternativeReturnRate || 0) / 100;
  const trueEconomicReturn      = annualReturnAfterTax + annualAppreciationValue - annualOpportunityCost;

  return {
    newMortgage,
    loanToValueRatio:                 inputs.purchasePrice > 0 ? newMortgage / inputs.purchasePrice : 0,
    pantbrevCost,
    lagfartCost,
    totalCapitalInvested,
    monthlyInterestOnNewMortgage,
    monthlyInterestOnExtraLoan,
    monthlyAmortizationOnNewMortgage,
    monthlyAmortizationOnExtraLoan,
    monthlyOwnershipCost,
    monthlyAndrahandAvgift,
    monthlyCashFlow,
    annualGrossRentalIncome,
    annualSchablonavdragVariable,
    annualRentalTaxableSurplus,
    annualRentalTax,
    annualRanteavdrag,
    annualReturnAfterTax,
    monthlyTakeHome,
    returnOnInvestedCapitalPct,
    leveredReturnOnPropertyPct,
    direktavkastningPct,
    grossRentalYieldPct,
    annualFastighetsavgift,
    annualAppreciationValue,
    annualOpportunityCost,
    trueEconomicReturn,
    // pass-through for renderers
    monthlyHusDriftkostnad,
    bostadsrattOneTimeCosts,
    extraLoanAmount: extraLoan,
  };
}

// ── Private helpers ─────────────────────────────────────────────────

/**
 * Calculate annual fastighetsavgift for hus/villa property type.
 * Bostadsrätt: always 0 (included in månadsavgift).
 * Ägarlägenhet: handled separately via estimate in calculateAgarlagenhetFastighetsavgift.
 *
 * @param {PropertyInvestmentInputs} inputs
 * @param {boolean} isHus
 * @param {boolean} isBostadsratt
 * @returns {number} annual fastighetsavgift in SEK
 */
function calculateFastighetsavgift(inputs, isHus, isBostadsratt) {
  if (isBostadsratt) return 0;
  if (inputs.isNewBuild) return 0;
  if (isHus) {
    const taxeringsvarde = inputs.taxeringsvarde || 0;
    return taxeringsvarde > 0
      ? Math.min(Math.round(taxeringsvarde * TaxRules.FASTIGHETSAVGIFT_RATE), TaxRules.FASTIGHETSAVGIFT_CAP_SEK)
      : 0;
  }
  return 0; // ägarlägenhet: handled separately via estimate
}

/**
 * Calculate monthly fastighetsavgift for ägarlägenhet, estimated from purchase price.
 * Uses 75% of purchase price as taxeringsvärde estimate when actual value is unknown.
 *
 * @param {PropertyInvestmentInputs} inputs
 * @param {boolean} isAgarlagenhet
 * @returns {number} monthly fastighetsavgift in SEK
 */
function calculateAgarlagenhetFastighetsavgift(inputs, isAgarlagenhet) {
  if (!isAgarlagenhet || inputs.isNewBuild) return 0;
  const estimatedTaxeringsvarde = inputs.purchasePrice * TaxRules.TAXERINGSVARDE_ESTIMATE_RATE;
  return Math.round(
    Math.min(Math.round(estimatedTaxeringsvarde * TaxRules.FASTIGHETSAVGIFT_RATE), TaxRules.FASTIGHETSAVGIFT_CAP_SEK) / 12
  );
}

/**
 * Calculate lagfart (stamp duty) cost.
 * Bostadsrätt: no lagfart.
 * Override takes precedence over formula if provided.
 *
 * @param {PropertyInvestmentInputs} inputs
 * @param {boolean} isBostadsratt
 * @returns {number} lagfart cost in SEK
 */
function calculateLagfart(inputs, isBostadsratt) {
  if (isBostadsratt) return 0;
  if (inputs.lagfartOverride !== null && inputs.lagfartOverride !== undefined) return inputs.lagfartOverride;
  return Math.round(inputs.purchasePrice * TaxRules.LAGFART_RATE) + TaxRules.LAGFART_FEE_SEK;
}

/**
 * Calculate pantbrev (mortgage deed) registration cost.
 * Bostadsrätt: no pantbrev.
 * Existing pantbrev on the property offset the new pantbrev needed.
 * Override takes precedence over formula if provided.
 *
 * @param {number} newMortgage - the new bank mortgage amount
 * @param {PropertyInvestmentInputs} inputs
 * @param {boolean} isBostadsratt
 * @returns {number} pantbrev cost in SEK
 */
function calculatePantbrev(newMortgage, inputs, isBostadsratt) {
  if (isBostadsratt) return 0;
  if (inputs.pantbrevOverride !== null && inputs.pantbrevOverride !== undefined) return inputs.pantbrevOverride;
  const existingPantbrev = inputs.existingPantbrev || 0;
  const newPantbrevNeeded = Math.max(0, newMortgage - existingPantbrev);
  return newPantbrevNeeded > 0
    ? Math.round(newPantbrevNeeded * TaxRules.PANTBREV_RATE) + TaxRules.PANTBREV_FEE_SEK
    : 0;
}

/**
 * Calculate the variable part of schablonavdrag (rental income deduction).
 * Bostadsrätt: deducts månadsavgift × 12 (instead of 20%).
 * All other types: deducts 20% of gross rental income.
 *
 * @param {PropertyInvestmentInputs} inputs
 * @param {boolean} isBostadsratt
 * @param {number} annualGrossRentalIncome
 * @returns {number} annual variable deduction in SEK
 */
function calculateSchablonavdragVariable(inputs, isBostadsratt, annualGrossRentalIncome) {
  if (isBostadsratt) {
    return (inputs.monthlyManavgift || 0) * 12;
  }
  return annualGrossRentalIncome * TaxRules.SCHABLONAVDRAG_VARIABLE_RATE;
}

/**
 * Swedish ränteavdrag: 30% on annual interest up to 100 000 kr, 21% above.
 *
 * @param {number} annualInterest - total annual interest paid (SEK)
 * @returns {number} annual ränteavdrag credit in SEK
 */
function calculateRanteavdrag(annualInterest) {
  if (annualInterest <= 0) return 0;
  return Math.round(
    Math.min(annualInterest, TaxRules.INTEREST_DEDUCTION_THRESHOLD_SEK) * TaxRules.INTEREST_DEDUCTION_RATE_BELOW_THRESHOLD
    + Math.max(0, annualInterest - TaxRules.INTEREST_DEDUCTION_THRESHOLD_SEK) * TaxRules.INTEREST_DEDUCTION_RATE_ABOVE_THRESHOLD
  );
}

/**
 * Calculate required amortization rate based on LTV (amorteringskravet 2026).
 *
 * @param {number} loanToValueRatio - as decimal (e.g. 0.72)
 * @returns {number} amortization rate as percentage (0, 1, or 2)
 */
export function calculateRequiredAmortizationRate(loanToValueRatio) {
  if (loanToValueRatio >= TaxRules.AMORTIZATION_LTV_THRESHOLD_HIGH) return 2;
  if (loanToValueRatio >= TaxRules.AMORTIZATION_LTV_THRESHOLD_LOW)  return 1;
  return 0;
}

/**
 * Build PropertyInvestmentInputs for a specific financing alternative from app state.
 * Extracts the right fields for Alt 1, 2, or 3.
 *
 * @param {import('../state/app-state.js').AppState} state
 * @param {1|2|3} alternativeNumber
 * @returns {PropertyInvestmentInputs}
 */
export function buildInputsFromState(state, alternativeNumber) {
  const extraLoanAmount = alternativeNumber === 2 ? (state.alt2ExtraLoan || 0)
                        : alternativeNumber === 3 ? (state.alt3ExtraLoan || 0)
                        : 0;
  const extraLoanInterestRate = alternativeNumber === 2 ? (state.alt2InterestRate || 0)
                              : alternativeNumber === 3 ? (state.alt3InterestRate || 0)
                              : 0;
  const extraLoanAmortizationRate = alternativeNumber === 2 ? (state.alt2AmortizationRate || 0)
                                  : alternativeNumber === 3 ? (state.alt3AmortizationRate || 0)
                                  : 0;
  const pantbrevOverride = alternativeNumber === 1 ? state.pantbrevAlt1Override
                         : alternativeNumber === 2 ? state.pantbrevAlt2Override
                         : state.pantbrevAlt3Override;

  return {
    propertyType:                state.propertyType,
    purchasePrice:               state.purchasePrice,
    isNewBuild:                  state.isNewBuild,
    downPayment:                 state.downPayment,
    newMortgageInterestRate:     state.newMortgageInterestRate,
    newMortgageAmortizationRate: state.newMortgageAmortizationRate,
    monthlyRent:                 state.monthlyRent,
    monthlyUtilityReimbursement: state.monthlyUtilityReimbursement,
    monthlyGaFee:                state.monthlyGaFee,
    monthlyManavgift:            state.monthlyManavgift,
    monthlyDriftkostnad:         state.monthlyDriftkostnad,
    annualHusRunningCosts:       state.annualHusRunningCosts,
    taxeringsvarde:              state.taxeringsvarde,
    existingPantbrev:            state.existingPantbrev,
    monthlyInsurance:            state.monthlyInsurance,
    monthlyWater:                state.monthlyWater,
    monthlyElectricity:          state.monthlyElectricity,
    monthlyHeating:              state.monthlyHeating,
    monthlyOtherCosts:           state.monthlyOtherCosts,
    andrahandAvgiftAnnual:       state.andrahandAvgiftAnnual,
    bostadsrattPantsattning:     state.bostadsrattPantsattning,
    bostadsrattOverlatelseAvgift: state.bostadsrattOverlatelseAvgift,
    lagfartOverride:             state.lagfartOverride,
    pantbrevOverride,
    extraLoanAmount,
    extraLoanInterestRate,
    extraLoanAmortizationRate,
    expectedAppreciationRate:    state.expectedAppreciationRate,
    alternativeReturnRate:       state.alternativeReturnRate,
  };
}
