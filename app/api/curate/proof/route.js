// Read-only Slice 2 live proof. Pulls live SAM.gov opportunities for a niche,
// runs the full curation pipeline (hard filters, Claude disqualification,
// ranking, why-lines), and returns the curated top five as JSON. Writes nothing.
//
// GET /api/curate/proof?secret=<CRON_SECRET>&naics=561720&state=SC&setAside=sdvosb
//     &keywords=janitorial,custodial,cleaning,day%20porter,facility%20maintenance
//
// Needs SAM_API_KEY (pull) and ANTHROPIC_API_KEY (disqualification + why-line).

import { runEngineForNiche } from '../../../../lib/sam/engine.js';
import { curateForBuyer } from '../../../../lib/match/curate.js';
import { disqualifyContract, whyLine } from '../../../../lib/ai/claude.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

function authorized(req, url) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get('authorization') || '';
  if (header === `Bearer ${secret}`) return true;
  return url.searchParams.get('secret') === secret;
}

const DEFAULT_KEYWORDS = ['janitorial', 'custodial', 'cleaning', 'day porter', 'facility maintenance'];

export async function GET(req) {
  const url = new URL(req.url);
  if (!authorized(req, url)) return Response.json({ error: 'unauthorized' }, { status: 401 });
  if (!process.env.SAM_API_KEY) return Response.json({ error: 'SAM_API_KEY not set' }, { status: 500 });
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });

  const setAside = url.searchParams.get('setAside');
  const keywordsParam = url.searchParams.get('keywords');
  const minRunwayDays = Number(url.searchParams.get('minRunwayDays')) || 14;

  const buyer = {
    naics: [url.searchParams.get('naics') || '561720'],
    state: url.searchParams.get('state') || 'SC',
    set_asides: setAside ? [setAside] : ['sdvosb'],
    keywords: keywordsParam ? keywordsParam.split(',').map((s) => s.trim()).filter(Boolean) : DEFAULT_KEYWORDS,
  };

  try {
    // Pull live candidates with description text for the AI to read.
    const { rows, stats: engineStats } = await runEngineForNiche(buyer, {
      apiKey: process.env.SAM_API_KEY,
      minRunwayDays,
      resolveDescriptions: true,
    });

    const { chosen, stats, verdicts } = await curateForBuyer(
      rows,
      buyer,
      { disqualify: disqualifyContract, writeWhyLine: whyLine },
      { minRunwayDays, n: 5, maxCandidates: 12 },
    );

    const withDescription = rows.filter((r) => (r.description || '').length > 80).length;

    return Response.json({
      ok: true,
      buyer,
      engineStats,
      descriptionsResolved: `${withDescription}/${rows.length} rows have >80 chars of description text`,
      curationStats: stats,
      sampleVerdicts: (verdicts || []).slice(0, 12),
      top: chosen,
    });
  } catch (err) {
    return Response.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
