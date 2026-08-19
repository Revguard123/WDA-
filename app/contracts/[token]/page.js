import Shell, { NotFound } from '../../_components/Shell.jsx';
import SupportCTA from '../../_components/SupportCTA.jsx';
import { getBuyerByToken } from '../../../lib/buyers.js';
import { listDeliveriesForBuyer } from '../../../lib/deliveries.js';
import { UI } from '../../../lib/ui.js';
import { CONTRACT_CARD_BREAKDOWN_CTA, CONTRACT_CARD_WHY_LABEL, contractEvidenceChips, contractVerifyItems, contractsPresentationForBuyer } from '../../../lib/contractsPresentation.js';

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
  const presentation = contractsPresentationForBuyer(buyer, { deliveryCount: deliveries.length });

  const kajabiUrl = process.env.KAJABI_LIBRARY_URL || 'https://www.wardogsacademy.co/library';

  return (
    <Shell maxWidth={1120} subtitle="Every target we have sent you, newest first.">
      <style>{`
        .contracts-hero{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px;align-items:start;margin-bottom:18px;max-width:100%}
        .contracts-actions{display:flex;align-items:center;justify-content:flex-end;gap:10px;flex-wrap:wrap;min-width:0}
        .contracts-pill{display:inline-flex;align-items:center;gap:7px;max-width:100%;border:1px solid ${UI.line};border-radius:999px;background:#fff;padding:9px 13px;color:${UI.ink};font-size:13px;font-weight:600;text-decoration:none;box-shadow:0 8px 24px rgba(26,26,26,.04);white-space:normal}
        .contracts-pill.primary{border-color:${UI.pink};color:${UI.pinkDeep};background:#fff7fc}
        .contracts-title-card{max-width:100%;background:linear-gradient(135deg,#fff,#fff8fc);border:1px solid ${UI.line};border-radius:18px;padding:22px 24px;box-shadow:0 16px 42px rgba(26,26,26,.05);overflow:hidden}
        .contracts-title-row{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}
        .contracts-title{margin:0;color:${UI.ink};font-size:30px;letter-spacing:-.6px;line-height:1.12}
        .contracts-subtitle{max-width:680px;color:${UI.muted};font-size:15px;line-height:1.6;margin:10px 0 0}
        .contracts-account{color:${UI.muted};font-size:12.5px;margin-top:12px}
        .contracts-account strong{color:${UI.text};font-weight:600}
        .contracts-summary{display:grid;grid-template-columns:repeat(2,minmax(160px,1fr));gap:10px;margin-top:16px}
        .contracts-stat{border:1px solid ${UI.line};border-radius:14px;background:#fff;padding:13px 14px}
        .contracts-stat-label{color:${UI.muted};font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.7px}
        .contracts-stat-value{margin-top:5px;color:${UI.ink};font-size:20px;font-weight:600}
        .contracts-panel{max-width:100%;background:#fffaf4;border:1px solid ${UI.line};border-radius:16px;padding:16px 18px;margin-bottom:14px;box-shadow:0 10px 26px rgba(26,26,26,.035);overflow:hidden}
        .contracts-panel.alert{border-left:4px solid ${presentation.completed ? UI.orange : UI.pink}}
        .contracts-panel.targeting{border-left:4px solid ${UI.pink};background:${UI.panel}}
        .contracts-panel-title{font-size:12px;color:${UI.muted};font-weight:600;text-transform:uppercase;letter-spacing:.75px;margin-bottom:9px}
        .contracts-chips{display:flex;flex-wrap:wrap;gap:8px}
        .contracts-chip{display:inline-flex;align-items:center;border:1px solid ${UI.line};background:#fff;border-radius:999px;padding:6px 11px;color:${UI.ink};font-size:12.5px;font-weight:600}
        .contracts-card{position:relative;max-width:100%;background:#fff;border:1px solid ${UI.line};border-radius:20px;padding:24px;margin-bottom:18px;box-shadow:0 18px 44px rgba(26,26,26,.07);overflow:hidden}
        .contracts-card:before{content:"";position:absolute;left:0;top:0;right:0;height:4px;background:linear-gradient(90deg,${UI.pink},${UI.orange})}
        .contracts-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;flex-wrap:wrap}
        .contracts-card-title{color:${UI.ink};font-size:22px;font-weight:600;line-height:1.25;letter-spacing:-.25px;overflow-wrap:anywhere}
        .contracts-agency{color:${UI.muted};font-size:12px;text-transform:uppercase;letter-spacing:.45px;line-height:1.5;margin-top:7px}
        .contracts-due{border:1px solid ${UI.line};background:${UI.paper};border-radius:999px;padding:9px 13px;color:${UI.ink};font-weight:600;font-size:13px;white-space:nowrap}
        .contracts-why{background:#fff8f1;border:1px solid #f1dfca;border-left:4px solid ${UI.orange};padding:17px 18px;border-radius:14px;font-size:15.5px;color:${UI.text};margin-top:16px;line-height:1.62}
        .contracts-why-label{color:${UI.orangeDeep};font-size:11.5px;text-transform:uppercase;letter-spacing:.85px;font-weight:600;margin-bottom:7px}
        .contracts-verify{margin-top:13px;font-size:13.5px;color:${UI.muted};line-height:1.55}
        .contracts-buttons{display:flex;gap:9px;flex-wrap:wrap;margin-top:17px;min-width:0}
        .contracts-button{display:inline-flex;align-items:center;justify-content:center;max-width:100%;background:${UI.ink};color:#fff;text-decoration:none;font-weight:600;padding:10px 16px;border-radius:999px;font-size:14px;text-align:center}
        .contracts-button.secondary{background:#fff;color:${UI.text};border:1px solid ${UI.line}}
        .contracts-empty{background:#fff;border:1px solid ${UI.line};border-radius:18px;padding:28px;color:${UI.muted};font-size:15px;box-shadow:0 14px 34px rgba(26,26,26,.05)}
        @media(max-width:760px){.contracts-hero{grid-template-columns:minmax(0,1fr)}.contracts-actions{justify-content:flex-start}.contracts-title-card{padding:18px}.contracts-title{font-size:24px}.contracts-summary{grid-template-columns:minmax(0,1fr)}.contracts-card{padding:20px}.contracts-card-title{font-size:19px}.contracts-due{white-space:normal}.contracts-button,.contracts-pill{width:auto;max-width:100%}}
      `}</style>
      <div className="contracts-hero">
        {kajabiUrl ? (
          <a href={kajabiUrl} className="contracts-pill primary">
            &larr; Back to my products
          </a>
        ) : (
          <span />
        )}
        <div className="contracts-actions">
          <a href={`/setup/${token}?review=1`} className="contracts-pill">Review targeting</a>
          <a href={`/discover/${token}?update=1`} className="contracts-pill primary">Change niche for future batches</a>
        </div>
      </div>

      <section className="contracts-title-card">
        <div className="contracts-title-row">
          <div>
            <h1 className="contracts-title">{presentation.listTitle}</h1>
            <p className="contracts-subtitle">
              Matched to your niche and ranked around how strong each opportunity is for you. Here is the why on each.
            </p>
            <div className="contracts-account">Account: <strong style={{ fontWeight: 600 }}>{buyer.email}</strong></div>
          </div>
        </div>
        <div className="contracts-summary">
          <div className="contracts-stat">
            <div className="contracts-stat-label">Delivered targets</div>
            <div className="contracts-stat-value">{deliveries.length}</div>
          </div>
          <div className="contracts-stat">
            <div className="contracts-stat-label">Status</div>
            <div className="contracts-stat-value">{presentation.completed ? 'Complete' : 'Active'}</div>
          </div>
        </div>
      </section>

      {presentation.statusCallout ? (
        <div className="contracts-panel alert" style={{ marginTop: 16 }}>
          <div style={{ fontSize: 15, color: UI.ink, fontWeight: 600 }}>{presentation.statusCallout.title}</div>
          <div style={{ fontSize: 13.5, color: UI.text, lineHeight: 1.55, marginTop: 5 }}>
            {presentation.statusCallout.body}
          </div>
        </div>
      ) : null}

      {buyer.naics && buyer.naics.length > 0 ? (
        <div className="contracts-panel targeting">
          <div className="contracts-panel-title">
            Industries we are searching for you
          </div>
          <div className="contracts-chips">
            {buyer.naics.map((code) => (
              <span key={code} className="contracts-chip">
                NAICS {code}
              </span>
            ))}
          </div>
          <div style={{ fontSize: 12.5, color: UI.muted, marginTop: 9 }}>
            Not right? <a href={`/setup/${token}?review=1`} style={{ color: UI.ink, fontWeight: 600 }}>Review your targeting</a> or <a href={`/discover/${token}?update=1`} style={{ color: UI.ink, fontWeight: 600 }}>change your niche for future batches</a>.
          </div>
        </div>
      ) : null}

      {deliveries.length === 0 ? (
        <div className="contracts-empty">
          No contracts yet. {buyer.status === 'exploring' ? (
            <span>Set up your niche to get your first five: <a href={`/setup/${token}`} style={{ color: UI.ink, fontWeight: 600 }}>Set up your niche</a>.</span>
          ) : (
            <span>Your next batch will appear here.</span>
          )}
        </div>
      ) : (
        deliveries.map((c) => (
          <div key={c.notice_id} className="contracts-card">
            <div className="contracts-card-head">
              <div style={{ minWidth: 0, flex: '1 1 420px' }}>
                <div className="contracts-card-title">{c.title || 'Untitled solicitation'}</div>
                <div className="contracts-agency">{c.agency || 'Agency not stated'}</div>
              </div>
              <div className="contracts-due">
                Due {fmtDeadline(c.response_deadline)}
              </div>
            </div>
            <div className="contracts-chips" style={{ marginTop: 14 }}>
              {['NAICS ' + (c.naics || 'n/a'), c.set_aside_type || 'Full and open', `Batch ${c.batch_month}`].map((item) => (
                <span key={item} className="contracts-chip">{item}</span>
              ))}
            </div>
            {c.why_line ? (
              <div className="contracts-why">
                <div className="contracts-why-label">{CONTRACT_CARD_WHY_LABEL}</div>
                {c.why_line}
              </div>
            ) : null}
            {contractEvidenceChips(c).length ? (
              <div className="contracts-chips" style={{ marginTop: 12 }}>
                {contractEvidenceChips(c).map((chip) => <span key={chip} className="contracts-chip" style={{ background: '#fff7fc', borderColor: UI.pink }}>{chip}</span>)}
              </div>
            ) : null}
            {contractVerifyItems(c).length ? (
              <div className="contracts-verify">
                <strong style={{ color: UI.ink, fontWeight: 600 }}>Verify:</strong> {contractVerifyItems(c).join(' ')}
              </div>
            ) : null}
            <div className="contracts-buttons">
              <a href={`/d/${token}/${c.notice_id}`} className="contracts-button">{CONTRACT_CARD_BREAKDOWN_CTA}</a>
              {c.sam_url ? (
                <a href={c.sam_url} className="contracts-button secondary">View Solicitation</a>
              ) : null}
            </div>
          </div>
        ))
      )}
      <SupportCTA pageContext="contracts" />
    </Shell>
  );
}
