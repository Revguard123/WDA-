import test from 'node:test';
import assert from 'node:assert/strict';
import { BUYER_TIER_BATCHES, normalizeBuyerTier, tierForKajabiGrant } from '../lib/buyerTiers.js';
import { createOrGetGrantedBuyer } from '../lib/buyers.js';
import { POST } from '../app/api/kajabi/grant/route.js';
import { GET as adminGrant } from '../app/api/admin/grant/route.js';

function buyerClient({ existing = null, race = false } = {}) {
  const inserted = [];
  let reads = 0;
  return {
    inserted,
    from(table) {
      assert.equal(table, 'buyers');
      let inserting = false;
      const query = {
        select() { return this; },
        eq() { return this; },
        limit() { return this; },
        async maybeSingle() { reads += 1; return { data: race && reads === 1 ? null : existing }; },
        insert(row) { inserting = true; inserted.push(row); return this; },
        async single() {
          if (!inserting) return { data: existing };
          return race ? { error: { code: '23505' } } : { data: { ...inserted.at(-1), batches_sent: 0 } };
        },
      };
      return query;
    },
  };
}

test('only Accelerator and Vanguard are supported for new grants', () => {
  assert.deepEqual(BUYER_TIER_BATCHES, { accelerator: 3, vanguard: 12 });
  assert.equal(normalizeBuyerTier(' ACCELERATOR '), 'accelerator');
  assert.equal(normalizeBuyerTier('VANGUARD'), 'vanguard');
  for (const value of ['muster', 'deploy', 'enlist', 'annual', '', undefined]) {
    assert.equal(normalizeBuyerTier(value), null);
  }
});

test('Kajabi resolves explicit tiers or unambiguous offer/product names without legacy aliases', () => {
  assert.equal(tierForKajabiGrant({ tier: 'ACCELERATOR' }), 'accelerator');
  assert.equal(tierForKajabiGrant({ tier: 'vanguard', offer: 'Accelerator' }), 'vanguard');
  for (const key of ['offer', 'offer_title', 'product', 'product_title']) {
    assert.equal(tierForKajabiGrant({ [key]: 'WDA Vanguard Membership' }), 'vanguard');
    assert.equal(tierForKajabiGrant({ [key]: 'WDA Accelerator Membership' }), 'accelerator');
  }
  for (const body of [{}, { tier: 'deploy', offer: 'Vanguard' }, { offer: 'Muster' },
    { offer: 'Enlist' }, { offer: 'Deploy annual 6 months' }, { offer: 'Accelerator / Vanguard' }]) {
    assert.equal(tierForKajabiGrant(body), null);
  }
});

for (const [tier, batches] of Object.entries(BUYER_TIER_BATCHES)) {
  test(`${tier} grant persists ${batches} batches and starts exploring`, async () => {
    const client = buyerClient();
    const result = await createOrGetGrantedBuyer({ email: 'buyer@example.com', tier: tier.toUpperCase() }, { client });
    assert.equal(result.created, true);
    assert.equal(result.buyer.tier, tier);
    assert.equal(result.buyer.batches_owed, batches);
    assert.equal(result.buyer.batches_sent, 0);
    assert.equal(result.buyer.status, 'exploring');
    assert.deepEqual(Object.keys(client.inserted[0]).sort(), ['batches_owed', 'email', 'name', 'status', 'tier']);
  });
}

test('invalid grants are rejected before database access', async () => {
  for (const tier of ['muster', 'deploy', 'enlist', 'unknown', undefined]) {
    await assert.rejects(createOrGetGrantedBuyer({ email: 'buyer@example.com', tier }, {
      client: { from() { assert.fail('must not access database'); } },
    }), /tier must be accelerator or vanguard/);
  }
});

test('duplicate grants preserve existing entitlement, status and counters, including legacy buyers', async () => {
  for (const tier of ['accelerator', 'vanguard', 'enlist', 'deploy', 'muster']) {
    const existing = { tier, batches_owed: 6, batches_sent: 2, status: 'active' };
    const client = buyerClient({ existing });
    const result = await createOrGetGrantedBuyer({ email: 'buyer@example.com', tier: 'vanguard' }, { client });
    assert.equal(result.created, false);
    assert.strictEqual(result.buyer, existing);
    assert.equal(client.inserted.length, 0);
  }
});

test('a concurrent duplicate grant returns existing buyer without changing entitlement', async () => {
  const existing = { tier: 'accelerator', batches_owed: 3, batches_sent: 1 };
  const client = buyerClient({ existing, race: true });
  const result = await createOrGetGrantedBuyer({ email: 'buyer@example.com', tier: 'vanguard' }, { client });
  assert.equal(result.created, false);
  assert.strictEqual(result.buyer, existing);
});

test('authenticated Kajabi and admin routes reject retired/missing tiers before provisioning', async () => {
  const oldKajabiSecret = process.env.KAJABI_WEBHOOK_SECRET;
  const oldCronSecret = process.env.CRON_SECRET;
  process.env.KAJABI_WEBHOOK_SECRET = 'local-test-secret';
  process.env.CRON_SECRET = 'local-test-secret';
  try {
    for (const tier of ['enlist', 'deploy', 'muster', 'unknown', '']) {
      const response = await POST(new Request('http://localhost/api/kajabi/grant', {
        method: 'POST', headers: { 'x-webhook-secret': 'local-test-secret', 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'buyer@example.com', tier }),
      }));
      assert.equal(response.status, 400);
      assert.equal((await response.json()).error, 'tier must be accelerator or vanguard');
      const adminResponse = await adminGrant(new Request(`http://localhost/api/admin/grant?email=buyer%40example.com&tier=${tier}`, {
        headers: { authorization: 'Bearer local-test-secret' },
      }));
      assert.equal(adminResponse.status, 400);
    }
  } finally {
    if (oldKajabiSecret === undefined) delete process.env.KAJABI_WEBHOOK_SECRET;
    else process.env.KAJABI_WEBHOOK_SECRET = oldKajabiSecret;
    if (oldCronSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = oldCronSecret;
  }
});

test('actual Kajabi route provisions both new entitlements and does not recreate replayed grants', async () => {
  const envKeys = ['KAJABI_WEBHOOK_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'RESEND_API_KEY'];
  const savedEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  const savedFetch = globalThis.fetch;
  const rows = [];
  process.env.KAJABI_WEBHOOK_SECRET = 'local-test-secret';
  process.env.SUPABASE_URL = 'http://grant-test.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'local-test-service-key';
  delete process.env.RESEND_API_KEY;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, 'grant-test.invalid', 'no real database/provider requests');
    assert.equal(url.pathname, '/rest/v1/buyers');
    if (init.method === 'POST') {
      const row = { ...JSON.parse(init.body), id: rows.length + 1,
        access_token: '00000000-0000-0000-0000-000000000001', batches_sent: 0 };
      rows.push(row);
      return Response.json(row, { status: 201 });
    }
    const email = url.searchParams.get('email')?.replace(/^eq\./, '');
    return Response.json(rows.filter((row) => row.email === email));
  };
  const grant = (tier) => POST(new Request('http://localhost/api/kajabi/grant', {
    method: 'POST', headers: { 'x-webhook-secret': 'local-test-secret', 'content-type': 'application/json' },
    body: JSON.stringify({ email: `${tier.toLowerCase()}@example.com`, tier }),
  }));
  try {
    for (const [tier, batches] of Object.entries(BUYER_TIER_BATCHES)) {
      const response = await grant(tier.toUpperCase());
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.created, true);
      assert.equal(body.tier, tier);
      assert.deepEqual(body.email_sent, { skipped: 'RESEND_API_KEY not set' });
      assert.equal(rows.at(-1).batches_owed, batches);
      assert.equal(rows.at(-1).status, 'exploring');
      const replay = await grant(tier);
      assert.equal(replay.status, 200);
      const replayBody = await replay.json();
      assert.equal(replayBody.created, false);
      assert.equal(replayBody.email_sent, null);
    }
    assert.equal(rows.length, 2);
  } finally {
    globalThis.fetch = savedFetch;
    for (const key of envKeys) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
  }
});
