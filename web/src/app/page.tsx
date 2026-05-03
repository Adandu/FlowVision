'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Activity, Globe, Clock, Server, ArrowRightLeft, ArrowUpRight, ArrowDownLeft, ArrowLeftRight, List } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import Navbar from '@/components/Navbar';
import { useTimezone, formatTimestamp, getTimezoneOffsetMinutes } from '@/lib/timezone';
import { formatBytes, formatBits } from '@/lib/formatters';

const BandwidthChart = dynamic(() => import('@/components/charts/BandwidthChart'), { ssr: false });
const TopHostsChart = dynamic(() => import('@/components/charts/TopHostsChart'), { ssr: false });
const TopPortsChart = dynamic(() => import('@/components/charts/TopPortsChart'), { ssr: false });
const ProtocolChart = dynamic(() => import('@/components/charts/ProtocolChart'), { ssr: false });
const GeoMapChart = dynamic(() => import('@/components/charts/GeoMapChart'), { ssr: false });
const TopServicesCard = dynamic(() => import('@/components/charts/TopServicesCard'), { ssr: false });
const FlowTable = dynamic(() => import('@/components/FlowTable'), { ssr: false });
const AISummaryWidget = dynamic(() => import('@/components/AISummaryWidget'), { ssr: false });

type IntervalType = '10m' | '1h' | '24h' | '1w' | '1mo';

export default function Dashboard() {
  const { timezone } = useTimezone();
  const router = useRouter();
  const [interval, setIntervalState] = useState<IntervalType | 'Live'>('Live');
  const [data, setData] = useState<any>(null);
  const [flows, setFlows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const isLoggedIn = useAuth();

  const intervals: { label: string; value: IntervalType | 'Live' }[] = [
    { label: 'Live', value: 'Live' },
    { label: '10 Mins', value: '10m' },
    { label: '1 Hour', value: '1h' },
    { label: '24 Hours', value: '24h' },
    { label: '1 Week', value: '1w' },
    { label: '1 Month', value: '1mo' },
  ];

  useEffect(() => {
    let isMounted = true;
    let timer: number;

    async function fetchData() {
      setLoading(true);
      try {
        // If Live, fetch the last 1m to show real-time spikes in 1s buckets
        const queryInterval = interval === 'Live' ? '1m' : interval;
        const [flowsRes, recentRes] = await Promise.all([
          fetch(`/api/flows?interval=${queryInterval}`),
          fetch('/api/flows/recent'),
        ]);
        const json = await flowsRes.json();
        if (isMounted && json.success) setData(json.data);

        if (recentRes.ok) {
          const rj = await recentRes.json();
          if (isMounted && rj.success) setFlows(rj.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    // Initial fetch
    fetchData();

    // Setup polling
    if (interval === 'Live') {
      timer = window.setInterval(fetchData, 1000); // 1s for Live
    } else {
      timer = window.setInterval(fetchData, 60000); // 60 seconds otherwise
    }

    return () => { isMounted = false; clearInterval(timer); };
  }, [interval]);

  const dir = data?.trafficDirection || {};

  return (
    <div className="min-h-screen bg-gray-950 pb-12">
      <Navbar />

      <main className="w-full px-4 sm:px-6 lg:px-8 2xl:px-12 mt-8 space-y-6">
        {/* AI Summary Widget - shows only if AI is configured */}
        <AISummaryWidget interval={interval === 'Live' ? '10m' : interval} context="dashboard" />

        {/* Interval selector */}
        <div className="flex space-x-2 justify-end">
          {intervals.map((int) => (
            <button key={int.value} onClick={() => setIntervalState(int.value)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${interval === int.value
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.15)]'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800 border border-transparent'}`}>
              {int.label}
            </button>
          ))}
        </div>

        {/* Header Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="Total Bandwidth" value={!data && loading ? '...' : formatBits(Number(dir.total_bps) || 0)} icon={<ArrowRightLeft />} color="blue" span={2} />
          <StatCard title="Outbound" value={!data && loading ? '...' : formatBits(Number(dir.outbound_bps) || 0)} icon={<ArrowUpRight />} color="orange" span={1} />
          <StatCard title="Inbound" value={!data && loading ? '...' : formatBits(Number(dir.inbound_bps) || 0)} icon={<ArrowDownLeft />} color="teal" span={1} />
          <StatCard title="Internal" value={!data && loading ? '...' : formatBits(Number(dir.internal_bps) || 0)} icon={<ArrowLeftRight />} color="purple" span={1} />
          <StatCard title="Active IPs" value={!data && loading ? '...' : (data?.activeIpCount ?? 0).toString()} icon={<Globe />} color="emerald" href={`/active-ips?interval=${interval}`} span={1} />
          <StatCard title="Active Services" value={!data && loading ? '...' : (data?.activePortCount ?? 0).toString()} icon={<Server />} color="purple" href={`/active-services?interval=${interval}`} span={1} />
          <StatCard title="Active Applications" value={!data && loading ? '...' : (data?.topServices?.length || 0).toString()} icon={<Activity />} color="orange" href={`/active-applications?interval=${interval}`} span={1} />
        </div>

        {/* Inbound=0 diagnostic hint — shown when traffic exists but no inbound detected */}
        {data && Number(dir.total_bps) > 0 && Number(dir.inbound_bps) === 0 && (
          <div className="flex items-start gap-2.5 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300">
            <span className="shrink-0 mt-0.5">⚠️</span>
            <span>
              <strong>Inbound traffic is 0 bps</strong> — all observed flows contain only private IP addresses, so no internet-bound traffic is being classified.
              If OPNsense is running in <strong>transparent bridge mode</strong>, add the <strong>WAN-side bridge member port</strong> (the physical port facing your upstream router) to the NetFlow export interfaces under <strong>Services → Netflow → Interfaces</strong>.
              This ensures flows crossing the WAN boundary are captured with real public source IPs.
            </span>
          </div>
        )}

        {/* Bandwidth Chart */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 backdrop-blur-sm shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
              <Clock className="w-5 h-5 text-gray-400" /> Traffic Overview
              <span className="text-xs text-gray-500 font-normal ml-2">({timezone})</span>
            </h2>
            {loading && <div className="animate-pulse w-3 h-3 rounded-full bg-blue-500" />}
          </div>
          {data && <BandwidthChart data={data.timeSeries} timezone={timezone} tzOffsetMinutes={getTimezoneOffsetMinutes(timezone)} interval={interval} />}
        </div>

        {/* Protocol + Top Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Top Destinations */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 backdrop-blur-sm shadow-xl flex flex-col h-full">
            <h2 className="text-base font-semibold text-gray-200 mb-3 flex items-center justify-center gap-1.5"><ArrowUpRight className="w-4 h-4 text-blue-400" />Top 10 Destinations</h2>
            <div className="flex-1 w-full relative">
              {data && <TopHostsChart data={data.topDestinations.slice(0, 10)} title="Top 10 Destinations" onIpClick={(ip) => router.push(`/ip/${ip}`)} />}
            </div>
          </div>

          {/* Top Sources */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 backdrop-blur-sm shadow-xl flex flex-col h-full">
            <h2 className="text-base font-semibold text-gray-200 mb-3 flex items-center justify-center gap-1.5"><ArrowDownLeft className="w-4 h-4 text-emerald-400" />Top 10 Sources</h2>
            <div className="flex-1 w-full relative">
              {data && <TopHostsChart data={data.topSources.slice(0, 10)} title="Top 10 Sources" onIpClick={(ip) => router.push(`/ip/${ip}`)} />}
            </div>
          </div>

          {/* Top Ports (now Services) */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 backdrop-blur-sm shadow-xl flex flex-col h-full">
            <h2 className="text-base font-semibold text-gray-200 mb-3 flex items-center justify-center gap-1.5"><Server className="w-4 h-4 text-purple-400" />Top 10 Services</h2>
            <div className="flex-1 w-full relative">
              {data && <TopPortsChart data={data.topPorts.slice(0, 10)} isGuest={isLoggedIn === false} />}
            </div>
          </div>

          {/* Protocol Breakdown */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 backdrop-blur-sm shadow-xl">
            <h2 className="text-base font-semibold text-gray-200 mb-3 flex items-center justify-center gap-1.5"><ArrowLeftRight className="w-4 h-4 text-amber-400" />Protocol Breakdown</h2>
            {data?.protocolBreakdown?.length > 0 && <ProtocolChart data={data.protocolBreakdown} isGuest={isLoggedIn === false} />}
          </div>

          {/* Top Applications (ASN-based) - always rendered even if empty */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 backdrop-blur-sm shadow-xl flex flex-col h-full">
            <TopServicesCard data={data?.topServices?.slice(0, 10) || []} title="Top 10 Applications" isGuest={isLoggedIn === false} />
          </div>
        </div>

        {/* Global Traffic Map */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 backdrop-blur-sm shadow-xl">
          {data && (
            <GeoMapChart
              title="Global Traffic Map"
              data={data.geoTraffic || []}
              onIpClick={(ip) => router.push(`/ip/${ip}`)}
            />
          )}
        </div>

        {/* Flow Table — no overlay so IPs remain clickable for guests */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 backdrop-blur-sm shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
              <List className="w-5 h-5 text-gray-400" /> Recent Flows
            </h2>
            <Link href="/flow-log" className="text-sm text-blue-400 hover:text-blue-300 hover:underline">View all →</Link>
          </div>
          {flows.length > 0 && <FlowTable flows={flows} isGuest={isLoggedIn === false} showNetworkDirection />}
          {flows.length === 0 && !loading && <p className="text-gray-500 text-sm text-center py-8">No flows recorded yet</p>}
        </div>
      </main>
    </div>
  );
}

function StatCard({ title, value, icon, color, span = 1, href }: { title: string, value: string, icon: React.ReactNode, color: string, span?: number, href?: string }) {
  const colorMap: Record<string, string> = {
    blue: 'from-blue-500/20 to-blue-500/0 border-blue-500/30 text-blue-400',
    emerald: 'from-emerald-500/20 to-emerald-500/0 border-emerald-500/30 text-emerald-400',
    purple: 'from-purple-500/20 to-purple-500/0 border-purple-500/30 text-purple-400',
    orange: 'from-orange-500/20 to-orange-500/0 border-orange-500/30 text-orange-400',
    teal: 'from-teal-500/20 to-teal-500/0 border-teal-500/30 text-teal-400',
  };
  const innerClass = `bg-gradient-to-br ${colorMap[color] || colorMap.blue} bg-gray-900/80 border rounded-xl p-5 backdrop-blur-md relative overflow-hidden group hover:shadow-lg transition-all ${!href && span === 2 ? 'col-span-2' : ''} ${href ? 'cursor-pointer hover:border-gray-500/50' : ''} h-full`;

  const content = (
    <div className={innerClass}>
      <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-current opacity-5 group-hover:opacity-10 transition-opacity blur-2xl" />
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-gray-400 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-100">{value}</p>
        </div>
        <div className="p-2.5 bg-gray-800/50 rounded-lg border border-gray-700/50">{icon}</div>
      </div>
    </div>
  );

  return href ? (
    <Link href={href} className={`block ${span === 2 ? 'col-span-2' : ''}`}>
      {content}
    </Link>
  ) : content;
}

