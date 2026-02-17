'use client';

import { useState, useEffect, useCallback } from 'react';
import { Module } from '@/types';
import { useRepo } from '@/hooks/use-repo';
import { useFileContent } from '@/hooks/use-file-content';
import { parseModuleCatalog } from '@/lib/markdown-parser';
import { ModuleCard } from './module-card';
import { ModuleDetail } from './module-detail';
import { SearchFilter } from '@/components/shared/search-filter';
import { EmptyState } from '@/components/shared/empty-state';
import { CardsSkeleton } from '@/components/shared/loading-skeleton';
import { Boxes } from 'lucide-react';

export function ModuleCatalog() {
  const { tree } = useRepo();
  const { fetchFile, loading: fileLoading } = useFileContent();
  const [modules, setModules] = useState<Partial<Module>[]>([]);
  const [search, setSearch] = useState('');
  const [selectedModule, setSelectedModule] = useState<Partial<Module> | null>(null);
  const [loaded, setLoaded] = useState(false);

  const loadModules = useCallback(async () => {
    const content = await fetchFile('modules/MODULE-CATALOG.md');
    if (content) {
      setModules(parseModuleCatalog(content));
    }
    setLoaded(true);
  }, [fetchFile]);

  useEffect(() => {
    if (tree.length > 0 && !loaded) {
      loadModules();
    }
  }, [tree, loaded, loadModules]);

  if (selectedModule) {
    return (
      <ModuleDetail
        module={selectedModule}
        onBack={() => setSelectedModule(null)}
      />
    );
  }

  if (fileLoading && !loaded) return <CardsSkeleton />;

  const filtered = modules.filter((m) =>
    !search ||
    (m.displayName || '').toLowerCase().includes(search.toLowerCase()) ||
    (m.purpose || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loaded && modules.length === 0) {
    return (
      <EmptyState
        title="No Modules Found"
        description="No MODULE-CATALOG.md found or no modules defined."
        icon={Boxes}
      />
    );
  }

  return (
    <div className="space-y-4">
      <SearchFilter onFilter={setSearch} placeholder="Search modules..." value={search} />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((m) => (
          <ModuleCard
            key={m.name}
            module={m}
            onClick={() => setSelectedModule(m)}
          />
        ))}
      </div>
    </div>
  );
}
