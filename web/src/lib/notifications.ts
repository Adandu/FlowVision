import nodemailer from 'nodemailer';

export type ChannelType = 'discord' | 'ntfy' | 'slack' | 'telegram' | 'email' | 'webhook' | 'apprise';

export interface Channel {
    id: string;
    name: string;
    type: ChannelType;
    config: Record<string, string>;
    enabled: number;
}

export interface Notification {
    title: string;
    message: string;
    severity?: 'info' | 'warning' | 'critical';
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────
export async function sendNotification(channel: Channel, notification: Notification): Promise<void> {
    const c = channel.config;
    switch (channel.type) {
        case 'discord': return sendDiscord(c.webhook_url, notification);
        case 'ntfy': return sendNtfy(c.url, c.topic, c.token, notification);
        case 'slack': return sendSlack(c.webhook_url, notification);
        case 'telegram': return sendTelegram(c.bot_token, c.chat_id, notification);
        case 'email': return sendEmail(c, notification);
        case 'webhook': return sendWebhook(c.url, c.method || 'POST', c.headers || '{}', notification);
        case 'apprise': return sendApprise(c.url, c.tag, notification);
        default: throw new Error(`Unknown channel type: ${channel.type}`);
    }
}

// ─── Discord ──────────────────────────────────────────────────────────────────
async function sendDiscord(webhookUrl: string, n: Notification) {
    const color = n.severity === 'critical' ? 0xFF4444 : n.severity === 'warning' ? 0xFFAA00 : 0x3B82F6;
    await fetchThrow(webhookUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [{ title: n.title, description: n.message, color }] }),
    });
}

// ─── NTFY ─────────────────────────────────────────────────────────────────────
async function sendNtfy(baseUrl: string, topic: string, token: string | undefined, n: Notification) {
    const headers: Record<string, string> = {
        'Content-Type': 'text/plain',
        'Title': n.title,
        'Priority': n.severity === 'critical' ? 'urgent' : n.severity === 'warning' ? 'high' : 'default',
        'Tags': 'flowvision',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    await fetchThrow(`${baseUrl.replace(/\/$/, '')}/${topic}`, { method: 'POST', headers, body: n.message });
}

// ─── Slack ────────────────────────────────────────────────────────────────────
async function sendSlack(webhookUrl: string, n: Notification) {
    await fetchThrow(webhookUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `*${n.title}*\n${n.message}` }),
    });
}

// ─── Telegram ─────────────────────────────────────────────────────────────────
async function sendTelegram(botToken: string, chatId: string, n: Notification) {
    await fetchThrow(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: `*${n.title}*\n${n.message}`, parse_mode: 'Markdown' }),
    });
}

// ─── Email (SMTP) ─────────────────────────────────────────────────────────────
async function sendEmail(c: Record<string, string>, n: Notification) {
    const escapeHtml = (value: string) => value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    const transporter = nodemailer.createTransport({
        host: c.smtp_host,
        port: Number(c.smtp_port) || 587,
        secure: c.smtp_secure === 'true',
        auth: c.smtp_user ? { user: c.smtp_user, pass: c.smtp_pass } : undefined,
    });
    await transporter.sendMail({
        from: c.from || 'FlowVision <noreply@flowvision>',
        to: c.to,
        subject: n.title,
        text: n.message,
        html: `<p><strong>${escapeHtml(n.title)}</strong></p><p>${escapeHtml(n.message).replace(/\n/g, '<br/>')}</p>`,
    });
}

// ─── Generic Webhook ──────────────────────────────────────────────────────────
async function sendWebhook(url: string, method: string, headersJson: string, n: Notification) {
    const extra = JSON.parse(headersJson || '{}');
    const allowedMethods = ['POST', 'PUT', 'PATCH'];
    const verb = method.toUpperCase();
    if (!allowedMethods.includes(verb)) throw new Error('Unsupported webhook method');
    await fetchThrow(url, {
        method: verb,
        headers: { 'Content-Type': 'application/json', ...extra },
        body: JSON.stringify({ title: n.title, message: n.message, severity: n.severity }),
    });
}

// ─── Apprise REST API ─────────────────────────────────────────────────────────
async function sendApprise(appriseUrl: string, tag: string | undefined, n: Notification) {
    const endpoint = tag ? `${appriseUrl}/notify/${tag}` : `${appriseUrl}/notify`;
    await fetchThrow(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: n.title, body: n.message }),
    });
}

// ─── Helper ───────────────────────────────────────────────────────────────────
async function fetchThrow(url: string, init: RequestInit) {
    const res = await fetch(url, init);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
}
