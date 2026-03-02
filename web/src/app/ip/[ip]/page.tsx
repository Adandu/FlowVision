'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ArrowLeft, ArrowUpRight, ArrowDownLeft, Network, Activity, AlertCircle } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { useTimezone, formatTimestamp } from '@/lib/timezone';

const BandwidthChart = dynamic(() => import('@/components/charts/BandwidthChart'), { ssr: false });
const TopHostsChart = dynamic(() => import('@/components/charts/TopHostsChart'), { ssr: false });
const TopPortsChart = dynamic(() => import('@/components/charts/TopPortsChart'), { ssr: false });
const FlowDiagramChart = dynamic(() => import('@/components/charts/FlowDiagramChart'), { ssr: false });
const GeoMapChart = dynamic(() => import('@/components/charts/GeoMapChart'), { ssr: false });
const FlowTable = dynamic(() => import('@/components/FlowTable'), { ssr: false });

type IntervalType = '10m' | '1h' | '24h' | '7d' | '30d';

function formatBytes(bytes: number) {
    if (!bytes || isNaN(bytes)) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(Math.max(1, bytes)) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function IPDetailPage() {
    const params = useParams();
    const ip = decodeURIComponent(params.ip as string);
    const { timezone } = useTimezone();
    const [interval, setIntervalState] = useState<IntervalType | 'Live'>('24h');
    const [data, setData] = useState<any>(null);
    const [donuts, setDonuts] = useState<any>(null);
    const [flowDiagram, setFlowDiagram] = useState<any>(null);
    const [geo, setGeo] = useState<any>(null);
    const [hostname, setHostname] = useState<string | null>(null);
    const [displayIp, setDisplayIp] = useState<string>(ip);
    const [loading, setLoading] = useState(true);

    const intervals: { label: string; value: IntervalType | 'Live' }[] = [
        { label: 'Live', value: 'Live' },
        { label: '10 Mins', value: '10m' },
        { label: '1 Hour', value: '1h' },
        { label: '24 Hours', value: '24h' },
        { label: '7 Days', value: '7d' },
        { label: '30 Days', value: '30d' },
    ];

    useEffect(() => {
        if (!ip) return;
        let isMounted = true;
        let timer: number;

        async function fetchAll() {
            setLoading(true);
            const queryInterval = interval === 'Live' ? '10m' : interval;
            try {
                const [ipData, donutsData, diagramData, geoData, rdnsData] = await Promise.all([
                    fetch(`/api/ip/${ip}?interval=${queryInterval}`).then(r => r.json()),
                    fetch(`/api/ip/${ip}/donuts?interval=${queryInterval}`).then(r => r.json()),
                    fetch(`/api/flow-diagram?src_ip=${ip}&interval=${queryInterval}`).then(r => r.json()),
                    fetch(`/api/geoip/${ip}`).then(r => r.json()),
                    fetch(`/api/rdns/${ip}`).then(r => r.json()),
                ]);

                if (!isMounted) return;

                if (ipData.success) {
                    setData(ipData.data);
                    if (ipData.data.requested_ip) setDisplayIp(ipData.data.requested_ip);
                }
                if (donutsData.success) setDonuts(donutsData);
                if (diagramData.success) setFlowDiagram(diagramData.data);
                if (geoData.success) setGeo(geoData.data);
                if (rdnsData.success) setHostname(rdnsData.hostname);
            } catch (error) {
                console.error(error);
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        fetchAll();

        if (interval === 'Live') {
            timer = window.setInterval(fetchAll, 3000);
        } else {
            timer = window.setInterval(fetchAll, 60000); // 1 minute background poll for everything else
        }

        return () => {
            isMounted = false;
            if (timer) clearInterval(timer);
        };
    }, [ip, interval]);

    const summary = data?.summary || {};

    return (
        <div className="min-h-screen bg-gray-950 pb-12">
            <Navbar />
            <main className="w-full px-4 sm:px-6 lg:px-8 mt-8 space-y-6">

                {/* Header Area */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <Link href="/ip" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 mb-4 transition-colors w-fit">
                            <ArrowLeft className="w-4 h-4" /> Back to IP Search
                        </Link>
                        <div className="flex items-center gap-3 flex-wrap">
                            <h1 className="text-3xl font-bold text-gray-100 font-mono">{displayIp}</h1>
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

                    {/* Time Interval Selector */}
                    <div className="flex items-center space-x-2 bg-gray-900/50 p-1.5 rounded-lg border border-gray-800 backdrop-blur-sm self-start md:self-auto">
                        {intervals.map((int) => (
                            <button
                                key={int.value}
                                onClick={() => setIntervalState(int.value)}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${interval === int.value
                                    ? int.value === 'Live'
                                        ? 'bg-red-500 text-white shadow-lg shadow-red-500/20 animate-pulse'
                                        : 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                                    }`}
                            >
                                {int.label}
                            </button>
                        ))}
                    </div>
                </div>

                {loading && !data && <div className="text-gray-500 py-12 text-center animate-pulse flex items-center justify-center gap-2"><Activity className="w-4 h-4 animate-spin" /> Loading traffic details...</div>}

                {data && (
                    <>
                        {/* Summary Block */}
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

                        {/* 1. Traffic Charts */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 shadow-xl">
                                <h3 className="text-base font-semibold text-gray-200 mb-4 flex items-center gap-2">
                                    <ArrowUpRight className="w-4 h-4 text-blue-400" /> Outgoing Traffic Bandwidth
                                </h3>
                                {data.timelineAsSrc?.length > 0
                                    ? <BandwidthChart data={data.timelineAsSrc.map((d: any) => ({ time: d.time, total_bytes: d.bytes }))} timezone={timezone} interval={interval} />
                                    : <p className="text-gray-500 text-sm text-center py-8">No outgoing traffic in interval</p>}
                            </div>
                            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 shadow-xl">
                                <h3 className="text-base font-semibold text-gray-200 mb-4 flex items-center gap-2">
                                    <ArrowDownLeft className="w-4 h-4 text-emerald-400" /> Incoming Traffic Bandwidth
                                </h3>
                                {data.timelineAsDst?.length > 0
                                    ? <BandwidthChart data={data.timelineAsDst.map((d: any) => ({ time: d.time, total_bytes: d.bytes }))} timezone={timezone} interval={interval} />
                                    : <p className="text-gray-500 text-sm text-center py-8">No incoming traffic in interval</p>}
                            </div>
                        </div>

                        {/* 2. Flow Diagram */}
                        <div className="bg-gray-900/50 border border-gray-800 rounded-xl px-6 pt-6 pb-2 shadow-xl overflow-hidden">
                            <h3 className="text-base font-semibold text-gray-200 mb-4 flex items-center gap-2">
                                <Network className="w-4 h-4 text-blue-400" /> Traffic Flow Diagram (Sankey Graph)
                            </h3>
                            <div className="w-full -mt-4">
                                <FlowDiagramChart srcIp={ip} data={flowDiagram || []} />
                            </div>
                        </div>

                        {/* 3. Global Traffic Map */}
                        {donuts && (
                            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 shadow-xl overflow-hidden mb-6">
                                <GeoMapChart
                                    title="IP Traffic Sources & Destinations"
                                    data={[
                                        ...donuts.incoming.map((d: any) => ({ ip: d.src_ip, lat: d.lat, lon: d.lon, total_bytes: d.bytes, country: d.country, city: d.city })),
                                        ...donuts.outgoing.map((d: any) => ({ ip: d.dst_ip, lat: d.lat, lon: d.lon, total_bytes: d.bytes, country: d.country, city: d.city }))
                                    ].filter(d => d.lat && d.lon)}
                                />
                            </div>
                        )}

                        {/* 4. Donut Graphs */}
                        {donuts && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 shadow-xl">
                                    <h3 className="text-base font-semibold text-gray-200 mb-4 flex items-center gap-2">
                                        <ArrowUpRight className="w-4 h-4 text-blue-400" /> Outgoing IPs
                                    </h3>
                                    <div className="h-64">
                                        {donuts.outgoing?.length > 0 ? (
                                            <TopHostsChart data={donuts.outgoing.map((d: any) => ({ peer: d.dst_ip, total_bytes: d.bytes }))} title="Outgoing" />
                                        ) : <p className="text-gray-500 text-sm text-center py-8">No data</p>}
                                    </div>
                                </div>
                                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 shadow-xl">
                                    <h3 className="text-base font-semibold text-gray-200 mb-4 flex items-center gap-2">
                                        <ArrowDownLeft className="w-4 h-4 text-emerald-400" /> Incoming IPs
                                    </h3>
                                    <div className="h-64">
                                        {donuts.incoming?.length > 0 ? (
                                            <TopHostsChart data={donuts.incoming.map((d: any) => ({ peer: d.src_ip, total_bytes: d.bytes }))} title="Incoming" />
                                        ) : <p className="text-gray-500 text-sm text-center py-8">No data</p>}
                                    </div>
                                </div>
                                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 shadow-xl">
                                    <h3 className="text-base font-semibold text-gray-200 mb-4 flex items-center gap-2">
                                        <Activity className="w-4 h-4 text-purple-400" /> Top Ports
                                    </h3>
                                    <div className="h-64">
                                        {donuts.topPorts?.length > 0 ? (
                                            <TopPortsChart data={donuts.topPorts.map((d: any) => ({ port: d.dst_port, total_bytes: d.bytes }))} />
                                        ) : <p className="text-gray-500 text-sm text-center py-8">No data</p>}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 5. Recent Flows Table */}
                        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 shadow-xl">
                            <h3 className="text-base font-semibold text-gray-200 mb-4 px-2">Flow Log Table</h3>
                            <FlowTable flows={data.recentFlows || []} />
                        </div>
                    </>
                )}

                {!loading && !data && (
                    <div className="flex flex-col items-center justify-center p-12 text-center text-gray-500 bg-gray-900/50 border border-gray-800 rounded-xl mt-8">
                        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                        <h2 className="text-xl font-semibold mb-2 text-gray-200">No Data Available</h2>
                        <p>No traffic data could be found for {displayIp} in the selected time interval, or a database error occurred.</p>
                        <Link href="/ip" className="mt-6 bg-gray-800 hover:bg-gray-700 text-white px-6 py-2 rounded-xl transition-colors">
                            Back to Search
                        </Link>
                    </div>
                )}
            </main>
        </div>
    );
}
