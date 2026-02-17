'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useRepo } from '@/hooks/use-repo';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw, Loader2 } from 'lucide-react';

export function Header() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const repoParam = searchParams.get('repo') || '';
  const branchParam = searchParams.get('branch') || 'main';
  const { refreshRepo, loading } = useRepo();

  return (
    <header className="h-14 border-b bg-card flex items-center px-4 gap-4">
      <Button variant="ghost" size="icon" onClick={() => router.push('/')} className="h-8 w-8">
        <ArrowLeft className="h-4 w-4" />
      </Button>

      <h1 className="font-semibold text-sm hidden sm:block">NetSuite Dashboard Manager</h1>

      <div className="flex-1" />

      <span className="text-xs text-muted-foreground font-mono">
        {repoParam} @ {branchParam}
      </span>

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
    </header>
  );
}
