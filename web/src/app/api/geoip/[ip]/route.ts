import { NextResponse } from 'next/server';

// Simple in-memory cache to respect ip-api.com rate limits (45 req/min free tier)
const geoCache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 24 * 3600 * 1000; // 24 hours

export async function GET(_req: Request, { params }: { params: Promise<{ ip: string }> }) {
    const { ip } = await params;

    // Return cached result if available
    const cached = geoCache.get(ip);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
        return NextResponse.json({ success: true, data: cached.data });
    }

    try {
        let data: any = null;

        // Try IPInfo first (1000/day limit)
        try {
            const ipinfoRes = await fetch(`https://ipinfo.io/${ip}/json`, { next: { revalidate: 3600 } });
            if (ipinfoRes.ok) {
                const json = await ipinfoRes.json();
                if (json.bogon) {
                    data = { private: true, country: 'Private Network', countryCode: 'LAN', isp: 'Local', city: '', flag: '🏠' };
                } else {
                    const latlon = json.loc ? json.loc.split(',') : [0, 0];
                    data = {
                        country: json.country || '',
                        countryCode: json.country || '',
                        region: json.region || '',
                        city: json.city || '',
                        isp: json.org || '',
                        asn: json.org || '',
                        org: json.org || '',
                        lat: parseFloat(latlon[0]),
                        lon: parseFloat(latlon[1]),
                        timezone: json.timezone || '',
                        private: false,
                    };
                }
            }
        } catch (e) {
            console.warn(`[GeoIP] ipinfo.io failed for ${ip}`);
        }

        // If IPInfo failed / rate-limited, fallback to ip-api.com (45/minute limit)
        if (!data) {
            const ipapiRes = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,regionName,city,lat,lon,timezone,isp,org,as,mobile,proxy,hosting`, { next: { revalidate: 3600 } });
            if (ipapiRes.ok) {
                const json = await ipapiRes.json();
                if (json.status === 'success') {
                    data = {
                        country: json.country || '',
                        countryCode: json.countryCode || '',
                        region: json.regionName || '',
                        city: json.city || '',
                        isp: json.isp || '',
                        asn: json.as || '',
                        org: json.org || '',
                        lat: json.lat || 0,
                        lon: json.lon || 0,
                        timezone: json.timezone || '',
                        private: false,
                    };
                }
            }
        }

        if (!data) {
            throw new Error("All GeoIP lookups failed");
        }

        // Add flag emoji using country code (if not private network)
        if (!data.private) {
            data.flag = data.countryCode
                ? String.fromCodePoint(...data.countryCode.toUpperCase().split('').map((c: string) => 0x1F1E6 - 65 + c.charCodeAt(0)))
                : '🌐';
        }

        geoCache.set(ip, { data, ts: Date.now() });
        return NextResponse.json({ success: true, data });

    } catch (err) {
        console.error(`[GeoIP] Complete lookup failure for ${ip}:`, err);
        // Serve a safe empty response on failure instead of 500 so the UI doesn't crash
        return NextResponse.json({
            success: false,
            data: { private: false, country: 'Unknown', countryCode: 'UN', city: 'Unknown', isp: 'Unknown', flag: '🌐' }
        });
    }
}
