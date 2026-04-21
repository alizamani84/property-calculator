/**
 * Results page controller.
 * Shows/hides the results page, re-runs calculations, and manages the save/load UI.
 */

import { appState, resetState } from '../state/app-state.js';
import { translate } from '../i18n/i18n-manager.js';
import { loadSessions, deleteSession, findSession, loadAutosavedSession, clearAutosave, saveSession, normalizeSavedState } from '../state/session-storage.js';
import { setResultsAreVisible } from '../wizard/wizard-controller.js';
import { escapeHtml, formatAsCurrency } from '../utils/formatters.js';
import { renderAllSections } from './results-renderer.js';

/** Whether there are unsaved changes to the current calculation. */
let hasUnsavedChanges = false;

/**
 * Show or hide the "unsaved changes" indicator pill.
 *
 * @param {boolean} show
 */
export function setUnsavedIndicator(show) {
  hasUnsavedChanges = show;
  const pill = document.getElementById('unsavedPill');
  if (pill) pill.classList.toggle('show', !!show);
}

/**
 * Render the results page for the current appState.
 * Runs all three financing alternative calculations and populates all sections.
 */
export function showResults() {
  const resultsPage = document.getElementById('resultsPage');
  if (resultsPage) resultsPage.classList.add('show');
  setResultsAreVisible(true);

  // Configure column/row visibility for the current property type and alternatives
  const br = appState.propertyType === 'bostadsratt';
  const hus = appState.propertyType === 'hus';

  // Hide Alt 2/3 columns when not enabled
  document.querySelectorAll('.v2').forEach(el => el.classList.toggle('col-hidden', !appState.hasAlt2));
  document.querySelectorAll('.v3').forEach(el => el.classList.toggle('col-hidden', !appState.hasAlt3));
  document.getElementById('card2')?.classList.toggle('hidden-card', !appState.hasAlt2);
  document.getElementById('card3')?.classList.toggle('hidden-card', !appState.hasAlt3);

  // Row visibility by property type
  const showRow = (id, visible) => {
    const el = document.getElementById(id);
    if (el) el.style.display = visible ? '' : 'none';
  };

  showRow('row-ptax-tr',        !br);
  showRow('row-pantsattning-tr', br);
  showRow('row-overlatelse-tr',  br);
  showRow('row-lag-tr',          !br);
  showRow('row-pant-tr',         !br);
  showRow('row-ga',              !br && !hus);
  showRow('row-manavgift',        br);
  showRow('row-driftkostnad',     br && (appState.monthlyDriftkostnad || 0) > 0);
  showRow('row-hus-drift',        hus);
  showRow('row-hus-fa',           hus);
  showRow('row-andrahand',        br);
  showRow('row-ins',              appState.monthlyInsurance   > 0);
  showRow('row-water',            appState.monthlyWater       > 0);
  showRow('row-el',               appState.monthlyElectricity > 0);
  showRow('row-heat',             appState.monthlyHeating     > 0);
  showRow('row-other',            appState.monthlyOtherCosts  > 0);

  // Results page title
  const titleElement = document.getElementById('r-title');
  if (titleElement) titleElement.textContent = appState.propertyName || 'Property Investment Calculator';

  // Render links bar
  renderLinksBar();

  // Expand all sections on first render
  expandAllSections();

  // Perform all calculations and populate the DOM
  try {
    renderAllSections();
  } catch (err) {
    alert('renderAllSections ERROR: ' + err.message + '\n\nStack: ' + err.stack);
  }
}

/**
 * Render the property links bar above the results.
 */
function renderLinksBar() {
  const bar = document.getElementById('linksBar');
  if (!bar) return;
  if (!appState.propertyLinks || !appState.propertyLinks.length) {
    bar.classList.add('empty');
    return;
  }
  bar.classList.remove('empty');
  bar.innerHTML = '🔗 ' + appState.propertyLinks.map(link =>
    `<a href="${escapeHtml(link.url)}" target="_blank" rel="noopener">${escapeHtml(link.label || link.lbl || link.url)}</a>`
  ).join('');
}

/**
 * Open the wizard in edit mode to modify current inputs.
 */
export function openEditWizard() {
  import('../wizard/wizard-controller.js').then(({ openWizardForEditing }) => {
    openWizardForEditing();
  });
}

/**
 * Start a completely fresh new calculation — resets state and opens the wizard.
 */
export function newCalculation() {
  resetState();
  const resultsPage = document.getElementById('resultsPage');
  const comparePage = document.getElementById('comparePage');
  if (resultsPage) resultsPage.classList.remove('show');
  if (comparePage) comparePage.classList.remove('show');
  setResultsAreVisible(false);
  clearAutosave();

  // Reset alt accordion UI
  [2, 3].forEach(n => {
    document.getElementById('altbody' + n)?.classList.remove('open');
    const button = document.getElementById('altbtn' + n);
    if (button) { button.textContent = 'Add Alt ' + n; button.className = 'alt-btn add'; }
    const badge = document.getElementById('badge' + n);
    if (badge) { badge.textContent = 'Not added'; badge.className = 'alt-badge not-added'; }
  });

  document.querySelectorAll('.wiz-err').forEach(el => el.classList.remove('show'));
  document.querySelectorAll('.tc').forEach(el => el.classList.remove('selected'));
  const unsupMsg = document.getElementById('unsupMsg');
  if (unsupMsg) unsupMsg.style.display = 'none';

  const wizardOverlay = document.getElementById('wizOverlay');
  if (wizardOverlay) wizardOverlay.classList.remove('hidden');

  import('../wizard/wizard-controller.js').then(({ renderCurrentStep }) => {
    renderCurrentStep();
  });
}

/**
 * Save the current calculation, prompting for a name.
 */
export function saveCurrentCalculation() {
  const defaultName = appState.sessionName || appState.propertyName || 'Min beräkning';
  const name = prompt(translate('saveCalc') || 'Name for this calculation:', defaultName);
  if (name === null) return;
  appState.sessionName = name;
  saveSession(name);
  clearAutosave();
  setUnsavedIndicator(false);
  renderLastSessionBanner();
  showToast('✓ Saved as "' + name + '"');
}

/**
 * Render the saved sessions list in the welcome step.
 */
export function renderSavesList() {
  const listElement = document.getElementById('savesList');
  if (!listElement) return;

  const sessions = loadSessions();
  if (!sessions.length) {
    listElement.innerHTML = '<div class="no-saves">No saved calculations yet</div>';
    return;
  }

  listElement.innerHTML = sessions.map(session => {
    const dateStr = new Date(session.savedAt).toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' });
    const priceStr = session.state?.purchasePrice ? session.state.purchasePrice.toLocaleString('sv-SE') + ' kr' : '';
    const propertyType = session.state?.propertyType;
    const ptBg    = propertyType === 'bostadsratt' ? '#fff3e0' : propertyType === 'hus' ? '#e8f5e9' : '#e8f0fb';
    const ptFg    = propertyType === 'bostadsratt' ? '#7B3A10' : propertyType === 'hus' ? '#1a5c1a' : '#1F3864';
    const ptLabel = propertyType === 'bostadsratt' ? '🏘️ Bostadsrätt' : propertyType === 'hus' ? '🏡 Villa / Radhus / Kedjehus / Parhus' : '🏢 Ägarlägenhet';
    const typeBadge = `<span style="background:${ptBg};color:${ptFg};font-size:9px;font-weight:700;border-radius:8px;padding:2px 7px;margin-right:5px;white-space:nowrap">${ptLabel}</span>`;
    return `<div class="save-item" onclick="window.loadSession(${session.id})">
      <div>
        <div class="si-name">${escapeHtml(session.name)}</div>
        <div class="si-sub" style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;margin-top:3px">${typeBadge}<span>${dateStr}${priceStr ? ' · ' + priceStr : ''}</span></div>
      </div>
      <button class="si-del" onclick="window.deleteSessionById(${session.id}, event)">✕</button>
    </div>`;
  }).join('');
}

/**
 * Load a saved session by ID and show its results.
 *
 * @param {number} sessionId
 */
export function loadSessionById(sessionId) {
  const entry = findSession(sessionId);
  if (!entry) return;
  Object.assign(appState, normalizeSavedState(entry.state));
  setUnsavedIndicator(false);
  document.getElementById('wizOverlay')?.classList.add('hidden');
  showResults();
  clearAutosave(); // clear AFTER showResults — renderAllSections re-creates it, but this is already saved
}

/**
 * Delete a saved session by ID and re-render the list.
 *
 * @param {number} sessionId
 * @param {Event} event - to stop propagation
 */
export function deleteSessionById(sessionId, event) {
  if (event) event.stopPropagation();
  if (!confirm('Delete this saved calculation?')) return;
  deleteSession(sessionId);
  renderSavesList();
}

/**
 * Render the "unsaved session found" banner on the welcome step.
 * Hides the banner when no autosaved session exists.
 */
export function renderLastSessionBanner() {
  const autosavedData = loadAutosavedSession();
  const bannerElement = document.getElementById('lastSessionBanner');
  if (!bannerElement) return;

  if (!autosavedData) {
    bannerElement.style.display = 'none';
    return;
  }

  const whenStr = autosavedData._savedAt
    ? new Date(autosavedData._savedAt).toLocaleString('sv-SE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '';

  bannerElement.style.display = 'block';
  bannerElement.innerHTML = `<div style="background:#e8f3e8;border:1.5px solid #7bc47b;border-radius:8px;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
    <div style="font-size:12px;color:#1a5c1a;flex:1;min-width:0">
      <b>↩ Unsaved session found</b><br>
      <span style="color:#555">${escapeHtml(autosavedData.propertyName || 'Unnamed')} · ${(autosavedData.purchasePrice || 0).toLocaleString('sv-SE')} kr${whenStr ? ' · ' + whenStr : ''}</span>
    </div>
    <div style="display:flex;gap:6px;flex-shrink:0">
      <button class="hdr-btn accent" style="font-size:11px;padding:5px 12px;white-space:nowrap" onclick="window.restoreAutosavedSession()">↩ Restore</button>
      <button class="hdr-btn" style="font-size:11px;padding:5px 10px;white-space:nowrap;opacity:.8" onclick="window.dismissAutosavedSession()" title="Dismiss">✕</button>
    </div>
  </div>`;
}

/**
 * Restore the autosaved session and show results.
 */
export function restoreAutosavedSession() {
  const autosavedData = loadAutosavedSession();
  if (!autosavedData) return;
  const { _savedAt, ...state } = autosavedData;
  Object.assign(appState, normalizeSavedState(state));
  setUnsavedIndicator(false);
  document.getElementById('wizOverlay')?.classList.add('hidden');
  showResults();
  showToast('✓ Last session restored');
}

/**
 * Dismiss the autosaved session banner without restoring.
 */
export function dismissAutosavedSession() {
  clearAutosave();
  renderLastSessionBanner();
}

/**
 * Expand all results sections.
 */
export function expandAllSections() {
  ['sec1', 'sec2', 'sec3', 'sec4', 'sec5'].forEach(id => {
    document.getElementById(id)?.classList.add('open');
    document.getElementById(id + '-body')?.classList.add('open');
  });
}

/**
 * Collapse all results sections.
 */
export function collapseAllSections() {
  ['sec1', 'sec2', 'sec3', 'sec4', 'sec5'].forEach(id => {
    document.getElementById(id)?.classList.remove('open');
    document.getElementById(id + '-body')?.classList.remove('open');
  });
}

/**
 * Toggle a single results section open/closed.
 *
 * @param {string} sectionId - 'sec1' through 'sec5'
 */
export function toggleSection(sectionId) {
  const section = document.getElementById(sectionId);
  const body = document.getElementById(sectionId + '-body');
  if (!section || !body) return;
  const opening = !section.classList.contains('open');
  section.classList.toggle('open', opening);
  body.classList.toggle('open', opening);
}

/**
 * Show a brief toast notification.
 *
 * @param {string} message
 */
export function showToast(message) {
  const toastElement = document.getElementById('toast');
  if (!toastElement) return;
  toastElement.textContent = message;
  toastElement.classList.add('show');
  setTimeout(() => toastElement.classList.remove('show'), 2800);
}
