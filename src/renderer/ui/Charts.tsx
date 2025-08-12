import React from 'react';
import './charts.css';
import { useAppStore } from './store';
import { Plus } from 'lucide-react';
import { ChartCard } from './components/ChartCard';

export const Charts: React.FC = () => {
  const charts = useAppStore(s => s.charts);
  const wsName = useAppStore(s => s.workspaces.find(w => w.id === s.selectedWorkspaceId)?.name || '');
  const addChart = useAppStore(s => s.actions.addChart);
  const removeChart = useAppStore(s => s.actions.removeChart);

  return (
    <div>
  <div className="charts-header">
        <div style={{ fontWeight: 600 }}>{wsName}</div>
        <button className="icon-button" title="Add chart" onClick={() => addChart()}><Plus size={16} /> <span style={{ marginLeft: 6 }}>Add chart</span></button>
      </div>
      {charts.map((chart) => (
        <div key={chart.id}>
          <ChartCard id={chart.id} title={chart.title} yMin={chart.yMin} yMax={chart.yMax} series={chart.series} />
        </div>
      ))}
    </div>
  );
};
