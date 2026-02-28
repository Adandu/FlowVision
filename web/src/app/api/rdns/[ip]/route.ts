import { NextResponse } from 'next/server';
import dns from 'dns';
import { promisify } from 'util';

const reverseDns = promisify(dns.reverse);
const rdnsCache = new Map<string, { hostname: string | null; ts: number }>();
const CACHE_TTL = 3600 * 1000; // 1 hour cache

export async function GET(_req: Request, { params }: { params: Promise<{ ip: string }> }) {
    const { ip } = await params;

    const cached = rdnsCache.get(ip);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
        return NextResponse.json({ success: true, hostname: cached.hostname });
    }

    try {
        const hostnames = await reverseDns(ip);
        const hostname = hostnames?.[0] || null;
        rdnsCache.set(ip, { hostname, ts: Date.now() });
        return NextResponse.json({ success: true, hostname });
    } catch {
        // NXDOMAIN or timeout — cache as null to avoid repeated lookups
        rdnsCache.set(ip, { hostname: null, ts: Date.now() });
        return NextResponse.json({ success: true, hostname: null });
    }
}
