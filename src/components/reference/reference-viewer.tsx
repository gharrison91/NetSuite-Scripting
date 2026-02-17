'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRepo } from '@/hooks/use-repo';
import { useFileContent } from '@/hooks/use-file-content';
import { MarkdownRenderer } from '@/components/shared/markdown-renderer';
import { EmptyState } from '@/components/shared/empty-state';
import { ContentSkeleton } from '@/components/shared/loading-skeleton';
import { BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ReferenceViewer() {
  const { tree } = useRepo();
  const { fetchFile, loading } = useFileContent();
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);

  const files = useMemo(() => {
    const refDir = tree.find((n) => n.name === 'reference' && n.type === 'directory');
    if (!refDir?.children) return [];
    return refDir.children
      .filter((n) => n.type === 'file' && n.name.endsWith('.md'))
      .map((n) => ({ name: n.name, path: n.path }));
  }, [tree]);

  const loadFile = useCallback(
    async (path: string) => {
      setSelectedFile(path);
      const c = await fetchFile(path);
      if (c) setContent(c);
    },
    [fetchFile]
  );

  useEffect(() => {
    if (files.length > 0 && !selectedFile) {
      loadFile(files[0].path);
    }
  }, [files, selectedFile, loadFile]);

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
        ) : content ? (
          <MarkdownRenderer content={content} enableTableParsing />
        ) : (
          <p className="text-sm text-muted-foreground">Select a document to view.</p>
        )}
      </div>
    </div>
  );
}
