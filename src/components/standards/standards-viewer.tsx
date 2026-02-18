'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRepo } from '@/hooks/use-repo';
import { MarkdownRenderer } from '@/components/shared/markdown-renderer';
import { EmptyState } from '@/components/shared/empty-state';
import { ContentSkeleton } from '@/components/shared/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Ruler, RefreshCw, Loader2, FileText, Eye, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export function StandardsViewer() {
  const { tree, config, loading: repoLoading } = useRepo();
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'rendered' | 'raw'>('rendered');
  const [sidebarSearch, setSidebarSearch] = useState('');
  const hasAutoLoaded = useRef(false);

  const files = useMemo(() => {
    const stdDir = tree.find((n) => n.name === 'standards' && n.type === 'directory');
    if (!stdDir?.children) return [];
    return stdDir.children
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

  const formatFileName = (name: string) =>
    name.replace('.md', '').replace(/-/g, ' ');

  return (
    <div className="flex gap-4 h-[calc(100vh-8rem)]">
      {/* Sidebar */}
      <div className="w-60 shrink-0 border rounded-lg overflow-hidden flex flex-col bg-card">
        <div className="p-3 border-b bg-muted/30">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Standards
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
            viewMode === 'raw' ? (
              <pre className="text-sm whitespace-pre-wrap font-mono text-foreground leading-relaxed">
                {content}
              </pre>
            ) : (
              <MarkdownRenderer content={content} />
            )
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
