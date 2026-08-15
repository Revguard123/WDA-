import test from 'node:test';
import assert from 'node:assert/strict';

import {
  dedupeOpportunitiesByProcurement,
  normalizeSolicitationNum,
  procurementIdentity,
} from '../lib/procurementIdentity.js';

test('procurement identity prefers normalized solicitation number', () => {
  assert.equal(normalizeSolicitationNum(' fa4626-26-r-0012 '), 'FA4626-26-R-0012');
  assert.equal(procurementIdentity({ notice_id: 'N1', solicitation_num: ' fa4626-26-r-0012 ' }), 'solicitation:FA4626-26-R-0012');
});

test('empty solicitation number falls back to notice id', () => {
  assert.equal(procurementIdentity({ notice_id: 'N1', solicitation_num: '   ' }), 'notice:N1');
  assert.equal(procurementIdentity({ notice_id: 'N2', solicitation_num: null }), 'notice:N2');
});

test('same solicitation number with different notice ids collapses to one current candidate', () => {
  const rows = [
    { notice_id: 'OLD', solicitation_num: 'S-1', raw: { modifiedDate: '2026-08-01T00:00:00Z' }, response_deadline: '2026-08-20T00:00:00Z' },
    { notice_id: 'NEW', solicitation_num: ' s-1 ', raw: { modifiedDate: '2026-08-03T00:00:00Z' }, response_deadline: '2026-08-18T00:00:00Z' },
  ];
  const { rows: out, stats } = dedupeOpportunitiesByProcurement(rows);
  assert.equal(out.length, 1);
  assert.equal(out[0].notice_id, 'NEW');
  assert.equal(stats.removed, 1);
  assert.equal(stats.duplicateGroups[0].recency_field, 'raw.modified/update/posted timestamp');
});

test('fetched_at then response_deadline are deterministic fallback version selectors', () => {
  const fetched = dedupeOpportunitiesByProcurement([
    { notice_id: 'A', solicitation_num: 'S-2', fetched_at: '2026-08-01T00:00:00Z', response_deadline: '2026-09-01T00:00:00Z' },
    { notice_id: 'B', solicitation_num: 'S-2', fetched_at: '2026-08-04T00:00:00Z', response_deadline: '2026-08-20T00:00:00Z' },
  ]);
  assert.equal(fetched.rows[0].notice_id, 'B');
  assert.equal(fetched.stats.duplicateGroups[0].recency_field, 'fetched_at');

  const deadline = dedupeOpportunitiesByProcurement([
    { notice_id: 'C', solicitation_num: 'S-3', response_deadline: '2026-08-20T00:00:00Z' },
    { notice_id: 'D', solicitation_num: 'S-3', response_deadline: '2026-08-25T00:00:00Z' },
  ]);
  assert.equal(deadline.rows[0].notice_id, 'D');
  assert.equal(deadline.stats.duplicateGroups[0].recency_field, 'response_deadline');
});

test('different solicitation numbers are not merged just because titles match', () => {
  const { rows } = dedupeOpportunitiesByProcurement([
    { notice_id: 'A', solicitation_num: 'S-1', title: 'Same Title' },
    { notice_id: 'B', solicitation_num: 'S-2', title: 'Same Title' },
  ]);
  assert.deepEqual(rows.map((r) => r.notice_id), ['A', 'B']);
});
