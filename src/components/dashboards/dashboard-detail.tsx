'use client';

import { useState, useEffect } from 'react';
import { useFileContent } from '@/hooks/use-file-content';
import { useRepo } from '@/hooks/use-repo';
import { MarkdownRenderer } from '@/components/shared/markdown-renderer';
import { ScriptListItem } from '@/components/scripts/script-list-item';
import { ScriptDetail } from '@/components/scripts/script-detail';
import { ContentSkeleton } from '@/components/shared/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Script } from '@/types';
import { ArrowLeft, AppWindow } from 'lucide-react';

interface DashboardDetailProps {
  dashboardName: string;
  onBack: () => void;
}

export function DashboardDetail({ dashboardName, onBack }: DashboardDetailProps) {
  const { fetchFile, loading } = useFileContent();
  const { scripts } = useRepo();
  const [readme, setReadme] = useState<string | null>(null);
  const [selectedScript, setSelectedScript] = useState<Script | null>(null);

  const dashScripts = scripts.filter(
    (s) => s.location.type === 'dashboard' && s.location.parent === dashboardName && s.isLatest
  );

  useEffect(() => {
    fetchFile(`dashboards/${dashboardName}/README.md`).then((content) => {
      if (content) setReadme(content);
    });
  }, [dashboardName, fetchFile]);

  if (selectedScript) {
    return <ScriptDetail script={selectedScript} onBack={() => setSelectedScript(null)} />;
  }

  const displayName = dashboardName.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <AppWindow className="h-5 w-5 text-green-500" />
        <h2 className="text-lg font-semibold">{displayName}</h2>
      </div>

      {loading ? (
        <ContentSkeleton />
      ) : readme ? (
        <MarkdownRenderer content={readme} enableTableParsing />
      ) : (
        <p className="text-sm text-muted-foreground">No README found for this dashboard.</p>
      )}

      {dashScripts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Scripts ({dashScripts.length})</h3>
          {dashScripts.map((script) => (
            <ScriptListItem
              key={script.path}
              script={script}
              onClick={() => setSelectedScript(script)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
