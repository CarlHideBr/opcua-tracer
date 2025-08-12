import { contextBridge, ipcRenderer } from 'electron';
import type { ConnectRequest } from '../shared/types';

contextBridge.exposeInMainWorld('api', {
  connect: (payload: ConnectRequest) => ipcRenderer.invoke('opcua:connect', payload),
  disconnect: () => ipcRenderer.invoke('opcua:disconnect'),
  browseRoot: () => ipcRenderer.invoke('opcua:browseRoot'),
  browseChildren: (nodeId: string) => ipcRenderer.invoke('opcua:browseChildren', nodeId),
  subscribe: (nodes: { nodeId: string; label?: string }[], samplingMs: number) => ipcRenderer.invoke('opcua:subscribe', nodes, samplingMs),
  write: (nodeId: string, value: any) => ipcRenderer.invoke('opcua:write', { nodeId, value }),
  listServers: () => ipcRenderer.invoke('store:listServers'),
  addServer: (server: any) => ipcRenderer.invoke('store:addServer', server),
  removeServer: (id: string) => ipcRenderer.invoke('store:removeServer', id),
  getCharts: (serverId?: string) => ipcRenderer.invoke('store:getCharts', serverId),
  saveCharts: (serverId: string, charts: any) => ipcRenderer.invoke('store:saveCharts', serverId, charts),
  // Workspaces
  wsList: () => ipcRenderer.invoke('ws:list'),
  wsUpsert: (ws: any) => ipcRenderer.invoke('ws:upsert', ws),
  wsRemove: (id: string) => ipcRenderer.invoke('ws:remove', id),
  wsGetCharts: (id?: string) => ipcRenderer.invoke('ws:getCharts', id),
  wsSaveCharts: (id: string, charts: any) => ipcRenderer.invoke('ws:saveCharts', id, charts),
  wsExport: (includeCharts?: boolean) => ipcRenderer.invoke('ws:export', includeCharts),
  wsImport: (bundle: any, merge?: boolean) => ipcRenderer.invoke('ws:import', bundle, merge),
  wsMigrateLegacy: () => ipcRenderer.invoke('ws:migrateLegacy'),
  onData: (cb: (d: any) => void) => ipcRenderer.on('opcua:data', (_e, d) => cb(d))
});

export type PreloadApi = typeof window & {
  api: {
    connect(payload: ConnectRequest): Promise<void>;
    disconnect(): Promise<void>;
    browseRoot(): Promise<any>;
    browseChildren(nodeId: string): Promise<any>;
    subscribe(nodes: { nodeId: string; label?: string }[], samplingMs: number): Promise<void>;
    write(nodeId: string, value: any): Promise<any>;
    listServers(): Promise<any>;
    addServer(server: any): Promise<any>;
    removeServer(id: string): Promise<any>;
    getCharts(serverId?: string): Promise<any>;
    saveCharts(serverId: string, charts: any): Promise<any>;
  // Workspaces
  wsList(): Promise<any>;
  wsUpsert(ws: any): Promise<any>;
  wsRemove(id: string): Promise<any>;
  wsGetCharts(id?: string): Promise<any>;
  wsSaveCharts(id: string, charts: any): Promise<any>;
  wsExport(includeCharts?: boolean): Promise<any>;
  wsImport(bundle: any, merge?: boolean): Promise<any>;
  wsMigrateLegacy(): Promise<any>;
    onData(cb: (d: any) => void): void;
  };
};
