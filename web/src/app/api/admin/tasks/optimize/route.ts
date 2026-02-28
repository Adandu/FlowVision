import { NextResponse } from 'next/server';
import { clickhouse } from '@/lib/clickhouse';
import { getCurrentUser } from '@/lib/auth';

export async function POST(request: Request) {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { table } = await request.json();

        const allowedTables = ['flows', 'flows_1m_mv', 'flows_1h_mv', 'ip_aliases'];
        if (!allowedTables.includes(table)) {
            return NextResponse.json({ success: false, error: 'Invalid table for optimization' }, { status: 400 });
        }

        // OPTIMIZE TABLE forces a background merge, sweeping TTL expired data and condensing files.
        // We use FINAL to force it to run synchronously in the foreground for the UI loading state.
        const query = `OPTIMIZE TABLE ${table} FINAL`;
        await clickhouse.exec({ query });

        return NextResponse.json({ success: true, message: `Table ${table} optimized successfully` });
    } catch (error) {
        console.error('Task execution failed:', error);
        return NextResponse.json({ success: false, error: 'Failed to optimize table' }, { status: 500 });
    }
}
