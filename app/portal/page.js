// Seamless portal (Slice 6, option 3, smoothest). Linked from Kajabi as
// /portal?email={{ current_member.email }} so a logged-in member lands straight
// in their FULL contracts portal, no email round-trip. It resolves the buyer by
// email and redirects to their tokenized contracts page, so deep-dives and
// targeting edits all work.
//
// ACCEPTED TRADEOFF (explicitly chosen): the resulting URL carries the buyer's
// access token, which is their account key. Anyone who edits the ?email= to
// another member's address reaches that member's full account (view contracts,
// update targeting). This is the smoothest experience at the cost of that
// exposure. To tighten later, gate this behind real Kajabi SSO / a signed token.

import { redirect } from 'next/navigation';
import Shell from '../_components/Shell.jsx';
import PortalEmailForm from '../_components/PortalEmailForm.jsx';
import { getBuyerByEmail } from '../../lib/buyers.js';
import { UI, DISPLAY_FONT } from '../../lib/ui.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function PortalPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const email = String(sp.email || '').trim();

  // No usable email (missing, or Kajabi did not render the Liquid tag) -> show a
  // one-field gate that drops them straight into their portal on submit. No
  // email round-trip.
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return (
      <Shell subtitle="Open your contracts.">
        <div style={{ background: UI.card, border: `1px solid ${UI.line}`, borderRadius: 12, borderTop: `4px solid ${UI.orange}`, padding: 28 }}>
          <h1 style={{ margin: '0 0 8px', fontSize: 24, color: UI.ink, fontFamily: DISPLAY_FONT, letterSpacing: '-0.4px' }}>
            Open your contracts
          </h1>
          <p style={{ color: UI.muted, fontSize: 15, lineHeight: 1.55, marginTop: 0 }}>
            Enter the email you used to sign up for War Dogs Academy and we will take you straight to your contracts.
          </p>
          <div style={{ marginTop: 18 }}>
            <PortalEmailForm />
          </div>
        </div>
      </Shell>
    );
  }

  const buyer = await getBuyerByEmail(email);
  if (buyer) redirect(`/contracts/${buyer.access_token}`);

  // Signed in with an email we do not have an account for.
  return (
    <Shell subtitle="Your contracts.">
      <div style={{ background: UI.card, border: `1px solid ${UI.line}`, borderRadius: 10, padding: 24, color: UI.text, fontSize: 15, lineHeight: 1.55 }}>
        We could not find an account for <strong>{email}</strong>. Make sure you are viewing this while signed in with
        the same email you used to sign up for War Dogs Academy. You can also{' '}
        <a href="/access" style={{ color: UI.ink, fontWeight: 700 }}>get your link by email</a>.
      </div>
    </Shell>
  );
}
