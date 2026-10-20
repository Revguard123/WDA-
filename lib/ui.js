// Shared brand palette for buyer-facing pages. Plain constants so it is safe to
// import from both server and client components.
//
// Brand system (War Dogs Academy capability-statement standards):
//   pink #F52EA9 is the hero accent (used sparingly), orange #FF9F58 carries
//   structural rules and section bars, near-black ink for type, warm cream and
//   white surfaces. Legacy keys (gold, green, amber) are kept and remapped onto
//   the new palette so existing pages recolor without a rewrite.
export const UI = {
  ink: 'var(--theme-ink, #1a1a1a)',
  pink: '#f52ea9',
  pinkDeep: '#c81e86',
  orange: '#ff9f58',
  orangeDeep: 'var(--theme-orange, #c05f0e)',
  paper: 'var(--theme-paper, #f8f4ec)',
  panel: 'var(--theme-panel, #f3ede2)',
  card: 'var(--theme-surface, #ffffff)',
  line: 'var(--theme-border, #e5e0da)',
  text: 'var(--theme-text, #2b2926)',
  muted: 'var(--theme-muted, #7a7570)',
  // Legacy aliases (remapped onto the new palette).
  gold: '#ff9f58',
  green: '#c05f0e',
  amber: '#c05f0e',
};

// Zuume Rough headings use local OTF assets; Inter body copy and controls
// use next/font/google. Both are configured in the root layout.
export const DISPLAY_FONT = "'Zuume Rough', Impact, 'Arial Narrow', sans-serif";
export const BODY_FONT = "var(--font-inter), Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export const SET_ASIDE_OPTIONS = [
  { value: 'sb', label: 'Small Business' },
  { value: 'sdvosb', label: 'Service-Disabled Veteran-Owned (SDVOSB)' },
  { value: 'vosb', label: 'Veteran-Owned (VOSB)' },
  { value: 'wosb', label: 'Women-Owned (WOSB)' },
  { value: 'edwosb', label: 'Economically Disadvantaged WOSB (EDWOSB)' },
  { value: '8a', label: '8(a)' },
  { value: 'hubzone', label: 'HUBZone' },
];
