# Swedish Property Investment Calculator

A browser-based tool for analysing Swedish property investments. Compares up to three financing scenarios (e.g. new mortgage vs. top-up loans against an existing apartment), calculates monthly cash flow, rental income tax (schablonavdrag), ränteavdrag, and ROI — all using 2026 Swedish tax rules.

Supports three property types: **ägarlägenhet**, **bostadsrätt**, and **hus/villa**.  
Available in **English**, **Swedish**, and **Farsi (RTL)**.

## Using the Calculator

Just open one of the built HTML files — no installation, no server, no internet connection needed:

| File | Description |
|---|---|
| `v2/calculator.html` | Main investment calculator (v2) |
| `v2/methodology.html` | Formula & methodology reference (v2) |
| `v1/calculator.html` | Original single-file calculator (v1) |
| `v1/methodology.html` | Formula reference for v1 |

## Features

- Up to 3 side-by-side financing alternatives (new mortgage, large top-up, small top-up)
- Correct amorteringskravet 2026 (bolånetak raised to 90%, DTI rule repealed)
- Per-property-type tax rules (lagfart, pantbrev, fastighetsavgift, schablonavdrag)
- Save/load multiple calculations via browser localStorage
- Export to JSON (for backup/sharing) and Markdown
- Side-by-side comparison of saved calculations
- Opportunity cost and appreciation analysis

## Repository Layout

```
property-calculator/
├── v1/                            — legacy single-file HTML (no build step)
│   ├── calculator.html
│   └── methodology.html
├── v2/
│   ├── calculator.html            — built output, ready to open
│   ├── methodology.html           — built output, ready to open
│   └── property-calculator/       — Vite source (edit here)
│       ├── src/
│       ├── index.html
│       ├── methodology.html
│       ├── vite.config.js
│       └── package.json
└── skills/                        — Claude Cowork skill files
```

## Developing (v2)

```bash
cd v2/property-calculator
npm install
npm run dev          # dev server at http://localhost:5173
npm run build        # builds both files and copies to v2/calculator.html + v2/methodology.html
npm run build:calc   # build calculator only
npm run build:method # build methodology only
```

The build uses [vite-plugin-singlefile](https://github.com/richardtallent/vite-plugin-singlefile) to inline all JS and CSS into a single portable HTML file.

See `v2/property-calculator/CLAUDE.md` for architecture details.

## Tax Rules (2026)

| Rule | Detail |
|---|---|
| Bolånetak | 90% of property value (raised from 85%, effective 1 April 2026) |
| Amorteringskravet | 0% (LTV < 50%), 1% (50–70%), 2% (≥ 70%); DTI rule repealed 1 April 2026 |
| Schablonavdrag | 40 000 kr fixed + variable (20% of gross, or månadsavgift × 12 for BRF) |
| Ränteavdrag | 30% on interest up to 100 000 kr/yr, 21% above |
| Fastighetsavgift | min(taxeringsvärde × 0.75%, 10 425 kr) per year |
| Capital gains | Not modelled — calculator focuses on running yield |
