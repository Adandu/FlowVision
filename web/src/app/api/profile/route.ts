import { NextResponse } from 'next/server';
import { clickhouse } from '@/lib/clickhouse';
import { getCurrentUser, verifyPassword, hashPassword } from '@/lib/auth';

export async function GET() {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    return NextResponse.json({ success: true, user });
}

export async function PATCH(request: Request) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { display_name, timezone, language } = await request.json();
    await clickhouse.command({
        query: `INSERT INTO users (id, username, email, display_name, role, password_hash, timezone, language, is_active)
                SELECT id, username, email, {dn:String}, role, password_hash, {tz:String}, {lang:String}, is_active
                FROM users FINAL WHERE id = {id:String}`,
        query_params: {
            id: user.id,
            dn: display_name || user.display_name,
            tz: timezone || user.timezone,
            lang: language || user.language,
        },
    });
    return NextResponse.json({ success: true });
}
