/**
 * Application entry point.
 * Imports all modules, wires event listeners, exposes window.* globals
 * for onclick handlers in index.html, and boots the application.
 */

import { appState } from './state/app-state.js';
import { setLanguage, getCurrentLanguage } from './i18n/i18n-manager.js';
import { loadAutosavedSession } from './state/session-storage.js';

import {
  goToNextStep,
  goToPreviousStep,
  goToStep,
  openWizardFresh,
  openWizardForEditing,
  closeWizardDiscardChanges,
  renderCurrentStep,
  setRadio,
  toggleAccordion,
  toggleAlternative,
  updateLanguageSelectorState,
} from './wizard/wizard-controller.js';

import {
  selectPropertyType,
  addLinkRow,
  deleteLinkRow,
  onLinkTypeChange,
  syncLinksFromDOM,
} from './wizard/wizard-form-collector.js';

import {
  updateAmortizationGuide,
  updateAlt2And3Guides,
  updateOneTimeCostsSummary,
  updateOneCostsPlaceholders,
  updateHusLivePreview,
} from './wizard/wizard-live-preview.js';

import {
  showResults,
  openEditWizard,
  newCalculation,
  saveCurrentCalculation,
  loadSessionById,
  deleteSessionById,
  renderSavesList,
  renderLastSessionBanner,
  restoreAutosavedSession,
  dismissAutosavedSession,
  toggleSection,
  showToast,
} from './results/results-controller.js';

import {
  openDownloadModal,
  closeDownloadModal,
  exportAsJson,
  exportAsMarkdown,
} from './results/export-manager.js';

import {
  openCompareDialog,
  closeCompareDialog,
  toggleCompareItem,
  confirmCompareDialog,
  openComparePage,
  closeComparePage,
  clearComparison,
  removeFromComparison,
} from './compare/compare-controller.js';

// ── Import dialog state ────────────────────────────────────────────────────
/** Pending import data { sessions: [], choices: {} } */
let importDialogData = null;

/**
 * Open the import dialog with data parsed from a JSON file.
 *
 * @param {Array} sessions - Parsed session array from imported file
 */
function openImportDialog(sessions) {
  importDialogData = { sessions, choices: {} };
  sessions.forEach((s, i) => { importDialogData.choices[i] = 'keep-new'; });
  renderImportDialogContent();
  document.getElementById('importOverlay')?.classList.remove('hidden');
}

/**
 * Close the import JSON dialog.
 */
function closeImportDialog() {
  document.getElementById('importOverlay')?.classList.add('hidden');
  importDialogData = null;
}

/**
 * Toggle selection of an item in the import dialog.
 *
 * @param {number} index
 */
function toggleImportItem(index) {
  if (!importDialogData) return;
  const item = document.querySelector(`.imp-item[data-idx="${index}"]`);
  if (!item) return;
  item.classList.toggle('checked');
  updateImportCount();
}

/**
 * Set the conflict resolution choice for an import item.
 *
 * @param {number} index
 * @param {string} choice - 'keep-new' | 'keep-existing' | 'keep-both'
 */
function setImportChoice(index, choice) {
  if (!importDialogData) return;
  importDialogData.choices[index] = choice;
  document.querySelectorAll(`.imp-conflict-opt[data-idx="${index}"]`).forEach(btn => {
    btn.classList.toggle('active', btn.dataset.choice === choice);
  });
}

/**
 * Update the import count badge.
 */
function updateImportCount() {
  const checked = document.querySelectorAll('.imp-item.checked').length;
  const countEl = document.getElementById('importCount');
  if (countEl) countEl.textContent = checked + ' session' + (checked !== 1 ? 's' : '') + ' selected';
  const goBtn = document.getElementById('importGoBtn');
  if (goBtn) goBtn.disabled = checked === 0;
}

/**
 * Render the import dialog list.
 */
function renderImportDialogContent() {
  if (!importDialogData) return;
  const body = document.getElementById('importBody');
  if (!body) return;

  const existingSessions = JSON.parse(localStorage.getItem('swe-prop-calc-v3') || '[]');

  body.innerHTML = importDialogData.sessions.map((session, i) => {
    const existingMatch = existingSessions.find(e =>
      e.name === (session.name || session.sessionName) ||
      (e.state?.purchasePrice === (session.state?.purchasePrice ?? session.purchasePrice) &&
       e.state?.propertyName === (session.state?.propertyName ?? session.propertyName))
    );
    const hasConflict = !!existingMatch;
    const propType = session.state?.propertyType || session.propertyType || session.property?.type;
    const badgeColor = propType === 'bostadsratt' ? '#1F3864' : propType === 'hus' ? '#375623' : '#7B3A10';
    const badgeLabel = propType === 'bostadsratt' ? '🏘️ BRF' : propType === 'hus' ? '🏡 Hus' : '🏢 Ägarlägenhet';
    const price = (session.state?.purchasePrice ?? session.purchasePrice ?? session.property?.purchase_price_sek ?? 0).toLocaleString('sv-SE');
    const name = session.name || session.sessionName || 'Unnamed';
    const date = session.savedAt ? new Date(session.savedAt).toLocaleDateString('sv-SE') : '';

    return `<div class="imp-item" data-idx="${i}" onclick="window.toggleImportItem(${i})">
      <div class="imp-cb">${hasConflict ? '' : ''}✓</div>
      <div class="imp-info">
        <div class="imp-name">${name}</div>
        <div class="imp-meta">
          <span class="imp-badge" style="background:${badgeColor}">${badgeLabel}</span>
          <span class="imp-price">${price} kr</span>
          ${date ? `<span class="imp-date">${date}</span>` : ''}
        </div>
        ${hasConflict ? `
        <div class="imp-conflict">
          <div class="imp-conflict-title">⚠️ Conflict — session with similar name/price exists</div>
          <div class="imp-conflict-opts">
            <div class="imp-conflict-opt active" data-idx="${i}" data-choice="keep-new" onclick="event.stopPropagation();window.setImportChoice(${i},'keep-new')">
              <span class="ico">📥</span><span class="lbl">Keep imported</span><span class="sub">Replaces existing</span>
            </div>
            <div class="imp-conflict-opt" data-idx="${i}" data-choice="keep-existing" onclick="event.stopPropagation();window.setImportChoice(${i},'keep-existing')">
              <span class="ico">💾</span><span class="lbl">Keep existing</span><span class="sub">Skip this one</span>
            </div>
            <div class="imp-conflict-opt" data-idx="${i}" data-choice="keep-both" onclick="event.stopPropagation();window.setImportChoice(${i},'keep-both')">
              <span class="ico">📋</span><span class="lbl">Keep both</span><span class="sub">Adds as new</span>
            </div>
          </div>
        </div>` : ''}
      </div>
    </div>`;
  }).join('');

  updateImportCount();
}

/**
 * Confirm and execute the import.
 */
function confirmImport() {
  if (!importDialogData) return;
  const checked = Array.from(document.querySelectorAll('.imp-item.checked')).map(el => +el.dataset.idx);
  if (!checked.length) return;

  import('./state/session-storage.js').then(({ loadSessions, saveSession, deserializeImportedData }) => {
    const existingSessions = loadSessions();

    checked.forEach(i => {
      const incoming = importDialogData.sessions[i];
      const choice = importDialogData.choices[i];
      if (choice === 'keep-existing') return;

      const stateData = deserializeImportedData(incoming);
      if (!stateData) return;

      if (choice === 'keep-new') {
        // Remove any conflict
        const conflictIdx = existingSessions.findIndex(e =>
          e.name === (incoming.name || incoming.sessionName)
        );
        if (conflictIdx >= 0) existingSessions.splice(conflictIdx, 1);
      }

      const newEntry = {
        id: Date.now() + i,
        name: incoming.name || incoming.sessionName || 'Imported',
        savedAt: incoming.savedAt || new Date().toISOString(),
        state: stateData,
      };
      existingSessions.push(newEntry);
    });

    localStorage.setItem('swe-prop-calc-v3', JSON.stringify(existingSessions));
    closeImportDialog();
    renderSavesList();
    showToast('✓ Import complete');
  });
}

/**
 * Load a JSON file and open the import dialog.
 *
 * @param {Event} event
 */
function loadFromFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      let sessions = [];
      if (Array.isArray(data)) {
        sessions = data;
      } else if (data.sessions && Array.isArray(data.sessions)) {
        sessions = data.sessions;
      } else if (data.purchasePrice !== undefined || data.state) {
        sessions = [data];
      } else {
        showToast('❌ Unrecognised file format');
        return;
      }
      if (sessions.length === 0) { showToast('❌ No sessions found in file'); return; }
      openImportDialog(sessions);
    } catch {
      showToast('❌ Could not read file — not valid JSON');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

// ── Zoom control ─────────────────────────────────────────────────────────────
let uiZoom = parseFloat(localStorage.getItem('calc-zoom') || '1.2');

/**
 * Apply zoom level to body element.
 *
 * @param {number} newZoom
 */
function applyZoom(newZoom) {
  uiZoom = Math.max(0.6, Math.min(2.0, Math.round(newZoom * 10) / 10));
  document.body.style.zoom = uiZoom;
  localStorage.setItem('calc-zoom', uiZoom.toString());
  const zoomVal = document.getElementById('zoom-val');
  if (zoomVal) zoomVal.textContent = Math.round(uiZoom * 100) + '%';
}

// ── URL import ───────────────────────────────────────────────────────────────
/**
 * Attempt to fetch and parse property data from a listing URL.
 * Currently a stub — real scraping requires a server-side proxy.
 */
async function importFromUrl() {
  const input = document.getElementById('url-import-input');
  const status = document.getElementById('url-import-status');
  const btn = document.querySelector('.url-import-btn');
  const url = input?.value?.trim();

  if (!url) {
    if (status) { status.textContent = 'Please enter a URL first.'; status.className = 'url-import-status err'; }
    return;
  }

  if (status) { status.textContent = 'Fetching listing…'; status.className = 'url-import-status'; }
  if (btn) btn.disabled = true;

  try {
    // Direct fetch is usually blocked by CORS — in production use a proxy
    const response = await fetch(url, { method: 'GET', mode: 'cors' });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const html = await response.text();
    const data = parseListingHtml(html, url);
    if (data) {
      applyImportedListing(data);
      if (status) { status.textContent = '✓ Listing imported — review fields below.'; status.className = 'url-import-status ok'; }
    } else {
      throw new Error('Could not parse listing data');
    }
  } catch (err) {
    if (status) {
      status.textContent = '⚠️ Could not import automatically (CORS blocked). Copy values manually.';
      status.className = 'url-import-status err';
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

/**
 * Parse raw listing HTML into a partial property data object.
 *
 * @param {string} html
 * @param {string} url
 * @returns {object|null}
 */
function parseListingHtml(html, url) {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  // Try Hemnet-style price extraction
  const priceSelectors = [
    '[data-testid="property-purchase-price"]',
    '.property-price',
    '.listing-price',
  ];
  let priceText = null;
  for (const sel of priceSelectors) {
    const el = doc.querySelector(sel);
    if (el) { priceText = el.textContent; break; }
  }

  const addressSelectors = [
    '[data-testid="property-address"]',
    '.listing-address',
    'h1.property-name',
  ];
  let addressText = null;
  for (const sel of addressSelectors) {
    const el = doc.querySelector(sel);
    if (el) { addressText = el.textContent?.trim(); break; }
  }

  const rawPrice = priceText ? parseInt(priceText.replace(/\D/g, '')) : null;
  if (!rawPrice) return null;

  return {
    purchasePrice: rawPrice,
    propertyName: addressText || '',
    sourceUrl: url,
  };
}

/**
 * Apply imported listing data to the wizard form.
 *
 * @param {object} data
 */
function applyImportedListing(data) {
  if (data.purchasePrice) {
    const priceEl = document.getElementById('w-price');
    if (priceEl) { priceEl.value = data.purchasePrice; onPriceChange(); }
  }
  if (data.propertyName) {
    const nameEl = document.getElementById('w-name');
    if (nameEl) nameEl.value = data.propertyName;
  }
  updateOneTimeCostsSummary();
}

// ── Inline helpers called from HTML oninput handlers ─────────────────────────
/**
 * Called when purchase price changes in wizard step 3.
 */
function onPriceChange() {
  updateHusLivePreview();
  updateAmortizationGuide();
  updateOneTimeCostsSummary();
}

/**
 * Called when down payment changes in wizard step 3.
 */
function onDpChange() {
  updateAmortizationGuide();
  updateOneTimeCostsSummary();
}

/**
 * Show/hide the one-time cost override fields.
 */
function toggleOnetimeOverrides() {
  const panel = document.getElementById('onetime-overrides');
  if (!panel) return;
  const visible = panel.style.display !== 'none';
  panel.style.display = visible ? 'none' : 'block';
  const btn = document.getElementById('ots-override-btn');
  if (btn) btn.textContent = visible ? '⚙️ Override calculated values' : '✕ Hide overrides';
}

// ── Tooltip system ───────────────────────────────────────────────────────────
let currentTipTarget = null;

/**
 * Initialise the floating tooltip system.
 * Tooltips use .tip-icon elements with a nested .tip-box for content.
 * Content is copied into #tip-float at body level so it escapes overflow clipping.
 */
function initTooltips() {
  const tipFloat = document.getElementById('tip-float');
  if (!tipFloat) return;

  document.addEventListener('click', e => {
    const icon = e.target.closest('.tip-icon');
    if (icon) {
      e.stopPropagation();
      if (currentTipTarget === icon) {
        tipFloat.style.display = 'none';
        currentTipTarget = null;
        return;
      }
      const tipBox = icon.querySelector('.tip-box');
      if (!tipBox) return;
      tipFloat.innerHTML = tipBox.innerHTML;

      const rect = icon.getBoundingClientRect();
      tipFloat.style.display = 'block';
      const tipWidth = 290;
      let left = rect.left - tipWidth - 8;
      if (left < 8) left = rect.right + 8;
      let top = rect.top;
      const bottom = top + tipFloat.offsetHeight;
      if (bottom > window.innerHeight - 8) top = window.innerHeight - tipFloat.offsetHeight - 8;
      if (top < 8) top = 8;
      tipFloat.style.left = left + 'px';
      tipFloat.style.top = top + 'px';
      currentTipTarget = icon;
    } else if (!e.target.closest('#tip-float')) {
      tipFloat.style.display = 'none';
      currentTipTarget = null;
    }
  });

  tipFloat.addEventListener('click', e => e.stopPropagation());
}

// ── Expose global functions for HTML onclick attributes ───────────────────────
window.uiZoom = uiZoom;
window.applyZoom = (zoom) => { applyZoom(zoom); window.uiZoom = uiZoom; };

// Wizard navigation
window.wizNext = goToNextStep;
window.wizBack = goToPreviousStep;
window.wizGoTo = goToStep;
window.closeWizDiscard = closeWizardDiscardChanges;

// Wizard form helpers
window.selType = selectPropertyType;
window.setR = setRadio;
window.toggleAcc = toggleAccordion;
window.toggleAlt = toggleAlternative;
window.addLink = addLinkRow;
window.deleteLink = deleteLinkRow;
window.onLinkTypeChange = onLinkTypeChange;
window.onPriceChange = onPriceChange;
window.onDpChange = onDpChange;
window.updateAltCalc = updateAlt2And3Guides;
window.updateHusPlaceholders = updateHusLivePreview;
window.updateOnetimeSummary = updateOneTimeCostsSummary;
window.updateOneCostsPlaceholders = updateOneCostsPlaceholders;
window.toggleOnetimeOverrides = toggleOnetimeOverrides;
window.importFromUrl = importFromUrl;

// Results page
window.openWiz = openEditWizard;
window.saveCalc = saveCurrentCalculation;
window.newCalc = newCalculation;
window.toggleSection = toggleSection;

// Session management
window.loadSession = loadSessionById;
window.deleteSessionById = deleteSessionById;
window.restoreAutosavedSession = restoreAutosavedSession;
window.dismissAutosavedSession = dismissAutosavedSession;

// Export / download
window.openDownloadModal = openDownloadModal;
window.downloadCalc = exportAsJson;
window.exportMarkdown = exportAsMarkdown;

// Import
window.loadFromFile = loadFromFile;
window.toggleImportItem = toggleImportItem;
window.setImportChoice = setImportChoice;
window.closeImportDialog = closeImportDialog;
window.confirmImport = confirmImport;

// Compare
window.openCmpDialog = openCompareDialog;
window.closeCmpDialog = closeCompareDialog;
window.toggleCmpItem = toggleCompareItem;
window.confirmCmpDialog = confirmCompareDialog;
window.closeComparePage = closeComparePage;
window.clearCompare = clearComparison;
window.removeCmpItem = removeFromComparison;

// Language
window.setLang = (lang) => {
  setLanguage(lang);
  renderCurrentStep();
  updateLanguageSelectorState();
};

// ── Bootstrap ─────────────────────────────────────────────────────────────────
function boot() {
  // Apply saved zoom
  applyZoom(uiZoom);

  // Apply saved language
  const savedLang = getCurrentLanguage();
  if (savedLang !== 'en') {
    setLanguage(savedLang);
  }

  // Initialise tooltip system
  initTooltips();

  // Check for autosaved session
  const autosaved = loadAutosavedSession();
  if (autosaved && autosaved.purchasePrice > 0) {
    // Show welcome step with autosave banner — user can restore or start fresh
    openWizardFresh();
  } else {
    // Fresh start
    openWizardFresh();
  }
}

// Run on DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
