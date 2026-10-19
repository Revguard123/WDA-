import { NextResponse } from 'next/server';
import { contractPath, isBuyerAccessToken } from './lib/buyerUrls.js';
import { isSameOriginRequest } from './lib/requestOrigin.js';

function privateResponse(response) {
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}

export function middleware(request) {
  const { pathname } = request.nextUrl;
  // Cookie-authorized mutations must come from our own origin. Legacy bearer
  // API clients keep working; they do not rely on ambient browser credentials.
  if (/^\/api\/(?:profile|activate|discover)\/me(?:\/|$)/.test(pathname)
    && !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    if (!isSameOriginRequest(request)) {
      return privateResponse(NextResponse.json({ error: 'Invalid request origin' }, { status: 403 }));
    }
  }
  const page = /^\/(setup|discover|start|contracts|targeting)\/([^/]+)\/?$/.exec(pathname);
  const detail = /^\/d\/([^/]+)\/([^/]+)\/?$/.exec(pathname);
  const key = page?.[2] || detail?.[1];
  if (key === 'me' || isBuyerAccessToken(key)) {
    const destination = page ? `/${page[1]}${request.nextUrl.search}` : contractPath('contract', detail[2]);
    const url = request.nextUrl.clone();
    if (key === 'me') {
      url.pathname = destination.split('?')[0];
      url.search = destination.includes('?') ? destination.slice(destination.indexOf('?')) : '';
    } else {
      // Validate and exchange old emailed links in a Node route handler. Never
      // render a credential into a page or serialize it into client props.
      url.pathname = '/auth/access';
      url.search = '';
      url.searchParams.set('token', key);
      url.searchParams.set('next', destination);
    }
    return privateResponse(NextResponse.redirect(url, 303));
  }
  return privateResponse(NextResponse.next());
}

export const config = {
  matcher: ['/', '/setup/:path*', '/discover/:path*', '/start/:path*', '/contracts/:path*', '/targeting/:path*', '/d/:path*', '/auth/:path*', '/portal', '/access', '/api/profile/:path*', '/api/activate/:path*', '/api/discover/:path*'],
};
