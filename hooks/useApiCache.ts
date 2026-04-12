// hooks/useApiCache.ts — Simple TTL cache for API responses
// Avoids refetching data that hasn't changed on every tab focus / mount.
//
// Usage:
//   const { data, loading, refetch } = useApiCache('dashboard', () => api.dashboard.client(), 60);
//   const { data, loading, refetch } = useApiCache(`wallet:${user.id}`, fetchWallet, 45);

import { useCallback, useEffect, useRef, useState } from 'react';
import { devLog } from '@/lib/logger';

interface CacheEntry<T> {
  data: T;
  ts: number;
}

// Module-level cache — survives component unmount, cleared on app restart
const cache = new Map<string, CacheEntry<any>>();

/** Invalidate a specific cache key (e.g. after a mutation) */
export function invalidateCache(key: string) {
  cache.delete(key);
}

/** Invalidate all keys matching a prefix (e.g. "wallet" clears "wallet:xyz") */
export function invalidateCachePrefix(prefix: string) {
  for (const k of cache.keys()) {
    if (k.startsWith(prefix)) cache.delete(k);
  }
}

/** Clear entire cache */
export function clearAllCache() {
  cache.clear();
}

interface UseApiCacheResult<T> {
  data: T | null;
  loading: boolean;
  error: any;
  /** Force refetch, ignoring TTL */
  refetch: () => Promise<void>;
  /** True if data came from cache (not a fresh fetch) */
  fromCache: boolean;
}

/**
 * @param key     Unique cache key (e.g. "dashboard", "wallet:userId")
 * @param fetcher Async function that returns data
 * @param ttl     Cache TTL in seconds (default 60)
 */
export function useApiCache<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  ttl: number = 60,
): UseApiCacheResult<T> {
  const [data, setData] = useState<T | null>(() => {
    if (!key) return null;
    const entry = cache.get(key);
    return entry ? entry.data : null;
  });
  const [loading, setLoading] = useState(!data);
  const [error, setError] = useState<any>(null);
  const [fromCache, setFromCache] = useState(!!data);
  const mountedRef = useRef(true);

  // Keep the latest fetcher in a ref so inline arrow callers don't cause
  // doFetch / the effect below to be re-created on every render — which
  // would produce an infinite fetch loop.
  const fetcherRef = useRef(fetcher);
  useEffect(() => { fetcherRef.current = fetcher; });

  const doFetch = useCallback(async (force = false) => {
    if (!key) return;

    // Check TTL
    if (!force) {
      const entry = cache.get(key);
      if (entry && Date.now() - entry.ts < ttl * 1000) {
        if (mountedRef.current) {
          setData(entry.data);
          setFromCache(true);
          setLoading(false);
        }
        return;
      }
    }

    if (mountedRef.current) setLoading(true);
    try {
      const result = await fetcherRef.current();
      cache.set(key, { data: result, ts: Date.now() });
      if (mountedRef.current) {
        setData(result);
        setFromCache(false);
        setError(null);
      }
    } catch (e) {
      if (mountedRef.current) setError(e);
      // On error, serve stale cache if available
      const stale = cache.get(key);
      if (stale && mountedRef.current) {
        setData(stale.data);
        setFromCache(true);
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [key, ttl]);

  useEffect(() => {
    mountedRef.current = true;
    doFetch();
    return () => { mountedRef.current = false; };
  }, [doFetch]);

  const refetch = useCallback(() => doFetch(true), [doFetch]);

  return { data, loading, error, refetch, fromCache };
}
