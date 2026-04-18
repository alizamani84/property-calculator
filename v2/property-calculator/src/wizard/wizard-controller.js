/**
 * Wizard step navigation controller.
 * Manages the multi-step property input form: progress dots, step transitions,
 * back/next button labels, and integration with validation and collection.
 */

import { appState } from '../state/app-state.js';
import { translate, applyTranslationsToDOM, updateLanguageButtons } from '../i18n/i18n-manager.js';
import { validateStep } from './wizard-validator.js';
import { collectStepInputs } from './wizard-form-collector.js';
import { buildReviewContent } from './wizard-form-collector.js';
import { updateWizardSectionsForPropertyType } from './wizard-form-collector.js';
import { updateAmortizationGuide, updateAlt2And3Guides, updateOneTimeCostsSummary, updateOneCostsPlaceholders } from './wizard-live-preview.js';
import { renderSavesList, renderLastSessionBanner, showResults, setUnsavedIndicator } from '../results/results-controller.js';
import { autosaveCurrentSession } from '../state/session-storage.js';

const TOTAL_STEPS = 6;

/** Snapshot of appState taken when entering edit mode — restored on discard. */
let originalStateSnapshot = null;

/**
 * Whether results are currently displayed (controls close-button visibility).
 */
let resultsAreVisible = false;

/**
 * Set the flag that tracks whether results are displayed.
 * Called by results-controller when showing/hiding the results page.
 *
 * @param {boolean} visible
 */
export function setResultsAreVisible(visible) {
  resultsAreVisible = visible;
}

/**
 * Navigate to the next wizard step.
 * On step 0 (welcome), advances directly to step 1.
 * On steps 1–5, validates and collects before advancing.
 * On step 6 (review), collects and triggers finish().
 */
export function goToNextStep() {
  if (appState.currentStep === 0) {
    appState.currentStep = 1;
    renderCurrentStep();
    return;
  }

  if (!validateStep(appState.currentStep)) return;
  collectStepInputs(appState.currentStep);

  if (appState.currentStep < TOTAL_STEPS) {
    appState.currentStep++;
    renderCurrentStep();
  } else {
    collectStepInputs(6);
    finishWizard();
  }
}

/**
 * Navigate to the previous wizard step.
 */
export function goToPreviousStep() {
  if (appState.currentStep > 1) {
    appState.currentStep--;
    renderCurrentStep();
  } else if (appState.currentStep === 1) {
    appState.currentStep = 0;
    renderCurrentStep();
  }
}

/**
 * Navigate directly to a specific earlier step (breadcrumb click).
 * Collects the current step first to avoid losing data.
 *
 * @param {number} targetStep - must be less than current step
 */
export function goToStep(targetStep) {
  if (targetStep >= appState.currentStep) return;
  collectStepInputs(appState.currentStep);
  appState.currentStep = targetStep;
  renderCurrentStep();
}

/**
 * Open the wizard in first-run mode (no results yet).
 * Shows the welcome step.
 */
export function openWizardFresh() {
  originalStateSnapshot = null;
  prefillFormFromState();
  updateOneCostsPlaceholders();
  document.getElementById('wizOverlay').classList.remove('hidden');
  renderCurrentStep();
}

/**
 * Open the wizard in edit mode (results are visible, editing existing inputs).
 * Saves a snapshot of the current state so it can be restored on discard.
 */
export function openWizardForEditing() {
  originalStateSnapshot = appState.purchasePrice > 0 ? { ...appState } : null;
  prefillFormFromState();
  updateOneCostsPlaceholders();
  document.getElementById('wizOverlay').classList.remove('hidden');
  renderCurrentStep();
}

/**
 * Close the wizard and discard any in-progress changes.
 * Restores the original state snapshot if editing.
 */
export function closeWizardDiscardChanges() {
  if (originalStateSnapshot) {
    Object.assign(appState, originalStateSnapshot);
    originalStateSnapshot = null;
  }
  document.getElementById('wizOverlay').classList.add('hidden');
  updateLanguageSelectorState();
}

/**
 * Render the current wizard step — update DOM to show the right step panel,
 * progress dots, button labels, and type-specific sections.
 */
export function renderCurrentStep() {
  const step = appState.currentStep;

  // Switch active step panel
  document.querySelectorAll('.wiz-step').forEach(panel => panel.classList.remove('active'));
  document.getElementById('wstep-' + step)?.classList.add('active');

  const progressBar = document.getElementById('wizProg');
  const closeButton = document.getElementById('wizCloseBtn');

  if (closeButton) {
    closeButton.style.display = (originalStateSnapshot || appState.purchasePrice > 0) ? 'block' : 'none';
  }

  if (step === 0) {
    // Welcome step
    if (progressBar) progressBar.style.display = 'none';
    const wizTitle = document.getElementById('wizTitle');
    if (wizTitle) wizTitle.textContent = translate('welcome');
    const btnNext = document.getElementById('btnNext');
    if (btnNext) btnNext.textContent = translate('start');
    const btnBack = document.getElementById('btnBack');
    if (btnBack) btnBack.style.display = 'none';
    renderSavesList();
    renderLastSessionBanner();
  } else {
    // Steps 1–6
    if (progressBar) progressBar.style.display = 'flex';

    const stepTitles = ['', translate('propType'), translate('propDetails'), translate('financing'),
                        translate('monthlyCosts'), translate('rentalIncome'), translate('reviewCalc')];
    const wizTitle = document.getElementById('wizTitle');
    if (wizTitle) wizTitle.textContent = `Step ${step} of ${TOTAL_STEPS} — ${stepTitles[step]}`;

    const btnNext = document.getElementById('btnNext');
    if (btnNext) btnNext.textContent = step === TOTAL_STEPS ? translate('calculate') : translate('next');

    const btnBack = document.getElementById('btnBack');
    if (btnBack) {
      btnBack.style.display = 'flex';
      btnBack.textContent = translate('back');
    }

    // Update progress dots
    for (let dotIndex = 1; dotIndex <= TOTAL_STEPS; dotIndex++) {
      const dotElement = document.getElementById('pd' + dotIndex);
      const lineElement = document.getElementById('pl' + dotIndex);
      if (dotElement) {
        if (dotIndex < step) {
          dotElement.className = 'pd done';
          dotElement.textContent = '✓';
        } else if (dotIndex === step) {
          dotElement.className = 'pd active';
          dotElement.textContent = String(dotIndex);
        } else {
          dotElement.className = 'pd';
          dotElement.textContent = String(dotIndex);
        }
      }
      if (lineElement && dotIndex < TOTAL_STEPS) {
        lineElement.className = 'pl' + (dotIndex < step ? ' done' : '');
      }
    }

    updateWizardSectionsForPropertyType();

    if (step === 3) {
      updateAmortizationGuide();
      updateOneCostsPlaceholders();
      updateHusLivePreview();
      updateOneTimeCostsSummary();
    }
    if (step === 6) {
      buildReviewContent();
    }
  }

  updateLanguageSelectorState();
  applyTranslationsToDOM();
  updateLanguageButtons();
}

/**
 * Update the fastighetsavgift and pantbrev live guidance panels for hus/villa.
 * Only runs when the current property type is hus.
 */
function updateHusLivePreview() {
  if (appState.propertyType !== 'hus') return;

  const purchasePrice = +document.getElementById('w-price')?.value || appState.purchasePrice || 0;
  const downPayment   = +document.getElementById('w-dp')?.value    || appState.downPayment    || 0;
  const taxeringsvarde = +document.getElementById('w-taxvarde')?.value || appState.taxeringsvarde || 0;
  const existingPantbrev = +document.getElementById('w-existing-pantbrev')?.value || appState.existingPantbrev || 0;

  const formatCurrency = value => Math.round(value).toLocaleString('sv-SE') + ' kr';

  // Live fastighetsavgift box
  const liveBox = document.getElementById('hus-fa-live-box');
  if (liveBox) {
    if (taxeringsvarde > 0) {
      const annualFa = Math.min(Math.round(taxeringsvarde * 0.0075), 10425);
      const isCapped = Math.round(taxeringsvarde * 0.0075) >= 10425;
      liveBox.innerHTML = `📐 <strong>Fastighetsavgift: ${formatCurrency(annualFa)}/yr = ${formatCurrency(Math.round(annualFa / 12))}/mth</strong>${isCapped ? ' <span style="color:#b76800">(capped at 10 425 kr/yr)</span>' : ''}<br><small style="color:#5a6a8a">min(${taxeringsvarde.toLocaleString('sv-SE')} × 0.75%, 10 425 kr) — income year 2026</small>`;
      liveBox.style.background = '#e8f5e9';
      liveBox.style.borderColor = '#a5d6a7';
      liveBox.style.color = '#1a5c1a';
    } else {
      liveBox.innerHTML = '📐 Enter taxeringsvärde below — fastighetsavgift will be calculated automatically (capped at 10 425 kr/yr for 2026).';
      liveBox.style.background = '#f0f5ff';
      liveBox.style.borderColor = '#b8cce8';
      liveBox.style.color = '#1a3c6a';
    }
  }

  // Pantbrev guidance panel
  const pantbrevGuide = document.getElementById('hus-pantbrev-guide');
  if (!pantbrevGuide) return;

  const newMortgage = Math.max(0, purchasePrice - downPayment);
  const newPantbrevNeeded = Math.max(0, newMortgage - existingPantbrev);
  const pantbrevCost = newPantbrevNeeded > 0 ? Math.round(newPantbrevNeeded * 0.02) + 375 : 0;
  const annualFa = taxeringsvarde > 0 ? Math.min(Math.round(taxeringsvarde * 0.0075), 10425) : 0;

  const guideLines = [];
  if (taxeringsvarde > 0) {
    guideLines.push(`📐 Fastighetsavgift: min(${formatCurrency(taxeringsvarde)} × 0.75%, 10 425 kr) = <b>${formatCurrency(annualFa)}/yr</b> (${formatCurrency(Math.round(annualFa / 12))}/mth)`);
  }
  if (purchasePrice > 0 && downPayment > 0) {
    guideLines.push(`🔑 New mortgage: ${formatCurrency(newMortgage)}, Existing pantbrev: ${formatCurrency(existingPantbrev)}`);
    guideLines.push(newPantbrevNeeded > 0
      ? `📜 New pantbrev needed: ${formatCurrency(newPantbrevNeeded)} × 2% + 375 = <b>${formatCurrency(pantbrevCost)}</b>`
      : '✅ Existing pantbrev cover the full mortgage — <b>no new pantbrev cost</b>');
  }

  if (guideLines.length) {
    pantbrevGuide.style.display = 'block';
    pantbrevGuide.innerHTML = guideLines.join('<br>');
  } else {
    pantbrevGuide.style.display = 'none';
  }
}

/**
 * Prefill all wizard form fields from the current appState.
 * Called before opening the wizard (both fresh and edit mode).
 */
export function prefillFormFromState() {
  const setValue = (id, value) => {
    const element = document.getElementById(id);
    if (element && value !== undefined) element.value = value;
  };

  setValue('w-name',  appState.propertyName);
  setValue('w-price', appState.purchasePrice || '');
  setRadio('newbuild', appState.isNewBuild ? 'yes' : 'no');

  // Render property links
  renderPropertyLinks();

  // Monthly costs
  setValue('w-ga',          appState.monthlyGaFee       || '');
  setValue('w-ins',         appState.monthlyInsurance   || '');
  setValue('w-water',       appState.monthlyWater       || '');
  setValue('w-el',          appState.monthlyElectricity || '');
  setValue('w-heat',        appState.monthlyHeating     || '');
  setValue('w-other',       appState.monthlyOtherCosts  || '');
  setValue('w-util',        appState.monthlyUtilityReimbursement || '');
  setValue('w-rent',        appState.monthlyRent        || '');

  // Bostadsrätt specific
  setValue('w-manavgift',    appState.monthlyManavgift                 || '');
  setValue('w-driftkostnad', appState.monthlyDriftkostnad              || '');
  setValue('w-andrahand',    appState.andrahandAvgiftAnnual !== undefined ? appState.andrahandAvgiftAnnual : 5880);
  setValue('w-pantsattning', appState.bostadsrattPantsattning          || '');
  setValue('w-overlatelse',  appState.bostadsrattOverlatelseAvgift     || '');

  // Hus specific
  setValue('w-taxvarde',              appState.taxeringsvarde    || '');
  setValue('w-existing-pantbrev',     appState.existingPantbrev  || '');
  setValue('w-existing-pantbrev-agl', appState.existingPantbrev  || '');
  setValue('w-hus-drift',             appState.annualHusRunningCosts || '');

  // Financing Alt 1
  setValue('w-dp',   appState.downPayment             || '');
  setValue('w-rate', appState.newMortgageInterestRate || '');
  setValue('w-amor', appState.newMortgageAmortizationRate || '');

  // One-time cost overrides (null = leave blank so formula applies)
  setValue('w-lag',   appState.lagfartOverride      !== null && appState.lagfartOverride      !== undefined ? appState.lagfartOverride      : '');
  setValue('w-pant1', appState.pantbrevAlt1Override !== null && appState.pantbrevAlt1Override !== undefined ? appState.pantbrevAlt1Override : '');
  setValue('w-pant2', appState.pantbrevAlt2Override !== null && appState.pantbrevAlt2Override !== undefined ? appState.pantbrevAlt2Override : '');
  setValue('w-pant3', appState.pantbrevAlt3Override !== null && appState.pantbrevAlt3Override !== undefined ? appState.pantbrevAlt3Override : '');

  // Advanced return analysis
  setValue('w-altRate', appState.alternativeReturnRate  || '');
  setValue('w-appRate', appState.expectedAppreciationRate || '');

  // Property type card selection
  document.querySelectorAll('.tc').forEach(card => card.classList.remove('selected'));
  if (appState.propertyType) {
    document.getElementById('tc-' + appState.propertyType)?.classList.add('selected');
  }
  updateWizardSectionsForPropertyType();

  // Alternative financing accordions
  [2, 3].forEach(altNumber => {
    const hasAlt    = altNumber === 2 ? appState.hasAlt2         : appState.hasAlt3;
    const extraLoan = altNumber === 2 ? appState.alt2ExtraLoan   : appState.alt3ExtraLoan;
    const rate      = altNumber === 2 ? appState.alt2InterestRate : appState.alt3InterestRate;
    const amor      = altNumber === 2 ? appState.alt2AmortizationRate : appState.alt3AmortizationRate;
    const aptVal    = altNumber === 2 ? appState.alt2ExistingApartmentValue : appState.alt3ExistingApartmentValue;
    const aptLoan   = altNumber === 2 ? appState.alt2ExistingApartmentLoan  : appState.alt3ExistingApartmentLoan;

    if (hasAlt) {
      document.getElementById('altbtn'  + altNumber)?.setAttribute('class', 'alt-btn remove');
      const altBtn = document.getElementById('altbtn' + altNumber);
      if (altBtn) altBtn.textContent = 'Remove Alternative ' + altNumber;
      document.getElementById('badge'   + altNumber)?.setAttribute('class', 'alt-badge added');
      const badge = document.getElementById('badge' + altNumber);
      if (badge) badge.textContent = 'Added ✓';
      document.getElementById('altbody' + altNumber)?.classList.add('open');
    }

    setValue('w-extra'  + altNumber, extraLoan || '');
    setValue('w-erate'  + altNumber, rate      || '');
    setValue('w-eamor'  + altNumber, amor      || '');
    setValue('w-aptval' + altNumber, aptVal    || '');
    setValue('w-aptloan'+ altNumber, aptLoan   || '');

    if (hasAlt) {
      updateAlt2And3Guides(altNumber);
    }
  });

  updateOneCostsPlaceholders();
}

/**
 * Render the property link list from appState.propertyLinks into the DOM.
 */
function renderPropertyLinks() {
  const linksList = document.getElementById('linksList');
  if (!linksList) return;
  linksList.innerHTML = '';
  // Re-use the global addLink function exposed via window
  if (typeof window.addLink === 'function') {
    appState.propertyLinks.forEach(link => window.addLink(link.lbl, link.url));
  }
}

/**
 * Complete the wizard: commit changes, trigger auto-save, and show results.
 */
function finishWizard() {
  // Detect whether anything meaningful changed since the wizard was opened
  let hasChanges = true;
  if (originalStateSnapshot) {
    const watchedFields = [
      'propertyName', 'propertyType', 'purchasePrice', 'isNewBuild', 'downPayment',
      'newMortgageInterestRate', 'newMortgageAmortizationRate',
      'hasAlt2', 'hasAlt3', 'monthlyGaFee', 'monthlyManavgift', 'monthlyDriftkostnad',
      'monthlyInsurance', 'monthlyWater', 'monthlyElectricity', 'monthlyHeating', 'monthlyOtherCosts',
      'monthlyRent', 'monthlyUtilityReimbursement', 'andrahandAvgiftAnnual',
      'taxeringsvarde', 'existingPantbrev', 'annualHusRunningCosts',
      'lagfartOverride', 'pantbrevAlt1Override', 'pantbrevAlt2Override', 'pantbrevAlt3Override',
      'alt2ExtraLoan', 'alt2InterestRate', 'alt2AmortizationRate',
      'alt3ExtraLoan', 'alt3InterestRate', 'alt3AmortizationRate',
    ];
    hasChanges = watchedFields.some(
      key => JSON.stringify(appState[key] ?? null) !== JSON.stringify(originalStateSnapshot[key] ?? null)
    );
  }

  originalStateSnapshot = null; // commit — changes accepted

  if (appState.sessionName) {
    import('../state/session-storage.js').then(({ saveSession }) => saveSession());
  }

  document.getElementById('wizOverlay').classList.add('hidden');
  updateLanguageSelectorState();

  if (hasChanges) setUnsavedIndicator(true);
  showResults();
}

/**
 * Set radio button group selection by toggling .selected class.
 *
 * @param {string} groupName - 'newbuild'
 * @param {string} value - 'yes' or 'no'
 */
export function setRadio(groupName, value) {
  if (groupName === 'newbuild') {
    document.getElementById('ro-nb-yes')?.classList.toggle('selected', value === 'yes');
    document.getElementById('ro-nb-no')?.classList.toggle('selected', value === 'no');
  }
}

/**
 * Toggle the alt accordion open/closed (without changing hasAlt2/3 state).
 *
 * @param {number} altNumber - 2 or 3
 */
export function toggleAccordion(altNumber) {
  document.getElementById('altbody' + altNumber)?.classList.toggle('open');
}

/**
 * Add or remove a financing alternative.
 *
 * @param {number} altNumber - 2 or 3
 */
export function toggleAlternative(altNumber) {
  const button = document.getElementById('altbtn' + altNumber);
  const isAdding = button?.textContent.startsWith('Add');

  if (isAdding) {
    if (altNumber === 2) {
      appState.hasAlt2 = true;
      autoFillAlt2ExtraLoan();
    } else {
      appState.hasAlt3 = true;
    }
    document.getElementById('altbody' + altNumber)?.classList.add('open');
    if (button) { button.textContent = 'Remove Alternative ' + altNumber; button.className = 'alt-btn remove'; }
    const badge = document.getElementById('badge' + altNumber);
    if (badge) { badge.textContent = 'Added ✓'; badge.className = 'alt-badge added'; }
  } else {
    if (altNumber === 2) appState.hasAlt2 = false;
    else appState.hasAlt3 = false;
    document.getElementById('altbody' + altNumber)?.classList.remove('open');
    if (button) { button.textContent = 'Add Alternative ' + altNumber; button.className = 'alt-btn add'; }
    const badge = document.getElementById('badge' + altNumber);
    if (badge) { badge.textContent = 'Not added'; badge.className = 'alt-badge not-added'; }
  }

  updateOneCostsPlaceholders();
}

/**
 * Auto-fill the Alt 2 extra loan field with the remaining price
 * (purchasePrice − downPayment) as a convenient starting suggestion.
 */
function autoFillAlt2ExtraLoan() {
  const purchasePrice = +document.getElementById('w-price')?.value || appState.purchasePrice;
  const downPayment   = +document.getElementById('w-dp')?.value   || appState.downPayment;
  const suggestedAmount = Math.max(0, purchasePrice - downPayment);
  const field = document.getElementById('w-extra2');
  if (field && !field.value && suggestedAmount > 0) {
    field.value = suggestedAmount;
    updateAlt2And3Guides(2);
  }
}

/**
 * Enable or disable the language selector based on wizard state.
 * The selector is disabled while the user is inside steps 1–5 to prevent
 * mid-flow language switches from confusing the step rendering.
 */
export function updateLanguageSelectorState() {
  const langSelector = document.querySelector('.lang-selector');
  const wizardOverlay = document.getElementById('wizOverlay');
  const isWizardOpen = wizardOverlay && !wizardOverlay.classList.contains('hidden');
  const isInActiveStep = appState.currentStep > 0 && appState.currentStep < 6;
  const shouldDisable = isWizardOpen && isInActiveStep;

  if (langSelector) {
    langSelector.classList.toggle('lang-disabled', shouldDisable);
    langSelector.title = shouldDisable ? translate('langDisabled') : '';
  }
}
