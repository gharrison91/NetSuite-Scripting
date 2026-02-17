'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { RepoConfig, RepoStats, Script, TreeNode } from '@/types';
import { scanRepoTree } from '@/lib/repo-scanner';

interface RepoContextType {
  config: RepoConfig | null;
  setConfig: (config: RepoConfig) => void;
  tree: TreeNode[];
  scripts: Script[];
  stats: RepoStats;
  loading: boolean;
  error: string | null;
  loadRepo: (config: RepoConfig) => Promise<void>;
  refreshRepo: () => Promise<void>;
}

const defaultStats: RepoStats = {
  moduleCount: 0,
  scriptCount: 0,
  scriptAllVersionsCount: 0,
  dashboardCount: 0,
  fieldsTracked: 0,
  inboxCount: 0,
};

const RepoContext = createContext<RepoContextType>({
  config: null,
  setConfig: () => {},
  tree: [],
  scripts: [],
  stats: defaultStats,
  loading: false,
  error: null,
  loadRepo: async () => {},
  refreshRepo: async () => {},
});

export function RepoProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<RepoConfig | null>(null);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [stats, setStats] = useState<RepoStats>(defaultStats);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRepo = useCallback(async (repoConfig: RepoConfig) => {
    setLoading(true);
    setError(null);
    setConfig(repoConfig);

    try {
      const res = await fetch(
        `/api/repo/tree?owner=${repoConfig.owner}&repo=${repoConfig.repo}&branch=${repoConfig.branch}`
      );
      if (!res.ok) throw new Error('Failed to fetch repo tree');
      const data = await res.json();

      const result = scanRepoTree(data.tree);
      setTree(result.tree);
      setScripts(result.scripts);
      setStats(result.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load repository');
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshRepo = useCallback(async () => {
    if (config) {
      await loadRepo(config);
    }
  }, [config, loadRepo]);

  return (
    <RepoContext.Provider
      value={{ config, setConfig, tree, scripts, stats, loading, error, loadRepo, refreshRepo }}
    >
      {children}
    </RepoContext.Provider>
  );
}

export function useRepo() {
  return useContext(RepoContext);
}
