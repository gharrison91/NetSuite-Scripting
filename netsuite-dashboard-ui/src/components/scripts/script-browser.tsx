'use client';

import { useState, useMemo } from 'react';
import { useRepo } from '@/hooks/use-repo';
import { Script, ScriptType } from '@/types';
import { CollapsibleSection } from '@/components/shared/collapsible-section';
import { SearchFilter } from '@/components/shared/search-filter';
import { ScriptListItem } from './script-list-item';
import { ScriptDetail } from './script-detail';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { FileCode2 } from 'lucide-react';

const TYPE_LABELS: Record<ScriptType, string> = {
  client: 'Client Scripts',
  'user-event': 'User Event Scripts',
  scheduled: 'Scheduled Scripts',
  suitelet: 'Suitelets',
  restlet: 'RESTlets',
  'map-reduce': 'Map/Reduce',
  'workflow-action': 'Workflow Actions',
  unknown: 'Other Scripts',
};

export function ScriptBrowser() {
  const { scripts } = useRepo();
  const [search, setSearch] = useState('');
  const [showAllVersions, setShowAllVersions] = useState(false);
  const [selectedScript, setSelectedScript] = useState<Script | null>(null);

  const filteredScripts = useMemo(() => {
    let list = scripts;
    if (!showAllVersions) {
      list = list.filter((s) => s.isLatest);
    }
    if (search) {
      const term = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.filename.toLowerCase().includes(term) ||
          s.baseName.toLowerCase().includes(term) ||
          s.type.toLowerCase().includes(term)
      );
    }
    return list;
  }, [scripts, search, showAllVersions]);

  const grouped = useMemo(() => {
    const groups: Partial<Record<ScriptType, Script[]>> = {};
    for (const script of filteredScripts) {
      if (!groups[script.type]) groups[script.type] = [];
      groups[script.type]!.push(script);
    }
    return groups;
  }, [filteredScripts]);

  if (selectedScript) {
    return (
      <ScriptDetail
        script={selectedScript}
        onBack={() => setSelectedScript(null)}
      />
    );
  }

  if (scripts.length === 0) {
    return (
      <EmptyState
        title="No Scripts Found"
        description="No JavaScript files were found in this repository."
        icon={FileCode2}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <SearchFilter onFilter={setSearch} placeholder="Search scripts..." value={search} />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAllVersions(!showAllVersions)}
        >
          {showAllVersions ? 'Latest Only' : 'Show All Versions'}
        </Button>
      </div>

      <div className="space-y-3">
        {Object.entries(TYPE_LABELS).map(([type, label]) => {
          const typeScripts = grouped[type as ScriptType];
          if (!typeScripts || typeScripts.length === 0) return null;
          return (
            <CollapsibleSection
              key={type}
              title={label}
              count={typeScripts.length}
            >
              <div className="space-y-1">
                {typeScripts.map((script) => (
                  <ScriptListItem
                    key={script.path}
                    script={script}
                    onClick={() => setSelectedScript(script)}
                  />
                ))}
              </div>
            </CollapsibleSection>
          );
        })}
      </div>
    </div>
  );
}
