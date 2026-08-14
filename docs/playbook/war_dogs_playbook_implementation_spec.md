# War Dogs Academy Niche Discovery Playbook — Implementation Specification

## Purpose

Replace the current generic `discoverNiches(profile)` behavior with a War Dogs-specific discovery system grounded in the client-supplied industry knowledge base, while preserving the already-completed Curated Target Contracts journey.

Discovery answers **which lane should this buyer pursue?** Curated Target Contracts answers **which current opportunities in that lane are worth pursuing?**

## Canonical source

Use `war_dogs_playbook_source.json` as the canonical source-derived knowledge base. It contains:

- 13 industries
- 130 unique populated sub-industries
- industry competition level
- industry market-growth label
- primary award method
- market-value figure from the Notion source
- industry summary + detailed description
- industry broker guidance
- sub-industry description + broker guidance
- global Product vs Service strategy guidance

The JSON intentionally excludes duplicate Notion trees/placeholders and intentionally does **not** infer NAICS mappings, scoring weights, or hard disqualifiers.

## Product principles

1. Do not let the LLM invent the industry universe.
2. Treat War Dogs source content as guidance and evidence, not independently verified public-market facts.
3. Separate market attractiveness from buyer accessibility/capability fit.
4. Low competition does not automatically mean beginner-friendly.
5. High competition does not automatically disqualify a niche.
6. Unknown qualifications are `needs_validation`, not automatic failure.
7. Confirmed hard incompatibilities can exclude a candidate.
8. Broker/vendor-sourcing capability matters. A buyer may lack a credential personally but still be able to source a compliant vendor.
9. The final chosen niche must map to validated NAICS codes before it is written to buyer targeting.
10. Discovery recommendations should prefer niches with enough current opportunity activity, but should never promise exactly five contracts.
11. CTC remains the contract-level winnability layer and keeps its existing geography, set-aside, duplicate, recovery, no-match, and entitlement safeguards.

## Core questionnaire

Keep the initial flow short. Target 8-10 core questions, followed by 1-3 adaptive follow-ups only when needed.

### Q1 — Current capability / sourcing base

Prompt: What can you confidently provide or source today?

Capture products, services, skills, industries, vendor relationships, and relevant commercial experience in plain English.

### Q2 — Fulfillment model

Options:
- My own company/team performs the work
- I already work with vendors/subcontractors
- I plan to source vendors as opportunities come up
- A combination of these
- I am not sure yet

### Q3 — Opportunity type preference

Options:
- Supplying products
- Providing services
- Either
- Not sure

### Q4 — Relevant experience

Multi-select:
- Federal government contracts
- State/local government contracts
- Private/commercial work
- Industry experience but no contract history
- Brand new to this area

### Q5 — Qualifications / delivery advantages

Multi-select plus optional text:
- Professional/trade licenses
- Bonding capacity
- Security clearances
- Technical/cyber certifications
- Healthcare/medical credentials
- Environmental/safety certifications
- Specialized equipment
- Qualified staff
- Regulated product suppliers
- Other
- None / not sure

### Q6 — Service geography

Options:
- My state only
- Several states
- Nationwide
- Remote/digital work
- Depends on the vendor

Important: the current CTC buyer schema only has one `state`. Do not silently squeeze multi-state/nationwide discovery answers into a false single-state claim. Preserve existing CTC behavior and flag any schema addition separately.

### Q7 — Preferred operating model

Options:
- Fast, higher-volume product opportunities
- Recurring long-term service contracts
- Project-based work
- No preference

### Q8 — Contract size / complexity comfort

Use existing `size_min` and `size_max` concepts where possible, but allow `not sure`.

### Q9 — Set-asides

Keep existing values only:
- sb
- sdvosb
- vosb
- wosb
- edwosb
- 8a
- hubzone

### Q10 — Pursue / avoid

Plain-English interests, target areas, and explicit avoidances.

## Adaptive follow-ups

Only ask follow-ups relevant to likely candidates.

### Construction
Ask whether the buyer or delivery partners can meet state licensing and bonding requirements.

### IT / Cyber
Ask about relevant technical certifications, FedRAMP/CMMC/security-clearance capability, technical past performance, and contract-vehicle access only where relevant.

### Healthcare
Ask about licensed clinicians, HIPAA capability, regulated medical products, staffing, or other credentials only for the candidate sub-industry.

### Security
Ask about security licensing, cleared personnel, insurance, FFL or other regulated requirements when applicable.

### Environmental
Ask about EPA/state permits, HAZMAT, abatement, environmental or safety certifications when applicable.

### Product procurement
Ask whether supplier relationships can support inventory, compliant sourcing, pricing, and lead times.

### Facilities
Ask about recurring staffing, reliable local vendors, licensing for trades, and service-area ability where applicable.

### R&D
Ask about relevant technical/scientific expertise, research partners, prototype capability, and applicable program experience.

## Normalized discovery profile

Create a normalized application-level profile rather than passing raw form strings directly to Claude.

Suggested shape:

```json
{
  "capabilities_text": "...",
  "fulfillment_model": "self|existing_vendors|source_as_needed|hybrid|unknown",
  "opportunity_type": "product|service|either|unknown",
  "experience_types": [],
  "qualification_categories": [],
  "qualification_notes": "...",
  "geography_mode": "single_state|multi_state|nationwide|remote|vendor_dependent",
  "state": "GA",
  "operating_model": "volume_product|recurring_service|project|no_preference",
  "size_min": null,
  "size_max": null,
  "set_asides": [],
  "interests": "...",
  "avoid": "...",
  "adaptive_answers": {}
}
```

## Candidate evaluation model

Do not create a single opaque numeric score in v1. Build explicit evidence dimensions.

Suggested candidate result:

```json
{
  "industry": "Operations & Facilities Support",
  "subindustry": "Janitorial & Cleaning Services",
  "compatibility": "confirmed_fit|needs_validation|incompatible",
  "capability_fit": "strong|moderate|weak|unknown",
  "fulfillment_fit": "strong|moderate|weak|unknown",
  "qualification_fit": "strong|moderate|weak|unknown",
  "geography_fit": "strong|moderate|weak|unknown",
  "operating_model_fit": "strong|moderate|weak|unknown",
  "market_competition": "low|medium|high",
  "positive_signals": [],
  "risks": [],
  "validation_questions": []
}
```

## Hard exclusion policy

Safe hard exclusions in v1:

- user explicitly says to avoid the niche
- explicit product/service incompatibility where the user has ruled out the required delivery model
- confirmed geography impossibility for a location-bound service model
- confirmed regulatory/licensing requirement cannot be met by the buyer or a delivery partner
- confirmed operational/capacity constraint makes delivery impossible

Do **not** hard-disqualify solely because:

- competition is high
- user lacks federal past performance
- credential status is unknown
- vendor is not yet identified
- market size is smaller
- the buyer is new to government contracting

Use `needs_validation` for unknowns.

## Market intelligence usage

The Notion data contains market-value, growth, competition, and award-method labels. Treat these as War Dogs source priors.

Do not present them as independently verified real-time statistics unless a separate source/date is added.

Prefer sub-industry-specific guidance over parent-industry averages when the sub-industry note is more specific.

## NAICS mapping requirement

The Notion export does not contain complete NAICS mapping. Do not let Claude freely invent canonical codes.

Before a recommendation can be selected for CTC targeting:

1. map sub-industry to one or more candidate NAICS codes,
2. validate each code/title against an authoritative NAICS reference available to the application,
3. store/display the validated title,
4. reject invalid mappings,
5. keep the mapping versioned/reviewable.

If the repository currently lacks an authoritative NAICS dataset, the first implementation should report that gap rather than manufacture one.

## Live opportunity viability

After deterministic matching narrows candidates, use current/cached SAM opportunity activity as an additional viability signal.

Do not use live SAM calls in unit tests.

Discovery should avoid confidently recommending a niche that has effectively no usable opportunity activity for the buyer's geography/set-aside profile, but a temporary shortfall should not permanently disqualify the niche.

## Claude's role

Claude should receive:

- normalized buyer profile
- a bounded candidate set from the War Dogs knowledge base
- deterministic fit/risk evidence
- validated NAICS mappings
- optional current-market viability evidence

Claude may:

- rank the bounded candidates
- explain why each fits
- explain risks / what to validate
- keep War Dogs voice

Claude must not:

- invent arbitrary industries outside the canonical library
- invent NAICS codes/titles
- treat selected targeting as proof of buyer qualifications
- fabricate experience, staff, licenses, bonding, equipment, clearances, eligibility, or past performance
- guarantee winnability

## Recommendation output

Return up to 3 recommendations.

Suggested shape:

```json
{
  "industry": "Operations & Facilities Support",
  "subindustry": "Janitorial & Cleaning Services",
  "naics": [{"code":"...","title":"..."}],
  "why_fit": "...",
  "why_market": "...",
  "what_to_watch": "...",
  "competition": "high",
  "contract_style": "recurring service",
  "validation_needed": []
}
```

UI can continue to use a `Use this for my contracts` action, which writes only validated targeting values and routes to the shared Review Targeting step.

## Persistence

Discovery should become resumable and auditable.

Preferred persistence model:

- buyer_id
- answers JSON
- normalized_profile JSON
- playbook_version
- recommendations JSON
- selected_recommendation
- status
- created_at
- updated_at

Do not add a migration until the existing repository/database design is audited. If a lightweight existing storage pattern can safely support this, use it. Otherwise propose the minimal migration separately.

## Versioning

At minimum track:

- `playbook_version`
- `source_version` or source date

Separate stable source knowledge from time-sensitive claims such as:

- market value
- growth
- bid/competition estimates
- administration/funding priorities

## Compatibility requirements

Do not regress already-completed CTC behavior:

- Choose Your Path onboarding
- Discovery/direct targeting merge
- Review Targeting
- explicit Start My Contracts
- active/completed routing
- activation recovery
- partial-delivery repair
- duplicate protections
- state/place-of-performance constraint
- fewer-than-five valid delivery support
- no-match vs system-error semantics
- completed archive
- grounded contract why/deep-dive copy

## Implementation phases

### Phase A — Data foundation and repository audit

- add canonical Playbook data
- validate schema and counts
- audit current Discovery form/API/Claude flow
- audit NAICS source availability
- design normalized profile and matcher interfaces
- no user-facing behavior change unless necessary for safe scaffolding

### Phase B — Questionnaire + persistence

- implement core questions
- normalize profile
- persist/resume answers
- add adaptive follow-up framework

### Phase C — Matcher + NAICS + viability

- deterministic candidate evaluation
- hard/conditional rules
- authoritative NAICS mapping
- optional cached SAM viability signal
- bounded Claude ranking/explanation

### Phase D — Recommendation UI + QA

- richer recommendation card
- selection/handoff to targeting
- source-grounded tests
- expert benchmark cases
- regression/build/preview QA

