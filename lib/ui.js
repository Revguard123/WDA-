// Shared brand palette for buyer-facing pages. Plain constants so it is safe to
// import from both server and client components.
export const UI = {
  ink: '#14181f',
  panel: '#1b2029',
  gold: '#c5a253',
  paper: '#f4f5f7',
  card: '#ffffff',
  line: '#e2e5ea',
  text: '#2b3038',
  muted: '#6b7280',
  amber: '#b45309',
  green: '#2f6f4f',
};

export const SET_ASIDE_OPTIONS = [
  { value: 'sb', label: 'Small Business' },
  { value: 'sdvosb', label: 'Service-Disabled Veteran-Owned (SDVOSB)' },
  { value: 'vosb', label: 'Veteran-Owned (VOSB)' },
  { value: 'wosb', label: 'Women-Owned (WOSB)' },
  { value: 'edwosb', label: 'Economically Disadvantaged WOSB (EDWOSB)' },
  { value: '8a', label: '8(a)' },
  { value: 'hubzone', label: 'HUBZone' },
];
