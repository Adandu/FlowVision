'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useState } from 'react';
import Navbar from '@/components/Navbar';
import { GitCompare, Download, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import nextDynamic from 'next/dynamic';
import { formatBytes } from '@/lib/formatters';

const BandwidthBar = nextDynamic(() => import('@/components/charts/CompareBandwidthBar'), { ssr: false });

interface PeriodSummary {
  total_bytes: string;
  total_flows: string;
  unique_src: string;
  unique_dst: string;
  outbound_bytes: string;
  inbound_bytes: string;
  internal_bytes: string;
}

interface PeriodData {
  summary: PeriodSummary;
  topDestinations: { ip: string; total_bytes: string }[];
  topSources: { ip: string; total_bytes: string }[];
  topPorts: { port: string; total_bytes: string }[];
  protocols: { proto: string; total_bytes: string }[];
}

function delta(a: number, b: number): { pct: number; dir: 'up' | 'down' | 'flat' } {
  if (b === 0) return { pct: 0, dir: 'flat' };
  const pct = ((a - b) / b) * 100;
  return { pct: Math.abs(pct), dir: pct > 1 ? 'up' : pct < -1 ? 'down' : 'flat' };
}

function DeltaBadge({ a, b }: { a: number; b: number }) {
  const d = delta(a, b);
  if (d.dir === 'flat') return <span className="text-xs text-gray-500 ml-1">≈</span>;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs ml-1 ${d.dir === 'up' ? 'text-red-400' : 'text-emerald-400'}`}>
      {d.dir === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {d.pct.toFixed(1)}%
    </span>
  );
}

function StatRow({ label, a, b }: { label: string; a: number; b: number; fmt?: (n: number) => string }) {
  return (
    <tr className="border-b border-gray-800/50 hover:bg-gray-800/20">
      <td className="py-2 pr-4 text-gray-400 text-sm">{label}</td>
      <td className="text-right py-2 pr-4 text-gray-200 text-sm font-mono">{formatBytes(a)}</td>
      <td className="text-right py-2 text-gray-200 text-sm font-mono">
        {formatBytes(b)}
        <DeltaBadge a={b} b={a} />
      </td>
    </tr>
  );
}

function IpDeltaTable({ labelA, labelB, rowsA, rowsB }: {
  labelA: string; labelB: string;
  rowsA: { ip: string; total_bytes: string }[];
  rowsB: { ip: string; total_bytes: string }[];
}) {
  const mapB = new Map(rowsB.map(r => [r.ip, Number(r.total_bytes)]));
  const all = [...rowsA.map(r => r.ip), ...rowsB.map(r => r.ip).filter(ip => !rowsA.find(r => r.ip === ip))];

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
          <th className="text-left py-2 pr-4">IP</th>
          <th className="text-right py-2 pr-4">{labelA}</th>
          <th className="text-right py-2">{labelB}</th>
        </tr>
      </thead>
      <tbody>
        {all.slice(0, 10).map(ip => {
          const valA = Number(rowsA.find(r => r.ip === ip)?.total_bytes || 0);
          const valB = mapB.get(ip) || 0;
          return (
            <tr key={ip} className="border-b border-gray-800/50 hover:bg-gray-800/30">
              <td className="py-2 pr-4 font-mono text-gray-200 text-xs">{ip}</td>
              <td className="text-right py-2 pr-4 text-gray-300 text-xs">{valA ? formatBytes(valA) : '—'}</td>
              <td className="text-right py-2 text-gray-300 text-xs">
                {valB ? formatBytes(valB) : '—'}
                <DeltaBadge a={valB} b={valA} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function CompareContent() {
  const [fromA, setFromA] = useState('');
  const [toA, setToA] = useState('');
  const [fromB, setFromB] = useState('');
  const [toB, setToB] = useState('');
  const [srcIp, setSrcIp] = useState('');
  const [dstIp, setDstIp] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ periodA: PeriodData; periodB: PeriodData } | null>(null);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  async function handleCompare() {
    if (!fromA || !toA || !fromB || !toB) {
      setError('All four date/time fields are required.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const params = new URLSearchParams({ fromA, toA, fromB, toB });
      if (srcIp) params.set('src', srcIp);
      if (dstIp) params.set('dst', dstIp);
      const res = await fetch(`/api/compare?${params}`);
      const json = await res.json();
      if (json.success) setResult(json.data);
      else setError(json.error || 'Query failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    if (!result) return;
    setExporting(true);
    try {
      const labelA = `${fromA} to ${toA}`;
      const labelB = `${fromB} to ${toB}`;

      const header = 'period,metric,value\n';
      const rows: string[] = [];
      const A = result.periodA.summary;
      const B = result.periodB.summary;

      const addSummary = (period: string, s: PeriodSummary) => {
        rows.push(`"${period}",total_bytes,${s.total_bytes}`);
        rows.push(`"${period}",total_flows,${s.total_flows}`);
        rows.push(`"${period}",outbound_bytes,${s.outbound_bytes}`);
        rows.push(`"${period}",inbound_bytes,${s.inbound_bytes}`);
        rows.push(`"${period}",internal_bytes,${s.internal_bytes}`);
        rows.push(`"${period}",unique_sources,${s.unique_src}`);
        rows.push(`"${period}",unique_destinations,${s.unique_dst}`);
      };

      addSummary(labelA, A);
      addSummary(labelB, B);

      const csv = header + rows.join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const now = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
      a.href = url;
      a.download = `${now}-compare.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  const labelA = fromA && toA ? `Period A` : 'Period A';
  const labelB = fromB && toB ? `Period B` : 'Period B';

  return (
    <div className="min-h-screen bg-gray-950 pb-12">
      <Navbar />
      <main className="w-full px-4 sm:px-6 lg:px-8 2xl:px-12 mt-8 space-y-6">

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitCompare className="w-6 h-6 text-blue-400" />
            <h1 className="text-2xl font-bold text-gray-100">Compare Periods</h1>
          </div>
          {result && (
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 disabled:opacity-40 transition-all"
            >
              <Download className="w-4 h-4" />
              {exporting ? 'Exporting…' : 'Export CSV'}
            </button>
          )}
        </div>

        {/* Period pickers */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-blue-400">Period A (baseline)</h3>
              <div className="flex gap-2 items-center">
                <input type="datetime-local" value={fromA} onChange={e => setFromA(e.target.value)}
                  className="flex-1 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-200 focus:outline-none focus:border-blue-500" />
                <span className="text-gray-500 text-xs">to</span>
                <input type="datetime-local" value={toA} onChange={e => setToA(e.target.value)}
                  className="flex-1 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-200 focus:outline-none focus:border-blue-500" />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-emerald-400">Period B (compare to)</h3>
              <div className="flex gap-2 items-center">
                <input type="datetime-local" value={fromB} onChange={e => setFromB(e.target.value)}
                  className="flex-1 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-200 focus:outline-none focus:border-blue-500" />
                <span className="text-gray-500 text-xs">to</span>
                <input type="datetime-local" value={toB} onChange={e => setToB(e.target.value)}
                  className="flex-1 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-200 focus:outline-none focus:border-blue-500" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-800">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Source IP / CIDR (optional)</label>
              <input value={srcIp} onChange={e => setSrcIp(e.target.value)} placeholder="10.0.0.1 or 10.0.0.0/8"
                className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Dest IP / CIDR (optional)</label>
              <input value={dstIp} onChange={e => setDstIp(e.target.value)} placeholder="10.0.0.1 or 10.0.0.0/8"
                className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500" />
            </div>
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <button
            onClick={handleCompare}
            disabled={loading}
            className="px-6 py-2 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-400 hover:bg-blue-500/30 text-sm font-medium transition-all disabled:opacity-40"
          >
            {loading ? 'Comparing…' : 'Compare'}
          </button>
        </div>

        {result && (
          <>
            {/* Bandwidth comparison bar chart */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
              <h2 className="text-base font-semibold text-gray-200 mb-4">Bandwidth Overview</h2>
              <BandwidthBar
                labelA={labelA}
                labelB={labelB}
                periodA={result.periodA.summary}
                periodB={result.periodB.summary}
              />
            </div>

            {/* Summary table */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
              <h2 className="text-base font-semibold text-gray-200 mb-3">Summary</h2>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
                    <th className="text-left py-2 pr-4">Metric</th>
                    <th className="text-right py-2 pr-4 text-blue-400">{labelA}</th>
                    <th className="text-right py-2 text-emerald-400">{labelB} (Δ)</th>
                  </tr>
                </thead>
                <tbody>
                  <StatRow label="Total Traffic" a={Number(result.periodA.summary.total_bytes)} b={Number(result.periodB.summary.total_bytes)} />
                  <StatRow label="Outbound" a={Number(result.periodA.summary.outbound_bytes)} b={Number(result.periodB.summary.outbound_bytes)} />
                  <StatRow label="Inbound" a={Number(result.periodA.summary.inbound_bytes)} b={Number(result.periodB.summary.inbound_bytes)} />
                  <StatRow label="Internal" a={Number(result.periodA.summary.internal_bytes)} b={Number(result.periodB.summary.internal_bytes)} />
                  <tr className="border-b border-gray-800/50 hover:bg-gray-800/20">
                    <td className="py-2 pr-4 text-gray-400 text-sm">Total Flows</td>
                    <td className="text-right py-2 pr-4 text-gray-200 text-sm font-mono">{Number(result.periodA.summary.total_flows).toLocaleString()}</td>
                    <td className="text-right py-2 text-gray-200 text-sm font-mono">
                      {Number(result.periodB.summary.total_flows).toLocaleString()}
                      <DeltaBadge a={Number(result.periodB.summary.total_flows)} b={Number(result.periodA.summary.total_flows)} />
                    </td>
                  </tr>
                  <tr className="border-b border-gray-800/50 hover:bg-gray-800/20">
                    <td className="py-2 pr-4 text-gray-400 text-sm">Unique Sources</td>
                    <td className="text-right py-2 pr-4 text-gray-200 text-sm font-mono">{Number(result.periodA.summary.unique_src).toLocaleString()}</td>
                    <td className="text-right py-2 text-gray-200 text-sm font-mono">
                      {Number(result.periodB.summary.unique_src).toLocaleString()}
                      <DeltaBadge a={Number(result.periodB.summary.unique_src)} b={Number(result.periodA.summary.unique_src)} />
                    </td>
                  </tr>
                  <tr className="border-b border-gray-800/50 hover:bg-gray-800/20">
                    <td className="py-2 pr-4 text-gray-400 text-sm">Unique Destinations</td>
                    <td className="text-right py-2 pr-4 text-gray-200 text-sm font-mono">{Number(result.periodA.summary.unique_dst).toLocaleString()}</td>
                    <td className="text-right py-2 text-gray-200 text-sm font-mono">
                      {Number(result.periodB.summary.unique_dst).toLocaleString()}
                      <DeltaBadge a={Number(result.periodB.summary.unique_dst)} b={Number(result.periodA.summary.unique_dst)} />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Top IPs comparison */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
                <h2 className="text-base font-semibold text-gray-200 mb-3">Top Destinations</h2>
                <IpDeltaTable labelA={labelA} labelB={labelB} rowsA={result.periodA.topDestinations} rowsB={result.periodB.topDestinations} />
              </div>
              <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
                <h2 className="text-base font-semibold text-gray-200 mb-3">Top Sources</h2>
                <IpDeltaTable labelA={labelA} labelB={labelB} rowsA={result.periodA.topSources} rowsB={result.periodB.topSources} />
              </div>
            </div>

            {/* Protocol comparison */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
              <h2 className="text-base font-semibold text-gray-200 mb-3">Protocol Breakdown</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
                    <th className="text-left py-2 pr-4">Protocol</th>
                    <th className="text-right py-2 pr-4 text-blue-400">{labelA}</th>
                    <th className="text-right py-2 text-emerald-400">{labelB} (Δ)</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const mapB = new Map(result.periodB.protocols.map(r => [r.proto, Number(r.total_bytes)]));
                    const all = [...result.periodA.protocols.map(r => r.proto), ...result.periodB.protocols.map(r => r.proto).filter(p => !result.periodA.protocols.find(r => r.proto === p))];
                    return all.map(proto => {
                      const valA = Number(result.periodA.protocols.find(r => r.proto === proto)?.total_bytes || 0);
                      const valB = mapB.get(proto) || 0;
                      return (
                        <tr key={proto} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                          <td className="py-2 pr-4 font-mono text-gray-200">{proto}</td>
                          <td className="text-right py-2 pr-4 text-gray-300">{formatBytes(valA)}</td>
                          <td className="text-right py-2 text-gray-300">
                            {formatBytes(valB)}
                            <DeltaBadge a={valB} b={valA} />
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950" />}>
      <CompareContent />
    </Suspense>
  );
}
