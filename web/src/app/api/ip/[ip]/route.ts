import { NextResponse } from 'next/server';
import { clickhouse } from '@/lib/clickhouse';
import { applyAliases } from '@/lib/aliases';
import { getCurrentUser, obfuscateIp } from '@/lib/auth';

export async function GET(req: Request, { params }: { params: Promise<{ ip: string }> }) {
    const { ip } = await params;
    const url = new URL(req.url);
    const interval = url.searchParams.get('interval') || '24h';

    let timeFilter = 'timestamp >= now() - INTERVAL 24 HOUR';
    let timeGroup = 'toStartOfMinute(timestamp)';

    switch (interval) {
        case '10m':
            timeFilter = 'timestamp >= now() - INTERVAL 10 MINUTE';
            timeGroup = 'toStartOfMinute(timestamp)';
            break;
        case '1h':
            timeFilter = 'timestamp >= now() - INTERVAL 1 HOUR';
            timeGroup = 'toStartOfMinute(timestamp)';
            break;
        case '24h':
            timeFilter = 'timestamp >= now() - INTERVAL 24 HOUR';
            timeGroup = 'toStartOfHour(timestamp)';
            break;
        case '7d':
            timeFilter = 'timestamp >= now() - INTERVAL 7 DAY';
            timeGroup = 'toStartOfHour(timestamp)';
            break;
        case '30d':
            timeFilter = 'timestamp >= now() - INTERVAL 30 DAY';
            timeGroup = 'toStartOfDay(timestamp)';
            break;
    }

    try {
        const [
            summaryRows,
            timelineAsSrcRows,
            timelineAsDstRows,
            topPeersAsSrcRows,
            topPeersAsDstRows,
            topPortsRows,
            recentFlowsRows,
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
                    SELECT ${timeGroup} AS time, SUM(bytes) AS bytes
                    FROM flows
                    WHERE src_ip = {ip:String} AND ${timeFilter}
                    GROUP BY time ORDER BY time ASC
                `,
                query_params: { ip },
                format: 'JSONEachRow',
            }).then(r => r.json()),

            // Bandwidth timeline as destination
            clickhouse.query({
                query: `
                    SELECT ${timeGroup} AS time, SUM(bytes) AS bytes
                    FROM flows
                    WHERE dst_ip = {ip:String} AND ${timeFilter}
                    GROUP BY time ORDER BY time ASC
                `,
                query_params: { ip },
                format: 'JSONEachRow',
            }).then(r => r.json()),

            // Top peers when this IP is the source
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

            // Top peers when this IP is the destination
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

            // Top ports used by this IP
            clickhouse.query({
                query: `
                    SELECT
                        multiIf(protocol = 6, 'TCP', protocol = 17, 'UDP', protocol = 1, 'ICMP', 'Other') AS proto,
                        dst_port AS port,
                        SUM(bytes) AS total_bytes,
                        count() AS flow_count
                    FROM flows
                    WHERE (src_ip = {ip:String} OR dst_ip = {ip:String}) AND ${timeFilter}
                    GROUP BY proto, port ORDER BY total_bytes DESC LIMIT 15
                `,
                query_params: { ip },
                format: 'JSONEachRow',
            }).then(r => r.json()),

            // Recent flows (last 100)
            clickhouse.query({
                query: `
                    SELECT
                        timestamp, src_ip, dst_ip, src_port, dst_port,
                        multiIf(protocol = 6, 'TCP', protocol = 17, 'UDP', protocol = 1, 'ICMP', 'Other') AS protocol,
                        bytes, packets
                    FROM flows
                    WHERE (src_ip = {ip:String} OR dst_ip = {ip:String}) AND ${timeFilter}
                    ORDER BY timestamp DESC LIMIT 100
                `,
                query_params: { ip },
                format: 'JSONEachRow',
            }).then(r => r.json()),
        ]);

        const user = await getCurrentUser();
        if (!user) {
            topPeersAsSrcRows.forEach((r: any) => r.peer = obfuscateIp(r.peer));
            topPeersAsDstRows.forEach((r: any) => r.peer = obfuscateIp(r.peer));
            recentFlowsRows.forEach((r: any) => {
                r.src_ip = obfuscateIp(r.src_ip);
                r.dst_ip = obfuscateIp(r.dst_ip);
            });
        } else {
            await applyAliases(topPeersAsSrcRows);
            await applyAliases(topPeersAsDstRows);
            await applyAliases(recentFlowsRows);
        }

        return NextResponse.json({
            success: true,
            data: {
                requested_ip: user ? ip : obfuscateIp(ip),
                summary: summaryRows[0] || null,
                timelineAsSrc: timelineAsSrcRows,
                timelineAsDst: timelineAsDstRows,
                topPeersAsSrc: topPeersAsSrcRows,
                topPeersAsDst: topPeersAsDstRows,
                topPorts: topPortsRows,
                recentFlows: recentFlowsRows,
            }
        });
    } catch (error) {
        console.error('IP details error:', error);
        return NextResponse.json({ success: false, error: 'Database query failed' }, { status: 500 });
    }
}
