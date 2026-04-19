# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

All commands must be run from `v2/property-calculator/`:

```bash
npm run dev              # Vite dev server (hot reload) — serves index.html
npm run build            # Build both outputs and copy to v2/
npm run build:calc       # Build calculator only  → v2/calculator.html
npm run build:method     # Build methodology only → v2/methodology.html
npm run preview          # Preview last build
```

Each build script compiles via Vite into `v2/dist/` and then copies the result to `v2/` with the correct name. The `v2/dist/` folder is gitignored; `v2/calculator.html` and `v2/methodology.html` are the committed built outputs.

## Repository Layout

```
property-calculator/
├── README.md
├── .gitignore
├── skills/                        — Claude Cowork skill files
├── v1/                            — legacy monolithic single-file HTML (read-only reference)
│   ├── calculator.html
│   └── methodology.html
└── v2/
    ├── calculator.html            — built output (committed)
    ├── methodology.html           — built output (committed)
    └── property-calculator/       — Vite source (edit here)
        ├── CLAUDE.md
        ├── index.html
        ├── methodology.html
        ├── vite.config.js
        ├── package.json
        └── src/
```

## Architecture Overview

The app is a **single-page calculator** built with Vite + `vite-plugin-singlefile`, which inlines all JS and CSS into one self-contained HTML file. There is no router, no framework, no backend.

### Two Entry Points

`vite.config.js` switches between two HTML entries via `VITE_ENTRY` env var:
- `index.html` — the main calculator app (imports `src/main.js`)
- `methodology.html` — a static multi-language methodology doc (imports `src/methodology-main.js`; language switching is done with vanilla JS inline in the HTML)

### Data Flow (Calculator)

```
index.html (HTML + onclick handlers)
  └─ src/main.js (entry point, wires all window.* globals)
       ├─ state/app-state.js        — single mutable appState object
       ├─ wizard/wizard-controller.js  — step navigation, renders wizard HTML
       ├─ wizard/wizard-form-collector.js — reads DOM fields into appState
       ├─ wizard/wizard-live-preview.js  — live feedback (amortization, costs)
       ├─ wizard/wizard-validator.js     — per-step validation
       ├─ engine/property-calculator.js  — pure calculation functions (no DOM)
       ├─ engine/swedish-tax-rules.js    — all tax constants/rates
       ├─ results/results-controller.js  — show/hide results, save/load sessions
       ├─ results/results-renderer.js    — populates result DOM cells
       ├─ results/export-manager.js      — JSON + Markdown export
       ├─ compare/compare-controller.js  — side-by-side comparison view
       ├─ state/session-storage.js       — localStorage persistence
       ├─ i18n/i18n-manager.js           — translate(), setLanguage(), DOM walker
       └─ i18n/translations-{en,sv,fa}.js
```

### Key Design Patterns

**Global window.* functions**: Because HTML `onclick` attributes can't import ES modules, `main.js` exposes every interactive function as `window.*` (e.g. `window.wizNext`, `window.selType`, `window.setLang`). All UI events go through these globals.

**Pure calculation engine**: `src/engine/property-calculator.js` has zero DOM access. Its main export `calculateScenario(inputs)` takes a `PropertyInvestmentInputs` object and returns a `ScenarioResults` object. Use `buildInputsFromState(appState, altNumber)` to build the inputs from app state. This separation means the engine can be tested in Node without a browser.

**Single mutable state**: `appState` (from `app-state.js`) is a plain object shared across all modules. The wizard writes to it; results-renderer reads from it. `resetState()` replaces all fields with defaults via `Object.assign`.

**Three financing alternatives**: The calculator always computes Alt 1 (new bank loan), optionally Alt 2 and Alt 3 (top-up loans against an existing apartment). All three call `calculateScenario()` with different `extraLoanAmount` inputs. Results columns are hidden/shown with `.col-hidden` CSS class.

**Session storage**: Sessions are stored in localStorage under key `swe-prop-calc-v3`. A separate autosave key `swe-prop-calc-last` holds unsaved in-progress work. `normalizeSavedState()` handles migration of v1 sessions (which used different field names like `propType`, `price`, `dp`).

**i18n**: Elements with `data-i18n="key"` are translated by `applyTranslationsToDOM()`. RTL layout for Farsi is applied to `document.body.dir`. Language preference is persisted to localStorage.

## Property Types

Three types with different tax and cost rules:
- `agarlagenhet` — pays lagfart (1.5% + 825 kr) + pantbrev (2% + 375 kr); fastighetsavgift estimated at 75% of purchase price × 0.75%, capped at 10 425 kr/yr; rental deduction = 20% of gross
- `bostadsratt` — no lagfart/pantbrev; fastighetsavgift included in månadsavgift; rental deduction = månadsavgift × 12
- `hus` — same stamp duty as ägarlägenhet; fastighetsavgift uses actual taxeringsvärde input; rental deduction = 20% of gross

All tax constants live in `src/engine/swedish-tax-rules.js`.
