// A representative sample of SAM.gov v2 `opportunitiesData` records for the
// janitorial niche (NAICS 561720), crafted to exercise every engine filter.
// Deadlines are absolute; tests pass FIXED_NOW so the runway math is
// deterministic.
//
// The `_ptype` field is TEST METADATA only (the notice-type letter). Real SAM
// records do not include it; the mock fetch uses it to emulate SAM's ptype
// query filter. The engine and mapper ignore unknown fields.

export const FIXED_NOW = new Date('2026-07-15T00:00:00Z');

export const SAMPLE_RECORDS = [
  {
    // KEPT candidate, but superseded by its amended repost (R7) via solnum dedupe.
    _ptype: 'o',
    noticeId: 'N-0001',
    solicitationNumber: 'SP-JAN-001',
    title: 'Janitorial Services, Federal Building (original)',
    fullParentPathName: 'GENERAL SERVICES ADMINISTRATION.PBS',
    naicsCode: '561720',
    typeOfSetAside: 'SDVOSBC',
    placeOfPerformance: { city: { name: 'Columbia' }, state: { code: 'SC', name: 'South Carolina' } },
    responseDeadLine: '2026-08-15T17:00:00-04:00',
    postedDate: '2026-07-01',
    uiLink: 'https://sam.gov/opp/N-0001/view',
    description: 'Recurring janitorial services for a federal office building in Columbia, SC.',
  },
  {
    // KEPT: full-and-open, healthy runway, in-state.
    _ptype: 'k',
    noticeId: 'N-0002',
    solicitationNumber: 'SP-JAN-002',
    title: 'Custodial Services, VA Clinic',
    fullParentPathName: 'VETERANS AFFAIRS, DEPARTMENT OF.VHA',
    naicsCode: '561720',
    typeOfSetAside: '',
    placeOfPerformance: { city: { name: 'Charleston' }, state: { code: 'SC', name: 'South Carolina' } },
    responseDeadLine: '2026-08-29T15:00:00-04:00',
    postedDate: '2026-07-05',
    uiLink: 'https://sam.gov/opp/N-0002/view',
    description: 'Day porter and custodial services for an outpatient clinic.',
  },
  {
    // DROPPED: WOSB set-aside, buyer holds only SDVOSB.
    _ptype: 'o',
    noticeId: 'N-0003',
    solicitationNumber: 'SP-JAN-003',
    title: 'Janitorial, Courthouse (WOSB)',
    fullParentPathName: 'JUSTICE, DEPARTMENT OF',
    naicsCode: '561720',
    typeOfSetAside: 'WOSB',
    placeOfPerformance: { city: { name: 'Greenville' }, state: { code: 'SC', name: 'South Carolina' } },
    responseDeadLine: '2026-08-15T17:00:00-04:00',
    postedDate: '2026-07-03',
    uiLink: 'https://sam.gov/opp/N-0003/view',
    description: 'Women-owned small business set-aside.',
  },
  {
    // DROPPED: tight runway (due in 2 days).
    _ptype: 'o',
    noticeId: 'N-0004',
    solicitationNumber: 'SP-JAN-004',
    title: 'Emergency Cleaning (tight deadline)',
    fullParentPathName: 'GENERAL SERVICES ADMINISTRATION.PBS',
    naicsCode: '561720',
    typeOfSetAside: 'SDVOSBC',
    placeOfPerformance: { city: { name: 'Columbia' }, state: { code: 'SC', name: 'South Carolina' } },
    responseDeadLine: '2026-07-17T12:00:00-04:00',
    postedDate: '2026-07-10',
    uiLink: 'https://sam.gov/opp/N-0004/view',
    description: 'Short-fuse solicitation.',
  },
  {
    // DROPPED: already closed.
    _ptype: 'o',
    noticeId: 'N-0005',
    solicitationNumber: 'SP-JAN-005',
    title: 'Janitorial (closed)',
    fullParentPathName: 'GENERAL SERVICES ADMINISTRATION.PBS',
    naicsCode: '561720',
    typeOfSetAside: 'SDVOSBC',
    placeOfPerformance: { city: { name: 'Columbia' }, state: { code: 'SC', name: 'South Carolina' } },
    responseDeadLine: '2026-07-10T12:00:00-04:00',
    postedDate: '2026-06-10',
    uiLink: 'https://sam.gov/opp/N-0005/view',
    description: 'Past due.',
  },
  {
    // DROPPED: geography (place of performance is North Carolina).
    _ptype: 'o',
    noticeId: 'N-0006',
    solicitationNumber: 'SP-JAN-006',
    title: 'Janitorial, Federal Annex (NC)',
    fullParentPathName: 'GENERAL SERVICES ADMINISTRATION.PBS',
    naicsCode: '561720',
    typeOfSetAside: 'SDVOSBC',
    placeOfPerformance: { city: { name: 'Charlotte' }, state: { code: 'NC', name: 'North Carolina' } },
    responseDeadLine: '2026-08-15T17:00:00-04:00',
    postedDate: '2026-07-06',
    uiLink: 'https://sam.gov/opp/N-0006/view',
    description: 'Out of the buyer service area.',
  },
  {
    // KEPT: amended repost of SP-JAN-001, posted later -> supersedes N-0001.
    _ptype: 'o',
    noticeId: 'N-0007',
    solicitationNumber: 'SP-JAN-001',
    title: 'Janitorial Services, Federal Building (amended)',
    fullParentPathName: 'GENERAL SERVICES ADMINISTRATION.PBS',
    naicsCode: '561720',
    typeOfSetAside: 'SDVOSBC',
    placeOfPerformance: { city: { name: 'Columbia' }, state: { code: 'SC', name: 'South Carolina' } },
    responseDeadLine: '2026-09-01T17:00:00-04:00',
    postedDate: '2026-07-10',
    uiLink: 'https://sam.gov/opp/N-0007/view',
    description: 'Amendment 0001, deadline extended.',
  },
  {
    // Excluded at the query layer: sources-sought ('r') is never requested.
    _ptype: 'r',
    noticeId: 'N-0008',
    solicitationNumber: 'SP-JAN-008',
    title: 'Sources Sought, Janitorial',
    fullParentPathName: 'GENERAL SERVICES ADMINISTRATION.PBS',
    naicsCode: '561720',
    typeOfSetAside: 'SDVOSBC',
    placeOfPerformance: { city: { name: 'Columbia' }, state: { code: 'SC', name: 'South Carolina' } },
    responseDeadLine: '2026-08-20T17:00:00-04:00',
    postedDate: '2026-07-02',
    uiLink: 'https://sam.gov/opp/N-0008/view',
    description: 'Market research only.',
  },
];

// Build a fetch() stand-in that emulates the SAM search endpoint against the
// fixture. It honors the documented ncode and ptype query params (as SAM does) but not
// state, so the engine's in-code geography filter is exercised. Description
// fields here are plain text, so resolveDescriptionText never calls out.
export function makeMockSamFetch(records = SAMPLE_RECORDS) {
  return async function mockFetch(url) {
    const u = new URL(url);
    const naics = u.searchParams.get('ncode') || u.searchParams.get('naicsCode');
    const ptype = u.searchParams.get('ptype');
    const limit = Number(u.searchParams.get('limit')) || 1000;
    const offset = Number(u.searchParams.get('offset')) || 0;

    const matched = records.filter(
      (r) => (!naics || r.naicsCode === naics) && (!ptype || r._ptype === ptype),
    );
    const page = matched.slice(offset, offset + limit);

    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      async json() {
        return { totalRecords: matched.length, limit, offset, opportunitiesData: page };
      },
      async text() {
        return JSON.stringify({ totalRecords: matched.length, opportunitiesData: page });
      },
    };
  };
}
