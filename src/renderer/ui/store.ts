import { create } from 'zustand';
import type { ChartConfig, ChartSeries, RealtimePoint, UaNode, SavedServer } from '../../shared/types';
import { api } from './ipc';

const initialCharts: ChartConfig[] = [
  { id: 'chart-1', title: 'Chart 1', series: [], xRangeMinutes: 15, xUnit: 'minutes', yMin: 'auto', yMax: 'auto', paused: false }
];

type TreeNode = UaNode & { expanded?: boolean };

export type AppState = {
  savedServers: SavedServer[];
  selectedServerId?: string;
  nodes: TreeNode[];
  nodeFilter: string;
  charts: ChartConfig[];
  chartData: RealtimePoint[];
  connection: { connected: boolean };
  actions: {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    refreshBrowse(): Promise<void>;
    toggleNode(nodeId: string): Promise<void>;
    setNodeFilter(v: string): void;
    addChart(): void;
    removeChart(id: string): void;
    addSeriesToActiveChart(node: UaNode): void;
    addSeriesToChart(chartId: string, node: UaNode): void;
    toggleSeries(chartId: string, nodeId: string): void;
    saveServer(server: Omit<SavedServer, 'id'> & { id: string }): Promise<void>;
    removeServer(id: string): Promise<void>;
    setSelectedServer(id: string): void;
    loadFromStore(): Promise<void>;
    setChartConfig(chartId: string, patch: Partial<ChartConfig>): void;
    toggleChartConfig(chartId: string): void;
    pauseChart(chartId: string, paused: boolean): void;
    setYScale(chartId: string, yMin?: number | 'auto', yMax?: number | 'auto'): void;
    setXRangeMinutes(chartId: string, minutes: number): void;
  setXRangeSeconds(chartId: string, seconds: number): void;
  setXUnit(chartId: string, unit: 'seconds' | 'minutes'): void;
    setZoom(chartId: string, range?: [number, number]): void;
    panChart(chartId: string, deltaMs: number): void;
  };
};

export const useAppStore = create<AppState>((set, get) => ({
  savedServers: [],
  selectedServerId: undefined,
  nodes: [],
  nodeFilter: '',
  charts: initialCharts,
  chartData: [],
  connection: { connected: false },
  actions: {
    // internal helper to persist charts per server
    _persistCharts() {
      const state = get();
      const serverId = state.selectedServerId || '__default__';
      const charts = state.charts;
      // fire and forget
      (api.saveCharts as any)(serverId, charts).catch(() => {});
    },
    async connect() {
      const servers: SavedServer[] = await api.listServers();
      const { selectedServerId } = get();
      const chosen = servers.find(s => s.id === selectedServerId) || servers[0];
      if (!chosen) throw new Error('No saved servers. Save one in the sidebar.');
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
        alert(`Connection failed: ${e?.message || e}`);
        throw e;
      }
      set({ connection: { connected: true } });
      // load charts per server
      try {
        const savedCharts = await api.getCharts(chosen.id);
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
      set({ connection: { connected: false } });
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
    async saveServer(server) {
      const updated = await api.addServer(server);
      set({ savedServers: updated });
    },
    async removeServer(id: string) {
      const updated = await api.removeServer(id);
      const { selectedServerId } = get();
      const nextSelected = selectedServerId && selectedServerId === id ? undefined : selectedServerId;
      set({ savedServers: updated, selectedServerId: nextSelected });
    },
    setSelectedServer(id: string) { set({ selectedServerId: id }); },
    async loadFromStore() {
      const [servers, savedCharts] = await Promise.all([api.listServers(), api.getCharts()]);
      set({ savedServers: servers });
      if (savedCharts?.length) set({ charts: savedCharts });
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
    }
  }
}));

// Initialize store data (moved to App.tsx on mount)
// useAppStore.getState().actions.loadFromStore().catch(() => {});
