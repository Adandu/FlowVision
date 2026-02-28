import { NextResponse } from 'next/server';
import { clickhouse } from '@/lib/clickhouse';

export async function GET(_req: Request, { params }: { params: Promise<{ ip: string }> }) {
    const { ip } = await params;

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
                    WHERE src_ip = {ip:String} OR dst_ip = {ip:String}
                `,
                query_params: { ip },
                format: 'JSONEachRow',
            }).then(r => r.json()),

            // Bandwidth timeline as source (last 24h, by minute)
            clickhouse.query({
                query: `
                    SELECT toStartOfMinute(timestamp) AS time, SUM(bytes) AS bytes
                    FROM flows
                    WHERE src_ip = {ip:String} AND timestamp >= now() - INTERVAL 24 HOUR
                    GROUP BY time ORDER BY time ASC
                `,
                query_params: { ip },
                format: 'JSONEachRow',
            }).then(r => r.json()),

            // Bandwidth timeline as destination (last 24h, by minute)
            clickhouse.query({
                query: `
                    SELECT toStartOfMinute(timestamp) AS time, SUM(bytes) AS bytes
                    FROM flows
                    WHERE dst_ip = {ip:String} AND timestamp >= now() - INTERVAL 24 HOUR
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
                    WHERE src_ip = {ip:String} AND timestamp >= now() - INTERVAL 7 DAY
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
                    WHERE dst_ip = {ip:String} AND timestamp >= now() - INTERVAL 7 DAY
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
                    WHERE (src_ip = {ip:String} OR dst_ip = {ip:String}) AND timestamp >= now() - INTERVAL 7 DAY
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
                    WHERE src_ip = {ip:String} OR dst_ip = {ip:String}
                    ORDER BY timestamp DESC LIMIT 100
                `,
                query_params: { ip },
                format: 'JSONEachRow',
            }).then(r => r.json()),
        ]);

        return NextResponse.json({
            success: true,
            data: {
                ip,
                summary: summaryRows[0] || {},
                timelineAsSrc: timelineAsSrcRows,
                timelineAsDst: timelineAsDstRows,
                topPeersAsSrc: topPeersAsSrcRows,
                topPeersAsDst: topPeersAsDstRows,
                topPorts: topPortsRows,
                recentFlows: recentFlowsRows,
            },
        });
    } catch (error) {
        console.error('IP detail query error:', error);
        return NextResponse.json({ success: false, error: 'Database query failed' }, { status: 500 });
    }
}
