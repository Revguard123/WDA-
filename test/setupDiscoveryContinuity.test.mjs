import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

import { discoveryTargetingReviewState } from '../lib/setupDiscoveryState.js';

test('Discovery selection produces Discovery-aware setup review state with authoritative NAICS titles', () => {
  const state = discoveryTargetingReviewState({
    buyer: { naics: ['561720'] },
    session: {
      selected_recommendation: {
        industry_name: 'Facilities & Support Services',
        subindustry_name: 'Janitorial & Cleaning Services',
        naics: [{ code: '561720', title: 'Janitorial Services' }],
      },
    },
  });

  assert.equal(state.source, 'discovery');
  assert.equal(state.subindustryName, 'Janitorial & Cleaning Services');
  assert.deepEqual(state.naics, [{ code: '561720', title: 'Janitorial Services' }]);
});

test('Discovery-aware setup falls back to official title lookup for selected buyer NAICS', () => {
  const state = discoveryTargetingReviewState({
    buyer: { naics: ['561720'] },
    session: {
      selected_recommendation: {
        industry_name: 'Facilities & Support Services',
        subindustry_name: 'Janitorial & Cleaning Services',
      },
    },
  });

  assert.deepEqual(state.naics, [{ code: '561720', title: 'Janitorial Services' }]);
});

test('plain direct targeting has no Discovery-aware review state', () => {
  assert.equal(discoveryTargetingReviewState({ buyer: { naics: ['561720'] }, session: null }), null);
  assert.equal(discoveryTargetingReviewState({ buyer: { naics: ['561720'] }, session: {} }), null);
});

test('setup page uses selected Discovery state and suppresses restart prompt for that branch', () => {
  const setupPage = readFileSync('app/setup/[token]/page.js', 'utf8');
  assert.ok(setupPage.includes('discoveryTargetingReviewState'));
  assert.ok(setupPage.includes('Review Your Targeting'));
  assert.ok(setupPage.includes('!discoveryReview && !state.hasTargeting'));
  assert.ok(setupPage.includes('Not sure what to go after? Discover your niche'));
  assert.ok(setupPage.includes('Back to Niche Discovery chat'));
  assert.ok(setupPage.includes('maxWidth={discoveryReview || state.hasTargeting ? 1120 : 660}'));
  assert.ok(setupPage.includes('reviewMode={state.hasTargeting}'));
});

test('targeting review form is a concise sectioned summary with edit reveals', () => {
  const form = readFileSync('app/_components/NicheForm.jsx', 'utf8');
  assert.ok(form.includes('reviewMode'));
  assert.ok(form.includes('Industries / NAICS'));
  assert.ok(form.includes('Capabilities / Keywords'));
  assert.ok(form.includes('Service Area'));
  assert.ok(form.includes('Set-Asides'));
  assert.ok(form.includes('Contract Size'));
  assert.ok(form.includes('editSections'));
  assert.ok(form.includes('targeting-review-grid'));
  assert.ok(form.includes('grid-template-columns:1fr 1.25fr 1fr'));
  assert.ok(form.includes('Nationwide keeps stale state filters out of this search.'));
});

test('Direct Targeting build path keeps the generic NAICS/manual builder controls', () => {
  const form = readFileSync('app/_components/NicheForm.jsx', 'utf8');
  assert.ok(form.includes('!reviewMode ?'));
  assert.ok(form.includes('What kind of work do you do?'));
  assert.ok(form.includes('Already know your NAICS code? Add it directly'));
  assert.ok(form.includes('Two or three is the sweet spot.'));
});

test('Discovery review defaults to persisted profile summary instead of beginner prompts', () => {
  const form = readFileSync('app/_components/NicheForm.jsx', 'utf8');
  assert.ok(form.includes('Pulled from your Discovery capabilities and positive interests.'));
  assert.ok(form.includes('Authoritative NAICS resolved from your selected Discovery niche.'));
  assert.ok(!form.includes('Use Claude to create targeting'));
  assert.ok(!form.includes('legacy discoverNiches'));
});

test('setup resumes partial Discovery sessions instead of returning to the path chooser', () => {
  const setupPage = readFileSync('app/setup/[token]/page.js', 'utf8');
  assert.ok(setupPage.includes('session.current_step > 1'));
  assert.ok(setupPage.includes("session.status !== 'in_progress'"));
  assert.ok(setupPage.includes("const discoveryHref = `/discover/${token}${state.updateMode || buyer.status !== 'exploring' ? '?update=1' : ''}`"));
  assert.ok(setupPage.includes('redirect(discoveryHref)'));
});

test('setup review-only mode returns to contracts without editing', () => {
  const setupPage = readFileSync('app/setup/[token]/page.js', 'utf8');
  const form = readFileSync('app/_components/NicheForm.jsx', 'utf8');
  assert.ok(setupPage.includes("sp.review === '1'"));
  assert.ok(setupPage.includes('readOnly={state.reviewOnly}'));
  assert.ok(setupPage.includes('Back to Contracts'));
  assert.ok(setupPage.includes('href={discoveryHref}'));
  assert.ok(form.includes('if (readOnly)'));
  assert.ok(form.includes('!readOnly'));
});

test('setup update mode saves future targeting without entering activation', () => {
  const setupPage = readFileSync('app/setup/[token]/page.js', 'utf8');
  assert.ok(setupPage.includes("sp.update === '1'"));
  assert.ok(setupPage.includes('updateMode'));
  assert.ok(setupPage.includes('Save for Future Batches'));
  assert.ok(setupPage.includes('state.reviewOnly || state.updateMode ? `/contracts/${token}` : `/start/${token}`'));
  assert.ok(setupPage.includes('Saving here updates the targeting profile for future batches only'));
});

test('Discovery update mode returns selected niche to editable setup update flow', () => {
  const discoverPage = readFileSync('app/discover/[token]/page.js', 'utf8');
  const form = readFileSync('app/_components/DiscoveryForm.jsx', 'utf8');
  assert.ok(discoverPage.includes("sp.update === '1'"));
  assert.ok(discoverPage.includes('updateMode={state.updateMode}'));
  assert.ok(form.includes("window.location.href = `/setup/${token}${updateMode ? '?update=1' : ''}`"));
  assert.ok(form.includes("`/setup/${token}${updateMode ? '?update=1' : '?targeting=1'}`"));
});

test('start page is the explicit Ready to Start gate with compact targeting summary', () => {
  const startPage = readFileSync('app/start/[token]/page.js', 'utf8');
  assert.ok(startPage.includes('Ready to Start'));
  assert.ok(startPage.includes('Selected War Dogs niche'));
  assert.ok(startPage.includes('Industries / NAICS'));
  assert.ok(startPage.includes('Capabilities / Keywords'));
  assert.ok(startPage.includes('Service Area'));
  assert.ok(startPage.includes('Set-Asides'));
  assert.ok(startPage.includes('Contract Size'));
  assert.ok(startPage.includes('GoButton'));
});

test('Discovery recommendation CTA says Use this niche and does not imply activation', () => {
  const form = readFileSync('app/_components/DiscoveryForm.jsx', 'utf8');
  assert.ok(form.includes('Use this niche'));
  assert.ok(!form.includes('Use this for my contracts'));
});

test('Discovery selection route does not activate buyers or create deliveries', () => {
  const route = readFileSync('app/api/discover/[token]/select/route.js', 'utf8');
  assert.ok(route.includes('updateBuyerProfile'));
  assert.ok(!route.includes('activateBuyer'));
  assert.ok(!route.includes('persistBatch'));
  assert.ok(!route.includes('incrementBatchesSent'));
  assert.ok(!route.includes('deliveries'));
});

test('Discovery uses a responsible starting lane instead of an insufficient-information dead end', () => {
  const form = readFileSync('app/_components/DiscoveryForm.jsx', 'utf8');
  assert.ok(form.includes('I narrowed this to the strongest starting lanes for you.'));
  assert.ok(!form.includes('We could not find a strong enough niche match'));
});
