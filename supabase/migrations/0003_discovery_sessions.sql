-- War Dogs Playbook Discovery Phase B: resumable questionnaire sessions.
-- Additive only. Do not apply to a shared/production database until reviewed.

create table if not exists discovery_sessions (
  id                      uuid primary key default gen_random_uuid(),
  buyer_id                uuid not null references buyers(id) on delete cascade,
  answers                 jsonb not null default '{}'::jsonb,
  normalized_profile      jsonb not null default '{}'::jsonb,
  status                  text not null default 'in_progress'
                            check (status in ('in_progress','recommended','selected')),
  current_step            int not null default 1,
  recommendations         jsonb,
  selected_recommendation jsonb,
  playbook_version        text not null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (buyer_id)
);
