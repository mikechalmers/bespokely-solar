export const EQUIVALENCY = {
  kettleBoilKwh: 0.11,
  macbookChargeKwh: 0.07,
  avgHomePowerKw: 1.25,
};

function formatWithIntl(value, options) {
  return new Intl.NumberFormat("en-US", options).format(value);
}

export function formatKw(value) {
  if (!Number.isFinite(value)) return "--";
  return `${formatWithIntl(value, { maximumFractionDigits: 1 })} kW`;
}

export function formatKwh(value) {
  if (!Number.isFinite(value)) return "--";
  return `${formatWithIntl(value, { maximumFractionDigits: 1 })} kWh`;
}

export function formatKg(value) {
  if (!Number.isFinite(value)) return "--";
  return `${formatWithIntl(value, { maximumFractionDigits: 1 })} kg`;
}

export function formatCount(value) {
  if (!Number.isFinite(value)) return "--";
  return formatWithIntl(Math.round(value), { maximumFractionDigits: 0 });
}

export function toKettles(energyKwh) {
  return energyKwh / EQUIVALENCY.kettleBoilKwh;
}

export function toMacbooks(energyKwh) {
  return energyKwh / EQUIVALENCY.macbookChargeKwh;
}

export function toHomes(powerKw) {
  return powerKw / EQUIVALENCY.avgHomePowerKw;
}

export function formatTimeLabel(timestamp) {
  const date = new Date(timestamp);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatDateLabel(dateString) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}
