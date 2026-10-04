# Daily SAM cache warming

The daily sync is optional cache warming. Activation and monthly batches still
read the cache first, then search SAM live when the cache pool is below 12 rows.
Cache failure is not evidence of student delivery failure.

## Request ceiling

Set `SAM_DAILY_SYNC_MAX_REQUESTS` in the deployment environment to a non-negative
integer. This counts actual external search requests, including pagination,
per sync invocation. Missing, blank, `0`, negative, non-numeric, and non-integer
values disable warming with zero SAM requests. Each disabled run emits one
`sam_sync_warming_disabled` warning and returns `warming_status: disabled` with
a safe `disabled_reason`. The daily cron bypasses buyer lookup when disabled.
There is no verified SAM quota in this repository, so no
positive default is assumed. Choose the ceiling from the account's verified
allowance and measured activation/monthly/description usage, retaining a reserve
for student work. This is not a global quota accountant or guaranteed reserve.

Each normalized `(NAICS, state, notice type)` search runs once. Separate `o` and
`k` searches remain distinct. Every completed search is persisted immediately;
failure of a later search does not roll back prior cache writes. Incomplete
paginated searches are deferred rather than cached as complete. No student
search record limit or eligibility rule has changed.

The existing default is 1,000 records per notice-type search with a 1,000-record
page size, usually one call per type. Short pages can require more calls; in
the extreme, 1,000 one-record pages per type. The warmer now counts each page
against its ceiling. Confirmed quota exhaustion stops the run without retry.

## Observe after deploy

Look for `sam_sync_complete`, `sam_quota_exhausted`, and
`sam_sync_duplicate_search_removed`. The completion summary includes request
usage, successes, failures, quota/budget skips, and the provider's next access
time. Quota runs produce one ops alert with bounded prior failure details.
Zero-budget skips are normal and do not trigger failure alerts.

After quota reset, an operator may invoke one authenticated sync with an
explicitly small verified budget. Check the summary and cache writes, and
separately verify normal student activation/monthly delivery. Do not run an
unbounded production-style warm as a smoke test.

There is no distributed cron lock in this repository. Concurrent serverless
invocations each have their own ceiling and can multiply total usage; avoid
manual syncs while cron is running. Budget exhaustion always restarts from the
first search next time, so later searches may stay cold until the configured
budget covers them. Student live fallback remains available, subject to the
shared provider quota.

Daily sync writes opportunities only; it never writes buyer batch counters or
schedules. Monthly zero-delivery cycles remain due for retry.
