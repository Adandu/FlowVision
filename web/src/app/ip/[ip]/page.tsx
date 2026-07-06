'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import nextDynamic from 'next/dynamic';
import { ArrowLeft, ArrowUpRight, ArrowDownLeft, Network, Activity, AlertCircle, Clock, ArrowLeftRight, Download, Server, ChevronLeft, ChevronRight } from 'lucide-react';
import Navbar from '@/components/Navbar';
import StatCard from '@/components/StatCard';
import SectionCard from '@/components/SectionCard';
import FilterBar from '@/components/FilterBar';
import { useTimezone, formatTimestamp, getTimezoneOffsetMinutes } from '@/lib/timezone';
import { useAuth } from '@/hooks/useAuth';
import { formatBytes } from '@/lib/formatters';
import { useFilters } from '@/hooks/useFilters';

const BandwidthChart = nextDynamic(() => import('@/components/charts/BandwidthChart'), { ssr: false });
const TopHostsChart = nextDynamic(() => import('@/components/charts/TopHostsChart'), { ssr: false });
const TopPortsChart = nextDynamic(() => import('@/components/charts/TopPortsChart'), { ssr: false });
const FlowDiagramChart = nextDynamic(() => import('@/components/charts/FlowDiagramChart'), { ssr: false });
const GeoMapChart = nextDynamic(() => import('@/components/charts/GeoMapChart'), { ssr: false });
const TopServicesCard = nextDynamic(() => import('@/components/charts/TopServicesCard'), { ssr: false });
const FlowTable = nextDynamic(() => import('@/components/FlowTable'), { ssr: false });
const AISummaryWidget = nextDynamic(() => import('@/components/AISummaryWidget'), { ssr: false });

function IPDetailContent() {
    const params = useParams();
    const router = useRouter();
    const ip = decodeURIComponent(params.ip as string);
    const { timezone } = useTimezone();
    const { interval, toApiParams, activeCount, ...filterRest } = useFilters('24h');
    const [data, setData] = useState<any>(null);
    const [donuts, setDonuts] = useState<any>(null);
    const [flowDiagram, setFlowDiagram] = useState<any>(null);
    const [geo, setGeo] = useState<any>(null);
    const [hostname, setHostname] = useState<string | null>(null);
    const [displayIp, setDisplayIp] = useState<string>(ip);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [outgoingPage, setOutgoingPage] = useState(0);
    const [incomingPage, setIncomingPage] = useState(0);
    const [servicesPage, setServicesPage] = useState(0);
    const [applicationsPage, setApplicationsPage] = useState(0);
    const DONUT_PAGE_SIZE = 10;
    const isLoggedIn = useAuth();

    useEffect(() => {
        setOutgoingPage(0);
        setIncomingPage(0);
        setServicesPage(0);
        setApplicationsPage(0);
    }, [ip, interval]);

    useEffect(() => {
        if (!ip) return;
        let isMounted = true;
        let timer: number;

        async function fetchAll() {
            setLoading(true);
            const queryInterval = interval === 'Live' ? '1m' : interval;
            const timeParams = new URLSearchParams({ interval: queryInterval });
            if (interval === 'custom') {
                if (filterRest.from) timeParams.set('from', filterRest.from);
                if (filterRest.to) timeParams.set('to', filterRest.to);
            }
            try {
                const [ipData, donutsData, diagramData, geoData, rdnsData] = await Promise.all([
                    fetch(`/api/ip/${ip}?${timeParams}`).then(r => r.json()),
                    fetch(`/api/ip/${ip}/donuts?${timeParams}`).then(r => r.json()),
                    fetch(`/api/flow-diagram?src_ip=${ip}&${timeParams}`).then(r => r.json()),
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
            timer = window.setInterval(fetchAll, 1000);
        } else {
            timer = window.setInterval(fetchAll, 60000);
        }

        return () => {
            isMounted = false;
            if (timer) clearInterval(timer);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ip, interval, filterRest.from, filterRest.to]);

    async function handleExport() {
        setExporting(true);
        try {
            const queryInterval = interval === 'Live' ? '1m' : interval;
            const exportParams = new URLSearchParams({ interval: queryInterval });
            if (interval === 'custom') {
                if (filterRest.from) exportParams.set('from', filterRest.from);
                if (filterRest.to) exportParams.set('to', filterRest.to);
            }
            const res = await fetch(`/api/ip/${ip}/export?${exportParams}`);
            if (!res.ok) return;
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = res.headers.get('x-filename') || `${ip}-flows.csv`;
            a.click();
            URL.revokeObjectURL(url);
        } finally {
            setExporting(false);
        }
    }

    const summary = data?.summary || {};

    const flowLogBase = `/flow-log`;
    // Use `ip=` so the flow log shows traffic both TO and FROM this IP
    const flowLogForIp = (extraParam: string) =>
        `${flowLogBase}?interval=${interval}&ip=${ip}${extraParam}`;

    return (
        <div className="min-h-screen bg-gray-950 pb-12">
            <Navbar />
            <main className="w-full px-4 sm:px-6 lg:px-8 2xl:px-12 mt-8 space-y-6">

                {/* Header */}
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
                    <button
                        onClick={handleExport}
                        disabled={exporting || !data}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all self-start md:self-auto"
                    >
                        <Download className="w-4 h-4" />
                        {exporting ? 'Exporting…' : 'Export CSV'}
                    </button>
                </div>

                {/* Time range filter (no advanced IP/port filters — we're already on an IP page) */}
                <FilterBar
                    filters={{ interval, ...filterRest }}
                    setFilter={filterRest.setFilter}
                    clearAll={filterRest.clearAll}
                    activeCount={activeCount}
                    showTimeOnly
                />

                {/* AI Summary Widget */}
                <AISummaryWidget interval={interval === 'Live' ? '10m' : interval} context="ip" ip={ip} />

                {loading && !data && (
                    <div className="text-gray-500 py-12 text-center animate-pulse flex items-center justify-center gap-2">
                        <Activity className="w-4 h-4 animate-spin" /> Loading traffic details...
                    </div>
                )}

                {data && (
                    <>
                        {/* Summary Stat Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                            <StatCard title="Bytes Sent" value={formatBytes(Number(summary.bytes_sent))} icon={<ArrowUpRight />} color="blue" span={2} />
                            <StatCard title="Bytes Received" value={formatBytes(Number(summary.bytes_received))} icon={<ArrowDownLeft />} color="emerald" span={2} />
                            <StatCard title="Total Flows" value={(Number(summary.flows_as_src) + Number(summary.flows_as_dst)).toLocaleString()} icon={<ArrowLeftRight />} color="purple" />
                            <StatCard title="Last Seen" value={summary.last_seen ? formatTimestamp(summary.last_seen, timezone) : 'Unknown'} icon={<Clock />} color="teal" />
                        </div>

                        {/* Traffic Charts */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <SectionCard title="Outgoing Traffic Bandwidth" icon={<ArrowUpRight className="w-4 h-4 text-blue-400" />}>
                                {data.timelineAsSrc?.length > 0
                                    ? <BandwidthChart data={data.timelineAsSrc.map((d: any) => ({ time: d.time, total_bytes: d.bytes, bits_per_second: d.bits_per_second ?? 0 }))} timezone={timezone} tzOffsetMinutes={getTimezoneOffsetMinutes(timezone)} interval={interval} />
                                    : <p className="text-gray-500 text-sm text-center py-8">No outgoing traffic in interval</p>}
                            </SectionCard>
                            <SectionCard title="Incoming Traffic Bandwidth" icon={<ArrowDownLeft className="w-4 h-4 text-emerald-400" />}>
                                {data.timelineAsDst?.length > 0
                                    ? <BandwidthChart data={data.timelineAsDst.map((d: any) => ({ time: d.time, total_bytes: d.bytes, bits_per_second: d.bits_per_second ?? 0 }))} timezone={timezone} tzOffsetMinutes={getTimezoneOffsetMinutes(timezone)} interval={interval} />
                                    : <p className="text-gray-500 text-sm text-center py-8">No incoming traffic in interval</p>}
                            </SectionCard>
                        </div>

                        {/* Protocol Breakdown */}
                        {data.protocolBreakdown?.length > 0 && (
                            <SectionCard
                                title="Protocol Breakdown"
                                icon={<ArrowLeftRight className="w-4 h-4 text-amber-400" />}
                            >
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
                                            <th className="text-left py-2 pr-4">Protocol</th>
                                            <th className="text-right py-2 pr-4">Bytes</th>
                                            <th className="text-right py-2">Flows</th>
                                            <th className="w-8" />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.protocolBreakdown.map((r: any) => (
                                            <tr key={r.proto} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                                                <td className="py-2 pr-4 font-mono text-gray-200">{r.proto}</td>
                                                <td className="text-right py-2 pr-4 text-gray-300">{formatBytes(Number(r.total_bytes))}</td>
                                                <td className="text-right py-2 text-gray-400">{Number(r.flow_count).toLocaleString()}</td>
                                                <td className="py-2 pl-2">
                                                    <Link
                                                        href={flowLogForIp(`&proto=${r.proto.toLowerCase()}`)}
                                                        className="text-blue-400 hover:text-blue-300 text-xs"
                                                        title="View flows"
                                                    >→</Link>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </SectionCard>
                        )}

                        {/* Port Breakdown (all ports) */}
                        {data.portBreakdown?.length > 0 && (
                            <SectionCard
                                title={`Port Breakdown (${data.portBreakdown.length} ports)`}
                                icon={<Server className="w-4 h-4 text-purple-400" />}
                            >
                                <div className="max-h-96 overflow-y-auto">
                                    <table className="w-full text-sm">
                                        <thead className="sticky top-0 bg-gray-900/95">
                                            <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
                                                <th className="text-left py-2 pr-4">Port</th>
                                                <th className="text-left py-2 pr-4">Service</th>
                                                <th className="text-left py-2 pr-4">Proto</th>
                                                <th className="text-right py-2 pr-4">Bytes</th>
                                                <th className="text-right py-2">Flows</th>
                                                <th className="w-8" />
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.portBreakdown.map((r: any, i: number) => (
                                                <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                                                    <td className="py-2 pr-4 font-mono text-gray-200">{r.port}</td>
                                                    <td className="py-2 pr-4 text-gray-400 text-xs">
                                                        {r.app_name && !r.app_name.startsWith('Port') ? r.app_name : '—'}
                                                    </td>
                                                    <td className="py-2 pr-4 text-gray-400">{r.proto}</td>
                                                    <td className="text-right py-2 pr-4 text-gray-300">{formatBytes(Number(r.total_bytes))}</td>
                                                    <td className="text-right py-2 text-gray-400">{Number(r.flow_count).toLocaleString()}</td>
                                                    <td className="py-2 pl-2">
                                                        <Link
                                                            href={flowLogForIp(`&port=${r.port}`)}
                                                            className="text-blue-400 hover:text-blue-300 text-xs"
                                                            title="View flows"
                                                        >→</Link>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </SectionCard>
                        )}

                        {/* Flow Diagram */}
                        <div className="bg-gray-900/50 border border-gray-800 rounded-xl px-6 pt-6 pb-2 shadow-xl overflow-hidden">
                            <h2 className="text-lg font-semibold text-gray-200 mb-4 flex items-center gap-2">
                                <Network className="w-4 h-4 text-blue-400" /> Traffic Flow Diagram (Sankey Graph)
                            </h2>
                            <div className="w-full -mt-4">
                                <FlowDiagramChart srcIp={ip} data={flowDiagram || []} isGuest={isLoggedIn === false} />
                            </div>
                        </div>

                        {/* Global Traffic Map */}
                        {donuts && (
                            <SectionCard className="overflow-hidden mb-6">
                                <GeoMapChart
                                    title="IP Traffic Sources & Destinations"
                                    data={[
                                        ...donuts.incoming.map((d: any) => ({ ip: d.src_ip, lat: d.lat, lon: d.lon, total_bytes: d.bytes, country: d.country, city: d.city })),
                                        ...donuts.outgoing.map((d: any) => ({ ip: d.dst_ip, lat: d.lat, lon: d.lon, total_bytes: d.bytes, country: d.country, city: d.city }))
                                    ].filter(d => d.lat && d.lon)}
                                    onIpClick={(clickedIp) => router.push(`/ip/${clickedIp}`)}
                                />
                            </SectionCard>
                        )}

                        {/* Donut Graphs & Services */}
                        {donuts && (() => {
                            const sortedOutgoing = [...(donuts.outgoing || [])].sort((a: any, b: any) => b.bytes - a.bytes);
                            const sortedIncoming = [...(donuts.incoming || [])].sort((a: any, b: any) => b.bytes - a.bytes);
                            const sortedPorts = [...(donuts.topPorts || [])].sort((a: any, b: any) => b.total_bytes - a.total_bytes);
                            const sortedServices = [...(donuts.topServices || [])].sort((a: any, b: any) => b.total_bytes - a.total_bytes);
                            return (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                {/* All Outgoing — paginated */}
                                <SectionCard title="All Outgoing" icon={<ArrowUpRight className="w-4 h-4 text-blue-400" />} className="flex flex-col h-full">
                                    {sortedOutgoing.length > 0 ? (() => {
                                        const totalPages = Math.ceil(sortedOutgoing.length / DONUT_PAGE_SIZE);
                                        const pageData = sortedOutgoing.slice(outgoingPage * DONUT_PAGE_SIZE, (outgoingPage + 1) * DONUT_PAGE_SIZE);
                                        return (
                                            <>
                                                <div className="h-64">
                                                    <TopHostsChart data={pageData.map((d: any) => ({ ip: d.dst_ip, total_bytes: d.bytes, displayName: d.dst_displayName }))} title="Outgoing" onIpClick={(clickedIp) => router.push(`/ip/${clickedIp}`)} />
                                                </div>
                                                {totalPages > 1 && (
                                                    <div className="flex items-center justify-between pt-2 mt-auto border-t border-gray-800">
                                                        <button onClick={() => setOutgoingPage(p => Math.max(0, p - 1))} disabled={outgoingPage === 0} className="p-1 text-gray-400 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronLeft className="w-4 h-4" /></button>
                                                        <span className="text-xs text-gray-500">{outgoingPage + 1} / {totalPages}</span>
                                                        <button onClick={() => setOutgoingPage(p => Math.min(totalPages - 1, p + 1))} disabled={outgoingPage === totalPages - 1} className="p-1 text-gray-400 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronRight className="w-4 h-4" /></button>
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })() : <p className="text-gray-500 text-sm text-center py-8">No data</p>}
                                </SectionCard>

                                {/* All Incoming — paginated */}
                                <SectionCard title="All Incoming" icon={<ArrowDownLeft className="w-4 h-4 text-emerald-400" />} className="flex flex-col h-full">
                                    {sortedIncoming.length > 0 ? (() => {
                                        const totalPages = Math.ceil(sortedIncoming.length / DONUT_PAGE_SIZE);
                                        const pageData = sortedIncoming.slice(incomingPage * DONUT_PAGE_SIZE, (incomingPage + 1) * DONUT_PAGE_SIZE);
                                        return (
                                            <>
                                                <div className="h-64">
                                                    <TopHostsChart data={pageData.map((d: any) => ({ ip: d.src_ip, total_bytes: d.bytes, displayName: d.src_displayName }))} title="Incoming" onIpClick={(clickedIp) => router.push(`/ip/${clickedIp}`)} />
                                                </div>
                                                {totalPages > 1 && (
                                                    <div className="flex items-center justify-between pt-2 mt-auto border-t border-gray-800">
                                                        <button onClick={() => setIncomingPage(p => Math.max(0, p - 1))} disabled={incomingPage === 0} className="p-1 text-gray-400 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronLeft className="w-4 h-4" /></button>
                                                        <span className="text-xs text-gray-500">{incomingPage + 1} / {totalPages}</span>
                                                        <button onClick={() => setIncomingPage(p => Math.min(totalPages - 1, p + 1))} disabled={incomingPage === totalPages - 1} className="p-1 text-gray-400 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronRight className="w-4 h-4" /></button>
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })() : <p className="text-gray-500 text-sm text-center py-8">No data</p>}
                                </SectionCard>

                                {/* All Services — paginated */}
                                <SectionCard title="All Services" icon={<Activity className="w-4 h-4 text-purple-400" />} className="flex flex-col h-full">
                                    {sortedPorts.length > 0 ? (() => {
                                        const totalPages = Math.ceil(sortedPorts.length / DONUT_PAGE_SIZE);
                                        const pageData = sortedPorts.slice(servicesPage * DONUT_PAGE_SIZE, (servicesPage + 1) * DONUT_PAGE_SIZE);
                                        return (
                                            <>
                                                <div className="h-64">
                                                    <TopPortsChart data={pageData} isGuest={isLoggedIn === false} />
                                                </div>
                                                {totalPages > 1 && (
                                                    <div className="flex items-center justify-between pt-2 mt-auto border-t border-gray-800">
                                                        <button onClick={() => setServicesPage(p => Math.max(0, p - 1))} disabled={servicesPage === 0} className="p-1 text-gray-400 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronLeft className="w-4 h-4" /></button>
                                                        <span className="text-xs text-gray-500">{servicesPage + 1} / {totalPages}</span>
                                                        <button onClick={() => setServicesPage(p => Math.min(totalPages - 1, p + 1))} disabled={servicesPage === totalPages - 1} className="p-1 text-gray-400 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronRight className="w-4 h-4" /></button>
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })() : <p className="text-gray-500 text-sm text-center py-8">No data</p>}
                                </SectionCard>

                                {/* All Applications — paginated */}
                                <SectionCard className="flex flex-col h-full">
                                    {sortedServices.length > 0 ? (() => {
                                        const totalPages = Math.ceil(sortedServices.length / DONUT_PAGE_SIZE);
                                        const pageData = sortedServices.slice(applicationsPage * DONUT_PAGE_SIZE, (applicationsPage + 1) * DONUT_PAGE_SIZE);
                                        return (
                                            <>
                                                <TopServicesCard data={pageData} title="All Applications" isGuest={isLoggedIn === false} />
                                                {totalPages > 1 && (
                                                    <div className="flex items-center justify-between pt-2 mt-auto border-t border-gray-800">
                                                        <button onClick={() => setApplicationsPage(p => Math.max(0, p - 1))} disabled={applicationsPage === 0} className="p-1 text-gray-400 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronLeft className="w-4 h-4" /></button>
                                                        <span className="text-xs text-gray-500">{applicationsPage + 1} / {totalPages}</span>
                                                        <button onClick={() => setApplicationsPage(p => Math.min(totalPages - 1, p + 1))} disabled={applicationsPage === totalPages - 1} className="p-1 text-gray-400 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronRight className="w-4 h-4" /></button>
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })() : <TopServicesCard data={[]} title="All Applications" isGuest={isLoggedIn === false} />}
                                </SectionCard>
                            </div>
                            );
                        })()}

                        {/* Top Peers */}
                        {(data.topPeersAsSrc?.length > 0 || data.topPeersAsDst?.length > 0) && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {data.topPeersAsSrc?.length > 0 && (
                                    <SectionCard title="Top Destinations (this IP as source)" icon={<ArrowUpRight className="w-4 h-4 text-blue-400" />}>
                                        <TopHostsChart
                                            data={data.topPeersAsSrc.map((r: any) => ({ ip: r.peer, total_bytes: r.total_bytes, displayName: r.peer_displayName }))}
                                            title="Top Destinations"
                                            onIpClick={(clickedIp) => router.push(`/ip/${clickedIp}`)}
                                        />
                                    </SectionCard>
                                )}
                                {data.topPeersAsDst?.length > 0 && (
                                    <SectionCard title="Top Sources (this IP as destination)" icon={<ArrowDownLeft className="w-4 h-4 text-emerald-400" />}>
                                        <TopHostsChart
                                            data={data.topPeersAsDst.map((r: any) => ({ ip: r.peer, total_bytes: r.total_bytes, displayName: r.peer_displayName }))}
                                            title="Top Sources"
                                            onIpClick={(clickedIp) => router.push(`/ip/${clickedIp}`)}
                                        />
                                    </SectionCard>
                                )}
                            </div>
                        )}

                        {/* Recent Flows */}
                        <SectionCard
                            title="Recent Flows"
                            icon={<Activity className="w-5 h-5 text-gray-400" />}
                            headerRight={
                                <Link
                                    href={`${flowLogBase}?interval=${interval}&ip=${ip}`}
                                    className="text-sm text-blue-400 hover:text-blue-300 hover:underline"
                                >
                                    View all in Flow Log →
                                </Link>
                            }
                        >
                            <FlowTable flows={data.recentFlows || []} isGuest={isLoggedIn === false} showNetworkDirection />
                        </SectionCard>
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

export default function IPDetailPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-gray-950" />}>
            <IPDetailContent />
        </Suspense>
    );
}
