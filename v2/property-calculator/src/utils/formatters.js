/**
 * Formatting utility functions for displaying monetary amounts, percentages,
 * and other values in Swedish locale.
 */

/**
 * Format a number as Swedish kronor: "1 234 567 kr"
 *
 * @param {number} amount - monetary value in SEK
 * @returns {string}
 */
export function formatAsCurrency(amount) {
  return Math.round(amount).toLocaleString('sv-SE') + ' kr';
}

/**
 * Format as negative currency for cost display: "−1 234 kr"
 *
 * @param {number} amount - cost value in SEK (positive number)
 * @returns {string}
 */
export function formatAsCost(amount) {
  return '−' + formatAsCurrency(amount);
}

/**
 * Format as percentage with specified decimal places.
 *
 * @param {number} value - percentage value (e.g. 3.5 for 3.5%)
 * @param {number} [decimalPlaces=2]
 * @returns {string}
 */
export function formatAsPercent(value, decimalPlaces = 2) {
  return (+value).toFixed(decimalPlaces) + '%';
}

/**
 * Format large amounts in thousands: "4 895k SEK"
 *
 * @param {number} amount - value in SEK
 * @returns {string}
 */
export function formatAsThousands(amount) {
  return Math.round(amount / 1000).toLocaleString('sv-SE') + 'k';
}

/**
 * Format a number as plain Swedish integer: "1 234 567"
 *
 * @param {number} amount
 * @returns {string}
 */
export function formatAsInteger(amount) {
  return Math.round(amount).toLocaleString('sv-SE');
}

/**
 * Escape HTML special characters for safe DOM insertion.
 *
 * @param {*} text - value to escape (coerced to string)
 * @returns {string} HTML-safe string
 */
export function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
