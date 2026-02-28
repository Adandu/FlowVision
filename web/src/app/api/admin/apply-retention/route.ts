import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { clickhouse } from '@/lib/clickhouse';

export async function POST(request: Request) {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { days } = await request.json();
    if (!days || isNaN(Number(days)) || Number(days) < 1) {
        return NextResponse.json({ error: 'Invalid days value' }, { status: 400 });
    }

    try {
        await clickhouse.command({
            query: `ALTER TABLE flows MODIFY TTL toDateTime(timestamp) + INTERVAL ${Number(days)} DAY DELETE`,
        });
        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
