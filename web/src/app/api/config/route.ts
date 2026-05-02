import { NextResponse } from 'next/server';
import { clickhouse } from '@/lib/clickhouse';

export async function GET() {
    try {
        const rows = await clickhouse.query({
            query: `SELECT value FROM settings FINAL WHERE key = 'guest_mode_enabled'`,
            format: 'JSONEachRow'
        }).then(r => r.json()) as any[];

        const enabled = rows.length > 0 ? rows[0].value === '1' : false;

        return NextResponse.json({ success: true, guest_mode_enabled: enabled, auth_mode: process.env.AUTH_MODE || 'local' }, {
            headers: {
                'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=10'
            }
        });
    } catch (e) {
        console.error('Failed to get guest config', e);
        return NextResponse.json({ success: false, guest_mode_enabled: false });
    }
}
