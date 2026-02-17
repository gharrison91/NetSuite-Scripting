'use client';

import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  MarkerType,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { GraphNode, GraphEdge, ScriptType } from '@/types';
import { Badge } from '@/components/ui/badge';

const nodeColors: Record<ScriptType, string> = {
  client: '#3B82F6',
  'user-event': '#22C55E',
  suitelet: '#A855F7',
  restlet: '#F97316',
  scheduled: '#EAB308',
  'map-reduce': '#EF4444',
  'workflow-action': '#14B8A6',
  unknown: '#6B7280',
};

const edgeStyles: Record<string, { stroke: string; strokeDasharray: string }> = {
  calls: { stroke: '#333', strokeDasharray: '0' },
  triggers: { stroke: '#333', strokeDasharray: '5,5' },
  depends_on: { stroke: '#999', strokeDasharray: '2,2' },
  shares_data: { stroke: '#999', strokeDasharray: '2,2' },
};

interface DependencyGraphProps {
  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
}

export function DependencyGraph({ graphNodes, graphEdges }: DependencyGraphProps) {
  const initialNodes: Node[] = useMemo(
    () =>
      graphNodes.map((n, i) => ({
        id: n.id,
        position: { x: (i % 4) * 250, y: Math.floor(i / 4) * 150 },
        data: {
          label: (
            <div className="text-center">
              <div className="font-mono text-xs font-medium">{n.label}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">{n.type}</div>
              <div className="text-[10px] text-gray-400">{n.version}</div>
            </div>
          ),
        },
        style: {
          background: nodeColors[n.type] + '20',
          border: `2px solid ${nodeColors[n.type]}`,
          borderRadius: '8px',
          padding: '8px 12px',
          minWidth: '140px',
        },
      })),
    [graphNodes]
  );

  const initialEdges: Edge[] = useMemo(
    () =>
      graphEdges.map((e, i) => {
        const style = edgeStyles[e.relationship] || edgeStyles.depends_on;
        return {
          id: `e-${i}`,
          source: e.source,
          target: e.target,
          label: e.relationship.replace('_', ' '),
          style: { stroke: style.stroke, strokeDasharray: style.strokeDasharray },
          markerEnd:
            e.relationship !== 'shares_data'
              ? { type: MarkerType.ArrowClosed, width: 15, height: 15 }
              : undefined,
          labelStyle: { fontSize: 10, fill: '#888' },
        };
      }),
    [graphEdges]
  );

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  return (
    <div className="h-[500px] border rounded-lg overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        attributionPosition="bottom-left"
      >
        <Controls />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
      </ReactFlow>
      <div className="absolute bottom-4 left-4 bg-card/90 border rounded-lg p-3 text-xs space-y-1">
        <p className="font-medium mb-2">Legend</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {Object.entries(nodeColors).filter(([k]) => k !== 'unknown').map(([type, color]) => (
            <div key={type} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded" style={{ background: color }} />
              <span className="capitalize">{type.replace('-', ' ')}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
