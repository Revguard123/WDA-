// Unit tests for set-aside eligibility. Set-asides are a hierarchy: holding a
// specialized certification also makes you a small business (and, for two of
// them, a member of a broader program), so a holder must see more than their
// exact set-aside. These tests lock that hierarchy so a buyer is never shown
// only their narrow set-aside and wrongly denied the contracts above it.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buyerQualifiesForSetAside, expandHeldSetAsides } from '../lib/sam/setAsides.js';

// SAM codes used below: '' full-and-open, SBA small business, SDVOSBC sdvosb,
// VSA vosb, WOSB wosb, EDWOSB edwosb, 8A eight-a, HZC hubzone.

test('full-and-open contracts qualify for everyone, even a buyer with no certs', () => {
  assert.equal(buyerQualifiesForSetAside('', []), true);
  assert.equal(buyerQualifiesForSetAside(null, ['sdvosb']), true);
  assert.equal(buyerQualifiesForSetAside('   ', ['sb']), true);
});

test('a plain small business sees SB set-asides and open, but not specialized ones', () => {
  const held = ['sb'];
  assert.equal(buyerQualifiesForSetAside('SBA', held), true);
  assert.equal(buyerQualifiesForSetAside('SBP', held), true);
  assert.equal(buyerQualifiesForSetAside('', held), true);
  assert.equal(buyerQualifiesForSetAside('SDVOSBC', held), false);
  assert.equal(buyerQualifiesForSetAside('8A', held), false);
  assert.equal(buyerQualifiesForSetAside('WOSB', held), false);
});

test('SDVOSB holder also qualifies for VOSB, Small Business, and open', () => {
  const held = ['sdvosb'];
  assert.equal(buyerQualifiesForSetAside('SDVOSBC', held), true); // their own
  assert.equal(buyerQualifiesForSetAside('VSA', held), true); // vosb (parent)
  assert.equal(buyerQualifiesForSetAside('SBA', held), true); // small business
  assert.equal(buyerQualifiesForSetAside('', held), true); // open
  // but not unrelated specialized set-asides
  assert.equal(buyerQualifiesForSetAside('WOSB', held), false);
  assert.equal(buyerQualifiesForSetAside('8A', held), false);
  assert.equal(buyerQualifiesForSetAside('HZC', held), false);
});

test('EDWOSB holder also qualifies for WOSB, Small Business, and open', () => {
  const held = ['edwosb'];
  assert.equal(buyerQualifiesForSetAside('EDWOSB', held), true);
  assert.equal(buyerQualifiesForSetAside('WOSB', held), true); // parent program
  assert.equal(buyerQualifiesForSetAside('SBA', held), true);
  assert.equal(buyerQualifiesForSetAside('', held), true);
  assert.equal(buyerQualifiesForSetAside('SDVOSBC', held), false);
});

test('8(a) and HUBZone holders qualify for Small Business and open, not each other', () => {
  assert.equal(buyerQualifiesForSetAside('SBA', ['8a']), true);
  assert.equal(buyerQualifiesForSetAside('', ['8a']), true);
  assert.equal(buyerQualifiesForSetAside('HZC', ['8a']), false);
  assert.equal(buyerQualifiesForSetAside('SBA', ['hubzone']), true);
  assert.equal(buyerQualifiesForSetAside('8A', ['hubzone']), false);
});

test('a buyer with no set-asides sees only full-and-open', () => {
  assert.equal(buyerQualifiesForSetAside('', []), true);
  assert.equal(buyerQualifiesForSetAside('SBA', []), false);
  assert.equal(buyerQualifiesForSetAside('SDVOSBC', []), false);
});

test('unknown / unmatched restrictive set-aside codes are excluded', () => {
  assert.equal(buyerQualifiesForSetAside('SOME_UNKNOWN_CODE', ['sb', 'sdvosb']), false);
});

test('multiple held certs union their eligibility', () => {
  const held = ['wosb', 'hubzone'];
  assert.equal(buyerQualifiesForSetAside('WOSB', held), true);
  assert.equal(buyerQualifiesForSetAside('HZC', held), true);
  assert.equal(buyerQualifiesForSetAside('SBA', held), true);
  assert.equal(buyerQualifiesForSetAside('', held), true);
  assert.equal(buyerQualifiesForSetAside('SDVOSBC', held), false);
});

test('expandHeldSetAsides ignores unknown codes and adds implied statuses', () => {
  const expanded = expandHeldSetAsides(['sdvosb', 'bogus']);
  assert.equal(expanded.has('sdvosb'), true);
  assert.equal(expanded.has('vosb'), true);
  assert.equal(expanded.has('sb'), true);
  assert.equal(expanded.has('bogus'), false);
  assert.equal(expandHeldSetAsides([]).size, 0);
});
