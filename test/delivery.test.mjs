// Unit tests for Slice 3 email rendering and the never-repeat partition helper.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildBatchEmailHTML } from '../lib/email/renderBatchEmail.js';
import { partitionRepeats } from '../lib/deliveries.js';

const LINKS = {
  deepDive: (nid) => `https://app.example.com/d/tok/${nid}`,
  targeting: 'https://app.example.com/targeting/tok',
  allContracts: 'https://app.example.com/contracts/tok',
};

const CONTRACTS = [
  {
    notice_id: 'N1',
    title: 'Secure Room and Restroom Addition',
    agency: 'Navy / NAVFAC',
    naics: '236220',
    set_aside_type: 'SBA',
    response_deadline: '2026-08-21T18:00:00.000Z',
    est_value: null,
    sam_url: 'https://sam.gov/opp/N1/view',
    why_line: 'This SBA set-aside construction job aligns with the buyer building-alteration expertise.',
  },
];

test('email renders brand, cards, why-line, and tokenized links', () => {
  const { subject, html } = buildBatchEmailHTML({ name: 'Jane Doe' }, CONTRACTS, LINKS, { shortfall: 4 });
  assert.match(subject, /The Target Brief/);
  assert.match(html, /War Dogs Academy/);
  assert.match(html, /Secure Room and Restroom Addition/);
  assert.match(html, /Why we picked this/);
  assert.match(html, /https:\/\/app\.example\.com\/d\/tok\/N1/);
  assert.match(html, /https:\/\/app\.example\.com\/targeting\/tok/);
  assert.match(html, /https:\/\/app\.example\.com\/contracts\/tok/);
  assert.match(html, /Jane/); // greeting uses first name
  assert.ok(!html.includes('—'), 'no long dash in email');
});

test('empty batch renders the no-padding message, not fake cards', () => {
  const { html } = buildBatchEmailHTML({ name: 'Jane' }, [], LINKS, { shortfall: 5 });
  assert.match(html, /rather send you nothing than send you a dud/);
  assert.ok(!html.includes('Dive Deeper'));
});

test('html-escapes contract fields', () => {
  const { html } = buildBatchEmailHTML({}, [{ notice_id: 'X', title: 'A <script> & "B"', agency: 'Dept', naics: '1', set_aside_type: '', response_deadline: null, sam_url: '#', why_line: '' }], LINKS, {});
  assert.ok(!html.includes('<script>'));
  assert.match(html, /&lt;script&gt;/);
});

test('partitionRepeats splits by notice_id and solicitation_num', () => {
  const items = [
    { notice_id: 'A', solicitation_num: 'S1' },
    { notice_id: 'B', solicitation_num: 'S2' },
    { notice_id: 'C', solicitation_num: 'S3' },
  ];
  const delivered = { noticeIds: new Set(['B']), solicitations: new Set(['S3']) };
  const { fresh, repeats } = partitionRepeats(items, delivered);
  assert.deepEqual(fresh.map((i) => i.notice_id), ['A']);
  assert.deepEqual(repeats.map((i) => i.notice_id).sort(), ['B', 'C']); // B by notice, C by solicitation
});
