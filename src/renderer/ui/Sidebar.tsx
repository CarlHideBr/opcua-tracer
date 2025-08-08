import React, { useMemo, useState } from 'react';
import { useAppStore } from './store';
import type { UaNode } from '../../shared/types';
import { PlugZap, PowerOff, Trash2, ChevronRight, ChevronDown } from 'lucide-react';
import { useDrag } from 'react-dnd';

const ItemTypes = { TAG: 'TAG' } as const;

type TreeNode = UaNode & { expanded?: boolean };

const NodeRow: React.FC<{ node: TreeNode; onToggle: (id: string) => void; depth?: number }>
  = ({ node, onToggle, depth = 0 }) => {
  const isSimpleType = node.isVariable && (
    node.dataType === 'Boolean' ||
    node.dataType === 'Float' ||
    node.dataType === 'Double' ||
    node.dataType === 'Int16' ||
    node.dataType === 'UInt16' ||
    node.dataType === 'Int32' ||
    node.dataType === 'UInt32' ||
    node.dataType === 'Byte' ||
    node.dataType === 'SByte'
  );
  const [, drag] = useDrag(() => ({ type: ItemTypes.TAG, item: { node }, canDrag: !!isSimpleType }));
  // Strongly damp indentation for deep levels and clamp to a max
  const indentBase = Math.min(depth, 3) * 8 + Math.max(0, depth - 3) * 2; // 8px per level up to 3, then 2px
  const indent = Math.min(80, indentBase); // clamp to 80px
  return (
    <li ref={drag as any} className="list-item" style={{ paddingLeft: indent }}>
      <div className="list-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          {node.hasChildren ? (
            <button className="tree-toggle" title={node.browseName} onClick={(e) => { e.stopPropagation(); onToggle(node.nodeId); }}>
              {node.expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : <span style={{ width: 16 }} />}
          {(() => {
            const raw = node.browseName || '';
            const noNs = raw.replace(/^\d+:/, '');
            const last = (noNs.split('.').pop() || noNs).trim();
            const suffix = node.isVariable && node.dataType && node.dataType !== 'Unknown' ? ` (${node.dataType})` : '';
            return (
              <span className="node-label" title={raw} onClick={() => node.hasChildren && onToggle(node.nodeId)} style={{ cursor: node.hasChildren ? 'pointer' : 'default' }}>
                {last}{suffix}
              </span>
            );
          })()}
        </div>
      </div>
    {node.expanded && node.children && node.children.length > 0 && (
        <ul className="list tree-children">
      {node.children.map(c => <NodeRow key={c.nodeId} node={c as TreeNode} onToggle={onToggle} depth={depth + 1} />)}
        </ul>
      )}
    </li>
  );
};

export const Sidebar: React.FC = () => {
  const nodes = useAppStore(s => s.nodes as TreeNode[]);
  const filter = useAppStore(s => s.nodeFilter);
  const setFilter = useAppStore(s => s.actions.setNodeFilter);
  // Drag-and-drop replaces per-node add buttons
  const toggleNode = useAppStore(s => s.actions.toggleNode);
  const refreshBrowse = useAppStore(s => s.actions.refreshBrowse);
  const savedServers = useAppStore(s => s.savedServers);
  const saveServer = useAppStore(s => s.actions.saveServer);
  const removeServer = useAppStore(s => s.actions.removeServer);
  const selectedServerId = useAppStore(s => s.selectedServerId);
  const setSelectedServer = useAppStore(s => s.actions.setSelectedServer);
  const connected = useAppStore(s => s.connection.connected);
  const connect = useAppStore(s => s.actions.connect);
  const disconnect = useAppStore(s => s.actions.disconnect);

  const [serverUrl, setServerUrl] = useState('opc.tcp://localhost:4840');
  const [authMode, setAuthMode] = useState<'anonymous' | 'username'>('anonymous');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [securityMode, setSecurityMode] = useState<'None' | 'Sign' | 'SignAndEncrypt'>('None');
  const [securityPolicy, setSecurityPolicy] = useState<'None' | 'Basic128Rsa15' | 'Basic256' | 'Basic256Sha256' | 'Aes128_Sha256_RsaOaep' | 'Aes256_Sha256_RsaPss'>('None');

  // Recursive filter for full tree view
  const filtered = useMemo(() => {
    if (!filter) return nodes;
    const f = filter.toLowerCase();
    const matchNode = (n: TreeNode): TreeNode | null => {
      const selfMatches = n.nodeId.toLowerCase().includes(f) || (n.browseName || '').toLowerCase().includes(f);
      const kids = (n.children || []).map(c => matchNode(c as TreeNode)).filter(Boolean) as TreeNode[];
      if (selfMatches || kids.length) return { ...n, children: kids } as TreeNode;
      return null;
    };
    return nodes.map(n => matchNode(n as TreeNode)).filter(Boolean) as TreeNode[];
  }, [nodes, filter]);

  return (
    <div>
      <div className="card">
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Server</div>
        <div style={{ display: 'grid', gap: 8 }}>
          <input className="input" placeholder="opc.tcp://host:port" value={serverUrl} onChange={e => setServerUrl(e.target.value)} />

          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ width: 90 }}>Auth</span>
            <select className="input" value={authMode} onChange={e => setAuthMode(e.target.value as any)}>
              <option value="anonymous">Anonymous</option>
              <option value="username">Username/Password</option>
            </select>
          </label>

          {authMode === 'username' && (
            <>
              <input className="input" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
              <input className="input" placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
            </>
          )}

          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ width: 90 }}>Sec Mode</span>
            <select className="input" value={securityMode} onChange={e => setSecurityMode(e.target.value as any)}>
              <option value="None">None</option>
              <option value="Sign">Sign</option>
              <option value="SignAndEncrypt">SignAndEncrypt</option>
            </select>
          </label>

          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ width: 90 }}>Policy</span>
            <select className="input" value={securityPolicy} onChange={e => setSecurityPolicy(e.target.value as any)}>
              <option value="None">None</option>
              <option value="Basic128Rsa15">Basic128Rsa15</option>
              <option value="Basic256">Basic256</option>
              <option value="Basic256Sha256">Basic256Sha256</option>
              <option value="Aes128_Sha256_RsaOaep">Aes128_Sha256_RsaOaep</option>
              <option value="Aes256_Sha256_RsaPss">Aes256_Sha256_RsaPss</option>
            </select>
          </label>

          <button className="button" onClick={() => saveServer({ name: serverUrl, endpointUrl: serverUrl, id: serverUrl, authMode, username, password, securityMode, securityPolicy })}>Save server</button>
        </div>
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Saved</div>
          <ul className="list">
            {savedServers.map(s => (
              <li key={s.id} className="list-item" onClick={() => setSelectedServer(s.id)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: s.id === selectedServerId ? 'rgba(96,165,250,0.15)' : undefined }}>
                <span title={s.endpointUrl}>{s.name}</span>
                <button className="icon-button icon-button--calm" title="Delete" onClick={(e) => { e.stopPropagation(); removeServer(s.id); }}>
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
          {!connected ? (
            <button className="icon-button icon-button--primary icon-button--lg" title="Connect" onClick={() => connect()}>
              <PlugZap size={20} />
            </button>
          ) : (
            <button className="icon-button icon-button--calm icon-button--lg" title="Disconnect" onClick={() => disconnect()}>
              <PowerOff size={20} />
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Nodes</div>
        <input className="input" placeholder="Filter by NodeId" value={filter} onChange={e => setFilter(e.target.value)} />
        <button className="button" style={{ marginTop: 8 }} onClick={() => refreshBrowse()}>Refresh</button>
        <ul className="list" style={{ marginTop: 8 }}>
          {filtered.map(n => (
            <NodeRow key={n.nodeId} node={n as TreeNode} onToggle={toggleNode} />
          ))}
        </ul>
      </div>
    </div>
  );
};
