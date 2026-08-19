import { test } from 'node:test';
import assert from 'node:assert/strict';

import { deepDive, discoverNiches, disqualifyContract, whyLine } from '../lib/ai/claude.js';

function fakeClient(responseText, calls = []) {
  return {
    messages: {
      create: async (args) => {
        calls.push(args);
        return { content: [{ type: 'text', text: responseText }] };
      },
    },
  };
}

const buyer = {
  naics: ['236220'],
  keywords: ['commercial construction'],
  set_asides: ['sb'],
  state: 'VA',
};

const opportunity = {
  title: 'Building repair',
  agency: 'Navy',
  naics: '236220',
  set_aside_type: 'Small Business',
  place_of_perf: 'VA',
  description: 'Repair a small administrative building.',
};

test('whyLine prompt forbids unsupported expertise, experience, and past-performance claims', async () => {
  const calls = [];
  await whyLine(opportunity, buyer, { client: fakeClient('{"why_line":"ok"}', calls) });
  const prompt = `${calls[0].system}\n${calls[0].messages[0].content}`;
  assert.match(prompt, /Do not describe selected NAICS codes, keywords,\s*or service areas as the buyer expertise, experience, past performance/i);
  assert.match(prompt, /proven capability, staff,\s*equipment, or qualifications/i);
  assert.match(prompt, /Use conditional language\s*for requirements such as bonding, licenses, or past performance/i);
  assert.match(prompt, /STRUCTURED CORE PREMISE ASSESSMENT/i);
  assert.match(prompt, /Use at least one supplied Core Premise rubric signal/i);
});

test('whyLine prompt encourages phrasing based on selected targeting data', async () => {
  const calls = [];
  await whyLine(opportunity, buyer, { client: fakeClient('{"why_line":"ok"}', calls) });
  const prompt = calls[0].system;
  assert.match(prompt, /the NAICS code you chose to target/i);
  assert.match(prompt, /the set-aside selected in your profile/i);
  assert.match(prompt, /your Virginia service area/i);
});

test('deepDive prompt keeps human-review and hand-selection claims prohibited', async () => {
  const calls = [];
  await deepDive(opportunity, buyer, { client: fakeClient('{"deep_dive":"ok"}', calls) });
  const prompt = calls[0].system;
  assert.match(prompt, /Do not claim human review/i);
  assert.match(prompt, /human team personally selected/i);
  assert.match(prompt, /Do not say "aligns perfectly."/i);
  assert.match(prompt, /War Dogs decision brief/i);
  assert.match(prompt, /What you need to verify/i);
});

test('discoverNiches prompt applies the same grounding rule to niche discovery', async () => {
  const calls = [];
  await discoverNiches({ background: 'Interested in construction', state: 'VA' }, {
    client: fakeClient('{"recommendations":[]}', calls),
  });
  const prompt = calls[0].system;
  assert.match(prompt, /Do not guarantee that an entire niche is winnable/i);
  assert.match(prompt, /Do not treat a selected interest, NAICS code, location, or set-aside as proof of expertise/i);
});

test('disqualification prompt does not treat unknown certifications as automatic rejection', async () => {
  const calls = [];
  const result = await disqualifyContract(
    { ...opportunity, description: 'Contractor must verify BICSI certification before award.' },
    buyer,
    { client: fakeClient('{"decision":"needs_validation","disqualified":false,"reason_category":"certification_license","reason":"BICSI certification should be verified before bid."}', calls) },
  );
  const prompt = `${calls[0].system}\n${calls[0].messages[0].content}`;
  assert.match(prompt, /absence of evidence is not evidence of absence/i);
  assert.match(prompt, /choose needs_validation rather than disqualified/i);
  assert.equal(result.decision, 'needs_validation');
  assert.equal(result.disqualified, false);
  assert.equal(result.reason_category, 'certification_license');
});

test('disqualification prompt treats NAICS and keywords as targeting, not qualification proof', async () => {
  const calls = [];
  await disqualifyContract(opportunity, buyer, {
    client: fakeClient('{"decision":"eligible","disqualified":false,"reason_category":"other","reason":"Scope matches targeting."}', calls),
  });
  const prompt = calls[0].system;
  assert.match(prompt, /NAICS, keywords, set-asides, and service area are targeting inputs/i);
  assert.match(prompt, /not proof of licenses, bonding, clearance, certifications, staff, equipment, or past performance/i);
});
