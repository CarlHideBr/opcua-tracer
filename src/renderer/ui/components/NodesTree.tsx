import React, { useMemo } from 'react';
import type { UaNode } from '../../../shared/types';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { useDrag } from 'react-dnd';

const ItemTypes = { TAG: 'TAG' } as const;

export type TreeNode = UaNode & { expanded?: boolean };

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
  const indentBase = Math.min(depth, 3) * 8 + Math.max(0, depth - 3) * 2;
  const indent = Math.min(80, indentBase);
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

export const NodesTree: React.FC<{ nodes: TreeNode[]; filter: string; onToggle: (id: string) => void }>
  = ({ nodes, filter, onToggle }) => {
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
    <ul className="list" style={{ marginTop: 8 }}>
      {filtered.map(n => (
        <NodeRow key={n.nodeId} node={n as TreeNode} onToggle={onToggle} />
      ))}
    </ul>
  );
};
