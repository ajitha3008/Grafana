const express = require('express');
const promClient = require('prom-client');

const app = express();
const port = process.env.PORT || 8080;

const register = new promClient.Registry();

promClient.collectDefaultMetrics({
  register,
  prefix: 'garden_',
});

const soilMoisture = new promClient.Gauge({
  name: 'garden_soil_moisture_percent',
  help: 'Simulated soil moisture percentage',
  registers: [register],
});

const airTemp = new promClient.Gauge({
  name: 'garden_air_temperature_celsius',
  help: 'Simulated air temperature in Celsius',
  registers: [register],
});

const lightLux = new promClient.Gauge({
  name: 'garden_light_lux',
  help: 'Simulated light level in lux',
  registers: [register],
});

const tankLevel = new promClient.Gauge({
  name: 'garden_tank_level_percent',
  help: 'Simulated water tank level percentage',
  registers: [register],
});

const pumpOn = new promClient.Gauge({
  name: 'garden_pump_on',
  help: 'Pump running state (1 on, 0 off)',
  registers: [register],
});

const pumpCycles = new promClient.Counter({
  name: 'garden_pump_cycles_total',
  help: 'Total pump cycles',
  registers: [register],
});

const alertsTotal = new promClient.Counter({
  name: 'garden_alerts_total',
  help: 'Total alert events (low tank or extreme temps)',
  registers: [register],
});

const gardenMetricNames = new Set([
  'garden_soil_moisture_percent',
  'garden_air_temperature_celsius',
  'garden_light_lux',
  'garden_tank_level_percent',
  'garden_pump_on',
  'garden_pump_cycles_total',
  'garden_alerts_total',
]);

let state = {
  soil: 55,
  temp: 22,
  light: 300,
  tank: 80,
  pump: 0,
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function jitter(value, min, max, step) {
  const delta = (Math.random() * 2 - 1) * step;
  return clamp(value + delta, min, max);
}

let tick = 0;

setInterval(() => {
  tick += 1;

  const daylight = Math.sin((tick / 180) * Math.PI) * 0.5 + 0.5; // 0..1
  state.light = clamp(100 + daylight * 900 + (Math.random() * 40 - 20), 50, 1200);

  state.temp = clamp(18 + daylight * 10 + (Math.random() * 2 - 1), 14, 35);

  state.soil = jitter(state.soil, 5, 95, 1.5);

  let pump = 0;
  if (state.soil < 30 && state.tank > 10) {
    pump = 1;
    state.soil = clamp(state.soil + 6, 5, 95);
    state.tank = clamp(state.tank - 1.2, 0, 100);
  } else {
    state.tank = jitter(state.tank, 5, 100, 0.2);
  }

  if (pump && !state.pump) {
    pumpCycles.inc();
  }

  state.pump = pump;

  const lowTank = state.tank < 10;
  const tempAlert = state.temp < 15 || state.temp > 32;
  if (lowTank || tempAlert) {
    alertsTotal.inc();
  }

  soilMoisture.set(state.soil);
  airTemp.set(state.temp);
  lightLux.set(state.light);
  tankLevel.set(state.tank);
  pumpOn.set(state.pump);
}, 1000);

app.get('/api/garden-metrics', async (req, res) => {
  const metrics = await register.getMetricsAsJSON();
  const filtered = metrics
    .filter((metric) => gardenMetricNames.has(metric.name))
    .map((metric) => {
      const sample = metric.values && metric.values.length > 0 ? metric.values[0] : null;
      return {
        name: metric.name,
        type: metric.type,
        help: metric.help,
        value: sample ? sample.value : null,
      };
    });

  res.json({
    updatedAt: new Date().toISOString(),
    metrics: filtered,
  });
});

app.get('/ui', (req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Grafana Garden Demo</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f7f5f2;
        --panel: #ffffff;
        --ink: #1c1c1c;
        --muted: #5c5c5c;
        --accent: #2f6f6d;
        --border: #e4ded7;
      }

      body {
        margin: 0;
        font-family: "Segoe UI", "Trebuchet MS", Arial, sans-serif;
        background: linear-gradient(160deg, #fdfbf8 0%, #f2ece6 100%);
        color: var(--ink);
      }

      main {
        max-width: 920px;
        margin: 40px auto;
        padding: 0 20px 40px;
      }

      header {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-bottom: 24px;
      }

      h1 {
        font-size: 28px;
        margin: 0;
        letter-spacing: 0.4px;
      }

      .subtle {
        color: var(--muted);
        font-size: 14px;
      }

      .panel {
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 14px;
        padding: 18px 20px;
        box-shadow: 0 10px 24px rgba(28, 28, 28, 0.06);
        margin-bottom: 18px;
      }

      .metrics-list {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 12px;
      }

      .metric-chip {
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 10px 12px;
        background: #faf7f4;
        font-size: 13px;
      }

      .metric-chip strong {
        display: block;
        font-size: 14px;
        margin-bottom: 4px;
        color: var(--accent);
      }

      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 14px;
      }

      th, td {
        text-align: left;
        padding: 10px 6px;
        border-bottom: 1px solid var(--border);
      }

      th {
        font-weight: 600;
        color: var(--muted);
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .value {
        font-weight: 600;
        color: var(--accent);
      }

      .links {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        font-size: 13px;
        color: var(--muted);
      }

      a {
        color: var(--accent);
        text-decoration: none;
      }

      a:hover {
        text-decoration: underline;
      }

      @media (max-width: 600px) {
        main {
          margin-top: 24px;
        }

        table, thead, tbody, th, td, tr {
          display: block;
        }

        thead {
          display: none;
        }

        tr {
          margin-bottom: 12px;
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 10px;
          background: #fff;
        }

        td {
          border: none;
          padding: 6px 0;
        }

        td::before {
          content: attr(data-label);
          display: block;
          font-size: 11px;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 4px;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <header>
        <h1>Grafana Garden Demo</h1>
        <div class="subtle">This page shows the metrics exported to Prometheus. Grafana reads them from Prometheus.</div>
      </header>

      <section class="panel">
        <div class="subtle">Metrics published</div>
        <div class="metrics-list" id="metricList"></div>
      </section>

      <section class="panel">
        <div class="subtle">Latest values in Prometheus</div>
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th>Value</th>
              <th>Type</th>
              <th>Help</th>
            </tr>
          </thead>
          <tbody id="metricsTable"></tbody>
        </table>
        <div class="subtle" id="lastUpdated"></div>
      </section>

      <section class="panel">
        <div class="links">
          <span>Endpoints:</span>
          <a href="/metrics" target="_blank" rel="noreferrer">/metrics</a>
          <a href="http://localhost:9090" target="_blank" rel="noreferrer">Prometheus</a>
          <a href="http://localhost:3000" target="_blank" rel="noreferrer">Grafana</a>
        </div>
      </section>
    </main>

    <script>
      const metricLabels = {
        garden_soil_moisture_percent: 'Soil moisture (%)',
        garden_air_temperature_celsius: 'Air temperature (°C)',
        garden_light_lux: 'Light (lux)',
        garden_tank_level_percent: 'Tank level (%)',
        garden_pump_on: 'Pump state (0/1)',
        garden_pump_cycles_total: 'Pump cycles',
        garden_alerts_total: 'Alerts',
      };

      function formatValue(name, value) {
        if (value === null || value === undefined) return '—';
        if (name === 'garden_pump_on') return value === 1 ? 'On' : 'Off';
        if (name.endsWith('_percent')) return value.toFixed(1) + '%';
        if (name.endsWith('_celsius')) return value.toFixed(1) + ' °C';
        if (name.endsWith('_lux')) return Math.round(value) + ' lx';
        return value.toFixed(2);
      }

      async function refresh() {
        const res = await fetch('/api/garden-metrics');
        const data = await res.json();
        const list = document.getElementById('metricList');
        const table = document.getElementById('metricsTable');
        const updated = document.getElementById('lastUpdated');

        list.innerHTML = '';
        table.innerHTML = '';

        data.metrics.forEach((metric) => {
          const chip = document.createElement('div');
          chip.className = 'metric-chip';
          chip.innerHTML = '<strong>' + (metricLabels[metric.name] || metric.name) + '</strong>' + metric.name;
          list.appendChild(chip);

          const row = document.createElement('tr');
          row.innerHTML = '' +
            '<td data-label="Metric">' + (metricLabels[metric.name] || metric.name) + '</td>' +
            '<td class="value" data-label="Value">' + formatValue(metric.name, metric.value) + '</td>' +
            '<td data-label="Type">' + metric.type + '</td>' +
            '<td data-label="Help">' + metric.help + '</td>';
          table.appendChild(row);
        });

        const time = new Date(data.updatedAt);
        updated.textContent = 'Last updated: ' + time.toLocaleTimeString();
      }

      refresh();
      setInterval(refresh, 2000);
    </script>
  </body>
</html>`);
});

app.get('/', (req, res) => {
  res.redirect('/ui');
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Garden demo running on port ${port}`);
});
