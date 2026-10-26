import { NextResponse } from 'next/server';
import { BUYER_ACCESS_COOKIE } from '../../../lib/buyerUrls.js';
import { isSameOriginRequest, requestOrigin } from '../../../lib/requestOrigin.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function privateResponse(response) {
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}

// End only this browser's workspace session. Do not revoke emailed access
// links, touch buyer records, or sign the member out of Kajabi.
export async function POST(request) {
  const origin = requestOrigin(request);
  if (!isSameOriginRequest(request, origin, { allowPrivateFormNavigation: true })) {
    return privateResponse(NextResponse.json({ error: 'Invalid request origin' }, { status: 403 }));
  }
  const response = privateResponse(NextResponse.redirect(new URL('/portal?logged_out=1', origin), 303));
  response.cookies.set(BUYER_ACCESS_COOKIE, '', {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax',
    path: '/', maxAge: 0, expires: new Date(0),
  });
  return response;
}
