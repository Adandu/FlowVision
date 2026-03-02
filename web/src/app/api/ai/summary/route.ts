import { NextResponse } from 'next/server';
import { clickhouse } from '@/lib/clickhouse';
import { getCurrentUser } from '@/lib/auth';

async function getSettings(): Promise<Record<string, string>> {
    try {
        const rows = await clickhouse.query({
            query: 'SELECT key, value FROM settings FINAL ORDER BY key ASC',
            format: 'JSONEachRow',
        }).then(r => r.json<{ key: string; value: string }>());
        const data: Record<string, string> = {};
        rows.forEach(r => { data[r.key] = r.value; });
        return data;
    } catch {
        return {};
    }
}

async function getTrafficSnapshot(interval: string): Promise<string> {
    const timeFilter = interval === '24h' ? '24 HOUR' : interval === '1w' ? '1 WEEK' : '1 HOUR';
    try {
        const [topDst, topSrc, protocols, direction] = await Promise.all([
            clickhouse.query({
                query: `SELECT dst_ip AS ip, SUM(bytes) as total_bytes FROM flows WHERE timestamp >= now() - INTERVAL ${timeFilter} GROUP BY ip ORDER BY total_bytes DESC LIMIT 5`,
                format: 'JSONEachRow'
            }).then(r => r.json<any>()),
            clickhouse.query({
                query: `SELECT src_ip AS ip, SUM(bytes) as total_bytes FROM flows WHERE timestamp >= now() - INTERVAL ${timeFilter} GROUP BY ip ORDER BY total_bytes DESC LIMIT 5`,
                format: 'JSONEachRow'
            }).then(r => r.json<any>()),
            clickhouse.query({
                query: `SELECT multiIf(protocol = 6, 'TCP', protocol = 17, 'UDP', protocol = 1, 'ICMP', 'Other') AS proto, SUM(bytes) AS total_bytes FROM flows WHERE timestamp >= now() - INTERVAL ${timeFilter} GROUP BY proto ORDER BY total_bytes DESC`,
                format: 'JSONEachRow'
            }).then(r => r.json<any>()),
            clickhouse.query({
                query: `SELECT sumIf(bytes, match(src_ip, '^10\\.') OR match(src_ip, '^192\\.168\\.') OR match(src_ip, '^172\\.(1[6-9]|2[0-9]|3[01])\\.')) AS outbound_bytes, sumIf(bytes, NOT (match(src_ip, '^10\\.') OR match(src_ip, '^192\\.168\\.') OR match(src_ip, '^172\\.(1[6-9]|2[0-9]|3[01])\\.'))) AS inbound_bytes FROM flows WHERE timestamp >= now() - INTERVAL ${timeFilter}`,
                format: 'JSONEachRow'
            }).then(r => r.json<any>()),
        ]);

        const formatBytes = (b: number) => {
            if (!b || b === 0) return '0 B';
            const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.floor(Math.log(b) / Math.log(1024));
            return `${(b / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
        };

        const dir = direction[0] || {};
        const snapshot = [
            `Time Period: Last ${interval}`,
            `Outbound Traffic: ${formatBytes(Number(dir.outbound_bytes))}`,
            `Inbound Traffic: ${formatBytes(Number(dir.inbound_bytes))}`,
            `Top Destination IPs: ${topDst.map((d: any) => `${d.ip} (${formatBytes(Number(d.total_bytes))})`).join(', ')}`,
            `Top Source IPs: ${topSrc.map((s: any) => `${s.ip} (${formatBytes(Number(s.total_bytes))})`).join(', ')}`,
            `Protocol Mix: ${protocols.map((p: any) => `${p.proto}: ${formatBytes(Number(p.total_bytes))}`).join(', ')}`,
        ].join('\n');
        return snapshot;
    } catch (err) {
        return 'Unable to retrieve traffic data.';
    }
}

async function getIPSnapshot(ip: string, interval: string): Promise<string> {
    const timeFilter = interval === '24h' ? '24 HOUR' : interval === '1w' ? '1 WEEK' : '1 HOUR';
    try {
        const [outgoing, incoming, ports] = await Promise.all([
            clickhouse.query({
                query: `SELECT dst_ip, SUM(bytes) as bytes FROM flows WHERE (src_ip = '${ip}') AND timestamp >= now() - INTERVAL ${timeFilter} GROUP BY dst_ip ORDER BY bytes DESC LIMIT 5`,
                format: 'JSONEachRow'
            }).then(r => r.json<any>()),
            clickhouse.query({
                query: `SELECT src_ip, SUM(bytes) as bytes FROM flows WHERE (dst_ip = '${ip}') AND timestamp >= now() - INTERVAL ${timeFilter} GROUP BY src_ip ORDER BY bytes DESC LIMIT 5`,
                format: 'JSONEachRow'
            }).then(r => r.json<any>()),
            clickhouse.query({
                query: `SELECT dst_port, SUM(bytes) as bytes FROM flows WHERE (src_ip = '${ip}' OR dst_ip = '${ip}') AND timestamp >= now() - INTERVAL ${timeFilter} GROUP BY dst_port ORDER BY bytes DESC LIMIT 5`,
                format: 'JSONEachRow'
            }).then(r => r.json<any>()),
        ]);
        const formatBytes = (b: number) => {
            if (!b) return '0 B';
            const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.floor(Math.log(b) / Math.log(1024));
            return `${(b / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
        };
        return [
            `IP Address: ${ip}, Time Period: Last ${interval}`,
            `Top Outgoing Destinations: ${outgoing.map((d: any) => `${d.dst_ip} (${formatBytes(Number(d.bytes))})`).join(', ') || 'None'}`,
            `Top Incoming Sources: ${incoming.map((s: any) => `${s.src_ip} (${formatBytes(Number(s.bytes))})`).join(', ') || 'None'}`,
            `Top Ports Used: ${ports.map((p: any) => `port ${p.dst_port} (${formatBytes(Number(p.bytes))})`).join(', ') || 'None'}`,
        ].join('\n');
    } catch {
        return `Unable to retrieve data for IP ${ip}.`;
    }
}

async function callGemini(apiKey: string, model: string, prompt: string): Promise<string> {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const genModel = genAI.getGenerativeModel({ model: model || 'gemini-2.0-flash' });
    const result = await genModel.generateContent(prompt);
    return result.response.text();
}

async function callClaude(apiKey: string, model: string, prompt: string): Promise<string> {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
        model: model || 'claude-3-5-haiku-20241022',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
    });
    return (message.content[0] as any).text;
}

async function callOpenAI(apiKey: string, model: string, prompt: string): Promise<string> {
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
        model: model || 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 512,
    });
    return completion.choices[0].message.content || '';
}

export async function GET(request: Request) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const interval = searchParams.get('interval') || '1h';
    const context = searchParams.get('context') || 'dashboard';
    const ip = searchParams.get('ip') || '';

    const settings = await getSettings();

    if (settings.ai_enabled !== 'true') {
        return NextResponse.json({ error: 'AI is not enabled' }, { status: 503 });
    }

    const provider = settings.ai_provider || 'gemini';
    const keyMap: Record<string, string> = {
        gemini: settings.ai_gemini_key,
        claude: settings.ai_claude_key,
        openai: settings.ai_openai_key,
    };
    const modelMap: Record<string, string> = {
        gemini: settings.ai_gemini_model || 'gemini-2.0-flash',
        claude: settings.ai_claude_model || 'claude-3-5-haiku-20241022',
        openai: settings.ai_openai_model || 'gpt-4o-mini',
    };
    const apiKey = keyMap[provider];
    if (!apiKey) {
        return NextResponse.json({ error: `No API key configured for provider: ${provider}` }, { status: 503 });
    }
    const model = modelMap[provider];

    let trafficData: string;
    let promptContext: string;

    if (context === 'ip' && ip) {
        trafficData = await getIPSnapshot(ip, interval);
        promptContext = `You are a network security analyst. Based on the REAL network flow data below for a specific IP address, provide a concise 2-3 sentence summary highlighting: what this IP is doing, any notable traffic patterns, and whether this looks normal or suspicious. Be direct and informative with no fluff.`;
    } else {
        trafficData = await getTrafficSnapshot(interval);
        promptContext = `You are a network security analyst. Based on the REAL network flow data below, provide a concise 2-3 sentence summary highlighting: current traffic volume and direction, top active IPs, and any potential concerns. Be direct and informative with no fluff.`;
    }

    const prompt = `${promptContext}\n\nNetwork Traffic Data:\n${trafficData}`;

    try {
        let summary: string;
        if (provider === 'gemini') {
            summary = await callGemini(apiKey, model, prompt);
        } else if (provider === 'claude') {
            summary = await callClaude(apiKey, model, prompt);
        } else {
            summary = await callOpenAI(apiKey, model, prompt);
        }
        return NextResponse.json({ success: true, summary, provider, model });
    } catch (err: any) {
        console.error('[AI Summary] Error calling provider:', err.message);
        return NextResponse.json({ error: `AI provider error: ${err.message}` }, { status: 500 });
    }
}
