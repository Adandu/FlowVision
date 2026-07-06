/**
 * Next.js instrumentation hook — runs once per server process on boot.
 *
 * Threshold alerts (bandwidth/new-IP/high-flow-count) were previously only
 * evaluated as a side effect of GET /api/alerts, i.e. only when a logged-in
 * user happened to have the /alerts page open (which itself only fetches
 * once, with no polling). That means the "real-time alerting via
 * Discord/Webhook/Telegram" feature silently never fired in the background.
 * This schedules the same evaluation on a fixed interval so it actually
 * runs continuously, independent of UI activity.
 */
export async function register() {
    if (process.env.NEXT_RUNTIME !== 'nodejs') return;

    // Guard against duplicate intervals across hot-reloads / multiple registers.
    const g = globalThis as unknown as { __flowvisionAlertTimer?: ReturnType<typeof setInterval> };
    if (g.__flowvisionAlertTimer) return;

    const { evaluateAlerts } = await import('./lib/alertEngine');

    const runSafely = () => {
        evaluateAlerts().catch(err => console.error('[AlertEngine] evaluation failed:', err));
    };

    // Give ClickHouse/Telegraf a moment to be reachable on cold start, then poll every 60s.
    setTimeout(runSafely, 15_000);
    g.__flowvisionAlertTimer = setInterval(runSafely, 60_000);
}
