'use client';

import { useState, useEffect, use } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ArrowLeft, Globe, Server, Activity, Clock, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { useTimezone, formatTimestamp } from '@/lib/timezone';

const BandwidthChart = dynamic(() => import('@/components/charts/BandwidthChart'), { ssr: false });

function formatBytes(bytes: number) {
    if (!bytes || isNaN(bytes)) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(Math.max(1, bytes)) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

const PROTOCOL_COLORS: Record<string, string> = {
    TCP: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    UDP: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    ICMP: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    Other: 'text-gray-400 bg-gray-500/10 border-gray-500/20',
};

export default function IPDetailPage() {
    const params = useParams();
    const ip = decodeURIComponent(params.ip as string);
    const { timezone } = useTimezone();
    const [data, setData] = useState<any>(null);
    const [geo, setGeo] = useState<any>(null);
    const [hostname, setHostname] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!ip) return;
        setLoading(true);
        Promise.all([
            fetch(`/api/ip/${ip}`).then(r => r.json()),
            fetch(`/api/geoip/${ip}`).then(r => r.json()),
            fetch(`/api/rdns/${ip}`).then(r => r.json()),
        ]).then(([ipData, geoData, rdnsData]) => {
            if (ipData.success) setData(ipData.data);
            if (geoData.success) setGeo(geoData.data);
            if (rdnsData.success) setHostname(rdnsData.hostname);
        }).catch(console.error).finally(() => setLoading(false));
    }, [ip]);

    const summary = data?.summary || {};

    return (
        <div className="min-h-screen bg-gray-950 pb-12">
            <Navbar />
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-6">
                {/* Back + Header */}
                <div>
                    <Link href="/" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 mb-4 transition-colors w-fit">
                        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
                    </Link>
                    <div className="flex flex-wrap items-start gap-4">
                        <div>
                            <div className="flex items-center gap-3 flex-wrap">
                                <h1 className="text-3xl font-bold text-gray-100 font-mono">{ip}</h1>
                                {geo?.flag && <span className="text-3xl">{geo.flag}</span>}
                                {hostname && <span className="text-sm text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full font-mono">{hostname}</span>}
                            </div>
                            <p className="text-gray-400 mt-1 text-sm">
                                {geo?.country && `${geo.country}`}
                                {geo?.city && ` · ${geo.city}`}
                                {geo?.asn && ` · ${geo.asn}`}
                                {geo?.isp && !geo?.asn?.includes(geo.isp) && ` · ${geo.isp}`}
                            </p>
                        </div>
                    </div>
                </div>

                {loading && <div className="text-gray-500 py-8 text-center animate-pulse">Loading IP details…</div>}

                {!loading && data && (
                    <>
                        {/* Summary Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                            <div className="col-span-2 bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
                                <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><ArrowUpRight className="w-3 h-3" />Bytes Sent</p>
                                <p className="text-xl font-bold text-gray-100">{formatBytes(Number(summary.bytes_sent))}</p>
                            </div>
                            <div className="col-span-2 bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
                                <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><ArrowDownLeft className="w-3 h-3" />Bytes Received</p>
                                <p className="text-xl font-bold text-gray-100">{formatBytes(Number(summary.bytes_received))}</p>
                            </div>
                            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
                                <p className="text-xs text-gray-400 mb-1">Total Flows</p>
                                <p className="text-xl font-bold text-gray-100">{(Number(summary.flows_as_src) + Number(summary.flows_as_dst)).toLocaleString()}</p>
                            </div>
                            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
                                <p className="text-xs text-gray-400 mb-1">Last Seen</p>
                                <p className="text-sm font-medium text-gray-200">{summary.last_seen ? formatTimestamp(summary.last_seen, timezone) : 'Unknown'}</p>
                            </div>
                        </div>

                        {/* Bandwidth Charts */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                                <h3 className="text-base font-semibold text-gray-200 mb-4 flex items-center gap-2">
                                    <ArrowUpRight className="w-4 h-4 text-blue-400" /> Outgoing Traffic (24h)
                                </h3>
                                {data.timelineAsSrc?.length > 0
                                    ? <BandwidthChart data={data.timelineAsSrc.map((d: any) => ({ time: d.time, total_bytes: d.bytes }))} timezone={timezone} />
                                    : <p className="text-gray-500 text-sm text-center py-8">No outgoing traffic in the last 24h</p>}
                            </div>
                            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                                <h3 className="text-base font-semibold text-gray-200 mb-4 flex items-center gap-2">
                                    <ArrowDownLeft className="w-4 h-4 text-emerald-400" /> Incoming Traffic (24h)
                                </h3>
                                {data.timelineAsDst?.length > 0
                                    ? <BandwidthChart data={data.timelineAsDst.map((d: any) => ({ time: d.time, total_bytes: d.bytes }))} timezone={timezone} />
                                    : <p className="text-gray-500 text-sm text-center py-8">No incoming traffic in the last 24h</p>}
                            </div>
                        </div>

                        {/* Top Peers + Ports */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Top Destinations from this IP */}
                            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                                <h3 className="text-base font-semibold text-gray-200 mb-4">Contacts (Outgoing)</h3>
                                <div className="space-y-2">
                                    {(data.topPeersAsSrc || []).map((peer: any) => (
                                        <div key={peer.peer} className="flex items-center justify-between gap-2 text-sm py-1.5 border-b border-gray-800">
                                            <Link href={`/ip/${peer.peer}`} className="text-blue-400 hover:underline font-mono text-xs">{peer.peer}</Link>
                                            <span className="text-gray-400 text-xs">{formatBytes(Number(peer.total_bytes))}</span>
                                        </div>
                                    ))}
                                    {!data.topPeersAsSrc?.length && <p className="text-gray-500 text-sm">None</p>}
                                </div>
                            </div>

                            {/* Top Sources to this IP */}
                            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                                <h3 className="text-base font-semibold text-gray-200 mb-4">Contacts (Incoming)</h3>
                                <div className="space-y-2">
                                    {(data.topPeersAsDst || []).map((peer: any) => (
                                        <div key={peer.peer} className="flex items-center justify-between gap-2 text-sm py-1.5 border-b border-gray-800">
                                            <Link href={`/ip/${peer.peer}`} className="text-blue-400 hover:underline font-mono text-xs">{peer.peer}</Link>
                                            <span className="text-gray-400 text-xs">{formatBytes(Number(peer.total_bytes))}</span>
                                        </div>
                                    ))}
                                    {!data.topPeersAsDst?.length && <p className="text-gray-500 text-sm">None</p>}
                                </div>
                            </div>

                            {/* Top Ports */}
                            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                                <h3 className="text-base font-semibold text-gray-200 mb-4">Top Ports</h3>
                                <div className="space-y-2">
                                    {(data.topPorts || []).map((p: any) => (
                                        <div key={`${p.proto}-${p.port}`} className="flex items-center justify-between gap-2 py-1.5 border-b border-gray-800">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs font-medium px-1.5 py-0.5 rounded border ${PROTOCOL_COLORS[p.proto] || PROTOCOL_COLORS.Other}`}>{p.proto}</span>
                                                <span className="text-gray-300 font-mono text-xs">{p.port}</span>
                                            </div>
                                            <span className="text-gray-400 text-xs">{formatBytes(Number(p.total_bytes))}</span>
                                        </div>
                                    ))}
                                    {!data.topPorts?.length && <p className="text-gray-500 text-sm">None</p>}
                                </div>
                            </div>
                        </div>

                        {/* Recent Flows */}
                        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                            <h3 className="text-base font-semibold text-gray-200 mb-4">Recent Flows (last 100)</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="border-b border-gray-800 text-gray-400">
                                            <th className="px-3 py-2 text-left">Time</th>
                                            <th className="px-3 py-2 text-left">Src IP</th>
                                            <th className="px-3 py-2 text-left">Dst IP</th>
                                            <th className="px-3 py-2 text-left">Proto</th>
                                            <th className="px-3 py-2 text-left">Port</th>
                                            <th className="px-3 py-2 text-left">Bytes</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-800/50">
                                        {(data.recentFlows || []).map((f: any, i: number) => (
                                            <tr key={i} className="hover:bg-gray-800/30">
                                                <td className="px-3 py-2 text-gray-400 font-mono whitespace-nowrap">{formatTimestamp(f.timestamp, timezone)}</td>
                                                <td className="px-3 py-2"><Link href={`/ip/${f.src_ip}`} className="text-blue-400 hover:underline font-mono">{f.src_ip}</Link></td>
                                                <td className="px-3 py-2"><Link href={`/ip/${f.dst_ip}`} className="text-blue-400 hover:underline font-mono">{f.dst_ip}</Link></td>
                                                <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded border text-xs ${PROTOCOL_COLORS[f.protocol] || PROTOCOL_COLORS.Other}`}>{f.protocol}</span></td>
                                                <td className="px-3 py-2 text-gray-300 font-mono">{f.dst_port}</td>
                                                <td className="px-3 py-2 text-gray-300">{formatBytes(Number(f.bytes))}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}
