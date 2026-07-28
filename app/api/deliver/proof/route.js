// Slice 3 live proof/trigger. Runs the full delivery pipeline for a buyer:
//   pull -> curate -> deep-dive -> render email -> persist deliveries (with the
//   never-repeat guard) -> increment batch -> optionally send via Resend.
//
// GET /api/deliver/proof?secret=<CRON_SECRET>&naics=236220&state=VA&setAside=sb
//     &keywords=construction,renovation,repair&buyerEmail=you@example.com&send=0
//
// send=1 requires RESEND_API_KEY + a verified domain. Without it the email is
// rendered and returned but not sent, so the DB write and never-repeat lock can
// still be proven. Run it twice with the same buyer to see repeats get skipped.

import { runEngineForNiche } from '../../../../lib/sam/engine.js';
import { curateForBuyer } from '../../../../lib/match/curate.js';
import { disqualifyContract, whyLine, deepDive } from '../../../../lib/ai/claude.js';
import { buildBatchEmailHTML } from '../../../../lib/email/renderBatchEmail.js';
import { findOrCreateBuyer, incrementBatchesSent } from '../../../../lib/buyers.js';
import { persistBatch } from '../../../../lib/deliveries.js';
import { sendBatchEmail } from '../../../../lib/email/resend.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function authorized(req, url) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get('authorization') || '';
  if (header === `Bearer ${secret}`) return true;
  return url.searchParams.get('secret') === secret;
}

const DEFAULT_KEYWORDS = ['construction', 'renovation', 'building', 'repair', 'facility', 'alteration'];

export async function GET(req) {
  const url = new URL(req.url);
  if (!authorized(req, url)) return Response.json({ error: 'unauthorized' }, { status: 401 });
  for (const k of ['SAM_API_KEY', 'ANTHROPIC_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
    if (!process.env[k]) return Response.json({ error: `${k} not set` }, { status: 500 });
  }

  const setAside = url.searchParams.get('setAside');
  const keywordsParam = url.searchParams.get('keywords');
  const minRunwayDays = Number(url.searchParams.get('minRunwayDays')) || 14;
  const buyerEmail = url.searchParams.get('buyerEmail') || 'demo-buyer@wardogsacademy.com';
  const wantSend = url.searchParams.get('send') === '1';

  const niche = {
    naics: [url.searchParams.get('naics') || '236220'],
    state: url.searchParams.get('state') || 'VA',
    set_asides: setAside ? [setAside] : ['sb'],
    keywords: keywordsParam ? keywordsParam.split(',').map((s) => s.trim()).filter(Boolean) : DEFAULT_KEYWORDS,
  };

  try {
    const buyer = await findOrCreateBuyer({ email: buyerEmail, name: url.searchParams.get('name'), niche });

    // Pull + curate.
    const { rows } = await runEngineForNiche(buyer, {
      apiKey: process.env.SAM_API_KEY,
      minRunwayDays,
      resolveDescriptions: true,
    });
    const { chosen, stats } = await curateForBuyer(
      rows,
      buyer,
      { disqualify: disqualifyContract, writeWhyLine: whyLine },
      { minRunwayDays, n: 5, maxCandidates: 12 },
    );

    // Deep-dive for each chosen contract.
    const rowById = new Map(rows.map((r) => [r.notice_id, r]));
    await Promise.all(
      chosen.map(async (c) => {
        try {
          c.deep_dive_text = await deepDive(rowById.get(c.notice_id) || c, buyer);
        } catch {
          c.deep_dive_text = '';
        }
      }),
    );

    // Tokenized links (buyers never log in).
    const base = process.env.APP_BASE_URL || url.origin;
    const token = buyer.access_token;
    const links = {
      deepDive: (nid) => `${base}/d/${token}/${nid}`,
      targeting: `${base}/targeting/${token}`,
      allContracts: `${base}/contracts/${token}`,
    };
    const { subject, html } = buildBatchEmailHTML(buyer, chosen, links, { shortfall: stats.shortfall });

    // Persist deliveries with the never-repeat guard, then bump the batch.
    const batchMonth = (buyer.batches_sent || 0) + 1;
    const opportunityRows = chosen.map((c) => rowById.get(c.notice_id)).filter(Boolean);
    const items = chosen.map((c) => ({
      notice_id: c.notice_id,
      solicitation_num: rowById.get(c.notice_id)?.solicitation_num || null,
      why_line: c.why_line,
      deep_dive_text: c.deep_dive_text,
    }));
    const delivered = await persistBatch({ buyerId: buyer.id, batchMonth, opportunityRows, items });

    let batch = null;
    if (delivered.inserted.length > 0) batch = await incrementBatchesSent(buyer.id);

    // Optional real send.
    let sent = null;
    if (wantSend && delivered.inserted.length > 0) {
      if (!process.env.RESEND_API_KEY) sent = { skipped: 'RESEND_API_KEY not set' };
      else sent = await sendBatchEmail({ to: buyerEmail, subject, html });
    }

    return Response.json({
      ok: true,
      buyer: { id: buyer.id, email: buyer.email, batches_sent: buyer.batches_sent, access_token: token },
      curationStats: stats,
      chosen: chosen.map((c) => ({ notice_id: c.notice_id, title: c.title, why_line: c.why_line, deep_dive_chars: (c.deep_dive_text || '').length })),
      delivered,
      batch,
      emailSubject: subject,
      emailHtml: html,
      sent,
    });
  } catch (err) {
    return Response.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
