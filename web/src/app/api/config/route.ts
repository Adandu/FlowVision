import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json({ success: true, auth_mode: process.env.AUTH_MODE || 'local' }, {
        headers: {
            'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=10'
        }
    });
}
