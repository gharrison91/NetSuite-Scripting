'use client';

import { useMemo, useState } from 'react';
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
import { type ScriptAnalysis, type FieldOperation, type ConditionBlock } from '@/lib/script-analyzer';
import '@xyflow/react/dist/style.css';

/* ------------------------------------------------------------------ */
/*  Operation labels & colors                                          */
/* ------------------------------------------------------------------ */

const OP_LABELS: Record<string, string> = {
  get: 'READ', set: 'WRITE', hide: 'HIDE', show: 'SHOW',
  disable: 'DISABLE', enable: 'ENABLE', mandatory: 'REQUIRED',
};

const OP_TAG_CLASSES: Record<string, string> = {
  get: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
  set: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
  hide: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
  show: 'bg-green-500/20 text-green-400 border-green-500/40',
  disable: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
  enable: 'bg-teal-500/20 text-teal-400 border-teal-500/40',
  mandatory: 'bg-red-500/20 text-red-400 border-red-500/40',
};

/* ------------------------------------------------------------------ */
/*  Custom Node Components                                             */
/* ------------------------------------------------------------------ */

function EntryPointNode({ data }: NodeProps) {
  return (
    <div className="px-4 py-3 rounded-lg border-2 border-violet-500 bg-violet-500/10 min-w-[160px] text-center shadow-lg shadow-violet-500/10">
      <div className="text-[9px] uppercase tracking-widest text-violet-400 font-bold">Entry Point</div>
      <div className="text-sm font-bold text-violet-300 mt-1">{data.label as string}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-violet-500 !w-2.5 !h-2.5 !border-2 !border-violet-300" />
    </div>
  );
}

function ConditionNode({ data }: NodeProps) {
  return (
    <div className="px-4 py-3 rounded-lg border-2 border-amber-500 bg-amber-500/10 min-w-[180px] max-w-[280px] shadow-lg shadow-amber-500/10">
      <Handle type="target" position={Position.Top} className="!bg-amber-500 !w-2.5 !h-2.5 !border-2 !border-amber-300" />
      <div className="text-[9px] uppercase tracking-widest text-amber-400 font-bold mb-1">IF Condition</div>
      <div className="text-[11px] font-mono text-amber-200 leading-snug break-words">{data.label as string}</div>
      {(data.fields as string[])?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {(data.fields as string[]).map((f: string) => (
            <span key={f} className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 font-mono border border-amber-500/30">
              {f}
            </span>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-amber-500 !w-2.5 !h-2.5 !border-2 !border-amber-300" />
    </div>
  );
}

function ActionNode({ data }: NodeProps) {
  const op = data.operation as string;
  const tagClass = OP_TAG_CLASSES[op] || 'bg-muted text-muted-foreground';
  return (
    <div className="px-4 py-2.5 rounded-lg border border-border bg-card min-w-[160px] shadow-md">
      <Handle type="target" position={Position.Top} className="!bg-primary !w-2 !h-2" />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-mono font-bold text-foreground">{data.label as string}</span>
        <span className={`text-[8px] px-1.5 py-0.5 rounded border font-bold ${tagClass}`}>
          {OP_LABELS[op] || op?.toUpperCase()}
        </span>
      </div>
      {data.context ? (
        <div className="text-[9px] text-muted-foreground font-mono mt-1 truncate max-w-[220px]">
          L{String(data.line)}: {String(data.context)}
        </div>
      ) : null}
      <Handle type="source" position={Position.Bottom} className="!bg-primary !w-2 !h-2" />
    </div>
  );
}

function ModuleNode({ data }: NodeProps) {
  return (
    <div className="px-3 py-2 rounded-lg border border-cyan-500/50 bg-cyan-500/10 min-w-[100px] text-center">
      <Handle type="target" position={Position.Top} className="!bg-cyan-500 !w-2 !h-2" />
      <div className="text-[8px] uppercase tracking-widest text-cyan-400 font-bold">Module</div>
      <div className="text-[10px] font-mono text-cyan-300 mt-0.5">{data.label as string}</div>
    </div>
  );
}

const nodeTypes = {
  entryPoint: EntryPointNode,
  condition: ConditionNode,
  action: ActionNode,
  module: ModuleNode,
};

/* ------------------------------------------------------------------ */
/*  Layout                                                             */
/* ------------------------------------------------------------------ */

function layoutGraph(nodes: Node[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', ranksep: 80, nodesep: 30, marginx: 30, marginy: 30 });

  nodes.forEach((node) => {
    const w = node.type === 'condition' ? 260 : node.type === 'entryPoint' ? 180 : 200;
    const h = node.type === 'condition' ? 80 : 55;
    g.setNode(node.id, { width: w, height: h });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    const w = node.type === 'condition' ? 260 : node.type === 'entryPoint' ? 180 : 200;
    const h = node.type === 'condition' ? 80 : 55;
    return { ...node, position: { x: pos.x - w / 2, y: pos.y - h / 2 } };
  });
}

/* ------------------------------------------------------------------ */
/*  Build process-workflow graph                                       */
/* ------------------------------------------------------------------ */

function buildWorkflowGraph(analysis: ScriptAnalysis): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  let edgeId = 0;

  // 1. Entry points at the top
  for (const ep of analysis.entryPoints) {
    nodes.push({
      id: `ep-${ep.name}`,
      type: 'entryPoint',
      position: { x: 0, y: 0 },
      data: { label: ep.type },
    });
  }

  // 2. Build condition → action chains
  // For each condition, find which field operations happen inside/near it
  const usedFieldOps = new Set<number>(); // track field ops already linked to conditions

  for (let ci = 0; ci < analysis.conditions.length; ci++) {
    const cond = analysis.conditions[ci];
    const condId = `cond-${ci}`;
    const condLabel = cond.condition
      .replace(/^\s*if\s*\(\s*/, '')
      .replace(/\s*\)\s*\{?\s*$/, '')
      .replace(/currentRecord\./g, '')
      .replace(/scriptContext\./g, '');

    nodes.push({
      id: condId,
      type: 'condition',
      position: { x: 0, y: 0 },
      data: { label: condLabel, fields: cond.fields },
    });

    // Connect from entry points to this condition
    if (analysis.entryPoints.length > 0) {
      edges.push({
        id: `e-${edgeId++}`,
        source: `ep-${analysis.entryPoints[0].name}`,
        target: condId,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: '#8b5cf6', strokeWidth: 2 },
      });
    }

    // Find field operations that happen within ~20 lines after this condition
    const nextCondLine = ci + 1 < analysis.conditions.length
      ? analysis.conditions[ci + 1].line
      : cond.line + 50;

    const opsInScope = analysis.fields.filter(
      (f) => f.line > cond.line && f.line < nextCondLine && !usedFieldOps.has(f.line)
    );

    // Group by fieldId to avoid duplicates
    const fieldGroups = new Map<string, FieldOperation[]>();
    for (const op of opsInScope) {
      if (!fieldGroups.has(op.fieldId)) fieldGroups.set(op.fieldId, []);
      fieldGroups.get(op.fieldId)!.push(op);
      usedFieldOps.add(op.line);
    }

    for (const [fieldId, ops] of fieldGroups) {
      for (const op of ops) {
        const actionId = `action-${edgeId}`;
        nodes.push({
          id: actionId,
          type: 'action',
          position: { x: 0, y: 0 },
          data: {
            label: fieldId,
            operation: op.operation,
            context: op.context,
            line: op.line,
          },
        });

        edges.push({
          id: `e-${edgeId++}`,
          source: condId,
          target: actionId,
          label: 'THEN',
          labelStyle: { fontSize: 9, fontWeight: 700, fill: '#f59e0b' },
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: '#f59e0b', strokeWidth: 1.5 },
          animated: true,
        });
      }
    }
  }

  // 3. Any field operations NOT inside a condition → connect directly to entry point
  const unconditionalOps = analysis.fields.filter((f) => !usedFieldOps.has(f.line));
  const uncondGroups = new Map<string, FieldOperation>();
  for (const op of unconditionalOps) {
    const key = `${op.fieldId}-${op.operation}`;
    if (!uncondGroups.has(key)) uncondGroups.set(key, op);
  }

  for (const [, op] of uncondGroups) {
    const actionId = `action-${edgeId}`;
    nodes.push({
      id: actionId,
      type: 'action',
      position: { x: 0, y: 0 },
      data: {
        label: op.fieldId,
        operation: op.operation,
        context: op.context,
        line: op.line,
      },
    });

    if (analysis.entryPoints.length > 0) {
      edges.push({
        id: `e-${edgeId++}`,
        source: `ep-${analysis.entryPoints[0].name}`,
        target: actionId,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: '#8b5cf6', strokeWidth: 1, opacity: 0.6 },
      });
    }
  }

  // 4. Modules (compact, at the side)
  for (const mod of analysis.modules.slice(0, 6)) {
    const modId = `mod-${mod.alias}`;
    nodes.push({
      id: modId,
      type: 'module',
      position: { x: 0, y: 0 },
      data: { label: mod.module.split('/').pop() || mod.module },
    });
    if (analysis.entryPoints.length > 0) {
      edges.push({
        id: `e-${edgeId++}`,
        source: `ep-${analysis.entryPoints[0].name}`,
        target: modId,
        style: { stroke: '#06b6d4', strokeWidth: 1, opacity: 0.3 },
      });
    }
  }

  // Layout
  const layoutedNodes = layoutGraph(nodes, edges);
  return { nodes: layoutedNodes, edges };
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
    const { nodes, edges } = buildWorkflowGraph(analysis);
    return { initialNodes: nodes, initialEdges: edges };
  }, [analysis]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  if (!analysis || (analysis.fields.length === 0 && analysis.entryPoints.length === 0)) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        <div className="text-center space-y-2">
          <p>No relationship data to display.</p>
          <p className="text-xs">Generate a script first, then switch to Relationship view.</p>
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
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.2}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-card/95 backdrop-blur-sm border rounded-lg p-3 space-y-1 text-[10px] shadow-lg">
        <div className="font-semibold text-[11px] mb-1.5 text-foreground">Flow Legend</div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded border-2 border-violet-500 bg-violet-500/10" />
          <span>Entry Point</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded border-2 border-amber-500 bg-amber-500/10" />
          <span>IF Condition</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded border border-border bg-card" />
          <span>Field Action</span>
        </div>
        <div className="border-t pt-1 mt-1 space-y-0.5">
          <div className="flex items-center gap-1">
            <span className="text-[8px] px-1 rounded bg-blue-500/20 text-blue-400 border border-blue-500/40">READ</span>
            <span className="text-[8px] px-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">WRITE</span>
            <span className="text-[8px] px-1 rounded bg-orange-500/20 text-orange-400 border border-orange-500/40">HIDE</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[8px] px-1 rounded bg-red-500/20 text-red-400 border border-red-500/40">REQUIRED</span>
            <span className="text-[8px] px-1 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/40">DISABLE</span>
          </div>
        </div>
      </div>
    </div>
  );
}
