import { NextResponse } from 'next/server';
import { clickhouse } from '@/lib/clickhouse';
import { getCurrentUser } from '@/lib/auth';
import { evaluateAlerts } from '@/lib/alertEngine';

export async function GET() {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    try {
        await evaluateAlerts().catch(error => console.error('Alert evaluation failed:', error));
        const [rules, events] = await Promise.all([
            clickhouse.query({ query: 'SELECT * FROM alerts ORDER BY created_at DESC LIMIT 200', format: 'JSONEachRow' }).then(r => r.json()),
            clickhouse.query({ query: 'SELECT ae.*, a.name as alert_name FROM alert_events ae JOIN alerts a ON ae.alert_id = a.id ORDER BY ae.triggered_at DESC LIMIT 50', format: 'JSONEachRow' }).then(r => r.json()),
        ]);
        return NextResponse.json({ success: true, data: { rules, events } });
    } catch (error) {
        console.error('Alerts GET error:', error);
        return NextResponse.json({ success: false, error: 'Database query failed' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    try {
        const body = await request.json();
        const { name, type, threshold } = body;

        if (!name || !type || threshold === undefined) {
            return NextResponse.json({ success: false, error: 'Missing required fields: name, type, threshold' }, { status: 400 });
        }

        await clickhouse.command({
            query: `INSERT INTO alerts (name, type, threshold) VALUES ({name:String}, {type:String}, {threshold:UInt64})`,
            query_params: { name, type, threshold: Number(threshold) },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Alerts POST error:', error);
        return NextResponse.json({ success: false, error: 'Failed to create alert' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });

        await clickhouse.command({
            query: `ALTER TABLE alerts DELETE WHERE id = {id:UUID}`,
            query_params: { id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Alerts DELETE error:', error);
        return NextResponse.json({ success: false, error: 'Failed to delete alert' }, { status: 500 });
    }
}
