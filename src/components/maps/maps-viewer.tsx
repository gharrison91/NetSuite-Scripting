'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRepo } from '@/hooks/use-repo';
import { useFileContent } from '@/hooks/use-file-content';
import { parseDependencies } from '@/lib/markdown-parser';
import { buildDependencyGraph } from '@/lib/graph-builder';
import { DependencyGraph } from './dependency-graph';
import { MarkdownRenderer } from '@/components/shared/markdown-renderer';
import { EmptyState } from '@/components/shared/empty-state';
import { ContentSkeleton } from '@/components/shared/loading-skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GitFork } from 'lucide-react';
import { GraphNode, GraphEdge } from '@/types';

export function MapsViewer() {
  const { tree, scripts } = useRepo();
  const { fetchFile, loading } = useFileContent();
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] } | null>(null);
  const [mapFiles, setMapFiles] = useState<{ name: string; path: string; content?: string }[]>([]);
  const [selectedMap, setSelectedMap] = useState<string | null>(null);
  const [mapContent, setMapContent] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

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

  const loadMapFile = async (path: string) => {
    setSelectedMap(path);
    const content = await fetchFile(path);
    if (content) setMapContent(content);
  };

  if (!loaded && loading) return <ContentSkeleton />;

  if (loaded && mapFiles.length === 0 && !graphData) {
    return (
      <EmptyState
        title="No Maps Found"
        description="No files found in the maps/ directory."
        icon={GitFork}
      />
    );
  }

  return (
    <Tabs defaultValue="graph" className="space-y-4">
      <TabsList>
        <TabsTrigger value="graph">Dependency Graph</TabsTrigger>
        <TabsTrigger value="raw">Raw Maps</TabsTrigger>
      </TabsList>

      <TabsContent value="graph" className="relative">
        {graphData && graphData.nodes.length > 0 ? (
          <DependencyGraph graphNodes={graphData.nodes} graphEdges={graphData.edges} />
        ) : (
          <EmptyState
            title="No Dependencies"
            description="No dependency data found in maps/script-dependencies.md"
            icon={GitFork}
          />
        )}
      </TabsContent>

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
    </Tabs>
  );
}
