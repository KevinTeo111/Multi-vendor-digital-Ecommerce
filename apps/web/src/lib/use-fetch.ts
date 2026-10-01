'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from './api';
import type { Paginated } from './types';

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

  return {
    data,
    error,
    loading,
    reload,
    setData: setData as React.Dispatch<React.SetStateAction<T | null>>,
  };
}

/**
 * A paginated list with filters, for every list page. Empty filter values are left out of the
 * query, and changing a filter always goes back to page 1.
 *
 *   const list = usePagedList<Order>('/admin/orders', { status: '', search: '' });
 *   <Input value={list.filters.search} onChange={(e) => list.setFilter('search', e.target.value)} />
 *   <Pagination page={list.page} totalPages={list.data?.totalPages ?? 1} onChange={list.setPage} />
 */
export function usePagedList<Item, Response extends Paginated<Item> = Paginated<Item>>(
  path: string,
  initialFilters: Record<string, string> = {},
  pageSize = 25,
) {
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const query: Query = { page, pageSize };
  for (const [key, value] of Object.entries(filters)) if (value) query[key] = value;
  const list = useFetch<Response>(path, query);

  const setFilter = useCallback((key: string, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }, []);

  return { ...list, filters, setFilter, page, setPage };
}

/** Wraps a mutation with busy/error state. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async <R>(fn: () => Promise<R>): Promise<R | undefined> => {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : ((err as Error).message ?? 'Action failed'));
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);

  return { run, busy, error, setError };
}
