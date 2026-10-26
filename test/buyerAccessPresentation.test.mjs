import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// End-to-end presentation integration belongs with the redesigned pages, not
// the independent cookie/session transport foundation.
test('buyer page client props use the public profile whitelist, never the complete buyer record', () => {
  for (const path of ['app/setup/[token]/page.js', 'app/discover/[token]/page.js', 'app/targeting/[token]/page.js']) {
    const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
    assert.match(source, /publicBuyerProfile\(/);
    assert.doesNotMatch(source, /initial=\{buyer\}/);
  }
});
