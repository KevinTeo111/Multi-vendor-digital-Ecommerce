'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from './api';

type Query = Record<string, string | number | boolean | undefined | null>;

/** Minimal client data hook: loads on mount / when the serialized query changes, exposes reload(). */
export function useFetch<T>(path: string | null, query?: Query) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const key = JSON.stringify(query ?? {});

  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    setError(null);
    try {
      setData(await api<T>(path, { query: JSON.parse(key) }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }, [path, key]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, loading, reload, setData };
}

/** Wraps a mutation with busy/error state. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async <R,>(fn: () => Promise<R>): Promise<R | undefined> => {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message ?? 'Action failed');
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);

  return { run, busy, error, setError };
}
