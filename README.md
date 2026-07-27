# Curated Target Contracts

War Dogs Academy. A system that, each month, pulls live federal contract
opportunities from SAM.gov, matches them to each buyer's niche, auto-curates the
best five with an AI disqualification pass, and emails a branded brief. Buyers
never log in: delivery is email, and every deeper view (full analysis, history,
targeting) is reached through a private tokenized link.

This repository is being built slice by slice per the build spec. **Slice 1 (the
SAM.gov engine) is complete and proven** in this build. The remaining slices
(matching / AI curation, delivery, buyer pages, activation, Kajabi wiring,
scheduling) are scaffolded to follow.

> Copy convention: no long dash characters anywhere in code, copy, or generated
> content. Use periods, commas, colons, parentheses, or hyphens.

## Stack

- Next.js on Vercel (buyer pages, API routes, Vercel Cron), App Router.
- Supabase (Postgres) for data.
- SAM.gov Get Opportunities API v2 for the opportunities feed (no scraping).
- Claude API for the disqualification pass, why-line, and deep-dive (later slices).
- Resend for branded email (later slices).
- Kajabi + Zapier for access and billing (later slices).

## What Slice 1 does

`lib/sam/engine.js#runEngineForNiche` takes a buyer niche and:

1. Queries SAM.gov once per (NAICS, live notice type), pulling only Solicitation
   (`o`) and Combined Synopsis/Solicitation (`k`) notices. Sources-sought (`r`)
   and RFIs are excluded at the query layer.
2. Dedupes by `notice_id` and by `solicitation_num` (amended reposts: the
   later-posted notice wins).
3. Filters out contracts that are already closed, due sooner than the minimum
   runway (default 14 days), set aside for a status the buyer does not hold
   (full-and-open always qualifies), or whose place of performance is outside
   the buyer's state.
4. Resolves each survivor's description text (the source for the AI passes).
5. Upserts the matches into the `opportunities` cache, keyed on `notice_id`.

Set-aside enforcement is toggleable (`enforceSetAside`): the per-niche proof
enforces it so the output shows only pursuable contracts; the broad daily sync
(Slice 7) can relax it so the shared cache stays wide, with Slice 2 acting as the
authoritative per-buyer set-aside filter.

## Prove it

No keys or network needed. The mock proof runs the full engine against a fixture
that exercises every filter path:

```bash
npm run prove:slice1
```

Expected: 7 records pulled, deduped to 6, one dropped for each of closed / tight
runway / wrong set-aside / wrong geography, and 2 pursuable contracts kept (a
full-and-open custodial job and the amended repost of the janitorial
solicitation).

Unit tests cover the engine, filters, dedupe, set-aside logic, date formatting,
and param building:

```bash
npm test
```

### Live proof (real SAM.gov)

Get a free public API key from your SAM.gov account (Account Details, request a
public API key), then:

```bash
SAM_API_KEY=xxxx npm run prove:slice1:live
# or a different niche:
SAM_API_KEY=xxxx node scripts/prove-slice1.mjs --naics 236220 --state NC --set-aside 8a
```

The sample niche is the spec's proof niche: NAICS `561720` (janitorial),
set-aside SDVOSB, state `SC`. The live harness is read-only (it does not write to
Supabase). To pull and cache into Supabase, use the API route below.

> Note: the SAM.gov set-aside and notice-type codes in `lib/sam/setAsides.js` and
> `lib/sam/client.js` follow the published docs. SAM's list is authoritative;
> confirm the codes against open.gsa.gov/api/get-opportunities-public-api before
> production, as the spec requires.

## Server surface

`POST /api/engine/sync` runs the engine for a niche and upserts into
`opportunities`. Guarded by `CRON_SECRET`:

```bash
curl -X POST "$APP_BASE_URL/api/engine/sync" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"naics":["561720"],"set_asides":["sdvosb"],"state":"SC"}'
```

## Database

Apply `supabase/migrations/0001_init.sql`. The `UNIQUE (buyer_id, notice_id)`
constraint on `deliveries` is the hard never-repeat guarantee: Postgres refuses a
duplicate for the same buyer even if application logic has a bug.

## Environment

Copy `.env.local.example` to `.env.local` and fill in. Service-role and secret
keys are server-side only and must never reach the browser.

## Layout

```
app/
  layout.js, page.js            # minimal Next.js shell + landing copy
  api/engine/sync/route.js      # Slice 1 server surface (CRON_SECRET guarded)
lib/
  supabase.js                   # server-side Supabase client (lazy, service role)
  opportunities.js              # opportunities cache upsert (+ in-memory helper)
  sam/
    client.js                   # SAM.gov v2 API client (params, paging, description)
    setAsides.js                # SAM code <-> internal set-aside mapping + eligibility
    mapRecord.js                # raw SAM record -> opportunities row
    engine.js                   # runEngineForNiche: the Slice 1 core
scripts/
  prove-slice1.mjs              # proof harness (mock + live)
test/
  engine.test.mjs               # unit tests (node --test)
  fixtures/sam561720.mjs        # sample records + mock SAM fetch
supabase/
  migrations/0001_init.sql      # buyers, opportunities, deliveries
```

## Next slices (not yet built)

2. Matching, disqualification (Claude), ranking, why-line.
3. Delivery: deep-dive generation, Resend email, transactional write + never-repeat guard.
4. Buyer-facing no-login pages (setup, go, dive deeper, history, targeting).
5. Activation (the Go button): trial start, first batch, idempotent.
6. Kajabi and billing wiring (inbound grant webhook, outbound trial start).
7. Scheduling: monthly batch and daily SAM sync (Vercel Cron).
8. QA checklist.
