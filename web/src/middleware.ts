import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout', '/_next', '/favicon.ico', '/api/config'];
const GUEST_PATHS = ['/', '/ip', '/active-ips', '/active-services', '/flow-log', '/alerts'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow public paths
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next();

  let guestModeEnabled = false;
  try {
    const configRes = await fetch(new URL('/api/config', request.url).toString(), { next: { revalidate: 10 } });
    const config = await configRes.json();
    guestModeEnabled = !!config.guest_mode_enabled;
  } catch (e) { }

  if (guestModeEnabled) {
    const isProtectedApi = pathname.startsWith('/api/admin') || pathname.startsWith('/api/auth/me') || pathname.startsWith('/api/profile');
    const isGuestRoute = GUEST_PATHS.includes(pathname) || pathname.startsWith('/ip/') || (pathname.startsWith('/api/') && !isProtectedApi);
    if (isGuestRoute) return NextResponse.next();
  }

  const authMode = process.env.AUTH_MODE || 'disabled';

  if (authMode === 'disabled') return NextResponse.next();

  if (authMode === 'proxy') {
    // Trust reverse proxy headers (Authelia, Authentik, Traefik)
    const remoteUser = request.headers.get('Remote-User') || request.headers.get('X-Forwarded-User');
    if (remoteUser) return NextResponse.next();
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // AUTH_MODE === 'local' — verify JWT cookie
  const token = request.cookies.get('flowvision_token')?.value;
  if (!token) return NextResponse.redirect(new URL('/login', request.url));

  try {
    const { jwtVerify } = await import('jose');
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'flowvision-change-me-in-production-please');
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.set('flowvision_token', '', { maxAge: 0 });
    return response;
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
};
