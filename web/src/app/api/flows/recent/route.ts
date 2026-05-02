import { NextResponse } from 'next/server';
import { clickhouse } from '@/lib/clickhouse';
import { applyAliases } from '@/lib/aliases';
import { getCurrentUser, obfuscateIp } from '@/lib/auth';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const parsedLimit = Number(searchParams.get('limit') || 100);
    const limit = Math.min(Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 100, 1), 500);

    try {
        const rows = await clickhouse.query({
            query: `
                SELECT
                    max(timestamp) as timestamp,
                    src_ip,
                    dst_ip,
                    src_port,
                    dst_port,
                    multiIf(protocol = 6, 'TCP', protocol = 17, 'UDP', protocol = 1, 'ICMP', 'Other') AS protocol,
                    SUM(bytes) as bytes,
                    SUM(packets) as packets
                FROM flows
                WHERE timestamp >= now() - INTERVAL 24 HOUR
                GROUP BY src_ip, dst_ip, src_port, dst_port, protocol
                ORDER BY timestamp DESC
                LIMIT ${limit}
            `,
            format: 'JSONEachRow',
        }).then(r => r.json());

        const user = await getCurrentUser();
        const isGuest = !user;

        // Collect all IPs we need to lookup
        const allIps = new Set<string>();
        rows.forEach((r: any) => {
            if (r.src_ip) allIps.add(r.src_ip);
            if (r.dst_ip) allIps.add(r.dst_ip);
        });

        // Batch GeoIP Lookup (on the backend, before obfuscation)
        const { batchGeoIPLookup } = await import('@/lib/geoip');
        const geoDataMap = await batchGeoIPLookup(Array.from(allIps));

        // Enrich payloads with GeoIP
        rows.forEach((r: any) => {
            const srcGeo = geoDataMap[r.src_ip];
            if (srcGeo) {
                r.src_asn = srcGeo.asn || srcGeo.isp;
            }
            const dstGeo = geoDataMap[r.dst_ip];
            if (dstGeo) {
                r.dst_asn = dstGeo.asn || dstGeo.isp;
            }
        });

        if (isGuest) {
            rows.forEach((r: any) => {
                r.src_ip = obfuscateIp(r.src_ip);
                r.dst_ip = obfuscateIp(r.dst_ip);
            });
        } else {
            await applyAliases(rows);
        }

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Recent flows error:', error);
        return NextResponse.json({ success: false, error: 'Database query failed' }, { status: 500 });
    }
}
