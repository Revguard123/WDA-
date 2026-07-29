// Shared brand palette for buyer-facing pages. Plain constants so it is safe to
// import from both server and client components.
//
// Brand system (War Dogs Academy capability-statement standards):
//   pink #F52EA9 is the hero accent (used sparingly), orange #FF9F58 carries
//   structural rules and section bars, near-black ink for type, warm cream and
//   white surfaces. Legacy keys (gold, green, amber) are kept and remapped onto
//   the new palette so existing pages recolor without a rewrite.
export const UI = {
  ink: '#1a1a1a',
  pink: '#f52ea9',
  pinkDeep: '#c81e86',
  orange: '#ff9f58',
  orangeDeep: '#c05f0e',
  paper: '#f8f4ec',
  panel: '#f3ede2',
  card: '#ffffff',
  line: '#e5e0da',
  text: '#2b2926',
  muted: '#7a7570',
  // Legacy aliases (remapped onto the new palette).
  gold: '#ff9f58',
  green: '#c05f0e',
  amber: '#c05f0e',
};

// Font stacks. Zuume Rough (the logo face) is loaded via @font-face in the root
// layout for display headings; body copy stays on a system stack.
export const DISPLAY_FONT = "'Zuume Rough', 'Arial Black', 'Helvetica Neue', Helvetica, Arial, sans-serif";
export const BODY_FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export const SET_ASIDE_OPTIONS = [
  { value: 'sb', label: 'Small Business' },
  { value: 'sdvosb', label: 'Service-Disabled Veteran-Owned (SDVOSB)' },
  { value: 'vosb', label: 'Veteran-Owned (VOSB)' },
  { value: 'wosb', label: 'Women-Owned (WOSB)' },
  { value: 'edwosb', label: 'Economically Disadvantaged WOSB (EDWOSB)' },
  { value: '8a', label: '8(a)' },
  { value: 'hubzone', label: 'HUBZone' },
];
