/**
 * Wizard step validator.
 * Each step has a validation rule. Returns true when valid, false when errors found.
 * Shows error messages via DOM error elements (id="err1" … "err5").
 */

import { appState } from '../state/app-state.js';

/** @returns {boolean} */
function isBostadsratt() {
  return appState.propertyType === 'bostadsratt';
}

/** @returns {boolean} */
function isHus() {
  return appState.propertyType === 'hus';
}

/**
 * Show a validation error message.
 *
 * @param {string} elementId - e.g. 'err1'
 * @param {string} message
 */
function showValidationError(elementId, message) {
  const element = document.getElementById(elementId);
  if (element) {
    element.textContent = message;
    element.classList.add('show');
  }
}

/**
 * Hide all validation error elements for steps 1–5.
 */
function clearAllErrors() {
  [1, 2, 3, 4, 5].forEach(n => {
    document.getElementById('err' + n)?.classList.remove('show');
  });
}

/**
 * Validate the given wizard step number.
 * Clears all errors first, then checks only the given step.
 *
 * @param {number} stepNumber
 * @returns {boolean} true if valid
 */
export function validateStep(stepNumber) {
  clearAllErrors();

  if (stepNumber === 1) {
    const validTypes = ['agarlagenhet', 'bostadsratt', 'hus'];
    if (!appState.propertyType || !validTypes.includes(appState.propertyType)) {
      showValidationError('err1', 'Please select a property type to continue.');
      return false;
    }
  }

  // Step 2 is optional (name + links — no required fields)

  if (stepNumber === 3) {
    const purchasePrice = +document.getElementById('w-price')?.value || 0;
    if (!purchasePrice || purchasePrice < 100000) {
      showValidationError('err3', 'Please enter a valid purchase price (min 100 000 SEK).');
      return false;
    }
    const downPayment = +document.getElementById('w-dp')?.value || 0;
    if (!downPayment) {
      showValidationError('err3', 'Please enter your down payment (kontantinsats).');
      return false;
    }
    const interestRate = document.getElementById('w-rate')?.value;
    if (interestRate === '' || interestRate === null || interestRate === undefined) {
      showValidationError('err3', 'Please enter the interest rate.');
      return false;
    }
  }

  if (stepNumber === 4) {
    if (isBostadsratt()) {
      const manavgiftValue = document.getElementById('w-manavgift')?.value;
      if (manavgiftValue === '' || manavgiftValue === null || manavgiftValue === undefined) {
        showValidationError('err4', 'Please enter the månadsavgift (BRF fee). Enter 0 if unknown.');
        return false;
      }
    } else if (!isHus()) {
      const gaFeeValue = document.getElementById('w-ga')?.value;
      if (gaFeeValue === '' || gaFeeValue === null || gaFeeValue === undefined) {
        showValidationError('err4', 'Please enter the GA fee (0 if none).');
        return false;
      }
    }
  }

  if (stepNumber === 5) {
    const monthlyRent = +document.getElementById('w-rent')?.value || 0;
    if (!monthlyRent || monthlyRent < 1) {
      showValidationError('err5', 'Please enter the monthly rent.');
      return false;
    }
  }

  return true;
}
