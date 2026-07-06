'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import nextDynamic from 'next/dynamic';
import { Activity, Globe, Clock, Server, ArrowRightLeft, ArrowUpRight, ArrowDownLeft, ArrowLeftRight, List } from 'lucide-react';
import { useFilters } from '@/hooks/useFilters';
import Navbar from '@/components/Navbar';
import FilterBar from '@/components/FilterBar';
import StatCard from '@/components/StatCard';
import SectionCard from '@/components/SectionCard';
import { useTimezone, getTimezoneOffsetMinutes } from '@/lib/timezone';
import { formatBits } from '@/lib/formatters';

const BandwidthChart = nextDynamic(() => import('@/components/charts/BandwidthChart'), { ssr: false });
const TopHostsChart = nextDynamic(() => import('@/components/charts/TopHostsChart'), { ssr: false });
const TopPortsChart = nextDynamic(() => import('@/components/charts/TopPortsChart'), { ssr: false });
const ProtocolChart = nextDynamic(() => import('@/components/charts/ProtocolChart'), { ssr: false });
const GeoMapChart = nextDynamic(() => import('@/components/charts/GeoMapChart'), { ssr: false });
const TopServicesCard = nextDynamic(() => import('@/components/charts/TopServicesCard'), { ssr: false });
const FlowTable = nextDynamic(() => import('@/components/FlowTable'), { ssr: false });
const AISummaryWidget = nextDynamic(() => import('@/components/AISummaryWidget'), { ssr: false });

function DashboardContent() {
  const { timezone } = useTimezone();
  const router = useRouter();
  const { interval, toApiParams, activeCount, ...filterRest } = useFilters('Live');
  const [data, setData] = useState<any>(null);
  const [flows, setFlows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let timer: number;

    async function fetchData() {
      setLoading(true);
      try {
        const apiParams = toApiParams();
        const queryInterval = apiParams.interval === 'Live' ? '1m' : apiParams.interval;
        const params = new URLSearchParams({ ...apiParams, interval: queryInterval });
        const [flowsRes, recentRes] = await Promise.all([
          fetch(`/api/flows?${params}`),
          fetch(`/api/flows/recent?${params}`),
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

    fetchData();

    if (interval === 'Live') {
      timer = window.setInterval(fetchData, 1000);
    } else {
      timer = window.setInterval(fetchData, 60000);
    }

    return () => { isMounted = false; clearInterval(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interval, filterRest.srcIp, filterRest.dstIp, filterRest.port, filterRest.protocol, filterRest.from, filterRest.to]);

  const dir = data?.trafficDirection || {};

  return (
    <div className="min-h-screen bg-gray-950 pb-12">
      <Navbar />

      <main className="w-full px-4 sm:px-6 lg:px-8 2xl:px-12 mt-8 space-y-6">
        {/* AI Summary Widget - shows only if AI is configured */}
        <AISummaryWidget interval={interval === 'Live' ? '10m' : interval} context="dashboard" />

        {/* Global Filter Bar */}
        <FilterBar
          filters={{ interval, ...filterRest }}
          setFilter={filterRest.setFilter}
          clearAll={filterRest.clearAll}
          activeCount={activeCount}
        />

        {/* Header Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="Total Bandwidth" value={!data && loading ? '...' : formatBits(Number(dir.total_bps) || 0)} icon={<ArrowRightLeft />} color="blue" span={2} />
          <StatCard title="Outbound" value={!data && loading ? '...' : formatBits(Number(dir.outbound_bps) || 0)} icon={<ArrowUpRight />} color="orange" />
          <StatCard title="Inbound" value={!data && loading ? '...' : formatBits(Number(dir.inbound_bps) || 0)} icon={<ArrowDownLeft />} color="teal" />
          <StatCard title="Internal" value={!data && loading ? '...' : formatBits(Number(dir.internal_bps) || 0)} icon={<ArrowLeftRight />} color="purple" />
          <StatCard title="Active IPs" value={!data && loading ? '...' : (data?.activeIpCount ?? 0).toString()} icon={<Globe />} color="emerald" href={`/active-ips?interval=${interval}`} />
          <StatCard title="Active Services" value={!data && loading ? '...' : (data?.activePortCount ?? 0).toString()} icon={<Server />} color="purple" href={`/active-services?interval=${interval}`} />
          <StatCard title="Active Applications" value={!data && loading ? '...' : (data?.topServices?.length || 0).toString()} icon={<Activity />} color="orange" href={`/active-applications?interval=${interval}`} />
        </div>

        {/* Inbound=0 diagnostic hint */}
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
        <SectionCard
          title="Traffic Overview"
          icon={<Clock className="w-5 h-5 text-gray-400" />}
          titleSuffix={<span className="text-xs text-gray-500 font-normal ml-2">({timezone})</span>}
          headerRight={loading ? <div className="animate-pulse w-3 h-3 rounded-full bg-blue-500" /> : undefined}
          className="backdrop-blur-sm"
        >
          {data && <BandwidthChart data={data.timeSeries} timezone={timezone} tzOffsetMinutes={getTimezoneOffsetMinutes(timezone)} interval={interval} />}
        </SectionCard>

        {/* Protocol + Top Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <SectionCard title="Top 10 Destinations" icon={<ArrowUpRight className="w-4 h-4 text-blue-400" />} className="backdrop-blur-sm flex flex-col h-full">
            <div className="flex-1 w-full relative">
              {data && <TopHostsChart data={data.topDestinations.slice(0, 10)} title="Top 10 Destinations" onIpClick={(ip) => router.push(`/ip/${ip}`)} />}
            </div>
          </SectionCard>

          <SectionCard title="Top 10 Sources" icon={<ArrowDownLeft className="w-4 h-4 text-emerald-400" />} className="backdrop-blur-sm flex flex-col h-full">
            <div className="flex-1 w-full relative">
              {data && <TopHostsChart data={data.topSources.slice(0, 10)} title="Top 10 Sources" onIpClick={(ip) => router.push(`/ip/${ip}`)} />}
            </div>
          </SectionCard>

          <SectionCard title="Top 10 Services" icon={<Server className="w-4 h-4 text-purple-400" />} className="backdrop-blur-sm flex flex-col h-full">
            <div className="flex-1 w-full relative">
              {data && <TopPortsChart data={data.topPorts.slice(0, 10)} />}
            </div>
          </SectionCard>

          <SectionCard title="Protocol Breakdown" icon={<ArrowLeftRight className="w-4 h-4 text-amber-400" />} className="backdrop-blur-sm">
            {data?.protocolBreakdown?.length > 0 && <ProtocolChart data={data.protocolBreakdown} />}
          </SectionCard>

          <SectionCard className="backdrop-blur-sm flex flex-col h-full">
            <TopServicesCard data={data?.topServices?.slice(0, 10) || []} title="Top 10 Applications" />
          </SectionCard>
        </div>

        {/* Global Traffic Map */}
        <SectionCard className="backdrop-blur-sm">
          {data && (
            <GeoMapChart
              title="Global Traffic Map"
              data={data.geoTraffic || []}
              onIpClick={(ip) => router.push(`/ip/${ip}`)}
            />
          )}
        </SectionCard>

        {/* Recent Flows */}
        <SectionCard
          title="Recent Flows"
          icon={<List className="w-5 h-5 text-gray-400" />}
          headerRight={<Link href="/flow-log" className="text-sm text-blue-400 hover:text-blue-300 hover:underline">View all →</Link>}
          className="backdrop-blur-sm"
        >
          {flows.length > 0 && <FlowTable flows={flows} showNetworkDirection />}
          {flows.length === 0 && !loading && <p className="text-gray-500 text-sm text-center py-8">No flows recorded yet</p>}
        </SectionCard>
      </main>
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950" />}>
      <DashboardContent />
    </Suspense>
  );
}
