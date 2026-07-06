'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { List, Download } from 'lucide-react';
import Navbar from '@/components/Navbar';
import nextDynamic from 'next/dynamic';
import { useFilters } from '@/hooks/useFilters';
import FilterBar from '@/components/FilterBar';

const FlowTable = nextDynamic(() => import('@/components/FlowTable'), { ssr: false });

const DIRECTION_OPTIONS = [
  { label: 'All', value: '' },
  { label: 'Outbound', value: 'outbound' },
  { label: 'Inbound', value: 'inbound' },
  { label: 'Internal', value: 'internal' },
];

const MIN_BYTES_OPTIONS = [
  { label: 'Any size', value: '0' },
  { label: '> 1 KB', value: '1024' },
  { label: '> 10 KB', value: '10240' },
  { label: '> 100 KB', value: '102400' },
  { label: '> 1 MB', value: '1048576' },
];

function FlowLogContent() {
  const [flows, setFlows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState('100');
  const [direction, setDirection] = useState('');
  const [minBytes, setMinBytes] = useState('0');
  const [exporting, setExporting] = useState(false);
  const { interval, toApiParams, activeCount, ...filterRest } = useFilters('1h');
  const searchParams = useSearchParams();
  const eitherIp = searchParams.get('ip') || ''; // set when navigating from IP detail

  useEffect(() => {
    setLoading(true);
    const apiParams = toApiParams();
    const params = new URLSearchParams({ ...apiParams, limit });
    if (direction) params.set('direction', direction);
    if (minBytes !== '0') params.set('minBytes', minBytes);
    if (eitherIp) params.set('ip', eitherIp);

    fetch(`/api/flows/recent?${params}`)
      .then(r => r.json())
      .then(j => { if (j.success) setFlows(j.data); })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interval, filterRest.srcIp, filterRest.dstIp, filterRest.port, filterRest.protocol, filterRest.from, filterRest.to, limit, direction, minBytes, eitherIp]);

  async function handleExport() {
    setExporting(true);
    try {
      const apiParams = toApiParams();
      const params = new URLSearchParams({ ...apiParams, limit: '10000' });
      if (direction) params.set('direction', direction);
      if (minBytes !== '0') params.set('minBytes', minBytes);
      if (eitherIp) params.set('ip', eitherIp);
      const res = await fetch(`/api/flows/export?${params}`);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.headers.get('x-filename') || 'flows.csv';
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 pb-12">
      <Navbar />
      <main className="w-full px-4 sm:px-6 lg:px-8 2xl:px-12 mt-8 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <List className="w-6 h-6 text-blue-400" />
            <h1 className="text-2xl font-bold text-gray-100">Flow Log</h1>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting || flows.length === 0}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>

        <FilterBar
          filters={{ interval, ...filterRest }}
          setFilter={filterRest.setFilter}
          clearAll={filterRest.clearAll}
          activeCount={activeCount}
        />

        {/* Inline flow-specific filters */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Direction</span>
            <div className="flex gap-1">
              {DIRECTION_OPTIONS.map(({ label, value }) => (
                <button
                  key={value}
                  onClick={() => setDirection(value)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    direction === value
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800 border border-transparent'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-gray-500">Min size</span>
            <select
              value={minBytes}
              onChange={e => setMinBytes(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 px-2 py-1"
            >
              {MIN_BYTES_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <span className="text-xs text-gray-500">Display</span>
            <select
              value={limit}
              onChange={e => setLimit(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 px-2 py-1"
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
          {!loading && flows.length === 0 && <p className="text-gray-500 text-sm text-center py-8">No flows match the current filters</p>}
          {!loading && flows.length > 0 && <FlowTable flows={flows} showNetworkDirection />}
        </div>
      </main>
    </div>
  );
}

export default function FlowLogPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950" />}>
      <FlowLogContent />
    </Suspense>
  );
}
