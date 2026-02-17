'use client';

import { Module } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/shared/status-badge';
import { Boxes } from 'lucide-react';

interface ModuleCardProps {
  module: Partial<Module>;
  onClick?: () => void;
}

export function ModuleCard({ module, onClick }: ModuleCardProps) {
  return (
    <Card
      className={onClick ? 'cursor-pointer hover:border-primary/50 transition-colors' : ''}
      onClick={onClick}
    >
      <CardHeader className="p-4 pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Boxes className="h-4 w-4 text-purple-500" />
            <CardTitle className="text-sm">{module.displayName || module.name}</CardTitle>
          </div>
          {module.status && <StatusBadge status={module.status} />}
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-2">
        {module.purpose && (
          <p className="text-xs text-muted-foreground line-clamp-2">{module.purpose}</p>
        )}
        <div className="flex items-center gap-2">
          {module.currentVersion && (
            <Badge variant="secondary" className="text-xs">
              {module.currentVersion}
            </Badge>
          )}
        </div>
        {module.usedByDashboards && module.usedByDashboards.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Used by:</p>
            <div className="flex flex-wrap gap-1">
              {module.usedByDashboards.map((d) => (
                <Badge key={d} variant="outline" className="text-xs">
                  {d}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
