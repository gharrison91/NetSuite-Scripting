'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useRepo } from '@/hooks/use-repo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, RefreshCw, Loader2, GitBranch } from 'lucide-react';

export function Header() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const repoParam = searchParams.get('repo') || '';
  const branchParam = searchParams.get('branch') || 'main';
  const view = searchParams.get('view') || 'overview';
  const { refreshRepo, loading } = useRepo();

  const viewLabel: Record<string, string> = {
    overview: 'Overview',
    dashboards: 'Dashboards',
    modules: 'Modules',
    scripts: 'Scripts',
    reference: 'Reference',
    standards: 'Standards',
    maps: 'Maps',
    inbox: 'Inbox',
    'script-builder': 'Script Builder',
    settings: 'Settings',
  };

  return (
    <header className="h-14 border-b bg-card/80 backdrop-blur-sm flex items-center px-4 gap-3">
      <Button variant="ghost" size="icon" onClick={() => router.push('/')} className="h-8 w-8">
        <ArrowLeft className="h-4 w-4" />
      </Button>

      <div className="h-5 w-px bg-border" />

      <h1 className="font-semibold text-sm text-foreground">
        {viewLabel[view] || 'Dashboard'}
      </h1>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="font-mono text-xs gap-1.5 py-1">
          <GitBranch className="h-3 w-3" />
          {repoParam}
          <span className="text-muted-foreground">@</span>
          {branchParam}
        </Badge>

        <Button
          variant="ghost"
          size="icon"
          onClick={refreshRepo}
          disabled={loading}
          className="h-8 w-8"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </div>
    </header>
  );
}
