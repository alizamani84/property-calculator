/**
 * Property comparison controller.
 * Manages the compare selection dialog, comparison table, and compare page navigation.
 */

import { appState } from '../state/app-state.js';
import { loadSessions } from '../state/session-storage.js';
import { showToast } from '../results/results-controller.js';
import { escapeHtml } from '../utils/formatters.js';
import { translate } from '../i18n/i18n-manager.js';

/** localStorage key for the comparison list. */
const COMPARE_KEY = 'swe-prop-calc-compare';

/**
 * Load the current comparison list from localStorage.
 *
 * @returns {Array}
 */
function loadCompareList() {
  try { return JSON.parse(localStorage.getItem(COMPARE_KEY) || '[]'); } catch { return []; }
}

/**
 * Save the comparison list to localStorage.
 *
 * @param {Array} list
 */
function saveCompareList(list) {
  localStorage.setItem(COMPARE_KEY, JSON.stringify(list));
}

/**
 * Determine the sequential display alt number for a given internal alt.
 * Alt 1 is always 1. Alt 2 is always 2 when enabled.
 * Alt 3 is 2 if no Alt 2 is enabled, otherwise 3.
 *
 * @param {Object} state
 * @param {number} internalAlt - 1, 2, or 3
 * @returns {number}
 */
function computeDisplayAltNumber(state, internalAlt) {
  if (internalAlt === 1) return 1;
  if (internalAlt === 2) return 2;
  if (internalAlt === 3) return state.hasAlt2 ? 3 : 2;
  return internalAlt;
}

/**
 * Compute a full scenario result from a state object and alternative number.
 * This mirrors the calculation engine logic for use in comparisons.
 *
 * @param {Object} state - any app state object (may be from a saved session)
 * @param {number} alternativeNumber - 1, 2, or 3
 * @returns {Object} scenario comparison result
 */
function buildComparisonResult(state, alternativeNumber) {
  const price = state.purchasePrice || 0;
  const downPayment = state.downPayment || 0;
  const br = state.propertyType === 'bostadsratt';
  const hus = state.propertyType === 'hus';

  const totalMonthlyIncome = (state.monthlyRent || 0) + (state.monthlyUtilityReimbursement || 0);
  const annualRentalIncome = totalMonthlyIncome * 12;

  const husFastighetsavgiftYearly = hus ? Math.min(Math.round((state.taxeringsvarde || 0) * 0.0075), 10425) : 0;
  const husFastighetsavgiftMonthly = Math.round(husFastighetsavgiftYearly / 12);
  const husMonthlyDrift = hus ? Math.round((state.annualHusRunningCosts || 0) / 12) : 0;
  const aglFastighetsavgiftYearly = (!br && !hus && !state.isNewBuild) ? Math.min(Math.round(price * 0.75 * 0.0075), 10425) : 0;
  const aglFastighetsavgiftMonthly = Math.round(aglFastighetsavgiftYearly / 12);

  const monthlyOwnershipCost = (
    br ? (state.monthlyManavgift || 0) + (state.monthlyDriftkostnad || 0)
    : hus ? husMonthlyDrift + husFastighetsavgiftMonthly
    : (state.monthlyGaFee || 0) + aglFastighetsavgiftMonthly
  )
  + (state.monthlyInsurance || 0)
  + (state.monthlyWater || 0)
  + (state.monthlyElectricity || 0)
  + (state.monthlyHeating || 0)
  + (state.monthlyOtherCosts || 0);

  const andrahandMonthly = br ? Math.round((state.andrahandAvgiftAnnual || 5880) / 12) : 0;

  const schablonavdragVariable = br ? (state.monthlyManavgift || 0) * 12 : annualRentalIncome * 0.2;
  const taxableSurplus = Math.max(0, annualRentalIncome - 40000 - schablonavdragVariable);
  const annualRentalTax = Math.round(taxableSurplus * 0.30);

  const lagfartAmount = br ? 0 : Math.round(price * 0.015) + 825;
  const brOnetimeFees = br ? (state.bostadsrattPantsattning || 0) + (state.bostadsrattOverlatelseAvgift || 0) : 0;
  const existingPantbrev = br ? 0 : (state.existingPantbrev || 0);

  function calcPantbrev(loan) {
    if (br) return 0;
    const newPant = Math.max(0, loan - existingPantbrev);
    return newPant > 0 ? Math.round(newPant * 0.02) + 375 : 0;
  }

  let newLoan, pantbrev, totalCash, monthlyInterest, monthlyAmort, extraLoanAmount = 0;
  let extraInterest = 0, extraAmort = 0;

  if (alternativeNumber === 1) {
    newLoan = Math.max(0, price - downPayment);
    pantbrev = calcPantbrev(newLoan);
    totalCash = br ? downPayment + brOnetimeFees : downPayment + lagfartAmount + pantbrev;
    monthlyInterest = Math.round(newLoan * (state.newMortgageInterestRate || 0) / 100 / 12);
    monthlyAmort = Math.round(newLoan * (state.newMortgageAmortizationRate || 0) / 100 / 12);
  } else if (alternativeNumber === 2) {
    extraLoanAmount = state.alt2ExtraLoan || 0;
    newLoan = Math.max(0, price - downPayment - extraLoanAmount);
    pantbrev = calcPantbrev(newLoan);
    totalCash = br ? downPayment + brOnetimeFees : downPayment + lagfartAmount + pantbrev;
    monthlyInterest = Math.round(newLoan * (state.newMortgageInterestRate || 0) / 100 / 12);
    extraInterest = Math.round(extraLoanAmount * (state.alt2InterestRate || 0) / 100 / 12);
    extraAmort = Math.round(extraLoanAmount * (state.alt2AmortizationRate || 0) / 100 / 12);
    monthlyAmort = Math.round(newLoan * (state.newMortgageAmortizationRate || 0) / 100 / 12);
  } else {
    extraLoanAmount = state.alt3ExtraLoan || 0;
    newLoan = Math.max(0, price - downPayment - extraLoanAmount);
    pantbrev = calcPantbrev(newLoan);
    totalCash = br ? downPayment + brOnetimeFees : downPayment + lagfartAmount + pantbrev;
    monthlyInterest = Math.round(newLoan * (state.newMortgageInterestRate || 0) / 100 / 12);
    extraInterest = Math.round(extraLoanAmount * (state.alt3InterestRate || 0) / 100 / 12);
    extraAmort = Math.round(extraLoanAmount * (state.alt3AmortizationRate || 0) / 100 / 12);
    monthlyAmort = Math.round(newLoan * (state.newMortgageAmortizationRate || 0) / 100 / 12);
  }

  const totalMonthlyInterest = monthlyInterest + extraInterest;
  const totalMonthlyAmort = monthlyAmort + extraAmort;
  const monthlyCashflow = totalMonthlyIncome - monthlyOwnershipCost - andrahandMonthly - totalMonthlyInterest - totalMonthlyAmort;

  const annualTotalInterest = totalMonthlyInterest * 12;
  const ranteavdrag = annualTotalInterest > 0
    ? Math.round(Math.min(annualTotalInterest, 100000) * 0.30 + Math.max(0, annualTotalInterest - 100000) * 0.21)
    : 0;

  const annualReturn = monthlyCashflow * 12 - annualRentalTax + ranteavdrag;
  const monthlyTakeHome = annualReturn / 12;
  const roi = totalCash > 0 ? annualReturn / totalCash * 100 : 0;
  const netYield = price > 0 ? annualReturn / price * 100 : 0;
  const grossYield = price > 0 ? annualRentalIncome / price * 100 : 0;
  const direktavkastning = price > 0
    ? (annualRentalIncome - monthlyOwnershipCost * 12 - andrahandMonthly * 12 - annualRentalTax) / price * 100
    : 0;

  const displayAlt = computeDisplayAltNumber(state, alternativeNumber);
  const descLabels = ['New Bank Loan', 'Large Top-up', 'Small Top-up'];
  const scenarioLabel = `Financing Alt. ${displayAlt} — ${descLabels[alternativeNumber - 1]}`;

  return {
    id: (state._cmpId || 'x') + '-' + alternativeNumber + '-' + Math.random().toString(36).slice(2, 5),
    propertyName: state.propertyName || 'Unnamed',
    altNum: displayAlt,
    scenarioLabel,
    propertyType: state.propertyType || 'agarlagenhet',
    price,
    downPayment,
    lagfart: lagfartAmount,
    pantbrev,
    totalCash,
    monthlyRent: state.monthlyRent || 0,
    monthlyOwnershipCost,
    extraLoan: extraLoanAmount,
    newLoan,
    totalMonthlyInterest,
    totalMonthlyAmort,
    totalMonthlyCost: monthlyOwnershipCost + totalMonthlyInterest + totalMonthlyAmort,
    annualRentalTax,
    monthlyTakeHome: Math.round(monthlyTakeHome),
    annualReturnAfterTax: Math.round(annualReturn),
    roi,
    netYield,
    direktavkastning,
    grossYield,
    ltv: price > 0 ? newLoan / price * 100 : 0,
    addedAt: new Date().toISOString(),
  };
}

/** Dialog working state — list of selectable scenario items. */
let compareDialogItems = [];

/**
 * Open the compare selection dialog.
 * Populates the list from saved sessions and the current session.
 */
export function openCompareDialog() {
  compareDialogItems = [];
  const scenarioLabels = ['', 'New Bank Loan', 'Large Top-up', 'Small Top-up'];

  function addPropertyToDialog(baseId, label, isCurrent, state, price, savedAt) {
    const stateWithId = { ...state, _cmpId: baseId };
    compareDialogItems.push({
      id: baseId + '-1', label, altNum: 1, displayAlt: 1, scenarioLabel: scenarioLabels[1],
      isCurrent, state: stateWithId, checked: false, price, savedAt,
    });
    if (state.hasAlt2) {
      compareDialogItems.push({
        id: baseId + '-2', label, altNum: 2, displayAlt: computeDisplayAltNumber(state, 2), scenarioLabel: scenarioLabels[2],
        isCurrent, state: stateWithId, checked: false, price, savedAt,
      });
    }
    if (state.hasAlt3) {
      compareDialogItems.push({
        id: baseId + '-3', label, altNum: 3, displayAlt: computeDisplayAltNumber(state, 3), scenarioLabel: scenarioLabels[3],
        isCurrent, state: stateWithId, checked: false, price, savedAt,
      });
    }
  }

  // Add saved sessions
  loadSessions().forEach(session => {
    const sessionState = session.state || {};
    addPropertyToDialog('sv-' + session.id, session.name, false, sessionState, sessionState.purchasePrice || 0, session.savedAt);
  });

  // Add current session (if results are visible and it has data)
  const resultsPage = document.getElementById('resultsPage');
  const comparePage = document.getElementById('comparePage');
  const resultsVisible = resultsPage?.classList.contains('show') || comparePage?.classList.contains('show');
  if (appState.purchasePrice > 0 && resultsVisible) {
    const currentLabel = appState.sessionName || appState.propertyName || 'Current result';
    // Check whether the current session is already in the saved list
    const matchedItems = compareDialogItems.filter(item =>
      item.label === currentLabel ||
      (appState.propertyName && item.state?.propertyName === appState.propertyName && item.state?.purchasePrice === appState.purchasePrice)
    );
    if (matchedItems.length > 0) {
      matchedItems.forEach(item => { item.isCurrent = true; });
    } else {
      addPropertyToDialog('current', currentLabel, true, appState, appState.purchasePrice, null);
    }
  }

  if (!compareDialogItems.length) {
    showToast('No calculations available — complete the wizard first');
    return;
  }

  renderCompareDialog();
  document.getElementById('cmpdOverlay')?.classList.remove('hidden');
}

/**
 * Close the compare selection dialog.
 */
export function closeCompareDialog() {
  document.getElementById('cmpdOverlay')?.classList.add('hidden');
}

/**
 * Toggle the checked state of a compare dialog item.
 *
 * @param {number} itemIndex
 */
export function toggleCompareItem(itemIndex) {
  const item = compareDialogItems[itemIndex];
  if (!item) return;
  const currentlyCheckedCount = compareDialogItems.filter(i => i.checked).length;
  if (!item.checked && currentlyCheckedCount >= 4) {
    showToast('⚠️ Maximum 4 properties');
    return;
  }
  item.checked = !item.checked;
  renderCompareDialog();
}

/**
 * Confirm the compare selection and open the comparison table.
 */
export function confirmCompareDialog() {
  const selectedItems = compareDialogItems.filter(item => item.checked);
  if (selectedItems.length < 2) return;
  saveCompareList(selectedItems.map(item => buildComparisonResult(item.state, item.altNum)));
  closeCompareDialog();
  openComparePage();
}

/**
 * Render the compare selection dialog content.
 */
function renderCompareDialog() {
  const checkedCount = compareDialogItems.filter(item => item.checked).length;
  const countLabel = document.getElementById('cmpdCount');
  if (countLabel) countLabel.textContent = checkedCount + ' ' + translate('cmpd_of4');

  const goButton = document.getElementById('cmpdGoBtn');
  if (goButton) {
    goButton.disabled = checkedCount < 2;
    goButton.textContent = checkedCount >= 2
      ? translate('compare') + ' (' + checkedCount + ')'
      : translate('cmpd_select_min');
  }

  const formatSek = n => n ? (+n).toLocaleString('sv-SE') + ' kr' : '';
  const formatDate = s => s ? new Date(s).toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' }) : '';
  const typeMap = { agarlagenhet: '🏢 Ägarlägenhet', bostadsratt: '🏘️ Bostadsrätt', hus: '🏡 Villa / Radhus / Kedjehus / Parhus' };
  const typeBg  = pt => pt === 'bostadsratt' ? '#fff3e0' : pt === 'hus' ? '#e8f5e9' : '#e8f0fb';
  const typeFg  = pt => pt === 'bostadsratt' ? '#7B3A10' : pt === 'hus' ? '#1a5c1a' : '#1F3864';

  // Group items by property label
  const propertyGroups = new Map();
  compareDialogItems.forEach(item => {
    if (!propertyGroups.has(item.label)) propertyGroups.set(item.label, []);
    propertyGroups.get(item.label).push(item);
  });

  const propCount = propertyGroups.size;
  const availLabel = propCount === 1
    ? translate('cmpd_prop_avail_1')
    : translate('cmpd_prop_avail_n').replace('{n}', propCount);
  let html = `<div class="cmpd-sep">${availLabel}</div>`;

  propertyGroups.forEach(group => {
    const firstItem = group[0];
    const propertyType = firstItem.state?.propertyType || 'agarlagenhet';
    const typeLabel = typeMap[propertyType] || 'Ägarlägenhet';
    const anyChecked = group.some(item => item.checked);
    const hasCurrent = group.some(item => item.isCurrent);

    const typeBadge = `<span style="background:${typeBg(propertyType)};color:${typeFg(propertyType)};border-radius:8px;font-size:10px;font-weight:700;padding:2px 8px;">${typeLabel}</span>`;
    const currentBadge = hasCurrent ? `<span class="cmpd-current-badge">${translate('cmpd_active')}</span>` : '';
    const datePart = firstItem.savedAt ? `<span style="color:#9aabb8">· ${formatDate(firstItem.savedAt)}</span>` : '';

    // Find best alternative by monthly take-home
    const takeHomeValues = group.map(item => {
      try { return buildComparisonResult(item.state, item.altNum).monthlyTakeHome; } catch { return null; }
    });
    const validValues = takeHomeValues.filter(v => v !== null);
    const bestTakeHome = validValues.length > 1 ? Math.max(...validValues) : null;

    const maxReached = checkedCount >= 4;
    const altButtons = group.map((item, groupIndex) => {
      const itemIndex = compareDialogItems.indexOf(item);
      const displayNum = item.displayAlt || item.altNum || 1;
      const isDisabled = !item.checked && maxReached;
      const isBest = bestTakeHome !== null && takeHomeValues[groupIndex] === bestTakeHome;
      return `<button class="cmpd-sc-btn${item.checked ? ' active' : ''}${isBest ? ' best' : ''}"
        onclick="event.stopPropagation();window.toggleCompareItem(${itemIndex})"
        title="${isBest ? translate('cmpd_best_title') : ''}"
        ${isDisabled ? 'disabled' : ''}>${translate('cmpd_alt')} ${displayNum}${isBest ? ' ★' : ''}</button>`;
    }).join('');

    html += `<div class="cmpd-prop-row${anyChecked ? ' any-checked' : ''}">
      <div class="cmpd-item-name">${escapeHtml(firstItem.label)}${currentBadge}</div>
      <div class="cmpd-item-sub">${typeBadge} ${formatSek(firstItem.price)} ${datePart}</div>
      <div class="cmpd-sc-btns">${altButtons}</div>
    </div>`;
  });

  const dialogBody = document.getElementById('cmpdBody');
  if (dialogBody) dialogBody.innerHTML = html;
}

/**
 * Open the compare page showing the comparison table.
 */
export function openComparePage() {
  document.getElementById('resultsPage')?.classList.remove('show');
  document.getElementById('comparePage')?.classList.add('show');
  renderComparisonTable();
}

/**
 * Close the compare page and return to results.
 */
export function closeComparePage() {
  document.getElementById('comparePage')?.classList.remove('show');
  document.getElementById('resultsPage')?.classList.add('show');
}

/**
 * Clear all items from the comparison and close the compare page.
 */
export function clearComparison() {
  if (!confirm('Clear all items from the comparison?')) return;
  saveCompareList([]);
  closeComparePage();
}

/**
 * Remove a single item from the comparison by its ID.
 *
 * @param {string} itemId
 */
export function removeFromComparison(itemId) {
  saveCompareList(loadCompareList().filter(item => item.id !== itemId));
  renderComparisonTable();
}

/**
 * Render the comparison table.
 */
export function renderComparisonTable() {
  const compareList = loadCompareList();

  const subtitleElement = document.getElementById('cmp-count-sub');
  if (subtitleElement) {
    subtitleElement.textContent = compareList.length
      ? (compareList.length === 1
          ? translate('cmpd_prop_avail_1')
          : translate('cmpd_prop_avail_n').replace('{n}', compareList.length))
      : '';
  }

  const contentElement = document.getElementById('cmpContent');
  if (!contentElement) return;

  if (!compareList.length) {
    const [line1, line2] = translate('cmpd_empty').split('\n');
    contentElement.innerHTML = `<div class="cmp-empty">${line1}<br>${line2 || ''}</div>`;
    return;
  }

  const formatSek = n => Math.round(n).toLocaleString('sv-SE') + ' kr';
  const formatPct = (n, d = 2) => n.toFixed(d) + '%';

  const altBadge = altNum => `<span class="cmp-sc-badge sc-b${altNum}">${translate('cmpd_alt')} ${altNum}</span>`;

  function markBest(values, lowerIsBetter) {
    const numbers = values.map(v => typeof v === 'number' ? v : null);
    const validNumbers = numbers.filter(n => n !== null);
    if (validNumbers.length < 2) return numbers.map(n => n === null ? { cssClass: '' } : { num: n, cssClass: '' });
    const bestValue = lowerIsBetter ? Math.min(...validNumbers) : Math.max(...validNumbers);
    return numbers.map(n => n === null ? { cssClass: '' } : { num: n, cssClass: n === bestValue ? 'cmp-best' : '' });
  }

  const t = k => translate(k);
  const tableRows = [
    { section: t('cmpd_sec_property') },
    { label: t('cmpd_row_price'),      values: compareList.map(i => i.price),               format: formatSek, noMark: true },
    { label: t('cmpd_row_down'),       values: compareList.map(i => i.downPayment),          format: formatSek, lowerBetter: true },
    { label: t('cmpd_row_lagfart'),    values: compareList.map(i => i.lagfart),              format: formatSek, lowerBetter: true },
    { label: t('cmpd_row_pantbrev'),   values: compareList.map(i => i.pantbrev),             format: formatSek, lowerBetter: true },
    { label: t('cmpd_row_total_cash'), values: compareList.map(i => i.totalCash),            format: formatSek, lowerBetter: true, isKey: true },
    { section: t('cmpd_sec_loan') },
    { label: t('cmpd_row_new_mort'),   values: compareList.map(i => i.newLoan),              format: formatSek, noMark: true },
    { label: t('cmpd_row_extra_loan'), values: compareList.map(i => i.extraLoan),            format: formatSek, noMark: true },
    { label: t('cmpd_row_ltv'),        values: compareList.map(i => i.ltv),                  format: n => formatPct(n, 1), lowerBetter: true },
    { label: t('cmpd_row_int'),        values: compareList.map(i => i.totalMonthlyInterest), format: formatSek, lowerBetter: true },
    { label: t('cmpd_row_amort'),      values: compareList.map(i => i.totalMonthlyAmort),    format: formatSek, noMark: true },
    { section: t('cmpd_sec_monthly') },
    { label: t('cmpd_row_rent'),       values: compareList.map(i => i.monthlyRent),          format: formatSek },
    { label: t('cmpd_row_owner'),      values: compareList.map(i => i.monthlyOwnershipCost), format: formatSek, lowerBetter: true },
    { label: t('cmpd_row_tot_mth'),    values: compareList.map(i => i.totalMonthlyCost),     format: formatSek, lowerBetter: true },
    { label: t('cmpd_row_takehome'),   values: compareList.map(i => i.monthlyTakeHome),      format: formatSek, isKey: true },
    { section: t('cmpd_sec_annual') },
    { label: t('cmpd_row_ann_tax'),    values: compareList.map(i => i.annualRentalTax),      format: formatSek, lowerBetter: true },
    { label: t('cmpd_row_ann_ret'),    values: compareList.map(i => i.annualReturnAfterTax), format: formatSek, isKey: true },
    { label: t('cmpd_row_roi'),        values: compareList.map(i => i.roi),                  format: n => formatPct(n, 2), isKey: true },
    { label: t('cmpd_row_net_yield'),  values: compareList.map(i => i.netYield),             format: n => formatPct(n, 2) },
    { label: t('cmpd_row_gross'),      values: compareList.map(i => i.grossYield),           format: n => formatPct(n, 2) },
  ];

  const colCount = compareList.length;
  let tableHtml = `<div style="overflow-x:auto;margin-top:10px"><div class="cmp-wrap"><table class="cmp-table">
    <colgroup><col style="width:195px">`;
  for (let i = 0; i < colCount; i++) tableHtml += `<col>`;
  tableHtml += `</colgroup><thead><tr><th style="background:#1F3864"></th>`;

  compareList.forEach(item => {
    tableHtml += `<th class="cmp-hdr-cell">
      <div class="cmp-prop-name">${escapeHtml(item.propertyName)}</div>
      ${altBadge(item.altNum)}
      <div style="font-size:10px;opacity:.62;margin-top:4px;color:#fff">${escapeHtml(item.scenarioLabel.replace(/Financing Alt\. \d — /, ''))}</div>
      <button class="cmp-remove" onclick="window.removeFromComparison('${item.id}')">${translate('cmpd_remove')}</button>
    </th>`;
  });
  tableHtml += `</tr></thead><tbody>`;

  tableRows.forEach(row => {
    if (row.section) {
      tableHtml += `<tr class="cmp-section"><td colspan="${colCount + 1}">${row.section}</td></tr>`;
      return;
    }
    const markedValues = row.noMark
      ? row.values.map(v => ({ num: v, cssClass: '' }))
      : markBest(row.values, row.lowerBetter || false);
    tableHtml += `<tr class="${row.isKey ? 'cmp-key' : ''}"><td class="cmp-lbl">${row.label}</td>`;
    markedValues.forEach(m => {
      tableHtml += `<td class="cmp-val ${m.cssClass}">${m.num !== undefined ? row.format(m.num) : '—'}</td>`;
    });
    tableHtml += `</tr>`;
  });

  tableHtml += `</tbody></table></div></div>
    <div style="text-align:center;margin-top:12px;font-size:11px;color:#667">${translate('cmpd_footer')}</div>`;

  contentElement.innerHTML = tableHtml;
}

// Re-render compare UI whenever language changes
document.addEventListener('languageChanged', () => {
  const comparePageVisible = document.getElementById('comparePage')?.classList.contains('show');
  const compareDialogVisible = !document.getElementById('cmpdOverlay')?.classList.contains('hidden');
  if (comparePageVisible) renderComparisonTable();
  if (compareDialogVisible) renderCompareDialog();
});
