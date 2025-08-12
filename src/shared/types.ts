export type SavedServer = {
  id: string;
  name: string;
  endpointUrl: string;
  username?: string;
  rememberPassword?: boolean;
  // password never sent back to renderer unless rememberPassword true
  password?: string;
  // new: authentication and security settings
  authMode?: 'anonymous' | 'username';
  securityMode?: 'None' | 'Sign' | 'SignAndEncrypt';
  securityPolicy?:
    | 'None'
    | 'Basic128Rsa15'
    | 'Basic256'
    | 'Basic256Sha256'
    | 'Aes128_Sha256_RsaOaep'
    | 'Aes256_Sha256_RsaPss';
};

// New unified workspace concept (extensible for multiple interfaces)
export type Workspace = {
  id: string; // unique id
  name: string; // display name
  interface: 'opcua'; // future: 'modbus' | 'mqtt' | ...
  // OPC UA specific config
  endpointUrl: string;
  authMode?: 'anonymous' | 'username';
  username?: string;
  password?: string; // persisted only if rememberPassword is true
  rememberPassword?: boolean;
  securityMode?: 'None' | 'Sign' | 'SignAndEncrypt';
  securityPolicy?:
    | 'None'
    | 'Basic128Rsa15'
    | 'Basic256'
    | 'Basic256Sha256'
    | 'Aes128_Sha256_RsaOaep'
    | 'Aes256_Sha256_RsaPss';
};

export type UaNode = {
  nodeId: string;
  browseName: string;
  displayName?: string;
  dataType?: string;
  path?: string[];
  isVariable: boolean;
  hasChildren?: boolean;
  children?: UaNode[];
};

export type ChartSeries = {
  nodeId: string;
  label: string;
  color?: string;
  visible?: boolean;
  dataType?: string; // e.g., 'Boolean', 'Double', etc., used for rendering style
};

export type ChartConfig = {
  id: string;
  title: string;
  series: ChartSeries[]; // up to 8
  // X-axis window configuration
  xRangeMinutes: number; // default window in minutes
  xRangeSeconds?: number; // optional window in seconds when xUnit === 'seconds'
  xUnit?: 'seconds' | 'minutes'; // default 'minutes'
  yMin?: number | 'auto';
  yMax?: number | 'auto';
  paused?: boolean;
  // When paused, anchor the right edge of the time window here (epoch ms)
  xRight?: number;
  // Optional zoom range inside the window (epoch ms)
  xZoom?: [number, number];
  // UI: whether config panel is open
  showConfig?: boolean;
};

export type RealtimePoint = {
  t: number; // epoch ms
  [seriesKey: string]: number | boolean | number[] | undefined;
};

export type ConnectRequest = {
  endpointUrl: string;
  username?: string;
  password?: string;
  authMode?: 'anonymous' | 'username';
  securityMode?: 'None' | 'Sign' | 'SignAndEncrypt';
  securityPolicy?:
    | 'None'
    | 'Basic128Rsa15'
    | 'Basic256'
    | 'Basic256Sha256'
    | 'Aes128_Sha256_RsaOaep'
    | 'Aes256_Sha256_RsaPss';
};

export type WriteRequest = {
  nodeId: string;
  value: any;
};

// Export/import bundle to move workspaces (and optionally their charts)
export type WorkspaceExportBundle = {
  version: 1;
  exportedAt: string; // ISO date
  workspaces: Workspace[];
  chartsByWorkspace?: Record<string, ChartConfig[]>;
};
