import React, { useState } from 'react';
import './sidebar.css';
import { useAppStore } from './store';
import type { Workspace } from '../../shared/types';
import { PlugZap, PowerOff, Trash2, Plus, Save, Upload, Pencil } from 'lucide-react';
import { NodesTree, type TreeNode } from './components/NodesTree';

export const Sidebar: React.FC = () => {
  const nodes = useAppStore(s => s.nodes as TreeNode[]);
  const filter = useAppStore(s => s.nodeFilter);
  const setFilter = useAppStore(s => s.actions.setNodeFilter);
  // Drag-and-drop replaces per-node add buttons
  const toggleNode = useAppStore(s => s.actions.toggleNode);
  const refreshBrowse = useAppStore(s => s.actions.refreshBrowse);
  const workspaces = useAppStore(s => s.workspaces);
  const upsertWorkspace = useAppStore(s => s.actions.upsertWorkspace);
  const removeWorkspace = useAppStore(s => s.actions.removeWorkspace);
  const confirmBox = useAppStore(s => s.actions.confirm);
  const selectedWorkspaceId = useAppStore(s => s.selectedWorkspaceId);
  const connectedWorkspaceId = useAppStore(s => s.connectedWorkspaceId);
  const setSelectedWorkspace = useAppStore(s => s.actions.setSelectedWorkspace);
  const connected = useAppStore(s => s.connection.connected);
  const connect = useAppStore(s => s.actions.connect);
  const disconnect = useAppStore(s => s.actions.disconnect);
  const closeWorkspace = useAppStore(s => s.actions.closeWorkspace);

  const [serverUrl, setServerUrl] = useState('opc.tcp://localhost:4840');
  const [authMode, setAuthMode] = useState<'anonymous' | 'username'>('anonymous');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [securityMode, setSecurityMode] = useState<'None' | 'Sign' | 'SignAndEncrypt'>('None');
  const [securityPolicy, setSecurityPolicy] = useState<'None' | 'Basic128Rsa15' | 'Basic256' | 'Basic256Sha256' | 'Aes128_Sha256_RsaOaep' | 'Aes256_Sha256_RsaPss'>('None');
  const [wsName, setWsName] = useState('Workspace 1');
  const [showWsForm, setShowWsForm] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const newId = () => (typeof crypto !== 'undefined' && (crypto as any).randomUUID ? (crypto as any).randomUUID() : `ws-${Date.now()}-${Math.floor(Math.random()*1e6)}`);

  // filtering moved into NodesTree

  return (
    <div>
      <div className="card">
        <div className="ws-header">
          <div style={{ fontWeight: 600 }}>Workspaces</div>
          <div className="ws-actions">
            <button className="icon-button icon-button--primary" title="New workspace" onClick={() => setShowWsForm(v => !v)}>
              <Plus size={16} />
            </button>
          </div>
        </div>
        {showWsForm && !editingId && (
          <div className="ws-create-form" style={{ marginBottom: 8 }}>
            <input className="input" placeholder="Workspace name" value={wsName} onChange={e => setWsName(e.target.value)} />
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Interface</div>
            <select className="input" value={'opcua'} disabled>
              <option value="opcua">OPC UA</option>
            </select>
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
            <button className="button" onClick={() => {
              const id = editingId ?? newId();
              const ws: Workspace = {
                id,
                name: wsName || serverUrl,
                interface: 'opcua',
                endpointUrl: serverUrl,
                authMode, username, password,
                securityMode, securityPolicy
              };
              upsertWorkspace(ws).then(() => {
                setSelectedWorkspace(ws.id);
                setShowWsForm(false);
                setEditingId(undefined);
              });
            }}>{editingId ? 'Save workspace' : 'Create workspace'}</button>
          </div>
        )}
        <div>
          <ul className="list ws-list">
            {workspaces.map(s => (
              <li
                key={s.id}
                className="list-item ws-item"
                style={{
                  background: (showWsForm && editingId === s.id)
                    ? 'rgba(234,179,8,0.12)'
                    : (s.id === selectedWorkspaceId ? 'rgba(96,165,250,0.14)' : 'transparent'),
                  border: (showWsForm && editingId === s.id)
                    ? '1px solid rgba(234,179,8,0.35)'
                    : (s.id === selectedWorkspaceId ? '1px solid rgba(96,165,250,0.35)' : '1px solid transparent'),
                }}
              >
                <div
                  onClick={() => {
                    setSelectedWorkspace(s.id);
                  }}
                  className="ws-row"
                >
                  <span title={s.endpointUrl} className="ws-title">
                    {connectedWorkspaceId === s.id && (<span className="connected-dot" title="Connected" />)}
                    {s.name}
                  </span>
                  <span style={{ display: 'flex', gap: 6 }}>
                    <button className={"icon-button" + (showWsForm && editingId === s.id ? " icon-button--active" : "")} title="Edit" onClick={(e) => {
                      e.stopPropagation();
                      if (showWsForm && editingId === s.id) {
                        // toggle off
                        setShowWsForm(false);
                        setEditingId(undefined);
                      } else {
                        // open and populate
                        setWsName(s.name);
                        setServerUrl(s.endpointUrl);
                        setAuthMode((s.authMode as any) || (s.username ? 'username' : 'anonymous'));
                        setUsername(s.username || '');
                        setPassword(s.password || '');
                        setSecurityMode((s.securityMode as any) || 'None');
                        setSecurityPolicy((s.securityPolicy as any) || 'None');
                        setEditingId(s.id);
                        setShowWsForm(true);
                      }
                    }}>
                      <Pencil size={16} />
                    </button>
                    <button className="icon-button icon-button--calm" title="Export" onClick={(e) => { e.stopPropagation(); useAppStore.getState().actions.exportWorkspace(s.id); }}>
                      <Save size={16} />
                    </button>
                    <label className="icon-button icon-button--calm" title="Import into this workspace" style={{ cursor: 'pointer' }} onClick={(e) => e.stopPropagation()}>
                      <Upload size={16} />
                      <input type="file" accept="application/json" style={{ display: 'none' }} onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) useAppStore.getState().actions.importWorkspace(s.id, f).catch(() => {});
                        e.currentTarget.value = '';
                      }} />
                    </label>
                    <button className="icon-button icon-button--calm" title="Delete" onClick={async (e) => {
                      e.stopPropagation();
                      const ok = await confirmBox({ message: `Delete workspace "${s.name}"? This will remove its saved charts.`, confirmLabel: 'Delete', cancelLabel: 'Cancel', destructive: true });
                      if (ok) removeWorkspace(s.id);
                    }}>
                      <Trash2 size={16} />
                    </button>
                  </span>
                </div>
                {showWsForm && editingId === s.id && (
                  <div className="ws-inline-editor" style={{ marginTop: 8 }}>
                    <input className="input" placeholder="Workspace name" value={wsName} onChange={e => { setWsName(e.target.value); upsertWorkspace({ ...s, name: e.target.value }); }} />
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>Interface</div>
                    <select className="input" value={'opcua'} disabled>
                      <option value="opcua">OPC UA</option>
                    </select>
                    <input className="input" placeholder="opc.tcp://host:port" value={serverUrl} onChange={e => { setServerUrl(e.target.value); upsertWorkspace({ ...s, endpointUrl: e.target.value }); }} />
                    <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ width: 90 }}>Auth</span>
                      <select className="input" value={authMode} onChange={e => { const v = e.target.value as any; setAuthMode(v); upsertWorkspace({ ...s, authMode: v }); }}>
                        <option value="anonymous">Anonymous</option>
                        <option value="username">Username/Password</option>
                      </select>
                    </label>
                    {authMode === 'username' && (
                      <>
                        <input className="input" placeholder="Username" value={username} onChange={e => { setUsername(e.target.value); upsertWorkspace({ ...s, username: e.target.value }); }} />
                        <input className="input" placeholder="Password" type="password" value={password} onChange={e => { setPassword(e.target.value); upsertWorkspace({ ...s, password: e.target.value }); }} />
                      </>
                    )}
                    <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ width: 90 }}>Sec Mode</span>
                      <select className="input" value={securityMode} onChange={e => { const v = e.target.value as any; setSecurityMode(v); upsertWorkspace({ ...s, securityMode: v }); }}>
                        <option value="None">None</option>
                        <option value="Sign">Sign</option>
                        <option value="SignAndEncrypt">SignAndEncrypt</option>
                      </select>
                    </label>
                    <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ width: 90 }}>Policy</span>
                      <select className="input" value={securityPolicy} onChange={e => { const v = e.target.value as any; setSecurityPolicy(v); upsertWorkspace({ ...s, securityPolicy: v }); }}>
                        <option value="None">None</option>
                        <option value="Basic128Rsa15">Basic128Rsa15</option>
                        <option value="Basic256">Basic256</option>
                        <option value="Basic256Sha256">Basic256Sha256</option>
                        <option value="Aes128_Sha256_RsaOaep">Aes128_Sha256_RsaOaep</option>
                        <option value="Aes256_Sha256_RsaPss">Aes256_Sha256_RsaPss</option>
                      </select>
                    </label>
                    {/* auto-save; no explicit save button */}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
        <div className="sidebar-footer">
          <div className="endpoint-label">
            {(connected && connectedWorkspaceId)
              ? (workspaces.find(w => w.id === connectedWorkspaceId)?.endpointUrl || '')
              : ''}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {!connected ? (
              <button className="icon-button icon-button--primary icon-button--lg" title="Connect" onClick={() => connect()}>
                <PlugZap size={20} />
              </button>
            ) : (
              <>
                <button className="icon-button icon-button--calm icon-button--lg" title="Disconnect" onClick={() => disconnect()}>
                  <PowerOff size={20} />
                </button>
                <button className="icon-button" title="Close workspace" onClick={() => closeWorkspace()}>Close</button>
              </>
            )}
          </div>
        </div>
      </div>

      {connected && (
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Nodes</div>
          <input className="input" placeholder="Filter by NodeId" value={filter} onChange={e => setFilter(e.target.value)} />
          <button className="button" style={{ marginTop: 8 }} onClick={() => refreshBrowse()}>Refresh</button>
          <NodesTree nodes={nodes} filter={filter} onToggle={toggleNode} />
        </div>
      )}
    </div>
  );
};
