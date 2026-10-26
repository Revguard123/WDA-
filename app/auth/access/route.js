import { NextResponse } from 'next/server';
import { getBuyerByToken } from '../../../lib/buyers.js';
import { getDeliveryForBuyer } from '../../../lib/deliveries.js';
import { BUYER_ACCESS_COOKIE, BUYER_SESSION_SECONDS, contractPath, isBuyerAccessToken, noticeIdFromSlug, safeBuyerDestination } from '../../../lib/buyerUrls.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const buyer = isBuyerAccessToken(token) ? await getBuyerByToken(token) : null;
  let destination = '/access';
  if (buyer) {
    destination = safeBuyerDestination(url.searchParams.get('next'));
    if (destination.startsWith('/d/')) {
      const record = await getDeliveryForBuyer(buyer.id, noticeIdFromSlug(destination.slice(3)));
      if (record) destination = contractPath(record.opportunity?.title, record.notice_id);
    }
  }
  const response = NextResponse.redirect(new URL(destination, url.origin), 303);
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  if (buyer) response.cookies.set(BUYER_ACCESS_COOKIE, buyer.access_token, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax',
    path: '/', maxAge: BUYER_SESSION_SECONDS,
  });
  return response;
}
