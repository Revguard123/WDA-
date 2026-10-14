# Curated Target Contracts

## Current Product & System Overview

Implementation reference: repository working tree reviewed on October 7, 2026, with the Kajabi-to-Zapier provisioning flow confirmed by the operator. This document does not independently verify production configuration, database migration state, or external automation settings. The historical `curatedtargetcontractssummary.md` remains a separate reference.

### 1. What the product is

War Dogs Academy's Curated Target Contracts (CTC) helps students choose a focused federal contracting lane and find opportunities worth evaluating. It combines a guided Niche Advisor, a shared targeting profile, SAM.gov sourcing, eligibility checks, deterministic ranking, and AI-assisted decision briefs.

The batch pipeline targets up to five strongest eligible opportunities. Five is a selection ceiling, not a guaranteed delivery count. The system can deliver fewer opportunities rather than add ineligible filler. Recommendations and contract briefs support a student's decision; they do not guarantee eligibility, an award, or revenue.

### 2. Customer journey

```text
Kajabi grants customer access
          |
     Zapier workflow
          |
 POST /api/kajabi/grant
          |
 Find/create buyer in Supabase buyers table
          |
     Customer enters CTC portal / welcome link
          |
     Identify buyer
          |
    State-aware routing
          |
   Choose Your Path / resume saved work
          |
     +----+-------------------+
     |                        |
Niche Discovery         Direct Targeting
     |                        |
Select recommendation   Save targeting
     |                        |
     +---- Shared buyer profile
                    |
       Review / confirm targeting
                    |
             Ready to Start
                    |
           Start My Contracts
                    |
      Source, qualify, rank, persist
                    |
     Contracts / future batches / archive
```

New buyers without targeting can choose Discovery or Direct Targeting. Existing targeting opens the shared review experience; qualifying saved Discovery progress can resume instead of starting over. Saving targeting or selecting a niche does not activate the buyer or generate contracts.

### 3. Buyer lifecycle

| Status | Implemented meaning | Normal portal destination |
| --- | --- | --- |
| `exploring` | Provisioned buyer still preparing or confirming targeting; targeting may already be saved. | `/setup/[token]` |
| `active` | Activation started and the account has remaining batch entitlement. An interrupted first activation can temporarily have zero batches sent. | `/contracts/[token]` |
| `completed` | Batch counter has reached the account's entitlement. Existing deliveries remain available. | `/contracts/[token]`, presented as an archive |

Lifecycle fields include `batches_owed`, `batches_sent`, `activated_at`, and `next_batch_at`. Targeting fields alone do not determine active status. Explicit review/update modes let returning buyers revisit targeting without restarting activation.

### 4. Identity and access

CTC stores buyer records in its own database. Each buyer has a UUID `access_token` used by buyer-specific pages and APIs. There is no student password login in this application; possession of the tokenized link provides access to that buyer's experience.

`/portal` identifies an existing buyer by email and redirects according to buyer status. It can accept the email through its form/query string. This is an email lookup, not authenticated Kajabi single sign-on or proof of email ownership.

`/access` provides email-link recovery. Its API sends an access link for an existing buyer when email delivery is configured, but returns a neutral response even when the account is absent or sending fails. It does not create an account. Buyer lookup is case-insensitive at this entry point.

Access links should be treated as private credentials. Full Breakdown lookup additionally checks that the requested notice belongs to a delivery for the identified buyer.

### 5. Targeting profile

Discovery and Direct Targeting converge on the same fields on the `buyers` record.

| Field | Purpose and current behavior |
| --- | --- |
| `naics` | Primary SAM search codes. Direct Targeting UI accepts up to five six-digit codes. Discovery attaches server-resolved codes from the committed official 2022 reference. |
| `keywords` | Array of capabilities/preferences used in match scoring and semantic screening. Keywords are not a SAM search keyword restriction. |
| `set_asides` | Supported statuses the student says they hold: `sb`, `sdvosb`, `vosb`, `wosb`, `edwosb`, `8a`, `hubzone`. |
| `state` | Optional two-letter search/service-area constraint. Blank is stored as null and removes the state restriction. |
| `size_min`, `size_max` | Optional contract-value bounds. Known estimated values outside the bounds are excluded; unknown values are not excluded solely for being unknown. |
| `name` | Optional buyer display/profile information; not a sourcing constraint. |

The profile update helper permits only its defined profile fields. It does not update entitlement, lifecycle status, batch counters, or deliveries.

Targeting is not proof of licenses, certifications, bonding, clearances, staffing, or past performance. Discovery retains richer normalized information in its session, but its buyer handoff copies only the shared targeting fields above, not the entire questionnaire.

### 6. Two targeting paths

#### Discovery

The Niche Advisor collects business context, recommends bounded War Dogs lanes, and allows a student to select a persisted recommendation. Selection writes the shared buyer profile before redirecting to targeting review.

The deterministic handoff uses:

- Official, resolved NAICS codes from the selected recommendation.
- Normalized, deduplicated keywords derived from the student's persisted capabilities and interests. Avoidance text is not used as a positive keyword source; matching avoided phrases are excluded by the handoff's text checks.
- Supported, normalized set-asides from Discovery.
- The selected state for `single_state`; an explicit state clear for nationwide and the other non-single-state modes.
- Normalized size bounds, including explicit clearing of stale bounds when the answer is blank/null.

Unrelated buyer fields are not overwritten. Selection alone leaves lifecycle and batch accounting unchanged.

#### Direct Targeting

The existing form lets students search for NAICS suggestions, choose/remove codes, or enter six-digit codes manually. They can edit keywords, set-asides, service area, and contract size. The NAICS suggestion helper is separate from bounded Playbook recommendations; manual entry is format-checked rather than subject to the same Discovery mapping-resolution process.

Edits remain local while typing and persist on form submission. Contract-size values are not currency-formatted on each keystroke. Direct Targeting saves the same buyer profile without creating deliveries or activating the account.

### 7. Niche Discovery system

#### Structured information, conversational collection

The current student-facing Discovery form is conversational, rather than the historical four-question form. It collects structured dimensions covering capabilities, products/services, fulfillment, experience, qualifications, set-asides, geography, operating model, contract scale, and interests/avoidances.

The server owns the pending question and resolved dimensions. It checks question identity, rejects stale submissions, reconstructs accepted state from saved answers/transcript, and decides when enough dimensions are resolved. Claude cannot end the questionnaire merely by declaring it complete while server-required information remains unresolved.

Suggestion controls help draft an answer; the student must submit it. Editing a previous answer rebuilds downstream state and clears obsolete recommendations. New chat resets the current Discovery session rather than creating a new buyer or changing activation.

#### Persistence and recovery

`discovery_sessions` stores one session per buyer: answers, normalized profile, conversation state, progress, recommendations, selected recommendation, and Playbook version. Session states are `in_progress`, `recommended`, and `selected`.

Accepted conversation answers are saved independently of final recommendation generation. Returning students can resume persisted work. If recommendation generation fails after answers were saved, the UI provides a recommendation retry rather than requiring the questionnaire again. Customer-facing Discovery failures use readable messages instead of exposing parser/provider error text.

Deterministic question fallbacks support conversation continuity when advisor output is unusable. They are not a fallback to the legacy free-form `discoverNiches()` recommendation function.

#### Canonical War Dogs knowledge and official NAICS

The committed Playbook contains 13 industries and 130 subindustries with canonical IDs, descriptions, and broker guidance. The application imports this JSON and the NAICS reference/map statically on the server. It does not parse a workbook at runtime.

The official reference supplies six-digit 2022 Census NAICS codes and titles. The separate subindustry map classifies mappings as `direct`, `multi_code`, `context_dependent`, or `needs_review`. Mapping review status is `machine_proposed`; official code/title validation must not be confused with human approval of every subindustry mapping.

#### Bounded ranking and server controls

```text
Normalized profile
    -> canonical War Dogs candidates
    -> deterministic preselection (up to 25; needs-review excluded)
    -> Claude compact ranking (at most 8 accepted canonical IDs)
    -> server fit and mapping checks
    -> adaptive clarification when needed
    -> official NAICS resolution and current-supply checks
    -> up to 3 visible recommendations
    -> final explanation enrichment / server fallback text
```

Preselection uses text signals and structured product/service, operating-model, and qualification information. Claude ranks only supplied candidates and returns qualitative fit fields. It cannot supply new niches, NAICS codes, or official titles. The adapter filters unknown/repeated IDs and caps accepted rankings at eight; the engine validates the resulting canonical IDs and fit fields.

Core weak-fit candidates are not retained as strong recommendations. Context-dependent NAICS mappings use server-defined adaptive questions and resolvers, with at most three clarification rounds and one question per round. Unresolved mappings are not silently promoted to authoritative codes.

The normal visible list excludes candidates with no current eligible supply and suppresses substantially overlapping NAICS recommendations. If that list is empty, the engine can retain one conservative canonical starting lane with resolved official NAICS and moderate fit. That starting lane can still have a no-current-supply status; it is not a promise of immediate contracts.

#### Feedability and explanation content

Feedability checks cached opportunities first, then live SAM when necessary. Cached rows pass the shared hard filters, including size bounds and a 14-day runway. The live engine enforces NAICS search, geography, set-asides, and runway, but does not apply size bounds to its returned supply count. Results distinguish sufficient current supply (at least five), thin supply (one to four), no current supply, and unknown supply when checking fails. Identical checks are memoized within the recommendation run.

These are current sourcing/eligibility snapshots, not guarantees of future monthly volume or final size-filtered, AI-qualified delivery counts.

The final explanation request is limited to at most three server-selected recommendations. Its schema allows qualitative explanations, strengths, risks, and validation questions, not NAICS. The engine checks returned IDs against the final allowed set before applying enrichment. The current adapter has an array-name mismatch described in section 21, so generated enrichment must not be assumed to appear; server fallback explanations remain available.

Ranking and explanation calls use native Anthropic JSON-schema structured output. Output-limit stop reasons reject partial JSON rather than repairing it manually; malformed/truncated output allows at most one parsing retry per call. Metadata diagnostics include stage, counts, stop reason, token usage, configured output budget, and response length rather than full prompts or responses.

### 8. Review and activation

The shared setup/review page presents the saved targeting and, where applicable, the selected Discovery lane. Editable review and update modes use the existing targeting form; review-only mode displays targeting without editing. The separate `/start/[token]` page summarizes the profile and exposes **Start My Contracts**.

Activation requires a saved nonempty NAICS array. It conditionally claims an exploring buyer, records activation/scheduling fields, and runs the shared batch pipeline. Repeated activation of an already delivered account returns its existing state rather than intentionally creating another first batch. Recovery handles an active account whose first batch accounting is incomplete and can reconcile already persisted deliveries.

If the first run inserts no new deliveries and there is no existing delivery history, activation restores the exploring state and returns a retryable no-match outcome. It does not consume a batch. Provider/persistence failures follow an error/recovery path rather than being treated as successful empty deliveries.

These protections are application-level safeguards plus database uniqueness, not a blanket distributed exactly-once guarantee for all overlapping requests.

### 9. Contract sourcing from SAM.gov

#### Search boundary

The client uses the SAM.gov public opportunities v2 search API. Searches are per NAICS and live notice type, using `ncode` for NAICS and an optional place-of-performance state. The included types are Solicitation (`o`) and Combined Synopsis/Solicitation (`k`), not sources-sought, award notices, or presolicitations.

The engine defaults to a 364-day posting window and up to 1,000 records per NAICS/type search. The client supports offset pagination within the configured record cap; each actual HTTP page request consumes provider quota.

Searches do not apply an exact set-aside query filter. Eligibility is evaluated in code so full-and-open opportunities remain available alongside eligible reserved work.

#### Geography and eligibility

Blank/whitespace search state normalizes to no state parameter. A malformed nonblank search state fails instead of silently broadening to nationwide.

For a selected state, the downstream geography check accepts a matching place-of-performance state or explicitly nationwide work. It rejects clear state mismatches and unknown geography. The batch pipeline does not remove the chosen state to fill a batch. Nationwide targeting removes the state restriction; it does not mean the opportunity itself must be marked nationwide.

Full-and-open contracts are eligible regardless of selected set-asides. Supported certification hierarchy expands eligibility: recognized reserved statuses imply Small Business; EDWOSB also qualifies as WOSB, and SDVOSB also as VOSB. Unknown restrictive set-aside codes are excluded.

#### Cache and live fallback

The `opportunities` table is a shared notice-ID-keyed cache. Writes refresh `fetched_at`; reads select matching NAICS and still-open/unknown deadlines. Batch generation uses the cache when it has at least 12 candidate rows; a smaller pool triggers live sourcing and cache updates.

The cache read is not itself a final eligibility or freshness guarantee. Geography, set-aside, size, repeats, and runway are checked downstream. SAM descriptions are resolved best-effort for bounded finalists rather than for every warmed record; description requests may still occur during a cache-served batch.

#### Daily warming and quota protection

The daily warmer uses active buyers' NAICS/state combinations and deduplicates equivalent NAICS/state/notice-type searches across buyers. It caches broadly without buyer-specific set-aside filtering or description fetching.

`SAM_DAILY_SYNC_MAX_REQUESTS` is an opt-in, per-run positive integer ceiling. Missing, blank, zero, negative, nonnumeric, or otherwise invalid values disable warming with zero SAM requests and a clear disabled warning/status. Budget accounting wraps actual outbound searches, including pagination, rather than counting only logical searches.

Recognized SAM quota-exhaustion responses stop further outbound searches for that warming run; later jobs are recorded as skipped. Summaries distinguish attempted, successful, failed, quota-skipped, budget-skipped, and deduplicated searches, with next-access metadata when supplied by SAM.

This ceiling is specific to the cache warmer. Student activation, monthly batches, Discovery supply checks, and other live paths do not inherit it. They still depend on the same provider's actual availability and quota; disabling warming does not reserve or replenish quota.

### 10. Contract qualification and ranking

The shared curation pipeline first deduplicates procurement versions, then applies deterministic hard filters for prior deliveries, set-aside eligibility, known contract-size bounds, strict geography, expired deadlines, and minimum runway.

The normal runway is 14 days. If the batch remains short, a second tier can reduce runway to five days while preserving the same buyer targeting and eligibility constraints. There is no state-removal tier or filler requirement.

Cheap ranking limits expensive AI screening to at most 12 candidates per batch tier. A deterministic Core Premise rubric evaluates hard failures, positive signals, and risks, including mandatory steps, contract-vehicle gates, known qualification contradictions, evaluation method, and delivery/compliance concerns.

Claude then classifies surviving candidates as eligible, needing validation, or disqualified. Missing evidence about qualifications is not automatically a hard rejection: unknown licenses, bonding, clearance, staff, equipment, or experience should produce validation requirements unless there is a clear mismatch. A failed AI screening call excludes that candidate rather than approving it unchecked.

Final ranking combines NAICS/keyword match, deadline runway, eligible set-aside fit, value/recompete signals, and rubric evidence. It uses deterministic scores and tie-breakers, not a claimed probability of winning. Unknown estimated values and deadlines can remain in the pool; students must validate them against the solicitation.

### 11. Procurement identity and duplicate protection

Procurement identity uses the normalized solicitation number when present, with notice ID as fallback. Solicitation numbers are whitespace-normalized and uppercased; the identity is not an agency-qualified composite key.

Multiple notice IDs or amendments for the same solicitation are collapsed to one preferred version. Selection uses modification/update/posting timestamps when available, then cache-fetch time, deadline, and a stable notice-ID tie-breaker.

Protection is layered across SAM results, curation, accumulation across runway tiers, prior-delivery lookup, and a final persistence-time check. Previously delivered solicitation identities are excluded even when a later amendment has a different notice ID.

The database migration defines `UNIQUE (buyer_id, notice_id)` as a final notice-level guard. Solicitation-level protection is implemented in application logic; it is not a database-wide unique solicitation constraint. A uniqueness violation aborts the insertion/send path rather than intentionally sending a duplicate.

### 12. Contract delivery experience

`/contracts/[token]` lists all persisted deliveries newest first, including prior batches. Cards show the title, agency, due date, NAICS, set-aside, batch number, and **Why this is winnable for you** when a why-line exists. Evidence chips and verification notes are derived from stored brief text.

**See Full Breakdown** opens the buyer-scoped delivered-contract page. Its War Dogs decision brief covers why the opportunity was surfaced, strongest advantages, evaluation approach, items to verify, dates, economics, compliance, and the first move. A separate solicitation link opens SAM.gov when available.

Why-lines and detailed briefs are generated during the batch pipeline and stored with delivery records, not regenerated every time a student opens the page. A failed why-line/deep-dive call can leave that content blank without necessarily preventing the otherwise eligible delivery; the breakdown page has a missing-content message.

Batch emails use the branded renderer and include private links to the contracts archive and individual breakdowns. Student welcome/access emails and operational alerts use separate renderers through the same Resend sender.

### 13. Monthly delivery lifecycle

Current provisioning assigns three monthly batches to `accelerator` and twelve to `vanguard`. Tier names are accepted case-insensitively. New grants reject the retired Muster, Deploy, and Enlist names; an unambiguous Accelerator/Vanguard offer or product name can supply the tier when no explicit tier is given. The first batch is generated on activation, with the remaining batches scheduled monthly. These are code-defined entitlements, not a claim about all external Kajabi offers. Existing buyers retain their previously assigned entitlements; applying the new-tier migration does not rewrite those accounts.

The monthly-delivery endpoint is scheduled daily at 14:00 UTC and processes active buyers whose `next_batch_at` is due and whose `batches_sent` remains below `batches_owed`. The daily cache warmer is scheduled at 08:00 UTC. Both cron endpoints require the configured bearer secret.

Each due buyer runs the same batch pipeline as activation. Only a nonempty newly persisted delivery set increments `batches_sent`; reaching the entitlement marks the buyer completed. A partial batch with fewer than five valid deliveries still counts as one batch.

The monthly route advances `next_batch_at` one calendar month only after a nonempty delivery result. Zero-delivery accounts remain due for a later scheduled retry rather than consuming entitlement or advancing the schedule.

Persistence and accounting occur before email sending. Email failure does not roll back delivery records or an already incremented counter. The monthly route reports/alerts on errors, zero deliveries, and missing sends; it does not implement a separate automatic resend queue.

### 14. Returning users

Exploring users resume setup, targeting review, or qualifying saved Discovery work. Active users normally return to their contracts. The start route also supports recovery of an incomplete first activation.

Contracts-page actions expose targeting review and changing the niche for future batches. Profile updates do not retroactively replace existing deliveries or independently trigger a new batch. A completed account retains its delivery archive; editing a profile does not create new entitlement.

The legacy `/targeting/[token]` editor remains available, including through batch-email links. It also saves targeting without activation.

### 15. Support and operational visibility

The shared `Shell` and existing `SupportCTA` place a compact, fixed top beta/support bar on the primary access, portal, Discovery, setup/review, start, contracts, and Full Breakdown pages. A spacer prevents it from covering content; mobile styling adapts its layout. The bar reuses the feedback/support modal and configured email-support link.

The same `/api/support` endpoint handles two modes:

- Beta feedback: categorized reports sent to Slack with Block Kit report details, issue text, technical context, and submitted time.
- Support requests: branded email sent through Gmail SMTP with the student's address as Reply-To. A configured email link offers a manual alternative; Slack failures do not automatically resend through SMTP.

Feedback automatically collects inferred browser, device, operating system, viewport, screen/pixel ratio, timezone, and language. These client-supplied diagnostics are useful clues, not authoritative device fingerprints. Slack environment labeling comes from runtime environment configuration. The message builder supports a shortened buyer reference, but the current API route does not supply a buyer ID.

Validation enforces email format, supported page context, message/body limits, and a honeypot. Rate limiting is five requests per minute per IP in a process-local map, not a distributed cross-instance limiter. Redaction removes URLs and UUIDs from message text, recognized notice identifiers, and tokenized paths; technical fields are allowlisted and bounded. It is pattern-based redaction, not a guarantee that all free-text personal information is removed.

Server diagnostics report Discovery stages, validation failures, provider usage, sourcing/filter counts, duplicate handling, persistence results, and sync budget/quota outcomes. Best-effort Resend alerts cover scheduled-job problems. These are logs/alerts, not a separate monitoring dashboard.

### 16. Kajabi integration

`/api/kajabi/grant` is an authenticated provisioning webhook. It accepts supported email/name/tier/offer payload shapes, finds or creates a buyer, and sends a welcome link on first creation when email delivery is configured. New granted buyers start exploring.

The handler accepts its shared secret through the configured header/bearer/query mechanisms. Repeated grants return the existing buyer rather than intentionally creating another account or resending the welcome email. Existing accounts are not automatically upgraded or assigned extra batches by this find-or-create operation.

The operator-confirmed customer journey begins when Kajabi grants customer access. A Zapier workflow sends the customer's provisioning information to `/api/kajabi/grant`, which finds or creates their record in Supabase's `buyers` table. Zapier bridges Kajabi access grants to CTC account provisioning; it does not perform the application's intelligent routing.

CTC then performs buyer lookup, state-aware routing, Discovery, targeting review, activation, and contract delivery. The exact Zapier trigger/tag/path settings were not independently inspected in this documentation audit. A Kajabi login alone does not establish that the provisioning workflow successfully created a CTC buyer.

### 17. Technical architecture

| Layer | Current implementation |
| --- | --- |
| Web application | Next.js 14 App Router with React 18; buyer-facing server pages and client forms. |
| Server execution | Node.js route handlers; Vercel cron configuration and bounded route durations where explicitly set. |
| Persistence | Supabase/Postgres, accessed server-side with the service-role client. Core tables: `buyers`, `opportunities`, `deliveries`, `discovery_sessions`. |
| AI | Anthropic SDK and native JSON-schema structured outputs; default Claude model is `claude-haiku-4-5`, overridable by configuration. |
| Contract source | SAM.gov public opportunities v2 API and shared database cache. |
| Student/operations email | Resend and branded HTML renderers. |
| Support/feedback | Gmail SMTP support transport and Slack incoming webhook feedback transport. |
| Application datasets | Committed War Dogs Playbook and 2022 NAICS JSON, statically imported server-side. |

Database migrations define the expected schema, but their presence in the repository does not prove they have been applied in any particular environment.

### 18. Important reliability safeguards

- Separate profile saving, niche selection, and explicit contract activation.
- Conditional activation claims and incomplete-first-batch recovery.
- Canonical recommendation IDs, official NAICS resolution, bounded ranking/explanation outputs, and adaptive context checks.
- Saved conversation state and recommendation retries without reentering accepted answers.
- Hard state targeting, set-aside eligibility, known value bounds, and expired-deadline exclusion.
- Validation rather than automatic rejection for unknown qualifications, with fail-closed AI screening errors.
- Procurement/version deduplication, prior-delivery checks, final insertion checks, and notice-level database uniqueness.
- Counters/schedule advancement only for nonempty persisted delivery sets.
- Opt-in cache-warming HTTP-request budget and in-run quota shutdown, independent of student live-path controls.
- Best-effort scheduled-job alerts and privacy-aware feedback diagnostics.

These safeguards reduce specific failure modes; they do not make all database writes, provider calls, email sends, and concurrent jobs one atomic transaction.

### 19. Important operational configuration

Only variable names are listed here. Secret values belong in the environment, never in this document or committed source.

| Area | Variables referenced by current code |
| --- | --- |
| Database | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Public links | `APP_BASE_URL`, `VERCEL_PROJECT_PRODUCTION_URL` |
| Claude | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` |
| SAM sourcing / daily warmer | `SAM_API_KEY`, `SAM_DAILY_SYNC_MAX_REQUESTS` |
| Scheduled/protected operations | `CRON_SECRET` |
| Provisioning | `KAJABI_WEBHOOK_SECRET` |
| Student email | `RESEND_API_KEY`, `EMAIL_FROM` |
| Operational alerts | `ALERT_EMAIL`, `ALERT_FROM` |
| Support email | `SUPPORT_SMTP_USER`, `SUPPORT_SMTP_APP_PASSWORD`, `SUPPORT_TO_EMAIL`, `SUPPORT_FROM_NAME` |
| Slack feedback | `SLACK_CTC_FEEDBACK_WEBHOOK_URL` |
| Runtime environment labeling | `VERCEL_ENV`, `NODE_ENV` |
| Product-library return link | `KAJABI_LIBRARY_URL` |

Public link construction prefers an explicit caller override, then the configured application base, then the Vercel production alias, then request origin. Environment configuration therefore determines whether generated email links point at the intended deployment.

### 20. Key repository file map

| Area | Current file(s) | Purpose |
| --- | --- | --- |
| Buyers / routing | `lib/buyers.js`, `lib/journey.js` | Profile persistence, entitlement counters, lifecycle-aware destinations. |
| Discovery review context | `lib/setupDiscoveryState.js` | Selected niche and official-code display on targeting review. |
| Portal / access | `app/portal/page.js`, `app/access/page.js`, `app/api/access/route.js` | Email identification and private-link recovery. |
| Shared chrome / support | `app/_components/Shell.jsx`, `app/_components/SupportCTA.jsx` | Branded layout, fixed beta bar, feedback/support modal. |
| Targeting / review | `app/setup/[token]/page.js`, `app/_components/NicheForm.jsx`, `app/api/profile/[token]/route.js` | Choose path, review/edit the shared targeting profile, save-only updates. |
| Legacy targeting | `app/targeting/[token]/page.js` | Existing save-only editor used by older links. |
| Start / activation | `app/start/[token]/page.js`, `app/_components/GoButton.jsx`, `app/api/activate/[token]/route.js`, `lib/activation.js` | Explicit generation, lifecycle claim, recovery, no-match behavior. |
| Discovery UI / sessions | `app/discover/[token]/page.js`, `app/_components/DiscoveryForm.jsx`, `lib/discoverySessions.js` | Conversational UI and persisted/resumable Discovery work. |
| Discovery APIs | `app/api/discover/[token]/conversation/route.js`, `app/api/discover/[token]/session/route.js`, `app/api/discover/[token]/route.js`, `app/api/discover/[token]/select/route.js` | Turn orchestration, session updates, recommendations, deterministic profile handoff. |
| Playbook / advisor | `lib/playbook/index.js`, `lib/playbook/schema.js`, `lib/playbook/advisor.js`, `lib/playbook/recommendationEngine.js` | Canonical taxonomy, normalization/validation, conversation control, bounded recommendations. |
| Playbook dataset | `lib/playbook/war_dogs_playbook_source.json` | Committed industry/subindustry source guidance. |
| NAICS / adaptive context | `lib/playbook/naicsReference.js`, `lib/playbook/naics/naics_2022_reference.json`, `lib/playbook/naics/subindustry_naics_map.json`, `lib/playbook/adaptiveQuestions.js`, `lib/playbook/adaptiveResolvers.js` | Official reference, canonical mappings, deterministic contextual resolution. |
| Current supply | `lib/playbook/feedability.js` | Cache/live eligible-supply checks for recommendations. |
| Claude integration | `lib/ai/claude.js` | Advisor turns, bounded ranking/explanation, NAICS suggestions, contract screening and briefs. |
| SAM sourcing | `lib/sam/client.js`, `lib/sam/engine.js`, `lib/sam/mapRecord.js` | HTTP search/pagination, source filtering, normalized cache rows. |
| SAM eligibility | `lib/sam/geography.js`, `lib/sam/setAsides.js` | State constraints and supported reserved-status eligibility. |
| Cache / warming | `lib/opportunities.js`, `lib/sam/sync.js`, `app/api/cron/sync/route.js` | Cache reads/writes, deduplicated budgeted daily warming, quota handling. |
| Batch curation | `lib/pipeline.js`, `lib/match/filters.js`, `lib/match/keywords.js`, `lib/match/ranking.js`, `lib/match/curate.js`, `lib/rubric/corePremise.js` | Shared sourcing-to-delivery flow, qualification and ranking. |
| Procurement / persistence | `lib/procurementIdentity.js`, `lib/deliveries.js` | Version selection, prior-delivery protection, delivery storage/readback. |
| Contract experience | `app/contracts/[token]/page.js`, `app/d/[token]/[notice_id]/page.js`, `lib/contractsPresentation.js` | Contract cards, decision briefs, active/archive presentation. |
| Email | `lib/email/resend.js`, `lib/email/renderBatchEmail.js`, `lib/email/renderWelcomeEmail.js`, `lib/email/renderAccessEmail.js`, `lib/baseUrl.js` | Sending, branded content, consistent private-link construction. |
| Scheduling / alerts | `app/api/cron/monthly/route.js`, `lib/alerts.js`, `vercel.json` | Due-buyer batches, schedules and best-effort operational email alerts. |
| Support transport | `app/api/support/route.js`, `lib/support.js` | Validation, local throttling, redaction, Slack/Gmail transports. |
| Provisioning | `app/api/kajabi/grant/route.js` | Authenticated buyer grants and initial welcome email. |
| Database / dependencies | `lib/supabase.js`, `supabase/migrations/0001_init.sql`, `supabase/migrations/0002_buyer_email_unique.sql`, `supabase/migrations/0003_discovery_sessions.sql`, `package.json` | Service client, schema definitions and application dependencies. |

### 21. Current known operational considerations

1. SAM quota and provider availability remain real dependencies. Warming limits are per invocation, not a shared daily quota ledger. Concurrent runs can each consume their own budget; there is no shared sync lock in the daily warmer. Quota shutdown lasts for that run, not a persisted global circuit breaker.
2. Monthly buyers are processed sequentially within the route's configured duration. There is no code-backed customer-capacity guarantee or background queue in this route. Scheduling, alert delivery, and external quotas require operational monitoring.
3. Cache reads use NAICS/deadlines rather than a maximum cache-age gate, and a sufficiently large raw cache pool can still become thin after buyer-specific filters. Current supply checks are snapshots, not monthly supply promises.
4. Delivery persistence, counter updates, scheduling, and email are separate operations. Notice uniqueness helps with races, but solicitation-level deduplication and normal counter updates are not a universal transactional lock across concurrent jobs. Email failures can leave valid portal deliveries without a successful email.
5. The current final-explanation schema requests `recommendations`, but `explainPlaybookRecommendations()` reads `parsed.rankings`. A normal response matching that schema therefore yields no explanation enrichment through this adapter, leaving server-built text/arrays in place. This is a verified code limitation, not a claim that a live provider test was run for this document.
6. NAICS codes/titles are checked against the committed official reference, while subindustry mappings remain classified as machine-proposed. Direct manual NAICS entry has different validation from bounded Discovery resolution.
7. Portal email identification is not email-ownership verification or Kajabi SSO. Tokenized links and operator-managed service credentials remain security-sensitive. Feedback throttling is process-local and technical-context detection/redaction is best-effort.
8. The Kajabi access grant -> Zapier -> CTC buyer provisioning flow is operator-confirmed. Exact external workflow settings, production environment values, applied database migrations, domain configuration, provider-key validity, and live deployment health were not independently verified by this source-code documentation audit.
