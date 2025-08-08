# OPC UA Tracer

Electron + React (Vite + TypeScript). Simulation and real modes.

Quick start (dev, simulation)
- npm install
- npm run dev:simulation

Production build (simulated payload compiled in via env)
- npm run build:simulation

Production build (real OPC UA)
- npm run deploy

Run the packaged app
- Open release/ folder and run the installer.

Notes
- Dev uses Electron to load Vite dev server.
- Simulation is toggled via SIMULATION env.
- Up to 8 series per chart, 1 Hz.
- Drag to chart via add buttons (simple MVP); can extend to DnD later.
# opcua-tracer
