import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

// Cross-page wiring checks land with the final dependent UI batch. The shared
// CSS/controls keep their independent coverage in glass/theme/scrollbar tests.
test('workspace and reader chrome expose slots for the single global theme control', () => {
  for (const file of ['app/_components/SetupWorkspace.jsx','app/_components/AssetViewer.jsx']) {
    assert.match(source(file), /data-theme-slot=/);
  }
});

test('Discovery recommendations apply shared glass and preserve their disabled/loading action states', () => {
  const discovery = source('app/_components/DiscoveryForm.jsx');
  assert.match(discovery, /<article data-liquid="" className="wda-rec-card"/);
  assert.match(discovery, /disabled=\{applying !== -1\}/);
  assert.match(discovery, /loading=\{applying === index\}/);
  assert.match(discovery, /onClick=\{\(\) => useThis\(rec, index\)\}/);
});

test('targeting panels preserve their page padding when applying the shared surface', () => {
  assert.match(source('app/targeting/[token]/page.js'), /className="targeting-page-panel" style=\{\{ padding: 28 \}\}/);
});

test('Discovery bubbles consume the shared surface token', () => {
  assert.match(source('app/_components/DiscoveryForm.jsx'), /background: var\(--theme-soft-surface,#F0ECE7\)/);
});

test('Discovery renders accessible numbered corner badges instead of option labels', () => {
  const discovery = source('app/_components/DiscoveryForm.jsx');
  assert.match(discovery, /className="wda-rec-number" aria-label=\{`Recommendation \$\{index \+ 1\}`\}>#\{index \+ 1\}<\/span>/);
  assert.doesNotMatch(discovery, /OPTION \{String\(index \+ 1\)/);
});

test('reader document preserves accordion semantics without a card-wide liquid effect', () => {
  const article = source('app/d/[token]/[notice_id]/page.js').match(/<article className="ctc-breakdown-document"[\s\S]*?<\/article>/)[0];
  assert.match(article, /ctc-decision-intro/);
  assert.match(article, /ctc-brief-section/);
  assert.match(article, /ctc-breakdown-footer/);
  assert.doesNotMatch(article, /data-liquid/);
  assert.match(article, /open=\{index === initiallyOpenIndex\}/, 'The default-open behavior is unchanged');
});

test('Discovery preserves horizontal native scrolling without page-local scrollbar overrides', () => {
  const discovery = source('app/_components/DiscoveryForm.jsx');
  assert.doesNotMatch(discovery, /scrollbar-width:\s*(thin|none)/);
  assert.doesNotMatch(discovery, /::-webkit-scrollbar/);
  assert.doesNotMatch(discovery, /-ms-overflow-style:\s*none/);
  assert.match(discovery, /overflow-x: auto/);
  assert.match(discovery, /scroll-snap-type: x mandatory/);
});

test('the redesigned setup chooser retains the Discovery entry point', () => {
  assert.match(source('app/setup/[token]/page.js'), /SetupChoice/);
  assert.match(source('app/_components/SetupWorkspace.jsx'), /Help me discover my niche/);
});
