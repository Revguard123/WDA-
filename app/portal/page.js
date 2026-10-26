// Seamless portal (Slice 6, option 3, smoothest). Linked from Kajabi as
// /portal?email={{ current_member.email }} so a logged-in member lands straight
// in their FULL contracts portal, no email round-trip. It resolves the buyer by
// email and enters through the legacy-link exchange, which sets an HTTP-only
// cookie and redirects to the clean setup/contracts URL.
//
// ACCEPTED TRADEOFF (explicitly chosen): anyone who edits the ?email= to
// another member's address reaches that member's full account (view contracts,
// update targeting). This is the smoothest experience at the cost of that
// exposure. To tighten later, gate this behind real Kajabi SSO / a signed token.

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import PortalEmailForm from '../_components/PortalEmailForm.jsx';
import SupportCTA from '../_components/SupportCTA.jsx';
import RecoveryScreen from '../_components/RecoveryScreen.jsx';
import PortalFrame from '../_components/PortalFrame.jsx';
import { getBuyerByEmail, getBuyerByToken } from '../../lib/buyers.js';
import { portalPathForBuyer } from '../../lib/journey.js';
import { BUYER_ACCESS_COOKIE, BUYER_SESSION_KEY, isBuyerAccessToken } from '../../lib/buyerUrls.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function PortalPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const email = String(sp.email || '').trim();
  const supportEmail = process.env.SUPPORT_TO_EMAIL || '';

  // An explicit Kajabi/email entry keeps its existing behavior. Otherwise,
  // resume only a validated, current HTTP-only buyer session on either entry
  // route. A malformed/revoked cookie never becomes an account identifier.
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    const accessCookie = (await cookies()).get(BUYER_ACCESS_COOKIE)?.value;
    if (isBuyerAccessToken(accessCookie)) {
      const buyer = await getBuyerByToken(BUYER_SESSION_KEY);
      if (buyer) redirect(portalPathForBuyer({ ...buyer, access_token: BUYER_SESSION_KEY }));
    }
    const sessionExpired = Boolean(accessCookie);
    const signedOut = sp.logged_out === '1' && !accessCookie;
    return (
      <PortalFrame email={email} supportEmail={supportEmail} pageContext="portal">
        {sessionExpired ? <p className="wda-portal-session-note" role="status">Your previous session is no longer available. Enter your enrollment email to reopen your workspace.</p> : null}
        {signedOut ? <p className="wda-portal-session-note" role="status">You are logged out on this device. Your saved profile and contracts are still here when you return.</p> : null}
        <PortalEmailForm />
        <div className="wda-portal-alternative"><span>Prefer an email link?</span><a href="/access">Get a link by email</a></div>
      </PortalFrame>
    );
  }

  const buyer = await getBuyerByEmail(email);
  if (buyer) {
    // First-timers (not yet activated) go to niche setup first; everyone else
    // straight to their contracts. This makes the portal button a safe entry
    // point even if a brand-new member never opened their welcome email.
    redirect(portalPathForBuyer(buyer));
  }

  // An entered email did not match a buyer; this is not a verified sign-in.
  return (
    <RecoveryScreen variant="account" email={email} supportBar={<SupportCTA sticky pageContext="portal" initialEmail={email} supportEmail={supportEmail} />} />
  );
}
