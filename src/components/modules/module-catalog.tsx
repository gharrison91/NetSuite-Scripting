'use client';

import { useState, useEffect, useCallback } from 'react';
import { Module } from '@/types';
import { useRepo } from '@/hooks/use-repo';
import { useFileContent } from '@/hooks/use-file-content';
import { parseModuleCatalog } from '@/lib/markdown-parser';
import { ModuleCard } from './module-card';
import { ModuleDetail } from './module-detail';
import { SearchFilter } from '@/components/shared/search-filter';
import { CardsSkeleton } from '@/components/shared/loading-skeleton';
import { Badge } from '@/components/ui/badge';
import { Info } from 'lucide-react';

/* Built-in SuiteScript module types shown when no MODULE-CATALOG.md exists */
const BUILTIN_MODULES: Partial<Module>[] = [
  {
    name: 'suitelet-form',
    displayName: 'Suitelet Form',
    purpose: 'Custom form with fields, sublists, and buttons. Used for data entry, lookup, and configuration pages.',
    currentVersion: 'N/A',
    status: 'Active',
    usedByDashboards: [],
  },
  {
    name: 'portlet-kpi',
    displayName: 'KPI Portlet',
    purpose: 'Dashboard portlet widget showing key performance indicators, counts, and summary statistics.',
    currentVersion: 'N/A',
    status: 'Active',
    usedByDashboards: [],
  },
  {
    name: 'portlet-list',
    displayName: 'List Portlet',
    purpose: 'Dashboard portlet displaying a table/list of records with clickable links. Great for recent activity or alerts.',
    currentVersion: 'N/A',
    status: 'Active',
    usedByDashboards: [],
  },
  {
    name: 'suitelet-search',
    displayName: 'Search Results Suitelet',
    purpose: 'Custom search form that displays filtered results in a table. Supports paging, sorting, and export.',
    currentVersion: 'N/A',
    status: 'Active',
    usedByDashboards: [],
  },
  {
    name: 'sublist-editor',
    displayName: 'Sublist/Line Item Editor',
    purpose: 'Module for adding, editing, and validating line items on transactions and custom records.',
    currentVersion: 'N/A',
    status: 'Active',
    usedByDashboards: [],
  },
  {
    name: 'restlet-api',
    displayName: 'RESTlet API Endpoint',
    purpose: 'REST API endpoint module for GET/POST/PUT/DELETE operations. Used for external integrations.',
    currentVersion: 'N/A',
    status: 'Active',
    usedByDashboards: [],
  },
  {
    name: 'field-validator',
    displayName: 'Field Validation Module',
    purpose: 'Reusable client-side validation module for field changes, mandatory checks, and format enforcement.',
    currentVersion: 'N/A',
    status: 'Active',
    usedByDashboards: [],
  },
  {
    name: 'email-template',
    displayName: 'Email Template Module',
    purpose: 'Module for rendering and sending formatted emails with merge fields, attachments, and CC/BCC.',
    currentVersion: 'N/A',
    status: 'Active',
    usedByDashboards: [],
  },
  {
    name: 'pdf-generator',
    displayName: 'PDF Generator',
    purpose: 'Module for generating PDF documents from records using BFO/FreeMarker templates. Invoices, reports, labels.',
    currentVersion: 'N/A',
    status: 'Active',
    usedByDashboards: [],
  },
];

export function ModuleCatalog() {
  const { tree } = useRepo();
  const { fetchFile, loading: fileLoading } = useFileContent();
  const [modules, setModules] = useState<Partial<Module>[]>([]);
  const [search, setSearch] = useState('');
  const [selectedModule, setSelectedModule] = useState<Partial<Module> | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [usingBuiltins, setUsingBuiltins] = useState(false);

  const loadModules = useCallback(async () => {
    const content = await fetchFile('modules/MODULE-CATALOG.md');
    if (content) {
      const parsed = parseModuleCatalog(content);
      if (parsed.length > 0) {
        setModules(parsed);
        setUsingBuiltins(false);
      } else {
        setModules(BUILTIN_MODULES);
        setUsingBuiltins(true);
      }
    } else {
      // No catalog found — show built-in module types
      setModules(BUILTIN_MODULES);
      setUsingBuiltins(true);
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
    (m.purpose || '').toLowerCase().includes(search.toLowerCase()) ||
    (m.name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SearchFilter onFilter={setSearch} placeholder="Search modules..." value={search} />
        <Badge variant="secondary" className="ml-3 shrink-0">
          {filtered.length} module{filtered.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {usingBuiltins && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs text-muted-foreground">
          <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <span className="font-medium text-foreground">Showing SuiteScript module templates.</span>{' '}
            To show your custom modules, create a <code className="bg-muted px-1 rounded">modules/MODULE-CATALOG.md</code> file
            with a table of your modules. Click any card to see a visual preview and copy the name for Script Builder.
          </div>
        </div>
      )}

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
