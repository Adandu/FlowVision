import { NextResponse } from 'next/server';
import { clickhouse } from '@/lib/clickhouse';
import { getCurrentUser } from '@/lib/auth';

async function requireAdmin() {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return null;
    return user;
}

export async function GET() {
    if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const rows = await clickhouse.query({
        query: 'SELECT key, value FROM settings FINAL ORDER BY key ASC',
        format: 'JSONEachRow',
    }).then(r => r.json<{ key: string; value: string }>());
    const data: Record<string, string> = {};
    rows.forEach(r => { data[r.key] = r.value; });
    return NextResponse.json({ success: true, data });
}

export async function PATCH(request: Request) {
    if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body: Record<string, string> = await request.json();
    for (const [key, value] of Object.entries(body)) {
        await clickhouse.command({
            query: `INSERT INTO settings (key, value) VALUES ({k:String}, {v:String})`,
            query_params: { k: key, v: String(value) },
        });
    }
    return NextResponse.json({ success: true });
}
