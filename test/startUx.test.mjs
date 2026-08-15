import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const source = readFileSync('app/_components/GoButton.jsx', 'utf8');

test('successful start flow redirects directly to contracts without a found-count flash', () => {
  assert.match(source, /window\.location\.href = `\/contracts\/\$\{token\}`/);
  assert.ok(!source.includes('We found ${n}'));
  assert.ok(!source.includes('contract opportunities for you. Taking you there now'));
  assert.ok(!source.includes('You are in.'));
});

test('no_matches UI has dedicated truthful copy and actions', () => {
  assert.ok(source.includes("data.outcome === 'no_matches'"));
  assert.ok(source.includes('No strong matches right now'));
  assert.ok(source.includes('Your targeting is saved and no batch has been used.'));
  assert.ok(source.includes('Review Targeting'));
  assert.ok(source.includes('Try Again'));
});

test('system failure UI is distinct from no-match copy', () => {
  assert.ok(source.includes("We couldn't complete the search right now"));
  assert.ok(source.includes('Please try again. Your targeting is saved and no batch has been used.'));
  assert.ok(!source.includes('We could not create your first contract batch'));
});
