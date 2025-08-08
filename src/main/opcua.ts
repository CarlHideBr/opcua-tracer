import { EventEmitter } from 'events';
import type { UaNode, ConnectRequest, WriteRequest } from '../shared/types';

const SIMULATION = process.env.SIMULATION === 'true';

export type SubscriptionData = {
  nodeId: string;
  value: any;
  timestamp: Date;
};

export class OpcUaService extends EventEmitter {
  private session: any | null = null;
  private client: any | null = null;
  private subscription: any | null = null;
  private monitoredItems: Map<string, any> = new Map();
  private simulatedTimer: NodeJS.Timeout | null = null;
  private simulatedPhase = 0;

  constructor() {
    super();
  }

  async connect(req: ConnectRequest) {
    if (SIMULATION) {
      // Simulate immediate connection
      this.session = { simulated: true };
      this.emit('connected');
      return;
    }
    try {
      const {
        OPCUAClient,
        MessageSecurityMode,
        SecurityPolicy,
        OPCUACertificateManager
      } = await import('node-opcua');

      const toMode = (m?: ConnectRequest['securityMode']) => {
        switch (m) {
          case 'None': return MessageSecurityMode.None;
          case 'Sign': return MessageSecurityMode.Sign;
          case 'SignAndEncrypt': return MessageSecurityMode.SignAndEncrypt;
          default: return MessageSecurityMode.None;
        }
      };
      const toPolicy = (p?: ConnectRequest['securityPolicy']) => {
        switch (p) {
          case 'None': return SecurityPolicy.None;
          case 'Basic128Rsa15': return SecurityPolicy.Basic128Rsa15;
          case 'Basic256': return SecurityPolicy.Basic256;
          case 'Basic256Sha256': return SecurityPolicy.Basic256Sha256;
          case 'Aes128_Sha256_RsaOaep': return SecurityPolicy.Aes128_Sha256_RsaOaep;
          case 'Aes256_Sha256_RsaPss': return SecurityPolicy.Aes256_Sha256_RsaPss;
          default: return SecurityPolicy.None;
        }
      };

      const certificateManager = new OPCUACertificateManager({ automaticallyAcceptUnknownCertificate: true });

      this.client = OPCUAClient.create({
        applicationName: 'OPC UA Tracer',
        securityMode: toMode(req.securityMode),
        securityPolicy: toPolicy(req.securityPolicy),
        endpointMustExist: false,
        clientCertificateManager: certificateManager,
        connectionStrategy: { initialDelay: 200, maxRetry: 0 }
      });

      await this.client.connect(req.endpointUrl);

      if (req.authMode === 'anonymous' || (!req.username && !req.password)) {
        this.session = await this.client.createSession();
      } else {
        this.session = await this.client.createSession({ userName: req.username || '', password: req.password || '' });
      }
      this.emit('connected');
    } catch (err: any) {
      // Re-throw meaningful error; renderer will show a popup
      throw new Error(err?.message || String(err));
    }
  }

  async disconnect() {
    if (SIMULATION) {
      if (this.simulatedTimer) clearInterval(this.simulatedTimer);
      this.simulatedTimer = null;
      this.session = null;
      this.emit('disconnected');
      return;
    }
    try {
      for (const [, item] of this.monitoredItems) {
        try { await item.terminate(); } catch {}
      }
      this.monitoredItems.clear();
      if (this.subscription) { try { await this.subscription.terminate(); } catch {} }
      if (this.session) { try { await this.session.close(); } catch {} }
      if (this.client) { try { await this.client.disconnect(); } catch {} }
    } finally {
      this.subscription = null;
      this.session = null;
      this.client = null;
      this.emit('disconnected');
    }
  }

  async browseRoot(): Promise<UaNode[]> {
    if (!this.session) throw new Error('Not connected');
    if (SIMULATION) {
      return [
        {
          nodeId: 'ns=1;s=Simulated', browseName: 'Simulated', isVariable: false, hasChildren: true
        }
      ];
    }

    const { resolveNodeId, NodeClass, AttributeIds, DataTypeIds, BrowseDirection } = await import('node-opcua');
    const rootNodeId = resolveNodeId('ObjectsFolder');

    // Prefer hierarchical forward references including subtypes
    const desc = {
      nodeId: rootNodeId,
      referenceTypeId: resolveNodeId('HierarchicalReferences'),
      browseDirection: BrowseDirection.Forward,
      includeSubtypes: true,
      resultMask: 0x3f
    } as any;
    let browseResult = await this.session!.browse(desc);
    if (!browseResult.references || browseResult.references.length === 0) {
      // Fallback to default browse with all references
      browseResult = await this.session!.browse(rootNodeId);
    }
    const nodes: UaNode[] = [];
    for (const ref of browseResult.references || []) {
      const isVar = ref.nodeClass === NodeClass.Variable;
      // Some variables have properties (e.g., EURange). Allow expand; we'll show empty if none.
      nodes.push({
        nodeId: ref.nodeId.toString(),
        browseName: ref.browseName.toString(),
        isVariable: !!isVar,
        hasChildren: true
      });
    }
    // Read DataType for variables to allow UI filtering
    const variables = nodes.filter(n => n.isVariable);
    if (variables.length) {
      const typeIdToName: Record<number, string> = {
        [DataTypeIds.Boolean]: 'Boolean',
        [DataTypeIds.SByte]: 'SByte',
        [DataTypeIds.Byte]: 'Byte',
        [DataTypeIds.Int16]: 'Int16',
        [DataTypeIds.UInt16]: 'UInt16',
        [DataTypeIds.Int32]: 'Int32',
        [DataTypeIds.UInt32]: 'UInt32',
        [DataTypeIds.Float]: 'Float',
        [DataTypeIds.Double]: 'Double',
        [DataTypeIds.String]: 'String'
      };
      const reads = variables.map(v => ({ nodeId: v.nodeId, attributeId: AttributeIds.DataType }));
      const results = await this.session.read(reads);
      results.forEach((dv: any, i: number) => {
        const v = variables[i];
        const nid = dv?.value?.value;
        try {
          if (nid && nid.namespace === 0 && typeof nid.value === 'number') {
            v.dataType = typeIdToName[nid.value] || 'Unknown';
          }
        } catch {}
      });
    }
    return nodes;
  }

  async browseChildren(nodeId: string): Promise<UaNode[]> {
    if (!this.session) throw new Error('Not connected');
    if (SIMULATION) {
      if (nodeId === 'ns=1;s=Simulated') {
        return [
          { nodeId: 'ns=1;s=Bool1', browseName: 'Bool1', isVariable: true, dataType: 'Boolean' },
          { nodeId: 'ns=1;s=Sine1', browseName: 'Sine1', isVariable: true, dataType: 'Double' },
          { nodeId: 'ns=1;s=Square1', browseName: 'Square1', isVariable: true, dataType: 'Double' },
          { nodeId: 'ns=1;s=Random1', browseName: 'Random1', isVariable: true, dataType: 'Double' },
          { nodeId: 'ns=1;s=Step1', browseName: 'Step1', isVariable: true, dataType: 'Double' },
          { nodeId: 'ns=1;s=Noise1', browseName: 'Noise1', isVariable: true, dataType: 'Double' },
          { nodeId: 'ns=1;s=Ramp1', browseName: 'Ramp1', isVariable: true, dataType: 'Double' },
          { nodeId: 'ns=1;s=Triangle1', browseName: 'Triangle1', isVariable: true, dataType: 'Double' }
        ];
      }
      return [];
    }

    const { NodeClass, AttributeIds, DataTypeIds, resolveNodeId, BrowseDirection } = await import('node-opcua');
    const desc = {
      nodeId,
      referenceTypeId: resolveNodeId('HierarchicalReferences'),
      browseDirection: BrowseDirection.Forward,
      includeSubtypes: true,
      resultMask: 0x3f
    } as any;
    let browseResult = await this.session!.browse(desc);
    if (!browseResult.references || browseResult.references.length === 0) {
      // Fallback to default browse with all references
      browseResult = await this.session!.browse(nodeId);
    }
    const nodes: UaNode[] = [];
    for (const ref of browseResult.references || []) {
      const isVar = ref.nodeClass === NodeClass.Variable;
      nodes.push({
        nodeId: ref.nodeId.toString(),
        browseName: ref.browseName.toString(),
        isVariable: !!isVar,
        hasChildren: true
      });
    }
    // annotate variable data types
    const variables = nodes.filter(n => n.isVariable);
    if (variables.length) {
      const typeIdToName: Record<number, string> = {
        [DataTypeIds.Boolean]: 'Boolean',
        [DataTypeIds.SByte]: 'SByte',
        [DataTypeIds.Byte]: 'Byte',
        [DataTypeIds.Int16]: 'Int16',
        [DataTypeIds.UInt16]: 'UInt16',
        [DataTypeIds.Int32]: 'Int32',
        [DataTypeIds.UInt32]: 'UInt32',
        [DataTypeIds.Float]: 'Float',
        [DataTypeIds.Double]: 'Double',
        [DataTypeIds.String]: 'String'
      };
      const reads = variables.map(v => ({ nodeId: v.nodeId, attributeId: AttributeIds.DataType }));
      const results = await this.session.read(reads);
      results.forEach((dv: any, i: number) => {
        const v = variables[i];
        const nid = dv?.value?.value;
        try {
          if (nid && nid.namespace === 0 && typeof nid.value === 'number') {
            v.dataType = typeIdToName[nid.value] || 'Unknown';
          }
        } catch {}
      });
    }
    return nodes;
  }

  async subscribe(nodes: { nodeId: string; label?: string }[], samplingIntervalMs = 1000) {
    if (!this.session) throw new Error('Not connected');

    if (SIMULATION) {
      if (this.simulatedTimer) clearInterval(this.simulatedTimer);
      const tags = nodes.map(n => n.nodeId);
      this.simulatedPhase = 0;
      this.simulatedTimer = setInterval(() => {
        const t = Date.now();
        this.simulatedPhase += 0.1;
        for (const tag of tags) {
          let val: any = 0;
          switch (tag) {
            case 'ns=1;s=Bool1': val = Math.sin(this.simulatedPhase) > 0; break;
            case 'ns=1;s=Sine1': val = Math.sin(this.simulatedPhase) * 50 + 50; break;
            case 'ns=1;s=Square1': val = (Math.floor(this.simulatedPhase) % 2) ? 100 : 0; break;
            case 'ns=1;s=Random1': val = Math.random() * 100; break;
            case 'ns=1;s=Step1': val = (Math.floor(this.simulatedPhase / 5) % 2) ? 75 : 25; break;
            case 'ns=1;s=Noise1': val = 50 + (Math.random() - 0.5) * 20; break;
            case 'ns=1;s=Ramp1': val = (t / 1000) % 100; break;
            case 'ns=1;s=Triangle1': val = 50 + 50 * (2 / Math.PI) * Math.asin(Math.sin(this.simulatedPhase)); break;
            default: val = Math.random() * 100;
          }
          this.emit('data', { nodeId: tag, value: val, timestamp: new Date(t) } as SubscriptionData);
        }
      }, samplingIntervalMs);
      return;
    }

    const { ClientSubscription, TimestampsToReturn, AttributeIds } = await import('node-opcua');

    this.subscription = ClientSubscription.create(this.session!, {
      requestedPublishingInterval: samplingIntervalMs,
      requestedLifetimeCount: 1000,
      requestedMaxKeepAliveCount: 12,
      maxNotificationsPerPublish: 100,
      publishingEnabled: true,
      priority: 10
    });

    for (const n of nodes) {
      const item = await this.subscription.monitor(
        { nodeId: n.nodeId, attributeId: AttributeIds.Value },
        { samplingInterval: samplingIntervalMs, discardOldest: true, queueSize: 10 },
        TimestampsToReturn.Both
      );
      item.on('changed', (d: any) => {
        this.emit('data', { nodeId: n.nodeId, value: d.value.value, timestamp: d.serverTimestamp || d.sourceTimestamp || new Date() } as SubscriptionData);
      });
      this.monitoredItems.set(n.nodeId, item);
    }
  }

  async write(req: WriteRequest) {
    if (!this.session) throw new Error('Not connected');
    if (SIMULATION) {
      // Accept writes and update internal phase slightly
      this.simulatedPhase += 0.01;
      return { ok: true };
    }
    const { DataType } = await import('node-opcua');
    // Try to write raw value; a real app should infer DataType per node first
    await this.session!.write({ nodeId: req.nodeId, attributeId: 13, value: { value: { dataType: DataType.Double, value: req.value } } });
    return { ok: true };
  }
}
