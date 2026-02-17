interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > entry.ttl) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCache<T>(key: string, data: T, ttlMs: number): void {
  cache.set(key, { data, timestamp: Date.now(), ttl: ttlMs });
}

export function clearCache(): void {
  cache.clear();
}

export function clearCacheByPrefix(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
}

// TTL constants (in milliseconds)
export const CACHE_TTL = {
  TREE: 5 * 60 * 1000,      // 5 minutes
  FILE: 2 * 60 * 1000,      // 2 minutes
  BRANCHES: 10 * 60 * 1000, // 10 minutes
} as const;
