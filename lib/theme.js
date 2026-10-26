// Browser preference only. Never tied to the buyer's account or access cookie.
export const THEME_KEY = 'wda:theme';
export function resolveTheme(preference, systemDark = false) {
  return preference === 'light' || preference === 'dark' ? preference : systemDark ? 'dark' : 'light';
}

// Run in the head before page content is painted, including on private routes.
// Keep storage and media-query failures independent: either may be unavailable.
export const THEME_INIT_SCRIPT = `(() => {
  let preference; let systemDark = false;
  try { preference = localStorage.getItem('${THEME_KEY}'); } catch {}
  try { systemDark = matchMedia('(prefers-color-scheme: dark)').matches; } catch {}
  const theme = preference === 'light' || preference === 'dark' ? preference : systemDark ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
})();`;
