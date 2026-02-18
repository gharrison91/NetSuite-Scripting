'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { RepoProvider, useRepo } from '@/hooks/use-repo';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { OverviewPage } from '@/components/overview/overview-page';
import { DashboardList } from '@/components/dashboards/dashboard-list';
import { ModuleCatalog } from '@/components/modules/module-catalog';
import { ScriptBrowser } from '@/components/scripts/script-browser';
import { ReferenceViewer } from '@/components/reference/reference-viewer';
import { StandardsViewer } from '@/components/standards/standards-viewer';
import { MapsViewer } from '@/components/maps/maps-viewer';
import { InboxList } from '@/components/inbox/inbox-list';
import { ScriptBuilder } from '@/components/script-builder/script-builder';
import { KpiSkeleton } from '@/components/shared/loading-skeleton';

function DashboardContent() {
  const searchParams = useSearchParams();
  const repoParam = searchParams.get('repo') || '';
  const branchParam = searchParams.get('branch') || 'main';
  const view = searchParams.get('view') || 'overview';
  const { loadRepo, loading, config } = useRepo();

  useEffect(() => {
    if (repoParam && !config) {
      const [owner, repo] = repoParam.split('/');
      if (owner && repo) {
        loadRepo({ owner, repo, branch: branchParam });
      }
    }
  }, [repoParam, branchParam, config, loadRepo]);

  const renderView = () => {
    if (loading) return <KpiSkeleton />;

    switch (view) {
      case 'overview':
        return <OverviewPage />;
      case 'dashboards':
        return <DashboardList />;
      case 'modules':
        return <ModuleCatalog />;
      case 'scripts':
        return <ScriptBrowser />;
      case 'reference':
        return <ReferenceViewer />;
      case 'standards':
        return <StandardsViewer />;
      case 'maps':
        return <MapsViewer />;
      case 'inbox':
        return <InboxList />;
      default:
        return <OverviewPage />;
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          {/* Script Builder stays mounted always — streaming continues
              even when viewing other pages */}
          <div className={view === 'script-builder' ? '' : 'hidden'}>
            <ScriptBuilder />
          </div>
          {view !== 'script-builder' && renderView()}
        </main>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <RepoProvider>
      <Suspense fallback={<KpiSkeleton />}>
        <DashboardContent />
      </Suspense>
    </RepoProvider>
  );
}
