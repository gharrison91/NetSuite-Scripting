'use client';

import { useState, useCallback } from 'react';
import { useRepo } from './use-repo';

export function useFileContent() {
  const { config } = useRepo();
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFile = useCallback(
    async (path: string) => {
      if (!config) return;
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `/api/repo/file?owner=${config.owner}&repo=${config.repo}&branch=${config.branch}&path=${encodeURIComponent(path)}`
        );
        if (!res.ok) throw new Error('Failed to fetch file');
        const data = await res.json();
        setContent(data.content);
        return data.content;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch file');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [config]
  );

  return { content, loading, error, fetchFile };
}
