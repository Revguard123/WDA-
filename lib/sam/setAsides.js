// Mapping between SAM.gov `typeOfSetAside` codes and the internal set-aside
// values a buyer HOLDS (buyers.set_asides). One buyer status can map to
// several SAM codes (the set-aside and its sole-source variant).
//
// IMPORTANT: SAM.gov's code list is authoritative. Confirm these codes against
// the live docs (open.gsa.gov/api/get-opportunities-public-api/) before going
// to production; the spec calls for this explicitly. The values below match the
// codes SAM currently returns in `typeOfSetAside`.

// internal value -> the SAM codes that satisfy it
export const INTERNAL_TO_SAM = {
  sb: ['SBA', 'SBP'], // Total Small Business (SBA) + Partial Small Business (SBP)
  '8a': ['8A', '8AN'], // 8(a) Set-Aside + 8(a) Sole Source
  hubzone: ['HZC', 'HZS'], // HUBZone Set-Aside + Sole Source
  sdvosb: ['SDVOSBC', 'SDVOSBS'], // Service-Disabled Veteran-Owned SB + Sole Source
  vosb: ['VSA', 'VSS'], // Veteran-Owned SB (VA) Set-Aside + Sole Source
  wosb: ['WOSB', 'WOSBSS'], // Women-Owned SB + Sole Source
  edwosb: ['EDWOSB', 'EDWOSBSS'], // Economically Disadvantaged WOSB + Sole Source
};

// The set of internal values RevGuard/War Dogs recognizes for a buyer.
export const KNOWN_INTERNAL_SET_ASIDES = Object.keys(INTERNAL_TO_SAM);

// reverse lookup: SAM code -> internal value
export const SAM_TO_INTERNAL = Object.entries(INTERNAL_TO_SAM).reduce(
  (acc, [internal, samCodes]) => {
    for (const code of samCodes) acc[code] = internal;
    return acc;
  },
  {},
);

// A contract with no set-aside is full-and-open. SAM leaves the field empty
// (null / '' ) for those.
export function isFullAndOpen(samSetAsideCode) {
  return !samSetAsideCode || String(samSetAsideCode).trim() === '';
}

// Does a buyer holding `heldInternalCodes` qualify for a contract carrying
// `samSetAsideCode`? Full-and-open always qualifies. Otherwise the SAM code
// must map to one of the internal statuses the buyer holds.
export function buyerQualifiesForSetAside(samSetAsideCode, heldInternalCodes = []) {
  if (isFullAndOpen(samSetAsideCode)) return true;
  const internal = SAM_TO_INTERNAL[String(samSetAsideCode).trim()];
  if (!internal) return false; // unknown / restrictive set-aside we can't match -> exclude
  return heldInternalCodes.includes(internal);
}

// Expand a buyer's held internal statuses into the SAM `typeOfSetAside` codes
// we can pass to the API to narrow the query. Full-and-open contracts are not
// covered by this list, so the engine also queries without a set-aside filter.
export function heldToSamCodes(heldInternalCodes = []) {
  const codes = [];
  for (const internal of heldInternalCodes) {
    const samCodes = INTERNAL_TO_SAM[internal];
    if (samCodes) codes.push(...samCodes);
  }
  return codes;
}
