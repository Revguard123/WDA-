import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as ui from '../lib/ui.js';
import * as buyerUrls from '../lib/buyerUrls.js';

const require = createRequire(import.meta.url);
const swc = await require('next/dist/build/swc').loadBindings();
async function load(filename, imports = {}, globals = {}) {
  const { code } = await swc.transform(readFileSync(new URL(`../${filename}`, import.meta.url), 'utf8'), {
    filename, jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } }, target: 'es2020' },
    module: { type: 'commonjs' },
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'window', 'document', 'fetch', code)(
    (id) => imports[id] || (id.endsWith('/ui.js') ? ui : id.endsWith('/buyerUrls.js') ? buyerUrls : require(id)), module, module.exports,
    globals.window, globals.document, globals.fetch || (() => { throw new Error('Unexpected network call'); }),
  );
  return module.exports;
}
const asDefault = (value) => ({ __esModule: true, default: value });
const Button = (await load('app/_components/Button.jsx')).default;
const Icon = (await load('app/_components/CTCIcon.jsx')).default;
const Select = (await load('app/_components/Select.jsx')).default;
const Modal = ({ open, title, children }) => open ? React.createElement('section', { role: 'dialog' }, React.createElement('h2', null, title), children) : null;
const BetaNotice = (await load('app/_components/BetaNotice.jsx')).default;
const navigation = await load('app/_components/WorkspaceNavigation.jsx', { './CTCIcon.jsx': asDefault(Icon) });
const Workspace = (await load('app/_components/SetupWorkspace.jsx', {
  './WorkspaceNavigation.jsx': navigation,
  './CTCIcon.jsx': asDefault(Icon), './BetaNotice.jsx': asDefault(BetaNotice),
  './SupportCTA.jsx': asDefault(({ pageContext, initialEmail, liquid }) => React.createElement('div', { 'data-workspace-support': true, 'data-context': pageContext, 'data-email': initialEmail, 'data-liquid-enabled': liquid })),
})).default;

test('authenticated workspaces share navigation and support, with breadcrumbs only for nested pages', () => {
  const cases = [
    { activePage: 'discovery', pageContext: 'discovery', label: 'Discovery' },
    { activePage: 'targeting', pageContext: 'targeting_setup', label: 'Targeting' },
    { activePage: 'targeting', readOnly: true, pageContext: 'targeting_review', label: 'Targeting' },
    { activePage: 'targeting', setupStep: 2, pageContext: 'start', label: 'Start contracts' },
    { activePage: 'contracts', pageContext: 'contracts', label: 'Contracts' },
  ];
  for (const props of cases) {
    const html = renderToStaticMarkup(React.createElement(Workspace, { ...props, token: 'me', buyerEmail: 'fixture@example.test', discoveryHref: '/discover', children: 'Page content' }));
    assert.match(html, /class="wda-setup-app is-workspace"/);
    assert.equal((html.match(/<aside class="wda-setup-rail"/g) || []).length, 1);
    assert.equal((html.match(/<footer class="wda-workspace-support"/g) || []).length, 1);
    if (props.setupStep === 2) {
      assert.match(html, /aria-label="Breadcrumb"/);
      assert.match(html, /href="\/setup">Targeting<\/a>/);
      assert.match(html, /aria-current="page">Start contracts<\/span>/);
    } else {
      assert.doesNotMatch(html, /aria-label="Breadcrumb"|id="workspace-breadcrumb"/);
      assert.match(html, /class="ctc-reader-context is-beta-only"/);
    }
    assert.match(html, /<main id="workspace-content" tabindex="-1"/);
    const rail = html.match(/<aside class="wda-setup-rail"[\s\S]*?<\/aside>/)[0];
    assert.doesNotMatch(rail, /wda-workspace-atmosphere|wda-portal-glow/);
    assert.match(html, /<main[^>]*class="wda-setup-main"[^>]*><div class="wda-workspace-atmosphere" aria-hidden="true"><span class="wda-portal-glow is-pink"><\/span><span class="wda-portal-glow is-orange"><\/span><\/div>/);
    assert.ok(html.includes(props.label));
    assert.match(html, /Dismiss beta notice/);
    assert.match(html, /data-email="fixture@example.test"/);
    assert.match(html, /data-liquid-enabled="true"/);
    assert.ok(html.includes(`data-context="${props.pageContext}"`));
    assert.match(html, /<a data-liquid=""[^>]*href="\/(?:discover|contracts|setup)/);
    assert.doesNotMatch(html, /wda-setup-topline|ctc-beta-support-bar|\/me\b/);
  }
});

test('focused onboarding retains its two-path layout without sidebar navigation while using the same beta/support controls', () => {
  const html = renderToStaticMarkup(React.createElement(Workspace, { token: 'me', choice: true, children: 'Two starting paths' }));
  assert.match(html, /Two starting paths/);
  assert.match(html, /Dismiss beta notice/);
  assert.match(html, /data-workspace-support="true"/);
  assert.doesNotMatch(html, /wda-setup-rail|aria-label="Mobile navigation"|Setup progress/);
  assert.match(html, /action="\/auth\/logout" method="post"/);
  assert.match(html, /aria-label="Log out"/);
  assert.doesNotMatch(html, /wda-member-account/);
});

test('the shared sidebar renders a profile name, gender-neutral local avatar and accessible POST logout without exposing credentials', () => {
  let avatar;
  for (const [buyerName, buyerEmail, name] of [
    ['  Hunain   Ahmed  ','member@example.test','Hunain Ahmed'],
    ['Élodie Durand','member@example.test','Élodie Durand'],
    ['Alex','member@example.test','Alex'],
    ['', 'h.ahmed@example.test','h ahmed'],
    [null, '', 'Member'],
  ]) {
    const html = renderToStaticMarkup(React.createElement(Workspace, { token: 'me', buyerName, buyerEmail, discoveryHref: '/discover' }));
    const account = html.match(/<div class="wda-member-account"[\s\S]*?<\/span><\/div><\/div>/)[0];
    assert.match(account, /role="group" aria-label="Your account"/);
    assert.ok(account.includes(`<strong title="${name}">${name}</strong>`));
    const currentAvatar = account.match(/<span class="wda-member-avatar"[\s\S]*?<\/span>/)[0];
    assert.match(currentAvatar, /<svg class="wda-member-avatar-figure" viewBox="0 0 40 40"/);
    assert.match(currentAvatar, /focusable="false" aria-hidden="true"/);
    assert.doesNotMatch(currentAvatar, /<text|<img|<image|<filter|<animate|stroke=/);
    if (avatar) assert.equal(currentAvatar, avatar, 'Do not infer a gender or appearance from the member name/email');
    avatar = currentAvatar;
    assert.doesNotMatch(account, /wda-account-logout|<form/);
    assert.match(html, /action="\/auth\/logout" method="post"/);
    assert.match(html, /<button data-liquid="" class="wda-account-logout" type="submit" aria-label="Log out"/);
    assert.doesNotMatch(account, /<img|https?:|access_token/);
    assert.equal((html.match(/action="\/auth\/logout"/g) || []).length, 1);
  }
  const unsafe = renderToStaticMarkup(React.createElement(Workspace, { buyerName: '<script>alert(1)</script>', buyerEmail: 'fixture@example.test' }));
  assert.doesNotMatch(unsafe, /<script>/);
  assert.match(unsafe, /&lt;script&gt;/);
});

test('every authenticated page passes the current profile name and email to the shared sidebar', () => {
  for (const file of ['app/setup/[token]/page.js','app/discover/[token]/page.js','app/contracts/[token]/page.js','app/start/[token]/page.js','app/targeting/[token]/page.js','app/d/[token]/[notice_id]/page.js']) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    const instances = [...source.matchAll(/<SetupWorkspace\b[\s\S]*?(?=>)/g)];
    assert.ok(instances.length, file);
    for (const [instance] of instances) {
      assert.match(instance, /buyerName=\{buyer.name\}/, file);
      assert.match(instance, /buyerEmail=\{buyer.email\}/, file);
    }
  }
});

test('the account row stays borderless, truncates long names, and remains available in the wrapped mobile footer', () => {
  const css = require('postcss').parse(readFileSync(new URL('../app/workspace.css', import.meta.url), 'utf8'));
  const values = (selector) => {
    const output = {};
    css.walkRules((rule) => { if (rule.selectors.includes(selector) && rule.parent.type === 'root') rule.walkDecls((decl) => { output[decl.prop] = decl.value; }); });
    return output;
  };
  assert.equal(values('.is-workspace .wda-member-account').border, '0');
  assert.equal(values('.is-workspace .wda-member-avatar')['border-radius'], '50%');
  assert.match(values('.is-workspace .wda-member-avatar').background, /radial-gradient.*linear-gradient/);
  assert.equal(values('.is-workspace .wda-member-avatar-figure').width, '30px');
  assert.equal(values('.is-workspace .wda-member-avatar::before')['pointer-events'], 'none');
  assert.equal(values('.is-workspace .wda-member-copy')['min-width'], '0');
  assert.equal(values('.is-workspace .wda-member-copy :is(strong,span)')['text-overflow'], 'ellipsis');
  assert.equal(values('.wda-account-logout').width, '44px');
  assert.equal(values('.wda-account-logout')['min-height'], '44px');
  assert.match(values('.wda-account-logout:focus-visible').outline, /2px solid/);
  let mobileAccount = false, dropdown = false;
  const responsive = require('postcss').parse(readFileSync(new URL('../app/workspace-navigation.css', import.meta.url), 'utf8'));
  responsive.walkAtRules('media', (media) => {
    if (media.params !== '(max-width: 600px)') return;
    media.walkRules('.is-workspace .wda-member-account', (rule) => rule.walkDecls('display', (decl) => { mobileAccount = decl.value === 'grid'; }));
    media.walkRules('.is-workspace .wda-workspace-support', (rule) => rule.walkDecls('display', (decl) => { dropdown = decl.value === 'block'; }));
  });
  assert.ok(mobileAccount && dropdown);
});

test('navigation attaches to the left edge with only right corners rounded and keeps Discovery scrolling independent', () => {
  const css = require('postcss').parse(readFileSync(new URL('../app/workspace.css', import.meta.url), 'utf8'));
  const base = (selector) => {
    const values = {};
    css.walkRules(selector, (rule) => { if (rule.parent.type === 'root') rule.walkDecls((decl) => { values[decl.prop] = decl.value; }); });
    return values;
  };
  const rail = base('.is-workspace .wda-setup-rail');
  assert.equal(rail['border-radius'], '0 24px 24px 0');
  assert.equal(rail.border, '0');
  assert.equal(base('.is-workspace .wda-setup-layout').padding, '0');
  assert.match(rail.background, /linear-gradient/);
  assert.equal(rail['box-shadow'], 'none');
  assert.equal(rail.display, 'flex');
  assert.equal(base('.is-workspace .wda-workspace-support')['margin-top'], 'auto');
  assert.equal(base('.is-workspace .wda-setup-scroll:has(.wda-discovery-workspace)').overflow, 'hidden');
  assert.equal(base('.is-workspace .is-embedded .wda-discovery-layout')['grid-template-columns'], 'minmax(0,1fr)');
  assert.equal(base('.is-workspace .is-embedded .wda-chat-new').display, 'inline-flex');
  let mobileDropdown = false;
  const responsive = require('postcss').parse(readFileSync(new URL('../app/workspace-navigation.css', import.meta.url), 'utf8'));
  responsive.walkAtRules('media', (media) => {
    if (media.params === '(max-width: 600px)') media.walkRules(':root .wda-setup-app.is-workspace .wda-setup-rail', (rule) => rule.walkDecls('position', (decl) => { mobileDropdown = decl.value === 'absolute'; }));
  });
  assert.ok(mobileDropdown);
});

test('portal glows are confined behind the main pane, remain visible in dark Discovery, and honor motion/contrast preferences', () => {
  const css = require('postcss').parse(readFileSync(new URL('../app/workspace.css', import.meta.url), 'utf8'));
  const base = (selector) => {
    const values = {};
    css.walkRules(selector, (rule) => { if (rule.parent.type === 'root') rule.walkDecls((decl) => { values[decl.prop] = decl.value; }); });
    return values;
  };
  assert.equal(base('.is-workspace .wda-setup-main').isolation, 'isolate');
  assert.equal(base('.is-workspace .wda-setup-main').overflow, 'hidden');
  assert.equal(base('.wda-workspace-atmosphere')['pointer-events'], 'none');
  assert.equal(base('.wda-workspace-atmosphere')['z-index'], '-1');
  assert.equal(base('.wda-workspace-atmosphere').inset, '0');
  assert.equal(base('.is-workspace .wda-setup-scroll').background, 'transparent');
  const dark = readFileSync(new URL('../app/theme.css', import.meta.url), 'utf8');
  assert.match(dark, /:root\[data-theme="dark"\] \.is-workspace \.wda-setup-scroll \{ background: transparent !important;/);
  assert.match(dark, /:root\[data-theme="dark"\] \.is-workspace \.is-embedded \.wda-conversation \{ background: transparent;/);
  const portal = readFileSync(new URL('../app/portal.css', import.meta.url), 'utf8');
  assert.match(portal, /\.wda-portal-glow \{[^}]*animation: wdaPortalGlow/);
  assert.match(portal, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.wda-portal-glow[^}]*animation: none/);
  assert.match(readFileSync(new URL('../app/workspace.css', import.meta.url), 'utf8'), /@media \(forced-colors: active\) \{ \.wda-workspace-atmosphere \{ display: none;/);
  const choice = renderToStaticMarkup(React.createElement(Workspace, { choice: true }));
  assert.match(choice, /wda-workspace-atmosphere/);
  assert.doesNotMatch(choice, /wda-setup-rail/);
});

test('the opt-in liquid hover covers bounded sidebar controls without applying to the sidebar frame or inline text links', async () => {
  const view = await harness('app/_components/SupportCTA.jsx', { props: { sidebar: true, liquid: true, supportEmail: 'team@example.test' } });
  const html = renderToStaticMarkup(view.render());
  assert.match(html, /<button data-liquid=""/);
  assert.match(html, /<a data-liquid="" href="mailto:team@example.test"/);
  const sidebar = renderToStaticMarkup(React.createElement(Workspace, { token: 'me', discoveryHref: '/discover', activePage: 'contracts' }));
  assert.doesNotMatch(sidebar, /<aside[^>]*data-liquid|<nav[^>]*data-liquid/);
  assert.doesNotMatch(sidebar, /ctc-reader-breadcrumb/);
  const nested = renderToStaticMarkup(React.createElement(Workspace, { token: 'me', discoveryHref: '/discover', setupStep: 2 }));
  const crumb = nested.match(/<nav class="ctc-reader-breadcrumb"[\s\S]*?<\/nav>/)?.[0];
  assert.ok(crumb);
  assert.doesNotMatch(crumb, /data-liquid/);
});

test('Discovery fills the workspace without an inset card, while keeping history scrolling and the composer anchored', () => {
  const css = require('postcss').parse(readFileSync(new URL('../app/workspace.css', import.meta.url), 'utf8'));
  const base = (selector) => {
    const values = {};
    css.walkRules(selector, (rule) => {
      if (rule.parent.type === 'root') rule.walkDecls((decl) => { values[decl.prop] = decl.value; });
    });
    return values;
  };
  const workspace = base('.is-workspace .wda-discovery-workspace');
  assert.equal(workspace.padding, '0');
  assert.equal(workspace.margin, '0');
  assert.equal(workspace['max-width'], 'none');
  assert.equal(workspace.flex, '1');
  assert.equal(workspace['min-height'], '0');
  const chat = base('.is-workspace .wda-discovery-workspace > .is-embedded');
  assert.equal(chat.border, '0');
  assert.equal(chat['border-radius'], '0');
  assert.equal(chat['box-shadow'], 'none');
  assert.equal(chat.background, 'transparent');
  assert.equal(chat.flex, '1');
  assert.equal(base('.is-workspace .is-embedded .wda-conversation').background, 'transparent');
  assert.equal(base('.is-workspace .wda-discovery-workspace > .ctc-reader-context')['margin-bottom'], '0');
  css.walkAtRules('media', (media) => {
    if (media.params !== '(max-width: 600px)') return;
    media.walkRules('.is-workspace .wda-discovery-workspace', (rule) => {
      rule.walkDecls('padding', (decl) => assert.equal(decl.value, '0'));
    });
    media.walkRules('.is-workspace .wda-discovery-workspace > .is-embedded', (rule) => {
      rule.walkDecls('border-radius', (decl) => assert.equal(decl.value, '0'));
    });
  });
});

test('active navigation is a quiet text row with a slim marker, without a filled tile or liquid hover', () => {
  const html = renderToStaticMarkup(React.createElement(Workspace, { token: 'me', discoveryHref: '/discover', activePage: 'contracts', reader: true }));
  const current = html.match(/<a[^>]*aria-current="location"[^>]*>/g);
  assert.equal(current.length, 2);
  current.forEach((link) => assert.doesNotMatch(link, /data-liquid/));
  const css = require('postcss').parse(readFileSync(new URL('../app/workspace.css', import.meta.url), 'utf8'));
  const declarations = (selector, media = false) => {
    const result = {};
    css.walkRules(selector, (rule) => {
      if ((rule.parent.type === 'atrule') === media) rule.walkDecls((decl) => { result[decl.prop] = decl.value; });
    });
    return result;
  };
  const active = declarations('.is-workspace .wda-setup-rail nav > [aria-current]');
  assert.equal(active.background, 'transparent');
  assert.equal(active['border-color'], 'transparent');
  assert.equal(active['box-shadow'], 'none');
  assert.equal(active.color, '#302923');
  assert.equal(declarations('.is-workspace .wda-setup-rail nav > [aria-current]::before').width, '2px');
  const mobile = declarations('.is-workspace .wda-setup-mobile [aria-current]', true);
  assert.equal(mobile.background, 'transparent');
  assert.equal(mobile['box-shadow'], 'none');
  assert.equal(declarations('.is-workspace .ctc-reader-context.is-beta-only:not(:has(.ctc-reader-beta))').display, 'none');
});

async function harness(filename, { props = {}, globals = {} } = {}) {
  const slots = [];
  let cursor = 0;
  const effects = [];
  const hooks = { ...React,
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], (value) => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useEffect(effect, deps) {
      const index = cursor++;
      if (!slots[index] || !deps || deps.some((value, i) => value !== slots[index][i])) effects.push(effect);
      slots[index] = deps;
    },
  };
  const component = (await load(filename, { react: hooks, './Button.jsx': asDefault(Button), './CTCIcon.jsx': asDefault(Icon), './Modal.jsx': asDefault(Modal), './Select.jsx': asDefault(Select) }, globals)).default;
  return {
    render() { cursor = 0; return component(props); },
    effects() { while (effects.length) effects.shift()(); },
  };
}
function find(node, predicate) {
  if (!React.isValidElement(node)) return null;
  if (predicate(node)) return node;
  for (const child of React.Children.toArray(node.props.children)) {
    const match = find(child, predicate);
    if (match) return match;
  }
  return null;
}
function storage() {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}
const button = (node, label) => find(node, (element) => element.type === 'button' && React.Children.toArray(element.props.children).includes(label));

test('beta dismissal hides the notice, persists within a browser session, and returns keyboard focus to the breadcrumb', async () => {
  const sessionStorage = storage();
  let focused = 0;
  const globals = { window: { sessionStorage }, document: { getElementById: (id) => id === 'breadcrumb' ? { focus() { focused++; } } : null } };
  const props = { focusAfterDismissId: 'breadcrumb' };
  const view = await harness('app/_components/BetaNotice.jsx', { globals, props });
  assert.match(renderToStaticMarkup(view.render()), /role="note"/);
  view.effects();
  const dismiss = find(view.render(), (element) => element.props['aria-label'] === 'Dismiss beta notice');
  dismiss.props.onClick();
  assert.equal(view.render(), null);
  assert.equal(focused, 1);
  const revisit = await harness('app/_components/BetaNotice.jsx', { globals, props });
  revisit.render(); revisit.effects();
  assert.equal(revisit.render(), null);
  const fresh = await harness('app/_components/BetaNotice.jsx', { globals: { ...globals, window: { sessionStorage: storage() } }, props });
  fresh.render(); fresh.effects();
  assert.notEqual(fresh.render(), null);
});

test('beta dismissal remains usable when browser storage is blocked or the focus target is absent', async () => {
  const view = await harness('app/_components/BetaNotice.jsx', { props: { focusAfterDismissId: 'missing' }, globals: {
    window: { get sessionStorage() { throw new Error('Storage blocked'); } },
    document: { getElementById: () => null },
  } });
  view.render();
  assert.doesNotThrow(() => view.effects());
  find(view.render(), (element) => element.props['aria-label'] === 'Dismiss beta notice').props.onClick();
  assert.equal(view.render(), null);
});

test('sidebar support removes the beta strip and preserves feedback modal behavior and the configured email destination', async () => {
  const view = await harness('app/_components/SupportCTA.jsx', { props: { sidebar: true, pageContext: 'deep_dive', initialEmail: 'fixture@example.test', supportEmail: 'team@example.test' } });
  const initial = view.render();
  const html = renderToStaticMarkup(initial);
  assert.match(html, /class="wda-sidebar-support"/);
  assert.match(html, /href="mailto:team@example.test"/);
  assert.match(html, /Email support/);
  assert.doesNotMatch(html, /ctc-beta-support-bar|currently in beta|role="dialog"|data-liquid/);
  button(initial, 'Send feedback').props.onClick();
  assert.match(renderToStaticMarkup(view.render()), /role="dialog"/);
  assert.match(renderToStaticMarkup(view.render()), /Send beta feedback/);
  const close = find(view.render(), (element) => element.type === Modal).props.onClose;
  close();
  assert.doesNotMatch(renderToStaticMarkup(view.render()), /role="dialog"/);
});

test('sidebar contact fallback keeps the support form and sends the original account/context payload', async () => {
  const calls = [];
  const view = await harness('app/_components/SupportCTA.jsx', {
    props: { sidebar: true, pageContext: 'deep_dive', initialEmail: 'fixture@example.test' },
    globals: { window: { location: { pathname: '/d/building--notice-fixture', search: '' } }, fetch: async (...args) => { calls.push(args); return { ok: true }; } },
  });
  button(view.render(), 'Contact support').props.onClick();
  let tree = view.render();
  assert.match(renderToStaticMarkup(tree), /Need help/);
  find(tree, (element) => element.props.id === 'support-message').props.onChange({ target: { value: 'Please help me review my access.' } });
  tree = view.render();
  await find(tree, (element) => element.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], '/api/support');
  const body = JSON.parse(calls[0][1].body);
  assert.equal(body.type, 'support');
  assert.equal(body.email, 'fixture@example.test');
  assert.equal(body.pageContext, 'deep_dive');
  assert.equal(body.pagePath, '/d/building--notice-fixture');
  assert.match(renderToStaticMarkup(view.render()), /Your support request has been sent/);
});

test('feedback category uses the shared select and sends its selected value through the existing support endpoint', async () => {
  const calls = [];
  const view = await harness('app/_components/SupportCTA.jsx', {
    props: { sidebar: true, pageContext: 'contracts', initialEmail: 'fixture@example.test' },
    globals: { fetch: async (...args) => { calls.push(args); return { ok: true }; } },
  });
  button(view.render(), 'Send feedback').props.onClick();
  let tree = view.render();
  const category = find(tree, (element) => element.props.id === 'support-category');
  assert.equal(category.type, Select);
  assert.equal(category.props.name, 'category');
  category.props.onChange('Contract issue');
  find(tree, (element) => element.props.id === 'support-message').props.onChange({ target: { value: 'The contract details are not loading.' } });
  tree = view.render();
  assert.doesNotMatch(renderToStaticMarkup(tree), /<select|<option/);
  assert.match(renderToStaticMarkup(tree), /role="combobox"/);
  await find(tree, (element) => element.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.equal(calls[0][0], '/api/support');
  const payload = JSON.parse(calls[0][1].body);
  assert.equal(payload.category, 'Contract issue');
  assert.equal(payload.type, 'feedback');
  assert.equal(payload.pageContext, 'contracts');
  assert.match(renderToStaticMarkup(view.render()), /Thanks, we got it/);
});

test('existing sticky support stays unchanged outside the reader', async () => {
  const view = await harness('app/_components/SupportCTA.jsx', { props: { sticky: true, pageContext: 'contracts' } });
  const html = renderToStaticMarkup(view.render());
  assert.match(html, /ctc-beta-support-bar/);
  assert.match(html, /This product is currently in beta/);
  assert.doesNotMatch(html, /wda-sidebar-support/);
});

test('reader CSS provides one borderless reading panel, row navigation and one responsive support footer without changing other workspaces', () => {
  const css = require('postcss').parse(readFileSync(new URL('../app/contract-flow.css', import.meta.url), 'utf8'));
  const base = (selector) => {
    const result = {};
    css.walkRules(selector, (rule) => { if (rule.parent.type === 'root') rule.walkDecls((decl) => { result[decl.prop] = decl.value; }); });
    return result;
  };
  const document = base('.ctc-breakdown-document');
  assert.equal(document.border, '0');
  assert.equal(document['border-radius'], '22px');
  assert.equal(document.padding, '24px 26px');
  assert.equal(document.background, 'var(--reader-surface,var(--theme-soft-surface,#F0ECE7))');
  assert.equal(document['box-shadow'], 'none');
  assert.equal(base('.is-reader .wda-setup-rail nav > *')['flex-direction'], 'row');
  assert.equal(base('.is-reader .wda-setup-rail nav > *').background, 'transparent');
  assert.equal(base('.is-reader .wda-workspace-support')['grid-column'], '1');
  assert.equal(base('.is-reader .wda-workspace-support')['grid-row'], '2');
  assert.equal(base('.is-reader .wda-setup-main')['grid-column'], '2');
  assert.equal(base('.is-reader .wda-setup-main')['grid-row'], '1 / -1');
  assert.equal(base('.ctc-reader-beta button').height, '44px');
  let mobileMain = false;
  let mobileSupport = false;
  css.walkAtRules('media', (media) => {
    if (media.params !== '(max-width: 600px)') return;
    media.walkRules('.is-reader .wda-setup-main', (rule) => rule.walkDecls('grid-row', (decl) => { mobileMain = decl.value === '1'; }));
    media.walkRules('.is-reader .wda-workspace-support', (rule) => rule.walkDecls('grid-row', (decl) => { mobileSupport = decl.value === '2'; }));
  });
  assert.ok(mobileMain);
  assert.ok(mobileSupport);
  css.walkRules((rule) => {
    if (rule.selector.includes('ctc-brief-section-heading:hover')) rule.walkDecls('color', (decl) => assert.doesNotMatch(decl.value, /94226A|pink/i));
  });
});
