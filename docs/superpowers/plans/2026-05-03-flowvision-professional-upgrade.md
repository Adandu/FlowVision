# FlowVision Professional Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform FlowVision from a homelab toy into a small-business-worthy network investigation tool by adding a global filter bar, deep IP detail tables, a time-comparison page, and CSV export throughout.

**Architecture:** Filter state lives in URL query params (via a `useFilters` hook), so every filtered view is bookmarkable. A shared `queryFilters.ts` utility converts filter params into safe ClickHouse SQL fragments, reused across all API routes. All new data panels are detail-first (exact numbers, all rows, no top-N caps) and export-ready.

**Tech Stack:** Next.js 16 App Router, ClickHouse (`@clickhouse/client`), Tailwind CSS, ECharts, Vitest (new — for utility unit tests), TypeScript.

---

## File Map

| Status | File | Purpose |
|--------|------|---------|
| CREATE | `web/src/lib/queryFilters.ts` | SQL-safe filter builder (time, IP, port, protocol) |
| CREATE | `web/src/hooks/useFilters.ts` | URL-persisted filter state hook |
| CREATE | `web/src/components/FilterBar.tsx` | Filter UI: time range, IP, port, protocol, chips |
| CREATE | `web/src/app/api/flows/export/route.ts` | CSV export — filtered flow rows, max 10k |
| CREATE | `web/src/app/api/ip/[ip]/export/route.ts` | CSV export — flows for one IP, max 10k |
| CREATE | `web/src/app/api/compare/route.ts` | Compare two time periods — bandwidth + top tables |
| CREATE | `web/src/app/compare/page.tsx` | Compare page — period pickers, chart, tables |
| CREATE | `web/tests/queryFilters.test.ts` | Unit tests for queryFilters utilities |
| MODIFY | `web/src/app/api/flows/route.ts` | Accept src/dst/port/proto filter params |
| MODIFY | `web/src/app/api/flows/recent/route.ts` | Accept interval + filter params |
| MODIFY | `web/src/app/api/ip/[ip]/route.ts` | Add protocol table, port table, remove peer LIMIT |
| MODIFY | `web/src/app/ip/[ip]/page.tsx` | Add protocol/port tables, export, FilterBar (time only) |
| MODIFY | `web/src/app/flow-log/page.tsx` | Add FilterBar, direction/minBytes filters, export |
| MODIFY | `web/src/app/page.tsx` | Replace interval selector with FilterBar |
| MODIFY | `web/src/components/Navbar.tsx` | Add Compare nav link |
| MODIFY | `web/package.json` | Add vitest dev dependency |

---

## Task 1: Vitest setup + `queryFilters` utility

**Files:**
- Modify: `web/package.json`
- Create: `web/vitest.config.ts`
- Create: `web/src/lib/queryFilters.ts`
- Create: `web/tests/queryFilters.test.ts`

- [ ] **Step 1: Install Vitest**

```bash
cd /mnt/sdb/AI/FlowVision/web && npm install --save-dev vitest
```

- [ ] **Step 2: Create vitest config**

Create `web/vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
});
```

- [ ] **Step 3: Add test script to package.json**

In `web/package.json`, add to `"scripts"`:
```json
"test": "vitest run"
```

- [ ] **Step 4: Write the failing tests**

Create `web/tests/queryFilters.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import {
  buildTimeFilter,
  buildIpFilter,
  buildProtocolFilter,
  buildPortFilter,
  combineFilters,
} from '@/lib/queryFilters';

describe('buildTimeFilter', () => {
  it('returns 1h filter for default', () => {
    expect(buildTimeFilter({ interval: '1h' })).toBe(
      'timestamp >= now() - INTERVAL 1 HOUR'
    );
  });
  it('returns 24h filter', () => {
    expect(buildTimeFilter({ interval: '24h' })).toBe(
      'timestamp >= now() - INTERVAL 24 HOUR'
    );
  });
  it('returns custom range when interval is custom', () => {
    expect(buildTimeFilter({ interval: 'custom', from: '2026-05-01T00:00:00', to: '2026-05-02T00:00:00' })).toBe(
      "timestamp >= '2026-05-01 00:00:00' AND timestamp <= '2026-05-02 00:00:00'"
    );
  });
  it('falls back to 1h when custom but no dates', () => {
    expect(buildTimeFilter({ interval: 'custom' })).toBe(
      'timestamp >= now() - INTERVAL 1 HOUR'
    );
  });
});

describe('buildIpFilter', () => {
  it('builds exact IP filter', () => {
    expect(buildIpFilter('src_ip', '192.168.1.1')).toBe("src_ip = '192.168.1.1'");
  });
  it('builds CIDR filter', () => {
    expect(buildIpFilter('dst_ip', '10.0.0.0/8')).toBe("isIPAddressInRange(dst_ip, '10.0.0.0/8')");
  });
  it('returns empty string for empty input', () => {
    expect(buildIpFilter('src_ip', '')).toBe('');
  });
  it('returns empty string for invalid input', () => {
    expect(buildIpFilter('src_ip', 'DROP TABLE flows')).toBe('');
  });
});

describe('buildProtocolFilter', () => {
  it('returns TCP filter', () => {
    expect(buildProtocolFilter('tcp')).toBe('protocol = 6');
  });
  it('returns UDP filter', () => {
    expect(buildProtocolFilter('udp')).toBe('protocol = 17');
  });
  it('returns ICMP filter', () => {
    expect(buildProtocolFilter('icmp')).toBe('protocol = 1');
  });
  it('returns empty string for any/empty', () => {
    expect(buildProtocolFilter('')).toBe('');
    expect(buildProtocolFilter('any')).toBe('');
  });
});

describe('buildPortFilter', () => {
  it('builds port filter for valid port', () => {
    expect(buildPortFilter('443')).toBe('dst_port = 443');
  });
  it('returns empty for empty string', () => {
    expect(buildPortFilter('')).toBe('');
  });
  it('returns empty for out-of-range port', () => {
    expect(buildPortFilter('99999')).toBe('');
  });
  it('returns empty for non-numeric input', () => {
    expect(buildPortFilter('abc')).toBe('');
  });
});

describe('combineFilters', () => {
  it('joins multiple conditions with AND', () => {
    expect(combineFilters('a = 1', 'b = 2')).toBe('a = 1 AND b = 2');
  });
  it('skips empty conditions', () => {
    expect(combineFilters('a = 1', '', 'c = 3')).toBe('a = 1 AND c = 3');
  });
  it('returns 1=1 when all empty', () => {
    expect(combineFilters('', '')).toBe('1=1');
  });
});
```

- [ ] **Step 5: Run tests — expect FAIL (module not found)**

```bash
cd /mnt/sdb/AI/FlowVision/web && npm test
```
Expected: `Cannot find module '@/lib/queryFilters'`

- [ ] **Step 6: Create `queryFilters.ts`**

Create `web/src/lib/queryFilters.ts`:
```typescript
export interface FilterParams {
  srcIp?: string;
  dstIp?: string;
  port?: string;
  protocol?: string;
  interval?: string;
  from?: string;
  to?: string;
}

const IP_RE = /^(\d{1,3}\.){3}\d{1,3}$/;
const CIDR_RE = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;

function sanitizeDatetime(dt: string): string {
  return dt.replace(/[^0-9T:\-.Z]/g, '').slice(0, 24);
}

export function buildTimeFilter(params: Pick<FilterParams, 'interval' | 'from' | 'to'>): string {
  const { interval = '1h', from, to } = params;
  if (interval === 'custom' && from && to) {
    const f = sanitizeDatetime(from).replace('T', ' ').slice(0, 19);
    const t = sanitizeDatetime(to).replace('T', ' ').slice(0, 19);
    return `timestamp >= '${f}' AND timestamp <= '${t}'`;
  }
  switch (interval) {
    case '1m':
    case 'Live': return 'timestamp >= now() - INTERVAL 1 MINUTE';
    case '10m': return 'timestamp >= now() - INTERVAL 10 MINUTE';
    case '24h': return 'timestamp >= now() - INTERVAL 24 HOUR';
    case '1w': return 'timestamp >= now() - INTERVAL 1 WEEK';
    case '1mo': return 'timestamp >= now() - INTERVAL 1 MONTH';
    default: return 'timestamp >= now() - INTERVAL 1 HOUR';
  }
}

export function buildIpFilter(field: 'src_ip' | 'dst_ip', ipOrCidr: string): string {
  if (!ipOrCidr.trim()) return '';
  const v = ipOrCidr.trim();
  if (CIDR_RE.test(v)) return `isIPAddressInRange(${field}, '${v}')`;
  if (IP_RE.test(v)) return `${field} = '${v}'`;
  return '';
}

export function buildProtocolFilter(protocol: string): string {
  switch (protocol.toLowerCase()) {
    case 'tcp': return 'protocol = 6';
    case 'udp': return 'protocol = 17';
    case 'icmp': return 'protocol = 1';
    default: return '';
  }
}

export function buildPortFilter(port: string): string {
  const n = parseInt(port, 10);
  if (!port || isNaN(n) || n < 0 || n > 65535) return '';
  return `dst_port = ${n}`;
}

export function combineFilters(...conditions: string[]): string {
  const active = conditions.filter(Boolean);
  return active.length > 0 ? active.join(' AND ') : '1=1';
}
```

- [ ] **Step 7: Run tests — expect PASS**

```bash
cd /mnt/sdb/AI/FlowVision/web && npm test
```
Expected: all 16 tests pass.

- [ ] **Step 8: Commit**

```bash
cd /mnt/sdb/AI/FlowVision && git add web/package.json web/vitest.config.ts web/src/lib/queryFilters.ts web/tests/queryFilters.test.ts && git commit -m "feat: add queryFilters utility with vitest unit tests"
```

---

## Task 2: `useFilters` hook

**Files:**
- Create: `web/src/hooks/useFilters.ts`

- [ ] **Step 1: Create the hook**

Create `web/src/hooks/useFilters.ts`:
```typescript
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
    const params = new URLSearchParams();
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
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
```

- [ ] **Step 2: Commit**

```bash
cd /mnt/sdb/AI/FlowVision && git add web/src/hooks/useFilters.ts && git commit -m "feat: add useFilters hook — URL-persisted filter state"
```

---

## Task 3: `FilterBar` component

**Files:**
- Create: `web/src/components/FilterBar.tsx`

- [ ] **Step 1: Create FilterBar**

Create `web/src/components/FilterBar.tsx`:
```typescript
'use client';

import { useState } from 'react';
import { Filter, X, ChevronDown, ChevronUp } from 'lucide-react';
import type { Filters } from '@/hooks/useFilters';

const INTERVALS = [
  { label: 'Live', value: 'Live' },
  { label: '10m', value: '10m' },
  { label: '1h', value: '1h' },
  { label: '24h', value: '24h' },
  { label: '1w', value: '1w' },
  { label: '1mo', value: '1mo' },
  { label: 'Custom', value: 'custom' },
];

const PROTOCOLS = [
  { label: 'Any', value: '' },
  { label: 'TCP', value: 'tcp' },
  { label: 'UDP', value: 'udp' },
  { label: 'ICMP', value: 'icmp' },
];

interface FilterBarProps {
  filters: Filters;
  setFilter: (key: keyof Filters, value: string) => void;
  clearAll: () => void;
  activeCount: number;
  showTimeOnly?: boolean;
}

export default function FilterBar({ filters, setFilter, clearAll, activeCount, showTimeOnly = false }: FilterBarProps) {
  const [expanded, setExpanded] = useState(false);

  const chip = (label: string, key: keyof Filters) => (
    <span key={key} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/15 border border-blue-500/30 text-blue-300 text-xs rounded-full">
      {label}
      <button onClick={() => setFilter(key, '')} className="hover:text-white transition-colors">
        <X className="w-3 h-3" />
      </button>
    </span>
  );

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 space-y-3">
      {/* Time range row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500 font-medium uppercase tracking-wider shrink-0">Range</span>
        <div className="flex gap-1 flex-wrap">
          {INTERVALS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setFilter('interval', value)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                filters.interval === value
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800 border border-transparent'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {!showTimeOnly && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium text-gray-400 hover:text-gray-200 hover:bg-gray-800 border border-gray-700 transition-all"
          >
            <Filter className="w-3 h-3" />
            Filters{activeCount > 0 ? ` (${activeCount})` : ''}
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        )}
      </div>

      {/* Custom datetime pickers */}
      {filters.interval === 'custom' && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">From</span>
            <input
              type="datetime-local"
              value={filters.from}
              onChange={e => setFilter('from', e.target.value)}
              className="px-2 py-1 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-200 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">To</span>
            <input
              type="datetime-local"
              value={filters.to}
              onChange={e => setFilter('to', e.target.value)}
              className="px-2 py-1 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-200 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      )}

      {/* Advanced filters (collapsible) */}
      {!showTimeOnly && expanded && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1 border-t border-gray-800">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Source IP / CIDR</label>
            <input
              value={filters.srcIp}
              onChange={e => setFilter('srcIp', e.target.value)}
              placeholder="10.0.0.1 or 10.0.0.0/8"
              className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Dest IP / CIDR</label>
            <input
              value={filters.dstIp}
              onChange={e => setFilter('dstIp', e.target.value)}
              placeholder="10.0.0.1 or 10.0.0.0/8"
              className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Port</label>
            <input
              value={filters.port}
              onChange={e => setFilter('port', e.target.value)}
              placeholder="443"
              type="number"
              min="0"
              max="65535"
              className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Protocol</label>
            <select
              value={filters.protocol}
              onChange={e => setFilter('protocol', e.target.value)}
              className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-200 focus:outline-none focus:border-blue-500"
            >
              {PROTOCOLS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Active chips */}
      {activeCount > 0 && !showTimeOnly && (
        <div className="flex items-center gap-2 flex-wrap">
          {filters.srcIp && chip(`src: ${filters.srcIp}`, 'srcIp')}
          {filters.dstIp && chip(`dst: ${filters.dstIp}`, 'dstIp')}
          {filters.port && chip(`port: ${filters.port}`, 'port')}
          {filters.protocol && chip(`proto: ${filters.protocol.toUpperCase()}`, 'protocol')}
          <button onClick={clearAll} className="text-xs text-gray-500 hover:text-red-400 transition-colors ml-1">
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /mnt/sdb/AI/FlowVision && git add web/src/components/FilterBar.tsx && git commit -m "feat: add FilterBar component with time range, IP/port/protocol filters"
```

---

## Task 4: Update `/api/flows` and `/api/flows/recent` to accept filter params

**Files:**
- Modify: `web/src/app/api/flows/route.ts`
- Modify: `web/src/app/api/flows/recent/route.ts`

- [ ] **Step 1: Update `/api/flows/route.ts`**

Replace the top of the GET function (everything before `const privateSrc`) with:

```typescript
import { NextResponse } from 'next/server';
import { clickhouse } from '@/lib/clickhouse';
import { applyAliases } from '@/lib/aliases';
import { getCurrentUser, obfuscateIp } from '@/lib/auth';
import { buildTimeFilter, buildIpFilter, buildProtocolFilter, buildPortFilter, combineFilters } from '@/lib/queryFilters';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const interval = searchParams.get('interval') || '1h';
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';
  const srcIp = searchParams.get('src') || '';
  const dstIp = searchParams.get('dst') || '';
  const port = searchParams.get('port') || '';
  const protocol = searchParams.get('proto') || '';

  const timeFilter = buildTimeFilter({ interval, from, to });
  const extraFilters = combineFilters(
    buildIpFilter('src_ip', srcIp),
    buildIpFilter('dst_ip', dstIp),
    buildPortFilter(port),
    buildProtocolFilter(protocol)
  );
  const whereClause = extraFilters === '1=1'
    ? timeFilter
    : `${timeFilter} AND ${extraFilters}`;
```

Then replace every occurrence of `WHERE ${timeFilter}` in the rest of the function with `WHERE ${whereClause}`.

The `intervalSeconds` variable is no longer needed — remove it from the switch/case block (it was only used for the time series fill step, which is already computed separately in the time series queries).

- [ ] **Step 2: Update `/api/flows/recent/route.ts`**

Replace the entire file:
```typescript
import { NextResponse } from 'next/server';
import { clickhouse } from '@/lib/clickhouse';
import { applyAliases } from '@/lib/aliases';
import { getCurrentUser, obfuscateIp } from '@/lib/auth';
import { buildTimeFilter, buildIpFilter, buildProtocolFilter, buildPortFilter, combineFilters } from '@/lib/queryFilters';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsedLimit = Number(searchParams.get('limit') || 100);
  const limit = Math.min(Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 100, 1), 500);
  const interval = searchParams.get('interval') || '24h';
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';
  const srcIp = searchParams.get('src') || '';
  const dstIp = searchParams.get('dst') || '';
  const port = searchParams.get('port') || '';
  const protocol = searchParams.get('proto') || '';
  const direction = searchParams.get('direction') || '';
  const minBytes = parseInt(searchParams.get('minBytes') || '0', 10) || 0;

  const timeFilter = buildTimeFilter({ interval, from, to });
  const extraFilters = combineFilters(
    buildIpFilter('src_ip', srcIp),
    buildIpFilter('dst_ip', dstIp),
    buildPortFilter(port),
    buildProtocolFilter(protocol)
  );
  const whereClause = extraFilters === '1=1'
    ? timeFilter
    : `${timeFilter} AND ${extraFilters}`;

  const privSrc = `match(src_ip, '^10\\\\.|^192\\\\.168\\\\.|^172\\\\.(1[6-9]|2[0-9]|3[01])\\\\.')`;
  const privDst = `match(dst_ip, '^10\\\\.|^192\\\\.168\\\\.|^172\\\\.(1[6-9]|2[0-9]|3[01])\\\\.')`;

  let dirFilter = '';
  if (direction === 'outbound') dirFilter = `${privSrc} AND NOT ${privDst}`;
  else if (direction === 'inbound') dirFilter = `NOT ${privSrc} AND ${privDst}`;
  else if (direction === 'internal') dirFilter = `${privSrc} AND ${privDst}`;

  const fullWhere = combineFilters(whereClause, dirFilter, minBytes > 0 ? `bytes >= ${minBytes}` : '');

  try {
    const rows = await clickhouse.query({
      query: `
        SELECT
          max(ts) as timestamp,
          src_ip, dst_ip, src_port, dst_port,
          multiIf(protocol = 6, 'TCP', protocol = 17, 'UDP', protocol = 1, 'ICMP', 'Other') AS protocol,
          SUM(bytes) as bytes,
          SUM(packets) as packets
        FROM (
          SELECT timestamp AS ts, src_ip, dst_ip, src_port, dst_port, protocol, bytes, packets
          FROM flows
          WHERE ${fullWhere}
        )
        GROUP BY src_ip, dst_ip, src_port, dst_port, protocol
        ORDER BY timestamp DESC
        LIMIT ${limit}
      `,
      format: 'JSONEachRow',
    }).then(r => r.json());

    const user = await getCurrentUser();
    const isGuest = !user;

    const allIps = new Set<string>();
    rows.forEach((r: any) => {
      if (r.src_ip) allIps.add(r.src_ip);
      if (r.dst_ip) allIps.add(r.dst_ip);
    });

    const { batchGeoIPLookup } = await import('@/lib/geoip');
    const geoDataMap = await batchGeoIPLookup(Array.from(allIps));

    rows.forEach((r: any) => {
      const srcGeo = geoDataMap[r.src_ip];
      if (srcGeo) r.src_asn = srcGeo.asn || srcGeo.isp;
      const dstGeo = geoDataMap[r.dst_ip];
      if (dstGeo) r.dst_asn = dstGeo.asn || dstGeo.isp;
    });

    if (isGuest) {
      rows.forEach((r: any) => {
        r.src_ip = obfuscateIp(r.src_ip);
        r.dst_ip = obfuscateIp(r.dst_ip);
      });
    } else {
      await applyAliases(rows);
    }

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error('Recent flows error:', error);
    return NextResponse.json({ success: false, error: 'Database query failed' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Verify build**

```bash
cd /mnt/sdb/AI/FlowVision/web && npm run build 2>&1 | tail -20
```
Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
cd /mnt/sdb/AI/FlowVision && git add web/src/app/api/flows/route.ts web/src/app/api/flows/recent/route.ts && git commit -m "feat: flows API accepts src/dst/port/proto/direction/minBytes filter params"
```

---

## Task 5: Update Dashboard to use FilterBar

**Files:**
- Modify: `web/src/app/page.tsx`

- [ ] **Step 1: Update imports and state**

At the top of `web/src/app/page.tsx`, add:
```typescript
import FilterBar from '@/components/FilterBar';
import { useFilters } from '@/hooks/useFilters';
```

Remove the `useState<IntervalType | 'Live'>` declaration and the `intervals` array. Replace with:
```typescript
const { interval, toApiParams, activeCount, ...filterRest } = useFilters('Live');
```

- [ ] **Step 2: Update the fetch to use filter params**

Replace:
```typescript
const queryInterval = interval === 'Live' ? '1m' : interval;
const [flowsRes, recentRes] = await Promise.all([
  fetch(`/api/flows?interval=${queryInterval}`),
  fetch('/api/flows/recent'),
]);
```
With:
```typescript
const apiParams = toApiParams();
const queryInterval = apiParams.interval === 'Live' ? '1m' : apiParams.interval;
const params = new URLSearchParams({ ...apiParams, interval: queryInterval });
const [flowsRes, recentRes] = await Promise.all([
  fetch(`/api/flows?${params}`),
  fetch(`/api/flows/recent?${params}`),
]);
```

- [ ] **Step 3: Replace the interval selector div with FilterBar**

Remove the existing `{/* Interval selector */}` block:
```tsx
<div className="flex space-x-2 justify-end">
  {intervals.map((int) => ( ... ))}
</div>
```

Replace with:
```tsx
<FilterBar
  filters={{ interval, ...filterRest } as any}
  setFilter={filterRest.setFilter}
  clearAll={filterRest.clearAll}
  activeCount={activeCount}
/>
```

- [ ] **Step 4: Update the Live interval timer to use `interval` from useFilters**

The `useEffect` currently depends on `[interval]`. It should now depend on the filter params. Replace `if (interval === 'Live')` with `if (interval === 'Live')` — no change needed since `interval` still comes from the hook.

- [ ] **Step 5: Verify build**

```bash
cd /mnt/sdb/AI/FlowVision/web && npm run build 2>&1 | tail -20
```

- [ ] **Step 6: Commit**

```bash
cd /mnt/sdb/AI/FlowVision && git add web/src/app/page.tsx && git commit -m "feat: dashboard uses FilterBar — global filter state in URL"
```

---

## Task 6: Flow Log page — FilterBar + direction/minBytes + export

**Files:**
- Create: `web/src/app/api/flows/export/route.ts`
- Modify: `web/src/app/flow-log/page.tsx`

- [ ] **Step 1: Create export route**

Create `web/src/app/api/flows/export/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { clickhouse } from '@/lib/clickhouse';
import { getCurrentUser } from '@/lib/auth';
import { buildTimeFilter, buildIpFilter, buildProtocolFilter, buildPortFilter, combineFilters } from '@/lib/queryFilters';

const MAX_ROWS = 10000;

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const interval = searchParams.get('interval') || '24h';
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';
  const srcIp = searchParams.get('src') || '';
  const dstIp = searchParams.get('dst') || '';
  const port = searchParams.get('port') || '';
  const protocol = searchParams.get('proto') || '';
  const direction = searchParams.get('direction') || '';
  const minBytes = parseInt(searchParams.get('minBytes') || '0', 10) || 0;

  const timeFilter = buildTimeFilter({ interval, from, to });
  const extraFilters = combineFilters(
    buildIpFilter('src_ip', srcIp),
    buildIpFilter('dst_ip', dstIp),
    buildPortFilter(port),
    buildProtocolFilter(protocol)
  );

  const privSrc = `match(src_ip, '^10\\\\.|^192\\\\.168\\\\.|^172\\\\.(1[6-9]|2[0-9]|3[01])\\\\.')`;
  const privDst = `match(dst_ip, '^10\\\\.|^192\\\\.168\\\\.|^172\\\\.(1[6-9]|2[0-9]|3[01])\\\\.')`;
  let dirFilter = '';
  if (direction === 'outbound') dirFilter = `${privSrc} AND NOT ${privDst}`;
  else if (direction === 'inbound') dirFilter = `NOT ${privSrc} AND ${privDst}`;
  else if (direction === 'internal') dirFilter = `${privSrc} AND ${privDst}`;

  const whereClause = combineFilters(
    timeFilter,
    extraFilters === '1=1' ? '' : extraFilters,
    dirFilter,
    minBytes > 0 ? `bytes >= ${minBytes}` : ''
  );

  try {
    const rows: any[] = await clickhouse.query({
      query: `
        SELECT
          formatDateTime(max(timestamp), '%Y-%m-%d %H:%i:%S') AS timestamp,
          src_ip, dst_ip,
          src_port, dst_port,
          multiIf(protocol = 6, 'TCP', protocol = 17, 'UDP', protocol = 1, 'ICMP', 'Other') AS protocol,
          SUM(bytes) AS bytes,
          SUM(packets) AS packets,
          multiIf(
            match(src_ip, '^10\\\\.|^192\\\\.168\\\\.|^172\\\\.(1[6-9]|2[0-9]|3[01]).') AND NOT match(dst_ip, '^10\\\\.|^192\\\\.168\\\\.|^172\\\\.(1[6-9]|2[0-9]|3[01]).'), 'outbound',
            NOT match(src_ip, '^10\\\\.|^192\\\\.168\\\\.|^172\\\\.(1[6-9]|2[0-9]|3[01]).') AND match(dst_ip, '^10\\\\.|^192\\\\.168\\\\.|^172\\\\.(1[6-9]|2[0-9]|3[01]).'), 'inbound',
            match(src_ip, '^10\\\\.|^192\\\\.168\\\\.|^172\\\\.(1[6-9]|2[0-9]|3[01]).') AND match(dst_ip, '^10\\\\.|^192\\\\.168\\\\.|^172\\\\.(1[6-9]|2[0-9]|3[01]).'), 'internal',
            'external'
          ) AS direction
        FROM flows
        WHERE ${whereClause}
        GROUP BY src_ip, dst_ip, src_port, dst_port, protocol
        ORDER BY max(timestamp) DESC
        LIMIT ${MAX_ROWS}
      `,
      format: 'JSONEachRow',
    }).then(r => r.json());

    const { applyAliases } = await import('@/lib/aliases');
    await applyAliases(rows);

    const header = 'timestamp,src_ip,src_port,dst_ip,dst_port,protocol,bytes,packets,direction\n';
    const csv = header + rows.map((r: any) =>
      [r.timestamp, r.src_ip, r.src_port, r.dst_ip, r.dst_port, r.protocol, r.bytes, r.packets, r.direction].join(',')
    ).join('\n');

    const date = new Date().toISOString().slice(0, 10);
    const filename = `${date}-flowvision-flows-${interval}.csv`;

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Update Flow Log page**

Replace `web/src/app/flow-log/page.tsx` entirely:
```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { List, Download } from 'lucide-react';
import Navbar from '@/components/Navbar';
import FilterBar from '@/components/FilterBar';
import { useFilters } from '@/hooks/useFilters';
import { useAuth } from '@/hooks/useAuth';
import dynamic from 'next/dynamic';

const FlowTable = dynamic(() => import('@/components/FlowTable'), { ssr: false });

const DIRECTIONS = [
  { label: 'Any', value: '' },
  { label: 'Outbound', value: 'outbound' },
  { label: 'Inbound', value: 'inbound' },
  { label: 'Internal', value: 'internal' },
];

export default function FlowLogPage() {
  const { interval, toApiParams, activeCount, ...filterRest } = useFilters('24h');
  const [flows, setFlows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState('100');
  const [direction, setDirection] = useState('');
  const [minBytes, setMinBytes] = useState('');
  const [totalRows, setTotalRows] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const isLoggedIn = useAuth();

  const fetchFlows = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      ...toApiParams(),
      limit,
      ...(direction && { direction }),
      ...(minBytes && { minBytes }),
    });
    fetch(`/api/flows/recent?${params}`)
      .then(r => r.json())
      .then(j => {
        if (j.success) {
          setFlows(j.data);
          setTotalRows(j.data.length);
        }
      })
      .finally(() => setLoading(false));
  }, [toApiParams, limit, direction, minBytes]);

  useEffect(() => { fetchFlows(); }, [fetchFlows]);

  const handleExport = async () => {
    setExporting(true);
    const params = new URLSearchParams({
      ...toApiParams(),
      ...(direction && { direction }),
      ...(minBytes && { minBytes }),
    });
    const res = await fetch(`/api/flows/export?${params}`);
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] ?? 'flows.csv';
      a.click();
      URL.revokeObjectURL(url);
    }
    setExporting(false);
  };

  return (
    <div className="min-h-screen bg-gray-950 pb-12">
      <Navbar />
      <main className="w-full px-4 sm:px-6 lg:px-8 2xl:px-12 mt-8 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <List className="w-6 h-6 text-blue-400" />
            <h1 className="text-2xl font-bold text-gray-100">Flow Log</h1>
          </div>
          {isLoggedIn && (
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 border border-gray-700 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {exporting ? 'Exporting…' : `Export CSV${totalRows ? ` (${Math.min(totalRows, 10000)} rows)` : ''}`}
            </button>
          )}
        </div>

        <FilterBar
          filters={{ interval, ...filterRest } as any}
          setFilter={filterRest.setFilter}
          clearAll={filterRest.clearAll}
          activeCount={activeCount}
        />

        {/* Flow-log-specific inline filters */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Direction</span>
            <select
              value={direction}
              onChange={e => setDirection(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5"
            >
              {DIRECTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Min bytes</span>
            <input
              type="number"
              value={minBytes}
              onChange={e => setMinBytes(e.target.value)}
              placeholder="e.g. 1048576"
              className="w-32 bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Display</span>
            <select
              value={limit}
              onChange={e => setLimit(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5"
            >
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="250">250</option>
              <option value="500">500</option>
            </select>
          </div>
        </div>

        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 backdrop-blur-sm shadow-xl">
          {loading && <p className="text-gray-500 text-sm animate-pulse text-center py-8">Loading flows…</p>}
          {!loading && <FlowTable flows={flows} isGuest={isLoggedIn === false} />}
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
cd /mnt/sdb/AI/FlowVision/web && npm run build 2>&1 | tail -20
```

- [ ] **Step 4: Commit**

```bash
cd /mnt/sdb/AI/FlowVision && git add web/src/app/flow-log/page.tsx web/src/app/api/flows/export/route.ts && git commit -m "feat: flow log — FilterBar, direction/minBytes filters, CSV export"
```

---

## Task 7: Update `/api/ip/[ip]` — protocol table, port table, remove peer cap

**Files:**
- Modify: `web/src/app/api/ip/[ip]/route.ts`

- [ ] **Step 1: Add protocol and port queries; remove peer LIMIT**

Replace the entire `web/src/app/api/ip/[ip]/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { clickhouse } from '@/lib/clickhouse';
import { applyAliases } from '@/lib/aliases';
import { getCurrentUser, obfuscateIp } from '@/lib/auth';
import { buildTimeFilter } from '@/lib/queryFilters';

export async function GET(req: Request, { params }: { params: Promise<{ ip: string }> }) {
  const { ip } = await params;
  const url = new URL(req.url);
  const interval = url.searchParams.get('interval') || '24h';
  const from = url.searchParams.get('from') || '';
  const to = url.searchParams.get('to') || '';

  const timeFilter = buildTimeFilter({ interval, from, to });
  const ipFilter = `(src_ip = {ip:String} OR dst_ip = {ip:String})`;

  // Determine time grouping for timeline charts
  let timeGroup = 'toStartOfHour(timestamp)';
  let fillFrom = 'toStartOfHour(now() - INTERVAL 24 HOUR)';
  let fillTo = 'toStartOfHour(now())';
  let fillStep = '3600';

  switch (interval) {
    case '1m':
      timeGroup = 'toStartOfInterval(timestamp, INTERVAL 1 SECOND)';
      fillFrom = 'toStartOfInterval(now() - INTERVAL 1 MINUTE, INTERVAL 1 SECOND)';
      fillTo = 'toStartOfInterval(now(), INTERVAL 1 SECOND)';
      fillStep = '1'; break;
    case '10m':
      timeGroup = 'toStartOfMinute(timestamp)';
      fillFrom = 'toStartOfMinute(now() - INTERVAL 10 MINUTE)';
      fillTo = 'toStartOfMinute(now())';
      fillStep = '60'; break;
    case '1h':
      timeGroup = 'toStartOfMinute(timestamp)';
      fillFrom = 'toStartOfMinute(now() - INTERVAL 1 HOUR)';
      fillTo = 'toStartOfMinute(now())';
      fillStep = '60'; break;
    case '7d': case '1w':
      fillFrom = 'toStartOfHour(now() - INTERVAL 7 DAY)';
      fillTo = 'toStartOfHour(now())'; break;
    case '30d': case '1mo':
      timeGroup = 'toStartOfDay(timestamp)';
      fillFrom = 'toStartOfDay(now() - INTERVAL 30 DAY)';
      fillTo = 'toStartOfDay(now())';
      fillStep = '86400'; break;
  }

  try {
    const [
      summaryRows,
      timelineAsSrcRows,
      timelineAsDstRows,
      topPeersAsSrcRows,
      topPeersAsDstRows,
      protocolRows,
      portRows,
      recentFlowsRows,
    ] = await Promise.all([
      // Summary
      clickhouse.query({
        query: `SELECT countIf(src_ip = {ip:String}) AS flows_as_src, countIf(dst_ip = {ip:String}) AS flows_as_dst, sumIf(bytes, src_ip = {ip:String}) AS bytes_sent, sumIf(bytes, dst_ip = {ip:String}) AS bytes_received, min(timestamp) AS first_seen, max(timestamp) AS last_seen FROM flows WHERE ${ipFilter} AND ${timeFilter}`,
        query_params: { ip }, format: 'JSONEachRow',
      }).then(r => r.json()),

      // Timeline as source
      clickhouse.query({
        query: `SELECT ${timeGroup} AS time, toUInt64(SUM(bytes)) AS bytes, round(bytes * 8 / ${fillStep}, 2) AS bits_per_second FROM flows WHERE src_ip = {ip:String} AND ${timeFilter} GROUP BY time ORDER BY time ASC WITH FILL FROM ${fillFrom} TO ${fillTo} STEP ${fillStep}`,
        query_params: { ip }, format: 'JSONEachRow',
      }).then(r => r.json()),

      // Timeline as destination
      clickhouse.query({
        query: `SELECT ${timeGroup} AS time, toUInt64(SUM(bytes)) AS bytes, round(bytes * 8 / ${fillStep}, 2) AS bits_per_second FROM flows WHERE dst_ip = {ip:String} AND ${timeFilter} GROUP BY time ORDER BY time ASC WITH FILL FROM ${fillFrom} TO ${fillTo} STEP ${fillStep}`,
        query_params: { ip }, format: 'JSONEachRow',
      }).then(r => r.json()),

      // All peers as source (no LIMIT)
      clickhouse.query({
        query: `SELECT dst_ip AS peer, SUM(bytes) AS total_bytes, count() AS flow_count FROM flows WHERE src_ip = {ip:String} AND ${timeFilter} GROUP BY peer ORDER BY total_bytes DESC`,
        query_params: { ip }, format: 'JSONEachRow',
      }).then(r => r.json()),

      // All peers as destination (no LIMIT)
      clickhouse.query({
        query: `SELECT src_ip AS peer, SUM(bytes) AS total_bytes, count() AS flow_count FROM flows WHERE dst_ip = {ip:String} AND ${timeFilter} GROUP BY peer ORDER BY total_bytes DESC`,
        query_params: { ip }, format: 'JSONEachRow',
      }).then(r => r.json()),

      // Traffic by protocol — all protocols, exact bytes/packets/flows
      clickhouse.query({
        query: `SELECT multiIf(protocol = 6, 'TCP', protocol = 17, 'UDP', protocol = 1, 'ICMP', 'Other') AS proto, SUM(bytes) AS total_bytes, SUM(packets) AS total_packets, count() AS flow_count FROM flows WHERE ${ipFilter} AND ${timeFilter} GROUP BY proto ORDER BY total_bytes DESC`,
        query_params: { ip }, format: 'JSONEachRow',
      }).then(r => r.json()),

      // Traffic by port — all ports, exact bytes/packets/flows
      clickhouse.query({
        query: `SELECT dst_port AS port, SUM(bytes) AS total_bytes, SUM(packets) AS total_packets, count() AS flow_count FROM flows WHERE ${ipFilter} AND ${timeFilter} GROUP BY port ORDER BY total_bytes DESC`,
        query_params: { ip }, format: 'JSONEachRow',
      }).then(r => r.json()),

      // Recent flows (last 100)
      clickhouse.query({
        query: `SELECT max(timestamp) as last_flow_time, src_ip, dst_ip, src_port, dst_port, multiIf(protocol = 6, 'TCP', protocol = 17, 'UDP', protocol = 1, 'ICMP', 'Other') AS protocol, SUM(bytes) as bytes, SUM(packets) as packets FROM flows WHERE ${ipFilter} AND ${timeFilter} GROUP BY src_ip, dst_ip, src_port, dst_port, protocol ORDER BY last_flow_time DESC LIMIT 100`,
        query_params: { ip }, format: 'JSONEachRow',
      }).then(r => r.json()),
    ]);

    const user = await getCurrentUser();

    if (!user) {
      topPeersAsSrcRows.forEach((r: any) => r.peer = obfuscateIp(r.peer));
      topPeersAsDstRows.forEach((r: any) => r.peer = obfuscateIp(r.peer));
      recentFlowsRows.forEach((r: any) => {
        r.timestamp = r.last_flow_time;
        r.src_ip = obfuscateIp(r.src_ip);
        r.dst_ip = obfuscateIp(r.dst_ip);
      });
    } else {
      await applyAliases(topPeersAsSrcRows);
      await applyAliases(topPeersAsDstRows);
      recentFlowsRows.forEach((r: any) => { r.timestamp = r.last_flow_time; });
      await applyAliases(recentFlowsRows);
    }

    // Enrich port rows with service names (done in response so no geoip needed)
    const { getAppName } = await import('@/lib/protocols');
    portRows.forEach((r: any) => {
      r.service_name = getAppName(Number(r.port));
    });

    return NextResponse.json({
      success: true,
      data: {
        requested_ip: user ? ip : obfuscateIp(ip),
        summary: summaryRows[0] || null,
        timelineAsSrc: timelineAsSrcRows,
        timelineAsDst: timelineAsDstRows,
        topPeersAsSrc: topPeersAsSrcRows,
        topPeersAsDst: topPeersAsDstRows,
        protocolBreakdown: protocolRows,
        portBreakdown: portRows,
        recentFlows: recentFlowsRows,
      }
    });
  } catch (error) {
    console.error('IP details error:', error);
    return NextResponse.json({ success: false, error: 'Database query failed' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify build**

```bash
cd /mnt/sdb/AI/FlowVision/web && npm run build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
cd /mnt/sdb/AI/FlowVision && git add web/src/app/api/ip/\[ip\]/route.ts && git commit -m "feat: IP detail API adds protocol/port breakdown tables, removes peer LIMIT"
```

---

## Task 8: IP Detail page — protocol/port tables, FilterBar, export button

**Files:**
- Modify: `web/src/app/ip/[ip]/page.tsx`
- Create: `web/src/app/api/ip/[ip]/export/route.ts`

- [ ] **Step 1: Create IP export route**

Create `web/src/app/api/ip/[ip]/export/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { clickhouse } from '@/lib/clickhouse';
import { applyAliases } from '@/lib/aliases';
import { getCurrentUser } from '@/lib/auth';
import { buildTimeFilter } from '@/lib/queryFilters';

export async function GET(req: Request, { params }: { params: Promise<{ ip: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { ip } = await params;
  const url = new URL(req.url);
  const interval = url.searchParams.get('interval') || '24h';
  const from = url.searchParams.get('from') || '';
  const to = url.searchParams.get('to') || '';
  const timeFilter = buildTimeFilter({ interval, from, to });

  try {
    const rows: any[] = await clickhouse.query({
      query: `
        SELECT
          formatDateTime(max(timestamp), '%Y-%m-%d %H:%i:%S') AS timestamp,
          src_ip, dst_ip, src_port, dst_port,
          multiIf(protocol = 6, 'TCP', protocol = 17, 'UDP', protocol = 1, 'ICMP', 'Other') AS protocol,
          SUM(bytes) AS bytes, SUM(packets) AS packets
        FROM flows
        WHERE (src_ip = {ip:String} OR dst_ip = {ip:String}) AND ${timeFilter}
        GROUP BY src_ip, dst_ip, src_port, dst_port, protocol
        ORDER BY max(timestamp) DESC
        LIMIT 10000
      `,
      query_params: { ip },
      format: 'JSONEachRow',
    }).then(r => r.json());

    await applyAliases(rows);

    const header = 'timestamp,src_ip,src_port,dst_ip,dst_port,protocol,bytes,packets\n';
    const csv = header + rows.map((r: any) =>
      [r.timestamp, r.src_ip, r.src_port, r.dst_ip, r.dst_port, r.protocol, r.bytes, r.packets].join(',')
    ).join('\n');

    const date = new Date().toISOString().slice(0, 10);
    const safeIp = ip.replace(/[^0-9.]/g, '_');
    const filename = `${date}-flowvision-ip-${safeIp}-${interval}.csv`;

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('IP export error:', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Add protocol/port tables and FilterBar to IP Detail page**

In `web/src/app/ip/[ip]/page.tsx`, add these imports at the top:
```typescript
import FilterBar from '@/components/FilterBar';
import { useFilters } from '@/hooks/useFilters';
import { Download, ExternalLink } from 'lucide-react';
import { formatBytes } from '@/lib/formatters';
```

Remove the `useState<IntervalType | 'Live'>` for interval and the `intervals` array. Replace with:
```typescript
const { interval, toApiParams, activeCount, ...filterRest } = useFilters('24h');
```

Replace the fetch call in `useEffect` from:
```typescript
const queryInterval = interval === 'Live' ? '1m' : interval;
fetch(`/api/ip/${ip}?interval=${queryInterval}`)
```
To:
```typescript
const apiParams = toApiParams();
const queryInterval = apiParams.interval === 'Live' ? '1m' : apiParams.interval;
const timeParams = new URLSearchParams({ interval: queryInterval, ...(apiParams.from && { from: apiParams.from }), ...(apiParams.to && { to: apiParams.to }) });
fetch(`/api/ip/${ip}?${timeParams}`)
```
And update the other fetch calls similarly (donuts, flow-diagram) to pass `timeParams`.

Replace the existing interval selector buttons block with:
```tsx
<FilterBar
  filters={{ interval, ...filterRest } as any}
  setFilter={filterRest.setFilter}
  clearAll={filterRest.clearAll}
  activeCount={activeCount}
  showTimeOnly
/>
```

After the existing `{/* 5. Recent Flows */}` section, add two new sections before it:

```tsx
{/* Protocol Breakdown Table */}
{data?.protocolBreakdown?.length > 0 && (
  <SectionCard title="Traffic by Protocol" icon={<ArrowLeftRight className="w-4 h-4 text-amber-400" />}>
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
            <th className="px-4 py-2 text-left">Protocol</th>
            <th className="px-4 py-2 text-right">Bytes</th>
            <th className="px-4 py-2 text-right">Packets</th>
            <th className="px-4 py-2 text-right">Flows</th>
            <th className="px-4 py-2 text-right">Details</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800/50">
          {data.protocolBreakdown.map((row: any) => (
            <tr key={row.proto} className="hover:bg-gray-800/30">
              <td className="px-4 py-2.5 font-medium text-gray-200">{row.proto}</td>
              <td className="px-4 py-2.5 text-right text-gray-300 font-mono text-xs">{formatBytes(Number(row.total_bytes))}</td>
              <td className="px-4 py-2.5 text-right text-gray-400 text-xs">{Number(row.total_packets).toLocaleString()}</td>
              <td className="px-4 py-2.5 text-right text-gray-400 text-xs">{Number(row.flow_count).toLocaleString()}</td>
              <td className="px-4 py-2.5 text-right">
                <a
                  href={`/flow-log?src=${ip}&proto=${row.proto.toLowerCase()}&interval=${interval}`}
                  className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 hover:underline"
                >
                  Flows <ExternalLink className="w-3 h-3" />
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </SectionCard>
)}

{/* Port Breakdown Table */}
{data?.portBreakdown?.length > 0 && (
  <SectionCard title="Traffic by Port" icon={<Server className="w-4 h-4 text-purple-400" />}>
    <div className="overflow-x-auto max-h-96">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-gray-900">
          <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
            <th className="px-4 py-2 text-left">Port</th>
            <th className="px-4 py-2 text-left">Service</th>
            <th className="px-4 py-2 text-right">Bytes</th>
            <th className="px-4 py-2 text-right">Packets</th>
            <th className="px-4 py-2 text-right">Flows</th>
            <th className="px-4 py-2 text-right">Details</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800/50">
          {data.portBreakdown.map((row: any) => (
            <tr key={row.port} className="hover:bg-gray-800/30">
              <td className="px-4 py-2.5 font-mono text-gray-300 text-xs">{row.port}</td>
              <td className="px-4 py-2.5 text-gray-400 text-xs">{row.service_name}</td>
              <td className="px-4 py-2.5 text-right text-gray-300 font-mono text-xs">{formatBytes(Number(row.total_bytes))}</td>
              <td className="px-4 py-2.5 text-right text-gray-400 text-xs">{Number(row.total_packets).toLocaleString()}</td>
              <td className="px-4 py-2.5 text-right text-gray-400 text-xs">{Number(row.flow_count).toLocaleString()}</td>
              <td className="px-4 py-2.5 text-right">
                <a
                  href={`/flow-log?src=${ip}&port=${row.port}&interval=${interval}`}
                  className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 hover:underline"
                >
                  Flows <ExternalLink className="w-3 h-3" />
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </SectionCard>
)}
```

Update the "Recent Flows" SectionCard to add an export button in `headerRight`:
```tsx
<SectionCard
  title="Recent Flows"
  icon={<Activity className="w-5 h-5 text-gray-400" />}
  headerRight={
    isLoggedIn && (
      <button
        onClick={async () => {
          const params = new URLSearchParams({ interval });
          const res = await fetch(`/api/ip/${ip}/export?${params}`);
          if (res.ok) {
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] ?? 'flows.csv';
            a.click();
            URL.revokeObjectURL(url);
          }
        }}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 border border-gray-700 text-gray-300 hover:text-white rounded-lg text-xs font-medium transition-colors"
      >
        <Download className="w-3.5 h-3.5" /> Export CSV
      </button>
    )
  }
>
```

- [ ] **Step 3: Verify build**

```bash
cd /mnt/sdb/AI/FlowVision/web && npm run build 2>&1 | tail -20
```

- [ ] **Step 4: Commit**

```bash
cd /mnt/sdb/AI/FlowVision && git add web/src/app/ip/\[ip\]/page.tsx web/src/app/api/ip/\[ip\]/export/route.ts && git commit -m "feat: IP detail page adds protocol/port tables, FilterBar, CSV export"
```

---

## Task 9: `/api/compare` route

**Files:**
- Create: `web/src/app/api/compare/route.ts`

- [ ] **Step 1: Create the compare API**

Create `web/src/app/api/compare/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { clickhouse } from '@/lib/clickhouse';
import { getCurrentUser } from '@/lib/auth';

interface PeriodParams {
  from: string;
  to: string;
}

async function queryPeriod(p: PeriodParams) {
  const timeFilter = `timestamp >= '${p.from.replace('T', ' ').slice(0, 19)}' AND timestamp <= '${p.to.replace('T', ' ').slice(0, 19)}'`;

  // Duration in seconds for bps calculation
  const durationSec = Math.max(1, (new Date(p.to).getTime() - new Date(p.from).getTime()) / 1000);

  // Determine bucket size: <=2h → minutes, <=2d → hours, else days
  let timeGroup: string;
  let fillStep: number;
  if (durationSec <= 7200) {
    timeGroup = 'toStartOfMinute(timestamp)'; fillStep = 60;
  } else if (durationSec <= 172800) {
    timeGroup = 'toStartOfHour(timestamp)'; fillStep = 3600;
  } else {
    timeGroup = 'toStartOfDay(timestamp)'; fillStep = 86400;
  }

  const [bandwidth, topDst, topSrc, topPorts, topProtos] = await Promise.all([
    clickhouse.query({
      query: `
        SELECT
          ${timeGroup} AS bucket,
          toUInt64(SUM(bytes)) AS total_bytes,
          round(total_bytes * 8 / ${fillStep}, 2) AS bps,
          toUInt64(sumIf(bytes, NOT match(src_ip, '^10\\\\.|^192\\\\.168\\\\.|^172\\\\.(1[6-9]|2[0-9]|3[01]).') OR match(dst_ip, '^10\\\\.|^192\\\\.168\\\\.|^172\\\\.(1[6-9]|2[0-9]|3[01]).'))) AS inbound_bytes,
          toUInt64(sumIf(bytes, match(src_ip, '^10\\\\.|^192\\\\.168\\\\.|^172\\\\.(1[6-9]|2[0-9]|3[01]).') AND NOT match(dst_ip, '^10\\\\.|^192\\\\.168\\\\.|^172\\\\.(1[6-9]|2[0-9]|3[01]).'))) AS outbound_bytes
        FROM flows WHERE ${timeFilter}
        GROUP BY bucket ORDER BY bucket ASC
      `,
      format: 'JSONEachRow',
    }).then(r => r.json()),

    clickhouse.query({
      query: `SELECT dst_ip AS ip, SUM(bytes) AS total_bytes FROM flows WHERE ${timeFilter} GROUP BY ip ORDER BY total_bytes DESC LIMIT 20`,
      format: 'JSONEachRow',
    }).then(r => r.json()),

    clickhouse.query({
      query: `SELECT src_ip AS ip, SUM(bytes) AS total_bytes FROM flows WHERE ${timeFilter} GROUP BY ip ORDER BY total_bytes DESC LIMIT 20`,
      format: 'JSONEachRow',
    }).then(r => r.json()),

    clickhouse.query({
      query: `SELECT dst_port AS port, SUM(bytes) AS total_bytes FROM flows WHERE ${timeFilter} GROUP BY port ORDER BY total_bytes DESC LIMIT 20`,
      format: 'JSONEachRow',
    }).then(r => r.json()),

    clickhouse.query({
      query: `SELECT multiIf(protocol = 6, 'TCP', protocol = 17, 'UDP', protocol = 1, 'ICMP', 'Other') AS proto, SUM(bytes) AS total_bytes FROM flows WHERE ${timeFilter} GROUP BY proto ORDER BY total_bytes DESC`,
      format: 'JSONEachRow',
    }).then(r => r.json()),
  ]);

  // Add relative seconds offset for chart alignment
  const periodStart = new Date(p.from).getTime();
  const bandwidthWithOffset = (bandwidth as any[]).map(b => ({
    ...b,
    relativeSeconds: Math.round((new Date(b.bucket).getTime() - periodStart) / 1000),
  }));

  return { bandwidth: bandwidthWithOffset, topDst, topSrc, topPorts, topProtos };
}

function sanitizeDt(dt: string): string {
  return dt.replace(/[^0-9T:\-.Z]/g, '').slice(0, 24);
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const fromA = sanitizeDt(searchParams.get('fromA') || '');
  const toA = sanitizeDt(searchParams.get('toA') || '');
  const fromB = sanitizeDt(searchParams.get('fromB') || '');
  const toB = sanitizeDt(searchParams.get('toB') || '');

  if (!fromA || !toA || !fromB || !toB) {
    return NextResponse.json({ error: 'fromA, toA, fromB, toB are required' }, { status: 400 });
  }

  try {
    const [periodA, periodB] = await Promise.all([
      queryPeriod({ from: fromA, to: toA }),
      queryPeriod({ from: fromB, to: toB }),
    ]);

    return NextResponse.json({ success: true, data: { periodA, periodB } });
  } catch (error) {
    console.error('Compare error:', error);
    return NextResponse.json({ success: false, error: 'Database query failed' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify build**

```bash
cd /mnt/sdb/AI/FlowVision/web && npm run build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
cd /mnt/sdb/AI/FlowVision && git add web/src/app/api/compare/route.ts && git commit -m "feat: add /api/compare route for two-period traffic comparison"
```

---

## Task 10: Compare page

**Files:**
- Create: `web/src/app/compare/page.tsx`

- [ ] **Step 1: Create the Compare page**

Create `web/src/app/compare/page.tsx`:
```typescript
'use client';

import { useState, useCallback } from 'react';
import Navbar from '@/components/Navbar';
import SectionCard from '@/components/SectionCard';
import dynamic from 'next/dynamic';
import { Download, GitCompareArrows, ArrowRightLeft } from 'lucide-react';
import { formatBytes } from '@/lib/formatters';

const BandwidthChart = dynamic(() => import('@/components/charts/BandwidthChart'), { ssr: false });

interface PeriodState {
  from: string;
  to: string;
}

type Preset = 'hour' | 'day' | 'week';

function getPresetDates(preset: Preset): { a: PeriodState; b: PeriodState } {
  const now = new Date();
  if (preset === 'hour') {
    const toA = new Date(now); toA.setMinutes(0, 0, 0);
    const fromA = new Date(toA); fromA.setHours(fromA.getHours() - 1);
    const toB = new Date(fromA);
    const fromB = new Date(toB); fromB.setHours(fromB.getHours() - 1);
    return { a: { from: fromA.toISOString().slice(0, 16), to: toA.toISOString().slice(0, 16) }, b: { from: fromB.toISOString().slice(0, 16), to: toB.toISOString().slice(0, 16) } };
  }
  if (preset === 'day') {
    const toA = new Date(now); toA.setHours(0, 0, 0, 0);
    const fromA = new Date(toA); fromA.setDate(fromA.getDate() - 1);
    const toB = new Date(fromA);
    const fromB = new Date(toB); fromB.setDate(fromB.getDate() - 1);
    return { a: { from: fromA.toISOString().slice(0, 16), to: toA.toISOString().slice(0, 16) }, b: { from: fromB.toISOString().slice(0, 16), to: toB.toISOString().slice(0, 16) } };
  }
  // week
  const toA = new Date(now); toA.setHours(0, 0, 0, 0); toA.setDate(toA.getDate() - toA.getDay());
  const fromA = new Date(toA); fromA.setDate(fromA.getDate() - 7);
  const toB = new Date(fromA);
  const fromB = new Date(toB); fromB.setDate(fromB.getDate() - 7);
  return { a: { from: fromA.toISOString().slice(0, 16), to: toA.toISOString().slice(0, 16) }, b: { from: fromB.toISOString().slice(0, 16), to: toB.toISOString().slice(0, 16) } };
}

function DeltaBadge({ a, b }: { a: number; b: number }) {
  if (!a && !b) return null;
  const pct = a === 0 ? 100 : Math.round(((b - a) / a) * 100);
  const color = b > a ? 'text-red-400' : b < a ? 'text-emerald-400' : 'text-gray-400';
  return <span className={`text-xs font-mono ${color}`}>{b > a ? '+' : ''}{pct}%</span>;
}

function CompareTable({ label, rowsA, rowsB, keyField, valueField, formatValue }: {
  label: string;
  rowsA: any[];
  rowsB: any[];
  keyField: string;
  valueField: string;
  formatValue: (v: number) => string;
}) {
  const allKeys = Array.from(new Set([...rowsA.map(r => r[keyField]), ...rowsB.map(r => r[keyField])]));
  const mapA = Object.fromEntries(rowsA.map(r => [r[keyField], Number(r[valueField])]));
  const mapB = Object.fromEntries(rowsB.map(r => [r[keyField], Number(r[valueField])]));
  const sorted = allKeys.sort((x, y) => (mapB[y] || 0) - (mapB[x] || 0));

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-300 mb-2">{label}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500 uppercase">
              <th className="px-3 py-1.5 text-left">{keyField}</th>
              <th className="px-3 py-1.5 text-right">Period A</th>
              <th className="px-3 py-1.5 text-right">Period B</th>
              <th className="px-3 py-1.5 text-right">Δ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/40">
            {sorted.map(key => {
              const va = mapA[key] || 0;
              const vb = mapB[key] || 0;
              const isNew = va === 0 && vb > 0;
              const isGone = va > 0 && vb === 0;
              return (
                <tr key={key} className={`hover:bg-gray-800/20 ${isNew ? 'bg-emerald-500/5' : isGone ? 'bg-red-500/5' : ''}`}>
                  <td className={`px-3 py-1.5 font-mono ${isNew ? 'text-emerald-400' : isGone ? 'text-red-400 line-through opacity-60' : 'text-gray-300'}`}>{key}</td>
                  <td className="px-3 py-1.5 text-right text-gray-400">{va ? formatValue(va) : '—'}</td>
                  <td className="px-3 py-1.5 text-right text-gray-300">{vb ? formatValue(vb) : '—'}</td>
                  <td className="px-3 py-1.5 text-right"><DeltaBadge a={va} b={vb} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ComparePage() {
  const [periodA, setPeriodA] = useState<PeriodState>({ from: '', to: '' });
  const [periodB, setPeriodB] = useState<PeriodState>({ from: '', to: '' });
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  const applyPreset = (preset: Preset) => {
    const { a, b } = getPresetDates(preset);
    setPeriodA(a);
    setPeriodB(b);
  };

  const runCompare = useCallback(async () => {
    if (!periodA.from || !periodA.to || !periodB.from || !periodB.to) {
      setError('Please fill in all date fields.');
      return;
    }
    setError('');
    setLoading(true);
    setData(null);
    try {
      const params = new URLSearchParams({
        fromA: periodA.from, toA: periodA.to,
        fromB: periodB.from, toB: periodB.to,
      });
      const res = await fetch(`/api/compare?${params}`);
      const json = await res.json();
      if (json.success) setData(json.data);
      else setError(json.error || 'Query failed');
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [periodA, periodB]);

  const handleExport = async () => {
    if (!data) return;
    setExporting(true);
    const rows: string[] = ['period,metric,key,value'];
    const append = (period: string, metric: string, key: string, value: number) => {
      rows.push(`${period},${metric},${key},${value}`);
    };
    data.periodA.topDst.forEach((r: any) => append('A', 'top_dst', r.ip, r.total_bytes));
    data.periodB.topDst.forEach((r: any) => append('B', 'top_dst', r.ip, r.total_bytes));
    data.periodA.topSrc.forEach((r: any) => append('A', 'top_src', r.ip, r.total_bytes));
    data.periodB.topSrc.forEach((r: any) => append('B', 'top_src', r.ip, r.total_bytes));
    data.periodA.topPorts.forEach((r: any) => append('A', 'top_ports', r.port, r.total_bytes));
    data.periodB.topPorts.forEach((r: any) => append('B', 'top_ports', r.port, r.total_bytes));
    data.periodA.topProtos.forEach((r: any) => append('A', 'top_protos', r.proto, r.total_bytes));
    data.periodB.topProtos.forEach((r: any) => append('B', 'top_protos', r.proto, r.total_bytes));
    const csv = rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const date = new Date().toISOString().slice(0, 10);
    a.download = `${date}-flowvision-compare-${periodA.from.slice(0, 10)}-vs-${periodB.from.slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  };

  const dtInput = (label: string, value: string, onChange: (v: string) => void) => (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input type="datetime-local" value={value} onChange={e => onChange(e.target.value)}
        className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-200 focus:outline-none focus:border-blue-500 w-full" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 pb-12">
      <Navbar />
      <main className="w-full px-4 sm:px-6 lg:px-8 2xl:px-12 mt-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
            <ArrowRightLeft className="w-6 h-6 text-blue-400" /> Compare Periods
          </h1>
          {data && (
            <button onClick={handleExport} disabled={exporting}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 border border-gray-700 text-gray-300 hover:text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
              <Download className="w-4 h-4" /> {exporting ? 'Exporting…' : 'Export CSV'}
            </button>
          )}
        </div>

        {/* Period pickers */}
        <SectionCard title="Time Periods" icon={<GitCompareArrows className="w-4 h-4 text-gray-400" />}>
          {/* Presets */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="text-xs text-gray-500">Presets:</span>
            {([['hour', 'This Hour vs Last Hour'], ['day', 'Today vs Yesterday'], ['week', 'This Week vs Last Week']] as [Preset, string][]).map(([p, label]) => (
              <button key={p} onClick={() => applyPreset(p)}
                className="px-3 py-1 text-xs font-medium text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors">
                {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Period A</p>
              <div className="grid grid-cols-2 gap-3">
                {dtInput('From', periodA.from, v => setPeriodA(p => ({ ...p, from: v })))}
                {dtInput('To', periodA.to, v => setPeriodA(p => ({ ...p, to: v })))}
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Period B</p>
              <div className="grid grid-cols-2 gap-3">
                {dtInput('From', periodB.from, v => setPeriodB(p => ({ ...p, from: v })))}
                {dtInput('To', periodB.to, v => setPeriodB(p => ({ ...p, to: v })))}
              </div>
            </div>
          </div>

          {error && <p className="text-red-400 text-xs mt-3">{error}</p>}

          <div className="mt-4">
            <button onClick={runCompare} disabled={loading}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
              {loading ? 'Comparing…' : 'Compare'}
            </button>
          </div>
        </SectionCard>

        {data && (
          <>
            {/* Bandwidth Chart */}
            <SectionCard title="Bandwidth — Period A vs Period B" icon={<ArrowRightLeft className="w-4 h-4 text-blue-400" />}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-blue-400 mb-2">Period A ({periodA.from.slice(0, 16)} → {periodA.to.slice(0, 16)})</p>
                  <BandwidthChart
                    data={data.periodA.bandwidth.map((b: any) => ({ time: b.bucket, total_bytes: Number(b.total_bytes), bits_per_second: Number(b.bps) }))}
                    timezone="UTC"
                    tzOffsetMinutes={0}
                    interval="custom"
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold text-emerald-400 mb-2">Period B ({periodB.from.slice(0, 16)} → {periodB.to.slice(0, 16)})</p>
                  <BandwidthChart
                    data={data.periodB.bandwidth.map((b: any) => ({ time: b.bucket, total_bytes: Number(b.total_bytes), bits_per_second: Number(b.bps) }))}
                    timezone="UTC"
                    tzOffsetMinutes={0}
                    interval="custom"
                  />
                </div>
              </div>
            </SectionCard>

            {/* Comparison tables */}
            <SectionCard title="Side-by-Side Comparison">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <CompareTable label="Top Destinations" rowsA={data.periodA.topDst} rowsB={data.periodB.topDst} keyField="ip" valueField="total_bytes" formatValue={formatBytes} />
                <CompareTable label="Top Sources" rowsA={data.periodA.topSrc} rowsB={data.periodB.topSrc} keyField="ip" valueField="total_bytes" formatValue={formatBytes} />
                <CompareTable label="Top Ports" rowsA={data.periodA.topPorts} rowsB={data.periodB.topPorts} keyField="port" valueField="total_bytes" formatValue={formatBytes} />
                <CompareTable label="Protocols" rowsA={data.periodA.topProtos} rowsB={data.periodB.topProtos} keyField="proto" valueField="total_bytes" formatValue={formatBytes} />
              </div>
            </SectionCard>
          </>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd /mnt/sdb/AI/FlowVision/web && npm run build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
cd /mnt/sdb/AI/FlowVision && git add web/src/app/compare/page.tsx && git commit -m "feat: add Compare page with period pickers, bandwidth chart, delta tables, CSV export"
```

---

## Task 11: Update Navbar — add Compare link

**Files:**
- Modify: `web/src/components/Navbar.tsx`

- [ ] **Step 1: Add Compare import and link**

In `web/src/components/Navbar.tsx`, add `GitCompareArrows` to the lucide-react import:
```typescript
import { Activity, Globe, ChevronDown, User, LogOut, Settings, LayoutDashboard, List, Bell, Network, Menu, X, GitCompareArrows } from 'lucide-react';
```

In the desktop nav links section, add after the Alerts link:
```tsx
<Link href="/compare" className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 transition-all">
  <GitCompareArrows className="w-4 h-4" /> Compare
</Link>
```

In the mobile nav section, add after the Alerts link:
```tsx
<Link href="/compare" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 transition-all">
  <GitCompareArrows className="w-5 h-5 text-gray-400" /> Compare
</Link>
```

- [ ] **Step 2: Verify build**

```bash
cd /mnt/sdb/AI/FlowVision/web && npm run build 2>&1 | tail -20
```
Expected: clean build, zero TypeScript errors.

- [ ] **Step 3: Run unit tests to confirm nothing broken**

```bash
cd /mnt/sdb/AI/FlowVision/web && npm test
```
Expected: all 16 queryFilters tests pass.

- [ ] **Step 4: Commit**

```bash
cd /mnt/sdb/AI/FlowVision && git add web/src/components/Navbar.tsx && git commit -m "feat: add Compare link to navbar"
```

---

## Task 12: Final version bump + CHANGELOG

**Files:**
- Modify: `web/src/components/Navbar.tsx` (version badge)
- Modify: `web/src/app/admin/page.tsx` (system info version)
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Bump version to 2.0.0**

In `web/src/components/Navbar.tsx`, change:
```tsx
<span className="...">v1.3.7</span>
```
To:
```tsx
<span className="...">v2.0.0</span>
```

In `web/src/app/admin/page.tsx`, change:
```tsx
<p className="text-gray-200 font-mono">1.3.7</p>
```
To:
```tsx
<p className="text-gray-200 font-mono">2.0.0</p>
```

- [ ] **Step 2: Add CHANGELOG entry**

Prepend to `CHANGELOG.md`:
```markdown
## [2.0.0] - 2026-05-03

### Added
- **Global Filter Bar**: Persistent filter bar on all data pages — filter by Source IP/CIDR, Destination IP/CIDR, Port, Protocol, and Time Range. Filter state is encoded in URL for bookmarkable/shareable views.
- **IP Detail — Traffic by Protocol table**: Full list of every protocol seen for the IP, with exact bytes, packets, and flow count. Each row links to the Flow Log pre-filtered.
- **IP Detail — Traffic by Port table**: Full list of every port seen for the IP (all ports, not top N), with service name resolution, exact bytes, packets, flow count. Each row links to the Flow Log pre-filtered.
- **IP Detail — CSV Export**: Export all flows for the selected IP and time range as a CSV file.
- **Flow Log — CSV Export**: Export filtered flow log as CSV (up to 10,000 rows). Filename encodes the date and interval.
- **Flow Log — Direction filter**: Filter flows by Inbound / Outbound / Internal traffic direction.
- **Flow Log — Minimum bytes filter**: Hide noise by setting a minimum bytes threshold.
- **Compare Page**: New `/compare` page — pick two time periods (with presets: This Hour vs Last Hour, Today vs Yesterday, This Week vs Last Week), view side-by-side bandwidth charts and comparison tables for destinations, sources, ports, and protocols. New entries highlighted green, disappeared entries highlighted red.
- **Compare — CSV Export**: Export comparison data as a CSV with both periods included.

### Changed
- IP Detail peer tables now return all peers (no 10-peer limit).
- Dashboard interval selector replaced by the unified FilterBar.
```

- [ ] **Step 3: Final build check**

```bash
cd /mnt/sdb/AI/FlowVision/web && npm run build 2>&1 | tail -20
```

- [ ] **Step 4: Commit**

```bash
cd /mnt/sdb/AI/FlowVision && git add web/src/components/Navbar.tsx web/src/app/admin/page.tsx CHANGELOG.md && git commit -m "chore: bump to v2.0.0, update CHANGELOG"
```

---

## Self-Review Against Spec

| Spec requirement | Task |
|-----------------|------|
| Global filter bar — src/dst IP, port, protocol, time range | Tasks 1–5 |
| Filter state in URL (bookmarkable) | Task 2 |
| Active filter chips, clear all | Task 3 |
| Existing interval selector merged into filter bar | Task 5 |
| IP Detail — bandwidth chart (inbound/outbound) | Already existed; preserved in Task 8 |
| IP Detail — traffic by protocol table, all rows, clickable | Tasks 7–8 |
| IP Detail — traffic by port table, all rows, clickable | Tasks 7–8 |
| IP Detail — top peers, all rows | Task 7 |
| IP Detail — flow log pre-filtered | Task 8 |
| IP Detail — export CSV | Task 8 |
| Flow Log — direction filter | Task 6 |
| Flow Log — min bytes filter | Task 6 |
| Flow Log — export CSV (10k cap, filename convention) | Task 6 |
| Compare page — period pickers + presets | Task 10 |
| Compare page — bandwidth chart (side-by-side) | Task 10 |
| Compare page — side-by-side tables with delta, green/red | Task 10 |
| Compare page — export CSV | Task 10 |
| Filename convention `yyyy-mm-dd-flowvision-*` | Tasks 6, 8, 10 |
| Compare navbar link | Task 11 |
