/**
 * Results renderer.
 * Calls the pure calculation engine for each financing alternative
 * and writes all values to the results page DOM.
 */

import { appState } from '../state/app-state.js';
import { getCurrentLanguage } from '../i18n/i18n-manager.js';
import { autosaveCurrentSession } from '../state/session-storage.js';

/** @returns {boolean} */
function isBostadsratt() { return appState.propertyType === 'bostadsratt'; }
/** @returns {boolean} */
function isHus() { return appState.propertyType === 'hus'; }

/**
 * Set value and CSS class on a results cell.
 *
 * @param {string} id
 * @param {string} value
 * @param {string} [cssClass]
 */
function setCell(id, value, cssClass = '') {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = value;
  el.className = 'val' + (cssClass ? ' ' + cssClass : '');
}

/**
 * Set text content of any element.
 *
 * @param {string} id
 * @param {string} value
 */
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

/** Format integer as Swedish locale + ' kr'. */
const formatSek = n => Math.round(n).toLocaleString('sv-SE') + ' kr';
/** Format negative integer as '−N kr'. */
const formatNegSek = n => '−' + Math.round(n).toLocaleString('sv-SE') + ' kr';
/** Format as percentage with given decimal places. */
const formatPct = (n, decimals = 2) => (+n).toFixed(decimals) + '%';
/** Format as thousands — e.g. 1 500 000 → '1 500k'. */
const formatThousands = n => Math.round(n / 1000).toLocaleString('sv-SE') + 'k';

/**
 * Determine LTV color class and label.
 *
 * @param {number} loan
 * @param {number} price
 * @returns {[string, string]} [label, cssClass]
 */
function ltvLabelAndClass(loan, price) {
  const ratio = price > 0 ? loan / price : 0;
  const pct = formatPct(ratio * 100, 1);
  if (ratio < 0.5) return [pct + ' ✅', 'pos'];
  if (ratio < 0.7) return [pct + ' ⚠️', ''];
  return [pct + ' ❌', 'neg'];
}

/**
 * Compute ränteavdrag: 30% on annual interest ≤ 100 000 kr, 21% above.
 *
 * @param {number} annualInterest
 * @returns {number}
 */
function calculateRanteavdrag(annualInterest) {
  if (annualInterest <= 0) return 0;
  return Math.round(
    Math.min(annualInterest, 100000) * 0.30 +
    Math.max(0, annualInterest - 100000) * 0.21
  );
}

/**
 * Update a dynamic formula tooltip box.
 *
 * @param {string} id - base id (tooltip element id = 'tip-' + id)
 * @param {string} description
 * @param {string} formula
 * @param {string} computed
 */
function updateTooltip(id, description, formula, computed) {
  const el = document.getElementById('tip-' + id);
  if (!el) return;
  let html = description;
  if (formula) html += `<span class="tip-formula"><b>Formula:</b> ${formula}</span>`;
  if (computed) html += `<span class="tip-formula"><b>Result:</b> ${computed}</span>`;
  el.innerHTML = html;
}

/**
 * Run all three scenario calculations and write every cell in the results page.
 * This is the main entry point called from showResults().
 */
export function renderAllSections() {
  const state = appState;
  const price = state.purchasePrice;
  const downPayment = state.downPayment;
  const monthlyRent = state.monthlyRent;
  const utilityReimbursement = state.monthlyUtilityReimbursement;
  const newMortgageRate = state.newMortgageInterestRate;
  const newMortgageAmort = state.newMortgageAmortizationRate;
  const br = isBostadsratt();
  const hus = isHus();

  // ── Property-type monthly costs ───────────────────────────────────
  const husFastighetsavgiftYearly = hus
    ? Math.min(Math.round((state.taxeringsvarde || 0) * 0.0075), 10425)
    : 0;
  const husFastighetsavgiftMonthly = Math.round(husFastighetsavgiftYearly / 12);
  const husMonthlyDrift = hus ? Math.round((state.annualHusRunningCosts || 0) / 12) : 0;

  // Ägarlägenhet estimated fastighetsavgift (based on 75% of purchase price as taxeringsvärde estimate)
  const aglFastighetsavgiftYearly = (!br && !hus && !state.isNewBuild)
    ? Math.min(Math.round(price * 0.75 * 0.0075), 10425)
    : 0;
  const aglFastighetsavgiftMonthly = Math.round(aglFastighetsavgiftYearly / 12);

  // Base monthly ownership cost (excluding bank costs)
  const monthlyOwnershipCost = (
    br
      ? state.monthlyManavgift + (state.monthlyDriftkostnad || 0)
      : hus
        ? husMonthlyDrift + husFastighetsavgiftMonthly
        : state.monthlyGaFee + aglFastighetsavgiftMonthly
  )
  + state.monthlyInsurance
  + state.monthlyWater
  + state.monthlyElectricity
  + state.monthlyHeating
  + state.monthlyOtherCosts;

  // Bostadsrätt andrahand avgift (subletting cost)
  const andrahandMonthly = br ? Math.round((state.andrahandAvgiftAnnual || 5880) / 12) : 0;

  // Total income
  const totalMonthlyIncome = monthlyRent + utilityReimbursement;
  const annualRentalIncome = totalMonthlyIncome * 12;

  // Schablonavdrag — BR uses månadsavgift×12; others use 20% of gross income
  const schablonavdragVariable = br
    ? (state.monthlyManavgift || 0) * 12
    : annualRentalIncome * 0.20;

  // Rental tax
  const taxableSurplus = Math.max(0, annualRentalIncome - 40000 - schablonavdragVariable);
  const annualRentalTax = Math.round(taxableSurplus * 0.30);

  // One-time costs shared variables
  const lagfartDefault = br ? 0 : Math.round(price * 0.015) + 825;
  const lagfartAmount = (state.lagfartOverride !== null && state.lagfartOverride !== undefined)
    ? state.lagfartOverride
    : lagfartDefault;
  const brOnetimeFees = br ? (state.bostadsrattPantsattning || 0) + (state.bostadsrattOverlatelseAvgift || 0) : 0;
  const existingPantbrev = br ? 0 : (state.existingPantbrev || 0);

  function computePantbrev(loan, override) {
    if (br) return 0;
    if (override !== null && override !== undefined) return override;
    const newPantbrev = Math.max(0, loan - existingPantbrev);
    return newPantbrev > 0 ? Math.round(newPantbrev * 0.02) + 375 : 0;
  }

  // ── Alt 1: New Bank Loan ──────────────────────────────────────────
  const alt1Loan = Math.max(0, price - downPayment);
  const alt1Pantbrev = computePantbrev(alt1Loan, state.pantbrevAlt1Override);
  const alt1TotalCash = br ? downPayment + brOnetimeFees : downPayment + lagfartAmount + alt1Pantbrev;
  const alt1MonthlyInterest = Math.round(alt1Loan * newMortgageRate / 100 / 12);
  const alt1MonthlyAmort = Math.round(alt1Loan * newMortgageAmort / 100 / 12);
  const alt1MonthlyCashflow = totalMonthlyIncome - monthlyOwnershipCost - andrahandMonthly - alt1MonthlyInterest - alt1MonthlyAmort;
  const alt1Ranteavdrag = calculateRanteavdrag(alt1MonthlyInterest * 12);
  const alt1AnnualReturn = alt1MonthlyCashflow * 12 - annualRentalTax + alt1Ranteavdrag;
  const alt1MonthlyTakeHome = alt1AnnualReturn / 12;
  const alt1Roi = alt1TotalCash > 0 ? alt1AnnualReturn / alt1TotalCash * 100 : 0;
  const alt1NetYield = price > 0 ? alt1AnnualReturn / price * 100 : 0;
  const alt1GrossYield = price > 0 ? annualRentalIncome / price * 100 : 0;
  const alt1TotalMonthlyCost = monthlyOwnershipCost + andrahandMonthly + alt1MonthlyInterest + alt1MonthlyAmort;

  // ── Alt 2: Large Existing Top-up ──────────────────────────────────
  const alt2ExtraLoan = state.alt2ExtraLoan || 0;
  const alt2NewLoan = Math.max(0, price - downPayment - alt2ExtraLoan);
  const alt2Pantbrev = computePantbrev(alt2NewLoan, state.pantbrevAlt2Override);
  const alt2TotalCash = br ? downPayment + brOnetimeFees : downPayment + lagfartAmount + alt2Pantbrev;
  const alt2NewInterest = Math.round(alt2NewLoan * newMortgageRate / 100 / 12);
  const alt2NewAmort = Math.round(alt2NewLoan * newMortgageAmort / 100 / 12);
  const alt2ExtraInterest = Math.round(alt2ExtraLoan * (state.alt2InterestRate || 0) / 100 / 12);
  const alt2ExtraAmort = Math.round(alt2ExtraLoan * (state.alt2AmortizationRate || 0) / 100 / 12);
  const alt2MonthlyCashflow = totalMonthlyIncome - monthlyOwnershipCost - andrahandMonthly - alt2NewInterest - alt2ExtraInterest - alt2NewAmort - alt2ExtraAmort;
  const alt2Ranteavdrag = state.hasAlt2 ? calculateRanteavdrag((alt2NewInterest + alt2ExtraInterest) * 12) : 0;
  const alt2AnnualReturn = alt2MonthlyCashflow * 12 - annualRentalTax + alt2Ranteavdrag;
  const alt2MonthlyTakeHome = alt2AnnualReturn / 12;
  const alt2Roi = alt2TotalCash > 0 ? alt2AnnualReturn / alt2TotalCash * 100 : 0;
  const alt2NetYield = price > 0 ? alt2AnnualReturn / price * 100 : 0;
  const alt2TotalMonthlyCost = monthlyOwnershipCost + andrahandMonthly + alt2NewInterest + alt2ExtraInterest + alt2NewAmort + alt2ExtraAmort;

  // ── Alt 3: Small Existing Top-up ──────────────────────────────────
  const alt3ExtraLoan = state.alt3ExtraLoan || 0;
  const alt3NewLoan = Math.max(0, price - downPayment - alt3ExtraLoan);
  const alt3Pantbrev = computePantbrev(alt3NewLoan, state.pantbrevAlt3Override);
  const alt3TotalCash = br ? downPayment + brOnetimeFees : downPayment + lagfartAmount + alt3Pantbrev;
  const alt3NewInterest = Math.round(alt3NewLoan * newMortgageRate / 100 / 12);
  const alt3NewAmort = Math.round(alt3NewLoan * newMortgageAmort / 100 / 12);
  const alt3ExtraInterest = Math.round(alt3ExtraLoan * (state.alt3InterestRate || 0) / 100 / 12);
  const alt3ExtraAmort = Math.round(alt3ExtraLoan * (state.alt3AmortizationRate || 0) / 100 / 12);
  const alt3MonthlyCashflow = totalMonthlyIncome - monthlyOwnershipCost - andrahandMonthly - alt3NewInterest - alt3ExtraInterest - alt3NewAmort - alt3ExtraAmort;
  const alt3Ranteavdrag = state.hasAlt3 ? calculateRanteavdrag((alt3NewInterest + alt3ExtraInterest) * 12) : 0;
  const alt3AnnualReturn = alt3MonthlyCashflow * 12 - annualRentalTax + alt3Ranteavdrag;
  const alt3MonthlyTakeHome = alt3AnnualReturn / 12;
  const alt3Roi = alt3TotalCash > 0 ? alt3AnnualReturn / alt3TotalCash * 100 : 0;
  const alt3NetYield = price > 0 ? alt3AnnualReturn / price * 100 : 0;
  const alt3TotalMonthlyCost = monthlyOwnershipCost + andrahandMonthly + alt3NewInterest + alt3ExtraInterest + alt3NewAmort + alt3ExtraAmort;

  // ── Direktavkastning (cap rate — financing-independent) ────────────
  const direktavkastning = price > 0
    ? (annualRentalIncome - monthlyOwnershipCost * 12 - andrahandMonthly * 12 - annualRentalTax) / price * 100
    : 0;

  // ── Section 1: Property Details ───────────────────────────────────
  const ptaxStr = br ? 'N/A' : hus
    ? formatSek(husFastighetsavgiftYearly) + '/yr'
    : (aglFastighetsavgiftYearly > 0 ? formatSek(aglFastighetsavgiftYearly) : '0 (exempt)');

  ['1', '2', '3'].forEach(a => {
    setCell('o-val' + a,  formatSek(price));
    setCell('o-ptax' + a, ptaxStr);
    setCell('o-type' + a, br ? 'Bostadsrätt' : hus ? 'Villa / Radhus / Kedjehus / Parhus' : 'Ägarrätt');
    if (br) {
      setCell('o-pantsattning' + a, formatSek(state.bostadsrattPantsattning || 0));
      setCell('o-overlatelse' + a,  formatSek(state.bostadsrattOverlatelseAvgift || 0));
    } else {
      setCell('o-pantsattning' + a, '—');
      setCell('o-overlatelse' + a,  '—');
    }
  });

  // Fastighetsavgift row label
  const ptaxLabelElement = document.getElementById('ptax-lbl');
  if (ptaxLabelElement) ptaxLabelElement.textContent = hus ? 'Fastighetsavgift' : 'Fastighetsskatt';

  const ptaxSubElement = document.getElementById('ptax-sub');
  if (ptaxSubElement) {
    ptaxSubElement.textContent = br
      ? 'Not applicable — bostadsrätt'
      : hus
        ? `min(${(state.taxeringsvarde || 0).toLocaleString('sv-SE')} × 0.75%, 10 425 kr) — income year 2026`
        : (state.isNewBuild ? 'Exempt — first 15 years (värdeår ≥ 2012)' : 'min(est. taxeringsvärde × 0.75%, 10 425 kr/yr)');
  }

  // ── Section 2: Financing ─────────────────────────────────────────
  ['1', '2', '3'].forEach(a => {
    setCell('o-dp'  + a, formatSek(downPayment));
    setCell('o-lag' + a, br ? 'N/A' : formatSek(lagfartAmount));
  });

  setCell('o-ex2', state.hasAlt2 ? formatSek(alt2ExtraLoan) : '—');
  setCell('o-ex3', state.hasAlt3 ? formatSek(alt3ExtraLoan) : '—');

  setCell('o-tdp1', formatSek(downPayment));
  setCell('o-tdp2', state.hasAlt2 ? formatSek(downPayment + alt2ExtraLoan) : formatSek(downPayment));
  setCell('o-tdp3', state.hasAlt3 ? formatSek(downPayment + alt3ExtraLoan) : formatSek(downPayment));

  setCell('o-loan1', formatSek(alt1Loan));
  setCell('o-loan2', state.hasAlt2 ? formatSek(alt2NewLoan) : '—');
  setCell('o-loan3', state.hasAlt3 ? formatSek(alt3NewLoan) : '—');

  if (price > 0) {
    const [ltv1Label, ltv1Class] = ltvLabelAndClass(alt1Loan, price);
    setCell('o-ltv1', ltv1Label, ltv1Class);
    if (state.hasAlt2) { const [l, c] = ltvLabelAndClass(alt2NewLoan, price); setCell('o-ltv2', l, c); }
    if (state.hasAlt3) { const [l, c] = ltvLabelAndClass(alt3NewLoan, price); setCell('o-ltv3', l, c); }
  }

  setCell('o-rate1', formatPct(newMortgageRate, 1));
  setCell('o-rate2', state.hasAlt2 ? (alt2NewLoan > 0 ? formatPct(newMortgageRate, 1) : '— (no new mortgage)') : '—');
  setCell('o-rate3', state.hasAlt3 ? (alt3NewLoan > 0 ? formatPct(newMortgageRate, 1) : '— (no new mortgage)') : '—');
  setCell('o-erate2', state.hasAlt2 ? formatPct(state.alt2InterestRate || 0, 1) : '—');
  setCell('o-erate3', state.hasAlt3 ? formatPct(state.alt3InterestRate || 0, 1) : '—');

  setCell('o-amor1', formatPct(newMortgageAmort, 1));
  setCell('o-amor2', state.hasAlt2 ? (alt2NewLoan > 0 ? formatPct(newMortgageAmort, 1) : '— (no new mortgage)') : '—');
  setCell('o-amor3', state.hasAlt3 ? (alt3NewLoan > 0 ? formatPct(newMortgageAmort, 1) : '— (no new mortgage)') : '—');
  setCell('o-eamor2', state.hasAlt2 ? formatPct(state.alt2AmortizationRate || 0, 1) : '—');
  setCell('o-eamor3', state.hasAlt3 ? formatPct(state.alt3AmortizationRate || 0, 1) : '—');

  setCell('o-pant1', br ? 'N/A' : formatSek(alt1Pantbrev));
  setCell('o-pant2', br ? 'N/A' : (state.hasAlt2 ? formatSek(alt2Pantbrev) : '—'));
  setCell('o-pant3', br ? 'N/A' : (state.hasAlt3 ? formatSek(alt3Pantbrev) : '—'));

  setCell('o-tot1', formatSek(alt1TotalCash));
  setCell('o-tot2', state.hasAlt2 ? formatSek(alt2TotalCash) : '—');
  setCell('o-tot3', state.hasAlt3 ? formatSek(alt3TotalCash) : '—');

  // Label and sub for total cash row
  const totLbl = document.getElementById('tot-lbl');
  const totSub = document.getElementById('tot-sub');
  const lagSub = document.getElementById('lag-sub');
  const pantSub = document.getElementById('pant-sub');
  if (totSub) totSub.textContent = br ? 'Down payment + pantsättning + överlåtelse' : 'Own savings + lagfart + pantbrev';
  if (lagSub) lagSub.textContent = hus ? '1.5% + 825 kr · one-time' : '1.5% of purchase price · one-time';
  if (pantSub) pantSub.textContent = br ? '' : 'max(0, loan − existing pantbrev) × 2% + 375 kr · applies to both hus and ägarlägenhet';

  // ── Section 3: Monthly Income & Costs ─────────────────────────────
  ['1', '2', '3'].forEach(a => {
    setCell('o-rent' + a, formatSek(monthlyRent));
    setCell('o-util' + a, formatSek(utilityReimbursement));
    setCell('o-inc'  + a, formatSek(totalMonthlyIncome));
    if (!br && !hus) setCell('o-ga'     + a, formatNegSek(state.monthlyGaFee));
    if (br)         setCell('o-mav'    + a, formatNegSek(state.monthlyManavgift || 0));
    if (br && (state.monthlyDriftkostnad || 0) > 0) setCell('o-drift' + a, formatNegSek(state.monthlyDriftkostnad || 0));
    if (hus)        setCell('o-husdrift' + a, formatNegSek(husMonthlyDrift));
    if (hus)        setCell('o-husfa'  + a, formatNegSek(husFastighetsavgiftMonthly));
    if (br && andrahandMonthly > 0) setCell('o-andrahand' + a, formatNegSek(andrahandMonthly));
    if (state.monthlyInsurance   > 0) setCell('o-ins'   + a, formatNegSek(state.monthlyInsurance));
    if (state.monthlyWater       > 0) setCell('o-water' + a, formatNegSek(state.monthlyWater));
    if (state.monthlyElectricity > 0) setCell('o-el'    + a, formatNegSek(state.monthlyElectricity));
    if (state.monthlyHeating     > 0) setCell('o-heat'  + a, formatNegSek(state.monthlyHeating));
    if (state.monthlyOtherCosts  > 0) setCell('o-oth'   + a, formatNegSek(state.monthlyOtherCosts));
  });

  setCell('o-int1', formatNegSek(alt1MonthlyInterest));
  setCell('o-int2', state.hasAlt2 ? formatNegSek(alt2NewInterest) : '—');
  setCell('o-int3', state.hasAlt3 ? formatNegSek(alt3NewInterest) : '—');
  setCell('o-eint2', state.hasAlt2 ? formatNegSek(alt2ExtraInterest) : '—');
  setCell('o-eint3', state.hasAlt3 ? formatNegSek(alt3ExtraInterest) : '—');
  setCell('o-eam2', state.hasAlt2 ? formatNegSek(alt2ExtraAmort) : '—');
  setCell('o-eam3', state.hasAlt3 ? formatNegSek(alt3ExtraAmort) : '—');
  setCell('o-am1', alt1MonthlyAmort ? formatNegSek(alt1MonthlyAmort) : '0 kr');
  setCell('o-am2', state.hasAlt2 ? (alt2NewAmort ? formatNegSek(alt2NewAmort) : '0 kr') : '—');
  setCell('o-am3', state.hasAlt3 ? (alt3NewAmort ? formatNegSek(alt3NewAmort) : '0 kr') : '—');
  setCell('o-cf1', formatSek(alt1MonthlyCashflow), alt1MonthlyCashflow >= 0 ? 'pos' : 'neg');
  setCell('o-cf2', state.hasAlt2 ? formatSek(alt2MonthlyCashflow) : '', (state.hasAlt2 && alt2MonthlyCashflow >= 0) ? 'pos' : 'neg');
  setCell('o-cf3', state.hasAlt3 ? formatSek(alt3MonthlyCashflow) : '', (state.hasAlt3 && alt3MonthlyCashflow >= 0) ? 'pos' : 'neg');

  // ── Section 4: Rental Tax ─────────────────────────────────────────
  ['1', '2', '3'].forEach(a => {
    setCell('o-ann'  + a, formatSek(annualRentalIncome));
    setCell('o-20p'  + a, formatNegSek(schablonavdragVariable));
    setCell('o-sur'  + a, formatSek(taxableSurplus));
    setCell('o-tax'  + a, formatSek(annualRentalTax));
  });

  // Update 20% deduction row label for BR
  const lbl20p = document.getElementById('row-20p-lbl');
  const tip20pBox = document.getElementById('tip-20p');
  if (br) {
    if (lbl20p) lbl20p.textContent = '(−) BRF Fee Deduction — Månadsavgift × 12';
    if (tip20pBox) tip20pBox.innerHTML = 'For bostadsrätt, Skatteverket allows you to deduct the full annual BRF fee (månadsavgift × 12) instead of a flat 20%.'
      + `<span class="tip-formula"><b>Formula:</b> Månadsavgift × 12 = ${formatSek(state.monthlyManavgift || 0)} × 12 = <b>${formatSek(schablonavdragVariable)}</b></span>`;
  } else {
    if (lbl20p) lbl20p.textContent = '(−) 20% Variable Deduction';
    if (tip20pBox) tip20pBox.innerHTML = 'Variable deduction equal to 20% of annual rental income.'
      + `<span class="tip-formula"><b>Formula:</b> Annual rental income × 20% = ${formatSek(annualRentalIncome)} × 20% = <b>${formatSek(schablonavdragVariable)}</b></span>`;
  }

  // ── Section 5: Investment Returns ────────────────────────────────
  setCell('o-acf1', formatSek(alt1MonthlyCashflow * 12));
  setCell('o-acf2', state.hasAlt2 ? formatSek(alt2MonthlyCashflow * 12) : '—');
  setCell('o-acf3', state.hasAlt3 ? formatSek(alt3MonthlyCashflow * 12) : '—');

  setCell('o-taxb1', formatNegSek(annualRentalTax));
  setCell('o-taxb2', formatNegSek(annualRentalTax));
  setCell('o-taxb3', formatNegSek(annualRentalTax));

  setCell('o-ra1', '+' + formatSek(alt1Ranteavdrag), 'pos');
  setCell('o-ra2', state.hasAlt2 ? '+' + formatSek(alt2Ranteavdrag) : '—', 'pos');
  setCell('o-ra3', state.hasAlt3 ? '+' + formatSek(alt3Ranteavdrag) : '—', 'pos');

  setCell('o-ret1', formatSek(alt1AnnualReturn), alt1AnnualReturn >= 0 ? 'pos' : 'neg');
  setCell('o-ret2', state.hasAlt2 ? formatSek(alt2AnnualReturn) : '—', alt2AnnualReturn >= 0 ? 'pos' : 'neg');
  setCell('o-ret3', state.hasAlt3 ? formatSek(alt3AnnualReturn) : '—', alt3AnnualReturn >= 0 ? 'pos' : 'neg');

  setCell('o-mth1', formatSek(alt1MonthlyTakeHome), alt1MonthlyTakeHome >= 0 ? 'pos' : 'neg');
  setCell('o-mth2', state.hasAlt2 ? formatSek(alt2MonthlyTakeHome) : '—', alt2MonthlyTakeHome >= 0 ? 'pos' : 'neg');
  setCell('o-mth3', state.hasAlt3 ? formatSek(alt3MonthlyTakeHome) : '—', alt3MonthlyTakeHome >= 0 ? 'pos' : 'neg');

  setCell('o-cap1', formatSek(alt1TotalCash));
  setCell('o-cap2', state.hasAlt2 ? formatSek(alt2TotalCash) : '—');
  setCell('o-cap3', state.hasAlt3 ? formatSek(alt3TotalCash) : '—');

  setCell('o-ny1', formatPct(alt1NetYield));
  setCell('o-ny2', state.hasAlt2 ? formatPct(alt2NetYield) : '—');
  setCell('o-ny3', state.hasAlt3 ? formatPct(alt3NetYield) : '—');

  setCell('o-roi1', formatPct(alt1Roi));
  setCell('o-roi2', state.hasAlt2 ? formatPct(alt2Roi) : '—');
  setCell('o-roi3', state.hasAlt3 ? formatPct(alt3Roi) : '—');

  setCell('o-gy1', formatPct(alt1GrossYield));
  setCell('o-gy2', formatPct(alt1GrossYield));  // same for all alts
  setCell('o-gy3', formatPct(alt1GrossYield));

  setCell('o-dy1', formatPct(direktavkastning));
  setCell('o-dy2', formatPct(direktavkastning));  // same for all alts
  setCell('o-dy3', formatPct(direktavkastning));

  // ── Advanced return analysis (opportunity cost + appreciation) ────
  const opportunityCostRate = state.alternativeReturnRate || 0;
  const appreciationRate = state.expectedAppreciationRate || 0;
  const showAdvanced = opportunityCostRate > 0 || appreciationRate > 0;

  document.querySelectorAll('.adv-row').forEach(el => { el.style.display = showAdvanced ? '' : 'none'; });

  if (showAdvanced) {
    const appreciationReturnYearly = Math.round(price * appreciationRate / 100);
    const opp1 = Math.round(alt1TotalCash * opportunityCostRate / 100);
    const opp2 = state.hasAlt2 ? Math.round(alt2TotalCash * opportunityCostRate / 100) : 0;
    const opp3 = state.hasAlt3 ? Math.round(alt3TotalCash * opportunityCostRate / 100) : 0;
    const econ1 = alt1AnnualReturn + appreciationReturnYearly - opp1;
    const econ2 = alt2AnnualReturn + appreciationReturnYearly - opp2;
    const econ3 = alt3AnnualReturn + appreciationReturnYearly - opp3;

    const showApp = appreciationRate > 0;
    const showOpp = opportunityCostRate > 0;
    const appRow = document.getElementById('row-app-tr');
    const oppRow = document.getElementById('row-opp-tr');
    const econRow = document.getElementById('row-econret-tr');
    if (appRow) appRow.style.display = showApp ? '' : 'none';
    if (oppRow) oppRow.style.display = showOpp ? '' : 'none';
    if (econRow) econRow.style.display = '';

    if (showApp) {
      const appSubEl = document.getElementById('row-app-sub');
      if (appSubEl) appSubEl.textContent = `${formatPct(appreciationRate, 1)}/yr · ${formatSek(price)} × ${formatPct(appreciationRate, 1)} — gross pre-tax`;
      setCell('o-app1', '+' + formatSek(appreciationReturnYearly), 'pos');
      setCell('o-app2', state.hasAlt2 ? '+' + formatSek(appreciationReturnYearly) : '—', 'pos');
      setCell('o-app3', state.hasAlt3 ? '+' + formatSek(appreciationReturnYearly) : '—', 'pos');
    }
    if (showOpp) {
      setCell('o-opp1', formatNegSek(opp1));
      setCell('o-opp2', state.hasAlt2 ? formatNegSek(opp2) : '—');
      setCell('o-opp3', state.hasAlt3 ? formatNegSek(opp3) : '—');
    }
    setCell('o-econret1', formatSek(econ1), econ1 >= 0 ? 'pos' : 'neg');
    setCell('o-econret2', state.hasAlt2 ? formatSek(econ2) : '—', econ2 >= 0 ? 'pos' : 'neg');
    setCell('o-econret3', state.hasAlt3 ? formatSek(econ3) : '—', econ3 >= 0 ? 'pos' : 'neg');

    const hdrParts = [];
    if (showApp) hdrParts.push('Appreciation ' + formatPct(appreciationRate, 1) + '/yr');
    if (showOpp) hdrParts.push('Opportunity cost ' + formatPct(opportunityCostRate, 1) + '/yr');
    const hdrEl = document.getElementById('row-adv-hdr-txt');
    if (hdrEl) hdrEl.textContent = 'Advanced Return Analysis — ' + hdrParts.join(' · ');
  }

  // ── Summary cards ─────────────────────────────────────────────────
  setText('s1-th',   Math.round(alt1MonthlyTakeHome).toLocaleString('sv-SE') + ' kr/mth');
  setText('s1-roi',  formatPct(alt1Roi));
  setText('s1-cap',  formatThousands(alt1TotalCash) + ' SEK');
  setText('s1-int',  Math.round(alt1MonthlyInterest).toLocaleString('sv-SE') + ' kr/mth');
  setText('s1-cost', Math.round(alt1TotalMonthlyCost).toLocaleString('sv-SE') + ' kr/mth');

  if (state.hasAlt2) {
    setText('s2-th',   Math.round(alt2MonthlyTakeHome).toLocaleString('sv-SE') + ' kr/mth');
    setText('s2-roi',  formatPct(alt2Roi));
    setText('s2-cap',  formatThousands(alt2TotalCash) + ' SEK');
    setText('s2-int',  Math.round(alt2NewInterest + alt2ExtraInterest).toLocaleString('sv-SE') + ' kr/mth');
    setText('s2-cost', Math.round(alt2TotalMonthlyCost).toLocaleString('sv-SE') + ' kr/mth');
  }
  if (state.hasAlt3) {
    setText('s3-th',   Math.round(alt3MonthlyTakeHome).toLocaleString('sv-SE') + ' kr/mth');
    setText('s3-roi',  formatPct(alt3Roi));
    setText('s3-cap',  formatThousands(alt3TotalCash) + ' SEK');
    setText('s3-int',  Math.round(alt3NewInterest + alt3ExtraInterest).toLocaleString('sv-SE') + ' kr/mth');
    setText('s3-cost', Math.round(alt3TotalMonthlyCost).toLocaleString('sv-SE') + ' kr/mth');
  }

  // ── Dynamic formula tooltips ──────────────────────────────────────
  updateTooltip('tdp',
    'Total cash sent to seller on closing day.',
    'Own savings + Extra loan from existing apt',
    `${formatSek(downPayment)} + ${formatSek(alt2ExtraLoan)} = <b>${formatSek(downPayment + alt2ExtraLoan)}</b> (Alt. 2 example)`);

  updateTooltip('loan',
    'The bank wires this to the seller. Zero when the full remaining price is covered by the existing apt top-up.',
    'Purchase price − Own savings − Extra loan',
    `${formatSek(price)} − ${formatSek(downPayment)} − extra = <b>${formatSek(alt1Loan)}</b> (Alt. 1)`);

  updateTooltip('ltv',
    'Loan-to-value ratio on the new property. Determines amortization under amorteringskravet (2026: max 90%).',
    'New mortgage ÷ Purchase price × 100',
    `${formatSek(alt1Loan)} ÷ ${formatSek(price)} = <b>${formatPct(alt1Loan / price * 100, 1)}</b> (Alt. 1)`);

  updateTooltip('lag',
    'One-time stamp duty paid to Lantmäteriet on registration. Same for all financing alternatives.'
      + (state.lagfartOverride !== null && state.lagfartOverride !== undefined ? ' <b style="color:#f0c040">(custom amount)</b>' : ''),
    state.lagfartOverride !== null && state.lagfartOverride !== undefined
      ? 'Manually overridden in wizard'
      : 'Purchase price × 1.5% + 825 kr',
    state.lagfartOverride !== null && state.lagfartOverride !== undefined
      ? `<b>Override: ${formatSek(lagfartAmount)}</b> (formula would be ${formatSek(Math.round(price * 0.015) + 825)})`
      : `${formatSek(price)} × 1.5% + 825 kr = <b>${formatSek(lagfartAmount)}</b>`);

  updateTooltip('pant',
    'One-time mortgage deed fee. Alt. 2/3 pay less because their new mortgage is smaller (or zero).'
      + (state.pantbrevAlt1Override !== null && state.pantbrevAlt1Override !== undefined ? ' <b style="color:#f0c040">(custom Alt. 1)</b>' : ''),
    'New mortgage × 2% (or custom amount)',
    `<b>${formatSek(alt1Pantbrev)}</b> Alt. 1`
      + (state.hasAlt2 ? ` · <b>${formatSek(alt2Pantbrev)}</b> Alt. 2` : '')
      + (state.hasAlt3 ? ` · <b>${formatSek(alt3Pantbrev)}</b> Alt. 3` : ''));

  updateTooltip('tot',
    'All cash you need on closing day. The extra apartment loan is debt — not counted here.',
    'Own savings + Lagfart + Pantbrev',
    `${formatSek(downPayment)} + ${formatSek(lagfartAmount)} + ${formatSek(alt1Pantbrev)} = <b>${formatSek(alt1TotalCash)}</b> (Alt. 1)`
      + (state.hasAlt2 ? `<br>${formatSek(downPayment)} + ${formatSek(lagfartAmount)} + ${formatSek(alt2Pantbrev)} = <b>${formatSek(alt2TotalCash)}</b> (Alt. 2)` : ''));

  updateTooltip('int',
    'Monthly interest on the new property mortgage. Zero for Alt. 2 when full price is covered by existing apt top-up.',
    'New mortgage × Interest rate ÷ 12',
    `${formatSek(alt1Loan)} × ${formatPct(newMortgageRate, 1)} ÷ 12 = <b>${formatSek(alt1MonthlyInterest)}/mth</b>`
      + (state.hasAlt2 && alt2NewInterest === 0 ? ' · Alt. 2: <b>0 kr</b> (no new mortgage)' : ''));

  updateTooltip('eint',
    'Monthly interest on the extra loan taken from the existing apartment.',
    'Extra loan × Existing loan rate ÷ 12',
    state.hasAlt2
      ? `${formatSek(alt2ExtraLoan)} × ${formatPct(state.alt2InterestRate || 0, 1)} ÷ 12 = <b>${formatSek(alt2ExtraInterest)}/mth</b> (Alt. 2)`
      : 'Add Alt. 2 or Alt. 3 to see values');

  updateTooltip('eam',
    'Monthly amortization on the existing apt top-up. KEY cash-flow difference between Alt. 2 and Alt. 3.',
    'Extra loan × Amortization % ÷ 12',
    state.hasAlt2
      ? `${formatSek(alt2ExtraLoan)} × ${formatPct(state.alt2AmortizationRate || 0, 1)} ÷ 12 = <b>${formatSek(alt2ExtraAmort)}/mth</b> (Alt. 2)`
      : 'Add Alt. 2 or Alt. 3 to see values');

  updateTooltip('am',
    'Monthly amortization on the new property mortgage.',
    'New mortgage × Amortization % ÷ 12',
    `${formatSek(alt1Loan)} × ${formatPct(newMortgageAmort, 1)} ÷ 12 = <b>${alt1MonthlyAmort ? formatSek(alt1MonthlyAmort) : '0 kr'}/mth</b> (Alt. 1)`);

  updateTooltip('cf',
    'Net monthly cash in hand before the annual Skatteverket rental tax.',
    'Total income − Ownership costs − New mortgage interest − Top-up interest − Top-up amortization − New mortgage amortization',
    `${formatSek(totalMonthlyIncome)} − ${formatSek(monthlyOwnershipCost)} − ${formatSek(alt1MonthlyInterest)} − ${formatSek(alt1MonthlyAmort)} = <b>${formatSek(alt1MonthlyCashflow)}/mth</b> (Alt. 1)`
      + (state.hasAlt2 ? `<br>Alt. 2: <b>${formatSek(alt2MonthlyCashflow)}/mth</b>` : ''));

  updateTooltip('ann',
    'Annual rental income from the tenant. Same for all financing alternatives.',
    '(Base rent + Utility reimbursement) × 12',
    `(${formatSek(monthlyRent)} + ${formatSek(utilityReimbursement)}) × 12 = <b>${formatSek(annualRentalIncome)}</b>`);

  updateTooltip('sur',
    'The only amount subject to the 30% capital tax. Effective rate on gross rent is much lower.',
    br ? 'Annual income − 40,000 − Månadsavgift × 12' : 'Annual income − 40,000 − (Annual income × 20%)',
    `${formatSek(annualRentalIncome)} − 40 000 − ${formatSek(schablonavdragVariable)} = <b>${formatSek(taxableSurplus)}</b>`);

  updateTooltip('tax',
    'Paid once per year in the May deklaration. Same for all financing alternatives. Tip: set aside ÷12 each month.',
    'Taxable surplus × 30%',
    `${formatSek(taxableSurplus)} × 30% = <b>${formatSek(annualRentalTax)}</b>/yr · ${formatSek(Math.round(annualRentalTax / 12))}/mth`);

  updateTooltip('acf',
    'Annualised cash flow before the Skatteverket rental tax.',
    'Monthly Cash Flow Before Tax × 12',
    `${formatSek(alt1MonthlyCashflow)} × 12 = <b>${formatSek(alt1MonthlyCashflow * 12)}</b> (Alt. 1)`
      + (state.hasAlt2 ? ` · Alt. 2: <b>${formatSek(alt2MonthlyCashflow * 12)}</b>` : ''));

  updateTooltip('taxb',
    'Same for all financing alternatives — tax depends only on rental income, not on financing.',
    'Taxable surplus × 30%',
    `${formatSek(taxableSurplus)} × 30% = <b>${formatSek(annualRentalTax)}</b>/yr`);

  updateTooltip('ret',
    'What you actually keep each year after ALL costs and Skatteverket. The definitive comparison number.',
    'Annual Net Cash Flow Before Tax − Annual Rental Tax',
    `${formatSek(alt1MonthlyCashflow * 12)} − ${formatSek(annualRentalTax)} = <b>${formatSek(alt1AnnualReturn)}</b> (Alt. 1)`
      + (state.hasAlt2 ? `<br>Alt. 2: ${formatSek(alt2MonthlyCashflow * 12)} − ${formatSek(annualRentalTax)} = <b>${formatSek(alt2AnnualReturn)}</b>` : ''));

  updateTooltip('mth',
    'Monthly equivalent of annual return — shown on the summary cards at top. Your net monthly profit.',
    'Annual Return After Tax ÷ 12',
    `${formatSek(alt1AnnualReturn)} ÷ 12 = <b>${formatSek(alt1MonthlyTakeHome)}/mth</b> (Alt. 1)`
      + (state.hasAlt2 ? ` · Alt. 2: <b>${formatSek(alt2MonthlyTakeHome)}/mth</b>` : ''));

  updateTooltip('cap',
    'All your own cash tied up in this purchase. Extra apartment loan is debt — not counted.',
    'Own savings + Lagfart + Pantbrev',
    `${formatSek(downPayment)} + ${formatSek(lagfartAmount)} + ${formatSek(alt1Pantbrev)} = <b>${formatSek(alt1TotalCash)}</b> (Alt. 1)`
      + (state.hasAlt2 ? ` · Alt. 2: <b>${formatSek(alt2TotalCash)}</b>` : ''));

  updateTooltip('ny',
    'Return on the full property value after all costs including financing. Differs per alt because interest costs differ.',
    'Annual Return After Tax (incl. interest & amortization) ÷ Purchase Price × 100',
    `${formatSek(alt1AnnualReturn)} ÷ ${formatSek(price)} = <b>${formatPct(alt1NetYield)}</b> (Alt. 1)`
      + (state.hasAlt2 ? ` · Alt. 2: <b>${formatPct(alt2NetYield)}</b>` : ''));

  updateTooltip('roi',
    'Yield on the cash you actually put in. Leverage amplifies this above the property yield.',
    'Annual Return After Tax ÷ Total Invested Capital × 100',
    `${formatSek(alt1AnnualReturn)} ÷ ${formatSek(alt1TotalCash)} = <b>${formatPct(alt1Roi)}</b> (Alt. 1)`
      + (state.hasAlt2 ? `<br>Alt. 2: ${formatSek(alt2AnnualReturn)} ÷ ${formatSek(alt2TotalCash)} = <b>${formatPct(alt2Roi)}</b>` : ''));

  updateTooltip('gy',
    'Market benchmark before any costs or tax. ~4–5% typical for Swedish cities. Same for all financing alternatives.',
    'Annual Rent ÷ Purchase Price × 100',
    `${formatSek(annualRentalIncome)} ÷ ${formatSek(price)} = <b>${formatPct(alt1GrossYield)}</b>`);

  updateTooltip('dy',
    'Standard Swedish cap rate (direktavkastning) — the property\'s intrinsic yield regardless of financing. Compare this against your mortgage rate.',
    '(Annual Rent − Operating Costs − Rental Tax) ÷ Property Price × 100',
    `(${formatSek(annualRentalIncome)} − ${formatSek(monthlyOwnershipCost * 12 + andrahandMonthly * 12)} − ${formatSek(annualRentalTax)}) ÷ ${formatSek(price)} = <b>${formatPct(direktavkastning)}</b>`);

  // ── Sequential alt display labels ─────────────────────────────────
  renderAltDisplayLabels(state);

  // ── Autosave ──────────────────────────────────────────────────────
  autosaveCurrentSession();
}

/**
 * Update the sequential financing alternative display labels (cards, column headers, subtitle).
 *
 * @param {Object} state
 */
function renderAltDisplayLabels(state) {
  const resultsPage = document.getElementById('resultsPage');
  if (!resultsPage?.classList.contains('show')) return;

  const lang = getCurrentLanguage();
  const isFarsi = lang === 'fa';
  const persianNumerals = ['', '۱', '۲', '۳'];

  function numberString(n) {
    return isFarsi ? persianNumerals[n] : String(n);
  }

  // Sequential display numbers
  let nextDisplayNumber = 2;
  const displayNumbers = {};
  if (state.hasAlt2) { displayNumbers[2] = nextDisplayNumber++; }
  if (state.hasAlt3) { displayNumbers[3] = nextDisplayNumber++; }

  const prefixes = { en: 'Financing Alt.', sv: 'Finansieringsalt.', fa: 'گزینه مالی' };
  const altDescriptions = {
    2: { en: 'Large Existing Top-up', sv: 'Stort befintligt tilläggslån', fa: 'وام اضافی بزرگ موجود' },
    3: { en: 'Small Existing Top-up', sv: 'Litet befintligt tilläggslån', fa: 'وام اضافی کوچک موجود' },
  };
  const prefix = prefixes[lang] || prefixes.en;

  // Card titles
  const card2Header = document.getElementById('card2-h3');
  const card3Header = document.getElementById('card3-h3');
  if (card2Header && state.hasAlt2) {
    const displayNum = displayNumbers[2];
    const desc = (altDescriptions[2][lang] || altDescriptions[2].en);
    card2Header.textContent = `${prefix} ${numberString(displayNum)} — ${desc}`;
  }
  if (card3Header && state.hasAlt3) {
    const displayNum = displayNumbers[3];
    const desc = (altDescriptions[3][lang] || altDescriptions[3].en);
    card3Header.textContent = `${prefix} ${numberString(displayNum)} — ${desc}`;
  }

  // Column header labels
  document.querySelectorAll('.ch.alt1 .col-alt-label').forEach(el => {
    el.textContent = isFarsi ? `${prefix} ۱` : 'Alt. 1';
  });
  document.querySelectorAll('.ch.alt2 .col-alt-label').forEach(el => {
    const d = displayNumbers[2] || 2;
    el.textContent = isFarsi ? `${prefix} ${numberString(d)}` : `Alt. ${d}`;
  });
  document.querySelectorAll('.ch.alt3 .col-alt-label').forEach(el => {
    const d = displayNumbers[3] || 3;
    el.textContent = isFarsi ? `${prefix} ${numberString(d)}` : `Alt. ${d}`;
  });

  // Results page subtitle
  const subtitleElement = document.getElementById('r-sub');
  if (subtitleElement) {
    const pt = state.propertyType;
    const typeLabel = pt === 'bostadsratt' ? 'Bostadsrätt' : pt === 'hus' ? 'Villa / Radhus / Kedjehus / Parhus' : 'Ägarlägenhet';
    let subtitle = typeLabel + ' · Alt. 1';
    if (state.hasAlt2) subtitle += ` · Alt. ${displayNumbers[2]}`;
    if (state.hasAlt3) subtitle += ` · Alt. ${displayNumbers[3]}`;
    subtitleElement.textContent = subtitle;
  }
}
