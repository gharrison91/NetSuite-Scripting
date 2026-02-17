'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRepo } from '@/hooks/use-repo';
import { MarkdownRenderer } from '@/components/shared/markdown-renderer';
import { EmptyState } from '@/components/shared/empty-state';
import { ContentSkeleton } from '@/components/shared/loading-skeleton';
import { Button } from '@/components/ui/button';
import { BookOpen, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ReferenceViewer() {
  const { tree, config } = useRepo();
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const autoLoaded = useRef(false);

  const files = useMemo(() => {
    const refDir = tree.find((n) => n.name === 'reference' && n.type === 'directory');
    if (!refDir?.children) return [];
    return refDir.children
      .filter((n) => n.type === 'file' && n.name.endsWith('.md'))
      .map((n) => ({ name: n.name, path: n.path }));
  }, [tree]);

  // Direct fetch — bypasses useFileContent hook to avoid state bugs
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
        console.error('Reference file load error:', err);
        setFileError(err instanceof Error ? err.message : 'Failed to load file');
      } finally {
        setLoading(false);
      }
    },
    [config]
  );

  // Auto-load first file once when files and config are ready
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
          <MarkdownRenderer content={content} enableTableParsing />
        ) : (
          <p className="text-sm text-muted-foreground">Select a document to view.</p>
        )}
      </div>
    </div>
  );
}
