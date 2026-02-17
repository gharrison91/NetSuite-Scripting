'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GitBranch, Loader2, AlertCircle, CheckCircle } from 'lucide-react';

interface RecentRepo {
  owner: string;
  repo: string;
  branch: string;
  lastAccessed: string;
}

export function RepoSelector() {
  const router = useRouter();
  const [owner, setOwner] = useState('');
  const [repo, setRepo] = useState('');
  const [branch, setBranch] = useState('main');
  const [branches, setBranches] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [branchLoading, setBranchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    hasExpectedStructure?: boolean;
    missingFolders?: string[];
  } | null>(null);
  const [recentRepos, setRecentRepos] = useState<RecentRepo[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('recentRepos');
    if (stored) {
      try {
        setRecentRepos(JSON.parse(stored));
      } catch {
        // ignore parse errors
      }
    }
  }, []);

  const fetchBranches = async (o: string, r: string) => {
    if (!o || !r) return;
    setBranchLoading(true);
    try {
      const res = await fetch(`/api/repo/branches?owner=${o}&repo=${r}`);
      if (res.ok) {
        const data = await res.json();
        setBranches(data.branches);
        if (data.branches.length > 0 && !data.branches.includes(branch)) {
          setBranch(data.branches[0]);
        }
      }
    } catch {
      // ignore - will use default branch
    } finally {
      setBranchLoading(false);
    }
  };

  const handleRepoBlur = () => {
    if (owner && repo) {
      fetchBranches(owner, repo);
    }
  };

  const handleLoad = async () => {
    if (!owner || !repo) {
      setError('Please enter both owner and repository name');
      return;
    }

    setLoading(true);
    setError(null);
    setValidationResult(null);

    try {
      const res = await fetch(
        `/api/repo/validate?owner=${owner}&repo=${repo}&branch=${branch}`
      );
      const data = await res.json();

      if (!res.ok || !data.valid) {
        setError(data.error || 'Repository not found');
        setValidationResult({ valid: false });
        return;
      }

      setValidationResult(data);

      // Save to recent repos
      const recent: RecentRepo = {
        owner,
        repo,
        branch,
        lastAccessed: new Date().toISOString(),
      };
      const updated = [recent, ...recentRepos.filter(
        (r) => !(r.owner === owner && r.repo === repo)
      )].slice(0, 5);
      setRecentRepos(updated);
      localStorage.setItem('recentRepos', JSON.stringify(updated));

      // Navigate to dashboard
      router.push(`/dashboard?repo=${owner}/${repo}&branch=${branch}`);
    } catch {
      setError('Failed to connect to GitHub. Check your network or API token.');
    } finally {
      setLoading(false);
    }
  };

  const handleRecentClick = (recent: RecentRepo) => {
    setOwner(recent.owner);
    setRepo(recent.repo);
    setBranch(recent.branch);
    fetchBranches(recent.owner, recent.repo);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">NetSuite Dashboard Manager</h1>
          <p className="text-muted-foreground">
            Connect to a GitHub repository to visualize your NetSuite codebase
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Select Repository</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">GitHub Owner / Org</label>
              <Input
                placeholder="e.g., gharrison91"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                onBlur={handleRepoBlur}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Repository</label>
              <Input
                placeholder="e.g., NetSuite-Dashboards"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                onBlur={handleRepoBlur}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Branch</label>
              <Select value={branch} onValueChange={setBranch}>
                <SelectTrigger>
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-4 w-4" />
                    <SelectValue placeholder="Select branch" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {branchLoading ? (
                    <SelectItem value="loading" disabled>
                      Loading branches...
                    </SelectItem>
                  ) : branches.length > 0 ? (
                    branches.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value={branch}>{branch}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {validationResult?.valid && validationResult.hasExpectedStructure === false && (
              <div className="flex items-start gap-2 text-sm text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-md">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Non-standard repo structure</p>
                  <p className="text-xs mt-1">
                    Missing: {validationResult.missingFolders?.join(', ')}. Some features may not work.
                  </p>
                </div>
              </div>
            )}

            {validationResult?.valid && validationResult.hasExpectedStructure && (
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-3 rounded-md">
                <CheckCircle className="h-4 w-4" />
                Repository validated successfully
              </div>
            )}

            <Button onClick={handleLoad} disabled={loading} className="w-full" size="lg">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Load Repository
            </Button>
          </CardContent>
        </Card>

        {recentRepos.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Recent Repositories
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentRepos.map((r) => (
                <button
                  key={`${r.owner}/${r.repo}`}
                  onClick={() => handleRecentClick(r)}
                  className="w-full text-left p-2 rounded-md hover:bg-muted transition-colors text-sm"
                >
                  <span className="font-medium">
                    {r.owner}/{r.repo}
                  </span>
                  <span className="text-muted-foreground ml-2">({r.branch})</span>
                </button>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
