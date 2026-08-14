import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

test('Discovery recommendation buttons expose an accessible loading state', () => {
  const source = readFileSync('app/_components/DiscoveryForm.jsx', 'utf8');
  assert.ok(source.includes('function LoadingLabel'));
  assert.ok(source.includes("setStatus('thinking');"));
  assert.ok(source.includes("setMessage(adaptiveQuestions.length > 0 ? 'Finalizing recommendations...' : 'Saving and preparing recommendations...');"));
  assert.ok(source.includes("aria-busy={status === 'thinking'}"));
  assert.ok(source.includes('Saving and preparing recommendations...'));
  assert.ok(source.includes('Finalizing recommendations...'));
  assert.ok(source.includes("cursor: busy ? 'wait' : 'pointer'"));
});
