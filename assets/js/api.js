import { buildMockDashboardData } from "./mockData.js";

const DEFAULT_CONFIG = {
  baseUrl: "",
  useMockData: true,
  pollIntervalMs: 15 * 60 * 1000,
  requestTimeoutMs: 10000,
  emissionsKgPerKwh: 0.36,
  historyDays: 30,
  endpoints: {
    overview: "/solar/overview",
    energy: "/solar/energy",
  },
};

function getRuntimeConfig() {
  const runtime = globalThis.SOLAR_DASHBOARD_CONFIG ?? {};

  return {
    ...DEFAULT_CONFIG,
    ...runtime,
    endpoints: {
      ...DEFAULT_CONFIG.endpoints,
      ...(runtime.endpoints ?? {}),
    },
  };
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatDateYmd(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDate(dateString) {
  if (typeof dateString !== "string") return null;
  if (dateString.includes("T")) return dateString;
  if (dateString.includes(" ")) return dateString.replace(" ", "T");
  return `${dateString}T00:00:00`;
}

function whToKwh(energyWh) {
  return energyWh / 1000;
}

function wToKw(powerW) {
  return powerW / 1000;
}

function energyToWh(energyValue, unit) {
  const normalizedUnit = `${unit ?? "Wh"}`.toUpperCase();
  const numericValue = toNumber(energyValue);

  if (normalizedUnit === "KWH") return numericValue * 1000;
  return numericValue;
}

function energyWhToAverageKwForQuarter(energyWh) {
  // quarter-hour value (Wh) => average kW in the 15 minute interval
  return energyWh / 250;
}

function buildUrl(baseUrl, path) {
  if (!baseUrl) return path;
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${normalizedBase}${normalizedPath}`;
}

function buildEnergyUrl(config, params) {
  const url = new URL(
    buildUrl(config.baseUrl, config.endpoints.energy),
    globalThis.location?.origin ?? "http://localhost"
  );
  url.searchParams.set("startDate", params.startDate);
  url.searchParams.set("endDate", params.endDate);
  url.searchParams.set("timeUnit", params.timeUnit);
  return url.toString();
}

function normalizeOverview(rawOverview) {
  const overview = rawOverview?.overview ?? rawOverview ?? {};

  return {
    currentPowerKw: wToKw(
      toNumber(overview?.currentPower?.power ?? overview?.currentPower ?? 0)
    ),
    // `lastDayData` is typically yesterday from SolarEdge API semantics.
    lastDayEnergyKwh: whToKwh(toNumber(overview?.lastDayData?.energy ?? 0)),
    lastUpdateTime: overview?.lastUpdateTime ?? null,
  };
}

function normalizeEnergyValues(rawEnergy) {
  const energy = rawEnergy?.energy ?? rawEnergy ?? {};
  const values = Array.isArray(energy?.values) ? energy.values : [];
  const unit = energy?.unit ?? "Wh";

  return {
    unit,
    values: values
      .map((item) => ({
        date: normalizeDate(item?.date),
        value: item?.value == null ? null : toNumber(item.value),
      }))
      .filter((item) => item.date),
  };
}

function mapIntradayToPowerPoints(intradaySeries) {
  return intradaySeries.values.map((point) => {
    const energyWh =
      point.value == null ? 0 : energyToWh(point.value, intradaySeries.unit);
    return {
      timestamp: point.date,
      powerKw: Number(energyWhToAverageKwForQuarter(energyWh).toFixed(2)),
    };
  });
}

function mapDailyToEnergyDays(dailySeries) {
  return dailySeries.values.map((point) => {
    const energyWh =
      point.value == null ? 0 : energyToWh(point.value, dailySeries.unit);
    return {
      date: point.date.slice(0, 10),
      energyKwh: Number(whToKwh(energyWh).toFixed(1)),
    };
  });
}

function sumEnergyKwh(series) {
  const totalWh = series.values.reduce((total, point) => {
    if (point.value == null) return total;
    return total + energyToWh(point.value, series.unit);
  }, 0);

  return whToKwh(totalWh);
}

async function fetchWithTimeout(url, timeoutMs, externalSignal) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  if (externalSignal) {
    externalSignal.addEventListener("abort", () => controller.abort(), {
      once: true,
    });
  }

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`);
    }

    const body = await response.json();
    if (body?.error) {
      throw new Error(body.error);
    }
    return body;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function getPollingIntervalMs() {
  return getRuntimeConfig().pollIntervalMs;
}

export async function fetchDashboardData(signal) {
  const config = getRuntimeConfig();

  if (config.useMockData) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    return buildMockDashboardData();
  }

  const today = new Date();
  const historyStart = new Date(today);
  historyStart.setDate(today.getDate() - (config.historyDays - 1));

  const endDate = formatDateYmd(today);
  const startDate = formatDateYmd(historyStart);

  const [rawOverview, rawIntraday, rawDaily] = await Promise.all([
    fetchWithTimeout(
      buildUrl(config.baseUrl, config.endpoints.overview),
      config.requestTimeoutMs,
      signal
    ),
    fetchWithTimeout(
      buildEnergyUrl(config, {
        startDate: endDate,
        endDate,
        timeUnit: "QUARTER_OF_AN_HOUR",
      }),
      config.requestTimeoutMs,
      signal
    ),
    fetchWithTimeout(
      buildEnergyUrl(config, {
        startDate,
        endDate,
        timeUnit: "DAY",
      }),
      config.requestTimeoutMs,
      signal
    ),
  ]);

  const normalizedOverview = normalizeOverview(rawOverview);
  const intradaySeries = normalizeEnergyValues(rawIntraday);
  const dailySeries = normalizeEnergyValues(rawDaily);
  const powerPoints = mapIntradayToPowerPoints(intradaySeries);
  const energyDays = mapDailyToEnergyDays(dailySeries);

  const todayEnergyKwh =
    powerPoints.length > 0
      ? Number(sumEnergyKwh(intradaySeries).toFixed(1))
      : Number(normalizedOverview.lastDayEnergyKwh.toFixed(1));
  const peakPowerKw =
    powerPoints.length > 0
      ? Math.max(...powerPoints.map((point) => point.powerKw))
      : Number(normalizedOverview.currentPowerKw.toFixed(2));

  return {
    overview: {
      currentPowerKw: Number(normalizedOverview.currentPowerKw.toFixed(2)),
      todayEnergyKwh,
      peakPowerKw: Number(peakPowerKw.toFixed(2)),
      co2AvoidedKg: Number((todayEnergyKwh * config.emissionsKgPerKwh).toFixed(1)),
      lastUpdateTime: normalizedOverview.lastUpdateTime,
    },
    power: { points: powerPoints },
    energy: { days: energyDays },
  };
}
