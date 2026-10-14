import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSearchParams, samSearchPage, samSearchAll, SamApiError } from '../lib/sam/client.js';
import { runDailySamSync, collectSyncSearches, dailySyncRequestLimit, syncAlert } from '../lib/sam/sync.js';
import { runEngineForNiche } from '../lib/sam/engine.js';
import { GET as dailySyncRoute } from '../app/api/cron/sync/route.js';

const now = new Date('2026-10-03T08:00:00Z');
const options = { apiKey: 'fake-key', postedFrom: '01/01/2026', postedTo: '10/03/2026' };
const logger = { info() {}, warn() {} };
const buyers = [{ naics: ['561720', '238210'], state: null, status: 'active', batches_sent: 1, batches_owed: 6, next_batch_at: '2026-10-03' }];
const quota = { code: '900804', message: 'Message throttled out', description: 'You have exceeded your quota.', nextAccessTime: '2026-Oct-04 00:00:00+0000 UTC' };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
const empty = () => json({ totalRecords: 0, opportunitiesData: [] });
const record = { noticeId: 'cache-one', title: 'Cleaning', naicsCode: '561720', type: 'Solicitation', responseDeadLine: '2026-11-01', description: 'cleaning', typeOfSetAside: '' };

for (const state of [undefined, null, '', '   ', '\t\n']) {
  test(`blank state ${JSON.stringify(state)} is omitted`, () => {
    const params = buildSearchParams({ ...options, state });
    assert.equal(params.has('state'), false);
    assert.equal(params.toString().includes('state='), false);
  });
}
test('valid state normalizes case/whitespace and malformed explicit states fail closed', () => {
  for (const state of ['FL', 'fl', ' FL ']) assert.equal(buildSearchParams({ ...options, state }).get('state'), 'FL');
  for (const state of ['Florida', '+', 'F', 'F1']) assert.throws(() => buildSearchParams({ ...options, state }), /Invalid SAM state/);
});

test('SAM boundary preserves structured quota metadata without exposing API keys or payload', async () => {
  await assert.rejects(samSearchPage(options, { fetchImpl: async () => json(quota, 429) }), (err) => {
    assert.ok(err instanceof SamApiError);
    assert.equal(err.quotaExhausted, true);
    assert.equal(err.status, 429);
    assert.equal(err.code, '900804');
    assert.equal(err.nextAccessTime, quota.nextAccessTime);
    assert.equal(err.message.includes('fake-key'), false);
    return true;
  });
});

test('ordinary 429/HTTP/network errors do not imply quota exhaustion', async () => {
  for (const status of [429, 500, 401]) {
    await assert.rejects(samSearchPage(options, { fetchImpl: async () => json({ message: 'Temporary error' }, status) }), (err) => err instanceof SamApiError && !err.quotaExhausted);
  }
  await assert.rejects(samSearchPage(options, { fetchImpl: async () => { throw new Error('network unavailable'); } }), /network request failed/);
});

test('quota exhaustion preserves earlier cache writes, stops calls, skips remaining jobs and does not mutate buyers', async () => {
  const snapshot = structuredClone(buyers);
  let calls = 0;
  const persisted = [];
  const logs = [];
  const result = await runDailySamSync(buyers, {
    apiKey: 'fake-key', maxRequests: 20, now,
    upsert: async (rows) => { persisted.push(...rows); return rows.length; },
    fetchImpl: async () => ++calls === 1 ? json({ totalRecords: 1, opportunitiesData: [record] }) : json(quota, 429),
    logger: { info: (entry) => logs.push(entry), warn: (entry) => logs.push(entry) },
  });
  assert.equal(calls, 2);
  assert.equal(persisted.length, 1);
  assert.equal(result.upserted, 1);
  assert.equal(result.successful_count, 1);
  assert.equal(result.failed_count, 1);
  assert.equal(result.attempted_count, 2);
  assert.equal(result.skipped_due_to_quota_count, 2);
  assert.equal(result.quota_exhausted, true);
  assert.equal(result.next_access_time, quota.nextAccessTime);
  assert.deepEqual(buyers, snapshot);
  assert.equal(logs.filter((r) => r.event === 'sam_quota_exhausted').length, 1);
  const alert = syncAlert(result);
  assert.match(alert.subject, /quota exhausted/);
  assert.match(alert.summary, /1 searches completed, 1 failed, 2 skipped/);
  assert.ok(alert.rows.some((r) => r.includes(quota.nextAccessTime)));
});

test('equivalent searches run once, distinct geography and notice types remain separate', async () => {
  const input = [
    { naics: ['561720', ' 561720 '], state: 'fl' },
    { naics: ['561720'], state: ' FL ' },
    { naics: ['561720'], state: ' ' },
    { naics: ['561720'], state: null },
    { naics: ['561720'], state: 'TX' },
  ];
  const urls = [];
  const result = await runDailySamSync(input, { apiKey: 'fake-key', maxRequests: 10, now, logger, fetchImpl: async (url) => { urls.push(new URL(url)); return empty(); } });
  assert.equal(urls.length, 6);
  assert.equal(new Set(urls.map((url) => url.search)).size, 6);
  assert.equal(result.duplicate_searches_removed, 6);
  assert.ok(urls.every((url) => !url.toString().includes('state=++')));
});

test('ordinary failure continues subsequent searches and retains bounded alert details', async () => {
  let calls = 0;
  const result = await runDailySamSync(buyers, { apiKey: 'fake-key', maxRequests: 10, now, logger,
    fetchImpl: async () => ++calls === 1 ? json({ message: 'Temporary error' }, 429) : empty(),
  });
  assert.equal(calls, 4);
  assert.equal(result.quota_exhausted, false);
  assert.equal(result.successful_count, 3);
  assert.equal(result.failed_count, 1);
  assert.ok(syncAlert(result));
});

test('unconfigured/zero warming budget makes no network calls', async () => {
  const result = await runDailySamSync(buyers, { now, logger, fetchImpl: () => { throw new Error('Must not call SAM'); } });
  assert.equal(result.request_count, 0);
  assert.equal(result.skipped_due_to_budget_count, 4);
  assert.equal(dailySyncRequestLimit(undefined), 0);
  for (const value of ['bad', '-1', '1.5', Infinity]) assert.equal(dailySyncRequestLimit(value), 0);
});

for (const [value, reason] of [[undefined, 'missing'], ['', 'blank'], ['   ', 'blank'], ['0', 'zero'], ['-1', 'invalid_configuration'], ['bad', 'invalid_configuration']]) {
  test(`disabled/invalid budget ${JSON.stringify(value)} emits one warning and makes zero SAM calls`, async () => {
    let calls = 0;
    const warnings = [];
    const result = await runDailySamSync(buyers, { maxRequests: value, now,
      fetchImpl: async () => { calls++; throw new Error('Must not call'); },
      upsert: async () => { throw new Error('Must not persist'); },
      logger: { info() {}, warn: (entry) => warnings.push(entry) },
    });
    assert.equal(calls, 0);
    assert.equal(result.request_count, 0);
    assert.equal(result.warming_status, 'disabled');
    assert.equal(result.disabled_reason, reason);
    assert.equal(result.skipped_due_to_budget_count, 4);
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].event, 'sam_sync_warming_disabled');
    assert.equal(warnings[0].reason, reason);
  });
}

test('actual daily cron returns a clear disabled status for missing/invalid budgets before dependencies run', async () => {
  const oldBudget = process.env.SAM_DAILY_SYNC_MAX_REQUESTS;
  const oldSecret = process.env.CRON_SECRET;
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  const originalInfo = console.info;
  let calls = 0;
  const warnings = [];
  try {
    process.env.CRON_SECRET = 'fixture-cron-secret';
    globalThis.fetch = async () => { calls++; throw new Error('Must not access any network dependency'); };
    console.warn = (entry) => warnings.push(entry);
    console.info = () => {};
    for (const value of [undefined, '', '0', '-1', 'bad']) {
      if (value === undefined) delete process.env.SAM_DAILY_SYNC_MAX_REQUESTS;
      else process.env.SAM_DAILY_SYNC_MAX_REQUESTS = value;
      const response = await dailySyncRoute(new Request('https://fixture.test/api/cron/sync', { headers: { authorization: 'Bearer fixture-cron-secret' } }));
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.equal(result.warming_status, 'disabled');
      assert.equal(result.request_count, 0);
      // Activation/monthly share this engine. The warmer's configuration must
      // never prevent its default live searches, even under invalid budgets.
      let studentRequests = 0;
      await runEngineForNiche({ naics: ['561720'], state: 'FL' }, {
        apiKey: 'fake-key', now,
        fetchImpl: async () => { studentRequests++; return empty(); },
      });
      assert.equal(studentRequests, 2);
    }
    assert.equal(calls, 0);
    assert.equal(warnings.length, 5);
    assert.ok(warnings.every((entry) => entry.event === 'sam_sync_warming_disabled'));
  } finally {
    if (oldBudget === undefined) delete process.env.SAM_DAILY_SYNC_MAX_REQUESTS;
    else process.env.SAM_DAILY_SYNC_MAX_REQUESTS = oldBudget;
    if (oldSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = oldSecret;
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
    console.info = originalInfo;
  }
});

test('warming request budget counts pagination and prevents subsequent page/search calls', async () => {
  let calls = 0;
  const result = await runDailySamSync(buyers, { apiKey: 'fake-key', maxRequests: 2, now, logger,
    fetchImpl: async () => { calls += 1; return json({ totalRecords: 10, opportunitiesData: [record] }); },
  });
  assert.equal(calls, 2);
  assert.equal(result.request_count, 2);
  assert.equal(result.skipped_due_to_budget_count, 4);
  assert.equal(result.failed_count, 0);
});

test('quota on a later page rejects without retrying that page', async () => {
  let calls = 0;
  await assert.rejects(samSearchAll(options, { fetchImpl: async () => ++calls === 1 ? json({ totalRecords: 10, opportunitiesData: [record] }) : json(quota, 429) }), (err) => err.quotaExhausted);
  assert.equal(calls, 2);
});

test('malformed search input is reported and does not issue a broadened request', async () => {
  const { jobs, invalid } = collectSyncSearches([{ naics: ['561720'], state: 'Florida' }]);
  assert.equal(jobs.length, 0);
  assert.equal(invalid.length, 1);
  let calls = 0;
  await assert.rejects(runEngineForNiche({ naics: ['561720'], state: 'Florida' }, { apiKey: 'fake-key', fetchImpl: async () => { calls++; return empty(); } }), /Invalid SAM state/);
  assert.equal(calls, 0);
});

test('student engine retains both notice types and its normal search allowance', async () => {
  const urls = [];
  await runEngineForNiche({ naics: ['561720'], state: 'fl' }, { apiKey: 'fake-key', now, fetchImpl: async (url) => { urls.push(new URL(url)); return empty(); } });
  assert.deepEqual(urls.map((u) => u.searchParams.get('ptype')), ['o', 'k']);
  assert.ok(urls.every((u) => u.searchParams.get('state') === 'FL'));
});

test('network and persistence failures are classified separately with safe diagnostics', async () => {
  for (const failure of ['network_error', 'persistence_error']) {
    const result = await runDailySamSync([{ naics: ['561720'] }], {
      apiKey: 'fake-key', maxRequests: 2, now, logger,
      fetchImpl: async () => {
        if (failure === 'network_error') throw new Error('https://example.test?api_key=fake-key');
        return json({ totalRecords: 1, opportunitiesData: [record] });
      },
      upsert: async () => { throw new Error('private database diagnostic'); },
    });
    assert.ok(result.results.every((r) => r.failure_type === failure));
    assert.equal(JSON.stringify(result).includes('fake-key'), false);
    assert.equal(JSON.stringify(syncAlert(result)).includes('private database'), false);
  }
});
