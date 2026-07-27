// Map one raw SAM.gov v2 opportunity record into an `opportunities` row.
// Field names follow the v2 `opportunitiesData[]` shape. The full record is
// preserved in `raw` so later slices can read fields we did not surface.

// Compose the agency string from SAM's parent-path hierarchy, falling back to
// the discrete department/office fields.
function deriveAgency(rec) {
  if (rec.fullParentPathName) {
    // e.g. "HOMELAND SECURITY, DEPARTMENT OF.CUSTOMS AND BORDER PROTECTION"
    return String(rec.fullParentPathName).split('.').map((s) => s.trim()).filter(Boolean).join(' / ');
  }
  return [rec.department, rec.subTier, rec.office].filter(Boolean).join(' / ') || null;
}

// Flatten SAM's nested placeOfPerformance into "City, ST" (best-effort).
function derivePlaceOfPerformance(rec) {
  const p = rec.placeOfPerformance;
  if (!p) return null;
  const city = p.city?.name || p.city || null;
  const stateName = p.state?.name || p.state?.code || p.state || null;
  const parts = [city, stateName].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

// The place-of-performance state CODE (e.g. "SC"), used for geography filtering.
export function derivePlaceOfPerformanceStateCode(rec) {
  const p = rec.placeOfPerformance;
  if (!p) return null;
  return p.state?.code || (typeof p.state === 'string' ? p.state : null) || null;
}

// Single NAICS. SAM may return `naicsCode` (string) or `naicsCodes` (array).
function deriveNaics(rec) {
  if (rec.naicsCode) return String(rec.naicsCode);
  if (Array.isArray(rec.naicsCodes) && rec.naicsCodes.length) {
    const first = rec.naicsCodes[0];
    return String(first?.code || first);
  }
  return null;
}

// Estimated / awarded value, when present. New solicitations rarely carry one;
// null is expected and is allowed through the size-band filter downstream.
function deriveEstValue(rec) {
  const raw = rec.award?.amount ?? rec.estimatedValue ?? rec.value ?? null;
  if (raw == null) return null;
  const num = Number(String(raw).replace(/[^0-9.]/g, ''));
  return Number.isFinite(num) ? num : null;
}

// Parse SAM's responseDeadLine into a Date (or null). SAM returns ISO-ish
// strings, sometimes without a timezone.
export function parseDeadline(rec) {
  const raw = rec.responseDeadLine || rec.responseDeadline || null;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

// The canonical SAM UI link for the notice.
function deriveSamUrl(rec) {
  if (rec.uiLink) return rec.uiLink;
  if (rec.noticeId) return `https://sam.gov/opp/${rec.noticeId}/view`;
  return null;
}

// Map a raw record -> opportunities row. `description` is left as the raw field
// (often a URL); the engine resolves it to text via resolveDescriptionText.
export function mapRecordToRow(rec, { descriptionText } = {}) {
  const deadline = parseDeadline(rec);
  return {
    notice_id: rec.noticeId != null ? String(rec.noticeId) : null,
    solicitation_num: rec.solicitationNumber ? String(rec.solicitationNumber) : null,
    title: rec.title || null,
    agency: deriveAgency(rec),
    naics: deriveNaics(rec),
    set_aside_type: rec.typeOfSetAside || null,
    place_of_perf: derivePlaceOfPerformance(rec),
    response_deadline: deadline ? deadline.toISOString() : null,
    est_value: deriveEstValue(rec),
    sam_url: deriveSamUrl(rec),
    description: descriptionText != null ? descriptionText : (rec.description || null),
    raw: rec,
  };
}
