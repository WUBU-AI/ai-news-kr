import { NextRequest, NextResponse } from 'next/server';

const IS_VERCEL = process.env.DEPLOYMENT_TARGET === 'vercel';

// Routes only available on the local backend server
const BACKEND_ONLY_PREFIXES = ['/admin', '/api/admin', '/api/cron'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Block backend-only routes on Vercel frontend deployment
  if (IS_VERCEL && BACKEND_ONLY_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return new NextResponse('Not Found', { status: 404 });
  }

  // Admin auth: covers /admin/* pages AND /api/admin/* endpoints (local server only)
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    const authHeader = request.headers.get('authorization');

    if (authHeader) {
      const base64 = authHeader.replace('Basic ', '');
      const decoded = Buffer.from(base64, 'base64').toString('utf-8');
      const [username, ...rest] = decoded.split(':');
      const password = rest.join(':');

      const expectedUser = process.env.ADMIN_USERNAME || 'admin';
      const expectedPass = process.env.ADMIN_PASSWORD || 'admin';

      if (username === expectedUser && password === expectedPass) {
        return NextResponse.next();
      }
    }

    return new NextResponse('Unauthorized', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="AI News KR Admin"',
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*', '/api/cron/:path*'],
};
