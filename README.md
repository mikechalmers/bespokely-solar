# Bespokely Solar Dashboard

Single-page frontend scaffold for an internal solar dashboard.

## What this includes

- Static site compatible with GitHub Pages.
- Mobile-friendly single page with:
  - Key solar metrics.
  - "Fun equivalents" (kettles, MacBooks, homes powered).
  - Two charts (today's quarter-hour power curve, last 30 days energy).
- Lightweight stack:
  - HTML + CSS + vanilla JS modules.
  - [Pico CSS](https://picocss.com/) for simple semantic component styling.
  - [Chart.js](https://www.chartjs.org/) for charting.
- Mock data mode enabled by default so frontend work can continue before API contract finalization.

## File structure

- `index.html` - dashboard page.
- `assets/css/styles.css` - custom styles.
- `assets/js/main.js` - app bootstrap and rendering.
- `assets/js/api.js` - API fetch + normalization + config.
- `assets/js/mockData.js` - realistic mock payload generator.
- `assets/js/utils.js` - formatters and equivalency conversions.

## Run locally

From this directory:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Configure real API

`assets/js/api.js` defaults:

- `useMockData: true`
- `pollIntervalMs: 900000` (15 minutes)
- `historyDays: 30`
- Endpoints:
  - `/solar/overview`
  - `/solar/energy`

To switch to live data, add this before `main.js` in `index.html`:

```html
<script>
  window.SOLAR_DASHBOARD_CONFIG = {
    useMockData: false,
    baseUrl: "https://occasions.notanotherbill.com",
    pollIntervalMs: 15 * 60 * 1000,
    historyDays: 30,
    emissionsKgPerKwh: 0.36,
    endpoints: {
      overview: "/solar/overview",
      energy: "/solar/energy"
    }
  };
</script>
```

Current project state:

- `index.html` is already configured for live mode with `https://occasions.notanotherbill.com`.
- Mock mode can be re-enabled by setting `useMockData: true`.

## API mapping implemented

The frontend now consumes your documented contract:

- `GET /solar/overview`
  - `overview.currentPower.power` (W) -> converted to `kW`
  - `overview.lastDayData.energy` (Wh) used as fallback if intraday data is unavailable
  - `overview.lastUpdateTime` used for the "Updated" timestamp
- `GET /solar/energy?startDate=today&endDate=today&timeUnit=QUARTER_OF_AN_HOUR`
  - Used for the "Power Through Today" chart
  - Each interval `value` (Wh per 15 min) converted to average `kW`
  - Summed to compute today's energy (`kWh`)
  - Max interval used for today's peak power (`kW`)
- `GET /solar/energy?startDate=<30-days-ago>&endDate=today&timeUnit=DAY`
  - Used for "Daily Energy (Last 30 Days)"
  - `value` (Wh) converted to `kWh`

`CO2 Avoided Today` is currently calculated client-side:

- `todayEnergyKwh * emissionsKgPerKwh` (default `0.36`)

## Error handling

- Non-2xx responses throw and show a dashboard error state.
- JSON responses with `{ "error": "..." }` also throw and show the same error state.
- Any `null` energy values are treated as `0` for charts/calculations.

## Auth/CORS/rate-limit notes

- Keep this frontend read-only; never embed private API secrets.
- Polling is already aligned to your 15-minute freshness window.
- If deployed on GitHub Pages, ensure your API CORS allowlist includes your Pages domain (your docs currently mention `https://solar.bespokely.cc`).

## Deployment strategy

We are launching on GitHub Pages first because it is fast, free, and enough for internal v1 rollout.

Planned path:

1. Launch quickly on GitHub Pages for validation and junior-dev iteration. ✅
2. Move to a custom subdomain later (for example `solar.bespokely.cc`) once we want branded access and longer-term hosting polish.

## Deploy to GitHub Pages (current) ✅

1. Push this directory to your GitHub repo default branch. ✅
2. In GitHub repo settings, enable Pages for the branch/folder containing `index.html`. ✅
3. Open the GitHub Pages URL and verify calls to `/solar/overview` and `/solar/energy`. ✅
4. Ensure API CORS allows your GitHub Pages origin. ✅

## Move to custom subdomain (later)

1. In GitHub repo settings, open Pages and set a custom domain.
2. Create/update DNS records for that subdomain to point to GitHub Pages.
3. Keep HTTPS enabled in Pages settings.
4. Update API CORS allowlist to include the new custom domain.
