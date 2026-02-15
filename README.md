# Grafana Garden Demo

This is a tiny simulated "smart garden" app that exposes Prometheus metrics.
Grafana reads those metrics to show live charts.

## Run

```bash
docker compose up --build
```

- App UI: http://localhost:8080/ui
- Metrics: http://localhost:8080/metrics
- Prometheus: http://localhost:9090

## Grafana setup (complete config)

1. Open Grafana: http://localhost:3000
2. Log in.
If you never changed the default, use username `admin` and password `admin`.
3. Add the Prometheus data source.
Go to **Connections** → **Data sources** → **Add data source** → **Prometheus**.
4. Set the data source fields:
- Name: `Garden Prometheus` (any name is fine)
- URL: `http://localhost:9090`
- Access: `Server` (default)
- Min time interval: `2s` (optional, but makes the charts feel alive)
5. Click **Save & Test**.

## Grafana dashboard (recommended layout)

1. Go to **Dashboards** → **New** → **New dashboard** → **Add visualization**.
2. Select the `Garden Prometheus` data source.
3. Add the following panels (one per panel).

PromQL queries:
- Soil moisture: `garden_soil_moisture_percent`
- Air temperature: `garden_air_temperature_celsius`
- Light: `garden_light_lux`
- Tank level: `garden_tank_level_percent`
- Pump state: `garden_pump_on`
- Pump cycles per min: `increase(garden_pump_cycles_total[1m])`
- Alerts per min: `rate(garden_alerts_total[1m])`

Panel display tips:
- Use **Time series** for the first four metrics.
- Use **Stat** or **Time series (staircase)** for `garden_pump_on` and set value mappings `0 = Off`, `1 = On`.
- Use **Time series** for pump cycles and alerts.
- Set units for better readability:
  - Soil/Tank: `percent (0-100)`
  - Temperature: `celsius (°C)`
  - Light: `lux (lx)`

Dashboard settings:
- Time range: Last 5 minutes (or 15 minutes)
- Refresh: 2s

## Optional: Table panel for “current values”

1. Add a **Table** visualization.
2. Add the same queries as above.
3. Toggle **Instant** for each query (so Grafana shows the latest sample).
4. Use **Transformations** → **Merge** to show all metrics in one table.

Use the app UI at http://localhost:8080/ui to see the same metrics and current values.

<img width="1457" height="822" alt="Screenshot 2026-02-15 at 12 10 47 AM" src="https://github.com/user-attachments/assets/a2005ae4-5360-4dc6-8ecb-a7595319d82c" />
<img width="1454" height="818" alt="Screenshot 2026-02-15 at 12 11 06 AM" src="https://github.com/user-attachments/assets/8bde4df0-dd49-4f4e-832a-71475b6a01ff" />




