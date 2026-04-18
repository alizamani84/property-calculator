/**
 * Internationalisation manager.
 * Provides translate(), setLanguage(), getCurrentLanguage(), and applyTranslationsToDOM().
 * Language preference is persisted to localStorage.
 */

import { translationsEn } from './translations-en.js';
import { translationsSv } from './translations-sv.js';
import { translationsFa } from './translations-fa.js';

/** All available translation bundles keyed by language code. */
const TRANSLATIONS = {
  en: translationsEn,
  sv: translationsSv,
  fa: translationsFa,
};

const STORAGE_KEY_LANGUAGE = 'calcLang';

/** Currently active language code. */
let currentLanguage = loadPersistedLanguage();

/**
 * Read the persisted language preference from localStorage.
 * Defaults to English if nothing is stored or localStorage is unavailable.
 *
 * @returns {string} language code
 */
function loadPersistedLanguage() {
  try {
    return localStorage.getItem(STORAGE_KEY_LANGUAGE) || 'en';
  } catch {
    return 'en';
  }
}

/**
 * Get the currently active language code.
 *
 * @returns {string}
 */
export function getCurrentLanguage() {
  return currentLanguage;
}

/**
 * Switch the active language and update the DOM.
 * Persists the choice and fires a 'languageChanged' custom event on document.
 *
 * @param {string} languageCode - one of 'en', 'sv', 'fa'
 */
export function setLanguage(languageCode) {
  if (!TRANSLATIONS[languageCode]) return;
  currentLanguage = languageCode;
  try {
    localStorage.setItem(STORAGE_KEY_LANGUAGE, languageCode);
  } catch { /* ignore */ }

  // RTL support for Farsi
  if (languageCode === 'fa') {
    document.body.dir = 'rtl';
    document.documentElement.lang = 'fa';
  } else {
    document.body.dir = 'ltr';
    document.documentElement.lang = languageCode;
  }

  applyTranslationsToDOM();
  document.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: languageCode } }));
}

/**
 * Translate a single key using the current language.
 * Falls back to English, then returns the key itself if not found.
 *
 * @param {string} key
 * @returns {string}
 */
export function translate(key) {
  return (TRANSLATIONS[currentLanguage] || TRANSLATIONS.en)[key]
      ?? TRANSLATIONS.en[key]
      ?? key;
}

/**
 * Walk all elements with a [data-i18n] attribute and set their text content
 * (or placeholder for inputs) to the translated string.
 */
export function applyTranslationsToDOM() {
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n');
    const translation = translate(key);
    if (!translation) return;
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      element.placeholder = translation;
    } else {
      element.textContent = translation;
    }
  });
}

/**
 * Update language selector button active states to match the current language.
 */
export function updateLanguageButtons() {
  document.querySelectorAll('.lang-btn').forEach(button => {
    button.classList.toggle('active', button.getAttribute('data-lang') === currentLanguage);
  });
}
