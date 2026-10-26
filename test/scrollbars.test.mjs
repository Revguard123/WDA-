import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const css = require('postcss').parse(read('app/scrollbars.css'));
function properties(selector, parent) {
  const values = {};
  css.walkRules((rule) => {
    if (!rule.selectors.includes(selector)) return;
    if (parent ? rule.parent.params !== parent : rule.parent.type !== 'root') return;
    rule.nodes.filter((node) => node.type === 'decl').forEach((node) => { values[node.prop] = node.value; });
  });
  return values;
}

test('scrollbar styling is globally slim in both axes without hiding scroll controls', () => {
  assert.equal(properties(':root')['--scrollbar-size'], '5px');
  for (const selector of [':root', ':root *']) {
    assert.equal(properties(selector)['scrollbar-width'], 'thin');
    assert.equal(properties(selector, 'selector(::-webkit-scrollbar)')['scrollbar-width'], 'auto', 'Standard thin sizing must not override the explicit 5px dimensions');
    assert.equal(properties(selector)['scrollbar-color'], 'var(--scrollbar-thumb) var(--scrollbar-track)');
    assert.equal(properties(selector, 'selector(::-webkit-scrollbar)')['scrollbar-color'], 'auto', 'Standard non-auto colors must not disable WebKit dimensions and gradients');
  }
  for (const prefix of [':root', ':root *']) {
    const scrollbar = properties(`${prefix}::-webkit-scrollbar`, 'selector(::-webkit-scrollbar)');
    assert.equal(scrollbar.width, 'var(--scrollbar-size)');
    assert.equal(scrollbar.height, 'var(--scrollbar-size)');
    assert.equal(scrollbar.display, 'block');
    const thumb = properties(`${prefix}::-webkit-scrollbar-thumb`, 'selector(::-webkit-scrollbar)');
    assert.equal(thumb['border-radius'], '999px');
    assert.equal(thumb.border, '0');
    assert.equal(thumb.outline, '0');
    assert.equal(thumb['box-shadow'], 'none');
    assert.match(thumb['background-image'], /linear-gradient.*--scrollbar-thumb.*--scrollbar-thumb-end/);
    assert.equal(properties(`${prefix}::-webkit-scrollbar-thumb:vertical`, 'selector(::-webkit-scrollbar)')['min-height'], '44px');
    assert.equal(properties(`${prefix}::-webkit-scrollbar-thumb:horizontal`, 'selector(::-webkit-scrollbar)')['min-width'], '44px');
    assert.equal(properties(`${prefix}::-webkit-scrollbar-thumb:horizontal`, 'selector(::-webkit-scrollbar)')['--scrollbar-angle'], '90deg');
    assert.match(properties(`${prefix}::-webkit-scrollbar-thumb:hover`, 'selector(::-webkit-scrollbar)')['background-image'], /--scrollbar-hover/);
    assert.equal(properties(`${prefix}::-webkit-scrollbar-thumb:active`, 'selector(::-webkit-scrollbar)')['background-color'], 'var(--scrollbar-active)');
    assert.equal(properties(`${prefix}::-webkit-scrollbar-button`, 'selector(::-webkit-scrollbar)').display, 'none');
  }
});

function luminance(hex) {
  return hex.slice(1).match(/../g).map((channel) => {
    const value = parseInt(channel, 16) / 255;
    return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
  }).reduce((sum, value, index) => sum + value * [.2126,.7152,.0722][index], 0);
}
test('fallback thumb and active state retain track contrast while borderless gradients preserve brand colors', () => {
  for (const selector of [':root', ':root[data-theme="dark"]']) {
    const palette = { ...properties(':root'), ...properties(selector) };
    for (const key of ['--scrollbar-thumb','--scrollbar-active']) {
      const values = [luminance(palette[key]), luminance(palette['--scrollbar-track'])].sort((a,b) => b - a);
      assert.ok((values[0] + .05) / (values[1] + .05) >= 3, `${selector}: ${key} needs 3:1 track contrast`);
    }
  }
  assert.equal(properties(':root')['--scrollbar-thumb'], '#F52EA9');
  assert.equal(properties(':root')['--scrollbar-thumb-end'], '#FF9F58');
  assert.equal(properties(':root[data-theme="dark"]')['--scrollbar-thumb'], '#FF78C7');
  assert.equal(properties(':root[data-theme="dark"]')['--scrollbar-thumb-end'], '#FFB477');
});

test('native scrolling and high-contrast controls remain intact without animations or JavaScript', () => {
  css.walkDecls((decl) => {
    assert.ok(!['overflow','overflow-x','overflow-y','scroll-behavior','touch-action','pointer-events','animation','transition'].includes(decl.prop), decl.prop);
    if (decl.prop === 'scrollbar-width') assert.ok(['auto','thin'].includes(decl.value));
  });
  css.walkRules((rule) => {
    if (!rule.selector.includes('::-webkit')) return;
    assert.equal(rule.parent.name, 'supports');
    assert.equal(rule.parent.parent.params, 'not (forced-colors: active)', 'Custom controls must not override system high contrast or require forced-colors support');
  });
  assert.equal(properties(':root', '(forced-colors: active)')['scrollbar-color'], 'auto');
  assert.equal(properties(':root *', '(forced-colors: active)')['scrollbar-width'], 'auto');
});

test('root imports one shared scrollbar stylesheet and old per-page thin/hidden rules cannot override it', () => {
  const layout = read('app/layout.js');
  assert.equal((layout.match(/import '\.\/scrollbars\.css'/g) || []).length, 1);
  assert.ok(layout.indexOf("import './scrollbars.css'") > layout.indexOf("import './theme.css'"));
  for (const file of ['app/layout.js','app/theme.css','app/contract-flow.css']) {
    const source = read(file);
    assert.doesNotMatch(source, /scrollbar-width:\s*(thin|none)/, file);
    assert.doesNotMatch(source, /::-webkit-scrollbar/, file);
    assert.doesNotMatch(source, /-ms-overflow-style:\s*none/, file);
  }
});
