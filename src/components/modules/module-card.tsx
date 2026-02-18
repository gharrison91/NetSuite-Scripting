'use client';

import { useState } from 'react';
import { Module } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/status-badge';
import { Boxes, Copy, Check } from 'lucide-react';

interface ModuleCardProps {
  module: Partial<Module>;
  onClick?: () => void;
}

/* Mini HTML preview of what the module type looks like */
function ModulePreview({ module }: { module: Partial<Module> }) {
  const name = (module.name || '').toLowerCase();
  const purpose = (module.purpose || '').toLowerCase();

  // Determine what kind of preview to show based on module name/purpose
  const isPortlet = name.includes('portlet') || purpose.includes('portlet');
  const isSuitelet = name.includes('suitelet') || name.includes('form') || purpose.includes('suitelet') || purpose.includes('form');
  const isSearch = name.includes('search') || purpose.includes('search') || purpose.includes('list') || purpose.includes('results');
  const isSublist = name.includes('sublist') || purpose.includes('sublist') || purpose.includes('line item');

  if (isPortlet) {
    return (
      <div className="rounded border bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-2 text-[9px]">
        <div className="flex items-center justify-between mb-1.5 border-b pb-1">
          <span className="font-bold text-[10px] text-slate-700 dark:text-slate-300">{module.displayName || 'Portlet'}</span>
          <span className="text-slate-400">[ - ]</span>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-slate-500 dark:text-slate-400">
            <span>Open Orders</span><span className="font-mono text-blue-600 dark:text-blue-400">24</span>
          </div>
          <div className="flex justify-between text-slate-500 dark:text-slate-400">
            <span>Pending Invoices</span><span className="font-mono text-amber-600 dark:text-amber-400">12</span>
          </div>
          <div className="flex justify-between text-slate-500 dark:text-slate-400">
            <span>Overdue</span><span className="font-mono text-red-600 dark:text-red-400">3</span>
          </div>
        </div>
      </div>
    );
  }

  if (isSuitelet) {
    return (
      <div className="rounded border bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-2 text-[9px]">
        <div className="mb-1.5 border-b pb-1">
          <span className="font-bold text-[10px] text-slate-700 dark:text-slate-300">{module.displayName || 'Suitelet Form'}</span>
        </div>
        <div className="space-y-1.5">
          <div>
            <span className="text-slate-400">Customer *</span>
            <div className="mt-0.5 h-4 rounded border bg-white dark:bg-slate-700 px-1 flex items-center text-slate-500 dark:text-slate-400">Acme Corp</div>
          </div>
          <div>
            <span className="text-slate-400">Date Range</span>
            <div className="mt-0.5 h-4 rounded border bg-white dark:bg-slate-700 px-1 flex items-center text-slate-500 dark:text-slate-400">01/01 - 12/31</div>
          </div>
          <div className="flex gap-1 pt-1">
            <div className="h-4 px-2 rounded bg-blue-600 text-white flex items-center text-[8px]">Submit</div>
            <div className="h-4 px-2 rounded border text-slate-500 dark:text-slate-400 flex items-center text-[8px]">Cancel</div>
          </div>
        </div>
      </div>
    );
  }

  if (isSearch || isSublist) {
    return (
      <div className="rounded border bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-2 text-[9px]">
        <div className="mb-1.5 border-b pb-1">
          <span className="font-bold text-[10px] text-slate-700 dark:text-slate-300">{module.displayName || 'Search Results'}</span>
        </div>
        <div className="border rounded overflow-hidden">
          <div className="flex bg-slate-200 dark:bg-slate-700 text-[8px]">
            <span className="flex-1 px-1 py-0.5 font-semibold border-r text-slate-600 dark:text-slate-300">Name</span>
            <span className="w-12 px-1 py-0.5 font-semibold border-r text-slate-600 dark:text-slate-300 text-center">Qty</span>
            <span className="w-14 px-1 py-0.5 font-semibold text-slate-600 dark:text-slate-300 text-right">Amount</span>
          </div>
          {[['Widget A', '10', '$1,200'], ['Widget B', '5', '$800'], ['Service C', '1', '$2,500']].map(([n, q, a], i) => (
            <div key={i} className="flex border-t text-slate-500 dark:text-slate-400">
              <span className="flex-1 px-1 py-0.5 border-r truncate">{n}</span>
              <span className="w-12 px-1 py-0.5 border-r text-center">{q}</span>
              <span className="w-14 px-1 py-0.5 text-right font-mono">{a}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Generic module preview
  return (
    <div className="rounded border bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-2 text-[9px]">
      <div className="mb-1.5 border-b pb-1">
        <span className="font-bold text-[10px] text-slate-700 dark:text-slate-300">{module.displayName || 'Module'}</span>
      </div>
      <div className="space-y-1">
        <div className="h-3 rounded bg-slate-200 dark:bg-slate-700 w-3/4" />
        <div className="h-3 rounded bg-slate-200 dark:bg-slate-700 w-1/2" />
        <div className="flex gap-1 pt-1">
          <div className="h-3 w-3 rounded bg-blue-500/20 border border-blue-500/30" />
          <div className="h-3 w-3 rounded bg-emerald-500/20 border border-emerald-500/30" />
          <div className="h-3 w-3 rounded bg-amber-500/20 border border-amber-500/30" />
        </div>
      </div>
    </div>
  );
}

export function ModuleCard({ module, onClick }: ModuleCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = module.name || module.displayName || '';
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

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
          <div className="flex items-center gap-1">
            {module.status && <StatusBadge status={module.status} />}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 shrink-0"
              onClick={handleCopy}
              title="Copy module name for Script Builder"
            >
              {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-3">
        {/* Visual preview */}
        <ModulePreview module={module} />

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
