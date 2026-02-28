import { NextResponse } from 'next/server';
import { clickhouse } from '@/lib/clickhouse';
import { getCurrentUser, verifyPassword, hashPassword } from '@/lib/auth';

export async function POST(request: Request) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { current_password, new_password } = await request.json();
    if (!current_password || !new_password) {
        return NextResponse.json({ error: 'current_password and new_password required' }, { status: 400 });
    }
    if (new_password.length < 8) {
        return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 });
    }

    // Fetch current hash
    const rows = await clickhouse.query({
        query: 'SELECT password_hash FROM users FINAL WHERE id = {id:String} LIMIT 1',
        query_params: { id: user.id },
        format: 'JSONEachRow',
    }).then(r => r.json<{ password_hash: string }>());

    if (!rows[0]) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const valid = await verifyPassword(current_password, rows[0].password_hash);
    if (!valid) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });

    const newHash = await hashPassword(new_password);
    await clickhouse.command({
        query: `INSERT INTO users (id, username, email, display_name, role, password_hash, timezone, language, is_active)
                SELECT id, username, email, display_name, role, {h:String}, timezone, language, is_active
                FROM users FINAL WHERE id = {id:String}`,
        query_params: { id: user.id, h: newHash },
    });
    return NextResponse.json({ success: true });
}
