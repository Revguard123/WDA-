import { cookies } from 'next/headers';
import { BUYER_ACCESS_COOKIE, BUYER_SESSION_KEY, isBuyerAccessToken } from './buyerUrls.js';

// Only the reserved session key reads the HTTP-only cookie. An arbitrary slug
// is not an account identifier and can never authorize a buyer lookup.
export async function resolveBuyerAccessToken(key) {
  const token = key === BUYER_SESSION_KEY ? (await cookies()).get(BUYER_ACCESS_COOKIE)?.value : key;
  return isBuyerAccessToken(token) ? token : null;
}
