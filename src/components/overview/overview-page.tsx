'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRepo } from '@/hooks/use-repo';
import { useFileContent } from '@/hooks/use-file-content';
import { parseModuleCatalog } from '@/lib/markdown-parser';
import { KpiCards } from './kpi-cards';
import { ModuleCard } from '@/components/modules/module-card';
import { ScriptListItem } from '@/components/scripts/script-list-item';
import { ScriptDetail } from '@/components/scripts/script-detail';
import { AnalyzeButton } from '@/components/analysis/analyze-button';
import { KpiSkeleton } from '@/components/shared/loading-skeleton';
import { Module, Script } from '@/types';

export function OverviewPage() {
  const { scripts, loading, tree } = useRepo();
  const { fetchFile } = useFileContent();
  const [modules, setModules] = useState<Partial<Module>[]>([]);
  const [selectedScript, setSelectedScript] = useState<Script | null>(null);

  const loadModules = useCallback(async () => {
    const content = await fetchFile('modules/MODULE-CATALOG.md');
    if (content) {
      setModules(parseModuleCatalog(content));
    }
  }, [fetchFile]);

  useEffect(() => {
    if (tree.length > 0) {
      loadModules();
    }
  }, [tree, loadModules]);

  if (selectedScript) {
    return <ScriptDetail script={selectedScript} onBack={() => setSelectedScript(null)} />;
  }

  const latestScripts = scripts
    .filter((s) => s.isLatest)
    .slice(0, 10);

  return (
    <div className="space-y-6">
      {loading ? <KpiSkeleton /> : <KpiCards />}

      {modules.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3">Module Catalog</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {modules.slice(0, 6).map((m) => (
              <ModuleCard key={m.name} module={m} />
            ))}
          </div>
        </div>
      )}

      {latestScripts.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3">Scripts (Latest Versions)</h2>
          <div className="border rounded-lg divide-y">
            {latestScripts.map((script) => (
              <ScriptListItem
                key={script.path}
                script={script}
                onClick={() => setSelectedScript(script)}
              />
            ))}
          </div>
        </div>
      )}

      <AnalyzeButton />
    </div>
  );
}
