'use client';

import { useRepo } from '@/hooks/use-repo';
import { Card, CardContent } from '@/components/ui/card';
import { Boxes, FileCode2, AppWindow, Hash, Inbox, FileStack } from 'lucide-react';

const kpiConfig = [
  { key: 'moduleCount' as const, label: 'Modules', icon: Boxes, color: 'text-purple-500' },
  { key: 'scriptCount' as const, label: 'Scripts (Latest)', icon: FileCode2, color: 'text-blue-500' },
  { key: 'scriptAllVersionsCount' as const, label: 'All Versions', icon: FileStack, color: 'text-cyan-500' },
  { key: 'dashboardCount' as const, label: 'Dashboards', icon: AppWindow, color: 'text-green-500' },
  { key: 'fieldsTracked' as const, label: 'Fields Tracked', icon: Hash, color: 'text-orange-500' },
  { key: 'inboxCount' as const, label: 'Inbox Items', icon: Inbox, color: 'text-yellow-500' },
];

export function KpiCards() {
  const { stats } = useRepo();

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {kpiConfig.map((kpi) => {
        const Icon = kpi.icon;
        return (
          <Card key={kpi.key}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`h-4 w-4 ${kpi.color}`} />
                <span className="text-xs text-muted-foreground font-medium">{kpi.label}</span>
              </div>
              <p className="text-2xl font-bold">{stats[kpi.key]}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
