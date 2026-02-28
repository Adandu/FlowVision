import { NextResponse } from 'next/server';
import { clickhouse } from '@/lib/clickhouse';
import { verifyPassword, createToken, hashPassword, COOKIE_NAME } from '@/lib/auth';

export async function POST(request: Request) {
    try {
        const { username, password } = await request.json();
        if (!username || !password) {
            return NextResponse.json({ success: false, error: 'Username and password required' }, { status: 400 });
        }

        const rows = await clickhouse.query({
            query: `SELECT id, username, email, display_name, role, password_hash, is_active
                    FROM users FINAL WHERE username = {u:String} LIMIT 1`,
            query_params: { u: username },
            format: 'JSONEachRow',
        }).then(r => r.json<any>());

        const user = rows[0];
        if (!user || !user.is_active) {
            return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
        }

        const valid = await verifyPassword(password, user.password_hash);
        if (!valid) {
            return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
        }

        // Update last_login
        await clickhouse.command({
            query: `INSERT INTO users (id, username, email, display_name, role, password_hash, is_active, last_login)
                    SELECT id, username, email, display_name, role, password_hash, is_active, now64()
                    FROM users FINAL WHERE id = {id:String}`,
            query_params: { id: user.id },
        }).catch(() => { }); // Non-critical

        const token = await createToken(user.id, user.role);

        const response = NextResponse.json({
            success: true,
            user: { id: user.id, username: user.username, role: user.role, display_name: user.display_name },
        });
        response.cookies.set(COOKIE_NAME, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7, // 7 days
            path: '/',
        });
        return response;
    } catch (err) {
        console.error('Login error:', err);
        return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
    }
}
