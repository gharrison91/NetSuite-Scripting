'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRepo } from '@/hooks/use-repo';
import { useFileContent } from '@/hooks/use-file-content';
import { parseDependencies } from '@/lib/markdown-parser';
import { buildDependencyGraph } from '@/lib/graph-builder';
import { DependencyGraph } from './dependency-graph';
import { MarkdownRenderer } from '@/components/shared/markdown-renderer';
import { EmptyState } from '@/components/shared/empty-state';
import { ContentSkeleton } from '@/components/shared/loading-skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GitFork, Loader2 } from 'lucide-react';
import { GraphNode, GraphEdge } from '@/types';
import { analyzeScript } from '@/lib/script-analyzer';

export function MapsViewer() {
  const { tree, scripts, config } = useRepo();
  const { fetchFile, loading } = useFileContent();
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] } | null>(null);
  const [mapFiles, setMapFiles] = useState<{ name: string; path: string; content?: string }[]>([]);
  const [selectedMap, setSelectedMap] = useState<string | null>(null);
  const [mapContent, setMapContent] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  /* Try to load from maps/ directory first */
  const loadMaps = useCallback(async () => {
    const mapsDir = tree.find((n) => n.name === 'maps' && n.type === 'directory');
    if (!mapsDir?.children) {
      setLoaded(true);
      return;
    }

    const mdFiles = mapsDir.children
      .filter((n) => n.type === 'file' && n.name.endsWith('.md'))
      .map((n) => ({ name: n.name, path: n.path }));
    setMapFiles(mdFiles);

    // Load script-dependencies.md for graph
    const depFile = mdFiles.find((f) => f.name.includes('dependencies'));
    if (depFile) {
      const content = await fetchFile(depFile.path);
      if (content) {
        const edges = parseDependencies(content);
        const graph = buildDependencyGraph(edges, scripts);
        setGraphData(graph);
      }
    }

    setLoaded(true);
  }, [tree, scripts, fetchFile]);

  useEffect(() => {
    if (tree.length > 0 && !loaded) {
      loadMaps();
    }
  }, [tree, loaded, loadMaps]);

  /* Auto-generate dependency graph from scripts when no maps/ files exist */
  const autoGenerateGraph = useCallback(async () => {
    if (!config || scripts.length === 0) return;

    setAnalyzing(true);
    try {
      const latestScripts = scripts.filter((s) => s.isLatest);
      const nodes: GraphNode[] = [];
      const edges: GraphEdge[] = [];
      const moduleUsers = new Map<string, string[]>(); // module → script names that use it

      for (const script of latestScripts) {
        // Add script as a node
        nodes.push({
          id: script.baseName,
          label: script.baseName,
          type: script.type,
          version: script.version,
          location: script.location,
        });

        // Fetch the script content and analyze it
        try {
          const res = await fetch(
            `/api/repo/file?owner=${config.owner}&repo=${config.repo}&branch=${config.branch}&path=${encodeURIComponent(script.path)}`
          );
          if (!res.ok) continue;
          const data = await res.json();
          const analysis = analyzeScript(data.content);

          // Track which modules each script uses
          for (const mod of analysis.modules) {
            const modName = mod.module.split('/').pop() || mod.module;
            if (!moduleUsers.has(modName)) moduleUsers.set(modName, []);
            moduleUsers.get(modName)!.push(script.baseName);
          }

          // Check if script references other scripts by name
          for (const other of latestScripts) {
            if (other.baseName === script.baseName) continue;
            if (data.content.includes(other.baseName) || data.content.includes(other.filename)) {
              edges.push({
                source: script.baseName,
                target: other.baseName,
                relationship: 'calls',
                details: 'References script name in code',
              });
            }
          }

          // Check JSDoc dependencies
          if (script.dependencies) {
            for (const dep of script.dependencies) {
              const target = latestScripts.find(
                (s) => s.baseName === dep || s.filename === dep
              );
              if (target) {
                const already = edges.find(
                  (e) => e.source === script.baseName && e.target === target.baseName
                );
                if (!already) {
                  edges.push({
                    source: script.baseName,
                    target: target.baseName,
                    relationship: 'depends_on',
                    details: 'Declared in JSDoc @dependencies',
                  });
                }
              }
            }
          }
        } catch {
          // Skip scripts that can't be fetched
        }
      }

      // Scripts that share the same N/module are related
      for (const [modName, users] of moduleUsers) {
        if (users.length > 1 && !modName.startsWith('N/')) {
          for (let i = 0; i < users.length; i++) {
            for (let j = i + 1; j < users.length; j++) {
              const already = edges.find(
                (e) =>
                  (e.source === users[i] && e.target === users[j]) ||
                  (e.source === users[j] && e.target === users[i])
              );
              if (!already) {
                edges.push({
                  source: users[i],
                  target: users[j],
                  relationship: 'shares_data',
                  details: `Both use module: ${modName}`,
                });
              }
            }
          }
        }
      }

      // Dashboard-based relationships: scripts in the same dashboard
      const dashboardGroups = new Map<string, string[]>();
      for (const script of latestScripts) {
        if (script.location.type === 'dashboard' && script.location.parent) {
          const parent = script.location.parent;
          if (!dashboardGroups.has(parent)) dashboardGroups.set(parent, []);
          dashboardGroups.get(parent)!.push(script.baseName);
        }
      }

      for (const [, group] of dashboardGroups) {
        if (group.length > 1) {
          // Connect first script to others as triggers
          for (let i = 1; i < group.length; i++) {
            const already = edges.find(
              (e) =>
                (e.source === group[0] && e.target === group[i]) ||
                (e.source === group[i] && e.target === group[0])
            );
            if (!already) {
              edges.push({
                source: group[0],
                target: group[i],
                relationship: 'triggers',
                details: 'Same dashboard',
              });
            }
          }
        }
      }

      if (nodes.length > 0) {
        setGraphData({ nodes, edges });
      }
    } catch (err) {
      console.warn('Failed to auto-generate dependency graph:', err);
    } finally {
      setAnalyzing(false);
    }
  }, [config, scripts]);

  // Auto-generate when loaded but no graph data from maps/
  useEffect(() => {
    if (loaded && !graphData && !analyzing && scripts.length > 0 && config) {
      autoGenerateGraph();
    }
  }, [loaded, graphData, analyzing, scripts, config, autoGenerateGraph]);

  const loadMapFile = async (path: string) => {
    setSelectedMap(path);
    const content = await fetchFile(path);
    if (content) setMapContent(content);
  };

  if ((!loaded || analyzing) && !graphData) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          {analyzing ? 'Analyzing scripts and building dependency graph...' : 'Loading maps...'}
        </p>
      </div>
    );
  }

  if (loaded && !analyzing && !graphData && mapFiles.length === 0) {
    return (
      <EmptyState
        title="No Dependencies Found"
        description="No scripts to analyze. Connect a repository with SuiteScript files to see the dependency graph."
        icon={GitFork}
      />
    );
  }

  return (
    <Tabs defaultValue="graph" className="space-y-4">
      <TabsList>
        <TabsTrigger value="graph">Dependency Graph</TabsTrigger>
        {mapFiles.length > 0 && <TabsTrigger value="raw">Raw Maps</TabsTrigger>}
      </TabsList>

      <TabsContent value="graph" className="relative">
        {graphData && graphData.nodes.length > 0 ? (
          <>
            {mapFiles.length === 0 && (
              <div className="mb-3 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20 text-xs text-muted-foreground">
                Auto-generated from script analysis. Add a <code className="font-mono text-primary">maps/script-dependencies.md</code> file for manual dependency mapping.
              </div>
            )}
            <DependencyGraph graphNodes={graphData.nodes} graphEdges={graphData.edges} />
          </>
        ) : (
          <EmptyState
            title="No Dependencies"
            description="No dependency relationships found between scripts."
            icon={GitFork}
          />
        )}
      </TabsContent>

      {mapFiles.length > 0 && (
        <TabsContent value="raw">
          <div className="flex gap-4">
            <div className="w-56 shrink-0 space-y-1">
              {mapFiles.map((f) => (
                <button
                  key={f.path}
                  onClick={() => loadMapFile(f.path)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    selectedMap === f.path
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted text-muted-foreground'
                  }`}
                >
                  {f.name.replace('.md', '').replace(/-/g, ' ')}
                </button>
              ))}
            </div>
            <div className="flex-1 border rounded-lg p-6 overflow-y-auto">
              {loading ? (
                <ContentSkeleton />
              ) : mapContent ? (
                <MarkdownRenderer content={mapContent} enableTableParsing />
              ) : (
                <p className="text-sm text-muted-foreground">Select a map to view.</p>
              )}
            </div>
          </div>
        </TabsContent>
      )}
    </Tabs>
  );
}
