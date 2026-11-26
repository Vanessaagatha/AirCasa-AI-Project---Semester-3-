# CoolNest API contract (FastAPI)

The frontend switches to these endpoints when **Settings → Data source → FastAPI** is selected.
All requests go to `{baseUrl}` (default `http://localhost:8000`). Responses are JSON in `snake_case`;
`src/services/mappers.ts` converts them to the app's TypeScript types. Unknown or missing fields become `null`
and are displayed as "—".

The server must allow CORS from the frontend origin (e.g. `http://localhost:5173`).

Errors: return a non-2xx status with `{"detail": "message"}`. A **503** from `/api/v1/predict` is shown as
"Prediction model unavailable" rather than a generic error.

---

## `GET /api/v1/health`

```json
{ "status": "ok", "model_loaded": true, "model_version": "lstm-2026-11-01" }
```

## `GET /api/v1/weather/current`

```json
{
  "timestamp": "2026-10-21T12:50:00+07:00",
  "location_name": "Tebet, Jakarta",
  "temperature_c": 31.6,
  "humidity_pct": 69,
  "condition": "partly-cloudy",
  "rain_probability_pct": 35,
  "wind_speed_ms": 2.1,
  "wind_direction_deg": 240,
  "pm25": 41,
  "pm25_source": "Regional monitor network",
  "source_label": "BMKG forecast"
}
```

`condition` ∈ `clear | partly-cloudy | cloudy | haze | light-rain | rain | thunderstorm`.
`rain_probability_pct` is the probability within the next 3 hours.
`pm25` is a **regional outdoor estimate** in µg/m³.

## `GET /api/v1/weather/outlook?hours=12`

```json
[ { "timestamp": "2026-10-21T13:00:00+07:00", "temperature_c": 32.0, "rain_probability_pct": 25, "condition": "cloudy" } ]
```

## `GET /api/v1/rooms/{room_id}/readings/latest`

```json
{
  "room_id": "room_master",
  "timestamp": "2026-10-21T12:50:00+07:00",
  "temperature_c": 30.2,
  "humidity_pct": 66,
  "sensor_id": "esp32-01",
  "status": "ok"
}
```

`status` ∈ `ok | stale | missing`. Use `missing` with null values when no recent reading exists.

## `GET /api/v1/rooms/{room_id}/history?hours=72&step_minutes=60`

```json
[
  {
    "timestamp": "2026-10-18T13:00:00+07:00",
    "indoor_temp_c": 29.8,
    "indoor_humidity_pct": 67,
    "outdoor_temp_c": 31.2,
    "outdoor_humidity_pct": 70,
    "pm25": 38
  }
]
```

Return rows oldest first. Use `null` for gaps; charts show them as breaks.

## `POST /api/v1/predict`

Request:

```json
{ "room": { "...": "full Room object, see ROOM_SCHEMA.md" }, "horizon_minutes": 60 }
```

Response:

```json
{
  "status": "ok",
  "generated_at": "2026-10-21T12:50:00+07:00",
  "target_time": "2026-10-21T13:50:00+07:00",
  "horizon_minutes": 60,
  "current_temp_c": 30.2,
  "predicted_temp_c": 30.8,
  "interval_low_c": 30.1,
  "interval_high_c": 31.5,
  "model_name": "Gradient boosting regressor",
  "model_version": "gbr-2026-11-01",
  "is_demo": false,
  "inputs": {
    "indoor_temp_c": 30.2,
    "indoor_humidity_pct": 66,
    "outdoor_temp_c": 31.6,
    "outdoor_humidity_pct": 69,
    "pm25": 41,
    "hour_of_day": 12,
    "window_area_m2": 2.43,
    "orientation": "W"
  },
  "message": null
}
```

`status` ∈ `ok | model-unavailable | insufficient-data`. When not `ok`, set `predicted_temp_c` to `null`
and explain in `message`. Interval fields are optional; leave them `null` rather than inventing a range.

## `GET /api/v1/rooms/{room_id}/forecasts?hours=24`

Past forecasts paired with the observation at the target time, oldest first:

```json
[
  {
    "issued_at": "2026-10-21T11:00:00+07:00",
    "target_time": "2026-10-21T12:00:00+07:00",
    "predicted_temp_c": 29.5,
    "observed_temp_c": 29.6,
    "is_demo": false
  }
]
```
