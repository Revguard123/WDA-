-- New grants: Accelerator = 3 batches, Vanguard = 12 batches.
-- Apply before deploying the new grant handlers. No buyer data is rewritten.
-- Legacy values remain valid for already-provisioned rows so routine profile
-- and monthly accounting updates do not fail. Application grant handlers
-- reject these retired tier names for all new provisioning requests.
begin;
alter table buyers drop constraint if exists buyers_tier_check;
alter table buyers add constraint buyers_tier_check
  check (tier in ('accelerator', 'vanguard', 'enlist', 'deploy'));
commit;
