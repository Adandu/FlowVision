import { NextResponse } from 'next/server';
import { clickhouse } from '@/lib/clickhouse';
import { getCurrentUser, hashPassword } from '@/lib/auth';

async function requireAdmin() {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return null;
    return user;
}

export async function GET() {
    if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const rows = await clickhouse.query({
        query: 'SELECT id, username, email, display_name, role, is_active, created_at, last_login FROM users FINAL ORDER BY created_at ASC',
        format: 'JSONEachRow',
    }).then(r => r.json());
    return NextResponse.json({ success: true, data: rows });
}

export async function POST(request: Request) {
    if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { username, email, password, role, display_name } = await request.json();
    if (!username || !password) return NextResponse.json({ error: 'username and password required' }, { status: 400 });
    const hash = await hashPassword(password);
    await clickhouse.command({
        query: `INSERT INTO users (username, email, display_name, role, password_hash, is_active) VALUES ({u:String},{e:String},{d:String},{r:String},{h:String},1)`,
        query_params: { u: username, e: email || '', d: display_name || username, r: role || 'viewer', h: hash },
    });
    return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
    if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    await clickhouse.command({ query: `ALTER TABLE users DELETE WHERE id = {id:String}`, query_params: { id } });
    return NextResponse.json({ success: true });
}

export async function PATCH(request: Request) {
    if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id, role, is_active } = await request.json();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    // Re-insert with updated fields using ReplacingMergeTree pattern
    await clickhouse.command({
        query: `INSERT INTO users (id, username, email, display_name, role, password_hash, is_active)
                SELECT id, username, email, display_name, {role:String}, password_hash, {active:UInt8}
                FROM users FINAL WHERE id = {id:String}`,
        query_params: { id, role: role || 'viewer', active: is_active !== undefined ? Number(is_active) : 1 },
    });
    return NextResponse.json({ success: true });
}
