import { NextResponse } from 'next/server';
import { clickhouse } from '@/lib/clickhouse';
import { getCurrentUser } from '@/lib/auth';
import { sendNotification, type Channel } from '@/lib/notifications';

type AlertRule = {
    id: string;
    name: string;
    type: 'bandwidth_threshold' | 'new_ip' | 'high_flow_count';
    threshold: string | number;
    enabled: number;
};

async function notifyChannels(title: string, message: string) {
    const rows = await clickhouse.query({
        query: 'SELECT id, name, type, config, enabled FROM notification_channels FINAL WHERE enabled = 1',
        format: 'JSONEachRow',
    }).then(r => r.json<Omit<Channel, 'config'> & { config: string }>());

    await Promise.allSettled(rows.map(row => sendNotification({
        ...row,
        config: JSON.parse(row.config || '{}'),
    }, { title, message, severity: 'warning' })));
}

async function recordAlert(rule: AlertRule, value: number, message: string) {
    const recent = await clickhouse.query({
        query: `SELECT count() AS count FROM alert_events WHERE alert_id = {id:UUID} AND triggered_at >= now() - INTERVAL 5 MINUTE`,
        query_params: { id: rule.id },
        format: 'JSONEachRow',
    }).then(r => r.json<{ count: string }>());

    if (Number(recent[0]?.count || 0) > 0) return;

    await clickhouse.command({
        query: `INSERT INTO alert_events (alert_id, value, message) VALUES ({id:UUID}, {value:UInt64}, {message:String})`,
        query_params: { id: rule.id, value: Math.max(0, Math.floor(value)), message },
    });

    await clickhouse.command({
        query: `ALTER TABLE alerts UPDATE trigger_count = trigger_count + 1, last_triggered = now64() WHERE id = {id:UUID}`,
        query_params: { id: rule.id },
    }).catch(() => { });

    await notifyChannels(`FlowVision alert: ${rule.name}`, message);
}

async function evaluateAlerts() {
    const rules = await clickhouse.query({
        query: 'SELECT id, name, type, threshold, enabled FROM alerts WHERE enabled = 1',
        format: 'JSONEachRow',
    }).then(r => r.json<AlertRule>());

    for (const rule of rules) {
        const threshold = Number(rule.threshold || 0);
        if (rule.type === 'bandwidth_threshold') {
            const rows = await clickhouse.query({
                query: `SELECT toUInt64(coalesce(sum(bytes), 0)) AS value FROM flows WHERE timestamp >= now() - INTERVAL 1 MINUTE`,
                format: 'JSONEachRow',
            }).then(r => r.json<{ value: string }>());
            const value = Number(rows[0]?.value || 0);
            if (value > threshold) await recordAlert(rule, value, `Bandwidth in the last minute is ${value} bytes, above threshold ${threshold}.`);
        } else if (rule.type === 'high_flow_count') {
            const rows = await clickhouse.query({
                query: `SELECT toUInt64(count()) AS value FROM flows WHERE timestamp >= now() - INTERVAL 1 MINUTE`,
                format: 'JSONEachRow',
            }).then(r => r.json<{ value: string }>());
            const value = Number(rows[0]?.value || 0);
            if (value > threshold) await recordAlert(rule, value, `Flow count in the last minute is ${value}, above threshold ${threshold}.`);
        } else if (rule.type === 'new_ip') {
            const rows = await clickhouse.query({
                query: `
                    SELECT countDistinct(ip) AS value
                    FROM (
                        SELECT src_ip AS ip, min(timestamp) AS first_seen FROM flows GROUP BY ip
                        UNION ALL
                        SELECT dst_ip AS ip, min(timestamp) AS first_seen FROM flows GROUP BY ip
                    )
                    WHERE first_seen >= now() - INTERVAL 5 MINUTE
                `,
                format: 'JSONEachRow',
            }).then(r => r.json<{ value: string }>());
            const value = Number(rows[0]?.value || 0);
            if (value > 0) await recordAlert(rule, value, `${value} newly seen IP address(es) appeared in the last 5 minutes.`);
        }
    }
}

export async function GET() {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    try {
        await evaluateAlerts().catch(error => console.error('Alert evaluation failed:', error));
        const [rules, events] = await Promise.all([
            clickhouse.query({ query: 'SELECT * FROM alerts ORDER BY created_at DESC', format: 'JSONEachRow' }).then(r => r.json()),
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
            query: `ALTER TABLE alerts DELETE WHERE id = {id:String}`,
            query_params: { id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Alerts DELETE error:', error);
        return NextResponse.json({ success: false, error: 'Failed to delete alert' }, { status: 500 });
    }
}
