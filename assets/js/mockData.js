function round(value, precision = 2) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function formatDate(date) {
  return date.toISOString().split("T")[0];
}

function generateTodayPowerSeries() {
  const now = new Date();
  const points = [];

  for (let hour = 0; hour <= 23; hour += 1) {
    const pointDate = new Date(now);
    pointDate.setHours(hour, 0, 0, 0);

    // Bell-curve style output peaking around noon.
    const normalized = Math.exp(-((hour - 12) ** 2) / 20);
    const weatherNoise = 0.75 + Math.random() * 0.35;
    const powerKw = round(Math.max(0, 45 * normalized * weatherNoise), 2);

    points.push({
      timestamp: pointDate.toISOString(),
      powerKw,
    });
  }

  return points;
}

function generateMonthlyEnergySeries() {
  const now = new Date();
  const days = [];

  for (let i = 29; i >= 0; i -= 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - i);

    const seasonalBase = 220;
    const swing = (Math.sin((i / 30) * Math.PI * 2) + 1) * 40;
    const weatherNoise = Math.random() * 60;

    days.push({
      date: formatDate(date),
      energyKwh: round(seasonalBase + swing + weatherNoise, 1),
    });
  }

  return days;
}

export function buildMockDashboardData() {
  const powerSeries = generateTodayPowerSeries();
  const energySeries = generateMonthlyEnergySeries();
  const currentPowerKw = powerSeries[new Date().getHours()]?.powerKw ?? 0;
  const todayEnergyKwh = round(
    powerSeries.reduce((total, point) => total + point.powerKw, 0),
    1
  );
  const peakPowerKw = Math.max(...powerSeries.map((point) => point.powerKw));
  const co2AvoidedKg = round(todayEnergyKwh * 0.36, 1);

  return {
    overview: {
      currentPowerKw,
      todayEnergyKwh,
      peakPowerKw,
      co2AvoidedKg,
    },
    power: {
      points: powerSeries,
    },
    energy: {
      days: energySeries,
    },
  };
}
