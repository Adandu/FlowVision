'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback } from 'react';

export interface Filters {
  srcIp: string;
  dstIp: string;
  port: string;
  protocol: string;
  interval: string;
  from: string;
  to: string;
}

const PARAM_MAP: Record<keyof Filters, string> = {
  srcIp: 'src',
  dstIp: 'dst',
  port: 'port',
  protocol: 'proto',
  interval: 'interval',
  from: 'from',
  to: 'to',
};

export function useFilters(defaultInterval = '1h') {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const get = (key: string, fallback = '') => searchParams.get(key) ?? fallback;

  const filters: Filters = {
    srcIp: get('src'),
    dstIp: get('dst'),
    port: get('port'),
    protocol: get('proto'),
    interval: get('interval', defaultInterval),
    from: get('from'),
    to: get('to'),
  };

  const applyUpdates = useCallback(
    (updates: Partial<Filters>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        const param = PARAM_MAP[k as keyof Filters];
        if (v) params.set(param, v);
        else params.delete(param);
      }
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const setFilter = useCallback(
    (key: keyof Filters, value: string) => applyUpdates({ [key]: value }),
    [applyUpdates]
  );

  const clearAll = useCallback(() => {
    router.push(pathname, { scroll: false });
  }, [router, pathname]);

  const toApiParams = useCallback((): Record<string, string> => {
    const p: Record<string, string> = { interval: filters.interval };
    if (filters.srcIp) p.src = filters.srcIp;
    if (filters.dstIp) p.dst = filters.dstIp;
    if (filters.port) p.port = filters.port;
    if (filters.protocol) p.proto = filters.protocol;
    if (filters.interval === 'custom') {
      if (filters.from) p.from = filters.from;
      if (filters.to) p.to = filters.to;
    }
    return p;
  }, [filters]);

  const activeCount = [filters.srcIp, filters.dstIp, filters.port, filters.protocol].filter(Boolean).length;

  return { ...filters, setFilter, setFilters: applyUpdates, clearAll, toApiParams, activeCount };
}
