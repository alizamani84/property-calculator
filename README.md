# Swedish Property Investment Calculator

A browser-based tool for analyzing Swedish property investments. Compares up to three financing scenarios (e.g. new mortgage vs. top-up loans against an existing apartment), calculates monthly cash flow, rental income tax, and ROI — all using Swedish 2026 tax rules.

Supports three property types: **ägarlägenhet**, **bostadsrätt**, and **hus**.  
Available in **English**, **Swedish**, and **Farsi (RTL)**.

## Versions

- **v1** (`v1 All-in-One/`) — legacy monolithic HTML files, no build step required
- **v2** (`v2/property-calculator/`) — modular Vite-based source, builds to a single self-contained HTML file

## Getting Started (v2)

```bash
cd v2/property-calculator
npm install
npm run dev        # dev server at http://localhost:5173
npm run build      # outputs to v2/dist/
```

## Output

The build produces two standalone HTML files (no external dependencies):

- `v2/dist/index.html` — the calculator
- `v2/dist/methodology.html` — documentation of all calculation formulas
