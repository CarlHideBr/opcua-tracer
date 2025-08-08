import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Sidebar } from './Sidebar';
import { Charts } from './Charts';
import { useAppStore } from './store';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { PlugZap, PowerOff, Menu, X } from 'lucide-react';

export const App: React.FC = () => {
  const connected = useAppStore(s => s.connection.connected);
  const connect = useAppStore(s => s.actions.connect);
  const disconnect = useAppStore(s => s.actions.disconnect);
  const loadFromStore = useAppStore(s => s.actions.loadFromStore);
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('sidebarWidth') : null;
    const v = saved ? parseInt(saved, 10) : 360;
    return isFinite(v) ? v : 360;
  });
  const isResizingRef = useRef(false);

  const appStyle = useMemo(() => ({
    // Keep a slim width when collapsed so the toggle remains visible inside the sidebar
    ['--sidebar-size' as any]: collapsed ? '44px' : `${sidebarWidth}px`,
  }), [sidebarWidth, collapsed]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('sidebarWidth', String(sidebarWidth));
    }
  }, [sidebarWidth]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isResizingRef.current || collapsed) return;
      const min = 240;
      const max = 720;
      const next = Math.max(min, Math.min(max, e.clientX));
      setSidebarWidth(next);
    };
    const onUp = () => { isResizingRef.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [collapsed]);

  useEffect(() => {
    loadFromStore().catch(() => {});
  }, [loadFromStore]);

  return (
    <DndProvider backend={HTML5Backend}>
      <div className={("app" + (collapsed ? " app--collapsed" : ""))} style={appStyle}>
        <header className="header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Header no longer hosts the toggle; single control lives in sidebar */}
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 6,
                background: connected ? '#10b981' : '#ef4444',
              }}
              title={connected ? 'Connected' : 'Disconnected'}
            />
            <div>OPC UA Tracer</div>
          </div>
          <div>
            {!connected && (
              <button className="icon-button icon-button--primary" title="Connect" onClick={() => connect()}>
                <PlugZap size={16} />
              </button>
            )}
          </div>
        </header>
        <aside className="sidebar">
          {/* Single fixed-position toggle inside the sidebar */}
          <button className="icon-button sidebar-toggle" title={collapsed ? 'Open sidebar' : 'Hide sidebar'} onClick={() => setCollapsed(v => !v)}>
            {collapsed ? <Menu size={16} /> : <X size={16} />}
          </button>
          {/* Hide content (not the toggle) when collapsed to avoid overlap */}
          <div className="sidebar-content">
            <Sidebar />
          </div>
          {!collapsed && (
            <div
              className="resizer"
              title="Drag to resize"
              onMouseDown={() => { isResizingRef.current = true; }}
            />
          )}
        </aside>
        <main className="main">
          <Charts />
        </main>
      </div>
    </DndProvider>
  );
};
