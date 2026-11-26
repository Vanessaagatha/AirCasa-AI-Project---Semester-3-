"""
CoolNest FastAPI stub — implements the endpoints in docs/API_CONTRACT.md.

It contains NO trained model and NO real sensor or weather integration.
Readings are placeholders, and /api/v1/predict returns 503 ("model unavailable")
until you plug in an independently trained and evaluated model in `predict_temperature()`.

Run:
    pip install fastapi uvicorn
    uvicorn main:app --reload --port 8000
Then in the app: Settings -> Data source -> FastAPI, URL http://localhost:8000, Test connection.
"""
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

WIB = timezone(timedelta(hours=7))
app = FastAPI(title="CoolNest API (stub)")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:4173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL = None  # load your trained model here, e.g. joblib.load("model.joblib")


def now() -> datetime:
    return datetime.now(WIB).replace(second=0, microsecond=0)


@app.get("/api/v1/health")
def health():
    return {"status": "ok", "model_loaded": MODEL is not None, "model_version": None}


@app.get("/api/v1/weather/current")
def weather_current():
    # TODO: replace with a real weather + air quality provider
    return {
        "timestamp": now().isoformat(),
        "location_name": "Jakarta (stub)",
        "temperature_c": None,
        "humidity_pct": None,
        "condition": "cloudy",
        "rain_probability_pct": None,
        "wind_speed_ms": None,
        "wind_direction_deg": None,
        "pm25": None,
        "pm25_source": "Not connected",
        "source_label": "CoolNest API stub",
    }


@app.get("/api/v1/weather/outlook")
def weather_outlook(hours: int = 12):
    return []


@app.get("/api/v1/rooms/{room_id}/readings/latest")
def latest_reading(room_id: str):
    # TODO: read the latest sensor row for this room from your database
    return {"room_id": room_id, "timestamp": now().isoformat(), "temperature_c": None,
            "humidity_pct": None, "sensor_id": None, "status": "missing"}


@app.get("/api/v1/rooms/{room_id}/history")
def history(room_id: str, hours: int = 24, step_minutes: int = 60):
    return []


class PredictRequest(BaseModel):
    room: dict[str, Any]
    horizon_minutes: int = 60


def predict_temperature(features: dict[str, Any]) -> Optional[float]:
    if MODEL is None:
        return None
    # return float(MODEL.predict([...features...])[0])
    return None


@app.post("/api/v1/predict")
def predict(req: PredictRequest):
    if MODEL is None:
        raise HTTPException(status_code=503, detail="No trained model is loaded on the server.")
    raise HTTPException(status_code=501, detail="Wire predict_temperature() to your model.")


@app.get("/api/v1/rooms/{room_id}/forecasts")
def forecasts(room_id: str, hours: int = 24):
    return []
