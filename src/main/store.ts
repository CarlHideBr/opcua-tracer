import Store from 'electron-store';
import type { ChartConfig, SavedServer, Workspace, WorkspaceExportBundle } from '../shared/types';

const schema = {
  // legacy for migration
  servers: {
    type: 'array',
    default: [],
    items: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        endpointUrl: { type: 'string' },
        username: { type: 'string' },
        rememberPassword: { type: 'boolean' },
        password: { type: 'string' },
        authMode: { type: 'string' },
        securityMode: { type: 'string' },
        securityPolicy: { type: 'string' }
      }
    }
  },
  chartsByServer: { type: 'object', default: {} },
  // new
  workspaces: {
    type: 'array',
    default: [],
    items: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        interface: { type: 'string' },
        endpointUrl: { type: 'string' },
        authMode: { type: 'string' },
        username: { type: 'string' },
        password: { type: 'string' },
        rememberPassword: { type: 'boolean' },
        securityMode: { type: 'string' },
        securityPolicy: { type: 'string' }
      }
    }
  },
  chartsByWorkspace: { type: 'object', default: {} }
} as const;

const store = new Store({ schema: schema as any, name: 'opc-ua-tracer' });

// one-time migration: move servers -> workspaces and chartsByServer -> chartsByWorkspace
function migrateIfNeeded() {
  const existing = ((store.get('workspaces') as any) || []) as Workspace[];
  const legacyServers = ((store.get('servers') as any) || []) as SavedServer[];
  const chartsByServer = ((store.get('chartsByServer') as any) || {}) as Record<string, ChartConfig[]>;
  if (!legacyServers || legacyServers.length === 0) return; // nothing to migrate
  // Merge legacy servers that don't exist yet in workspaces (by id)
  const ids = new Set(existing.map(w => w.id));
  const migrants: Workspace[] = legacyServers
    .filter(s => !ids.has(s.id))
    .map((s) => ({
      id: s.id,
      name: s.name || s.endpointUrl,
      interface: 'opcua',
      endpointUrl: s.endpointUrl,
      authMode: s.authMode || (s.username ? 'username' : 'anonymous'),
      username: s.username,
      password: s.password,
      rememberPassword: s.rememberPassword,
      securityMode: s.securityMode || 'None',
      securityPolicy: s.securityPolicy || 'None'
    }));
  if (migrants.length > 0) {
    store.set('workspaces', [...existing, ...migrants]);
  }
  // Merge charts, preserving existing chartsByWorkspace entries
  const chartsByWorkspace = ((store.get('chartsByWorkspace') as any) || {}) as Record<string, ChartConfig[]>;
  let changed = false;
  for (const [k, v] of Object.entries(chartsByServer)) {
    if (!chartsByWorkspace[k]) { chartsByWorkspace[k] = v; changed = true; }
  }
  if (changed) store.set('chartsByWorkspace', chartsByWorkspace);
}

migrateIfNeeded();

// Exposed migration trigger (no-op if nothing to migrate)
export function migrateLegacy() {
  migrateIfNeeded();
}

// New workspace-first API
export function listWorkspaces(): Workspace[] {
  return ((store.get('workspaces') as any) || []) as Workspace[];
}
export function upsertWorkspace(ws: Workspace): Workspace[] {
  const all = listWorkspaces();
  const updated = [...all.filter(w => w.id !== ws.id), ws];
  store.set('workspaces', updated);
  return updated;
}
export function removeWorkspace(id: string): Workspace[] {
  const all = listWorkspaces().filter(w => w.id !== id);
  store.set('workspaces', all);
  // also remove charts
  const charts = ((store.get('chartsByWorkspace') as any) || {}) as Record<string, ChartConfig[]>;
  if (charts[id]) {
    const { [id]: _, ...rest } = charts;
    store.set('chartsByWorkspace', rest);
  }
  return all;
}
export function getChartsForWorkspace(workspaceId?: string): ChartConfig[] {
  const all = ((store.get('chartsByWorkspace') as any) || {}) as Record<string, ChartConfig[]>;
  if (!workspaceId) return all['__default__'] || [];
  return all[workspaceId] || [];
}
export function saveChartsForWorkspace(workspaceId: string, charts: ChartConfig[]): ChartConfig[] {
  const existing = ((store.get('chartsByWorkspace') as any) || {}) as Record<string, ChartConfig[]>;
  const key = workspaceId || '__default__';
  const next = { ...existing, [key]: charts };
  store.set('chartsByWorkspace', next);
  return charts;
}

// Export/import
export function exportWorkspaces(includeCharts = true): WorkspaceExportBundle {
  const workspaces = listWorkspaces();
  const bundle: WorkspaceExportBundle = {
    version: 1,
    exportedAt: new Date().toISOString(),
    workspaces
  };
  if (includeCharts) {
    bundle.chartsByWorkspace = (store.get('chartsByWorkspace') as any) || {};
  }
  return bundle;
}
export function importWorkspaces(bundle: WorkspaceExportBundle, merge = true) {
  if (!bundle || !Array.isArray(bundle.workspaces)) return listWorkspaces();
  const existing = listWorkspaces();
  const map: Record<string, Workspace> = {};
  if (merge) existing.forEach(w => { map[w.id] = w; });
  bundle.workspaces.forEach(w => { map[w.id] = w; });
  const next = Object.values(map);
  store.set('workspaces', next);
  if (bundle.chartsByWorkspace) {
    const charts = ((store.get('chartsByWorkspace') as any) || {}) as Record<string, ChartConfig[]>;
    const merged = merge ? { ...charts, ...bundle.chartsByWorkspace } : bundle.chartsByWorkspace;
    store.set('chartsByWorkspace', merged);
  }
  return next;
}

// Legacy server API retained to avoid breaking old renderer code during migration
export function listServers(): SavedServer[] { return (store.get('servers') as any) as SavedServer[]; }
export function addServer(server: SavedServer): SavedServer[] {
  const servers = listServers();
  const updated = [...servers.filter(s => s.id !== server.id), server];
  store.set('servers', updated);
  return updated;
}
export function removeServer(id: string): SavedServer[] {
  const servers = listServers().filter(s => s.id !== id);
  store.set('servers', servers);
  return servers;
}
export function getCharts(serverId?: string): ChartConfig[] { return getChartsForWorkspace(serverId); }
export function saveCharts(serverId: string, charts: ChartConfig[]): ChartConfig[] { return saveChartsForWorkspace(serverId, charts); }
