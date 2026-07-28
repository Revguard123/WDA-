-- One buyer per email. Makes find-or-create race-safe (the app catches 23505
-- and re-reads) and prevents duplicate buyer rows.
alter table buyers add constraint buyers_email_unique unique (email);
