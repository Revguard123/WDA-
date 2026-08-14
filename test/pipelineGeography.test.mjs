import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('auto-widen does not drop an explicit buyer state constraint', () => {
  const source = readFileSync('lib/pipeline.js', 'utf8');
  assert.ok(source.includes("{ label: 'runway', niche: buyer"));
  assert.ok(!source.includes("state: null"));
  assert.ok(!source.includes("'nationwide'"));
});
