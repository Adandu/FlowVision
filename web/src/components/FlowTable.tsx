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
    src_asn?: string;
    dst_asn?: string;
    src_displayName?: string;
    dst_displayName?: string;
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

function isPrivate(ip: string): boolean {
    return /^10\./.test(ip) || /^192\.168\./.test(ip) || /^172\.(1[6-9]|2[0-9]|3[01])\./.test(ip);
}

function networkDirection(src: string, dst: string): 'out' | 'in' | 'int' | 'ext' {
    const srcPriv = isPrivate(src);
    const dstPriv = isPrivate(dst);
    if (srcPriv && !dstPriv) return 'out';
    if (!srcPriv && dstPriv) return 'in';
    if (srcPriv && dstPriv) return 'int';
    return 'ext';
}

export default function FlowTable({ flows, isGuest = false, highlightIp, showNetworkDirection }: { flows: Flow[]; isGuest?: boolean; highlightIp?: string; showNetworkDirection?: boolean }) {
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
                            {(highlightIp || showNetworkDirection) && (
                                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider select-none">Dir</th>
                            )}
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
                        {page_data.map((flow, i) => {
                            const isOutgoing = highlightIp ? flow.src_ip === highlightIp : null;
                            const netDir = showNetworkDirection ? networkDirection(flow.src_ip, flow.dst_ip) : null;
                            return (
                            <tr key={i} className="hover:bg-gray-800/30 transition-colors">
                                {(highlightIp || showNetworkDirection) && (
                                    <td className="px-3 py-2.5">
                                        {isOutgoing === true && <span className="text-xs font-semibold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">→ Out</span>}
                                        {isOutgoing === false && <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">← In</span>}
                                        {netDir === 'out' && <span className="text-xs font-semibold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">→ Out</span>}
                                        {netDir === 'in'  && <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">← In</span>}
                                        {netDir === 'int' && <span className="text-xs font-semibold text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">↔ Int</span>}
                                        {netDir === 'ext' && <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">⇄ Ext</span>}
                                    </td>
                                )}
                                <td className="px-4 py-2.5 text-gray-400 text-xs font-mono whitespace-nowrap">
                                    {formatTimestamp(flow.timestamp, timezone)}
                                </td>
                                <td className="px-4 py-2.5">
                                    <div className="flex flex-col gap-0.5">
                                        <Link href={`/ip/${flow.src_ip}`} className="text-blue-400 hover:text-blue-300 hover:underline font-mono text-xs">
                                            {flow.src_displayName || flow.src_ip}
                                        </Link>
                                        {flow.src_asn && <span className="text-gray-500 text-xs truncate max-w-[140px]">{flow.src_asn.replace(/^AS\d+\s+/, '')}</span>}
                                    </div>
                                </td>
                                <td className="px-4 py-2.5">
                                    <div className="flex flex-col gap-0.5">
                                        <Link href={`/ip/${flow.dst_ip}`} className="text-blue-400 hover:text-blue-300 hover:underline font-mono text-xs">
                                            {flow.dst_displayName || flow.dst_ip}
                                        </Link>
                                        {flow.dst_asn && <span className="text-gray-500 text-xs truncate max-w-[140px]">{flow.dst_asn.replace(/^AS\d+\s+/, '')}</span>}
                                    </div>
                                </td>
                                <td className="px-4 py-2.5">
                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isGuest ? 'text-gray-400 bg-gray-800' : (PROTOCOL_COLORS[flow.protocol] || PROTOCOL_COLORS.Other)}`}>
                                        {isGuest ? '*****' : flow.protocol}
                                    </span>
                                </td>
                                <td className="px-4 py-2.5 text-gray-300 font-mono text-xs">
                                    {isGuest ? <span className="text-gray-400 font-mono">*****</span> : <>{flow.dst_port} <span className="text-gray-500">({getAppName(flow.dst_port)})</span></>}
                                </td>
                                <td className="px-4 py-2.5 text-gray-300 text-xs">{isGuest ? <span className="text-gray-400">*****</span> : formatBytes(flow.bytes)}</td>
                                <td className="px-4 py-2.5 text-gray-400 text-xs">{isGuest ? <span className="text-gray-400">*****</span> : flow.packets}</td>
                            </tr>
                        );
                        })}
                        {page_data.length === 0 && (
                            <tr><td colSpan={(highlightIp || showNetworkDirection) ? 8 : 7} className="px-4 py-8 text-center text-gray-500">No flows matching your search</td></tr>
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
