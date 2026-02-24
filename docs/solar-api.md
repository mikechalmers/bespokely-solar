# Solar API

Endpoints for the SolarEdge solar monitoring integration. All endpoints are read-only GET requests. Responses are cached in MongoDB to reduce load on the SolarEdge API.

Base path: `/solar`

---

## GET /solar/overview

Current power output and cumulative energy production.

**Cache TTL:** 5 minutes

**Response example:**
```json
{
  "overview": {
    "lastUpdateTime": "2026-02-24 10:30:00",
    "lifeTimeData": { "energy": 12345678.0, "revenue": 1234.56 },
    "lastYearData": { "energy": 2345678.0, "revenue": 234.56 },
    "lastMonthData": { "energy": 123456.0, "revenue": 12.34 },
    "lastDayData": { "energy": 12345.0, "revenue": 1.23 },
    "currentPower": { "power": 3456.78 }
  }
}
```

**Field notes:**
- `energy` values are in Wh
- `power` is in W
- `revenue` is in the site's configured currency

---

## GET /solar/power-flow

Real-time power flow between PV, grid, load, and battery storage.

**Cache TTL:** 5 minutes

**Response example:**
```json
{
  "siteCurrentPowerFlow": {
    "updateRefreshRate": 3,
    "unit": "kW",
    "connections": [
      { "from": "PV", "to": "Load" },
      { "from": "PV", "to": "Grid" }
    ],
    "GRID": { "status": "Active", "currentPower": 0.5 },
    "LOAD": { "status": "Active", "currentPower": 3.2 },
    "PV": { "status": "Active", "currentPower": 3.7 },
    "STORAGE": { "status": "Idle", "currentPower": 0.0, "chargeLevel": 80, "critical": false }
  }
}
```

**Field notes:**
- `connections` describes the direction of power flow (e.g. PV → Load means solar is powering the home directly)
- `STORAGE` is only present if a battery is installed
- `updateRefreshRate` is in seconds (suggested polling interval)

---

## GET /solar/energy

Energy production over a date range, broken down by time unit.

**Cache TTL:** 1 hour (DAY/WEEK/HOUR), 6 hours (MONTH/YEAR)

**Query parameters:**

| Parameter   | Required | Format       | Description                                                                 |
|-------------|----------|--------------|-----------------------------------------------------------------------------|
| `startDate` | Yes      | `YYYY-MM-DD` | Start of the date range                                                     |
| `endDate`   | Yes      | `YYYY-MM-DD` | End of the date range                                                       |
| `timeUnit`  | Yes      | See below    | Granularity of the data points                                              |

**Valid `timeUnit` values:**
- `QUARTER_OF_AN_HOUR`
- `HOUR`
- `DAY`
- `WEEK`
- `MONTH`
- `YEAR`

**Example request:**
```
GET /solar/energy?startDate=2026-02-01&endDate=2026-02-24&timeUnit=DAY
```

**Response example:**
```json
{
  "energy": {
    "timeUnit": "DAY",
    "unit": "Wh",
    "values": [
      { "date": "2026-02-01 00:00:00", "value": 12345.0 },
      { "date": "2026-02-02 00:00:00", "value": 10234.0 },
      { "date": "2026-02-03 00:00:00", "value": null }
    ]
  }
}
```

**Field notes:**
- `value` can be `null` for days with no data (e.g. no sunlight recorded)
- `unit` is always `Wh`

**Error responses:**
```json
{ "error": "Missing required query parameters: startDate, endDate, timeUnit" }
{ "error": "Invalid date format. Use YYYY-MM-DD" }
{ "error": "Invalid timeUnit. Must be one of: QUARTER_OF_AN_HOUR, HOUR, DAY, WEEK, MONTH, YEAR" }
```

---

## GET /solar/env-benefits

Lifetime environmental benefits of the solar installation.

**Cache TTL:** 24 hours

**Response example:**
```json
{
  "envBenefits": {
    "gasEmissionSaved": {
      "units": "kg",
      "co2": 8765.43,
      "so2": 12.34,
      "nox": 5.67
    },
    "treesPlanted": 432,
    "lightBulbs": 9876543.0
  }
}
```

**Field notes:**
- `co2`, `so2`, `nox` are in kg
- `treesPlanted` is the equivalent number of trees planted
- `lightBulbs` is the equivalent number of 11W LED bulbs powered for a year

---

## Error handling

All endpoints return a JSON error object on failure:

```json
{ "error": "Failed to fetch solar overview" }
```

HTTP status codes:
- `400` — Invalid or missing query parameters
- `500` — SolarEdge API error or server error

---

## CORS

The `/solar` endpoints allow requests from `https://solar.bespokely.cc`.
