'use client';

import { useState, useMemo } from 'react';
import { useRepo } from '@/hooks/use-repo';
import { TreeNode, Script } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DashboardDetail } from './dashboard-detail';
import { EmptyState } from '@/components/shared/empty-state';
import { AppWindow, FileCode2, Boxes } from 'lucide-react';

export function DashboardList() {
  const { tree, scripts } = useRepo();
  const [selectedDashboard, setSelectedDashboard] = useState<string | null>(null);

  const dashboards = useMemo(() => {
    const dashDir = tree.find((n) => n.name === 'dashboards' && n.type === 'directory');
    if (!dashDir?.children) return [];

    return dashDir.children
      .filter((n) => n.type === 'directory' && n.name !== '_template')
      .map((n) => {
        const dashScripts = scripts.filter(
          (s) => s.location.type === 'dashboard' && s.location.parent === n.name && s.isLatest
        );
        return {
          name: n.name,
          displayName: n.name.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          scriptCount: dashScripts.length,
          readmePath: `dashboards/${n.name}/README.md`,
        };
      });
  }, [tree, scripts]);

  if (selectedDashboard) {
    return (
      <DashboardDetail
        dashboardName={selectedDashboard}
        onBack={() => setSelectedDashboard(null)}
      />
    );
  }

  if (dashboards.length === 0) {
    return (
      <EmptyState
        title="No Dashboards Found"
        description="No dashboard directories found in the repository."
        icon={AppWindow}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {dashboards.map((dash) => (
        <Card
          key={dash.name}
          className="cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => setSelectedDashboard(dash.name)}
        >
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center gap-2">
              <AppWindow className="h-4 w-4 text-green-500" />
              <CardTitle className="text-sm">{dash.displayName}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-2">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <FileCode2 className="h-3 w-3" />
                {dash.scriptCount} scripts
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
