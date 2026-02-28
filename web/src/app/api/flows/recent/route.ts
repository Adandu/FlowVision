import { NextResponse } from 'next/server';
import { clickhouse } from '@/lib/clickhouse';
import { applyAliases } from '@/lib/aliases';
import { getCurrentUser, obfuscateIp } from '@/lib/auth';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get('limit') || 100), 500);

    try {
        const rows = await clickhouse.query({
            query: `
                SELECT
                    timestamp,
                    src_ip,
                    dst_ip,
                    src_port,
                    dst_port,
                    multiIf(protocol = 6, 'TCP', protocol = 17, 'UDP', protocol = 1, 'ICMP', 'Other') AS protocol,
                    bytes,
                    packets
                FROM flows
                ORDER BY timestamp DESC
                LIMIT ${limit}
            `,
            format: 'JSONEachRow',
        }).then(r => r.json());

        const user = await getCurrentUser();
        if (!user) {
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
