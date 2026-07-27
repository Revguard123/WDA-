// Slice 1 proof harness. Runs the SAM engine for the sample niche and prints
// the titles, deadlines and SAM URLs that come back. This is the proof point
// for the whole product.
//
//   Mock (no keys, deterministic fixture):
//     node scripts/prove-slice1.mjs --mock
//
//   Live (real SAM.gov, needs SAM_API_KEY in the environment):
//     SAM_API_KEY=xxxx node scripts/prove-slice1.mjs
//     SAM_API_KEY=xxxx node scripts/prove-slice1.mjs --naics 236220 --state NC --set-aside 8a
//
// Live runs do not touch Supabase (no upsert wired here) so the proof stays
// read-only; the /api/engine/sync route is the persisting surface.

import { runEngineForNiche } from '../lib/sam/engine.js';
import { makeMockSamFetch, FIXED_NOW } from '../test/fixtures/sam561720.mjs';

function parseArgs(argv) {
  const args = { mock: false, naics: '561720', state: 'SC', setAside: 'sdvosb' };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--mock') args.mock = true;
    else if (a === '--naics') args.naics = argv[++i];
    else if (a === '--state') args.state = argv[++i];
    else if (a === '--set-aside') args.setAside = argv[++i];
  }
  return args;
}

function fmtDeadline(iso) {
  if (!iso) return 'no deadline';
  return new Date(iso).toISOString().slice(0, 10);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const niche = {
    naics: [args.naics],
    set_asides: args.setAside ? [args.setAside] : [],
    state: args.state || null,
  };

  const options = { minRunwayDays: 14 };
  if (args.mock) {
    options.fetchImpl = makeMockSamFetch();
    options.apiKey = 'mock-key';
    options.now = FIXED_NOW;
  } else {
    options.apiKey = process.env.SAM_API_KEY;
    if (!options.apiKey) {
      console.error('SAM_API_KEY is not set. Run with --mock, or export SAM_API_KEY for a live pull.');
      process.exit(1);
    }
  }

  console.log(`\nCurated Target Contracts . Slice 1 engine proof ${args.mock ? '(MOCK)' : '(LIVE SAM.gov)'}`);
  console.log(`Niche: NAICS ${niche.naics.join(', ')} | set-aside ${niche.set_asides.join(', ') || 'none'} | state ${niche.state || 'any'}\n`);

  const { rows, stats, window } = await runEngineForNiche(niche, options);

  console.log(`Search window: ${window.postedFrom} to ${window.postedTo}`);
  console.log(
    `Pulled ${stats.rawPulled} | deduped ${stats.afterDedupe} | ` +
      `dropped(closed ${stats.droppedClosed}, tight ${stats.droppedTightRunway}, ` +
      `set-aside ${stats.droppedSetAside}, geo ${stats.droppedGeography}) | kept ${stats.kept}\n`,
  );

  if (rows.length === 0) {
    console.log('No pursuable contracts matched this niche in the window.');
    return;
  }

  rows.forEach((r, i) => {
    console.log(`${String(i + 1).padStart(2, ' ')}. ${r.title}`);
    console.log(`    agency:    ${r.agency || 'n/a'}`);
    console.log(`    set-aside: ${r.set_aside_type || 'full & open'}`);
    console.log(`    deadline:  ${fmtDeadline(r.response_deadline)}`);
    console.log(`    SAM URL:   ${r.sam_url || 'n/a'}\n`);
  });
}

main().catch((err) => {
  console.error('Proof harness failed:', err);
  process.exit(1);
});
