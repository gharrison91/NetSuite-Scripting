'use client';

import { useState, useEffect } from 'react';
import { Module } from '@/types';
import { useFileContent } from '@/hooks/use-file-content';
import { MarkdownRenderer } from '@/components/shared/markdown-renderer';
import { ContentSkeleton } from '@/components/shared/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/shared/status-badge';
import { ArrowLeft, Boxes } from 'lucide-react';

interface ModuleDetailProps {
  module: Partial<Module>;
  onBack: () => void;
}

export function ModuleDetail({ module, onBack }: ModuleDetailProps) {
  const { fetchFile, loading } = useFileContent();
  const [readme, setReadme] = useState<string | null>(null);

  useEffect(() => {
    const readmePath = module.readmePath || `modules/${module.name}/README.md`;
    fetchFile(readmePath).then((content) => {
      if (content) setReadme(content);
    });
  }, [module, fetchFile]);

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

      {loading ? (
        <ContentSkeleton />
      ) : readme ? (
        <MarkdownRenderer content={readme} enableTableParsing />
      ) : (
        <p className="text-sm text-muted-foreground">No README found for this module.</p>
      )}
    </div>
  );
}
