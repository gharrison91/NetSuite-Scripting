'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRepo } from '@/hooks/use-repo';
import { MarkdownRenderer } from '@/components/shared/markdown-renderer';
import { EmptyState } from '@/components/shared/empty-state';
import { ContentSkeleton } from '@/components/shared/loading-skeleton';
import { Button } from '@/components/ui/button';
import { BookOpen, RefreshCw, ExternalLink, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ReferenceViewer() {
  const { tree, config } = useRepo();
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [lastFetchUrl, setLastFetchUrl] = useState<string | null>(null);
  const [renderError, setRenderError] = useState(false);
  const autoLoaded = useRef(false);

  const files = useMemo(() => {
    const refDir = tree.find((n) => n.name === 'reference' && n.type === 'directory');
    if (!refDir?.children) return [];
    return refDir.children
      .filter((n) => n.type === 'file' && n.name.endsWith('.md'))
      .map((n) => ({ name: n.name, path: n.path }));
  }, [tree]);

  const loadFile = useCallback(
    async (path: string) => {
      if (!config) {
        setFileError('Repository config not loaded yet. Try refreshing the page.');
        return;
      }
      setSelectedFile(path);
      setContent(null);
      setFileError(null);
      setRenderError(false);
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

  // Auto-load first file once
  useEffect(() => {
    if (files.length > 0 && config && !autoLoaded.current) {
      autoLoaded.current = true;
      loadFile(files[0].path);
    }
  }, [files, config, loadFile]);

  if (files.length === 0) {
    return (
      <EmptyState
        title="No Reference Docs"
        description="No files found in the reference/ directory."
        icon={BookOpen}
      />
    );
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-8rem)]">
      <div className="w-56 shrink-0 border rounded-lg overflow-y-auto">
        <div className="p-2 space-y-0.5">
          {files.map((f) => (
            <button
              key={f.path}
              onClick={() => loadFile(f.path)}
              className={cn(
                'w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
                selectedFile === f.path
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted text-muted-foreground'
              )}
            >
              {f.name.replace('.md', '').replace(/-/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 border rounded-lg overflow-y-auto p-6">
        {loading ? (
          <ContentSkeleton />
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
          renderError ? (
            /* Fallback: show raw content if MarkdownRenderer crashes */
            <div>
              <div className="p-2 mb-3 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-600">
                Markdown rendering failed. Showing raw content.
              </div>
              <pre className="text-sm whitespace-pre-wrap font-mono">{content}</pre>
            </div>
          ) : (
            <MarkdownRendererSafe
              content={content}
              onError={() => setRenderError(true)}
            />
          )
        ) : (
          <p className="text-sm text-muted-foreground">Select a document to view.</p>
        )}
      </div>
    </div>
  );
}

/**
 * Wrapper that catches MarkdownRenderer errors and falls back to raw text.
 * Uses componentDidCatch via a class-based error boundary.
 */
import { Component, ReactNode } from 'react';

class MarkdownErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    console.error('[ReferenceViewer] Markdown render error:', error);
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

function MarkdownRendererSafe({
  content,
  onError,
}: {
  content: string;
  onError: () => void;
}) {
  return (
    <MarkdownErrorBoundary
      fallback={
        <div>
          <div className="p-2 mb-3 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-600">
            Markdown rendering failed. Showing raw content.
          </div>
          <pre className="text-sm whitespace-pre-wrap font-mono">{content}</pre>
        </div>
      }
    >
      <RenderWithErrorCallback content={content} onError={onError} />
    </MarkdownErrorBoundary>
  );
}

function RenderWithErrorCallback({
  content,
  onError: _onError,
}: {
  content: string;
  onError: () => void;
}) {
  return <MarkdownRenderer content={content} enableTableParsing />;
}
