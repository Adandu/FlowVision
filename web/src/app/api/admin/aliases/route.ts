import { NextResponse } from 'next/server';
import { clickhouse } from '@/lib/clickhouse';
import { getCurrentUser } from '@/lib/auth';
import { invalidateAliasCache } from '@/lib/aliases';

export async function GET(request: Request) {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const query = `
            SELECT ip, alias, updated_at 
            FROM ip_aliases FINAL 
            WHERE alias != ''
            ORDER BY ip ASC`;
        const res = await clickhouse.query({ query, format: 'JSONEachRow' });
        const data = await res.json();
        return NextResponse.json({ success: true, aliases: data });
    } catch (error) {
        console.error('Failed to fetch aliases:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch aliases' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { ip, alias } = await request.json();

        if (!ip || !alias) {
            return NextResponse.json({ success: false, error: 'IP and alias are required' }, { status: 400 });
        }

        await clickhouse.insert({
            table: 'ip_aliases',
            values: [{ ip, alias, updated_at: new Date().toISOString().replace('T', ' ').substring(0, 19) }],
            format: 'JSONEachRow'
        });

        invalidateAliasCache();
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to save alias:', error);
        return NextResponse.json({ success: false, error: 'Failed to save alias' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const ip = searchParams.get('ip');

        if (!ip) {
            return NextResponse.json({ success: false, error: 'IP is required' }, { status: 400 });
        }

        // Inserting an empty alias will tombstone it in ReplacingMergeTree logic (based on our GET query filtering out '')
        // Alternatively, since ClickHouse DELETEs are heavy mutations, overwriting with an empty alias is standard practice.
        await clickhouse.insert({
            table: 'ip_aliases',
            values: [{ ip, alias: '', updated_at: new Date().toISOString().replace('T', ' ').substring(0, 19) }],
            format: 'JSONEachRow'
        });

        invalidateAliasCache();
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete alias:', error);
        return NextResponse.json({ success: false, error: 'Failed to delete alias' }, { status: 500 });
    }
}
