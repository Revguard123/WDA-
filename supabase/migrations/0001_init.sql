-- Curated Target Contracts: initial schema (Section 2 of the build spec).
-- The UNIQUE (buyer_id, notice_id) constraint on deliveries is the hard
-- never-repeat guarantee: Postgres physically refuses a duplicate for the
-- same buyer even if application logic has a bug.

-- BUYERS: who they are + what they want
create table if not exists buyers (
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  name          text,
  tier          text not null check (tier in ('enlist','deploy')),
  batches_owed  int  not null,            -- 1 for enlist, 6 for deploy
  batches_sent  int  not null default 0,
  -- niche profile (updated freely, never triggers a pull)
  naics         text[] default '{}',
  keywords      text[] default '{}',
  set_asides    text[] default '{}',      -- codes the buyer HOLDS: sb, sdvosb, vosb, wosb, edwosb, 8a, hubzone
  state         text,                     -- or region; place-of-performance match
  size_min      numeric,
  size_max      numeric,
  -- lifecycle
  status        text not null default 'exploring'
                  check (status in ('exploring','active','completed')),
  activated_at  timestamptz,              -- set when Go is pressed = trial start
  next_batch_at timestamptz,              -- when the next monthly batch is due
  access_token  uuid not null default gen_random_uuid(),  -- powers all no-login buyer pages
  created_at    timestamptz not null default now()
);

-- OPPORTUNITIES: cached from SAM.gov
create table if not exists opportunities (
  notice_id          text primary key,     -- SAM.gov canonical id
  solicitation_num   text,                 -- underlying solicitation number (for amended-repost dedupe)
  title              text,
  agency             text,
  naics              text,
  set_aside_type     text,                 -- raw SAM code
  place_of_perf      text,
  response_deadline  timestamptz,
  est_value          numeric,
  sam_url            text,
  description        text,                 -- source text for the AI passes
  raw                jsonb,                -- full API record, keep for later
  fetched_at         timestamptz not null default now()
);

-- DELIVERIES: the memory of what went to whom
create table if not exists deliveries (
  id             uuid primary key default gen_random_uuid(),
  buyer_id       uuid not null references buyers(id),
  notice_id      text not null references opportunities(notice_id),
  batch_month    int  not null,            -- 1..6
  sent_at        timestamptz not null default now(),
  why_line       text,                     -- AI-written, one line
  deep_dive_text text,                     -- AI-written, pre-generated at send time
  unique (buyer_id, notice_id)             -- THE HARD LOCK: no repeats, ever, per buyer
);

create index if not exists deliveries_buyer_id_idx on deliveries (buyer_id);
create index if not exists opportunities_naics_idx on opportunities (naics);
create index if not exists opportunities_solicitation_num_idx on opportunities (solicitation_num);
