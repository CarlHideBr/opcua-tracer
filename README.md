# OPC UA Tracer

Electron app to browse OPC UA servers and trend live variables in real time. Built with Electron (main/preload) and React 18 + Vite + TypeScript (renderer). Supports both simulation and real servers.

## Features
- Server management: save/select servers; connect/disconnect; Anonymous or Username/Password.
- Security: choose MessageSecurityMode and SecurityPolicy; dev-friendly auto-accept of unknown server certs.
- Browse: full tree with expand/collapse and filter; UA Expert–style labels (last dot segment, no ns prefix).
- Data types: Variable nodes annotated with scalar DataType; only displayable scalar types are draggable.
- Charts: drag-and-drop tags to charts; up to ~8 variables per chart; legend toggles; pan/zoom; pause/resume; CSV export; x/y scaling; multiple charts.
- Smooth rendering: 100 ms time buckets with last-value carry-forward and a 10 Hz heartbeat.
- Persistence: server list and per-server chart layouts via electron-store.
- Simulation mode: test trending without a live OPC UA server.
- Windows packaging: electron-builder (NSIS).

## Quick start
Prerequisites: Node.js 18+ on Windows.

Install dependencies:

```powershell
npm install
```

Run in dev (real OPC UA):

```powershell
npm run dev
```

Run in dev with simulation:

```powershell
npm run dev:simulation
```

## Build & package
Build everything and create a Windows installer (real OPC UA):

```powershell
npm run deploy
```

Build with simulation compiled in:

```powershell
npm run build:simulation
```

The installer will be in `release/`. Run it to install the app.

## Scripts
- dev: Vite + Electron with hot reload.
- dev:simulation: same as dev, with simulation mode.
- build: builds UI, preload, main, then packages (Windows NSIS).
- build:simulation: build with `SIMULATION=true`.
- deploy: build with `SIMULATION=false` (real OPC UA).
- package: package using electron-builder (Windows NSIS).
- lint: eslint.
- preview: `vite preview`.

## Using the app
1. Start the app (dev or packaged).
2. Add a server (endpoint URL, optional Username/Password). Choose SecurityPolicy and MessageSecurityMode.
3. Connect. The tree browser loads; filter and expand nodes.
4. Drag supported scalar variables (Boolean and numeric) into a chart. Up to ~8 per chart.
5. Use legend toggles, pan/zoom, pause/resume. Export to CSV when needed.

Notes
- Trends render at ~10 Hz with continuity when values don’t change.
- Sidebar is collapsible and resizable; width is persisted.

## Architecture
- Main: `src/main/index.ts` (Electron bootstrap, IPC), `src/main/opcua.ts` (connect/browse/subscribe/write), `src/main/store.ts` (electron-store persistence).
- Preload: `src/preload/index.ts` (IPC bridge via contextBridge).
- Renderer: `src/renderer/ui/App.tsx`, `Sidebar.tsx`, `Charts.tsx`, `store.ts`, `styles.css`.
- Packaging: `package.json` (electron-builder), `assets/icon.ico`.

## Security & persistence
- Unknown OPC UA server certificates are auto-accepted in development. Consider adding a trust prompt for production.
- Passwords: supported; if you choose to persist credentials, prefer an explicit "remember password" flow and consider encryption at rest.
- PKI/certs and common cert file types are ignored by git (`pki/`, `*.pem`, `*.crt`, `*.cer`, `*.pfx`).

## Configuration
- SIMULATION: set to `true` to enable simulation mode (used by `dev:simulation` and `build:simulation`).
- ELECTRON_START_URL: used internally during dev to load the Vite server.

## Troubleshooting
- If certificate trust fails, delete the local `pki/` folder and reconnect to regenerate and auto-accept in dev.
- If the app can’t reach your server, verify endpoint URL, security policy/mode, and firewall settings.

## License
MIT

