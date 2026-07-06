import { NextResponse } from 'next/server';
import { clickhouse } from '@/lib/clickhouse';
import { applyAliases } from '@/lib/aliases';
import { buildTimeFilter } from '@/lib/queryFilters';

export async function GET(req: Request, { params }: { params: Promise<{ ip: string }> }) {
    const { ip } = await params;
    const url = new URL(req.url);
    const interval = url.searchParams.get('interval') || '24h';
    const from = url.searchParams.get('from') || '';
    const to = url.searchParams.get('to') || '';

    let timeFilter = buildTimeFilter({ interval, from, to });
    let timeGroup = 'toStartOfHour(timestamp)';
    let fillFrom = 'toStartOfHour(now() - INTERVAL 24 HOUR)';
    let fillTo = 'toStartOfHour(now())';
    let fillStep = '3600';

    // timeFilter is set by buildTimeFilter; only set chart bucketing vars here
    switch (interval) {
        case '1m':
            timeGroup = 'toStartOfInterval(timestamp, INTERVAL 1 SECOND)';
            fillFrom = 'toStartOfInterval(now() - INTERVAL 1 MINUTE, INTERVAL 1 SECOND)';
            fillTo = 'toStartOfInterval(now(), INTERVAL 1 SECOND)';
            fillStep = '1';
            break;
        case '10m':
            timeGroup = 'toStartOfMinute(timestamp)';
            fillFrom = 'toStartOfMinute(now() - INTERVAL 10 MINUTE)';
            fillTo = 'toStartOfMinute(now())';
            fillStep = '60';
            break;
        case '1h':
            timeGroup = 'toStartOfMinute(timestamp)';
            fillFrom = 'toStartOfMinute(now() - INTERVAL 1 HOUR)';
            fillTo = 'toStartOfMinute(now())';
            fillStep = '60';
            break;
        case '7d':
        case '1w':
            timeGroup = 'toStartOfHour(timestamp)';
            fillFrom = 'toStartOfHour(now() - INTERVAL 7 DAY)';
            fillTo = 'toStartOfHour(now())';
            fillStep = '3600';
            break;
        case '30d':
        case '1mo':
            timeGroup = 'toStartOfDay(timestamp)';
            fillFrom = 'toStartOfDay(now() - INTERVAL 30 DAY)';
            fillTo = 'toStartOfDay(now())';
            fillStep = '86400';
            break;
        // custom: keep defaults (hourly buckets); WITH FILL is omitted for arbitrary ranges
    }

    try {
        const [
            summaryRows,
            timelineAsSrcRows,
            timelineAsDstRows,
            topPeersAsSrcRows,
            topPeersAsDstRows,
            portBreakdownRows,
            protocolBreakdownRows,
            recentFlowsRows,
            servicePeerRows,
        ] = await Promise.all([
            // Summary stats
            clickhouse.query({
                query: `
                    SELECT
                        countIf(src_ip = {ip:String}) AS flows_as_src,
                        countIf(dst_ip = {ip:String}) AS flows_as_dst,
                        sumIf(bytes, src_ip = {ip:String}) AS bytes_sent,
                        sumIf(bytes, dst_ip = {ip:String}) AS bytes_received,
                        min(timestamp) AS first_seen,
                        max(timestamp) AS last_seen
                    FROM flows
                    WHERE (src_ip = {ip:String} OR dst_ip = {ip:String}) AND ${timeFilter}
                `,
                query_params: { ip },
                format: 'JSONEachRow',
            }).then(r => r.json()),

            // Bandwidth timeline as source
            clickhouse.query({
                query: `
                    SELECT ${timeGroup} AS time, toUInt64(SUM(bytes)) AS bytes, round(bytes * 8 / ${fillStep}, 2) AS bits_per_second
                    FROM flows
                    WHERE src_ip = {ip:String} AND ${timeFilter}
                    GROUP BY time ORDER BY time ASC
                    ${interval !== 'custom' ? `WITH FILL FROM ${fillFrom} TO ${fillTo} STEP ${fillStep}` : ''}
                `,
                query_params: { ip },
                format: 'JSONEachRow',
            }).then(r => r.json()),

            // Bandwidth timeline as destination
            clickhouse.query({
                query: `
                    SELECT ${timeGroup} AS time, toUInt64(SUM(bytes)) AS bytes, round(bytes * 8 / ${fillStep}, 2) AS bits_per_second
                    FROM flows
                    WHERE dst_ip = {ip:String} AND ${timeFilter}
                    GROUP BY time ORDER BY time ASC
                    ${interval !== 'custom' ? `WITH FILL FROM ${fillFrom} TO ${fillTo} STEP ${fillStep}` : ''}
                `,
                query_params: { ip },
                format: 'JSONEachRow',
            }).then(r => r.json()),

            // Top peers when this IP is the source (top 50)
            clickhouse.query({
                query: `
                    SELECT dst_ip AS peer, SUM(bytes) AS total_bytes, count() AS flow_count
                    FROM flows
                    WHERE src_ip = {ip:String} AND ${timeFilter}
                    GROUP BY peer ORDER BY total_bytes DESC LIMIT 10
                `,
                query_params: { ip },
                format: 'JSONEachRow',
            }).then(r => r.json()),

            // Top peers when this IP is the destination (top 50)
            clickhouse.query({
                query: `
                    SELECT src_ip AS peer, SUM(bytes) AS total_bytes, count() AS flow_count
                    FROM flows
                    WHERE dst_ip = {ip:String} AND ${timeFilter}
                    GROUP BY peer ORDER BY total_bytes DESC LIMIT 10
                `,
                query_params: { ip },
                format: 'JSONEachRow',
            }).then(r => r.json()),

            // All ports used by this IP (no limit — this is a detail page)
            clickhouse.query({
                query: `
                    SELECT
                        multiIf(protocol = 6, 'TCP', protocol = 17, 'UDP', protocol = 1, 'ICMP', 'Other') AS proto,
                        dst_port AS port,
                        SUM(bytes) AS total_bytes,
                        count() AS flow_count
                    FROM flows
                    WHERE (src_ip = {ip:String} OR dst_ip = {ip:String}) AND ${timeFilter}
                    GROUP BY proto, port ORDER BY total_bytes DESC
                `,
                query_params: { ip },
                format: 'JSONEachRow',
            }).then(r => r.json()),

            // Protocol breakdown
            clickhouse.query({
                query: `
                    SELECT
                        multiIf(protocol = 6, 'TCP', protocol = 17, 'UDP', protocol = 1, 'ICMP', 'Other') AS proto,
                        SUM(bytes) AS total_bytes,
                        count() AS flow_count
                    FROM flows
                    WHERE (src_ip = {ip:String} OR dst_ip = {ip:String}) AND ${timeFilter}
                    GROUP BY proto ORDER BY total_bytes DESC
                `,
                query_params: { ip },
                format: 'JSONEachRow',
            }).then(r => r.json()),

            // Recent flows (last 100)
            clickhouse.query({
                query: `
                    SELECT
                        max(timestamp) as last_flow_time,
                        src_ip, dst_ip, src_port, dst_port,
                        multiIf(protocol = 6, 'TCP', protocol = 17, 'UDP', protocol = 1, 'ICMP', 'Other') AS protocol,
                        SUM(bytes) as bytes, SUM(packets) as packets
                    FROM flows
                    WHERE (src_ip = {ip:String} OR dst_ip = {ip:String}) AND ${timeFilter}
                    GROUP BY src_ip, dst_ip, src_port, dst_port, protocol
                    ORDER BY last_flow_time DESC LIMIT 100
                `,
                query_params: { ip },
                format: 'JSONEachRow',
            }).then(r => r.json()),

            // Per-peer, per-port totals — the join needed to classify traffic by
            // real-world service (ASN/org match, falling back to L7 port app name).
            // Same shape/limits as the port breakdown query above, just grouped one
            // level finer (peer IP included) so each byte can be attributed to a peer's ASN.
            clickhouse.query({
                query: `
                    SELECT
                        multiIf(src_ip = {ip:String}, dst_ip, src_ip) AS peer_ip,
                        dst_port AS port,
                        SUM(bytes) AS total_bytes,
                        count() AS flow_count
                    FROM flows
                    WHERE (src_ip = {ip:String} OR dst_ip = {ip:String}) AND ${timeFilter}
                    GROUP BY peer_ip, port ORDER BY total_bytes DESC LIMIT 500
                `,
                query_params: { ip },
                format: 'JSONEachRow',
            }).then(r => r.json()),
        ]);

        // Enrich port breakdown with app names
        const { getAppName } = await import('@/lib/protocols');
        const portBreakdownEnriched = (portBreakdownRows as any[]).map(r => ({
            ...r,
            app_name: getAppName(Number(r.port)),
        }));

        // GeoIP enrichment for recent flows (adds src_asn / dst_asn)
        const { batchGeoIPLookup } = await import('@/lib/geoip');
        const flowIps = new Set<string>();
        recentFlowsRows.forEach((r: any) => {
            if (r.src_ip) flowIps.add(r.src_ip);
            if (r.dst_ip) flowIps.add(r.dst_ip);
        });
        const flowGeoMap = await batchGeoIPLookup(Array.from(flowIps));
        recentFlowsRows.forEach((r: any) => {
            const srcGeo = flowGeoMap[r.src_ip];
            if (srcGeo) r.src_asn = srcGeo.asn || srcGeo.isp;
            const dstGeo = flowGeoMap[r.dst_ip];
            if (dstGeo) r.dst_asn = dstGeo.asn || dstGeo.isp;
        });

        // Traffic by Service: classify each peer+port total into a real-world
        // service. Primary signal is the peer's ASN/org name (Facebook, Netflix,
        // Google, etc. via lib/services.ts); anything that doesn't match a known
        // org falls back to the L7 port-based app name (lib/protocols.ts) so
        // ASN-agnostic traffic like BitTorrent (residential/hosting peers, not a
        // "BitTorrent Inc" ASN) still gets a sensible bucket instead of "Other".
        const { identifyService } = await import('@/lib/services');
        const peerIps = Array.from(new Set((servicePeerRows as any[]).map(r => r.peer_ip).filter(Boolean)));
        const peerGeoMap = await batchGeoIPLookup(peerIps);

        interface ServiceBucket { service: string; total_bytes: number; flow_count: number; color: string; ports: Set<number>; source: 'asn' | 'l7' | 'internal' | 'other'; }
        const serviceBuckets = new Map<string, ServiceBucket>();

        function hashColor(label: string): string {
            let h = 0;
            for (let i = 0; i < label.length; i++) h = (Math.imul(31, h) + label.charCodeAt(i)) | 0;
            return `hsl(${((h >>> 0) % 360)}, 45%, 52%)`;
        }

        for (const r of servicePeerRows as any[]) {
            const geo = peerGeoMap[r.peer_ip];
            const portNum = Number(r.port);
            const bytes = Number(r.total_bytes);
            const flows = Number(r.flow_count);

            let bucketName: string;
            let color: string;
            let source: ServiceBucket['source'];

            if (geo?.private) {
                bucketName = 'Internal / LAN';
                color = '#6B7280';
                source = 'internal';
            } else {
                const asnStr = geo?.asn || geo?.isp;
                const svc = asnStr ? identifyService(asnStr) : null;
                if (svc) {
                    bucketName = svc.name;
                    color = svc.color;
                    source = 'asn';
                } else {
                    const appName = getAppName(portNum);
                    if (!appName.startsWith('Port ')) {
                        bucketName = appName;
                        color = hashColor(appName);
                        source = 'l7';
                    } else {
                        bucketName = 'Other / Unclassified';
                        color = '#4B5563';
                        source = 'other';
                    }
                }
            }

            const bucket = serviceBuckets.get(bucketName) || { service: bucketName, total_bytes: 0, flow_count: 0, color, ports: new Set<number>(), source };
            bucket.total_bytes += bytes;
            bucket.flow_count += flows;
            bucket.ports.add(portNum);
            serviceBuckets.set(bucketName, bucket);
        }

        const serviceBreakdown = Array.from(serviceBuckets.values())
            .map(b => ({
                service: b.service,
                total_bytes: b.total_bytes,
                flow_count: b.flow_count,
                color: b.color,
                source: b.source,
                // Only offer a port-scoped drill-down link when the whole bucket
                // came from a single port — otherwise the flow log link falls
                // back to just the IP filter (still correct, just less specific).
                drillPort: b.ports.size === 1 ? Array.from(b.ports)[0] : null,
            }))
            .sort((a, b) => b.total_bytes - a.total_bytes)
            .slice(0, 30);

        await applyAliases(topPeersAsSrcRows);
        await applyAliases(topPeersAsDstRows);
        recentFlowsRows.forEach((r: any) => { r.timestamp = r.last_flow_time; });
        await applyAliases(recentFlowsRows);

        return NextResponse.json({
            success: true,
            data: {
                requested_ip: ip,
                summary: summaryRows[0] || null,
                timelineAsSrc: timelineAsSrcRows,
                timelineAsDst: timelineAsDstRows,
                topPeersAsSrc: topPeersAsSrcRows,
                topPeersAsDst: topPeersAsDstRows,
                portBreakdown: portBreakdownEnriched,
                protocolBreakdown: protocolBreakdownRows,
                serviceBreakdown,
                recentFlows: recentFlowsRows,
            }
        });
    } catch (error) {
        console.error('IP details error:', error);
        return NextResponse.json({ success: false, error: 'Database query failed' }, { status: 500 });
    }
}
