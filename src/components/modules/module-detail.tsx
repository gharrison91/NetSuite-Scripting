'use client';

import { useState, useEffect, useMemo } from 'react';
import { Module, TreeNode } from '@/types';
import { useRepo } from '@/hooks/use-repo';
import { useFileContent } from '@/hooks/use-file-content';
import { MarkdownRenderer } from '@/components/shared/markdown-renderer';
import { ContentSkeleton } from '@/components/shared/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/shared/status-badge';
import { ArrowLeft, Boxes, FileCode2, FileText, FolderOpen } from 'lucide-react';

interface ModuleDetailProps {
  module: Partial<Module>;
  onBack: () => void;
}

export function ModuleDetail({ module, onBack }: ModuleDetailProps) {
  const { tree } = useRepo();
  const { fetchFile, loading } = useFileContent();
  const [readme, setReadme] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [sourceCode, setSourceCode] = useState<string | null>(null);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [tried, setTried] = useState(false);

  // Find module directory in tree
  const moduleDir = useMemo(() => {
    const modulesRoot = tree.find((n) => n.name === 'modules' && n.type === 'directory');
    if (!modulesRoot?.children) return null;

    // Try exact name match first, then fuzzy
    const exact = modulesRoot.children.find(
      (n) => n.type === 'directory' && n.name === module.name
    );
    if (exact) return exact;

    // Try case-insensitive match
    const lower = (module.name || '').toLowerCase();
    return modulesRoot.children.find(
      (n) => n.type === 'directory' && n.name.toLowerCase() === lower
    ) || null;
  }, [tree, module.name]);

  // Get module files
  const moduleFiles = useMemo(() => {
    if (!moduleDir?.children) return [];
    return moduleDir.children.filter((n) => n.type === 'file');
  }, [moduleDir]);

  // Try loading README
  useEffect(() => {
    const paths = [
      module.readmePath,
      moduleDir ? `${moduleDir.path}/README.md` : null,
      `modules/${module.name}/README.md`,
    ].filter((p): p is string => p !== null && p !== undefined);

    let cancelled = false;

    async function tryPaths() {
      for (const path of paths) {
        if (cancelled) return;
        const content = await fetchFile(path);
        if (content && !cancelled) {
          setReadme(content);
          return;
        }
      }
      if (!cancelled) setTried(true);
    }

    tryPaths();
    return () => { cancelled = true; };
  }, [module, moduleDir, fetchFile]);

  const handleViewSource = async (file: TreeNode) => {
    setSelectedSource(file.path);
    setSourceLoading(true);
    const content = await fetchFile(file.path);
    if (content) setSourceCode(content);
    setSourceLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Boxes className="h-5 w-5 text-purple-500" />
        <h2 className="text-lg font-semibold">{module.displayName || module.name}</h2>
        {module.currentVersion && (
          <Badge variant="secondary">{module.currentVersion}</Badge>
        )}
        {module.status && <StatusBadge status={module.status} />}
      </div>

      {module.purpose && (
        <p className="text-sm text-muted-foreground">{module.purpose}</p>
      )}

      {loading && !tried ? (
        <ContentSkeleton />
      ) : readme ? (
        <MarkdownRenderer content={readme} enableTableParsing />
      ) : (
        <div className="space-y-4">
          {/* Module files browser */}
          {moduleFiles.length > 0 ? (
            <>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FolderOpen className="h-4 w-4" />
                <span>
                  No README found. Showing {moduleFiles.length} file{moduleFiles.length !== 1 ? 's' : ''} in{' '}
                  <code className="bg-muted px-1 rounded">{moduleDir?.path || `modules/${module.name}`}</code>
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {moduleFiles.map((file) => (
                  <Card
                    key={file.path}
                    className="cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => handleViewSource(file)}
                  >
                    <CardContent className="p-3 flex items-center gap-3">
                      {file.name.endsWith('.js') ? (
                        <FileCode2 className="h-4 w-4 text-amber-400" />
                      ) : (
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="flex-1 text-sm font-mono">{file.name}</span>
                      {file.size && (
                        <span className="text-xs text-muted-foreground">
                          {(file.size / 1024).toFixed(1)} KB
                        </span>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {selectedSource && (
                <Card>
                  <CardContent className="p-0">
                    <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
                      <FileCode2 className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-mono">{selectedSource.split('/').pop()}</span>
                    </div>
                    {sourceLoading ? (
                      <div className="p-6"><ContentSkeleton /></div>
                    ) : sourceCode ? (
                      <pre className="p-4 overflow-x-auto text-xs font-mono bg-muted/50 rounded-b-lg max-h-[500px] overflow-y-auto">
                        <code>{sourceCode}</code>
                      </pre>
                    ) : null}
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              No README or source files found for this module.
              The module directory <code className="bg-muted px-1 rounded">modules/{module.name}</code> may not exist.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
