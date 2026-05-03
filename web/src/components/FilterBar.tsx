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

      {/* Active filter chips */}
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
