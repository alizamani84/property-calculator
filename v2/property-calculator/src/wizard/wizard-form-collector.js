/**
 * Wizard form collector.
 * Reads DOM form inputs and writes values into appState.
 * Also builds review step HTML and toggles property-type-specific sections.
 */

import { appState } from '../state/app-state.js';
import { escapeHtml, formatAsCurrency } from '../utils/formatters.js';

/** Internal counter for link rows. */
let linkRowCounter = 0;

/**
 * Read the value of a form field by id.
 *
 * @param {string} id
 * @returns {string}
 */
function readFieldValue(id) {
  return document.getElementById(id)?.value ?? '';
}

/**
 * Read the numeric value of a form field by id. Returns 0 when empty or NaN.
 *
 * @param {string} id
 * @returns {number}
 */
function readFieldNumber(id) {
  return +readFieldValue(id) || 0;
}

/**
 * Read the numeric value of a form field, or null when the field is empty
 * (meaning "use calculated default").
 *
 * @param {string} id
 * @returns {number|null}
 */
function readFieldNumberOrNull(id) {
  const element = document.getElementById(id);
  return (element && element.value !== '' && element.value !== null)
    ? +element.value
    : null;
}

/** @returns {boolean} */
function isBostadsratt() {
  return appState.propertyType === 'bostadsratt';
}

/** @returns {boolean} */
function isHus() {
  return appState.propertyType === 'hus';
}

/**
 * Collect and persist all link rows from the DOM into appState.propertyLinks.
 */
export function syncLinksFromDOM() {
  appState.propertyLinks = [];
  document.querySelectorAll('#linksList .link-item').forEach(listItem => {
    const selectElement = listItem.querySelector('select');
    const urlElement = listItem.querySelector('input[type="url"]');
    const customLabelElement = listItem.querySelector('input[type="text"]');
    if (!urlElement?.value.trim()) return;
    const label = selectElement
      ? (selectElement.value === 'Other'
          ? (customLabelElement?.value.trim() || 'Other')
          : selectElement.value)
      : '';
    appState.propertyLinks.push({ label, url: urlElement.value.trim() });
  });
}

/**
 * Render the saved links list from appState into the linksList DOM element.
 */
export function renderLinksIntoDOM() {
  document.getElementById('linksList').innerHTML = '';
  linkRowCounter = 0;
  appState.propertyLinks.forEach(link => addLinkRow(link.label || link.lbl || '', link.url));
}

/**
 * Add a single link row to the links list.
 *
 * @param {string} label
 * @param {string} url
 */
export function addLinkRow(label = '', url = '') {
  const rowId = ++linkRowCounter;
  const listItem = document.createElement('div');
  listItem.className = 'link-item';
  listItem.id = 'li-' + rowId;
  const PRESET_LABELS = ['Hemnet', 'Booli', 'Broker', 'Other'];
  const isPreset = PRESET_LABELS.slice(0, -1).includes(label);
  const selectedValue = isPreset ? label : (label ? 'Other' : 'Hemnet');
  const customValue = (!isPreset && label) ? label : '';
  const options = PRESET_LABELS.map(opt =>
    `<option value="${opt}"${selectedValue === opt ? ' selected' : ''}>${opt}</option>`
  ).join('');
  listItem.innerHTML = `
    <select class="lnk-select" onchange="window.onLinkTypeChange(this, ${rowId})">${options}</select>
    <input type="text" id="lnk-c-${rowId}" placeholder="Custom label" value="${escapeHtml(customValue)}"
      oninput="window.syncLinksFromWizard()" style="flex:0 0 110px;display:${selectedValue === 'Other' ? '' : 'none'}">
    <input type="url" placeholder="https://..." value="${escapeHtml(url)}"
      oninput="window.syncLinksFromWizard()" style="flex:1">
    <button class="link-del" onclick="window.deleteLinkRow(${rowId})">×</button>`;
  document.getElementById('linksList').appendChild(listItem);
  syncLinksFromDOM();
}

/**
 * Handle link type selector change — toggle custom label input visibility.
 *
 * @param {HTMLSelectElement} selectElement
 * @param {number} rowId
 */
export function onLinkTypeChange(selectElement, rowId) {
  const customInput = document.getElementById('lnk-c-' + rowId);
  if (customInput) customInput.style.display = selectElement.value === 'Other' ? '' : 'none';
  syncLinksFromDOM();
}

/**
 * Delete a link row by its row id.
 *
 * @param {number} rowId
 */
export function deleteLinkRow(rowId) {
  document.getElementById('li-' + rowId)?.remove();
  syncLinksFromDOM();
}

/**
 * Collect inputs for a specific wizard step and write them into appState.
 *
 * @param {number} stepNumber - 2 through 6
 */
export function collectStepInputs(stepNumber) {
  if (stepNumber === 2) {
    appState.propertyName = readFieldValue('w-name').trim();
    syncLinksFromDOM();
  }

  if (stepNumber === 3) {
    appState.purchasePrice = readFieldNumber('w-price');
    appState.isNewBuild = document.getElementById('ro-nb-yes')?.classList.contains('selected') ?? false;

    if (isBostadsratt()) {
      appState.bostadsrattPantsattning = readFieldNumber('w-pantsattning');
      appState.bostadsrattOverlatelseAvgift = readFieldNumber('w-overlatelse');
    }
    if (isHus()) {
      appState.taxeringsvarde = readFieldNumber('w-taxvarde');
      appState.existingPantbrev = readFieldNumber('w-existing-pantbrev');
    }
    if (!isBostadsratt() && !isHus()) {
      appState.existingPantbrev = readFieldNumber('w-existing-pantbrev-agl');
    }

    appState.downPayment = readFieldNumber('w-dp');
    appState.newMortgageInterestRate = readFieldNumber('w-rate');
    appState.newMortgageAmortizationRate = readFieldNumber('w-amor');

    appState.hasAlt2 = document.getElementById('altbtn2')?.className.includes('remove') ?? false;
    appState.hasAlt3 = document.getElementById('altbtn3')?.className.includes('remove') ?? false;

    if (appState.hasAlt2) {
      appState.alt2ExtraLoan = readFieldNumber('w-extra2');
      appState.alt2InterestRate = readFieldNumber('w-erate2');
      appState.alt2AmortizationRate = readFieldNumber('w-eamor2');
      appState.alt2ExistingApartmentValue = readFieldNumber('w-aptval2');
      appState.alt2ExistingApartmentLoan = readFieldNumber('w-aptloan2');
    }
    if (appState.hasAlt3) {
      appState.alt3ExtraLoan = readFieldNumber('w-extra3');
      appState.alt3InterestRate = readFieldNumber('w-erate3');
      appState.alt3AmortizationRate = readFieldNumber('w-eamor3');
      appState.alt3ExistingApartmentValue = readFieldNumber('w-aptval3');
      appState.alt3ExistingApartmentLoan = readFieldNumber('w-aptloan3');
    }

    appState.lagfartOverride = readFieldNumberOrNull('w-lag');
    appState.pantbrevAlt1Override = readFieldNumberOrNull('w-pant1');
    appState.pantbrevAlt2Override = appState.hasAlt2 ? readFieldNumberOrNull('w-pant2') : null;
    appState.pantbrevAlt3Override = appState.hasAlt3 ? readFieldNumberOrNull('w-pant3') : null;
  }

  if (stepNumber === 4) {
    if (isBostadsratt()) {
      appState.monthlyManavgift = readFieldNumber('w-manavgift');
      appState.monthlyDriftkostnad = readFieldNumber('w-driftkostnad');
      appState.monthlyGaFee = 0;
      appState.annualHusRunningCosts = 0;
    } else if (isHus()) {
      appState.annualHusRunningCosts = readFieldNumber('w-hus-drift');
      appState.monthlyGaFee = 0;
      appState.monthlyManavgift = 0;
      appState.monthlyDriftkostnad = 0;
    } else {
      appState.monthlyGaFee = readFieldNumber('w-ga');
      appState.monthlyManavgift = 0;
      appState.monthlyDriftkostnad = 0;
      appState.annualHusRunningCosts = 0;
    }
    appState.monthlyInsurance = readFieldNumber('w-ins');
    appState.monthlyWater = readFieldNumber('w-water');
    appState.monthlyElectricity = readFieldNumber('w-el');
    appState.monthlyHeating = readFieldNumber('w-heat');
    appState.monthlyOtherCosts = readFieldNumber('w-other');
  }

  if (stepNumber === 5) {
    appState.monthlyRent = readFieldNumber('w-rent');
    appState.monthlyUtilityReimbursement = readFieldNumber('w-util');
    if (isBostadsratt()) {
      const andrahandElement = document.getElementById('w-andrahand');
      appState.andrahandAvgiftAnnual = (andrahandElement && andrahandElement.value !== '')
        ? readFieldNumber('w-andrahand')
        : 5880;
    }
    appState.alternativeReturnRate = readFieldNumber('w-altRate');
    appState.expectedAppreciationRate = readFieldNumber('w-appRate');
  }

  if (stepNumber === 6) {
    appState.sessionName = readFieldValue('w-savename').trim();
  }
}

/**
 * Build the HTML content for the review step (step 6) and inject it into the DOM.
 * Also pre-fills the save name field if empty.
 */
export function buildReviewContent() {
  // Collect all steps first to ensure state is current
  collectStepInputs(2);
  collectStepInputs(3);
  collectStepInputs(4);
  collectStepInputs(5);

  const price = appState.purchasePrice;
  const downPayment = appState.downPayment;
  const br = isBostadsratt();
  const hus = isHus();

  const formatSek = n => n ? formatAsCurrency(n) : '0 kr';

  // Lagfart calculation
  const lagfartDefault = br ? 0 : Math.round(price * 0.015) + 825;
  const lagfartAmount = (appState.lagfartOverride !== null && appState.lagfartOverride !== undefined)
    ? appState.lagfartOverride
    : lagfartDefault;

  // Loan amounts
  const loan1 = Math.max(0, price - downPayment);
  const loan2 = appState.hasAlt2 ? Math.max(0, price - downPayment - appState.alt2ExtraLoan) : 0;
  const loan3 = appState.hasAlt3 ? Math.max(0, price - downPayment - appState.alt3ExtraLoan) : 0;

  const computePantbrev = (loan, override) => {
    if (override !== null && override !== undefined) return override;
    return Math.round(loan * 0.02);
  };

  const totalCash = (loan, pantOverride) => downPayment + lagfartAmount + computePantbrev(loan, pantOverride);

  const formatLtv = loan => price > 0 ? (loan / price * 100).toFixed(1) + '%' : '—';

  // Hus-specific
  const husFastighetsavgiftYearly = hus
    ? Math.min(Math.round((appState.taxeringsvarde || 0) * 0.0075), 10425)
    : 0;

  // Monthly ownership cost total
  const monthlyCostTotal = (br
    ? appState.monthlyManavgift + (appState.monthlyDriftkostnad || 0)
    : hus
      ? Math.round((appState.annualHusRunningCosts || 0) / 12) + Math.round(husFastighetsavgiftYearly / 12)
      : appState.monthlyGaFee)
    + appState.monthlyInsurance
    + appState.monthlyWater
    + appState.monthlyElectricity
    + appState.monthlyHeating
    + appState.monthlyOtherCosts;

  // Property-type-specific detail rows
  let propertyDetailRows;
  if (br) {
    propertyDetailRows = `
      <div class="rv-row"><span class="rv-lbl">Fastighetsskatt</span><span class="rv-val">N/A — Bostadsrätt</span></div>
      <div class="rv-row"><span class="rv-lbl">Pantsättningsavgift</span><span class="rv-val">${formatSek(appState.bostadsrattPantsattning)}</span></div>
      <div class="rv-row"><span class="rv-lbl">Överlåtelseavgift</span><span class="rv-val">${formatSek(appState.bostadsrattOverlatelseAvgift)}</span></div>`;
  } else if (hus) {
    propertyDetailRows = `
      <div class="rv-row"><span class="rv-lbl">Taxeringsvärde</span><span class="rv-val">${formatSek(appState.taxeringsvarde || 0)}</span></div>
      <div class="rv-row"><span class="rv-lbl">Fastighetsavgift</span><span class="rv-val">${appState.isNewBuild ? 'Exempt (first 15 yrs, värdeår ≥ current yr − 15)' : formatSek(husFastighetsavgiftYearly) + '/yr (' + formatSek(Math.round(husFastighetsavgiftYearly / 12)) + '/mth)'}</span></div>
      <div class="rv-row"><span class="rv-lbl">Existing pantbrev</span><span class="rv-val">${formatSek(appState.existingPantbrev || 0)}</span></div>`;
  } else {
    propertyDetailRows = `
      <div class="rv-row"><span class="rv-lbl">Fastighetsavgift</span><span class="rv-val">${appState.isNewBuild ? 'Exempt (first 15 yrs, värdeår ≥ current yr − 15)' : '0.75% of taxeringsvärde (est.), capped 10 425 kr/yr'}</span></div>
      <div class="rv-row"><span class="rv-lbl">Existing pantbrev</span><span class="rv-val">${formatSek(appState.existingPantbrev || 0)}</span></div>`;
  }

  const monthlyCostLabel = br ? 'Månadsavgift (BRF)' : hus ? 'Driftkostnad' : 'GA fee';
  const monthlyCostValue = br
    ? formatSek(appState.monthlyManavgift)
    : hus
      ? formatSek(appState.annualHusRunningCosts || 0) + '/yr (' + formatSek(Math.round((appState.annualHusRunningCosts || 0) / 12)) + '/mth)'
      : formatSek(appState.monthlyGaFee);

  const extraMonthlyRows = br
    ? `<div class="rv-row"><span class="rv-lbl">Driftkostnad</span><span class="rv-val">${formatSek(appState.monthlyDriftkostnad)}</span></div>
       <div class="rv-row"><span class="rv-lbl">Andrahand avgift</span><span class="rv-val">${formatSek(appState.andrahandAvgiftAnnual)}/yr (${formatSek(Math.round(appState.andrahandAvgiftAnnual / 12))}/mth)</span></div>`
    : '';

  const typeLabel = br ? 'Bostadsrätt' : hus ? 'Villa / Radhus / Kedjehus / Parhus (Äganderätt)' : 'Ägarlägenhet';

  let html = `
    <div class="rv-block"><h3>Property</h3>
      <div class="rv-row"><span class="rv-lbl">Name</span><span class="rv-val">${escapeHtml(appState.propertyName) || '(not set)'}</span></div>
      <div class="rv-row"><span class="rv-lbl">Type</span><span class="rv-val">${typeLabel}</span></div>
      <div class="rv-row"><span class="rv-lbl">Purchase price</span><span class="rv-val">${formatSek(price)}</span></div>
      ${propertyDetailRows}
    </div>
    <div class="rv-block"><h3>Monthly costs</h3>
      <div class="rv-row"><span class="rv-lbl">${monthlyCostLabel}</span><span class="rv-val">${monthlyCostValue}</span></div>
      ${extraMonthlyRows}
      <div class="rv-row"><span class="rv-lbl">Insurance + utilities + other</span><span class="rv-val">${formatSek(appState.monthlyInsurance + appState.monthlyWater + appState.monthlyElectricity + appState.monthlyHeating + appState.monthlyOtherCosts)}</span></div>
      <div class="rv-row"><span class="rv-lbl">Total ownership cost</span><span class="rv-val">${formatSek(monthlyCostTotal)}</span></div>
      <div class="rv-row"><span class="rv-lbl">Utility reimbursement (tenant)</span><span class="rv-val">${formatSek(appState.monthlyUtilityReimbursement)}</span></div>
      <div class="rv-row"><span class="rv-lbl">Monthly rent</span><span class="rv-val">${formatSek(appState.monthlyRent)}</span></div>
    </div>
    <div class="rv-block"><h3>Financing alternatives</h3>
      <div class="alt-chips">
        <div class="alt-chip a1">
          <div class="cn">Financing Alt. 1 — New Bank Loan</div>
          <div class="cv">${formatSek(loan1)} new mortgage</div>
          <div class="cs">LTV ${formatLtv(loan1)} · Cash needed: ${formatSek(totalCash(loan1, appState.pantbrevAlt1Override))}</div>
        </div>`;

  if (appState.hasAlt2) {
    const note2 = loan2 === 0 ? 'No new mortgage needed' : `${formatSek(loan2)} new mortgage`;
    html += `<div class="alt-chip a2">
          <div class="cn">Alt. 2 — Large Top-up</div>
          <div class="cv">${note2}</div>
          <div class="cs">+${formatSek(appState.alt2ExtraLoan)} from existing · LTV ${formatLtv(loan2)}</div>
        </div>`;
  }
  if (appState.hasAlt3) {
    html += `<div class="alt-chip a3">
          <div class="cn">Alt. 3 — Small Top-up</div>
          <div class="cv">${formatSek(loan3)} new mortgage</div>
          <div class="cs">+${formatSek(appState.alt3ExtraLoan)} from existing · LTV ${formatLtv(loan3)}</div>
        </div>`;
  }

  html += '</div></div>';
  document.getElementById('rvContent').innerHTML = html;

  // Pre-fill save name if empty
  const saveNameField = document.getElementById('w-savename');
  if (saveNameField && !saveNameField.value) {
    const dateStr = new Date().toLocaleDateString('sv-SE', { month: 'short', year: 'numeric' });
    saveNameField.value = (appState.propertyName || 'Min bostad') + ' — ' + dateStr;
  }
}

/**
 * Show or hide wizard form sections based on the current property type.
 * Called whenever the property type changes or when a step is rendered.
 */
export function updateWizardSectionsForPropertyType() {
  const br = isBostadsratt();
  const hus = isHus();

  const showElement = (id, visible) => {
    const element = document.getElementById(id);
    if (element) element.style.display = visible ? '' : 'none';
  };

  // Step 3: property-type-specific sections
  showElement('fastighetsskatt-fg',         !br && !hus);  // fastighetsskatt exemption for ägarlägenhet
  showElement('br-no-fastighetsskatt-fg',    br);
  showElement('hus-fastighetsavgift-fg',     hus);
  showElement('br-onetime-section',          br);
  showElement('hus-details-section',         hus);
  showElement('agl-pantbrev-section',        !br && !hus);
  showElement('agl-onetime-section',         !br);
  showElement('br-financing-note',           br);

  // Step 4: recurring cost sections
  showElement('ga-section',                  !br && !hus);
  showElement('br-monthly-section',          br);
  showElement('hus-monthly-section',         hus);

  // Step 5: andrahand avgift (bostadsrätt only)
  showElement('br-andrahand-section',        br);

  // Utility note
  const utilityNote = document.getElementById('util-sep-note');
  if (utilityNote) {
    utilityNote.textContent = hus
      ? '— enter 0 if already included in driftkostnad'
      : br
        ? '— enter 0 if included in månadsavgift'
        : '— enter 0 if included in GA';
  }

  // Step 4 description
  const step3Description = document.getElementById('step3-desc');
  if (step3Description) {
    step3Description.textContent = hus
      ? 'Enter the total driftkostnad (annual running costs) for the house. Use the individual fields below only for costs NOT already included in driftkostnad.'
      : br
        ? 'Enter your månadsavgift. Use the individual fields below only for costs billed separately and NOT included in månadsavgiften.'
        : 'Enter the GA fee for shared building costs. Use the individual fields below only for costs NOT included in GA.';
  }

  // Utility hint
  const utilityHint = document.getElementById('util-note-hint');
  if (utilityHint) {
    utilityHint.textContent = hus
      ? 'Only fill in costs that are NOT already included in driftkostnad above (heating, electricity, water, etc. are typically included).'
      : br
        ? 'Only fill in costs that are NOT already included in månadsavgiften. Leave as 0 if in doubt.'
        : 'Only fill in costs that are NOT already included in the GA fee. Leave as 0 if in doubt.';
  }
}

/**
 * Set the selected property type via type card click — updates state and rerenders sections.
 *
 * @param {string} propertyType - 'agarlagenhet' | 'bostadsratt' | 'hus'
 */
export function selectPropertyType(propertyType) {
  document.querySelectorAll('.tc').forEach(card => card.classList.remove('selected'));
  document.getElementById('unsupMsg').style.display = 'none';

  if (propertyType === 'bostadsratt') {
    document.getElementById('tc-bostadsratt')?.classList.add('selected');
  } else if (propertyType === 'hus') {
    document.getElementById('tc-hus')?.classList.add('selected');
  } else {
    document.getElementById('tc-agarlagenhet')?.classList.add('selected');
  }

  appState.propertyType = propertyType;
  updateWizardSectionsForPropertyType();
}
