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
        case '10m': timeFilter = 'timestamp >= now() - INTERVAL 10 MINUTE'; break;
        case '1h': timeFilter = 'timestamp >= now() - INTERVAL 1 HOUR'; break;
        case '24h': timeFilter = 'timestamp >= now() - INTERVAL 24 HOUR'; break;
        case '7d': timeFilter = 'timestamp >= now() - INTERVAL 7 DAY'; break;
        case '30d': timeFilter = 'timestamp >= now() - INTERVAL 30 DAY'; break;
    }

    try {
        // Find top destinations and ports from this source IP over the interval
        const query = `
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
            WHERE (src_ip = {ip:String} OR dst_ip = {ip:String}) AND ${timeFilter}
            GROUP BY dst_ip, port_proto
            ORDER BY total_bytes DESC
            LIMIT 50
        `;

        const res = await clickhouse.query({ query, query_params: { ip: src_ip }, format: 'JSONEachRow' });
        const data = await res.json();

        const { getAppName } = await import('@/lib/protocols');

        // Map ports to L7 Apps
        const mappedData = data.map((row: any) => {
            let appName = row.port_proto;
            if (appName.startsWith('TCP ') || appName.startsWith('UDP ')) {
                const portNum = parseInt(appName.split(' ')[1], 10);
                if (!isNaN(portNum)) {
                    const l7 = getAppName(portNum);
                    if (!l7.startsWith('Port ')) appName = l7;
                }
            }
            return {
                dst_ip: row.dst_ip,
                app: appName,
                bytes: Number(row.total_bytes)
            };
        });

        const user = await getCurrentUser();
        if (!user) {
            mappedData.forEach((row: any) => {
                row.dst_ip = obfuscateIp(row.dst_ip);
            });
        } else {
            await applyAliases(mappedData);
        }

        return NextResponse.json({ success: true, data: mappedData });

    } catch (error) {
        console.error('ClickHouse Query Error:', error);
        return NextResponse.json({ success: false, error: 'Database query failed' }, { status: 500 });
    }
}
