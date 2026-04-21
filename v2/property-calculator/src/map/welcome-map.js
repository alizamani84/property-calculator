/**
 * Welcome page map — shows all saved properties as pins on an OpenStreetMap.
 * Uses Leaflet.js (loaded from CDN in index.html) and Nominatim geocoding.
 * Geocoded coordinates are cached in localStorage to avoid repeated API calls.
 */

const GEOCACHE_KEY = 'swe-prop-geocache-v1';

function loadGeoCache() {
  try { return JSON.parse(localStorage.getItem(GEOCACHE_KEY) || '{}'); } catch { return {}; }
}
function saveGeoCache(cache) {
  try { localStorage.setItem(GEOCACHE_KEY, JSON.stringify(cache)); } catch {}
}

/**
 * Geocode an address string via Nominatim. Returns {lat, lng} or null.
 * Caches results (including null = not found) so each address is only fetched once.
 */
async function geocodeAddress(address, cache) {
  if (address in cache) return cache[address]; // null means previously not found
  await new Promise(r => setTimeout(r, 250)); // Nominatim rate limit: 1 req/s
  try {
    const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=se&q='
      + encodeURIComponent(address);
    const resp = await fetch(url, { headers: { 'Accept-Language': 'sv' } });
    const data = await resp.json();
    const result = data[0] ? { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) } : null;
    cache[address] = result;
    saveGeoCache(cache);
    return result;
  } catch {
    return null;
  }
}

const TYPE_DOT_COLOR = { bostadsratt: '#7B3A10', hus: '#1a5c1a', agarlagenhet: '#1F3864' };
const TYPE_LABEL     = { bostadsratt: '🏘️ Bostadsrätt', hus: '🏡 Hus / Villa', agarlagenhet: '🏢 Ägarlägenhet' };

function makeDotIcon(propType) {
  const color = TYPE_DOT_COLOR[propType] || '#1F3864';
  return window.L.divIcon({
    html: `<div style="background:${color};width:14px;height:14px;border-radius:50%;border:2.5px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.45)"></div>`,
    className: '',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -10],
  });
}

let _map = null;

/**
 * Render (or refresh) the welcome map with all saved sessions as pins.
 * @param {Array} sessions - array of saved session objects
 * @param {Function} loadSessionFn - callback(sessionId) to load a session
 */
export async function renderWelcomeMap(sessions, loadSessionFn) {
  const container = document.getElementById('welcomeMap');
  if (!container || typeof window.L === 'undefined') return;

  // Ensure the map container is visible
  container.style.display = 'block';
  container.style.height = '100%';

  // Initialise map once
  if (!_map) {
    _map = window.L.map('welcomeMap', { scrollWheelZoom: true })
      .setView([59.85, 17.65], 7); // Sweden
    window.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/" target="_blank">OpenStreetMap</a> © <a href="https://carto.com/" target="_blank">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(_map);
  }

  // Leaflet needs correct size after the overlay becomes visible
  setTimeout(() => _map.invalidateSize(), 50);

  // Remove existing markers
  _map.eachLayer(layer => { if (layer instanceof window.L.Marker) _map.removeLayer(layer); });

  if (!sessions || !sessions.length) return;

  // Show loading indicator
  const status = document.getElementById('welcomeMapStatus');
  if (status) { status.textContent = '⏳ Locating properties…'; status.style.display = 'block'; }

  const cache   = loadGeoCache();
  const markers = [];

  for (const session of sessions) {
    const state    = session.state || {};
    const name     = session.name || state.propertyName || state.propName || '';
    const propType = state.propertyType || state.propType || 'agarlagenhet';
    const price    = (state.purchasePrice || state.price || 0).toLocaleString('sv-SE');

    if (!name) continue;

    const coords = await geocodeAddress(name, cache);
    if (!coords) continue;

    const typeLabel = TYPE_LABEL[propType] || TYPE_LABEL.agarlagenhet;
    const bgColor   = TYPE_DOT_COLOR[propType] || '#1F3864';

    // Compute total monthly driftkostnad
    const br  = propType === 'bostadsratt';
    const hus = propType === 'hus';
    const baseMonthly = br
      ? (state.monthlyManavgift || 0) + (state.monthlyDriftkostnad || 0)
      : hus
        ? Math.round((state.annualHusRunningCosts || 0) / 12)
        : (state.monthlyGaFee || 0);
    const utilities = (state.monthlyInsurance || 0) + (state.monthlyWater || 0)
      + (state.monthlyElectricity || 0) + (state.monthlyHeating || 0)
      + (state.monthlyOtherCosts || 0);
    const totalDrift = baseMonthly + utilities;
    const driftStr = totalDrift > 0
      ? `<div style="color:#555;font-size:11px;margin-top:1px">Drift: ${totalDrift.toLocaleString('sv-SE')} kr/mån</div>`
      : '';

    const marker = window.L.marker([coords.lat, coords.lng], { icon: makeDotIcon(propType) })
      .addTo(_map)
      .bindPopup(`
        <div style="font-size:12px;min-width:160px;line-height:1.5">
          <div style="font-weight:700;color:#1F3864;margin-bottom:4px">${name}</div>
          <div style="display:inline-block;background:${bgColor};color:#fff;font-size:10px;font-weight:700;border-radius:4px;padding:1px 6px;margin-bottom:4px">${typeLabel}</div>
          <div style="color:#555;font-size:11px">${price} kr</div>
          ${driftStr}
          <button
            onclick="(function(){document.getElementById('welcomeMap').closest('.wiz-overlay')&&(document.getElementById('welcomeMap').closest('.wiz-overlay').classList.add('hidden'));window.__mapLoadSession&&window.__mapLoadSession(${session.id});})()"
            style="margin-top:8px;width:100%;padding:4px 0;background:#1F3864;color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:11px;font-weight:600">
            Open →
          </button>
        </div>
      `);
    markers.push(marker);
  }

  if (status) {
    const found = markers.length;
    const total = sessions.length;
    status.textContent = found ? '' : `ℹ️ ${total} propert${total === 1 ? 'y' : 'ies'} — addresses not found on map`;
    if (found) status.style.display = 'none';
  }

  if (markers.length === 1) {
    const ll = markers[0].getLatLng();
    _map.setView([ll.lat, ll.lng], 13);
  } else if (markers.length > 1) {
    _map.fitBounds(window.L.featureGroup(markers).getBounds().pad(0.35));
  }
}
