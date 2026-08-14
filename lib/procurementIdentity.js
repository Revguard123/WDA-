function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export function normalizeSolicitationNum(value) {
  return clean(value).toUpperCase();
}

export function procurementIdentity(item = {}) {
  const solicitation = normalizeSolicitationNum(item.solicitation_num ?? item.solicitationNumber);
  if (solicitation) return `solicitation:${solicitation}`;
  const notice = clean(item.notice_id ?? item.noticeId);
  return notice ? `notice:${notice}` : '';
}

function timestamp(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

export function opportunityRecency(row = {}) {
  const raw = row.raw || row;
  const modified =
    timestamp(raw.modifiedDate) ??
    timestamp(raw.modified_date) ??
    timestamp(raw.lastModifiedDate) ??
    timestamp(raw.updatedDate) ??
    timestamp(raw.updateDate) ??
    timestamp(raw.postedDate);
  if (modified != null) return { time: modified, field: 'raw.modified/update/posted timestamp' };

  const fetched = timestamp(row.fetched_at);
  if (fetched != null) return { time: fetched, field: 'fetched_at' };

  const deadline = timestamp(row.response_deadline ?? raw.responseDeadLine ?? raw.responseDeadline);
  if (deadline != null) return { time: deadline, field: 'response_deadline' };

  return { time: 0, field: 'notice_id tiebreaker' };
}

export function compareOpportunityVersion(a = {}, b = {}) {
  const ar = opportunityRecency(a);
  const br = opportunityRecency(b);
  if (br.time !== ar.time) return br.time - ar.time;
  const aid = clean(a.notice_id ?? a.noticeId);
  const bid = clean(b.notice_id ?? b.noticeId);
  return bid.localeCompare(aid);
}

export function dedupeOpportunitiesByProcurement(rows = []) {
  const byIdentity = new Map();
  const groups = new Map();
  for (const row of rows || []) {
    const identity = procurementIdentity(row);
    if (!identity) continue;
    if (!groups.has(identity)) groups.set(identity, []);
    groups.get(identity).push(row);
    const existing = byIdentity.get(identity);
    if (!existing || compareOpportunityVersion(existing, row) > 0) {
      byIdentity.set(identity, row);
    }
  }

  const deduped = [];
  const used = new Set();
  for (const row of rows || []) {
    const identity = procurementIdentity(row);
    if (!identity) {
      deduped.push(row);
      continue;
    }
    if (used.has(identity)) continue;
    used.add(identity);
    deduped.push(byIdentity.get(identity));
  }

  const duplicateGroups = [...groups.entries()]
    .filter(([, items]) => items.length > 1)
    .map(([identity, items]) => ({
      identity,
      count: items.length,
      kept_notice_id: clean(byIdentity.get(identity)?.notice_id ?? byIdentity.get(identity)?.noticeId),
      recency_field: opportunityRecency(byIdentity.get(identity)).field,
      removed_notice_ids: items
        .filter((item) => item !== byIdentity.get(identity))
        .map((item) => clean(item.notice_id ?? item.noticeId))
        .filter(Boolean),
    }));

  return {
    rows: deduped,
    stats: {
      input: (rows || []).length,
      output: deduped.length,
      removed: Math.max(0, (rows || []).length - deduped.length),
      duplicateGroups,
    },
  };
}
