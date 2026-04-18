/**
 * Browser localStorage persistence for saved property calculation sessions.
 * Handles save, load, delete, and autosave of calculation state.
 */

import { appState } from './app-state.js';

/** Storage key for the list of saved sessions. */
const SAVED_SESSIONS_KEY = 'swe-prop-calc-v3';

/** Storage key for autosaved (unsaved) current session. */
const AUTOSAVE_KEY = 'swe-prop-calc-last';

/**
 * Read all saved sessions from localStorage.
 *
 * @returns {Array<{id: number, name: string, savedAt: string, state: Object}>}
 */
export function loadSessions() {
  try {
    return JSON.parse(localStorage.getItem(SAVED_SESSIONS_KEY) || '[]');
  } catch {
    return [];
  }
}

/**
 * Write the full sessions array back to localStorage.
 *
 * @param {Array<{id: number, name: string, savedAt: string, state: Object}>} sessions
 */
function persistSessions(sessions) {
  localStorage.setItem(SAVED_SESSIONS_KEY, JSON.stringify(sessions));
}

/**
 * Save current state under a given name.
 * If a session with the same name already exists, it is overwritten.
 * Maximum 15 sessions are kept (oldest are dropped when limit exceeded).
 *
 * @param {string} [nameOverride] - optional name; falls back to appState.sessionName or propertyName
 */
export function saveSession(nameOverride) {
  const sessions = loadSessions();
  const sessionName = nameOverride
    || appState.sessionName
    || appState.propertyName
    || ('Beräkning ' + new Date().toLocaleDateString('sv-SE'));

  const entry = {
    id: Date.now(),
    name: sessionName,
    savedAt: new Date().toISOString(),
    state: { ...appState },
  };

  const existingIndex = sessions.findIndex(session => session.name === sessionName);
  if (existingIndex >= 0) {
    sessions[existingIndex] = entry;
  } else {
    sessions.unshift(entry);
    if (sessions.length > 15) sessions.length = 15;
  }

  persistSessions(sessions);
  return sessionName;
}

/**
 * Delete a saved session by its numeric ID.
 *
 * @param {number} sessionId
 */
export function deleteSession(sessionId) {
  persistSessions(loadSessions().filter(session => session.id !== sessionId));
}

/**
 * Autosave the current session state (no name required).
 * This is used for crash recovery — the welcome screen offers to restore it.
 * Cleared when a proper saveSession() is called.
 */
export function autosaveCurrentSession() {
  if (!appState.purchasePrice) return; // nothing worth saving
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({
      ...appState,
      _savedAt: new Date().toISOString(),
    }));
  } catch {
    // localStorage full or unavailable — ignore
  }
}

/**
 * Clear the autosaved session (call after a proper save or after the user dismisses it).
 */
export function clearAutosave() {
  try { localStorage.removeItem(AUTOSAVE_KEY); } catch { /* ignore */ }
}

/**
 * Load the most recently autosaved session, if one exists and has a valid price.
 *
 * @returns {{ _savedAt: string, [key: string]: any }|null}
 */
export function loadAutosavedSession() {
  try {
    const data = JSON.parse(localStorage.getItem(AUTOSAVE_KEY) || 'null');
    return data && data.purchasePrice > 0 ? data : null;
  } catch {
    return null;
  }
}

/**
 * Find a specific saved session by ID.
 *
 * @param {number} sessionId
 * @returns {{ id: number, name: string, savedAt: string, state: Object }|undefined}
 */
export function findSession(sessionId) {
  return loadSessions().find(session => session.id === sessionId);
}

/**
 * Convert a state object into the canonical v4 structured JSON export format.
 * This format is human-readable and re-importable.
 *
 * @param {Object} state - app state object (may be different from current appState)
 * @param {string} name - session name for the export
 * @param {string|null} savedAt - ISO timestamp (null = use current time)
 * @returns {Object} structured JSON export object
 */
export function serializeStateToExportFormat(state, name, savedAt) {
  return {
    version: 4,
    savedAt: savedAt || new Date().toISOString(),
    name,
    property: {
      name:                   state.propertyName,
      type:                   state.propertyType || 'agarlagenhet',
      purchase_price_sek:     state.purchasePrice,
      fastighetsskatt_exempt: state.isNewBuild,
      links:                  state.propertyLinks,
    },
    monthly_costs: {
      ga_samfallighet_sek:                   state.monthlyGaFee,
      manavgift_sek:                         state.monthlyManavgift,
      driftkostnad_sek:                      state.monthlyDriftkostnad,
      insurance_sek:                         state.monthlyInsurance,
      water_sek:                             state.monthlyWater,
      electricity_sek:                       state.monthlyElectricity,
      heating_sek:                           state.monthlyHeating,
      other_sek:                             state.monthlyOtherCosts,
      utility_reimbursement_from_tenant_sek: state.monthlyUtilityReimbursement,
    },
    rental_income: {
      monthly_rent_sek:        state.monthlyRent,
      andrahand_avgift_yr_sek: state.andrahandAvgiftAnnual,
    },
    bostadsratt_one_time: {
      pantsattning_sek:   state.bostadsrattPantsattning,
      overlatelseAvg_sek: state.bostadsrattOverlatelseAvgift,
    },
    hus_details: {
      taxeringsvarde_sek:    state.taxeringsvarde || 0,
      existing_pantbrev_sek: state.existingPantbrev || 0,
      driftkostnad_yr_sek:   state.annualHusRunningCosts || 0,
    },
    financing: {
      alt1_new_bank_loan: {
        down_payment_sek:  state.downPayment,
        interest_rate_pct: state.newMortgageInterestRate,
        amortization_pct:  state.newMortgageAmortizationRate,
      },
      alt2_large_existing_topup: {
        enabled:                      state.hasAlt2,
        extra_loan_sek:               state.alt2ExtraLoan,
        interest_rate_pct:            state.alt2InterestRate,
        amortization_pct:             state.alt2AmortizationRate,
        existing_apartment_value_sek: state.alt2ExistingApartmentValue,
        existing_apartment_loan_sek:  state.alt2ExistingApartmentLoan,
      },
      alt3_small_existing_topup: {
        enabled:                      state.hasAlt3,
        extra_loan_sek:               state.alt3ExtraLoan,
        interest_rate_pct:            state.alt3InterestRate,
        amortization_pct:             state.alt3AmortizationRate,
        existing_apartment_value_sek: state.alt3ExistingApartmentValue,
        existing_apartment_loan_sek:  state.alt3ExistingApartmentLoan,
      },
    },
    one_time_costs: {
      lagfart_override_sek:      state.lagfartOverride,
      pantbrev_sc1_override_sek: state.pantbrevAlt1Override,
      pantbrev_sc2_override_sek: state.pantbrevAlt2Override,
      pantbrev_sc3_override_sek: state.pantbrevAlt3Override,
      _note: 'null = use formula (1.5% for lagfart, 2% of new loan for pantbrev)',
    },
    advanced_analysis: {
      alternative_return_rate_pct: state.alternativeReturnRate || 0,
      expected_appreciation_pct:   state.expectedAppreciationRate || 0,
    },
  };
}

/**
 * Normalize a raw saved state object to the current v2 field names.
 * If the state already uses v2 field names (has 'propertyType'), it is returned as-is.
 * If it uses v1 legacy field names (has 'propType' instead), fields are remapped.
 *
 * This is needed when loading sessions saved by the old v1 calculator.
 *
 * @param {Object} state - raw state object from localStorage
 * @returns {Object} state with v2 field names
 */
export function normalizeSavedState(state) {
  if (!state) return state;
  // Already v2 format — has the current 'propertyType' field
  if ('propertyType' in state) return state;
  // Legacy v1 format — remap old field names to current ones
  return {
    currentStep: 0,
    propertyType:              state.propType               || 'agarlagenhet',
    propertyName:              state.propName               || '',
    purchasePrice:             state.price                  || 0,
    isNewBuild:                state.isNewBuild             !== false,
    propertyLinks:             state.links                  || [],
    monthlyGaFee:              state.gaFee                  || 0,
    monthlyManavgift:          state.manavgift              || 0,
    monthlyDriftkostnad:       state.driftKostnad           || 0,
    monthlyInsurance:          state.ins                    || 0,
    monthlyWater:              state.water                  || 0,
    monthlyElectricity:        state.el                     || 0,
    monthlyHeating:            state.heat                   || 0,
    monthlyOtherCosts:         state.other                  || 0,
    monthlyUtilityReimbursement: state.util                 || 0,
    monthlyRent:               state.rent                   || 0,
    andrahandAvgiftAnnual:     state.andrahandAvg !== undefined ? state.andrahandAvg : 5880,
    bostadsrattPantsattning:   state.pantsattning           || 0,
    bostadsrattOverlatelseAvgift: state.overlatelseAvg      || 0,
    taxeringsvarde:            state.taxeringsvarde         || 0,
    existingPantbrev:          state.existingPantbrev       || 0,
    annualHusRunningCosts:     state.husOpCostYr            || 0,
    downPayment:               state.dp                     || 0,
    newMortgageInterestRate:   state.newRate                || 0,
    newMortgageAmortizationRate: state.newAmor              || 0,
    hasAlt2:                   state.hasAlt2                || false,
    alt2ExtraLoan:             state.extra2                 || 0,
    alt2InterestRate:          state.erate2                 || 0,
    alt2AmortizationRate:      state.eamor2                 || 0,
    alt2ExistingApartmentValue: state.aptVal2               || 0,
    alt2ExistingApartmentLoan: state.aptLoan2               || 0,
    hasAlt3:                   state.hasAlt3                || false,
    alt3ExtraLoan:             state.extra3                 || 0,
    alt3InterestRate:          state.erate3                 || 0,
    alt3AmortizationRate:      state.eamor3                 || 0,
    alt3ExistingApartmentValue: state.aptVal3               || 0,
    alt3ExistingApartmentLoan: state.aptLoan3               || 0,
    lagfartOverride:           state.lagfartAmt   !== undefined ? state.lagfartAmt   : null,
    pantbrevAlt1Override:      state.pantAmt1     !== undefined ? state.pantAmt1     : null,
    pantbrevAlt2Override:      state.pantAmt2     !== undefined ? state.pantAmt2     : null,
    pantbrevAlt3Override:      state.pantAmt3     !== undefined ? state.pantAmt3     : null,
    sessionName:               state.saveName               || '',
    alternativeReturnRate:     state.altRate                || 0,
    expectedAppreciationRate:  state.appRate                || 0,
  };
}

/**
 * Parse a loaded JSON file (v4 structured or older flat format) into an app state object.
 * Supports both the current v4 export format and older v1-3 flat state format.
 *
 * @param {Object} data - raw parsed JSON from file
 * @returns {Object} normalized app state object
 */
export function deserializeImportedData(data) {
  if (data.property) {
    // v4 structured format
    const financing    = data.financing || {};
    const alt1         = financing.alt1_new_bank_loan         || {};
    const alt2         = financing.alt2_large_existing_topup  || {};
    const alt3         = financing.alt3_small_existing_topup  || {};
    const oneTimeCosts = data.one_time_costs                  || {};
    const brfOnetime   = data.bostadsratt_one_time            || {};
    const monthlyCosts = data.monthly_costs                   || {};
    const rentalIncome = data.rental_income                   || {};
    const property     = data.property;
    const husDetails   = data.hus_details                     || {};
    const advAnalysis  = data.advanced_analysis               || {};

    return {
      currentStep: 0,
      propertyType:              property.type               || 'agarlagenhet',
      propertyName:              property.name               || '',
      purchasePrice:             property.purchase_price_sek || 0,
      isNewBuild:                property.fastighetsskatt_exempt !== false,
      propertyLinks:             property.links              || [],
      monthlyGaFee:              monthlyCosts.ga_samfallighet_sek || 0,
      monthlyManavgift:          monthlyCosts.manavgift_sek       || 0,
      monthlyDriftkostnad:       monthlyCosts.driftkostnad_sek    || 0,
      monthlyInsurance:          monthlyCosts.insurance_sek       || 0,
      monthlyWater:              monthlyCosts.water_sek           || 0,
      monthlyElectricity:        monthlyCosts.electricity_sek     || 0,
      monthlyHeating:            monthlyCosts.heating_sek         || 0,
      monthlyOtherCosts:         monthlyCosts.other_sek           || 0,
      monthlyUtilityReimbursement: monthlyCosts.utility_reimbursement_from_tenant_sek || 0,
      monthlyRent:               rentalIncome.monthly_rent_sek    || 0,
      andrahandAvgiftAnnual:     rentalIncome.andrahand_avgift_yr_sek !== undefined
                                   ? rentalIncome.andrahand_avgift_yr_sek : 5880,
      bostadsrattPantsattning:   brfOnetime.pantsattning_sek   || 0,
      bostadsrattOverlatelseAvgift: brfOnetime.overlatelseAvg_sek || 0,
      taxeringsvarde:            husDetails.taxeringsvarde_sek    || 0,
      existingPantbrev:          husDetails.existing_pantbrev_sek || 0,
      annualHusRunningCosts:     husDetails.driftkostnad_yr_sek   || 0,
      downPayment:               alt1.down_payment_sek            || 0,
      newMortgageInterestRate:   alt1.interest_rate_pct           || 0,
      newMortgageAmortizationRate: alt1.amortization_pct          || 0,
      hasAlt2:                   alt2.enabled                     || false,
      alt2ExtraLoan:             alt2.extra_loan_sek              || 0,
      alt2InterestRate:          alt2.interest_rate_pct           || 0,
      alt2AmortizationRate:      alt2.amortization_pct            || 0,
      alt2ExistingApartmentValue: alt2.existing_apartment_value_sek || 0,
      alt2ExistingApartmentLoan: alt2.existing_apartment_loan_sek  || 0,
      hasAlt3:                   alt3.enabled                     || false,
      alt3ExtraLoan:             alt3.extra_loan_sek              || 0,
      alt3InterestRate:          alt3.interest_rate_pct           || 0,
      alt3AmortizationRate:      alt3.amortization_pct            || 0,
      alt3ExistingApartmentValue: alt3.existing_apartment_value_sek || 0,
      alt3ExistingApartmentLoan: alt3.existing_apartment_loan_sek  || 0,
      lagfartOverride:           oneTimeCosts.lagfart_override_sek !== undefined
                                   ? oneTimeCosts.lagfart_override_sek : null,
      pantbrevAlt1Override:      oneTimeCosts.pantbrev_sc1_override_sek !== undefined
                                   ? oneTimeCosts.pantbrev_sc1_override_sek : null,
      pantbrevAlt2Override:      oneTimeCosts.pantbrev_sc2_override_sek !== undefined
                                   ? oneTimeCosts.pantbrev_sc2_override_sek : null,
      pantbrevAlt3Override:      oneTimeCosts.pantbrev_sc3_override_sek !== undefined
                                   ? oneTimeCosts.pantbrev_sc3_override_sek : null,
      sessionName:               data.name || '',
      alternativeReturnRate:     advAnalysis.alternative_return_rate_pct || 0,
      expectedAppreciationRate:  advAnalysis.expected_appreciation_pct   || 0,
    };
  }

  // v1-3 flat state format (backwards compatibility) — map old field names to new
  const legacy = data.state || data;
  return {
    currentStep: 0,
    propertyType:              legacy.propType                 || 'agarlagenhet',
    propertyName:              legacy.propName                 || '',
    purchasePrice:             legacy.price                    || 0,
    isNewBuild:                legacy.isNewBuild               !== false,
    propertyLinks:             legacy.links                    || [],
    monthlyGaFee:              legacy.gaFee                    || 0,
    monthlyManavgift:          legacy.manavgift                || 0,
    monthlyDriftkostnad:       legacy.driftKostnad             || 0,
    monthlyInsurance:          legacy.ins                      || 0,
    monthlyWater:              legacy.water                    || 0,
    monthlyElectricity:        legacy.el                       || 0,
    monthlyHeating:            legacy.heat                     || 0,
    monthlyOtherCosts:         legacy.other                    || 0,
    monthlyUtilityReimbursement: legacy.util                   || 0,
    monthlyRent:               legacy.rent                     || 0,
    andrahandAvgiftAnnual:     legacy.andrahandAvg !== undefined ? legacy.andrahandAvg : 5880,
    bostadsrattPantsattning:   legacy.pantsattning             || 0,
    bostadsrattOverlatelseAvgift: legacy.overlatelseAvg        || 0,
    taxeringsvarde:            legacy.taxeringsvarde           || 0,
    existingPantbrev:          legacy.existingPantbrev         || 0,
    annualHusRunningCosts:     legacy.husOpCostYr              || 0,
    downPayment:               legacy.dp                       || 0,
    newMortgageInterestRate:   legacy.newRate                  || 0,
    newMortgageAmortizationRate: legacy.newAmor               || 0,
    hasAlt2:                   legacy.hasAlt2                  || false,
    alt2ExtraLoan:             legacy.extra2                   || 0,
    alt2InterestRate:          legacy.erate2                   || 0,
    alt2AmortizationRate:      legacy.eamor2                   || 0,
    alt2ExistingApartmentValue: legacy.aptVal2                 || 0,
    alt2ExistingApartmentLoan: legacy.aptLoan2                 || 0,
    hasAlt3:                   legacy.hasAlt3                  || false,
    alt3ExtraLoan:             legacy.extra3                   || 0,
    alt3InterestRate:          legacy.erate3                   || 0,
    alt3AmortizationRate:      legacy.eamor3                   || 0,
    alt3ExistingApartmentValue: legacy.aptVal3                 || 0,
    alt3ExistingApartmentLoan: legacy.aptLoan3                 || 0,
    lagfartOverride:           legacy.lagfartAmt !== undefined ? legacy.lagfartAmt : null,
    pantbrevAlt1Override:      legacy.pantAmt1   !== undefined ? legacy.pantAmt1   : null,
    pantbrevAlt2Override:      legacy.pantAmt2   !== undefined ? legacy.pantAmt2   : null,
    pantbrevAlt3Override:      legacy.pantAmt3   !== undefined ? legacy.pantAmt3   : null,
    sessionName:               legacy.saveName                 || '',
    alternativeReturnRate:     legacy.altRate                  || 0,
    expectedAppreciationRate:  legacy.appRate                  || 0,
  };
}
