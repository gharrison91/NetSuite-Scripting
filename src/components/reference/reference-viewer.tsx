'use client';

import { useState, useEffect, useMemo, useCallback, useRef, Component, ReactNode } from 'react';
import { useRepo } from '@/hooks/use-repo';
import { MarkdownRenderer } from '@/components/shared/markdown-renderer';
import { EmptyState } from '@/components/shared/empty-state';
import { ContentSkeleton } from '@/components/shared/loading-skeleton';
import { Button } from '@/components/ui/button';
import {
  BookOpen,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  Loader2,
  FileText,
  Eye,
  Table2,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type ViewMode = 'rendered' | 'raw';

export function ReferenceViewer() {
  const { tree, config, loading: repoLoading } = useRepo();
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [lastFetchUrl, setLastFetchUrl] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('rendered');
  const [enableTables, setEnableTables] = useState(true);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const hasAutoLoaded = useRef(false);

  const files = useMemo(() => {
    const refDir = tree.find((n) => n.name === 'reference' && n.type === 'directory');
    if (!refDir?.children) return [];
    return refDir.children
      .filter((n) => n.type === 'file' && n.name.endsWith('.md'))
      .map((n) => ({ name: n.name, path: n.path }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tree]);

  const filteredFiles = useMemo(() => {
    if (!sidebarSearch) return files;
    const term = sidebarSearch.toLowerCase();
    return files.filter((f) =>
      f.name.replace('.md', '').replace(/-/g, ' ').toLowerCase().includes(term)
    );
  }, [files, sidebarSearch]);

  const loadFile = useCallback(
    async (path: string) => {
      if (!config) {
        setFileError('Repository config not loaded yet. Try refreshing the page.');
        return;
      }
      setSelectedFile(path);
      setContent(null);
      setFileError(null);
      setLoading(true);

      const url = `/api/repo/file?owner=${config.owner}&repo=${config.repo}&branch=${config.branch}&path=${encodeURIComponent(path)}`;
      setLastFetchUrl(url);

      try {
        const res = await fetch(url);
        const responseText = await res.text();

        if (!res.ok) {
          let errorMsg = `HTTP ${res.status}`;
          try {
            const errData = JSON.parse(responseText);
            errorMsg = errData.error || errorMsg;
          } catch {
            errorMsg = responseText || errorMsg;
          }
          throw new Error(errorMsg);
        }

        let data;
        try {
          data = JSON.parse(responseText);
        } catch {
          throw new Error(`Invalid JSON response (${responseText.slice(0, 100)}...)`);
        }

        if (typeof data.content === 'string' && data.content.length > 0) {
          console.log('[ReferenceViewer] Content loaded:', path, `(${data.content.length} chars)`);
          setContent(data.content);
        } else {
          throw new Error(`File API returned no content (keys: ${Object.keys(data).join(', ')})`);
        }
      } catch (err) {
        console.error('[ReferenceViewer] Load error:', err, 'URL:', url);
        setFileError(err instanceof Error ? err.message : 'Failed to load file');
      } finally {
        setLoading(false);
      }
    },
    [config]
  );

  // Auto-load first file when ready
  useEffect(() => {
    if (files.length > 0 && config && !hasAutoLoaded.current) {
      hasAutoLoaded.current = true;
      loadFile(files[0].path);
    }
  }, [files, config, loadFile]);

  // Reset auto-load flag when component unmounts
  useEffect(() => {
    return () => {
      hasAutoLoaded.current = false;
    };
  }, []);

  if (repoLoading) {
    return <ContentSkeleton />;
  }

  if (files.length === 0) {
    return (
      <EmptyState
        title="No Reference Docs"
        description={
          tree.length === 0
            ? 'Repository tree is still loading...'
            : 'No markdown files found in the reference/ directory.'
        }
        icon={BookOpen}
      />
    );
  }

  const formatFileName = (name: string) =>
    name.replace('.md', '').replace(/-/g, ' ');

  return (
    <div className="flex gap-4 h-[calc(100vh-8rem)]">
      {/* Sidebar */}
      <div className="w-60 shrink-0 border rounded-lg overflow-hidden flex flex-col bg-card">
        <div className="p-3 border-b bg-muted/30">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Reference Docs
          </h3>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter..."
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              className="w-full pl-7 pr-2 py-1.5 text-xs rounded-md border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {filteredFiles.map((f) => (
            <button
              key={f.path}
              onClick={() => loadFile(f.path)}
              className={cn(
                'w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2',
                selectedFile === f.path
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'hover:bg-muted text-muted-foreground'
              )}
            >
              <FileText className="h-3.5 w-3.5 shrink-0" />
              <span className="capitalize truncate">{formatFileName(f.name)}</span>
            </button>
          ))}
        </div>
        <div className="p-2 border-t text-[10px] text-muted-foreground text-center">
          {files.length} document{files.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 border rounded-lg overflow-hidden flex flex-col bg-card">
        {/* Toolbar */}
        {content && !loading && !fileError && (
          <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/20">
            <span className="text-xs text-muted-foreground capitalize font-medium">
              {selectedFile ? formatFileName(selectedFile.split('/').pop() || '') : ''}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant={enableTables ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => setEnableTables(!enableTables)}
                title="Toggle interactive tables"
              >
                <Table2 className="h-3 w-3" />
                Tables
              </Button>
              <Button
                variant={viewMode === 'rendered' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => setViewMode('rendered')}
              >
                <Eye className="h-3 w-3" />
                Rendered
              </Button>
              <Button
                variant={viewMode === 'raw' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => setViewMode('raw')}
              >
                <FileText className="h-3 w-3" />
                Raw
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => selectedFile && loadFile(selectedFile)}
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading {selectedFile?.split('/').pop()}...
              </div>
              <ContentSkeleton />
            </div>
          ) : fileError ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <AlertTriangle className="h-8 w-8 text-destructive/60" />
              <div className="text-center space-y-1">
                <p className="text-sm font-medium text-destructive">Failed to load content</p>
                <p className="text-xs text-destructive/70 max-w-sm">{fileError}</p>
              </div>

              {lastFetchUrl && (
                <div className="text-[10px] text-muted-foreground bg-muted/50 p-3 rounded-lg font-mono max-w-lg break-all">
                  <p className="font-semibold mb-1">Debug info:</p>
                  <p>Config: {config?.owner}/{config?.repo}@{config?.branch}</p>
                  <p>File: {selectedFile}</p>
                  <p>API: {lastFetchUrl}</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectedFile && loadFile(selectedFile)}
                >
                  <RefreshCw className="h-3 w-3 mr-2" />
                  Retry
                </Button>
                {lastFetchUrl && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={lastFetchUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3 mr-2" />
                      Test API
                    </a>
                  </Button>
                )}
              </div>
            </div>
          ) : content ? (
            viewMode === 'raw' ? (
              <pre className="text-sm whitespace-pre-wrap font-mono text-foreground leading-relaxed">
                {content}
              </pre>
            ) : (
              <SafeMarkdown
                content={content}
                enableTableParsing={enableTables}
                key={`${selectedFile}-${enableTables}`}
              />
            )
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
              <BookOpen className="h-8 w-8 opacity-30" />
              <p className="text-sm">Select a document from the sidebar to view.</p>
              {files.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadFile(files[0].path)}
                >
                  Load {formatFileName(files[0].name)}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Safe markdown wrapper with error boundary + fallback               */
/* ------------------------------------------------------------------ */

function SafeMarkdown({
  content,
  enableTableParsing,
}: {
  content: string;
  enableTableParsing: boolean;
}) {
  const [hasCrashed, setHasCrashed] = useState(false);

  // Reset crash state when content or table parsing changes
  useEffect(() => {
    setHasCrashed(false);
  }, [content, enableTableParsing]);

  if (hasCrashed) {
    return (
      <div>
        <div className="p-2 mb-3 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-600 flex items-center gap-2">
          <AlertTriangle className="h-3 w-3" />
          Markdown rendering failed. Showing raw content.
        </div>
        <pre className="text-sm whitespace-pre-wrap font-mono text-foreground leading-relaxed">
          {content}
        </pre>
      </div>
    );
  }

  return (
    <MarkdownErrorBoundary
      onError={() => setHasCrashed(true)}
      resetKey={`${content.length}-${enableTableParsing}`}
    >
      <MarkdownRenderer content={content} enableTableParsing={enableTableParsing} />
    </MarkdownErrorBoundary>
  );
}

class MarkdownErrorBoundary extends Component<
  { children: ReactNode; onError: () => void; resetKey: string },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidUpdate(prevProps: { resetKey: string }) {
    // Reset error state when content changes
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  componentDidCatch(error: Error) {
    console.error('[ReferenceViewer] Markdown render error:', error);
    this.props.onError();
  }

  render() {
    if (this.state.hasError) {
      return null; // Parent SafeMarkdown handles fallback via onError
    }
    return this.props.children;
  }
}
