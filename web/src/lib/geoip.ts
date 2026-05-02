const geoCache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 24 * 3600 * 1000; // 24 hours

export interface GeoIPData {
    private: boolean;
    country: string;
    countryCode: string;
    region?: string;
    city: string;
    isp: string;
    asn: string;
    org?: string;
    lat: number;
    lon: number;
    timezone?: string;
    flag: string;
}

export async function lookupIp(ip: string): Promise<GeoIPData> {
    if (!/^[0-9a-fA-F:.]+$/.test(ip)) {
        return { private: true, country: 'Invalid IP', countryCode: 'UN', isp: 'Invalid', asn: '', lat: 0, lon: 0, city: '', flag: '🌐' };
    }

    // Fast-path for private/internal IPs
    const isPrivateIP = /^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|127\.|169\.254\.|::1|fc00:|fe80:)/.test(ip);
    if (isPrivateIP) {
        return { private: true, country: 'Private Network', countryCode: 'LAN', isp: 'Local', asn: '', lat: 0, lon: 0, city: '', flag: '🏠' };
    }

    // Fast-path for obfuscated IPs (Guest Mode / Privacy Mode)
    if (ip.startsWith('***.')) {
        return { private: true, country: 'Hidden IP', countryCode: 'UN', isp: 'Hidden', asn: '', lat: 0, lon: 0, city: '', flag: '🕵️' };
    }

    // Return cached result if available
    const cached = geoCache.get(ip);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
        return cached.data;
    }

    let data: any = null;

    // Try IPInfo first (1000/day limit)
    try {
        const ipinfoRes = await fetch(`https://ipinfo.io/${ip}/json`, { next: { revalidate: 3600 } });
        if (ipinfoRes.ok) {
            const json = await ipinfoRes.json();
            if (json.bogon) {
                data = { private: true, country: 'Private Network', countryCode: 'LAN', isp: 'Local', asn: '', lat: 0, lon: 0, city: '', flag: '🏠' };
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

    // fallback to ip-api.com (45/minute limit)
    if (!data) {
        try {
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
        } catch (e) {
            console.warn(`[GeoIP] ip-api.com failed for ${ip}`);
        }
    }

    if (!data) {
        // Safe fallback
        data = { private: false, country: 'Unknown', countryCode: 'UN', city: 'Unknown', isp: 'Unknown', asn: '', lat: 0, lon: 0, flag: '🌐' };
    } else if (!data.private) {
        data.flag = data.countryCode
            ? String.fromCodePoint(...data.countryCode.toUpperCase().split('').map((c: string) => 0x1F1E6 - 65 + c.charCodeAt(0)))
            : '🌐';
    }

    geoCache.set(ip, { data, ts: Date.now() });
    return data;
}

export async function batchGeoIPLookup(ips: string[]): Promise<Record<string, GeoIPData>> {
    const uniqueIps = Array.from(new Set(ips.filter(ip => !!ip)));
    const results: Record<string, GeoIPData> = {};

    // Process in batches of 10 to stay within rate limits while avoiding sequential blocking
    const BATCH_SIZE = 10;
    for (let i = 0; i < uniqueIps.length; i += BATCH_SIZE) {
        const chunk = uniqueIps.slice(i, i + BATCH_SIZE);
        const chunkResults = await Promise.all(chunk.map(ip => lookupIp(ip)));
        chunk.forEach((ip, j) => { results[ip] = chunkResults[j]; });
    }

    return results;
}
