# Curated Target Contracts — System Summary for the Niche Discovery Playbook

*Handoff doc. Purpose: give whoever designs the Niche Discovery Playbook a complete picture of the product it plugs into, and the exact seams where the Playbook connects.*

---

## 1. What the product is

**Curated Target Contracts** is a done-for-you federal contract curation service sold through Kajabi (War Dogs Academy). Every month, a buyer gets **5 hand-picked live SAM.gov contracts** matched to their niche, each with a plain-English "why we picked this" and a deeper dive. The pitch is not "more contracts." It is **fewer, winnable contracts** — the ones we'd bid ourselves, where the competition is thin.

- **Live URL:** `https://hq.wardogsacademy.com` (custom domain, brand-owned)
- **Stack:** Next.js 14 App Router on Vercel (serverless), Supabase Postgres, Anthropic Claude (`claude-haiku-4-5`) for the AI reads, SAM.gov opportunities API for the contract source, Resend for email.
- **No logins.** Every buyer has an `access_token` (uuid). All their pages are token URLs: `/setup/[token]`, `/discover/[token]`, `/contracts/[token]`, `/targeting/[token]`, `/d/[token]/[notice_id]`.

---

## 2. The buyer lifecycle (this is the spine)

A buyer moves through three states:

| Status | Meaning | What they see |
|--------|---------|---------------|
| `exploring` | Account created, no niche set yet | The niche workshop (`/setup`) or discovery (`/discover`) |
| `active` | Niche set + first batch pulled | Their contracts (`/contracts`) |
| `completed` | All owed batches sent | Their contracts (archive) |

Batch accounting per buyer: `batches_owed` (enlist tier = 1, deploy tier = 6), `batches_sent`, `next_batch_at`, `activated_at`. A monthly cron pulls the next batch for `active` buyers who are due and still owed.

**How an account is born:** Kajabi grants the offer → Kajabi automation adds a tag → Zapier "Tag Added" trigger → POST to our `/api/kajabi/grant` webhook → we create the buyer + send a welcome email with their token link. (Kajabi has no "offer granted" Zapier trigger and can't pass member email to external links, hence the tag bridge + a one-field `/portal` email gate.)

---

## 3. The niche is the heart of the whole system

A buyer's targeting profile (stored on the `buyers` row) is what drives every contract pull:

- `naics` — **1 to 5 six-digit NAICS codes.** This is the primary matching key against SAM.gov. **This is what the Playbook ultimately produces.**
- `keywords` — optional, sharpens ranking, never shrinks the list.
- `set_asides` — certifications they hold (`sb`, `sdvosb`, `vosb`, `wosb`, `edwosb`, `8a`, `hubzone`). We only send set-asides they qualify for (hierarchy: any cert implies small-business eligibility; edwosb→wosb; sdvosb→vosb).
- `state` — 2-letter service area, or blank for nationwide (tighter area = fewer contracts).
- `size_min` / `size_max` — optional contract dollar bounds.

**The course philosophy, baked into the UI:** own ONE niche. Two or three related NAICS codes is the sweet spot — learn how buyers in it talk, learn what a good price looks like, win it again and again. The niche workshop copy actively discourages spreading wide.

---

## 4. The two ways a buyer sets their niche (both feed the same profile)

### A. The niche workshop — `/setup/[token]`
For people who already know their lane. A keyword/industry search box ("office cleaning", "commercial construction") → AI maps it to real NAICS codes → they pick up to 5 as chips. Pros can type a NAICS code directly. One button saves the niche AND pulls the first 5 contracts.

### B. The Niche Discovery Platform — `/discover/[token]` (JUST BUILT)
For people who **don't know what to go after.** This is the direct on-ramp for the Playbook. Current v1 flow:

1. Short plain-English questionnaire: **background/skills**, **what draws them in or what to avoid**, **set-asides they hold**, **state**.
2. AI coach (`discoverNiches`) returns **up to 3 winnable niches**, each a card with:
   - the **industry** in plain English,
   - the real **NAICS code(s)** + official titles,
   - a **"Why this fits you"** explanation (favors niches where their experience or certs thin the competition; prefers steady recurring services over crowded prestige categories).
3. **"Use this for my contracts"** button → writes those NAICS into their targeting → routes them to the niche workshop to review before anything pulls. Nothing is locked in until they confirm.

**Entry point:** a pink-outline link on the niche workshop — "Not sure what to go after? Discover your niche →".

---

## 5. THE SEAM: where the Niche Discovery Playbook plugs in

The Playbook is the **methodology/content** behind step 2 above. Right now that logic lives in one function, written as a tunable v1:

**`lib/ai/claude.js` → `discoverNiches(profile)`**
- **Input:** `{ background, setAsides[], state, interests }`
- **Output (validated):** up to 3 × `{ industry, naics: [{code, title}], explanation }` — NAICS validated to real 6-digit format, no long-dash characters.
- **Current system prompt (v1, my general federal-contracting read, NOT the course's):** "recommend up to 3 winnable niches... favor certs that shrink competition... prefer steady less-glamorous recurring services over crowded prestige categories... only real NAICS codes."

**What the Playbook needs to define — this is the CoWork conversation:**
1. **The questions we ask.** Are background / interests / set-asides / state the right inputs? What else does the course use to steer someone to a niche? (Capital available? Team size? Risk tolerance? Existing past-performance? Geography strategy?)
2. **The selection rules.** What actually makes a niche "winnable" in the War Dogs method? (e.g. contract volume floors, incumbent turnover, set-aside leverage, price-to-competition ratio, recompete cadence, "boring is good" heuristics.) These become the system prompt's ranking logic.
3. **The disqualifiers.** Which niches does the course tell people to AVOID and why? (Over-competed codes, codes dominated by large primes, feast-or-famine categories.)
4. **The explanation voice.** What should the "why this fits you" read like so it sounds like the course, not a generic AI?
5. **The output shape.** Is 3 recommendations right? Should each carry more (est. competition level, typical contract size, a "first move" suggestion)?

Once those are captured, they translate almost 1:1 into the `discoverNiches` prompt + schema. The plumbing (page, form, API, handoff to targeting) is already built and tested — **only the brain needs the Playbook's methodology.**

**Source material to mine:** the 3 course videos/transcripts James is providing. Those define what contracts War Dogs teaches people to chase, which is exactly what the Playbook should encode.

---

## 6. What happens after a niche is chosen (so the Playbook stays consistent)

The contract engine, so the Playbook's niche logic and the delivery logic don't contradict each other:

- **Cache-first pull:** we pull SAM.gov opportunities by NAICS (`maxPerNaics=1000`), cached to conserve the daily quota (key doesn't expire, quota resets daily).
- **AI reads per contract:** `disqualifyContract` (filters junk / ineligible), `whyLine` (the "why we picked this"), `deepDive` (the full brief on `/d/[token]/[notice_id]`).
- **Auto-widen shortfall:** if a niche is too narrow to yield 5 in a cycle, the pipeline widens to fill the batch.
- **Set-aside eligibility** is enforced at pull time, so whatever certs the Playbook collects must map to our 7 set-aside values.

**Implication for the Playbook:** a niche it recommends must be able to actually produce ~5 live contracts/month. Ultra-narrow codes look "winnable" but starve the delivery. The Playbook's methodology should factor **contract volume** into "winnable," not just competition.

---

## 7. Scale / operational reality (context, not blockers)

- Supports roughly **100–150 active customers** before the monthly cron's sequential loop needs a job-queue upgrade (Vercel 300s function limit).
- SAM.gov API key doesn't expire; quota resets daily; cache-first design keeps us well under it.
- Pre-launch to-dos (user-side): move Supabase/Vercel/Resend to paid tiers + autopay; rotate the CRON and Kajabi webhook secrets.

---

## 8. One-line framing for the Playbook

> The Niche Discovery Platform already asks the questions and renders the niches. The **Niche Discovery Playbook** is the War Dogs methodology that decides *which* niches are winnable and *why* — it becomes the brain (`discoverNiches`) behind the flow, and it must recommend niches that are both **winnable** (thin competition, cert leverage, buyer they can serve) and **feedable** (enough monthly contract volume to deliver 5).

---

### Quick file map (for whoever implements the Playbook)
| Piece | File |
|-------|------|
| The niche brain (tune this) | `lib/ai/claude.js` → `discoverNiches` |
| Discovery API (token-gated, no writes) | `app/api/discover/[token]/route.js` |
| Discovery page | `app/discover/[token]/page.js` |
| Discovery questionnaire + results UI | `app/_components/DiscoveryForm.jsx` |
| Handoff target (writes NAICS) | `app/api/profile/[token]/route.js` (PUT) |
| Niche workshop (review + activate) | `app/setup/[token]/page.js`, `app/_components/NicheForm.jsx` |
| Keyword→NAICS mapper (sibling logic) | `lib/ai/claude.js` → `suggestNaics` |
| Targeting profile fields | `buyers` row: `naics, keywords, set_asides, state, size_min, size_max` |

*Shipped on branch `claude/curated-target-contracts-build-dq41mg`, staged (not yet deployed to `main`).*
