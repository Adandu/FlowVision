'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { Search, ChevronUp, ChevronDown } from 'lucide-react';
import { useTimezone, formatTimestamp } from '@/lib/timezone';

interface Flow {
    timestamp: string;
    src_ip: string;
    dst_ip: string;
    src_port: number;
    dst_port: number;
    protocol: string;
    bytes: number;
    packets: number;
}

function formatBytes(bytes: number) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

import { getAppName } from '@/lib/protocols';

const PROTOCOL_COLORS: Record<string, string> = {
    TCP: 'text-blue-400 bg-blue-500/10',
    UDP: 'text-emerald-400 bg-emerald-500/10',
    ICMP: 'text-amber-400 bg-amber-500/10',
    Other: 'text-gray-400 bg-gray-500/10',
};

type SortKey = keyof Flow;

export default function FlowTable({ flows }: { flows: Flow[] }) {
    const { timezone } = useTimezone();
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(0);
    const [sortKey, setSortKey] = useState<SortKey>('timestamp');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const PAGE_SIZE = 25;

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return flows.filter(f =>
            !q || f.src_ip.includes(q) || f.dst_ip.includes(q) || f.protocol.toLowerCase().includes(q) ||
            String(f.dst_port).includes(q) || String(f.src_port).includes(q)
        );
    }, [flows, search]);

    const sorted = useMemo(() => {
        return [...filtered].sort((a, b) => {
            const av = a[sortKey], bv = b[sortKey];
            const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
            return sortDir === 'asc' ? cmp : -cmp;
        });
    }, [filtered, sortKey, sortDir]);

    const page_data = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    const totalPages = Math.ceil(sorted.length / PAGE_SIZE);

    const [asns, setAsns] = useState<Record<string, string>>({});

    useEffect(() => {
        const ips = new Set<string>();
        page_data.forEach(f => {
            if (!asns[f.src_ip]) ips.add(f.src_ip);
            if (!asns[f.dst_ip]) ips.add(f.dst_ip);
        });

        if (ips.size === 0) return;

        const fetchAsns = async () => {
            const updates: Record<string, string> = {};

            for (const ip of ips) {
                try {
                    const res = await fetch(`/api/geoip/${ip}`);
                    const json = await res.json();
                    if (json.success && json.data.asn) {
                        updates[ip] = json.data.asn.replace(/^AS\d+\s+/, '');
                    } else if (json.success && json.data.isp) {
                        updates[ip] = json.data.isp;
                    } else {
                        updates[ip] = '';
                    }
                } catch {
                    updates[ip] = '';
                }
            }
            if (Object.keys(updates).length > 0) {
                setAsns(prev => ({ ...prev, ...updates }));
            }
        };

        fetchAsns();
    }, [page_data]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDir('desc'); }
    };

    const SortIcon = ({ col }: { col: SortKey }) => (
        sortKey === col
            ? (sortDir === 'asc' ? <ChevronUp className="w-3 h-3 inline ml-1" /> : <ChevronDown className="w-3 h-3 inline ml-1" />)
            : <span className="w-3 h-3 inline ml-1 opacity-0">↕</span>
    );

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Search by IP, port, or protocol..."
                        value={search}
                        onChange={e => { setSearch(e.target.value); setPage(0); }}
                        className="w-full pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    />
                </div>
                <span className="text-xs text-gray-500 whitespace-nowrap">{filtered.length} flows</span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-800">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-gray-800 bg-gray-900/60">
                            {([
                                ['timestamp', 'Time'],
                                ['src_ip', 'Source IP'],
                                ['dst_ip', 'Dest IP'],
                                ['protocol', 'Proto'],
                                ['dst_port', 'Port (App)'],
                                ['bytes', 'Bytes'],
                                ['packets', 'Pkts'],
                            ] as [SortKey, string][]).map(([key, label]) => (
                                <th key={key} onClick={() => handleSort(key)} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-200 select-none">
                                    {label}<SortIcon col={key} />
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/50">
                        {page_data.map((flow, i) => (
                            <tr key={i} className="hover:bg-gray-800/30 transition-colors">
                                <td className="px-4 py-2.5 text-gray-400 text-xs font-mono whitespace-nowrap">
                                    {formatTimestamp(flow.timestamp, timezone)}
                                </td>
                                <td className="px-4 py-2.5">
                                    <Link href={`/ip/${flow.src_ip}`} className="text-blue-400 hover:text-blue-300 hover:underline font-mono text-xs">
                                        {flow.src_ip} {asns[flow.src_ip] ? <span className="text-gray-500 font-sans">({asns[flow.src_ip]})</span> : ''}
                                    </Link>
                                </td>
                                <td className="px-4 py-2.5">
                                    <Link href={`/ip/${flow.dst_ip}`} className="text-blue-400 hover:text-blue-300 hover:underline font-mono text-xs">
                                        {flow.dst_ip} {asns[flow.dst_ip] ? <span className="text-gray-500 font-sans">({asns[flow.dst_ip]})</span> : ''}
                                    </Link>
                                </td>
                                <td className="px-4 py-2.5">
                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PROTOCOL_COLORS[flow.protocol] || PROTOCOL_COLORS.Other}`}>
                                        {flow.protocol}
                                    </span>
                                </td>
                                <td className="px-4 py-2.5 text-gray-300 font-mono text-xs">
                                    {flow.dst_port} <span className="text-gray-500">({getAppName(flow.dst_port)})</span>
                                </td>
                                <td className="px-4 py-2.5 text-gray-300 text-xs">{formatBytes(flow.bytes)}</td>
                                <td className="px-4 py-2.5 text-gray-400 text-xs">{flow.packets}</td>
                            </tr>
                        ))}
                        {page_data.length === 0 && (
                            <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No flows matching your search</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Page {page + 1} of {totalPages}</span>
                    <div className="flex gap-2">
                        <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1 text-xs bg-gray-800 border border-gray-700 rounded-md text-gray-300 disabled:opacity-40 hover:bg-gray-700 transition-colors">Prev</button>
                        <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1} className="px-3 py-1 text-xs bg-gray-800 border border-gray-700 rounded-md text-gray-300 disabled:opacity-40 hover:bg-gray-700 transition-colors">Next</button>
                    </div>
                </div>
            )}
        </div>
    );
}
