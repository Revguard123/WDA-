// Seamless read-only portal (Slice 6, option 3). Linked from Kajabi as
// /portal?email={{ current_member.email }} so a logged-in member lands straight
// on their contracts, no email round-trip. It resolves the buyer by email and
// renders their contracts READ-ONLY. It deliberately never exposes the buyer's
// access token, so editing the ?email= to someone else can only read a contract
// list (public federal opportunities + niche), never obtain an account key or
// change anyone's targeting. Deep-dives and targeting edits stay behind the
// tokenized links we email, which remain private.

import Shell from '../_components/Shell.jsx';
import { redirect } from 'next/navigation';
import { getBuyerByEmail } from '../../lib/buyers.js';
import { listDeliveriesForBuyer } from '../../lib/deliveries.js';
import { UI } from '../../lib/ui.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function fmtDeadline(iso) {
  if (!iso) return 'See solicitation';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'See solicitation';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export default async function PortalPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const email = String(sp.email || '').trim();

  // No usable email (missing, or Kajabi did not render the Liquid tag) -> fall
  // back to the email-entry page so the member still has a way in.
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) redirect('/access');

  const buyer = await getBuyerByEmail(email);
  if (!buyer) {
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

  const deliveries = await listDeliveriesForBuyer(buyer.id);

  return (
    <Shell subtitle="Every target we have sent you, newest first.">
      <h1 style={{ margin: '0 0 14px', fontSize: 22, color: UI.ink }}>Your contracts</h1>

      {deliveries.length === 0 ? (
        <div style={{ background: UI.card, border: `1px solid ${UI.line}`, borderRadius: 10, padding: 24, color: UI.muted, fontSize: 15 }}>
          {buyer.status === 'exploring'
            ? 'You have not set up your niche yet. Open the welcome email we sent you to get started.'
            : 'No contracts yet. Your next batch will appear here.'}
        </div>
      ) : (
        <>
          {deliveries.map((c) => (
            <div key={c.notice_id} style={{ background: UI.card, border: `1px solid ${UI.line}`, borderRadius: 10, padding: 20, marginBottom: 14 }}>
              <div style={{ height: 3, background: UI.gold, borderRadius: 3, marginBottom: 12, width: 48 }} />
              <div style={{ fontSize: 17, fontWeight: 700, color: UI.ink, lineHeight: 1.35 }}>{c.title || 'Untitled solicitation'}</div>
              <div style={{ fontSize: 13, color: UI.muted, marginTop: 4 }}>{c.agency || 'Agency not stated'}</div>
              <div style={{ fontSize: 13, color: UI.muted, marginTop: 8 }}>
                NAICS {c.naics || 'n/a'} &middot; {c.set_aside_type || 'Full and open'} &middot; Due {fmtDeadline(c.response_deadline)} &middot; Batch {c.batch_month}
              </div>
              {c.why_line ? (
                <div style={{ background: UI.paper, borderLeft: `3px solid ${UI.green}`, padding: '10px 12px', borderRadius: '0 4px 4px 0', fontSize: 14, color: UI.text, marginTop: 12, lineHeight: 1.5 }}>
                  <strong style={{ color: UI.green }}>Why we picked this.</strong> {c.why_line}
                </div>
              ) : null}
              {c.sam_url ? (
                <div style={{ marginTop: 14 }}>
                  <a href={c.sam_url} style={{ display: 'inline-block', color: UI.text, textDecoration: 'none', fontWeight: 600, padding: '9px 14px', border: `1px solid ${UI.line}`, borderRadius: 6, fontSize: 14 }}>View on SAM.gov</a>
                </div>
              ) : null}
            </div>
          ))}
          <div style={{ marginTop: 6, fontSize: 13, color: UI.muted, lineHeight: 1.55 }}>
            For the full deep-dive on any contract and to update your targeting, open the private link in any email we
            have sent you.
          </div>
        </>
      )}
    </Shell>
  );
}
