import { NextResponse } from 'next/server';
import { lookupIp } from '@/lib/geoip';

export async function GET(_req: Request, { params }: { params: Promise<{ ip: string }> }) {
    const { ip } = await params;

    try {
        const data = await lookupIp(ip);
        return NextResponse.json({ success: true, data });
    } catch (err) {
        console.error(`[GeoIP API] Lookup failure for ${ip}:`, err);
        return NextResponse.json({
            success: false,
            data: { private: false, country: 'Unknown', countryCode: 'UN', city: 'Unknown', isp: 'Unknown', lat: 0, lon: 0, asn: '', flag: '🌐' }
        });
    }
}
