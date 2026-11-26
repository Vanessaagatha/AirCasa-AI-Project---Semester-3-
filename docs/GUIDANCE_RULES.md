# Guidance rules

Guidance is produced by `evaluateGuidance()` in `src/features/guidance/guidanceRules.ts`, a pure function
with no machine learning or text generation. All thresholds are in `GUIDANCE_THRESHOLDS` in the same file
so they can be reviewed in one place. They are **illustrative prototype defaults**.

Every card shows: (1) detected condition, (2) suggested consideration, (3) why it may matter,
(4) supporting data with sources, (5) uncertainty and limitations, plus the rule trigger.
Rules that lack inputs are skipped and reported as skipped, never guessed.

| Rule id | Fires when | Severity |
|---|---|---|
| `data-validity` | Indoor reading, outdoor weather or forecast is missing/invalid | caution if no indoor data, else info |
| `overheating` | Indoor or forecast ≥ 29 °C, or heat index ≥ 32 °C | caution if indoor ≥ 31 °C or heat index ≥ 39 °C |
| `ventilation` | Room has openable windows and both temperatures exist; message depends on outdoor − indoor difference, PM2.5 and rain | consider when outdoor ≥ 1 °C cooler with acceptable air and no rain, else info |
| `air-quality` | Regional PM2.5 > 35.4 µg/m³ | caution above 55.4 µg/m³ |
| `rain` | Openable windows and rain probability ≥ 60 % now or in the next 3 hourly steps | consider |
| `shading-fan` | Unshaded W/SW/NW windows 12:00–18:00 or E/SE/NE windows 06:00–11:00; or a fan with indoor ≥ 28 °C | consider |
| `humidity` | Indoor relative humidity ≥ 70 % | info |

## References used for the reference scales
- Heat index: US National Weather Service Rothfusz regression; caution bands 27–32 °C, extreme caution 32–39 °C, danger ≥ 39 °C.
- PM2.5: US EPA 24-hour AQI breakpoints (2024 revision): 9.0 / 35.4 / 55.4 µg/m³; WHO 2021 24-hour guideline 15 µg/m³ shown on charts.

These scales are used only as reference points. Before real use, thresholds should be checked against current
Indonesian guidance (e.g. ISPU) and comfort research for tropical housing.
