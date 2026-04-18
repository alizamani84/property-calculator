/**
 * Export manager.
 * Handles JSON export (current session, all sessions) and Markdown report export.
 */

import { appState } from '../state/app-state.js';
import { loadSessions, serializeStateToExportFormat } from '../state/session-storage.js';
import { showToast } from './results-controller.js';

/**
 * Open the download options modal.
 */
export function openDownloadModal() {
  document.getElementById('dlOverlay')?.classList.remove('hidden');
}

/**
 * Close the download modal.
 */
export function closeDownloadModal() {
  document.getElementById('dlOverlay')?.classList.add('hidden');
}

/**
 * Trigger a file download with the given content.
 *
 * @param {string} content - file content
 * @param {string} filename
 * @param {string} mimeType
 */
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(blob);
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}

/**
 * Sanitize a string for use as a filename (allow Swedish chars).
 *
 * @param {string} name
 * @returns {string}
 */
function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9åäöÅÄÖ _-]/g, '_');
}

/**
 * Export the current session or all saved sessions as structured JSON.
 *
 * @param {'current'|'all'} type
 */
export function exportAsJson(type) {
  closeDownloadModal();

  if (type === 'all') {
    const savedSessions = loadSessions();
    if (!savedSessions.length) {
      showToast('⚠️ No saved sessions to download');
      return;
    }
    const allData = savedSessions.map(session =>
      serializeStateToExportFormat(session.state, session.name, session.savedAt)
    );
    const filename = 'all-property-calculations_' + new Date().toLocaleDateString('sv-SE') + '.json';
    downloadFile(JSON.stringify(allData, null, 2), filename, 'application/json');
    showToast('⬇️ Downloaded ' + savedSessions.length + ' saved session' + (savedSessions.length > 1 ? 's' : ''));
    return;
  }

  // Current session
  const sessionName = appState.sessionName || appState.propertyName || 'property-calculation';
  const exportData = serializeStateToExportFormat(appState, sessionName, null);
  const filename = sanitizeFilename(sessionName) + '.json';
  downloadFile(JSON.stringify(exportData, null, 2), filename, 'application/json');
  showToast('⬇️ Downloaded "' + filename + '"');
}

/**
 * Export the current session as a readable Markdown/text report.
 */
export function exportAsMarkdown() {
  closeDownloadModal();

  const state = appState;
  const price = state.purchasePrice || 0;
  const downPayment = state.downPayment || 0;
  const br = state.propertyType === 'bostadsratt';
  const hus = state.propertyType === 'hus';
  const typeLabel = br ? 'Bostadsrätt' : hus ? 'Villa / Radhus / Kedjehus / Parhus' : 'Ägarlägenhet';

  const formatSek = n => Math.round(n).toLocaleString('sv-SE') + ' kr';
  const formatPct = (n, d = 2) => (+n).toFixed(d) + '%';
  const sessionName = state.sessionName || state.propertyName || 'property';
  const reportDate = new Date().toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' });

  // Recalculate (mirrors the engine logic, kept local for independence)
  const monthlyRent = state.monthlyRent || 0;
  const utilityReimbursement = state.monthlyUtilityReimbursement || 0;
  const totalMonthlyIncome = monthlyRent + utilityReimbursement;
  const annualRentalIncome = totalMonthlyIncome * 12;

  const schablonavdragVariable = br ? (state.monthlyManavgift || 0) * 12 : annualRentalIncome * 0.2;
  const taxableSurplus = Math.max(0, annualRentalIncome - 40000 - schablonavdragVariable);
  const annualRentalTax = Math.round(taxableSurplus * 0.30);

  const husFastighetsavgiftYearly = hus ? Math.min(Math.round((state.taxeringsvarde || 0) * 0.0075), 10425) : 0;
  const husFastighetsavgiftMonthly = Math.round(husFastighetsavgiftYearly / 12);
  const husMonthlyDrift = hus ? Math.round((state.annualHusRunningCosts || 0) / 12) : 0;
  const aglFastighetsavgiftYearly = (!br && !hus && !state.isNewBuild) ? Math.min(Math.round(price * 0.75 * 0.0075), 10425) : 0;
  const aglFastighetsavgiftMonthly = Math.round(aglFastighetsavgiftYearly / 12);

  const monthlyOwnershipCost = (
    br ? state.monthlyManavgift + (state.monthlyDriftkostnad || 0)
    : hus ? husMonthlyDrift + husFastighetsavgiftMonthly
    : (state.monthlyGaFee || 0) + aglFastighetsavgiftMonthly
  )
  + (state.monthlyInsurance || 0)
  + (state.monthlyWater || 0)
  + (state.monthlyElectricity || 0)
  + (state.monthlyHeating || 0)
  + (state.monthlyOtherCosts || 0);

  const andrahandMonthly = br ? Math.round((state.andrahandAvgiftAnnual || 5880) / 12) : 0;
  const lagfartDefault = br ? 0 : Math.round(price * 0.015) + 825;
  const lagfartAmount = (state.lagfartOverride !== null && state.lagfartOverride !== undefined)
    ? state.lagfartOverride : lagfartDefault;
  const brOnetimeFees = br ? (state.bostadsrattPantsattning || 0) + (state.bostadsrattOverlatelseAvgift || 0) : 0;
  const existingPantbrev = br ? 0 : (state.existingPantbrev || 0);

  function calcPantbrev(loan, override) {
    if (br) return 0;
    if (override !== null && override !== undefined) return override;
    const newPant = Math.max(0, loan - existingPantbrev);
    return newPant > 0 ? Math.round(newPant * 0.02) + 375 : 0;
  }

  function calcRanteavdrag(annualInterest) {
    return annualInterest <= 0 ? 0
      : Math.round(Math.min(annualInterest, 100000) * 0.30 + Math.max(0, annualInterest - 100000) * 0.21);
  }

  function buildScenarioResult(extraLoan, extraRate, extraAmort, pantOverride) {
    const newLoan = Math.max(0, price - downPayment - (extraLoan || 0));
    const pantbrev = calcPantbrev(newLoan, pantOverride);
    const totalCash = br ? downPayment + brOnetimeFees : downPayment + lagfartAmount + pantbrev;
    const newInterest = Math.round(newLoan * (state.newMortgageInterestRate || 0) / 100 / 12);
    const newAmort = Math.round(newLoan * (state.newMortgageAmortizationRate || 0) / 100 / 12);
    const extraInterest = extraLoan ? Math.round(extraLoan * extraRate / 100 / 12) : 0;
    const extraAmortMth = extraLoan ? Math.round(extraLoan * extraAmort / 100 / 12) : 0;
    const cashflow = totalMonthlyIncome - monthlyOwnershipCost - andrahandMonthly - newInterest - extraInterest - newAmort - extraAmortMth;
    const ranteavdrag = calcRanteavdrag((newInterest + extraInterest) * 12);
    const annualReturn = cashflow * 12 - annualRentalTax + ranteavdrag;
    return {
      newLoan, pantbrev, totalCash, newInterest, extraInterest, newAmort, extraAmortMth,
      cashflow, ranteavdrag, annualReturn,
      monthlyTakeHome: annualReturn / 12,
      roi: totalCash > 0 ? annualReturn / totalCash * 100 : 0,
      netYield: price > 0 ? annualReturn / price * 100 : 0,
      grossYield: price > 0 ? annualRentalIncome / price * 100 : 0,
      direktavkastning: price > 0 ? (annualRentalIncome - monthlyOwnershipCost * 12 - andrahandMonthly * 12 - annualRentalTax) / price * 100 : 0,
      ltv: price > 0 ? newLoan / price * 100 : 0,
    };
  }

  const alt1 = buildScenarioResult(0, 0, 0, state.pantbrevAlt1Override);
  const alt2 = state.hasAlt2 ? buildScenarioResult(state.alt2ExtraLoan || 0, state.alt2InterestRate || 0, state.alt2AmortizationRate || 0, state.pantbrevAlt2Override) : null;
  const alt3 = state.hasAlt3 ? buildScenarioResult(state.alt3ExtraLoan || 0, state.alt3InterestRate || 0, state.alt3AmortizationRate || 0, state.pantbrevAlt3Override) : null;

  const row = (label, val, unit = '') => `| ${label} | ${val}${unit ? ' ' + unit : ''} |\n`;
  const hr = '---';

  let md = `# ${state.propertyName || 'Property'} — Investment Report\n\n`;
  md += `*Generated ${reportDate} by Swedish Property Investment Calculator*\n\n`;
  md += `${hr}\n\n`;

  if (state.propertyLinks && state.propertyLinks.length) {
    md += `## Links\n\n`;
    state.propertyLinks.forEach(link => {
      md += `- [${link.label || link.lbl || link.url}](${link.url})\n`;
    });
    md += `\n`;
  }

  md += `## Property Overview\n\n`;
  md += `| | |\n|---|---|\n`;
  md += row('Type', typeLabel);
  md += row('Purchase price', formatSek(price));
  if (hus) {
    md += row('Taxeringsvärde', formatSek(state.taxeringsvarde || 0));
    md += row('Existing pantbrev', formatSek(state.existingPantbrev || 0));
  } else if (!br && (state.existingPantbrev || 0) > 0) {
    md += row('Existing pantbrev', formatSek(state.existingPantbrev || 0));
  }
  md += row('New build / tax exempt', state.isNewBuild ? 'Yes — exempt 15 yrs' : 'No');
  md += `\n`;

  md += `## Monthly Ownership Costs\n\n`;
  md += `| Cost item | Amount |\n|---|---|\n`;
  if (br) {
    md += row('Månadsavgift (BRF fee)', formatSek(state.monthlyManavgift || 0));
    if (state.monthlyDriftkostnad) md += row('Driftkostnad', formatSek(state.monthlyDriftkostnad));
    if (andrahandMonthly) md += row('Andrahand avgift (monthly)', formatSek(andrahandMonthly));
  } else if (hus) {
    md += row('Driftkostnad (annual ÷ 12)', formatSek(husMonthlyDrift));
    md += row('Fastighetsavgift (monthly)', formatSek(husFastighetsavgiftMonthly));
  } else {
    if (state.monthlyGaFee) md += row('GA / Samfällighet', formatSek(state.monthlyGaFee));
    if (!state.isNewBuild) md += row('Fastighetsavgift (est. monthly)', formatSek(aglFastighetsavgiftMonthly));
  }
  if (state.monthlyInsurance)   md += row('Insurance',    formatSek(state.monthlyInsurance));
  if (state.monthlyWater)       md += row('Water',        formatSek(state.monthlyWater));
  if (state.monthlyElectricity) md += row('Electricity',  formatSek(state.monthlyElectricity));
  if (state.monthlyHeating)     md += row('Heating',      formatSek(state.monthlyHeating));
  if (state.monthlyOtherCosts)  md += row('Other',        formatSek(state.monthlyOtherCosts));
  md += row('**Total ownership cost/month**', `**${formatSek(monthlyOwnershipCost)}**`);
  md += `\n`;

  md += `## Rental Income\n\n`;
  md += `| | |\n|---|---|\n`;
  md += row('Monthly rent', formatSek(monthlyRent));
  if (utilityReimbursement) md += row('Utility reimbursement from tenant', formatSek(utilityReimbursement));
  md += row('**Total monthly income**', `**${formatSek(totalMonthlyIncome)}**`);
  md += `\n`;

  md += `## Rental Income Tax (Schablonavdrag)\n\n`;
  md += `| | |\n|---|---|\n`;
  md += row('Annual gross income', formatSek(annualRentalIncome));
  md += row('Fixed deduction (40 000 kr)', formatSek(40000));
  if (br) {
    md += row('BRF månadsavgift deduction', formatSek(schablonavdragVariable));
  } else {
    md += row('20% gross rent deduction', formatSek(schablonavdragVariable));
  }
  md += row('Taxable surplus', formatSek(taxableSurplus));
  md += row('**Annual rental tax (30%)**', `**${formatSek(annualRentalTax)}**`);
  md += `\n`;

  md += `## One-Time Purchase Costs\n\n`;
  md += `| | |\n|---|---|\n`;
  md += row('Down payment', formatSek(downPayment));
  if (!br) {
    md += row('Lagfart (1.5% + 825 kr)', formatSek(lagfartAmount));
  } else {
    if (state.bostadsrattPantsattning) md += row('Pantsättningsavgift (BRF)', formatSek(state.bostadsrattPantsattning));
    if (state.bostadsrattOverlatelseAvgift) md += row('Överlåtelseavgift (BRF)', formatSek(state.bostadsrattOverlatelseAvgift));
  }
  md += `\n`;

  const buildScenarioSection = (label, result, extraLoan, extraRate, extraAmort) => {
    let section = `### ${label}\n\n`;
    section += `| | |\n|---|---|\n`;
    section += row('New mortgage', formatSek(result.newLoan));
    if (extraLoan) {
      section += row('Extra loan (existing apartment)', formatSek(extraLoan));
      section += row('Extra loan interest rate', formatPct(extraRate, 1));
      section += row('Extra loan amortization', formatPct(extraAmort, 1));
    }
    section += row('LTV', formatPct(result.ltv, 1));
    section += row('Pantbrev', formatSek(result.pantbrev));
    section += row('**Total capital invested**', `**${formatSek(result.totalCash)}**`);
    section += `\n`;
    section += `| Monthly | Amount |\n|---|---|\n`;
    section += row('Interest (new mortgage)', formatSek(result.newInterest));
    if (extraLoan) section += row('Interest (extra loan)', formatSek(result.extraInterest));
    section += row('Amortization (new mortgage)', formatSek(result.newAmort));
    if (extraLoan) section += row('Amortization (extra loan)', formatSek(result.extraAmortMth));
    section += row('Ownership cost', formatSek(monthlyOwnershipCost));
    if (andrahandMonthly) section += row('Andrahand avgift', formatSek(andrahandMonthly));
    section += row('**Monthly cash flow**', `**${formatSek(result.cashflow)}**`);
    section += `\n`;
    const annualInterest = (result.newInterest + result.extraInterest) * 12;
    section += `| Annual | Amount |\n|---|---|\n`;
    section += row('Annual cash flow', formatSek(result.cashflow * 12));
    section += row(`Ränteavdrag (${annualInterest <= 100000 ? '30%' : '30%/21%'} on ${formatSek(annualInterest)} interest)`, formatSek(result.ranteavdrag));
    section += row('Rental tax', '−' + formatSek(annualRentalTax));
    section += row('**Annual return after tax**', `**${formatSek(result.annualReturn)}**`);
    section += row('**Monthly take-home**', `**${formatSek(result.monthlyTakeHome)}**`);
    section += `\n`;
    section += `| Return metric | Value |\n|---|---|\n`;
    section += row('ROI (return on invested capital)', formatPct(result.roi));
    section += row('Net property yield', formatPct(result.netYield));
    section += row('Direktavkastning (cap rate)', formatPct(result.direktavkastning));
    section += row('Gross yield (gross rent / price)', formatPct(result.grossYield));
    section += `\n`;
    return section;
  };

  md += `## Financing Alternatives\n\n`;
  md += buildScenarioSection('Financing Alt. 1 — New Bank Loan', alt1, 0, 0, 0);
  if (alt2) md += buildScenarioSection('Financing Alt. 2 — Large Top-up Loan', alt2, state.alt2ExtraLoan || 0, state.alt2InterestRate || 0, state.alt2AmortizationRate || 0);
  if (alt3) md += buildScenarioSection('Financing Alt. 3 — Small Top-up Loan', alt3, state.alt3ExtraLoan || 0, state.alt3InterestRate || 0, state.alt3AmortizationRate || 0);

  md += `${hr}\n\n`;
  md += `*Swedish Property Investment Calculator — Income year 2026*\n`;
  md += `*All figures in SEK. Rental tax calculated using schablonavdrag. Ränteavdrag: 30% on interest ≤ 100 000 kr/yr, 21% above.*\n`;

  const filename = sanitizeFilename(sessionName) + '_report.txt';
  downloadFile(md, filename, 'text/plain;charset=utf-8');
  showToast('📝 Report downloaded as .txt');
}
