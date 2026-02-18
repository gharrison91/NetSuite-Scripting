'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Combobox, ComboboxOption } from '@/components/ui/combobox';
import { GitBranch, Loader2, AlertCircle, CheckCircle, User, Wifi, ChevronDown, ChevronUp, Zap } from 'lucide-react';

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
  const [repos, setRepos] = useState<ComboboxOption[]>([]);
  const [branchOptions, setBranchOptions] = useState<ComboboxOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [reposLoading, setReposLoading] = useState(false);
  const [branchLoading, setBranchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    hasExpectedStructure?: boolean;
    missingFolders?: string[];
  } | null>(null);
  const [recentRepos, setRecentRepos] = useState<RecentRepo[]>([]);
  const [ownerReady, setOwnerReady] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthOpen, setHealthOpen] = useState(false);
  const [healthResult, setHealthResult] = useState<{
    tokenPresent: boolean;
    tokenValid: boolean;
    authenticatedUser: string | null;
    tokenScopes: string[];
    rateLimit: { remaining: number; limit: number; resetAt: string } | null;
    repoAccess?: { canAccess: boolean; isPrivate: boolean; error?: string };
    contentAccess?: { canRead: boolean; error?: string };
  } | null>(null);

  // Load remembered username and recent repos from localStorage
  useEffect(() => {
    const storedOwner = localStorage.getItem('githubOwner');
    if (storedOwner) {
      setOwner(storedOwner);
    }
    const stored = localStorage.getItem('recentRepos');
    if (stored) {
      try {
        setRecentRepos(JSON.parse(stored));
      } catch {
        // ignore parse errors
      }
    }
    setOwnerReady(true);
  }, []);

  // Fetch repos when owner changes (debounced)
  const fetchRepos = useCallback(async (username: string) => {
    if (!username.trim()) {
      setRepos([]);
      return;
    }
    setReposLoading(true);
    try {
      const res = await fetch(`/api/repos?owner=${encodeURIComponent(username.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setRepos(
          data.repos.map((r: { name: string; description: string | null }) => ({
            value: r.name,
            label: r.name,
            description: r.description || undefined,
          }))
        );
      } else {
        setRepos([]);
      }
    } catch {
      setRepos([]);
    } finally {
      setReposLoading(false);
    }
  }, []);

  // Auto-fetch repos when owner value changes (debounced)
  useEffect(() => {
    if (!ownerReady) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!owner.trim()) {
      setRepos([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      fetchRepos(owner);
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [owner, ownerReady, fetchRepos]);

  // Save owner to localStorage when it changes meaningfully
  useEffect(() => {
    if (ownerReady && owner.trim()) {
      localStorage.setItem('githubOwner', owner.trim());
    }
  }, [owner, ownerReady]);

  const fetchBranches = useCallback(async (o: string, r: string) => {
    if (!o || !r) return;
    setBranchLoading(true);
    setBranchOptions([]);
    try {
      const res = await fetch(`/api/repo/branches?owner=${encodeURIComponent(o)}&repo=${encodeURIComponent(r)}`);
      if (res.ok) {
        const data = await res.json();
        const opts: ComboboxOption[] = data.branches.map((b: string) => ({
          value: b,
          label: b,
        }));
        setBranchOptions(opts);
        if (data.branches.length > 0 && !data.branches.includes(branch)) {
          setBranch(data.branches[0]);
        }
      }
    } catch {
      // ignore - will use default branch
    } finally {
      setBranchLoading(false);
    }
  }, [branch]);

  // When repo is selected, auto-fetch branches
  const handleRepoChange = (value: string) => {
    setRepo(value);
    if (owner && value) {
      fetchBranches(owner, value);
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
        `/api/repo/validate?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&branch=${encodeURIComponent(branch)}`
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
      localStorage.setItem('githubOwner', owner.trim());

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
    localStorage.setItem('githubOwner', recent.owner);
    fetchRepos(recent.owner);
    fetchBranches(recent.owner, recent.repo);
  };

  const handleTestConnection = async () => {
    setHealthLoading(true);
    setHealthOpen(true);
    setHealthResult(null);
    try {
      const params = new URLSearchParams();
      if (owner.trim()) params.set('owner', owner.trim());
      if (repo) params.set('repo', repo);
      const res = await fetch(`/api/health?${params.toString()}`);
      if (res.ok) {
        setHealthResult(await res.json());
      } else {
        setHealthResult({
          tokenPresent: false,
          tokenValid: false,
          authenticatedUser: null,
          tokenScopes: [],
          rateLimit: null,
        });
      }
    } catch {
      setHealthResult({
        tokenPresent: false,
        tokenValid: false,
        authenticatedUser: null,
        tokenScopes: [],
        rateLimit: null,
      });
    } finally {
      setHealthLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      {/* Gradient background accent */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-1/2 -right-1/4 h-[800px] w-[800px] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-1/3 -left-1/4 h-[600px] w-[600px] rounded-full bg-chart-2/5 blur-3xl" />
      </div>

      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-primary/10 mb-2">
            <Zap className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            NetSuite Dashboard Manager
          </h1>
          <p className="text-muted-foreground text-sm">
            Connect to a GitHub repository to visualize and manage your NetSuite codebase
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Select Repository</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">GitHub Owner / Org</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="e.g., gharrison91"
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Repository</label>
              <Combobox
                options={repos}
                value={repo}
                onValueChange={handleRepoChange}
                placeholder="Select a repository..."
                loading={reposLoading}
                disabled={!owner.trim()}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Branch</label>
              <Combobox
                options={branchOptions}
                value={branch}
                onValueChange={setBranch}
                placeholder="Select branch..."
                loading={branchLoading}
                disabled={!repo}
                icon={<GitBranch className="h-4 w-4" />}
              />
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

            <div className="border-t pt-3">
              <button
                onClick={healthOpen && healthResult ? () => setHealthOpen(!healthOpen) : handleTestConnection}
                disabled={healthLoading}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
              >
                {healthLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Wifi className="h-3 w-3" />
                )}
                <span>Test Connection</span>
                {healthResult && (
                  healthOpen ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />
                )}
              </button>

              {healthOpen && healthResult && (
                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    {healthResult.tokenPresent ? (
                      <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                    )}
                    <span>
                      {healthResult.tokenPresent
                        ? 'GitHub token is configured'
                        : 'GitHub token is missing — add GITHUB_TOKEN in Vercel env vars'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {healthResult.tokenValid ? (
                      <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                    )}
                    <span>
                      {healthResult.tokenValid
                        ? `Authenticated as ${healthResult.authenticatedUser}`
                        : 'Token is invalid or expired'}
                    </span>
                  </div>

                  {healthResult.tokenValid && (
                    <div className="flex items-center gap-2">
                      {healthResult.tokenScopes.length > 0 ? (
                        healthResult.tokenScopes.includes('repo') ? (
                          <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <AlertCircle className="h-3.5 w-3.5 text-yellow-500" />
                        )
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5 text-yellow-500" />
                      )}
                      <span>
                        {healthResult.tokenScopes.length > 0
                          ? `Scopes: ${healthResult.tokenScopes.join(', ')}${
                              !healthResult.tokenScopes.includes('repo')
                                ? ' (missing "repo" scope for private repos)'
                                : ''
                            }`
                          : 'No scopes detected (fine-grained token or limited permissions)'}
                      </span>
                    </div>
                  )}

                  {healthResult.rateLimit && (
                    <div className="flex items-center gap-2">
                      {healthResult.rateLimit.remaining > 100 ? (
                        <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5 text-yellow-500" />
                      )}
                      <span>
                        Rate limit: {healthResult.rateLimit.remaining}/{healthResult.rateLimit.limit} remaining
                      </span>
                    </div>
                  )}

                  {healthResult.repoAccess && (
                    <div className="flex items-center gap-2">
                      {healthResult.repoAccess.canAccess ? (
                        <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                      )}
                      <span>
                        {healthResult.repoAccess.canAccess
                          ? `Can access ${owner}/${repo}${healthResult.repoAccess.isPrivate ? ' (private)' : ''}`
                          : `Cannot access ${owner}/${repo}: ${healthResult.repoAccess.error}`}
                      </span>
                    </div>
                  )}

                  {healthResult.contentAccess && (
                    <div className="flex items-start gap-2">
                      {healthResult.contentAccess.canRead ? (
                        <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                      )}
                      <span>
                        {healthResult.contentAccess.canRead
                          ? 'Can read repository contents (files & folders)'
                          : healthResult.contentAccess.error}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
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
