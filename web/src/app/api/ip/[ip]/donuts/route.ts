import { NextResponse } from 'next/server';
import { clickhouse } from '@/lib/clickhouse';
import { applyAliases } from '@/lib/aliases';
import { getCurrentUser, obfuscateIp } from '@/lib/auth';

export async function GET(req: Request, { params }: { params: Promise<{ ip: string }> }) {
    try {
        const { ip } = await params;
        const url = new URL(req.url);
        const interval = url.searchParams.get('interval') || '24h';

        // Same time math as dashboard
        let timeFilter = 'timestamp >= now() - INTERVAL 24 HOUR';
        switch (interval) {
            case '10m': timeFilter = 'timestamp >= now() - INTERVAL 10 MINUTE'; break;
            case '1h': timeFilter = 'timestamp >= now() - INTERVAL 1 HOUR'; break;
            case '7d': timeFilter = 'timestamp >= now() - INTERVAL 7 DAY'; break;
            case '30d': timeFilter = 'timestamp >= now() - INTERVAL 30 DAY'; break;
        }

        const incomingQuery = `
            SELECT src_ip, sum(bytes) as bytes
            FROM flows
            WHERE dst_ip = {ip:String} AND ${timeFilter}
            GROUP BY src_ip
            ORDER BY bytes DESC
            LIMIT 5
        `;
        const incoming = await clickhouse.query({
            query: incomingQuery,
            query_params: { ip },
            format: 'JSONEachRow'
        }).then(r => r.json());

        const outgoingQuery = `
            SELECT dst_ip, sum(bytes) as bytes
            FROM flows
            WHERE src_ip = {ip:String} AND ${timeFilter}
            GROUP BY dst_ip
            ORDER BY bytes DESC
            LIMIT 5
        `;
        const outgoing = await clickhouse.query({
            query: outgoingQuery,
            query_params: { ip },
            format: 'JSONEachRow'
        }).then(r => r.json());

        const portsQuery = `
            SELECT dst_port, protocol, sum(bytes) as bytes
            FROM flows
            WHERE (src_ip = {ip:String} OR dst_ip = {ip:String}) AND ${timeFilter}
            GROUP BY dst_port, protocol
            ORDER BY bytes DESC
            LIMIT 5
        `;
        const topPorts = await clickhouse.query({
            query: portsQuery,
            query_params: { ip },
            format: 'JSONEachRow'
        }).then(r => r.json());

        const user = await getCurrentUser();

        // Collect unique IPs for GeoLookup before obfuscation
        const allIps = new Set<string>();
        incoming.forEach((r: any) => allIps.add(r.src_ip));
        outgoing.forEach((r: any) => allIps.add(r.dst_ip));

        const { batchGeoIPLookup } = await import('@/lib/geoip');
        const geoDataMap = await batchGeoIPLookup(Array.from(allIps));

        const { identifyService } = await import('@/lib/services');
        const serviceMap = new Map<string, { total_bytes: number; color: string }>();

        function asnColor(label: string): string {
            let h = 0;
            for (let i = 0; i < label.length; i++) h = (Math.imul(31, h) + label.charCodeAt(i)) | 0;
            return `hsl(${((h >>> 0) % 360)}, 45%, 52%)`;
        }

        function addToServiceMap(ip: string, bytes: number) {
            const geo = geoDataMap[ip];
            if (!geo || geo.private) return;
            const asnStr = geo.asn || geo.isp;
            const svc = asnStr ? identifyService(asnStr) : null;
            if (svc) {
                const current = serviceMap.get(svc.name) || { total_bytes: 0, color: svc.color };
                current.total_bytes += Number(bytes);
                serviceMap.set(svc.name, current);
            } else {
                const label = asnStr || 'Other';
                const color = label === 'Other' ? '#4B5563' : asnColor(label);
                const current = serviceMap.get(label) || { total_bytes: 0, color };
                current.total_bytes += Number(bytes);
                serviceMap.set(label, current);
            }
        }

        incoming.forEach((r: any) => {
            const geo = geoDataMap[r.src_ip];
            if (geo) { r.lat = geo.lat; r.lon = geo.lon; r.country = geo.country; r.city = geo.city; }
            addToServiceMap(r.src_ip, r.bytes);
        });

        outgoing.forEach((r: any) => {
            const geo = geoDataMap[r.dst_ip];
            if (geo) { r.lat = geo.lat; r.lon = geo.lon; r.country = geo.country; r.city = geo.city; }
            addToServiceMap(r.dst_ip, r.bytes);
        });

        const topServices = Array.from(serviceMap.entries())
            .map(([service, data]) => ({ service, total_bytes: data.total_bytes, color: data.color }))
            .sort((a, b) => b.total_bytes - a.total_bytes)
            .slice(0, 5);

        if (!user) {
            incoming.forEach((r: any) => r.src_ip = obfuscateIp(r.src_ip));
            outgoing.forEach((r: any) => r.dst_ip = obfuscateIp(r.dst_ip));
        } else {
            await applyAliases(incoming);
            await applyAliases(outgoing);
        }

        return NextResponse.json({ success: true, incoming, outgoing, topPorts, topServices });
    } catch (error) {
        console.error('Failed to fetch IP pie chart data:', error);
        return NextResponse.json({ success: false }, { status: 500 });
    }
}
