/**
 * Wizard live preview panels.
 * Updates guidance boxes in the financing step (step 3) as the user types.
 * Includes amortization guides (Alt. 1), Alt. 2/3 capacity guides, one-time costs summary.
 */

import { appState } from '../state/app-state.js';
import { formatAsCurrency } from '../utils/formatters.js';

/** @returns {boolean} */
function isBostadsratt() {
  return appState.propertyType === 'bostadsratt';
}

/** @returns {boolean} */
function isHus() {
  return appState.propertyType === 'hus';
}

/**
 * Read a numeric field value, falling back to the provided default when empty.
 *
 * @param {string} id
 * @param {number} fallback
 * @returns {number}
 */
function readNum(id, fallback = 0) {
  return +document.getElementById(id)?.value || fallback;
}

/**
 * Update the fastighetsavgift live preview box and pantbrev guidance box for hus.
 * Called whenever purchase price, down payment, taxeringsvärde, or existing pantbrev changes.
 */
export function updateHusLivePreview() {
  if (!isHus()) return;

  const purchasePrice = readNum('w-price', appState.purchasePrice || 0);
  const downPayment = readNum('w-dp', appState.downPayment || 0);
  const taxeringsvarde = readNum('w-taxvarde', appState.taxeringsvarde || 0);
  const existingPantbrev = readNum('w-existing-pantbrev', appState.existingPantbrev || 0);

  const guide = document.getElementById('hus-pantbrev-guide');
  if (!guide) return;

  const newMortgage = Math.max(0, purchasePrice - downPayment);
  const newPantbrevNeeded = Math.max(0, newMortgage - existingPantbrev);
  const pantbrevCost = newPantbrevNeeded > 0 ? Math.round(newPantbrevNeeded * 0.02) + 375 : 0;
  const fastighetsavgiftYearly = taxeringsvarde > 0
    ? Math.min(Math.round(taxeringsvarde * 0.0075), 10425)
    : 0;

  // Update live fastighetsavgift box in step 2
  const fastighetsavgiftBox = document.getElementById('hus-fa-live-box');
  if (fastighetsavgiftBox) {
    if (taxeringsvarde > 0) {
      const isCapped = Math.round(taxeringsvarde * 0.0075) >= 10425;
      fastighetsavgiftBox.innerHTML = `📐 <strong>Fastighetsavgift: ${formatAsCurrency(fastighetsavgiftYearly)}/yr = ${formatAsCurrency(Math.round(fastighetsavgiftYearly / 12))}/mth</strong>`
        + (isCapped ? ' <span style="color:#b76800">(capped at 10 425 kr/yr)</span>' : '')
        + `<br><small style="color:#5a6a8a">min(${taxeringsvarde.toLocaleString('sv-SE')} × 0.75%, 10 425 kr) — income year 2026</small>`;
      fastighetsavgiftBox.style.background = '#e8f5e9';
      fastighetsavgiftBox.style.borderColor = '#a5d6a7';
      fastighetsavgiftBox.style.color = '#1a5c1a';
    } else {
      fastighetsavgiftBox.innerHTML = '📐 Enter taxeringsvärde below — fastighetsavgift will be calculated automatically (capped at 10 425 kr/yr for 2026).';
      fastighetsavgiftBox.style.background = '#f0f5ff';
      fastighetsavgiftBox.style.borderColor = '#b8cce8';
      fastighetsavgiftBox.style.color = '#1a3c6a';
    }
  }

  const guideLines = [];
  if (taxeringsvarde > 0) {
    guideLines.push(`📐 Fastighetsavgift: min(${formatAsCurrency(taxeringsvarde)} × 0.75%, 10 425 kr) = <b>${formatAsCurrency(fastighetsavgiftYearly)}/yr</b> (${formatAsCurrency(Math.round(fastighetsavgiftYearly / 12))}/mth)`);
  }
  if (purchasePrice > 0 && downPayment > 0) {
    guideLines.push(`🔑 New mortgage: ${formatAsCurrency(newMortgage)}, Existing pantbrev: ${formatAsCurrency(existingPantbrev)}`);
    guideLines.push(newPantbrevNeeded > 0
      ? `📜 New pantbrev needed: ${formatAsCurrency(newPantbrevNeeded)} × 2% + 375 = <b>${formatAsCurrency(pantbrevCost)}</b>`
      : `✅ Existing pantbrev cover the full mortgage — <b>no new pantbrev cost</b>`);
  }

  if (guideLines.length) {
    guide.style.display = 'block';
    guide.innerHTML = guideLines.join('<br>');
  } else {
    guide.style.display = 'none';
  }
}

/**
 * Update the amortization guidance box for Alt. 1 (new bank loan).
 * Called when purchase price or down payment changes.
 */
export function updateAmortizationGuide() {
  const purchasePrice = readNum('w-price', appState.purchasePrice || 0);
  const downPayment = readNum('w-dp', 0);
  const guideElement = document.getElementById('alt1guide');
  const amortizationField = document.getElementById('w-amor');
  const amortizationHelp = document.getElementById('amor1-help');

  if (!guideElement || !purchasePrice) return;

  const newMortgage = Math.max(0, purchasePrice - downPayment);
  const ltvRatio = purchasePrice > 0 ? newMortgage / purchasePrice : 0;
  const minimumDownPayment = purchasePrice * 0.10;

  // Determine required amortization rate per 2026 rules
  let requiredAmortizationPct = 0;
  let amortizationCssClass = 'g-green';
  let amortizationLabel = '0% — No amortization required (LTV below 50%)';

  if (downPayment > 0) {
    if (ltvRatio > 0.9) {
      requiredAmortizationPct = 2;
      amortizationCssClass = 'g-red';
      amortizationLabel = '⚠️ Exceeds 90% LTV cap — increase down payment';
    } else if (ltvRatio > 0.7) {
      requiredAmortizationPct = 2;
      amortizationCssClass = 'g-red';
      amortizationLabel = '2%/yr required (LTV > 70%)';
    } else if (ltvRatio > 0.5) {
      requiredAmortizationPct = 1;
      amortizationCssClass = 'g-amber';
      amortizationLabel = '1%/yr required (LTV 50–70%)';
    }
  }

  if (amortizationField && downPayment > 0) amortizationField.value = requiredAmortizationPct;
  if (amortizationHelp && downPayment > 0) amortizationHelp.textContent = amortizationLabel;

  guideElement.style.display = 'block';

  const formatPct = v => (v * 100).toFixed(1) + '%';
  const colorForLtv = v => v > 0.7 ? 'g-red' : v > 0.5 ? 'g-amber' : 'g-green';
  const iconForLtv = v => v > 0.9 ? '❌ Over 90% cap' : v > 0.7 ? '❌ 2%/yr amor' : v > 0.5 ? '⚠️ 1%/yr amor' : '✅ No amor';

  const downPaymentSection = downPayment > 0 ? `
    <hr class="alt-guide-divider">
    <div class="alt-guide-title">With your down payment of ${formatAsCurrency(downPayment)}</div>
    <div class="alt-guide-row"><span>New mortgage needed</span><span class="g-val">${formatAsCurrency(newMortgage)}</span></div>
    <div class="alt-guide-row"><span>LTV (new mortgage / price)</span>
      <span class="g-val ${colorForLtv(ltvRatio)}">${formatPct(ltvRatio)} ${iconForLtv(ltvRatio)}</span></div>
    <div class="alt-guide-row"><span>Amortization required</span>
      <span class="g-val ${amortizationCssClass}">${requiredAmortizationPct}%/yr → ${formatAsCurrency(newMortgage * requiredAmortizationPct / 100 / 12)}/mth</span></div>
    ${ltvRatio > 0.9 ? `<div class="alt-guide-warn">⚠️ Down payment below 10% minimum. Minimum: ${formatAsCurrency(minimumDownPayment)}.</div>` : ''}` : '';

  guideElement.innerHTML = `
    <div class="alt-guide-title">📊 Amortization guidance — new mortgage (2026 rules)</div>
    <div class="alt-guide-row"><span>Purchase price</span><span class="g-val">${formatAsCurrency(purchasePrice)}</span></div>
    <div class="alt-guide-row"><span>Min. down payment (10% · 2026)</span><span class="g-val">${formatAsCurrency(minimumDownPayment)}</span></div>
    <hr class="alt-guide-divider">
    <div class="alt-guide-title">Amortization thresholds</div>
    <div class="alt-guide-row">
      <span>🟢 No amortization — pay ≥ 50% down</span>
      <span class="g-val g-green">≥ ${formatAsCurrency(purchasePrice * 0.5)}</span></div>
    <div class="alt-guide-row">
      <span>🟡 1%/yr — pay 30–50% down</span>
      <span class="g-val g-amber">≥ ${formatAsCurrency(purchasePrice * 0.3)}</span></div>
    <div class="alt-guide-row">
      <span>🔴 2%/yr — pay 10–30% down</span>
      <span class="g-val g-red">≥ ${formatAsCurrency(minimumDownPayment)}</span></div>
    ${downPaymentSection}`;
}

/**
 * Update the borrowing capacity guidance box for Alt. 2 or Alt. 3
 * (existing apartment top-up loans).
 *
 * @param {number} alternativeNumber - 2 or 3
 */
export function updateAlt2And3Guides(alternativeNumber) {
  const n = alternativeNumber;
  const existingApartmentValue = readNum('w-aptval' + n);
  const existingApartmentLoan = readNum('w-aptloan' + n);
  const topUpAmount = readNum('w-extra' + n);
  const guideElement = document.getElementById('altguide' + n);
  const amortizationField = document.getElementById('w-eamor' + n);
  const amortizationHelp = document.getElementById('eamor' + n + '-help');

  if (!guideElement) return;
  if (!existingApartmentValue) { guideElement.style.display = 'none'; return; }
  guideElement.style.display = 'block';

  const currentLtvRatio = existingApartmentValue > 0 ? existingApartmentLoan / existingApartmentValue : 0;
  const newLtvRatio = existingApartmentValue > 0 ? (existingApartmentLoan + topUpAmount) / existingApartmentValue : 0;
  const borrowLimitFor0Pct = Math.max(0, existingApartmentValue * 0.5 - existingApartmentLoan);
  const borrowLimitFor1Pct = Math.max(0, existingApartmentValue * 0.7 - existingApartmentLoan);
  const maxBorrowable = Math.max(0, existingApartmentValue * 0.9 - existingApartmentLoan);

  // Required amortization per 2026 rules
  let requiredAmortizationPct = 0;
  let amortizationCssClass = 'g-green';
  let amortizationLabel = '0% — No amortization required (LTV below 50%)';

  if (topUpAmount > 0) {
    if (newLtvRatio > 0.9) {
      requiredAmortizationPct = 2;
      amortizationCssClass = 'g-red';
      amortizationLabel = '⚠️ Exceeds 90% cap — reduce top-up amount';
    } else if (newLtvRatio > 0.7) {
      requiredAmortizationPct = 2;
      amortizationCssClass = 'g-red';
      amortizationLabel = '2%/yr required (LTV > 70%)';
    } else if (newLtvRatio > 0.5) {
      requiredAmortizationPct = 1;
      amortizationCssClass = 'g-amber';
      amortizationLabel = '1%/yr required (LTV 50–70%)';
    }
  }

  if (amortizationField && topUpAmount > 0) amortizationField.value = requiredAmortizationPct;
  if (amortizationHelp) {
    amortizationHelp.textContent = topUpAmount > 0 ? amortizationLabel : 'Enter top-up amount to see amortization.';
  }

  const formatPct = v => (v * 100).toFixed(1) + '%';
  const colorForLtv = v => v > 0.9 ? 'g-red' : v > 0.7 ? 'g-red' : v > 0.5 ? 'g-amber' : 'g-green';
  const iconForLtv = v => v > 0.9 ? '❌ Over 90% cap' : v > 0.7 ? '❌ 2%/yr amor' : v > 0.5 ? '⚠️ 1%/yr amor' : '✅ No amor';

  let afterTopUpHtml = '';
  if (topUpAmount > 0) {
    const overCap = newLtvRatio > 0.9;
    afterTopUpHtml = `<hr class="alt-guide-divider">
    <div class="alt-guide-title">After this top-up of ${formatAsCurrency(topUpAmount)}</div>
    <div class="alt-guide-row"><span>New total loan on apartment</span><span class="g-val">${formatAsCurrency(existingApartmentLoan + topUpAmount)}</span></div>
    <div class="alt-guide-row"><span>New LTV</span>
      <span class="g-val ${colorForLtv(newLtvRatio)}">${formatPct(newLtvRatio)} ${iconForLtv(newLtvRatio)}</span></div>
    <div class="alt-guide-row"><span>Amortization required on top-up</span>
      <span class="g-val ${amortizationCssClass}">${requiredAmortizationPct}%/yr → ${formatAsCurrency(topUpAmount * requiredAmortizationPct / 100 / 12)}/mth</span></div>
    ${overCap ? `<div class="alt-guide-warn">⚠️ This top-up exceeds the 90% LTV cap. Max borrowable: ${formatAsCurrency(maxBorrowable)}.</div>` : ''}`;
  }

  guideElement.innerHTML = `
    <div class="alt-guide-title">📊 Borrowing capacity — existing apartment (2026 rules)</div>
    <div class="alt-guide-row"><span>Apartment value</span><span class="g-val">${formatAsCurrency(existingApartmentValue)}</span></div>
    <div class="alt-guide-row"><span>Current loan</span><span class="g-val">${formatAsCurrency(existingApartmentLoan)}</span></div>
    <div class="alt-guide-row"><span>Current LTV</span>
      <span class="g-val ${colorForLtv(currentLtvRatio)}">${formatPct(currentLtvRatio)}</span></div>
    <hr class="alt-guide-divider">
    <div class="alt-guide-title">Amortization thresholds</div>
    <div class="alt-guide-row">
      <span>🟢 No amortization (keep LTV &lt; 50%)</span>
      <span class="g-val g-green">≤ ${formatAsCurrency(borrowLimitFor0Pct)}</span></div>
    <div class="alt-guide-row">
      <span>🟡 1%/yr amortization (LTV 50–70%)</span>
      <span class="g-val g-amber">≤ ${formatAsCurrency(borrowLimitFor1Pct)}</span></div>
    <div class="alt-guide-row">
      <span>🔴 2%/yr amortization (LTV 70–90%)</span>
      <span class="g-val g-red">≤ ${formatAsCurrency(maxBorrowable)}</span></div>
    <div class="alt-guide-row" style="margin-top:4px;font-size:10px;color:#666">
      <span>Max borrowable (90% LTV cap, 2026)</span><span class="g-val">${formatAsCurrency(maxBorrowable)}</span></div>
    ${afterTopUpHtml}`;

  updateOneTimeCostsSummary();
}

/**
 * Auto-fill the Alt. 2 extra loan field with the suggested full top-up amount
 * (purchase price minus down payment) when the field is empty.
 */
export function autoFillAlt2ExtraLoan() {
  const purchasePrice = readNum('w-price', appState.purchasePrice || 0);
  const downPayment = readNum('w-dp', appState.downPayment || 0);
  const suggestedTopUp = Math.max(0, purchasePrice - downPayment);
  const extraLoanField = document.getElementById('w-extra2');
  if (!extraLoanField?.value && suggestedTopUp > 0) {
    extraLoanField.value = suggestedTopUp;
    updateAlt2And3Guides(2);
  }
}

/**
 * Refresh the one-time costs summary box at the bottom of step 3.
 * Shows lagfart, pantbrev, and total cash required.
 */
export function updateOneTimeCostsSummary() {
  const purchasePrice = readNum('w-price', appState.purchasePrice || 0);
  const downPayment = readNum('w-dp', appState.downPayment || 0);
  const br = isBostadsratt();
  const hus = isHus();

  const existingPantbrev = br ? 0
    : hus
      ? readNum('w-existing-pantbrev', appState.existingPantbrev || 0)
      : readNum('w-existing-pantbrev-agl', appState.existingPantbrev || 0);

  const setElementText = (id, value) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  };
  const showElement = (id, visible) => {
    const element = document.getElementById(id);
    if (element) element.style.display = visible ? '' : 'none';
  };

  // Lagfart
  const lagfartOverride = document.getElementById('w-lag')?.value;
  const lagfartDefault = br ? 0 : Math.round(purchasePrice * 0.015) + 825;
  const lagfartAmount = (lagfartOverride !== undefined && lagfartOverride !== null && lagfartOverride !== '')
    ? +lagfartOverride
    : lagfartDefault;

  // Pantbrev
  const newMortgage = Math.max(0, purchasePrice - downPayment);
  const pantbrevOverride = document.getElementById('w-pant1')?.value;
  let pantbrevDefault = 0;
  if (!br) {
    const newPantbrevNeeded = Math.max(0, newMortgage - existingPantbrev);
    pantbrevDefault = newPantbrevNeeded > 0 ? Math.round(newPantbrevNeeded * 0.02) + 375 : 0;
  }
  const pantbrevAmount = (pantbrevOverride !== undefined && pantbrevOverride !== null && pantbrevOverride !== '')
    ? +pantbrevOverride
    : pantbrevDefault;

  // BR one-time fees
  const brOnetimeFees = br
    ? ((+document.getElementById('w-pantsattning')?.value || 0) + (+document.getElementById('w-overlatelse')?.value || 0))
    : 0;

  const totalCash = downPayment + lagfartAmount + pantbrevAmount + brOnetimeFees;

  setElementText('ots-dp', purchasePrice > 0 ? formatAsCurrency(downPayment) : '—');
  setElementText('ots-total', (purchasePrice > 0 && downPayment > 0)
    ? formatAsCurrency(totalCash)
    : (purchasePrice > 0 ? 'Enter down payment above' : '—'));

  showElement('ots-lag-row', !br);
  if (!br) {
    setElementText('ots-lag-lbl', 'Lagfart (1.5% + 825 kr)');
    setElementText('ots-lag', purchasePrice > 0 ? formatAsCurrency(lagfartAmount) : '—');
  }

  showElement('ots-pant-row', !br);
  if (!br && purchasePrice > 0 && downPayment > 0) {
    const newPantbrevNeeded = Math.max(0, newMortgage - existingPantbrev);
    const pantbrevLabel = newPantbrevNeeded > 0
      ? `Pantbrev (${formatAsCurrency(newPantbrevNeeded)} × 2% + 375)`
      : 'Pantbrev (none — existing covers loan)';
    setElementText('ots-pant-lbl', pantbrevLabel);
    setElementText('ots-pant', formatAsCurrency(pantbrevAmount));
  } else if (!br) {
    setElementText('ots-pant', '—');
  }

  showElement('ots-br-row', br);
  if (br) setElementText('ots-br', formatAsCurrency(brOnetimeFees));
}

/**
 * Update placeholder text for lagfart and pantbrev override fields.
 * Also shows/hides Alt. 2/3 pantbrev fields based on whether those alts are added.
 */
export function updateOneCostsPlaceholders() {
  const purchasePrice = readNum('w-price', appState.purchasePrice || 0);
  const downPayment = readNum('w-dp', appState.downPayment || 0);
  const extra2 = readNum('w-extra2', 0);
  const extra3 = readNum('w-extra3', 0);
  const hus = isHus();
  const existingPantbrev = readNum('w-existing-pantbrev', appState.existingPantbrev || 0);

  const lagfartBase = Math.round(purchasePrice * 0.015);
  const lagfartTotal = hus ? lagfartBase + 825 : lagfartBase;
  const loan1 = Math.max(0, purchasePrice - downPayment);
  const loan2 = Math.max(0, purchasePrice - downPayment - extra2);
  const loan3 = Math.max(0, purchasePrice - downPayment - extra3);

  const computeHusPantbrev = loan => {
    const newPant = Math.max(0, loan - existingPantbrev);
    return newPant > 0 ? Math.round(newPant * 0.02) + 375 : 0;
  };

  const lagfartField = document.getElementById('w-lag');
  if (lagfartField && !lagfartField.value) {
    lagfartField.placeholder = purchasePrice
      ? (hus
          ? `default: 1.5% + 825 kr = ${formatAsCurrency(lagfartTotal)}`
          : `default: 1.5% = ${formatAsCurrency(lagfartBase)}`)
      : 'default: 1.5% of price';
  }

  const pant1Field = document.getElementById('w-pant1');
  if (pant1Field && !pant1Field.value) {
    pant1Field.placeholder = loan1
      ? (hus
          ? `default: ${formatAsCurrency(computeHusPantbrev(loan1))}`
          : `default: 2% = ${formatAsCurrency(Math.round(loan1 * 0.02))}`)
      : 'default: 2% of new loan';
  }

  const pant2Field = document.getElementById('w-pant2');
  if (pant2Field && !pant2Field.value) {
    pant2Field.placeholder = hus
      ? `default: ${formatAsCurrency(computeHusPantbrev(loan2))}`
      : `default: 2% = ${formatAsCurrency(Math.round(loan2 * 0.02))}`;
  }

  const pant3Field = document.getElementById('w-pant3');
  if (pant3Field && !pant3Field.value) {
    pant3Field.placeholder = hus
      ? `default: ${formatAsCurrency(computeHusPantbrev(loan3))}`
      : `default: 2% = ${formatAsCurrency(Math.round(loan3 * 0.02))}`;
  }

  // Show/hide Alt. 2/3 pantbrev fields
  const alt2HasRemoveClass = document.getElementById('altbtn2')?.className.includes('remove');
  const alt3HasRemoveClass = document.getElementById('altbtn3')?.className.includes('remove');
  const pant23Row = document.getElementById('pant23-row');
  const pant2FieldGroup = document.getElementById('pant2-fg');
  const pant3FieldGroup = document.getElementById('pant3-fg');

  if (pant23Row) pant23Row.style.display = (alt2HasRemoveClass || alt3HasRemoveClass) ? '' : 'none';
  if (pant2FieldGroup) pant2FieldGroup.style.display = alt2HasRemoveClass ? '' : 'none';
  if (pant3FieldGroup) pant3FieldGroup.style.display = alt3HasRemoveClass ? '' : 'none';
}
