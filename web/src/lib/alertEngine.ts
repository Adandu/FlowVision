import { clickhouse } from './clickhouse';
import { sendNotification, type Channel } from './notifications';

export type AlertRule = {
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

/**
 * Evaluate all enabled alert rules against the latest flow data and fire
 * notifications for any that cross their threshold (rate-limited to once
 * per 5 minutes per rule via recordAlert's alert_events lookback).
 *
 * IMPORTANT: this used to only run as a side effect of GET /api/alerts,
 * meaning threshold alerts silently never fired unless a logged-in user
 * happened to have the /alerts page open. It is now also invoked on a
 * fixed interval from instrumentation.ts so it runs in the background
 * regardless of UI activity.
 */
export async function evaluateAlerts() {
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
