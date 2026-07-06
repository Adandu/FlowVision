import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout', '/_next', '/favicon.ico', '/api/config'];
const GUEST_PATHS = ['/', '/active-ips', '/active-services', '/active-applications', '/flow-log'];
const GUEST_PATH_PREFIXES = ['/ip/'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow public paths
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next();

  let guestModeEnabled = false;
  try {
    const apiUrl = `http://127.0.0.1:${process.env.PORT || 3000}/api/config`;
    const configRes = await fetch(apiUrl, { next: { revalidate: 10 } });
    const config = await configRes.json();
    guestModeEnabled = !!config.guest_mode_enabled;
  } catch (e) { }

  if (guestModeEnabled) {
    const isProtectedApi = pathname.startsWith('/api/admin') || pathname.startsWith('/api/auth/me') || pathname.startsWith('/api/profile') || pathname.startsWith('/api/alerts');
    const isGuestRoute = GUEST_PATHS.includes(pathname) || GUEST_PATH_PREFIXES.some(p => pathname.startsWith(p)) || (pathname.startsWith('/api/') && !isProtectedApi);
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
