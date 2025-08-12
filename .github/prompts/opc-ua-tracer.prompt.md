# OPC UA Tracer — project memory prompt

Purpose
- Durable project memory so AI assistants can pick up instantly next time.

Quick context
- App: Electron (main/preload) + React 18 (Vite) + TypeScript 5
- OPC UA: node-opcua for connect/browse/subscribe/write; SIMULATION mode built-in
- UI: Recharts for trending; react-dnd for drag/drop; Zustand for state; electron-store for persistence
- Node: 20+ recommended (package.json engines >=20)

Dev/run
- Install: npm install
- Dev (real): npm run dev
- Dev (sim): npm run dev:simulation
- Build portable: npm run deploy (output: release/win-unpacked)

Key files
- src/main/index.ts — Electron bootstrap + IPC
- src/main/opcua.ts — OPC UA logic (browse/subscribe/write, optional history)
- src/main/store.ts — electron-store persistence
- src/preload/index.ts — contextBridge API
- src/renderer/ui/* — App, Sidebar, Charts, store, styles
- docs/PROJECT_SUMMARY.md — architecture + decisions
- docs/NEXT_STEPS.md — active tasks and priorities

Operational notes
- Unknown server certs are auto-accepted in dev; consider a trust UI before production
- Charts render at ~10 Hz using 100 ms buckets + heartbeat for continuity
- Drag only Boolean/numeric scalar variables; ~8 series per chart recommended

On start (assistant checklist)
1) Read README.md
2) Read docs/PROJECT_SUMMARY.md
3) Read docs/NEXT_STEPS.md
4) If running dev fails, verify Node 20+, run npm install, then npm run dev (or npm run dev:simulation) and triage errors

Last session (2025-08-11)
- Refreshed understanding; added this prompt and docs/NEXT_STEPS.md
- Note: A dev run failed in the terminal; next step is to open the task/terminal output and fix
