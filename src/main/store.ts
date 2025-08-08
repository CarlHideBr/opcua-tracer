import Store from 'electron-store';
import type { ChartConfig, SavedServer } from '../shared/types';

const schema = {
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
        password: { type: 'string' }
      }
    }
  },
  chartsByServer: {
    type: 'object',
    default: {}
  }
} as const;

const store = new Store({ schema: schema as any, name: 'opc-ua-tracer' });

export function listServers(): SavedServer[] {
  return (store.get('servers') as any) as SavedServer[];
}
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
export function getCharts(serverId?: string): ChartConfig[] {
  const all = (store.get('chartsByServer') as any) || {};
  if (!serverId) return all['__default__'] || [];
  return all[serverId] || [];
}
export function saveCharts(serverId: string, charts: ChartConfig[]): ChartConfig[] {
  const existing = (store.get('chartsByServer') as any) || {};
  const key = serverId || '__default__';
  const next = { ...existing, [key]: charts };
  store.set('chartsByServer', next);
  return charts;
}
