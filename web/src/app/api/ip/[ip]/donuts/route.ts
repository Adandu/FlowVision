import { NextResponse } from 'next/server';
import { clickhouse } from '@/lib/clickhouse';
import { applyAliases } from '@/lib/aliases';

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

        await applyAliases(incoming);
        await applyAliases(outgoing);

        return NextResponse.json({ success: true, incoming, outgoing, topPorts });
    } catch (error) {
        console.error('Failed to fetch IP pie chart data:', error);
        return NextResponse.json({ success: false }, { status: 500 });
    }
}
