/**
 * Methodology page language switcher.
 * Shows/hides trilingual content sections and updates lang buttons.
 */

let currentLang = localStorage.getItem('calcLang') || 'en';

/**
 * Switch the displayed language on the methodology page.
 *
 * @param {string} lang - 'en' | 'sv' | 'fa'
 */
export function setLang(lang) {
  currentLang = lang;
  localStorage.setItem('calcLang', lang);

  const sections = ['en', 'sv', 'fa'];
  sections.forEach(code => {
    const el = document.getElementById('sec-' + code);
    if (el) el.style.display = code === lang ? 'block' : 'none';
  });

  // RTL for Farsi
  const container = document.querySelector('.container');
  if (container) container.classList.toggle('rtl', lang === 'fa');

  // Update button states
  ['en', 'sv', 'fa'].forEach(code => {
    document.getElementById('btn-' + code)?.classList.toggle('active', code === lang);
  });
}

// Apply on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setLang(currentLang));
} else {
  setLang(currentLang);
}

window.setLang = setLang;
