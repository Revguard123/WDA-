import Shell, { NotFound } from '../../_components/Shell.jsx';
import { getBuyerByToken } from '../../../lib/buyers.js';
import { listDeliveriesForBuyer } from '../../../lib/deliveries.js';
import { UI } from '../../../lib/ui.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function fmtDeadline(iso) {
  if (!iso) return 'See solicitation';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'See solicitation';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export default async function ContractsPage({ params }) {
  const { token } = params;
  const buyer = await getBuyerByToken(token);
  if (!buyer) return <NotFound what="link" />;

  const deliveries = await listDeliveriesForBuyer(buyer.id);

  return (
    <Shell subtitle="Every target we have sent you, newest first.">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
        <h1 style={{ margin: 0, fontSize: 22, color: UI.ink }}>Your contracts</h1>
        <a href={`/targeting/${token}`} style={{ color: UI.ink, fontWeight: 700, fontSize: 14 }}>Update targeting</a>
      </div>

      {deliveries.length === 0 ? (
        <div style={{ background: UI.card, border: `1px solid ${UI.line}`, borderRadius: 10, padding: 24, color: UI.muted, fontSize: 15 }}>
          No contracts yet. {buyer.status === 'exploring' ? (
            <span>Start your trial to get your first five: <a href={`/start/${token}`} style={{ color: UI.ink, fontWeight: 700 }}>Go</a>.</span>
          ) : (
            <span>Your next batch will appear here.</span>
          )}
        </div>
      ) : (
        deliveries.map((c) => (
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
            <div style={{ marginTop: 14 }}>
              <a href={`/d/${token}/${c.notice_id}`} style={{ display: 'inline-block', background: UI.ink, color: '#fff', textDecoration: 'none', fontWeight: 600, padding: '9px 16px', borderRadius: 6, fontSize: 14, marginRight: 8 }}>Dive Deeper</a>
              {c.sam_url ? (
                <a href={c.sam_url} style={{ display: 'inline-block', color: UI.text, textDecoration: 'none', fontWeight: 600, padding: '9px 14px', border: `1px solid ${UI.line}`, borderRadius: 6, fontSize: 14 }}>View on SAM.gov</a>
              ) : null}
            </div>
          </div>
        ))
      )}
    </Shell>
  );
}
