import { create } from 'zustand';
import type { ChartConfig, ChartSeries, RealtimePoint, UaNode, Workspace } from '../../shared/types';
import { api } from './ipc';

const initialCharts: ChartConfig[] = [
  { id: 'chart-1', title: 'Chart 1', series: [], xRangeMinutes: 15, xUnit: 'minutes', yMin: 'auto', yMax: 'auto', paused: false }
];

type TreeNode = UaNode & { expanded?: boolean };

export type AppState = {
  workspaces: Workspace[];
  selectedWorkspaceId?: string;
  connectedWorkspaceId?: string;
  nodes: TreeNode[];
  nodeFilter: string;
  charts: ChartConfig[];
  chartData: RealtimePoint[];
  connection: { connected: boolean };
  notifications: {
    id: string;
    type: 'info' | 'warning' | 'error' | 'success';
    message: string;
    actions?: { label: string; onClick: () => void; variant?: 'primary' | 'danger' | 'neutral' }[];
  }[];
  actions: {
  _persistCharts(): void;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    closeWorkspace(): Promise<void>;
    refreshBrowse(): Promise<void>;
    toggleNode(nodeId: string): Promise<void>;
    setNodeFilter(v: string): void;
    addChart(): void;
    removeChart(id: string): void;
    addSeriesToActiveChart(node: UaNode): void;
    addSeriesToChart(chartId: string, node: UaNode): void;
  toggleSeries(chartId: string, nodeId: string): void;
  setSeriesLabel(chartId: string, nodeId: string, label: string): void;
  removeSeries(chartId: string, nodeId: string): void;
    upsertWorkspace(ws: Workspace): Promise<void>;
    removeWorkspace(id: string): Promise<void>;
    setSelectedWorkspace(id?: string): Promise<void>;
    loadFromStore(): Promise<void>;
    exportWorkspaces(includeCharts?: boolean): Promise<void>;
    importWorkspaces(file: File, merge?: boolean): Promise<void>;
  exportWorkspace(id: string): Promise<void>;
  importWorkspace(id: string, file?: File): Promise<void>;
    setChartConfig(chartId: string, patch: Partial<ChartConfig>): void;
    toggleChartConfig(chartId: string): void;
    pauseChart(chartId: string, paused: boolean): void;
    setYScale(chartId: string, yMin?: number | 'auto', yMax?: number | 'auto'): void;
    setXRangeMinutes(chartId: string, minutes: number): void;
  setXRangeSeconds(chartId: string, seconds: number): void;
  setXUnit(chartId: string, unit: 'seconds' | 'minutes'): void;
    setZoom(chartId: string, range?: [number, number]): void;
    panChart(chartId: string, deltaMs: number): void;
  notify(message: string, type?: 'info' | 'warning' | 'error' | 'success'): void;
  confirm(opts: { message: string; confirmLabel?: string; cancelLabel?: string; destructive?: boolean; type?: 'info' | 'warning' | 'error' | 'success' }): Promise<boolean>;
    removeNotification(id: string): void;
  };
};
export const useAppStore = create<AppState>((set, get) => ({
  workspaces: [],
  selectedWorkspaceId: undefined,
  connectedWorkspaceId: undefined,
  nodes: [],
  nodeFilter: '',
  charts: initialCharts,
  chartData: [],
  connection: { connected: false },
  notifications: [],
  actions: {
    // internal helper to persist charts per server
    _persistCharts() {
      const state = get();
      const workspaceId = state.selectedWorkspaceId || '__default__';
      const charts = state.charts;
      // fire and forget
      (api.wsSaveCharts as any)(workspaceId, charts).catch(() => {});
    },
    async connect() {
      const wss: Workspace[] = await api.wsList();
      const { selectedWorkspaceId } = get();
      const chosen = wss.find(w => w.id === selectedWorkspaceId) || wss[0];
      if (!chosen) throw new Error('No workspaces. Create one with the + button.');
      try {
        await api.connect({
          endpointUrl: chosen.endpointUrl,
          username: chosen.username || '',
          password: chosen.password || '',
          authMode: chosen.authMode || (chosen.username ? 'username' : 'anonymous'),
          securityMode: chosen.securityMode || 'None',
          securityPolicy: chosen.securityPolicy || 'None'
        });
      } catch (e: any) {
  get().actions.notify(`Connection failed: ${e?.message || e}`, 'error');
        throw e;
      }
  set({ connection: { connected: true }, connectedWorkspaceId: chosen.id });
      // load charts for workspace
      try {
        const savedCharts = await api.wsGetCharts(chosen.id);
        if (savedCharts?.length) set({ charts: savedCharts });
      } catch {}
      await get().actions.refreshBrowse();
      const allSeries = get().charts.flatMap((c: ChartConfig) => c.series.map((s: ChartSeries) => ({ nodeId: s.nodeId, label: s.label })));
      if (allSeries.length > 0) await api.subscribe(allSeries, 100); // 10 Hz
      // Heartbeat timer to ensure constant values still produce a line at 10 Hz
  let hbTimer: any;
  // Keep a longer history in memory so we can pan/zoom beyond the live window
  const RETENTION_MINUTES = 360; // 6 hours at 10 Hz ~ 216k points
  const RETENTION_POINTS = RETENTION_MINUTES * 60 * 10;
      const startHeartbeat = () => {
        clearInterval(hbTimer);
        hbTimer = setInterval(() => {
          const state = get();
          if (state.chartData.length === 0) return;
          const last = state.chartData[state.chartData.length - 1];
          // push a copy so charts render a horizontal line segment
          const t = Date.now();
          const qt = Math.floor(t / 100) * 100; // quantize to 100ms buckets (10 Hz)
          if (last.t === qt) return; // already updated this bucket
          const copy: RealtimePoint = { ...last, t: qt };
          const next = [...state.chartData.slice(-RETENTION_POINTS + 1), copy];
          set({ chartData: next });
        }, 100);
      };

      api.onData((d) => {
        const state = get();
        // quantize timestamp to 100ms so multiple tags align and we get exactly 10 Hz buckets
        const tRaw = new Date(d.timestamp).getTime();
        const t = Math.floor(tRaw / 100) * 100;
        const v = typeof d.value === 'boolean' ? (d.value ? 1 : 0) : d.value;
        let next = state.chartData.slice();

        // Fast path when appending in time order
        const last = next[next.length - 1];
        if (!last) {
          const point: RealtimePoint = { t } as any;
          (point as any)[d.nodeId] = v;
          next = [point];
        } else if (last.t === t) {
          (last as any)[d.nodeId] = v;
        } else if (t > last.t) {
          const point: RealtimePoint = { t } as any;
          // carry forward previous values to keep continuity for other series
          for (const k of Object.keys(last)) {
            if (k !== 't') (point as any)[k] = (last as any)[k];
          }
          (point as any)[d.nodeId] = v;
          next = [...next, point];
        } else {
          // Historical or out-of-order data: insert in sorted position by t
          // Binary search for insertion index
          let lo = 0, hi = next.length - 1, idx = next.length; // default to end
          while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            const mt = next[mid].t;
            if (mt === t) { idx = mid; break; }
            if (mt < t) lo = mid + 1; else hi = mid - 1;
          }
          if (idx === next.length) idx = lo; // insertion point if not exact

          if (next[idx] && next[idx].t === t) {
            // Update existing bucket at time t
            (next[idx] as any)[d.nodeId] = v;
            // Propagate forward until the next explicit change boundary
            for (let i = idx + 1; i < next.length; i++) {
              const prevVal = (next[i - 1] as any)[d.nodeId];
              const currVal = (next[i] as any)[d.nodeId];
              if (currVal !== prevVal) break; // stop at next change boundary
              (next[i] as any)[d.nodeId] = v;
            }
          } else {
            // Create a new point, carry forward from previous index if exists
            const point: RealtimePoint = { t } as any;
            const prev = next[idx - 1];
            if (prev) {
              for (const k of Object.keys(prev)) {
                if (k !== 't') (point as any)[k] = (prev as any)[k];
              }
            }
            (point as any)[d.nodeId] = v;
            next = [...next.slice(0, idx), point, ...next.slice(idx)];
            // Propagate forward until the next explicit change boundary
            for (let i = idx + 1; i < next.length; i++) {
              const prevVal = (next[i - 1] as any)[d.nodeId];
              const currVal = (next[i] as any)[d.nodeId];
              if (currVal !== prevVal) break; // stop at next change boundary
              (next[i] as any)[d.nodeId] = v;
            }
          }
        }

        // Keep a fixed-size retention buffer (separate from visible window)
        if (next.length > RETENTION_POINTS) {
          next = next.slice(next.length - RETENTION_POINTS);
        }
        set({ chartData: next });
      });

      startHeartbeat();
    },
    async disconnect() {
      await api.disconnect();
  set({ connection: { connected: false }, connectedWorkspaceId: undefined });
    },
    async closeWorkspace() {
      const { selectedWorkspaceId, charts } = get();
      if (selectedWorkspaceId) {
        try { await api.wsSaveCharts(selectedWorkspaceId, charts); } catch {}
      }
      // Clear UI state for charts/nodes/data
  set({ charts: initialCharts, nodes: [], chartData: [], connection: { connected: false }, connectedWorkspaceId: undefined });
      try { await api.disconnect(); } catch {}
    },
    async refreshBrowse() {
      const tree = await api.browseRoot();
      set({ nodes: tree });
    },
    async toggleNode(nodeId: string) {
      const state = get();
      const fetchChildren = async (nid: string) => {
        try { return await api.browseChildren(nid) as TreeNode[]; } catch { return []; }
      };
      const walk = async (list: TreeNode[]): Promise<TreeNode[]> => {
        const out: TreeNode[] = [];
        for (const n of list) {
          if (n.nodeId !== nodeId) {
            out.push(n.children ? { ...n, children: await walk(n.children) } : n);
            continue;
          }
          const expanded = !n.expanded;
          let children = n.children;
          if (expanded && (!children || children.length === 0)) {
            children = await fetchChildren(n.nodeId);
          }
          out.push({ ...n, expanded, children });
        }
        return out;
      };
      const updated = await walk(state.nodes as TreeNode[]);
      set({ nodes: updated });
    },
    setNodeFilter(v: string) { set({ nodeFilter: v }); },
    addChart() {
      const id = `chart-${Date.now()}`;
      set((state: AppState) => ({
        charts: [
          {
            id,
            title: `Chart ${state.charts.length + 1}`,
            series: [],
            xRangeMinutes: 15,
            yMin: 'auto',
            yMax: 'auto',
            paused: true,
            xRight: Date.now()
          },
          ...state.charts
        ]
      }));
      (get().actions as any)._persistCharts();
    },
    removeChart(id: string) {
  set((state: AppState) => ({ charts: state.charts.filter((c: ChartConfig) => c.id !== id) }));
  (get().actions as any)._persistCharts();
    },
    addSeriesToActiveChart(node: UaNode) {
      const state = get();
      const chart = state.charts[state.charts.length - 1];
      if (!chart) return;
      get().actions.addSeriesToChart(chart.id, node);
    },
  addSeriesToChart(chartId: string, node: UaNode) {
      if (!node.isVariable) return;
  set((state: AppState) => {
        const chart = state.charts.find((c: ChartConfig) => c.id === chartId);
        if (!chart) return {} as any;
        if (chart.series.some((s: ChartSeries) => s.nodeId === node.nodeId)) return {} as any;
        if (chart.series.length >= 8) return {} as any;
    const series: ChartSeries = { nodeId: node.nodeId, label: node.browseName, visible: true, dataType: node.dataType };
        // Subscribe newly added series
        api.subscribe([{ nodeId: series.nodeId, label: series.label }], 100).catch(() => {});
        return { charts: state.charts.map((c: ChartConfig) => c.id === chart.id ? { ...c, series: [...c.series, series] } : c) };
      });
  (get().actions as any)._persistCharts();
    },
    toggleSeries(chartId: string, nodeId: string) {
  set((state: AppState) => ({ charts: state.charts.map((c: ChartConfig) => c.id === chartId ? { ...c, series: c.series.map((s: ChartSeries) => s.nodeId === nodeId ? { ...s, visible: s.visible === false ? true : false } : s) } : c) }));
  (get().actions as any)._persistCharts();
    },
    setSeriesLabel(chartId: string, nodeId: string, label: string) {
      set((state: AppState) => ({
        charts: state.charts.map((c: ChartConfig) => c.id === chartId
          ? { ...c, series: c.series.map((s: ChartSeries) => s.nodeId === nodeId ? { ...s, label } : s) }
          : c)
      }));
      (get().actions as any)._persistCharts();
    },
    removeSeries(chartId: string, nodeId: string) {
      set((state: AppState) => ({
        charts: state.charts.map((c: ChartConfig) => c.id === chartId
          ? { ...c, series: c.series.filter((s: ChartSeries) => s.nodeId !== nodeId) }
          : c)
      }));
      (get().actions as any)._persistCharts();
    },
    async upsertWorkspace(ws: Workspace) {
      const updated = await api.wsUpsert(ws);
      set({ workspaces: updated });
    },
    async removeWorkspace(id: string) {
      const updated = await api.wsRemove(id);
      const { selectedWorkspaceId, connectedWorkspaceId } = get();
      const nextSelected = selectedWorkspaceId && selectedWorkspaceId === id ? undefined : selectedWorkspaceId;
      const disconnectConnected = connectedWorkspaceId && connectedWorkspaceId === id;
      set({
        workspaces: updated,
        selectedWorkspaceId: nextSelected,
        connection: disconnectConnected ? { connected: false } : get().connection,
        connectedWorkspaceId: disconnectConnected ? undefined : connectedWorkspaceId
      });
      if (!nextSelected) {
        // clear charts if the active workspace was removed
        set({ charts: initialCharts, nodes: [], chartData: [], connection: { connected: false }, connectedWorkspaceId: undefined });
      }
    },
    async setSelectedWorkspace(id?: string) {
      set({ selectedWorkspaceId: id });
      // load charts for selected workspace
      try {
        const charts = await api.wsGetCharts(id);
        if (charts) set({ charts });
      } catch {}
    },
    async loadFromStore() {
      try { await (api as any).wsMigrateLegacy?.(); } catch {}
      const [wss, savedCharts] = await Promise.all([api.wsList(), api.wsGetCharts()]);
      set({ workspaces: wss });
      if (savedCharts?.length) set({ charts: savedCharts });
    },
    async exportWorkspaces(includeCharts = true) {
      const bundle = await api.wsExport(includeCharts);
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `opcua-tracer-workspaces-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
      a.click();
    },
    async importWorkspaces(file: File, merge = true) {
      const text = await file.text();
      const bundle = JSON.parse(text);
      const updated = await api.wsImport(bundle, merge);
      set({ workspaces: updated });
    },
    async exportWorkspace(id: string) {
      const bundle = await api.wsExport(true);
      const one = {
        ...bundle,
        workspaces: bundle.workspaces.filter((w: Workspace) => w.id === id),
        chartsByWorkspace: bundle.chartsByWorkspace ? { [id]: bundle.chartsByWorkspace[id] || [] } : undefined,
      };
      if (!one.workspaces || one.workspaces.length === 0) {
        get().actions.notify(`Workspace not found for export`, 'error');
        return;
      }
      const name = one.workspaces[0].name?.replace(/\W+/g, '-').toLowerCase() || 'workspace';
      const blob = new Blob([JSON.stringify(one, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `opcua-tracer-${name}-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
      a.click();
    },
    async importWorkspace(id: string, file?: File) {
      try {
        let text: string;
        if (!file) {
          const [handle] = await (window as any).showOpenFilePicker?.({
            types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
          }) || [];
          if (!handle) return;
          const f = await handle.getFile();
          text = await f.text();
        } else {
          text = await file.text();
        }
        const raw = JSON.parse(text);
        let bundle = raw && raw.workspaces ? raw : { workspaces: [raw], chartsByWorkspace: raw.chartsByWorkspace };
        // If multiple, filter to target id
        if (bundle.workspaces.length > 1) {
          bundle = {
            ...bundle,
            workspaces: bundle.workspaces.filter((w: Workspace) => w.id === id)
          };
        }
        if (bundle.workspaces.length === 0) {
          get().actions.notify('Import file has no matching workspace', 'error');
          return;
        }
        // Normalize id to target
        const oldId = bundle.workspaces[0].id;
        bundle.workspaces[0].id = id;
        if (bundle.chartsByWorkspace && oldId && oldId !== id) {
          bundle.chartsByWorkspace[id] = bundle.chartsByWorkspace[oldId] || [];
          delete bundle.chartsByWorkspace[oldId];
        }
        const updated = await api.wsImport(bundle, true);
        set({ workspaces: updated });
        get().actions.notify('Workspace imported', 'success');
      } catch (e: any) {
        get().actions.notify(`Import failed: ${e?.message || e}`, 'error');
      }
    },
    setChartConfig(chartId: string, patch: Partial<ChartConfig>) {
      set((state: AppState) => ({ charts: state.charts.map((c: ChartConfig) => c.id === chartId ? { ...c, ...patch } : c) }));
      (get().actions as any)._persistCharts();
    },
    toggleChartConfig(chartId: string) {
      set((state: AppState) => ({ charts: state.charts.map((c: ChartConfig) => c.id === chartId ? { ...c, showConfig: !c.showConfig } : c) }));
      (get().actions as any)._persistCharts();
    },
    pauseChart(chartId: string, paused: boolean) {
      const xRight = paused ? Date.now() : undefined;
      set((state: AppState) => ({ charts: state.charts.map((c: ChartConfig) => c.id === chartId ? { ...c, paused, xRight, xZoom: undefined } : c) }));
      (get().actions as any)._persistCharts();
    },
    setYScale(chartId: string, yMin?: number | 'auto', yMax?: number | 'auto') {
      set((state: AppState) => ({
        charts: state.charts.map((c: ChartConfig) => {
          if (c.id !== chartId) return c;
          const patch: Partial<ChartConfig> = {};
          if (yMin !== undefined) patch.yMin = yMin;
          if (yMax !== undefined) patch.yMax = yMax;
          return { ...c, ...patch } as ChartConfig;
        })
      }));
      (get().actions as any)._persistCharts();
    },
    setXRangeMinutes(chartId: string, minutes: number) {
      set((state: AppState) => ({ charts: state.charts.map((c: ChartConfig) => c.id === chartId ? { ...c, xRangeMinutes: minutes, xUnit: c.xUnit || 'minutes' } : c) }));
      (get().actions as any)._persistCharts();
    },
    setXRangeSeconds(chartId: string, seconds: number) {
      set((state: AppState) => ({ charts: state.charts.map((c: ChartConfig) => c.id === chartId ? { ...c, xRangeSeconds: seconds, xUnit: 'seconds' } : c) }));
      (get().actions as any)._persistCharts();
    },
    setXUnit(chartId: string, unit: 'seconds' | 'minutes') {
      set((state: AppState) => ({ charts: state.charts.map((c: ChartConfig) => c.id === chartId ? { ...c, xUnit: unit } : c) }));
      (get().actions as any)._persistCharts();
    },
    setZoom(chartId: string, range?: [number, number]) {
      set((state: AppState) => ({ charts: state.charts.map((c: ChartConfig) => c.id === chartId ? { ...c, xZoom: range } : c) }));
      (get().actions as any)._persistCharts();
    },
    panChart(chartId: string, deltaMs: number) {
      set((state: AppState) => ({
        charts: state.charts.map((c: ChartConfig) => {
          if (c.id !== chartId) return c;
          if (!c.paused) return c;
          const now = Date.now();
          const currentRight = c.xRight ?? now;
          const nextRight = Math.min(Math.max(0, currentRight + deltaMs), now);
          return { ...c, xRight: nextRight };
        })
      }));
      (get().actions as any)._persistCharts();
    },
    notify(message: string, type: 'info' | 'warning' | 'error' | 'success' = 'info') {
      const id = `n-${Date.now()}-${Math.floor(Math.random()*1e6)}`;
      set((state) => ({ notifications: [...state.notifications, { id, type, message }] }));
      if (type !== 'error') {
        setTimeout(() => {
          const { notifications } = get();
          set({ notifications: notifications.filter(n => n.id !== id) });
        }, 5000);
      }
    },
    async confirm(opts: { message: string; confirmLabel?: string; cancelLabel?: string; destructive?: boolean; type?: 'info' | 'warning' | 'error' | 'success' }): Promise<boolean> {
      return new Promise<boolean>((resolve) => {
        const id = `n-${Date.now()}-${Math.floor(Math.random()*1e6)}`;
        const close = () => set((state) => ({ notifications: state.notifications.filter(n => n.id !== id) }));
        const onConfirm = () => { close(); resolve(true); };
        const onCancel = () => { close(); resolve(false); };
        const type: 'info' | 'warning' | 'error' | 'success' = opts.type ?? (opts.destructive ? 'warning' : 'info');
        set((state) => ({
          notifications: [
            ...state.notifications,
            {
              id,
              type,
              message: opts.message,
              actions: [
                { label: opts.cancelLabel || 'Cancel', onClick: onCancel, variant: 'neutral' },
                { label: opts.confirmLabel || 'Confirm', onClick: onConfirm, variant: opts.destructive ? 'danger' : 'primary' }
              ]
            }
          ]
        }));
      });
    },
    removeNotification(id: string) {
      set((state) => ({ notifications: state.notifications.filter(n => n.id !== id) }));
    }
  }
}));

// Initialize store data (moved to App.tsx on mount)
// useAppStore.getState().actions.loadFromStore().catch(() => {});
