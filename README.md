# CoolNest 3D <UNDER MAINTAINECE - STILL IN PROGRESS W/ LOCAL MEMORY>

Indoor temperature forecasting, airflow and heat what-ifs, and context-aware ventilation guidance for first-time homeowners in dense Indonesian cities.
Frontend prototype for a Computer Science – Artificial Intelligence project at BINUS University.

> **Prototype status.** The app runs on clearly labelled **demo data** by default. No sensor, weather API or trained model is connected.
> Demo forecasts are labelled **DEMO DATA — NOT A REAL MODEL PREDICTION**. The airflow and heat simulation is a **simplified physics model**, not CFD,
> and is shown with uncertainty ranges and a warning on every view.

---

## Quick start

Requirements: **Node.js 20.19+ or 22.12+** (tested on Node 22) and npm.

```bash
cd coolnest-3d
npm install
npm run dev
```

Open http://localhost:5173 and choose **Log in**.

| Demo account | Email | Password | Role |
|---|---|---|---|
| Owner | `demo@coolnest.app` | `demo1234` | Owner of “Rumah Tebet” |
| Household member | `sari@coolnest.app` | `demo1234` | Editor |

The login page has one-click buttons for both. You can also create a new account (it joins the household as a viewer, or with the invited role if
an owner invited that email).

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Type-check (`tsc -b`) and build to `dist/` |
| `npm run preview` | Serve the production build at http://localhost:4173 |
| `npm run lint` | Run oxlint |

When hosting the static build, route unknown paths to `index.html` so deep links such as `/app/rooms` work.

### Presenting tips
- **Try collaboration live:** log in as the owner in one tab with *Keep me logged in* unticked, and as Sari in a second tab. Edits, comments, activity
  and “online now” avatars sync between the tabs.
- **Settings → Data sources → Demo scenario** switches between *Typical day*, *Hot spell*, *Rain incoming*, *Poor outdoor air*, *Sensor offline* and
  *Model unavailable* to show each guidance rule, alert and missing-data state.
- **Airflow & Heat:** untick windows, change wind direction or add an air conditioner to a room to compare scenarios.
- **Theme:** the sun/moon button in the top bar cycles light, dark and system.
- **Settings → Privacy & data → Clear all local data** resets everything to the demo state.

---

## What’s new in 0.2

| Area | Details |
|---|---|
| Accounts | Log in, sign up, “keep me logged in”, log out back to the login page, protected routes with return-to links. Passwords are salted and hashed (PBKDF2). |
| Profile | Name, phone, occupation, bio, photo upload (resized locally) or avatar colour, theme, change password, delete account, personal activity counts. |
| Collaboration | Household with owner / editor / viewer roles, invitations with codes, role changes and removal, per-room comment threads, activity log with filters, live presence between tabs. Viewers get a read-only editor. |
| Appliances | 12 appliance types with typical wattage, duty cycle, heat fraction and schedules. Add, edit, duplicate and drag them in 3D; fans spin when scheduled on. Used by the heat simulation and dashboard. |
| Airflow & heat | New page with schematic 3D airflow particles, sun-on-glass overlay, ventilation estimate (ACH, L/s, per-opening role and speed), 6–24 h temperature projections for up to four scenarios with assumption bands, heat-source breakdown and a method section. |
| Dark / light mode | Full dark theme including charts, 3D scene and room previews; light, dark or follow system. |
| Settings | Nine sections: general (theme, motion, compact layout, time format, location, auto refresh), home, rooms & sensors, notifications (in-app and browser), editable guidance thresholds, simulation assumptions, data sources, privacy & export, about. |
| Design | Airy teal-blue “breeze” palette, new logo, grouped navigation, account menu, dashboard summary with alerts. |

---

## Pages

| Route | Page |
|---|---|
| `/` | Landing page with live 3D room, features, how it works, audience, limitations |
| `/login`, `/register` | Authentication with demo accounts and invite codes |
| `/app` | Dashboard: home air summary, alerts, indoor/outdoor metrics, rooms, selected-room details, forecast, top guidance |
| `/app/rooms` | Room editor: dimensions, orientation, openings, appliances, comments, JSON import/export, interactive 3D |
| `/app/simulation` | Airflow & heat what-if simulation |
| `/app/household` | Members, invitations, roles, activity, recent comments |
| `/app/environment` | Weather, 12-hour outlook, PM2.5, room sensors |
| `/app/prediction` | 60-minute forecast, observed vs forecast, inputs, model card, history |
| `/app/guidance` | Rule-based guidance with the five required sections and rule evaluation panel |
| `/app/history` | Charts with date range, room filter, brush zoom, CSV export |
| `/app/profile` | Your profile |
| `/app/settings/:section` | Detailed settings |

---

## Project structure

```
src/
├── App.tsx                    Routes, providers, auth guards
├── components/                UI primitives, Avatar, ThemeToggle, MetricCard, charts, layout (AppShell, navigation)
├── context/                   Settings (theme, thresholds, assumptions), Auth, Household (collaboration), Rooms
├── data/                      ALL demo data: rooms, synthetic environment, scenarios
├── features/
│   ├── rooms/                 Geometry, schema, 3D scene, appliances (catalogue, meshes, editor), previews
│   ├── simulation/            Solar position, ventilation, heat balance, airflow visualisation
│   ├── collab/                Room comments
│   ├── environment/ prediction/ guidance/
├── hooks/  lib/  pages/  services/  types/
backend-example/main.py        FastAPI stub implementing the API contract
docs/                          API contract, room schema, guidance rules, simulation method
```

Data flow is unchanged: pages call hooks → services → demo generators or the FastAPI client. Accounts and collaboration live in
`services/authService.ts` and `context/HouseholdContext.tsx` and use the same storage keys a backend version would replace.

---

## Implemented vs not implemented

### Implemented
- Everything listed above, plus the 0.1 features: working navigation, editable 3D room with draggable openings, JSON save/load, interactive charts,
  guidance cards, empty/loading/error states, demo scenarios, FastAPI service layer and connection test.

### Not implemented (by design for this prototype)
- **No trained ML model.** The demo forecast is a labelled heuristic.
- **No real sensors, weather or air-quality APIs.**
- **No server-side accounts or sync.** Accounts, households and comments are stored in this browser. Collaboration works between tabs and
  windows on one device; multi-device sync and emailed invitations need a backend. This is not production-grade security.
- **No CFD and no validated thermal simulation.** The model is a teaching-level estimate with stated assumptions and ranges.
- Room scan import (shown as *Not supported*).

### Scientific limitations respected in the UI
- Airflow paths are labelled schematic; the simulation page always shows a “simplified physics estimate, not a validated simulation” warning.
- Temperature differences between scenarios are shown as ranges and described as model estimates, never as guaranteed degrees of cooling.
- Demo forecasts are never called trained AI results. Outdoor PM2.5 is labelled regional, not indoor.
- The app does not claim to reduce urban heat island intensity.

---

## Documentation

- `docs/API_CONTRACT.md` — FastAPI endpoints and payloads
- `docs/ROOM_SCHEMA.md` — room JSON, including appliances
- `docs/GUIDANCE_RULES.md` — guidance rules and thresholds
- `docs/SIMULATION.md` — airflow and heat model equations, assumptions and limitations
