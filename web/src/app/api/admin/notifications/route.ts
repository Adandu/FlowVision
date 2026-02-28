import { NextResponse } from 'next/server';
import { clickhouse } from '@/lib/clickhouse';
import { getCurrentUser } from '@/lib/auth';
import { sendNotification, type Channel } from '@/lib/notifications';

async function requireAdmin() {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return null;
    return user;
}

export async function GET() {
    if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const rows = await clickhouse.query({
        query: 'SELECT id, name, type, config, enabled FROM notification_channels FINAL ORDER BY name ASC',
        format: 'JSONEachRow',
    }).then(r => r.json<any>());
    // Parse config JSON for each channel
    return NextResponse.json({ success: true, data: rows.map((r: any) => ({ ...r, config: JSON.parse(r.config || '{}') })) });
}

export async function POST(request: Request) {
    if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { action, ...body } = await request.json();

    if (action === 'test') {
        // Test a channel config without saving
        const channel: Channel = { id: 'test', name: body.name, type: body.type, config: body.config, enabled: 1 };
        try {
            await sendNotification(channel, { title: 'FlowVision Test Notification', message: 'If you see this, your notification channel is configured correctly! 🎉', severity: 'info' });
            return NextResponse.json({ success: true, message: 'Test notification sent' });
        } catch (err: any) {
            return NextResponse.json({ success: false, error: err.message }, { status: 400 });
        }
    }

    // Create
    const { name, type, config } = body;
    if (!name || !type) return NextResponse.json({ error: 'name and type required' }, { status: 400 });
    await clickhouse.command({
        query: `INSERT INTO notification_channels (name, type, config, enabled) VALUES ({n:String},{t:String},{c:String},1)`,
        query_params: { n: name, t: type, c: JSON.stringify(config || {}) },
    });
    return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
    if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    await clickhouse.command({ query: 'ALTER TABLE notification_channels DELETE WHERE id = {id:String}', query_params: { id } });
    return NextResponse.json({ success: true });
}
