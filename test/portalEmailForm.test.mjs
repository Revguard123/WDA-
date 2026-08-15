import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

test('portal email gate works as a native GET form when client JS is not ready', () => {
  const form = readFileSync('app/_components/PortalEmailForm.jsx', 'utf8');
  assert.ok(form.includes('action="/portal"'));
  assert.ok(form.includes('method="GET"'));
  assert.ok(form.includes('name="email"'));
  assert.ok(form.includes('window.location.href = `/portal?email='));
});
