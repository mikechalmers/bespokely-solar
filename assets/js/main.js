import { fetchDashboardData, getPollingIntervalMs } from "./api.js";
import {
  formatCount,
  formatDateLabel,
  formatKg,
  formatKwh,
  formatKw,
  formatTimeLabel,
  toHomes,
  toKettles,
  toMacbooks,
} from "./utils.js";

const state = {
  powerChart: null,
  energyChart: null,
  activeRequest: null,
};

const elements = {
  currentPower: document.querySelector("#currentPower"),
  energyToday: document.querySelector("#energyToday"),
  peakPower: document.querySelector("#peakPower"),
  co2Avoided: document.querySelector("#co2Avoided"),
  kettleCount: document.querySelector("#kettleCount"),
  macbookCount: document.querySelector("#macbookCount"),
  homesPowered: document.querySelector("#homesPowered"),
  statusText: document.querySelector("#statusText"),
  updatedAt: document.querySelector("#updatedAt"),
  refreshButton: document.querySelector("#refreshButton"),
  powerChartCanvas: document.querySelector("#powerChart"),
  energyChartCanvas: document.querySelector("#energyChart"),
};

function setStatus(message, isError = false) {
  elements.statusText.textContent = message;
  elements.statusText.classList.toggle("status-error", isError);
}

function normalizeApiTimestamp(value) {
  if (!value || typeof value !== "string") return null;
  if (value.includes("T")) return new Date(value);
  if (value.includes(" ")) return new Date(value.replace(" ", "T"));
  return new Date(value);
}

function setUpdatedAt(rawValue) {
  const parsedDate = normalizeApiTimestamp(rawValue);
  const dateToUse =
    parsedDate && Number.isFinite(parsedDate.getTime()) ? parsedDate : new Date();

  elements.updatedAt.textContent = `Updated ${new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(dateToUse)}`;
}

function renderOverview(overview) {
  elements.currentPower.textContent = formatKw(overview.currentPowerKw);
  elements.energyToday.textContent = formatKwh(overview.todayEnergyKwh);
  elements.peakPower.textContent = formatKw(overview.peakPowerKw);
  elements.co2Avoided.textContent = formatKg(overview.co2AvoidedKg);

  elements.kettleCount.textContent = formatCount(toKettles(overview.todayEnergyKwh));
  elements.macbookCount.textContent = formatCount(
    toMacbooks(overview.todayEnergyKwh)
  );
  elements.homesPowered.textContent = formatCount(toHomes(overview.currentPowerKw));
}

function renderPowerChart(powerPoints) {
  const labels = powerPoints.map((point) => formatTimeLabel(point.timestamp));
  const values = powerPoints.map((point) => point.powerKw);

  if (state.powerChart) {
    state.powerChart.data.labels = labels;
    state.powerChart.data.datasets[0].data = values;
    state.powerChart.update();
    return;
  }

  state.powerChart = new Chart(elements.powerChartCanvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "kW",
          data: values,
          tension: 0.35,
          fill: true,
          borderColor: "rgb(41, 130, 58)",
          backgroundColor: "rgba(41, 130, 58, 0.2)",
          pointRadius: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value) => `${value} kW`,
          },
        },
      },
    },
  });
}

function renderEnergyChart(days) {
  const labels = days.map((day) => formatDateLabel(day.date));
  const values = days.map((day) => day.energyKwh);

  if (state.energyChart) {
    state.energyChart.data.labels = labels;
    state.energyChart.data.datasets[0].data = values;
    state.energyChart.update();
    return;
  }

  state.energyChart = new Chart(elements.energyChartCanvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "kWh",
          data: values,
          borderRadius: 4,
          backgroundColor: "rgba(241, 166, 14, 0.8)",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value) => `${value} kWh`,
          },
        },
      },
    },
  });
}

async function loadData() {
  if (state.activeRequest) {
    state.activeRequest.abort();
  }

  const controller = new AbortController();
  state.activeRequest = controller;

  elements.refreshButton.setAttribute("aria-busy", "true");
  setStatus("Loading latest data...");

  try {
    const data = await fetchDashboardData(controller.signal);

    renderOverview(data.overview);
    renderPowerChart(data.power.points);
    renderEnergyChart(data.energy.days);
    setUpdatedAt(data.overview.lastUpdateTime);
    setStatus("Live data loaded.");
  } catch (error) {
    if (error.name === "AbortError") return;

    console.error(error);
    setStatus(
      "Could not load data. Check API config or switch to mock mode.",
      true
    );
  } finally {
    if (state.activeRequest === controller) {
      state.activeRequest = null;
    }

    elements.refreshButton.removeAttribute("aria-busy");
  }
}

function startPolling() {
  const intervalMs = getPollingIntervalMs();
  setInterval(loadData, intervalMs);
}

elements.refreshButton.addEventListener("click", loadData);

loadData();
startPolling();
