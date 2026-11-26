# Airflow & heat simulation

Code: `src/features/simulation/` (`solar.ts`, `ventilation.ts`, `heatModel.ts`, `AirflowLayer.tsx`), page `src/pages/SimulationPage.tsx`.
Assumptions are editable in **Settings → Simulation model**.

> This is a **simplified, unvalidated** model intended for comparing options during a prototype demonstration.
> It is not computational fluid dynamics (CFD) and has not been calibrated against measurements.
> The UI always shows a warning, labels airflow paths as schematic, and reports results as low–high ranges.

## 1. Sun position and irradiance (`solar.ts`)
- NOAA-style solar position from date, latitude and longitude.
- Clear-sky direct normal irradiance (Meinel): `DNI = 1353 · 0.7^(AM^0.678)`, with air mass `AM = 1 / sin(altitude)`.
- Weather condition attenuates the beam (clear 1.0 … rain 0.15); diffuse sky rises under cloud.
- Irradiance on a vertical wall = beam · max(0, cos θ) + ½ diffuse + ½ · ground reflectance · global.

## 2. Ventilation (`ventilation.ts`)
Effective free area per opening: window area × open fraction (sliding 0.45, casement 0.85, louvre 0.6, fixed 0); outdoor doors 0.9.
Local wind = weather wind × urban wind factor (default 0.35).
Pressure coefficient Cp from the angle between wind direction and each wall's outward normal (+0.6 windward → −0.4 side → −0.3 leeward).

| Case | Formula |
|---|---|
| Cross ventilation (openings on differently exposed walls) | `Q = Cd · A_eff · v · √ΔCp`, `1/A_eff² = 1/A_in² + 1/A_out²` |
| Single-sided | `Q = 0.025 · A · v` (CIBSE AM10) |
| Stack (cross) | `Q = Cd · A_eff · √(2 g Δh ΔT / T̄)` |
| Stack (single-sided) | `Q = Cd · A/3 · √(g h ΔT / T̄)` |
| Combined | `Q = √(Q_wind² + Q_stack²)` + infiltration |

Optional "internal doors open" adds an outlet through doors to the rest of the house (Cp ≈ −0.2, half the door area).

## 3. Heat balance (`heatModel.ts`)
Single well-mixed zone, explicit Euler, 5-minute steps:

```
C · dT/dt = Q_solar + Q_walls + Q_roof + Q_windows + Q_internal + Q_ventilation − Q_ac
C = ρ·c_p·V + thermal_mass · floor_area
Q_solar   = Σ SHGC · 0.8 · A_window · I_wall · (shading factor if shaded)
Q_walls   = Σ U_wall · A_net · (T_out + 0.5·I_wall/20 − T)          exterior walls only
Q_roof    = U_roof · A_floor · (T_out + 0.75·I_horizontal/20 − T)  top floor only
Q_windows = Σ U_window · A_window · (T_out − T)
Q_internal= Σ appliance power · duty cycle · heat fraction (by schedule) + 75 W per person
Q_vent    = ρ·c_p·Q·(T_out − T)
Q_ac      = min(capacity, load needed to hold the set point)
```

Exterior walls are those with windows or outdoor doors (the front wall if none). Interior walls, floors and ceilings are assumed adiabatic.

## 4. Scenarios and uncertainty
Scenarios: windows closed, selected openings always open, open only when outdoor air is ≥ 0.5 °C cooler, and air conditioner at a set point (if the room has one).
Each runs three times:

| Variant | U-values | Solar gain | Thermal mass | Wind | Internal gains |
|---|---|---|---|---|---|
| low | ×0.8 | ×0.75 | ×1.25 | ×1.3 | ×0.85 |
| central | ×1 | ×1 | ×1 | ×1 | ×1 |
| high | ×1.2 | ×1.25 | ×0.8 | ×0.7 | ×1.15 |

Differences between scenarios are reported as the envelope of low/central/high comparisons.

## 5. Airflow visualisation (`AirflowLayer.tsx`)
Particles follow Catmull-Rom curves from inlet to outlet openings (cross) or loop in through the lower half and out through the upper half of an opening (single-sided).
Speed and particle count scale with the estimated flow. Colour shows whether incoming air is cooler (blue) or warmer (orange) than the room.
Fans draw recirculation loops only (they move air but do not exchange it). Amber panels outside windows show current direct sun.
These are **drawn paths**, not a solved flow field.

## Not modelled
Shading by neighbouring buildings or trees, heat exchange with adjacent rooms, humidity and latent loads, ceiling-fan comfort effects,
wind gusts and turbulence, and air temperature stratification.
