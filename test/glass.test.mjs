import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const css = require('postcss').parse(readFileSync(new URL('../app/glass.css', import.meta.url), 'utf8'));
const properties = (selector) => {
  const values = {};
  css.walkRules((rule) => { if (rule.selectors.includes(selector) && rule.parent.type === 'root') rule.walkDecls((decl) => { values[decl.prop] = decl.value; }); });
  return values;
};

test('answer suggestions use translucent glass when supported and an opaque fallback otherwise', () => {
  const surface = properties(':root .wda-discovery-app button.wda-suggestion');
  assert.equal(surface.background, 'var(--starter-glass-solid)');
  assert.equal(surface['border-radius'], '24px');
  assert.equal(surface['min-height'], '56px');
  assert.equal(surface.color, 'var(--starter-glass-ink)');
  assert.equal(surface.border, '0');
  assert.doesNotMatch(surface['box-shadow'], /inset/);
  let enhancement = false;
  css.walkAtRules('supports', (supports) => {
    assert.match(supports.params, /backdrop-filter/);
    supports.walkRules((rule) => {
      if (!rule.selectors.includes(':root .wda-discovery-app button.wda-suggestion')) return;
      const values = Object.fromEntries(rule.nodes.filter((node) => node.type === 'decl').map((decl) => [decl.prop, decl.value]));
      assert.equal(values.background, 'var(--starter-glass-fill)');
      assert.equal(values['backdrop-filter'], 'blur(14px) saturate(145%) contrast(1.04)');
      assert.equal(values['-webkit-backdrop-filter'], values['backdrop-filter']);
      enhancement = true;
    });
  });
  assert.ok(enhancement);
  const reflection = properties(':root .wda-discovery-app button.wda-suggestion::after');
  assert.match(reflection.background, /var\(--liquid-x\).*var\(--liquid-y\)/);
  assert.equal(properties(':root .wda-discovery-app button.wda-suggestion::before')['pointer-events'], 'none');
  const layout = readFileSync(new URL('../app/layout.js', import.meta.url), 'utf8');
  assert.ok(layout.indexOf("import './glass.css'") > layout.indexOf("import './theme.css'"));
});

test('glass states preserve focus, disabled/drafting feedback and accessible reduced transparency/motion', () => {
  assert.match(properties(':root .wda-discovery-app button.wda-suggestion:focus-visible').outline, /2px solid/);
  assert.equal(properties(':root .wda-discovery-app button.wda-suggestion:disabled').transform, 'none');
  assert.equal(properties(':root .wda-discovery-app button.wda-suggestion:disabled::after').opacity, '0');
  assert.equal(properties(':root .wda-discovery-app button.wda-suggestion.is-drafting').opacity, '1');
  const modes = new Set();
  css.walkAtRules('media', (media) => {
    if (media.params.includes('prefers-reduced-motion')) {
      media.walkDecls('transform', (decl) => { assert.equal(decl.value, 'none'); assert.ok(decl.important); });
      modes.add('motion');
    }
    if (media.params.includes('prefers-reduced-transparency')) {
      media.walkDecls('backdrop-filter', (decl) => { assert.equal(decl.value, 'none'); assert.ok(decl.important); });
      modes.add('transparency');
    }
    if (media.params.includes('forced-colors')) {
      media.walkDecls('background', (decl) => assert.equal(decl.value, decl.parent.selector.includes('.wda-skeleton-card :is(') ? 'ButtonText' : 'ButtonFace'));
      modes.add('forced');
    }
  });
  assert.deepEqual([...modes].sort(), ['forced','motion','transparency']);
  css.walkRules((rule) => {
    if (rule.parent.name === 'keyframes') return;
    assert.ok(rule.selector.includes('.wda-discovery-app') || rule.selector.includes('.is-workspace') || rule.selector.includes('.wda-setup-app'), 'Only targeted workspace surfaces get styled');
  });
});

test('shortlist skeleton cards and the loading mark share borderless glass without changing their responsive layout or shimmer', () => {
  const surfaceSelector = ':root .wda-discovery-app :is(.wda-skeleton-card,.wda-loading-mark)';
  const surface = properties(surfaceSelector);
  assert.equal(surface.border, '0');
  assert.equal(surface.background, 'var(--starter-glass-solid)');
  assert.doesNotMatch(surface['box-shadow'], /inset/);
  assert.equal(surface.opacity, undefined, 'Only the surface is translucent, not its contents');
  assert.equal(properties(':root .wda-discovery-app .wda-skeleton-card')['border-radius'], '24px');
  assert.equal(properties(':root .wda-discovery-app .wda-skeleton-footer').border, '0');
  assert.equal(properties(':root .wda-discovery-app .wda-skeleton-card::before')['pointer-events'], 'none');
  const bars = properties(':root .wda-discovery-app .wda-skeleton-card :is(.wda-skeleton-badge,.wda-skeleton-title,.wda-skeleton-industry,.wda-skeleton-line,.wda-skeleton-tags span,.wda-skeleton-btn)');
  assert.match(bars.background, /--skeleton-glass-bar.*--skeleton-glass-shine/);
  assert.equal(bars['background-size'], '240% 100%');
  assert.equal(bars.animation, undefined, 'Keep the existing calm shimmer timing');
  for (const theme of [':root .wda-discovery-app', ':root[data-theme="dark"] .wda-discovery-app']) {
    for (const token of ['--skeleton-glass-bar','--skeleton-glass-shine']) {
      const value = properties(theme)[token];
      assert.match(value, /^rgba\(/);
      const alpha = Number(value.match(/,([.\d]+)\)$/)[1]);
      assert.ok(alpha > 0 && alpha < 1);
    }
  }
  let blur = false;
  css.walkAtRules('supports', (supports) => supports.walkRules((rule) => {
    if (!rule.selectors.includes(surfaceSelector)) return;
    const values = Object.fromEntries(rule.nodes.filter((node) => node.type === 'decl').map((node) => [node.prop,node.value]));
    assert.equal(values.background, 'var(--starter-glass-fill)');
    assert.equal(values['backdrop-filter'], 'blur(14px) saturate(145%) contrast(1.04)');
    assert.equal(values['-webkit-backdrop-filter'], values['backdrop-filter']);
    blur = true;
  }));
  assert.ok(blur);
  css.walkRules((rule) => {
    for (const selector of rule.selectors) {
      if (selector.includes('wda-skeleton')) assert.doesNotMatch(selector, /:hover|:active|data-liquid/);
    }
  });
});

test('shortlist glass has solid and system-color fallbacks and its shimmer/spinner stop for reduced motion', () => {
  const surfaceSelector = ':root .wda-discovery-app :is(.wda-skeleton-card,.wda-loading-mark)';
  for (const query of ['(prefers-reduced-transparency: reduce), (prefers-contrast: more)','(forced-colors: active)']) {
    let solid = false;
    css.walkAtRules('media', (media) => {
      if (media.params !== query) return;
      media.walkRules((rule) => {
        if (!rule.selectors.includes(surfaceSelector)) return;
        const values = Object.fromEntries(rule.nodes.filter((node) => node.type === 'decl').map((node) => [node.prop,node.value]));
        assert.equal(values['backdrop-filter'], 'none');
        assert.equal(values.background, query.includes('forced-colors') ? 'ButtonFace' : 'var(--starter-glass-solid)');
        solid = true;
      });
    });
    assert.ok(solid, query);
  }
  let still = false;
  css.walkAtRules('media', (media) => {
    if (media.params !== '(prefers-reduced-motion: reduce)') return;
    media.walkRules((rule) => {
      if (!rule.selector.includes('.wda-skeleton-card *')) return;
      assert.match(rule.selector, /\.wda-loading-mark \*/);
      assert.ok(rule.nodes.some((node) => node.prop === 'animation' && node.value === 'none' && node.important));
      still = true;
    });
  });
  assert.ok(still);
});

test('finished niche recommendations use steady borderless glass while preserving their nested primary action', () => {
  const card = ':root .wda-discovery-app .wda-rec-card';
  for (const selector of [card, `${card}:is(:hover,:focus-within)`]) {
    const surface = properties(selector);
    assert.equal(surface.border, '0');
    assert.equal(surface['border-radius'], '24px');
    assert.equal(surface.background, 'var(--starter-glass-solid)');
    assert.equal(surface.transform, 'none');
    assert.equal(surface['min-height'], undefined, 'Preserve desktop and mobile sizing from Discovery');
    assert.doesNotMatch(surface['box-shadow'], /inset/);
    let glass = false;
    css.walkAtRules('supports', (supports) => supports.walkRules((rule) => {
      if (!rule.selectors.includes(selector)) return;
      const values = Object.fromEntries(rule.nodes.filter((node) => node.type === 'decl').map((node) => [node.prop,node.value]));
      assert.equal(values.background, 'var(--starter-glass-fill)');
      assert.equal(values['backdrop-filter'], 'blur(14px) saturate(145%) contrast(1.04)');
      assert.equal(values['-webkit-backdrop-filter'], values['backdrop-filter']);
      glass = true;
    }));
    assert.ok(glass);
  }
  assert.equal(properties(`${card}::before`)['pointer-events'], 'none');
  assert.match(properties(`${card}::after`).background, /--liquid-x.*--liquid-y/);
  assert.equal(properties(`${card}::after`).opacity, undefined, 'Shared button/parent sheen suppression must stay authoritative');
  for (const query of ['(prefers-reduced-transparency: reduce), (prefers-contrast: more)','(forced-colors: active)']) {
    let fallback = false;
    css.walkAtRules('media', (media) => {
      if (media.params !== query) return;
      media.walkRules((rule) => {
        if (!rule.selectors.includes(card)) return;
        fallback ||= rule.nodes.some((node) => node.prop === 'backdrop-filter' && node.value === 'none' && node.important);
      });
    });
    assert.ok(fallback, query);
  }
});

test('sidebar, mobile chrome and composer share borderless glass without divider lines or inset rims', () => {
  const sidebar = ':root .wda-setup-app.is-workspace :is(.wda-setup-rail,.wda-setup-mobile)';
  const composer = ':root .wda-discovery-app form.wda-composer';
  for (const selector of [sidebar, composer, ':root .wda-discovery-app form.wda-composer:is(:hover,:focus-within,.is-drafting)']) {
    assert.equal(properties(selector).border, '0');
    assert.doesNotMatch(properties(selector)['box-shadow'], /inset/);
    let blurred = false;
    css.walkAtRules('supports', (supports) => supports.walkRules((rule) => {
      if (rule.selectors.includes(selector)) rule.walkDecls('backdrop-filter', (decl) => { blurred = decl.value.includes('blur(14px)'); });
    }));
    assert.ok(blurred, selector);
  }
  assert.equal(properties(':root .is-workspace .wda-setup-rail :is(.wda-workspace-support,.wda-sidebar-support-actions,.wda-workspace-products,nav > *)').border, '0');
  assert.equal(properties(':root .wda-discovery-app form.wda-composer textarea').border, '0');
  assert.equal(properties(':root .wda-discovery-app form.wda-composer.is-drafting::after').inset, '0');
  assert.equal(properties(':root .wda-discovery-app form.wda-composer:has(textarea:focus-visible)').outline, 'none');
  // There must be no state-specific rule or optical bevel that redraws a border.
  css.walkDecls((decl) => {
    if (decl.prop === 'border' || /^border-(?:top|right|bottom|left)(?:-width)?$/.test(decl.prop)) assert.equal(decl.value, '0');
    if (decl.prop === 'box-shadow') assert.doesNotMatch(decl.value, /inset/);
    assert.notEqual(decl.prop, 'border-color');
  });
});

test('focused chat retains its glass fill, with no opaque wrapper, border or pink focus ring', () => {
  const focused = ':root .wda-discovery-app form.wda-composer:is(:hover,:focus-within,.is-drafting)';
  assert.equal(properties(focused).border, '0');
  assert.equal(properties(focused).outline, 'none');
  assert.equal(properties(':root .wda-discovery-app .wda-composer-wrap').background, 'transparent');
  const keyboardFocus = properties(':root .wda-discovery-app form.wda-composer:has(textarea:focus-visible)');
  assert.equal(keyboardFocus.outline, 'none');
  assert.match(keyboardFocus['box-shadow'], /^0 8px 24px /);
  css.walkAtRules('supports', (supports) => supports.walkRules((rule) => {
    if (!rule.selectors.includes(focused)) return;
    assert.equal(rule.nodes.find((node) => node.prop === 'background').value, 'var(--starter-glass-fill)');
  }));
  let systemFocus = false;
  css.walkAtRules('media', (media) => {
    if (media.params !== '(forced-colors: active)') return;
    media.walkDecls('outline', (decl) => { systemFocus ||= decl.value === '2px solid Highlight'; });
  });
  assert.ok(systemFocus, 'System high-contrast focus is still identifiable');
});

test('sidebar brand wash and mercury reflection stay behind controls with motion/transparency fallbacks', () => {
  const rail = ':root .wda-setup-app.is-workspace .wda-setup-rail';
  const light = ':root .wda-setup-app.is-workspace .wda-rail-light';
  assert.equal(properties(rail).isolation, 'isolate');
  assert.equal(properties(rail).position, 'relative');
  assert.match(properties(rail)['--rail-pink'], /245,46,169/);
  assert.match(properties(rail)['--rail-orange'], /255,159,88/);
  let wash, reflection, animation;
  css.walkAtRules('media', (media) => {
    if (media.params !== '(min-width: 601px)') return;
    media.walkRules((rule) => {
      const values = Object.fromEntries(rule.nodes.filter((node) => node.type === 'decl').map((node) => [node.prop, node.value]));
      if (rule.selectors.includes(`${light}::before`)) wash = { ...wash, ...values };
      if (rule.selectors.includes(`${light}::after`)) reflection = { ...reflection, ...values };
    });
  });
  for (const surface of [wash, reflection]) {
    assert.equal(surface['pointer-events'], 'none');
    assert.equal(surface['z-index'], '-1');
    assert.match(surface.background, /var\(--rail-pink\).*var\(--rail-orange\)/s);
  }
  assert.match(wash.animation, /wdaRailMercury 22s/);
  assert.equal(reflection.left, 'var(--liquid-x,50%)');
  assert.equal(reflection.top, 'var(--liquid-y,50%)');
  assert.match(reflection.transition, /left \.65s.*top \.65s/);
  css.walkAtRules('keyframes', (frames) => { if (frames.params === 'wdaRailMercury') animation = frames; });
  assert.ok(animation);
  animation.walkDecls((decl) => assert.ok(['transform','border-radius'].includes(decl.prop), 'No flashing, layout or opacity animation'));
  for (const query of ['(prefers-reduced-motion: reduce)', '(prefers-reduced-transparency: reduce), (prefers-contrast: more)', '(forced-colors: active)']) {
    let safe = false;
    css.walkAtRules('media', (media) => {
      if (media.params !== query) return;
      media.walkRules((rule) => {
        if (!rule.selectors.includes(`${light}::after`)) return;
        safe ||= rule.nodes.some((node) => node.prop === 'display' && node.value === 'none');
      });
    });
    assert.ok(safe, query);
  }
  const frame = properties('.is-workspace .wda-rail-light');
  assert.equal(frame.position, 'absolute');
  assert.equal(frame.inset, '0');
  assert.equal(frame.overflow, 'hidden');
  assert.equal(frame.contain, 'paint');
  assert.equal(frame['pointer-events'], 'none');
  css.walkRules((rule) => assert.ok(!rule.selector.includes('.wda-setup-rail::'), 'Oversized ambient pseudo-elements must be clipped in their own frame, not attached to the scroll container'));
});

const rgb = (hex) => hex.match(/[a-f\d]{2}/gi).map((channel) => parseInt(channel, 16));
function composite(foreground, background) {
  const rgba = foreground.match(/[\d.]+/g).map(Number);
  return background.map((channel, index) => channel * (1 - rgba[3]) + rgba[index] * rgba[3]);
}
function contrast(a, b) {
  const luminance = (channels) => channels.map((value) => value / 255).map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, i) => sum + value * [.2126,.7152,.0722][i], 0);
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + .05) / (values[1] + .05);
}
test('glass labels remain legible over representative neutral and branded backdrops in both themes', () => {
  for (const [selector, backgrounds] of [
    ['.wda-discovery-app', ['#FDFBF9','#F4A5D1','#F6B181']],
    [':root[data-theme="dark"] .wda-discovery-app', ['#141316','#7F395E','#7A523B']],
  ]) {
    const palette = properties(selector);
    for (const background of backgrounds) {
      const surface = composite(palette['--starter-glass-fill'], rgb(background));
      for (const role of ['ink','muted']) assert.ok(contrast(rgb(palette[`--starter-glass-${role}`]), surface) >= 4.5, `${role} over ${background}`);
    }
  }
});

const softPanels = ':root .wda-setup-app :is(.wda-setup-path,.wda-setup-selected,.targeting-page-panel,.targeting-form-heading,.targeting-summary-section,.targeting-form-footer,.contracts-title-card,.contracts-card,.contracts-empty,.contracts-targeting)';

test('all targeting and archive cards share the borderless chat-bubble surface without changing layout or clipping editors', () => {
  const material = properties(softPanels);
  assert.equal(material.background, 'var(--theme-soft-surface)');
  assert.equal(material.border, '0');
  assert.equal(material['border-radius'], '22px');
  assert.equal(material['box-shadow'], 'none');
  assert.equal(material.transform, 'none');
  assert.equal(material['backdrop-filter'], 'none');
  assert.equal(material['-webkit-backdrop-filter'], 'none');
  for (const key of ['padding','display','grid-template-columns','min-height','overflow','outline']) assert.equal(material[key], undefined, `Preserve ${key}`);
  assert.equal(material['--setup-muted'], 'var(--theme-soft-muted)');
  assert.equal(properties(':root .is-workspace .targeting-summary-section:focus-within')['z-index'], '2');
  assert.equal(properties(':root .wda-setup-app .contracts-title-card::before').display, 'none');
  css.walkAtRules('supports', (supports) => supports.walkRules((rule) => {
    assert.ok(!rule.selector.includes('targeting-summary-section'), 'No old glass enhancement should repaint these panels');
  }));
});

test('light and dark cards use the exact same color token as chat bubbles and override legacy dark backgrounds', () => {
  const theme = require('postcss').parse(readFileSync(new URL('../app/theme.css', import.meta.url), 'utf8'));
  const declarations = (selector) => {
    let result = {};
    theme.walkRules((rule) => {
      if (!rule.selectors.includes(selector) || rule.parent.type !== 'root') return;
      result = { ...result, ...Object.fromEntries(rule.nodes.filter((node) => node.type === 'decl').map((node) => [node.prop,node.value])) };
    });
    return result;
  };
  assert.equal(declarations(':root')['--theme-soft-surface'], '#F0ECE7');
  assert.equal(declarations(':root[data-theme="dark"]')['--theme-soft-surface'], '#29262D');
  assert.equal(declarations(':root[data-theme="dark"] .wda-student-copy').background, 'var(--theme-soft-surface)');
  const darkPanels = softPanels.replace(':root ', ':root[data-theme="dark"] ');
  assert.equal(properties(darkPanels).background, 'var(--theme-soft-surface)');
  assert.equal(properties(darkPanels)['box-shadow'], 'none');
  assert.equal(properties(darkPanels)['border-radius'], '22px');
  assert.equal(properties(darkPanels)['backdrop-filter'], 'none');
  const layout = readFileSync(new URL('../app/layout.js', import.meta.url), 'utf8');
  assert.ok(layout.indexOf("import './glass.css'") > layout.indexOf("import './theme.css'"), 'Explicit dark card scope wins over legacy theme gradients');
});

test('chat-bubble card colors retain readable body text and metadata and honor forced colors', () => {
  const theme = require('postcss').parse(readFileSync(new URL('../app/theme.css', import.meta.url), 'utf8'));
  for (const selector of [':root', ':root[data-theme="dark"]']) {
    const palette = {};
    theme.walkRules((rule) => {
      if (!rule.selectors.includes(selector) || rule.parent.type !== 'root') return;
      rule.walkDecls((decl) => { palette[decl.prop] = decl.value; });
    });
    for (const key of ['--theme-ink','--theme-text','--theme-soft-muted']) {
      assert.ok(contrast(rgb(palette[key]), rgb(palette['--theme-soft-surface'])) >= 4.5, `${selector}: ${key}`);
    }
  }
  let systemSurface = false;
  css.walkAtRules('media', (media) => {
    if (media.params !== '(forced-colors: active)') return;
    media.walkRules((rule) => {
      if (!rule.selectors.includes(softPanels)) return;
      systemSurface ||= rule.nodes.some((node) => node.prop === 'background' && node.value === 'ButtonFace' && node.important);
    });
  });
  assert.ok(systemSurface);
});

test('recommendations use an attached, borderless numbered corner badge without overlapping their titles', () => {
  const card = ':root .wda-discovery-app .wda-rec-card';
  const badge = properties(`${card} .wda-rec-number`);
  assert.equal(badge.position, 'absolute');
  assert.equal(badge.top, '0');
  assert.equal(badge.right, '0');
  assert.equal(badge.border, '0');
  assert.equal(badge['border-radius'], '0 24px 0 18px');
  assert.equal(badge['min-width'], '56px');
  assert.equal(badge.height, '52px');
  assert.match(badge['font-family'], /Zuume Rough/);
  assert.equal(badge['font-weight'], '700');
  assert.equal(badge['pointer-events'], 'none');
  assert.equal(properties(`${card} :is(.wda-rec-title,.wda-rec-industry)`)['padding-right'], '52px');
});

test('recommendation titles, explanations, metadata and option numbers remain readable over the glass and brand glows', () => {
  for (const [theme, card, backgrounds] of [
    ['.wda-discovery-app', ':root .wda-discovery-app .wda-rec-card', ['#FDFBF9','#F4A5D1','#F6B181','#F52EA9','#FF9F58']],
    [':root[data-theme="dark"] .wda-discovery-app', ':root[data-theme="dark"] .wda-discovery-app .wda-rec-card', ['#141316','#7F395E','#7A523B','#F52EA9','#FF9F58']],
  ]) {
    const palette = { ...properties(theme), ...properties(card) };
    const number = properties(card)['--rec-glass-number'];
    for (const background of backgrounds) {
      const surface = composite(palette['--starter-glass-fill'], rgb(background));
      for (const color of [palette['--starter-glass-ink'],palette['--starter-glass-muted'],number]) {
        assert.ok(contrast(rgb(color),surface) >= 4.5, `${color} over ${background}`);
        assert.ok(contrast(rgb(color),rgb(palette['--starter-glass-solid'])) >= 4.5);
      }
      const badge = properties(`${card} .wda-rec-number`);
      const tints = badge.background.match(/rgba\([^)]+\)/g);
      for (const tint of tints) {
        for (const base of [surface, rgb(palette['--starter-glass-solid'])]) {
          assert.ok(contrast(rgb(number), composite(tint, base)) >= 3, 'Large bold badge text stays readable over either gradient endpoint');
        }
      }
    }
  }
});

test('both reader panels share a borderless matte surface while preserving sticky layout, responsive padding and accordion behavior', () => {
  const selector = ':root .is-workspace :is(.ctc-opportunity-card,.ctc-breakdown-document)';
  const flow = require('postcss').parse(readFileSync(new URL('../app/contract-flow.css', import.meta.url), 'utf8'));
  let base, mobile;
  flow.walkRules('.ctc-breakdown-document', (rule) => {
    const values = Object.fromEntries(rule.nodes.filter((node) => node.type === 'decl').map((node) => [node.prop, node.value]));
    if (rule.parent.type === 'root') base = values;
    if (rule.parent.params === '(max-width: 600px)') mobile = values;
  });
  assert.equal(base.border, '0');
  assert.equal(base['border-radius'], '22px');
  assert.equal(base.padding, '24px 26px');
  assert.equal(mobile.padding, '20px 16px');
  assert.equal(base.background, 'var(--reader-surface,var(--theme-soft-surface,#F0ECE7))');
  assert.equal(base['box-shadow'], 'none');
  assert.equal(base.animation, undefined);
  assert.equal(base.overflow, undefined, 'Do not clip accordion focus rings');
  for (const scope of [selector, selector.replace(':root ', ':root[data-theme="dark"] ')]) {
    const material = properties(scope);
    assert.equal(material.background, 'var(--reader-surface)');
    assert.equal(material.border, '0');
    assert.equal(material['border-radius'], '22px');
    assert.equal(material['box-shadow'], 'none');
    assert.equal(material['backdrop-filter'], 'none');
    assert.equal(material['-webkit-backdrop-filter'], 'none');
    assert.equal(material.position, undefined, 'The summary must remain sticky and release correctly on mobile');
    assert.equal(material.overflow, undefined, 'Do not clip focus rings on the report');
  }
  assert.equal(properties(':root .is-workspace .ctc-opportunity-card-footer').background, 'transparent');
  assert.equal(properties(':root[data-theme="dark"] .is-workspace .ctc-opportunity-card-footer').background, 'transparent');
  css.walkAtRules('supports', (supports) => supports.walkRules((rule) => {
    assert.ok(!rule.selector.includes('ctc-breakdown-document'), 'No old glass overlay should repaint the reader');
  }));
  let systemSurface = false;
  css.walkAtRules('media', (media) => {
    if (media.params !== '(forced-colors: active)') return;
    media.walkRules((rule) => {
      if (!rule.selectors.includes(selector)) return;
      systemSurface ||= rule.nodes.some((node) => node.prop === 'background' && node.value === 'ButtonFace' && node.important);
    });
  });
  assert.ok(systemSurface);
});

test('reader panels use soft pink in light mode and shared charcoal in dark mode with readable typography', () => {
  const theme = require('postcss').parse(readFileSync(new URL('../app/theme.css', import.meta.url), 'utf8'));
  for (const prefix of [':root', ':root[data-theme="dark"]']) {
    const palette = {};
    theme.walkRules((rule) => {
      if (!rule.selectors.includes(prefix) || rule.parent.type !== 'root') return;
      rule.walkDecls((decl) => { palette[decl.prop] = decl.value; });
    });
    const material = properties(`${prefix} .is-workspace :is(.ctc-opportunity-card,.ctc-breakdown-document)`);
    const surface = prefix === ':root' ? '#F8EDF3' : palette['--theme-soft-surface'];
    assert.equal(material['--reader-surface'], prefix === ':root' ? '#F8EDF3' : 'var(--theme-soft-surface)');
    for (const key of ['--theme-ink','--theme-text','--theme-soft-muted']) {
      assert.ok(contrast(rgb(palette[key]), rgb(surface)) >= 4.5, `${prefix}: ${key}`);
    }
  }
});
