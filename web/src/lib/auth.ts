import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { clickhouse } from './clickhouse';

const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET || 'flowvision-change-me-in-production-please'
);
const COOKIE_NAME = 'flowvision_token';
const TOKEN_TTL = '7d';

export interface User {
    id: string;
    username: string;
    email: string;
    display_name: string;
    role: 'admin' | 'viewer';
    timezone: string;
    language: string;
    is_active: number;
}

// ─── Password ─────────────────────────────────────────────────────────────────
export async function hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
}

// ─── JWT ──────────────────────────────────────────────────────────────────────
export async function createToken(userId: string, role: string): Promise<string> {
    return new SignJWT({ sub: userId, role })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(TOKEN_TTL)
        .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<{ sub: string; role: string } | null> {
    try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        return { sub: payload.sub as string, role: payload.role as string };
    } catch {
        return null;
    }
}

// ─── Current user (server-side) ───────────────────────────────────────────────
export async function getCurrentUser(): Promise<User | null> {
    try {
        const authMode = process.env.AUTH_MODE || 'disabled';

        if (authMode === 'disabled') {
            return {
                id: '00000000-0000-0000-0000-000000000000',
                username: 'admin',
                email: 'admin@local',
                display_name: 'Local Administrator',
                role: 'admin',
                timezone: 'UTC',
                language: 'en',
                is_active: 1
            };
        }

        if (authMode === 'proxy') {
            const reqHeaders = await import('next/headers').then(m => m.headers());
            const remoteUser = reqHeaders.get('Remote-User') || reqHeaders.get('X-Forwarded-User');
            if (remoteUser) {
                const rows = await clickhouse.query({
                    query: `SELECT id, username, email, display_name, role, timezone, language, is_active
                            FROM users FINAL WHERE username = {u:String} AND is_active = 1 LIMIT 1`,
                    query_params: { u: remoteUser },
                    format: 'JSONEachRow',
                }).then(r => r.json<User>());

                if (rows.length > 0) return rows[0];
                return {
                    id: 'proxy-user', username: remoteUser, email: '', display_name: remoteUser,
                    role: 'admin', timezone: 'UTC', language: 'en', is_active: 1
                };
            }
        }

        const cookieStore = await cookies();
        const token = cookieStore.get(COOKIE_NAME)?.value;
        if (!token) return null;

        const payload = await verifyToken(token);
        if (!payload) return null;

        const rows = await clickhouse.query({
            query: `SELECT id, username, email, display_name, role, timezone, language, is_active
                    FROM users FINAL WHERE id = {id:String} AND is_active = 1 LIMIT 1`,
            query_params: { id: payload.sub },
            format: 'JSONEachRow',
        }).then(r => r.json<User>());

        return rows[0] || null;
    } catch {
        return null;
    }
}

// ─── Middleware helper (Edge runtime — no ClickHouse, JWT-only) ───────────────
export async function verifyTokenEdge(token: string | undefined): Promise<boolean> {
    if (!token) return false;
    const payload = await verifyToken(token);
    return !!payload;
}

export { COOKIE_NAME };
