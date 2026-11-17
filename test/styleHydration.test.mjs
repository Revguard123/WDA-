import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as ui from '../lib/ui.js';
import * as buyerUrls from '../lib/buyerUrls.js';
import * as ambientMotion from '../lib/ambientMotion.js';

const require = createRequire(import.meta.url);
const swc = await require('next/dist/build/swc').loadBindings();
const runtime = require('react/jsx-runtime');
let expectedStyles = [];
const capturingRuntime = Object.fromEntries(Object.entries(runtime).map(([name, value]) => [name,
  ['jsx', 'jsxs'].includes(name) ? (type, props, ...rest) => {
    if (type === 'style') expectedStyles.push(props.dangerouslySetInnerHTML?.__html ?? props.children);
    return value(type, props, ...rest);
  } : value,
]));

async function load(filename, imports = {}) {
  const { code } = await swc.transform(readFileSync(new URL(`../${filename}`, import.meta.url), 'utf8'), {
    filename, jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } }, target: 'es2020' },
    module: { type: 'commonjs' },
  });
  const module = { exports: {} };
  const bindings = {
    'react/jsx-runtime': capturingRuntime,
    '../../lib/ui.js': ui,
    '../../lib/buyerUrls.js': buyerUrls,
    '../../lib/ambientMotion.js': ambientMotion,
    ...imports,
  };
  new Function('require', 'module', 'exports', code)((id) => bindings[id] || require(id), module, module.exports);
  return module.exports.default;
}
const asDefault = (value) => ({ __esModule: true, default: value });
const Button = await load('app/_components/Button.jsx');
const Shell = await load('app/_components/Shell.jsx', { './RecoveryScreen.jsx': asDefault(() => null) });
const closedModal = asDefault(() => null);
const Discovery = await load('app/_components/DiscoveryForm.jsx', { './Button.jsx': asDefault(Button), './Modal.jsx': closedModal });
const Support = await load('app/_components/SupportCTA.jsx', {
  './Button.jsx': asDefault(Button), './Modal.jsx': closedModal,
  './Select.jsx': asDefault(() => null), './CTCIcon.jsx': asDefault(() => null),
});

function renderWithIdenticalStyles(Component, props) {
  expectedStyles = [];
  const html = renderToStaticMarkup(React.createElement(Component, props));
  const actual = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map((match) => match[1]);
  assert.ok(expectedStyles.length > 0, 'Exercise a real inline stylesheet');
  // Style elements are raw-text HTML: their character references are NOT
  // decoded by the browser. Compare exact bytes; never normalize entities.
  assert.deepEqual([...actual].sort(), [...expectedStyles].sort(), 'Server CSS must equal the text React expects during hydration');
  return html;
}

test('Shell preserves quoted font families as identical server/client style text', () => {
  const html = renderWithIdenticalStyles(Shell, { subtitle: 'A & B', children: 'Content' });
  assert.match(html, /font-family:[^}]*'Segoe UI'/);
  const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
  assert.doesNotMatch(css, /&#x27;Segoe UI&#x27;/);
});

test('shared Button preserves CSS font families and quoted attribute selectors', () => {
  const html = renderWithIdenticalStyles(Button, { children: 'Continue' });
  assert.match(html, /\[aria-disabled="true"\]/);
});

test('Discovery preserves its style text, including display fonts and pseudo-element content', () => {
  renderWithIdenticalStyles(Discovery, { token: 'fixture', embedded: true });
});

test('sticky support styles use the same serialization as the other shared surfaces', () => {
  renderWithIdenticalStyles(Support, { pageContext: 'portal', sticky: true });
});

test('user content stays escaped and cannot become inline stylesheet markup', () => {
  const payload = '</style><script>alert("unsafe")</script>';
  const html = renderToStaticMarkup(React.createElement(Button, { children: payload }));
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;\/style&gt;&lt;script&gt;/);
});
