import { NextResponse } from 'next/server';
import { clickhouse } from '@/lib/clickhouse';
import { applyAliases } from '@/lib/aliases';
import { getCurrentUser, obfuscateIp } from '@/lib/auth';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const src_ip = searchParams.get('src_ip');
    const interval = searchParams.get('interval') || '24h';

    if (!src_ip) {
        return NextResponse.json({ success: false, error: 'Missing src_ip' }, { status: 400 });
    }

    if (!/^[0-9a-fA-F:.]+$/.test(src_ip)) {
        return NextResponse.json({ success: false, error: 'Invalid src_ip' }, { status: 400 });
    }

    let timeFilter = 'timestamp >= now() - INTERVAL 24 HOUR';
    switch (interval) {
        case '1m': timeFilter = 'timestamp >= now() - INTERVAL 1 MINUTE'; break;
        case '10m': timeFilter = 'timestamp >= now() - INTERVAL 10 MINUTE'; break;
        case '1h': timeFilter = 'timestamp >= now() - INTERVAL 1 HOUR'; break;
        case '24h': timeFilter = 'timestamp >= now() - INTERVAL 24 HOUR'; break;
        case '7d': timeFilter = 'timestamp >= now() - INTERVAL 7 DAY'; break;
        case '30d': timeFilter = 'timestamp >= now() - INTERVAL 30 DAY'; break;
    }

    try {
        const { getAppName } = await import('@/lib/protocols');

        // Outgoing: flows initiated by this IP (src_ip = searched IP)
        const outgoingQuery = `
            SELECT
                dst_ip,
                multiIf(
                    protocol = 6, concat('TCP ', toString(dst_port)),
                    protocol = 17, concat('UDP ', toString(dst_port)),
                    protocol = 1, 'ICMP',
                    'Other'
                ) AS port_proto,
                SUM(bytes) as total_bytes
            FROM flows
            WHERE src_ip = {ip:String} AND ${timeFilter}
            GROUP BY dst_ip, port_proto
            ORDER BY total_bytes DESC
            LIMIT 30
        `;

        // Incoming: flows arriving at this IP (dst_ip = searched IP), using src_ip as peer
        const incomingQuery = `
            SELECT
                src_ip,
                multiIf(
                    protocol = 6, concat('TCP ', toString(dst_port)),
                    protocol = 17, concat('UDP ', toString(dst_port)),
                    protocol = 1, 'ICMP',
                    'Other'
                ) AS port_proto,
                SUM(bytes) as total_bytes
            FROM flows
            WHERE dst_ip = {ip:String} AND ${timeFilter}
            GROUP BY src_ip, port_proto
            ORDER BY total_bytes DESC
            LIMIT 20
        `;

        const [outgoingRaw, incomingRaw] = await Promise.all([
            clickhouse.query({ query: outgoingQuery, query_params: { ip: src_ip }, format: 'JSONEachRow' }).then(r => r.json()),
            clickhouse.query({ query: incomingQuery, query_params: { ip: src_ip }, format: 'JSONEachRow' }).then(r => r.json()),
        ]);

        function mapPort(portProto: string): string {
            if (portProto.startsWith('TCP ') || portProto.startsWith('UDP ')) {
                const portNum = parseInt(portProto.split(' ')[1], 10);
                if (!isNaN(portNum)) {
                    const l7 = getAppName(portNum);
                    if (!l7.startsWith('Port ')) return l7;
                }
            }
            return portProto;
        }

        const outgoing = outgoingRaw.map((row: any) => ({
            dst_ip: row.dst_ip,
            app: mapPort(row.port_proto),
            bytes: Number(row.total_bytes),
            direction: 'out' as const,
        }));

        const incoming = incomingRaw.map((row: any) => ({
            dst_ip: row.src_ip, // re-use dst_ip field so chart component is unchanged; value is the peer
            app: mapPort(row.port_proto),
            bytes: Number(row.total_bytes),
            direction: 'in' as const,
        }));

        const allRows = [...outgoing, ...incoming];

        const user = await getCurrentUser();
        if (!user) {
            allRows.forEach((row: any) => { row.dst_ip = obfuscateIp(row.dst_ip); });
        } else {
            await applyAliases(allRows);
        }

        return NextResponse.json({ success: true, data: allRows });

    } catch (error) {
        console.error('ClickHouse Query Error:', error);
        return NextResponse.json({ success: false, error: 'Database query failed' }, { status: 500 });
    }
}
