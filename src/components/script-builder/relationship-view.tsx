'use client';

import { useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  Position,
  MarkerType,
  useNodesState,
  useEdgesState,
  Handle,
  type NodeProps,
} from '@xyflow/react';
import dagre from '@dagrejs/dagre';
import { type ScriptAnalysis } from '@/lib/script-analyzer';
import '@xyflow/react/dist/style.css';

/* ------------------------------------------------------------------ */
/*  Custom Node Components                                             */
/* ------------------------------------------------------------------ */

function EntryPointNode({ data }: NodeProps) {
  return (
    <div className="px-3 py-2 rounded-lg border-2 border-violet-500 bg-violet-500/10 text-violet-700 dark:text-violet-300 min-w-[140px] text-center">
      <div className="text-[10px] uppercase tracking-wider text-violet-500 font-semibold">Entry Point</div>
      <div className="text-xs font-bold mt-0.5">{data.label as string}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-violet-500 !w-2 !h-2" />
    </div>
  );
}

function FieldNode({ data }: NodeProps) {
  const ops = (data.operations || []) as string[];
  const opColors: Record<string, string> = {
    get: 'bg-blue-400',
    set: 'bg-emerald-400',
    hide: 'bg-orange-400',
    show: 'bg-green-400',
    disable: 'bg-yellow-400',
    enable: 'bg-teal-400',
    mandatory: 'bg-red-400',
  };
  return (
    <div className="px-3 py-2 rounded-lg border border-border bg-card min-w-[120px]">
      <Handle type="target" position={Position.Top} className="!bg-primary !w-2 !h-2" />
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Field</div>
      <div className="text-xs font-mono font-bold mt-0.5">{data.label as string}</div>
      {ops.length > 0 && (
        <div className="flex gap-1 mt-1.5 flex-wrap">
          {ops.map((op: string) => (
            <span key={op} className={`w-2 h-2 rounded-full ${opColors[op] || 'bg-muted'}`} title={op} />
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-primary !w-2 !h-2" />
    </div>
  );
}

function ConditionNode({ data }: NodeProps) {
  return (
    <div className="px-3 py-2 rounded-md border-2 border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300 min-w-[140px] max-w-[220px]" style={{ transform: 'rotate(0deg)' }}>
      <Handle type="target" position={Position.Top} className="!bg-amber-500 !w-2 !h-2" />
      <div className="text-[10px] uppercase tracking-wider text-amber-500 font-semibold">Condition</div>
      <div className="text-[10px] font-mono mt-0.5 truncate">{data.label as string}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-amber-500 !w-2 !h-2" />
    </div>
  );
}

function ModuleNode({ data }: NodeProps) {
  return (
    <div className="px-3 py-2 rounded-lg border border-cyan-500 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 min-w-[120px] text-center">
      <Handle type="target" position={Position.Top} className="!bg-cyan-500 !w-2 !h-2" />
      <div className="text-[10px] uppercase tracking-wider text-cyan-500 font-semibold">Module</div>
      <div className="text-[10px] font-mono font-bold mt-0.5">{data.label as string}</div>
    </div>
  );
}

function RecordNode({ data }: NodeProps) {
  return (
    <div className="px-3 py-2 rounded-lg border border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-300 min-w-[120px] text-center">
      <Handle type="target" position={Position.Top} className="!bg-rose-500 !w-2 !h-2" />
      <div className="text-[10px] uppercase tracking-wider text-rose-500 font-semibold">Record Type</div>
      <div className="text-xs font-mono font-bold mt-0.5">{data.label as string}</div>
    </div>
  );
}

const nodeTypes = {
  entryPoint: EntryPointNode,
  field: FieldNode,
  condition: ConditionNode,
  module: ModuleNode,
  record: RecordNode,
};

/* ------------------------------------------------------------------ */
/*  Layout with dagre                                                  */
/* ------------------------------------------------------------------ */

function getLayoutedElements(nodes: Node[], edges: Edge[], direction = 'TB') {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, ranksep: 60, nodesep: 40 });

  nodes.forEach((node) => {
    g.setNode(node.id, { width: 160, height: 60 });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: { x: pos.x - 80, y: pos.y - 30 },
    };
  });

  return { nodes: layoutedNodes, edges };
}

/* ------------------------------------------------------------------ */
/*  Build graph from analysis                                          */
/* ------------------------------------------------------------------ */

function buildGraph(analysis: ScriptAnalysis): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const nodeIds = new Set<string>();

  // Add entry point nodes
  for (const ep of analysis.entryPoints) {
    const id = `ep-${ep.name}`;
    if (!nodeIds.has(id)) {
      nodeIds.add(id);
      nodes.push({
        id,
        type: 'entryPoint',
        position: { x: 0, y: 0 },
        data: { label: ep.type },
      });
    }
  }

  // Group field operations by field ID
  const fieldOps = new Map<string, Set<string>>();
  for (const f of analysis.fields) {
    if (!fieldOps.has(f.fieldId)) fieldOps.set(f.fieldId, new Set());
    fieldOps.get(f.fieldId)!.add(f.operation);
  }

  // Add field nodes (limit to 25 most operated-on fields)
  const sortedFields = [...fieldOps.entries()]
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, 25);

  for (const [fieldId, ops] of sortedFields) {
    const id = `field-${fieldId}`;
    nodeIds.add(id);
    nodes.push({
      id,
      type: 'field',
      position: { x: 0, y: 0 },
      data: { label: fieldId, operations: [...ops] },
    });
  }

  // Add condition nodes (limit to 10)
  for (const cond of analysis.conditions.slice(0, 10)) {
    const id = `cond-${cond.line}`;
    nodeIds.add(id);
    nodes.push({
      id,
      type: 'condition',
      position: { x: 0, y: 0 },
      data: { label: cond.condition.replace(/^\s*if\s*\(\s*/, '').replace(/\s*\)\s*{?\s*$/, '') },
    });

    // Connect conditions to their fields
    for (const fieldRef of cond.fields) {
      const fieldNodeId = `field-${fieldRef}`;
      if (nodeIds.has(fieldNodeId)) {
        edges.push({
          id: `e-${id}-${fieldNodeId}`,
          source: id,
          target: fieldNodeId,
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: '#f59e0b' },
          animated: true,
        });
      }
    }
  }

  // Connect entry points to fields they interact with
  // Simple heuristic: connect entry points to all fields
  if (analysis.entryPoints.length > 0 && sortedFields.length > 0) {
    const epId = `ep-${analysis.entryPoints[0].name}`;
    // Connect to conditions first, otherwise to fields directly
    if (analysis.conditions.length > 0) {
      for (const cond of analysis.conditions.slice(0, 10)) {
        edges.push({
          id: `e-${epId}-cond-${cond.line}`,
          source: epId,
          target: `cond-${cond.line}`,
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: '#8b5cf6' },
        });
      }
      // Connect fields without conditions to entry point
      const condFields = new Set(analysis.conditions.flatMap((c) => c.fields));
      for (const [fieldId] of sortedFields) {
        if (!condFields.has(fieldId)) {
          edges.push({
            id: `e-${epId}-field-${fieldId}`,
            source: epId,
            target: `field-${fieldId}`,
            markerEnd: { type: MarkerType.ArrowClosed },
            style: { stroke: '#8b5cf6' },
          });
        }
      }
    } else {
      for (const [fieldId] of sortedFields.slice(0, 10)) {
        edges.push({
          id: `e-${epId}-field-${fieldId}`,
          source: epId,
          target: `field-${fieldId}`,
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: '#8b5cf6' },
        });
      }
    }

    // Connect additional entry points
    for (let i = 1; i < analysis.entryPoints.length; i++) {
      const otherEpId = `ep-${analysis.entryPoints[i].name}`;
      if (!nodeIds.has(otherEpId)) continue;
      for (const [fieldId] of sortedFields.slice(0, 5)) {
        edges.push({
          id: `e-${otherEpId}-field-${fieldId}`,
          source: otherEpId,
          target: `field-${fieldId}`,
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: '#8b5cf6', opacity: 0.5 },
        });
      }
    }
  }

  // Add module nodes
  for (const mod of analysis.modules) {
    const id = `mod-${mod.alias}`;
    nodeIds.add(id);
    nodes.push({
      id,
      type: 'module',
      position: { x: 0, y: 0 },
      data: { label: mod.module.split('/').pop() || mod.module },
    });

    // Connect entry points to modules
    if (analysis.entryPoints.length > 0) {
      edges.push({
        id: `e-ep0-${id}`,
        source: `ep-${analysis.entryPoints[0].name}`,
        target: id,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: '#06b6d4', opacity: 0.4 },
      });
    }
  }

  // Add record type nodes
  for (const rt of analysis.recordTypes) {
    const id = `rec-${rt}`;
    nodeIds.add(id);
    nodes.push({
      id,
      type: 'record',
      position: { x: 0, y: 0 },
      data: { label: rt },
    });

    // Connect fields to record types
    for (const [fieldId] of sortedFields.slice(0, 5)) {
      edges.push({
        id: `e-field-${fieldId}-${id}`,
        source: `field-${fieldId}`,
        target: id,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: '#f43f5e', opacity: 0.5 },
      });
    }
  }

  return getLayoutedElements(nodes, edges);
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

interface RelationshipViewProps {
  analysis: ScriptAnalysis | null;
}

export function RelationshipView({ analysis }: RelationshipViewProps) {
  const { initialNodes, initialEdges } = useMemo(() => {
    if (!analysis) return { initialNodes: [], initialEdges: [] };
    const { nodes, edges } = buildGraph(analysis);
    return { initialNodes: nodes, initialEdges: edges };
  }, [analysis]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  if (!analysis || (analysis.fields.length === 0 && analysis.entryPoints.length === 0)) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        <div className="text-center space-y-2">
          <p>No relationship data to display.</p>
          <p className="text-xs">Generate a script first, then switch to Relationship view to see the field logic flowchart.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-card/90 backdrop-blur-sm border rounded-lg p-3 space-y-1.5 text-[10px]">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded border-2 border-violet-500 bg-violet-500/10" />
          <span>Entry Point</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded border-2 border-amber-500 bg-amber-500/10" />
          <span>Condition</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded border border-border bg-card" />
          <span>Field</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded border border-cyan-500 bg-cyan-500/10" />
          <span>Module</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded border border-rose-500 bg-rose-500/10" />
          <span>Record Type</span>
        </div>
        <div className="flex items-center gap-2 pt-1 border-t">
          <span className="w-2 h-2 rounded-full bg-blue-400" /> Read
          <span className="w-2 h-2 rounded-full bg-emerald-400" /> Write
          <span className="w-2 h-2 rounded-full bg-orange-400" /> Hide
          <span className="w-2 h-2 rounded-full bg-red-400" /> Required
        </div>
      </div>
    </div>
  );
}
