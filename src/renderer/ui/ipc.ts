const w = (window as any);
const fallbackApi = {
  connect: async (_p: any) => { throw new Error('IPC bridge not ready'); },
  disconnect: async () => {},
  browseRoot: async () => [],
  browseChildren: async (_id: string) => [],
  subscribe: async (_nodes: any, _ms: number) => {},
  write: async (_n: string, _v: any) => ({}),
  listServers: async () => [],
  addServer: async (server: any) => [server],
  removeServer: async (_id: string) => [],
  getCharts: async (_serverId?: string) => [],
  saveCharts: async (_serverId: string, charts: any) => charts,
  onData: (_cb: (d: any) => void) => {}
};

export const api = (w.api ?? fallbackApi) as {
  connect(payload: {
    endpointUrl: string;
    username?: string;
    password?: string;
    authMode?: 'anonymous' | 'username';
    securityMode?: 'None' | 'Sign' | 'SignAndEncrypt';
    securityPolicy?: 'None' | 'Basic128Rsa15' | 'Basic256' | 'Basic256Sha256' | 'Aes128_Sha256_RsaOaep' | 'Aes256_Sha256_RsaPss';
  }): Promise<void>;
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
  onData(cb: (d: any) => void): void;
};
