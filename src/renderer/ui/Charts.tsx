import React, { useMemo, useRef, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAppStore } from './store';
import { useDrop } from 'react-dnd';
import { Plus, Settings, X, Pause, Play, ZoomIn, ZoomOut, Download, ChevronLeft, ChevronRight } from 'lucide-react';

const palette = ['#60a5fa','#f472b6','#34d399','#fbbf24','#a78bfa','#f87171','#22d3ee','#e5e7eb'];

const LegendInline: React.FC<{ chartId: string; series: { nodeId: string; label: string; visible?: boolean; color?: string }[]; onToggle: (nid: string) => void }>
  = ({ chartId, series, onToggle }) => (
  <div className="legend">
    {series.map((s, i) => (
      <div key={`${chartId}-${s.nodeId}`} className="legend-item" onClick={() => onToggle(s.nodeId)} title={s.label}
           style={{ opacity: s.visible === false ? 0.4 : 1 }}>
        <span className="legend-swatch" style={{ background: s.color || palette[i % palette.length] }} />
        <span style={{ fontSize: 12 }}>{s.label}</span>
      </div>
    ))}
  </div>
);

const ChartCard: React.FC<{ id: string; title: string; yMin?: number | 'auto'; yMax?: number | 'auto';
  series: { nodeId: string; label: string; visible?: boolean; color?: string }[] }>
= ({ id, title, yMin, yMax, series }) => {
  const data = useAppStore(s => s.chartData);
  const chart = useAppStore(s => s.charts.find(c => c.id === id));
  const toggleSeries = useAppStore(s => s.actions.toggleSeries);
  const addSeriesToChart = useAppStore(s => s.actions.addSeriesToChart);
  const setChartConfig = useAppStore(s => s.actions.setChartConfig);
  const pauseChart = useAppStore(s => s.actions.pauseChart);
  const setYScale = useAppStore(s => s.actions.setYScale);
  const setXRangeMinutes = useAppStore(s => s.actions.setXRangeMinutes);
  const setZoom = useAppStore(s => s.actions.setZoom);
  const panChart = useAppStore(s => s.actions.panChart);

  const [showCfg, setShowCfg] = useState(false);
  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'TAG',
    drop: (item: any) => addSeriesToChart(id, item.node),
    collect: (monitor) => ({ isOver: monitor.isOver() })
  }));

  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const onMouseDown = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDragStart(e.clientX - rect.left);
    setDragEnd(null);
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (dragStart == null) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDragEnd(e.clientX - rect.left);
  };
  const onMouseUp = () => {
    if (dragStart != null && dragEnd != null && Math.abs(dragEnd - dragStart) > 10) {
      // naive zoom over last N points based on pixel window (approx)
      const tMin = data[0]?.t;
      const tMax = data[data.length - 1]?.t;
      if (tMin && tMax && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const a = Math.min(dragStart, dragEnd) / rect.width;
        const b = Math.max(dragStart, dragEnd) / rect.width;
        const from = Math.round(tMin + (tMax - tMin) * a);
        const to = Math.round(tMin + (tMax - tMin) * b);
        setZoom(id, [from, to]);
      }
    }
    setDragStart(null);
    setDragEnd(null);
  };

  const overlayStyle = useMemo(() => {
    if (dragStart == null || dragEnd == null) return { display: 'none' } as React.CSSProperties;
    const left = Math.min(dragStart, dragEnd);
    const width = Math.abs(dragEnd - dragStart);
    return { position: 'absolute', left, width, top: 0, bottom: 0, background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.35)', pointerEvents: 'none' } as React.CSSProperties;
  }, [dragStart, dragEnd]);

  // Compute x-axis domain and visible data based on live/paused/zoom
  const { domain, visible } = useMemo(() => {
    const now = Date.now();
    const windowMin = (chart?.xRangeMinutes ?? 15) * 60 * 1000;
    const right = chart?.paused ? (chart?.xRight ?? now) : now;
    const baseFrom = right - windowMin;
    const from = chart?.xZoom ? chart.xZoom[0] : baseFrom;
    const to = chart?.xZoom ? chart.xZoom[1] : right;
    const vis = data.filter(d => d.t >= from && d.t <= to);
    return { domain: [from, to] as [number, number], visible: vis };
  }, [chart?.paused, chart?.xRight, chart?.xRangeMinutes, chart?.xZoom, data]);

  return (
    <div ref={drop as any} className="card" style={{ outline: isOver ? '1px dashed rgba(59,130,246,0.6)' : 'none' }}>
      <div className="card-title">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontWeight: 600 }}>{title}</div>
          <span style={{
            fontSize: 10,
            padding: '2px 6px',
            borderRadius: 8,
            background: chart?.paused ? 'rgba(234,179,8,0.15)' : 'rgba(34,197,94,0.15)',
            color: chart?.paused ? '#eab308' : '#22c55e',
            border: `1px solid ${chart?.paused ? 'rgba(234,179,8,0.35)' : 'rgba(34,197,94,0.35)'}`
          }}>{chart?.paused ? 'PAUSED' : 'LIVE'}</span>
        </div>
        <div className="card-actions">
          <button className="icon-button" title="Settings" onClick={() => setShowCfg(v => !v)}><Settings size={16} /></button>
          <button className="icon-button" title="Pause" onClick={() => pauseChart(id, true)}><Pause size={16} /></button>
          <button className="icon-button" title="Resume" onClick={() => pauseChart(id, false)}><Play size={16} /></button>
          {chart?.paused && (
            <>
              <button className="icon-button" title="Pan left" onClick={() => {
                const winMs = (chart?.xRangeMinutes ?? 15) * 60 * 1000;
                panChart(id, -Math.round(winMs * 0.25));
              }}><ChevronLeft size={16} /></button>
              <button className="icon-button" title="Pan right" onClick={() => {
                const winMs = (chart?.xRangeMinutes ?? 15) * 60 * 1000;
                panChart(id, Math.round(winMs * 0.25));
              }}><ChevronRight size={16} /></button>
            </>
          )}
          <button className="icon-button" title="Reset zoom" onClick={() => setZoom(id, undefined)}><ZoomOut size={16} /></button>
          <button className="icon-button" title="Export CSV" onClick={() => {
            const cols = ['t', ...series.map(s => s.nodeId)];
            const csv = [cols.join(',')].concat(
              data.map(row => cols.map(c => row[c as keyof typeof row] ?? '').join(','))
            ).join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `${title.replace(/\s+/g,'_')}.csv`;
            a.click();
          }}><Download size={16} /></button>
        </div>
      </div>
      {showCfg && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginTop: 8 }}>
          <label style={{ fontSize: 12 }}>Window (min)
            <input className="input" type="number" min={1} max={720} value={chart?.xRangeMinutes ?? 15} onChange={(e) => setXRangeMinutes(id, Number(e.target.value))} />
          </label>
          <label style={{ fontSize: 12 }}>Y min
            <input className="input" type="number" placeholder="auto" onChange={(e) => setYScale(id, e.target.value === '' ? 'auto' : Number(e.target.value), undefined)} />
          </label>
          <label style={{ fontSize: 12 }}>Y max
            <input className="input" type="number" placeholder="auto" onChange={(e) => setYScale(id, undefined, e.target.value === '' ? 'auto' : Number(e.target.value))} />
          </label>
          <div style={{ alignSelf: 'end' }}>
            <button className="icon-button" title="Zoom in" onClick={() => setZoom(id, undefined)}><ZoomIn size={16} /></button>
          </div>
        </div>
      )}
      <LegendInline chartId={id} series={series} onToggle={(nid) => toggleSeries(id, nid)} />
      <div style={{ height: 300, position: 'relative' }} ref={containerRef} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}>
        <div style={overlayStyle} />
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={visible} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis type="number" dataKey="t" domain={domain as any} tickFormatter={(t) => new Date(t).toLocaleTimeString()} stroke="#9ca3af" />
            <YAxis domain={[yMin ?? 'auto', yMax ?? 'auto']} stroke="#9ca3af" />
            <Tooltip labelFormatter={(t) => new Date(Number(t)).toLocaleTimeString()} />
            {series.filter(s => s.visible !== false).map((s, i) => (
              <Line key={s.nodeId} type="monotone" dot={false} isAnimationActive={false} dataKey={s.nodeId} name={s.label}
                    stroke={s.color || palette[i % palette.length]} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export const Charts: React.FC = () => {
  const charts = useAppStore(s => s.charts);
  const addChart = useAppStore(s => s.actions.addChart);
  const removeChart = useAppStore(s => s.actions.removeChart);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontWeight: 600 }}>Charts</div>
        <button className="icon-button" title="Add chart" onClick={() => addChart()}><Plus size={16} /></button>
      </div>
      {charts.map((chart) => (
        <div key={chart.id}>
          <ChartCard id={chart.id} title={chart.title} yMin={chart.yMin} yMax={chart.yMax} series={chart.series} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -6, marginBottom: 10 }}>
            <button className="icon-button icon-button--calm" title="Remove chart" onClick={() => removeChart(chart.id)}><X size={16} /></button>
          </div>
        </div>
      ))}
    </div>
  );
};
