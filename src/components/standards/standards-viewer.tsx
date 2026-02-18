'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRepo } from '@/hooks/use-repo';
import { MarkdownRenderer } from '@/components/shared/markdown-renderer';
import { EmptyState } from '@/components/shared/empty-state';
import { ContentSkeleton } from '@/components/shared/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Ruler, RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function StandardsViewer() {
  const { tree, config, loading: repoLoading } = useRepo();
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const hasAutoLoaded = useRef(false);

  const files = useMemo(() => {
    const stdDir = tree.find((n) => n.name === 'standards' && n.type === 'directory');
    if (!stdDir?.children) return [];
    return stdDir.children
      .filter((n) => n.type === 'file' && n.name.endsWith('.md'))
      .map((n) => ({ name: n.name, path: n.path }));
  }, [tree]);

  const loadFile = useCallback(
    async (path: string) => {
      if (!config) return;
      setSelectedFile(path);
      setContent(null);
      setFileError(null);
      setLoading(true);

      try {
        const url = `/api/repo/file?owner=${config.owner}&repo=${config.repo}&branch=${config.branch}&path=${encodeURIComponent(path)}`;
        const res = await fetch(url);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        if (data.content) {
          setContent(data.content);
        } else {
          throw new Error('File returned empty content');
        }
      } catch (err) {
        console.error('Standards file load error:', err);
        setFileError(err instanceof Error ? err.message : 'Failed to load file');
      } finally {
        setLoading(false);
      }
    },
    [config]
  );

  useEffect(() => {
    if (files.length > 0 && config && !hasAutoLoaded.current) {
      hasAutoLoaded.current = true;
      loadFile(files[0].path);
    }
  }, [files, config, loadFile]);

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
        title="No Standards Docs"
        description={
          tree.length === 0
            ? 'Repository tree is still loading...'
            : 'No files found in the standards/ directory.'
        }
        icon={Ruler}
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
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading {selectedFile?.split('/').pop()}...
            </div>
            <ContentSkeleton />
          </div>
        ) : fileError ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <p className="text-sm text-destructive">{fileError}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => selectedFile && loadFile(selectedFile)}
            >
              <RefreshCw className="h-3 w-3 mr-2" />
              Retry
            </Button>
          </div>
        ) : content ? (
          <MarkdownRenderer content={content} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <Ruler className="h-8 w-8 opacity-30" />
            <p className="text-sm">Select a document from the sidebar to view.</p>
            {files.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadFile(files[0].path)}
              >
                Load {files[0].name.replace('.md', '').replace(/-/g, ' ')}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
