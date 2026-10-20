// A short-lived visual preference, not authentication. Never store email,
// credentials or buyer IDs here. The destination must already be authorized.
export const ACCESS_MOTION_KEY = 'wda:access-reveal';
export const ACCESS_MOTION_TTL = 30000;
export const ACCESS_MOTION_DURATION = 1900;

export function requestAccessMotion(storage, now = Date.now()) {
  try { storage?.setItem(ACCESS_MOTION_KEY, String(now)); } catch { /* Optional enhancement. */ }
}

export function consumeAccessMotion(storage, { workspace = false, reducedMotion = false, now = Date.now() } = {}) {
  try {
    const value = storage?.getItem(ACCESS_MOTION_KEY);
    storage?.removeItem(ACCESS_MOTION_KEY);
    if (!value) return false;
    const age = now - Number(value);
    return workspace && !reducedMotion && Number.isFinite(age) && age >= 0 && age < ACCESS_MOTION_TTL;
  } catch { return false; }
}
