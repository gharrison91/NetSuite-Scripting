import { GraphNode, GraphEdge, Script } from '@/types';

export function buildDependencyGraph(
  dependencies: GraphEdge[],
  scripts: Script[]
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  // Collect all unique script names from edges
  const scriptNames = new Set<string>();
  for (const edge of dependencies) {
    scriptNames.add(edge.source);
    scriptNames.add(edge.target);
  }

  // Build lookup map from scripts
  const scriptMap = new Map<string, Script>();
  for (const script of scripts) {
    if (script.isLatest) {
      scriptMap.set(script.baseName, script);
      scriptMap.set(script.filename, script);
    }
  }

  // Create nodes
  const nodes: GraphNode[] = [];
  for (const name of scriptNames) {
    const script = scriptMap.get(name);
    nodes.push({
      id: name,
      label: name,
      type: script?.type || 'unknown',
      version: script?.version || 'v001',
      location: script?.location || { type: 'shared' },
    });
  }

  return { nodes, edges: dependencies };
}
