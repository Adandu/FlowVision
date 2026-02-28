import { NextResponse } from 'next/server';

// Simple in-memory cache to respect ip-api.com rate limits (45 req/min free tier)
const geoCache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 3600 * 1000; // 1 hour

export async function GET(_req: Request, { params }: { params: Promise<{ ip: string }> }) {
    const { ip } = await params;

    // Return cached result if available
    const cached = geoCache.get(ip);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
        return NextResponse.json({ success: true, data: cached.data });
    }

    try {
        const res = await fetch(
            `http://ip-api.com/json/${ip}?fields=status,country,countryCode,regionName,city,isp,org,as,lat,lon,timezone,query`,
            { next: { revalidate: 3600 } }
        );

        if (!res.ok) throw new Error('ip-api.com request failed');

        const json = await res.json();

        if (json.status !== 'success') {
            // Private/reserved IPs return 'fail' — return a graceful private result
            const data = { private: true, country: 'Private Network', countryCode: 'LAN', isp: 'Local', city: '', flag: '🏠' };
            geoCache.set(ip, { data, ts: Date.now() });
            return NextResponse.json({ success: true, data });
        }

        // Add flag emoji using country code
        const flag = json.countryCode
            ? String.fromCodePoint(...json.countryCode.toUpperCase().split('').map((c: string) => 0x1F1E6 - 65 + c.charCodeAt(0)))
            : '🌐';

        const data = {
            country: json.country,
            countryCode: json.countryCode,
            region: json.regionName,
            city: json.city,
            isp: json.isp,
            asn: json.as,
            org: json.org,
            lat: json.lat,
            lon: json.lon,
            timezone: json.timezone,
            flag,
            private: false,
        };

        geoCache.set(ip, { data, ts: Date.now() });
        return NextResponse.json({ success: true, data });
    } catch (err) {
        console.error('GeoIP lookup failed:', err);
        return NextResponse.json({ success: false, error: 'GeoIP lookup failed' }, { status: 500 });
    }
}
