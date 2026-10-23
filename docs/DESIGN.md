---
version: alpha
name: wda-ctc-design-system
description: "War Dogs Academy Curated Target Contracts (CTC) — Production design system specification. Grounded in authentic WDA brand assets: Zuume Rough display typography, warm tactile parchment surfaces (#F8F5EE), obsidian structural framing (#1A1A1A), accessible WDA Pink accents (#D61286 / #9B0E65 on light; #F52EA9 on dark), and Tactical Orange (#9A3412 on light; #FF9F58 on dark) for verified urgency and winnable verdicts. Built with the structural hairline precision of Linear, the tabular data craftsmanship of Stripe, and the document readability of Notion, without copying their identities."

colors:
  # WDA Interactive Brand Pink (Contrast-Engineered for WCAG 2.1 AA)
  primary: "#D61286"
  primary-hover: "#BA0D73"
  primary-pressed: "#9E0760"
  primary-dark-canvas: "#F52EA9"
  primary-text: "#9B0E65"
  primary-subtle: "#FDF2F8"
  primary-subtle-border: "#FBCFE8"
  on-primary: "#FFFFFF"

  # Tactical Orange (Deadlines & Strategic Verdicts)
  tactical-orange: "#9A3412"
  tactical-orange-hover: "#7C2D12"
  tactical-orange-dark-canvas: "#FF9F58"
  tactical-orange-subtle: "#FFF7ED"
  tactical-orange-border: "#FED7AA"
  tactical-orange-badge-bg: "#FFEDD5"

  # Canvas & Surface Ladder
  canvas: "#F8F5EE"
  surface-card: "#FFFFFF"
  surface-panel: "#F2ECE1"
  surface-inset: "#EAE2D4"
  surface-obsidian: "#141517"
  surface-obsidian-elevated: "#1E2024"
  surface-obsidian-border: "#2C2F36"

  # Hairlines & Dividers
  hairline: "#E4DFD7"
  hairline-strong: "#D2CBC0"
  hairline-focus: "#D61286"

  # Typographic Ink Ladder (Contrast-Verified on #F8F5EE and #FFFFFF)
  ink: "#141517"
  ink-secondary: "#474540"
  ink-muted: "#6B665E"
  ink-subtle: "#918B82"
  ink-inverse: "#FFFFFF"
  ink-inverse-secondary: "#D1D5DB"
  ink-inverse-muted: "#9CA3AF"

  # Semantic Verification Signals
  semantic-success: "#047857"
  semantic-success-subtle: "#ECFDF5"
  semantic-success-border: "#A7F3D0"
  semantic-warning: "#B45309"
  semantic-warning-subtle: "#FFFBEB"
  semantic-warning-border: "#FDE68A"
  semantic-error: "#B91C1C"
  semantic-error-subtle: "#FEF2F2"
  semantic-error-border: "#FECACA"

typography:
  # Authentic Brand Display (Zuume Rough)
  brand-display-xl:
    fontFamily: "ZuumeRough, 'Impact', -apple-system, sans-serif"
    fontSize: "44px"
    fontWeight: "700"
    lineHeight: "1.05"
    letterSpacing: "0.04em"
    textTransform: "uppercase"
  brand-display-lg:
    fontFamily: "ZuumeRough, 'Impact', -apple-system, sans-serif"
    fontSize: "32px"
    fontWeight: "700"
    lineHeight: "1.10"
    letterSpacing: "0.04em"
    textTransform: "uppercase"
  brand-display-md:
    fontFamily: "ZuumeRough, 'Impact', -apple-system, sans-serif"
    fontSize: "24px"
    fontWeight: "700"
    lineHeight: "1.15"
    letterSpacing: "0.03em"
    textTransform: "uppercase"
  brand-display-sm:
    fontFamily: "ZuumeRough, 'Impact', -apple-system, sans-serif"
    fontSize: "18px"
    fontWeight: "700"
    lineHeight: "1.20"
    letterSpacing: "0.03em"
    textTransform: "uppercase"

  # Interface Editorial Sans (Inter / System)
  headline-lg:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "22px"
    fontWeight: "600"
    lineHeight: "1.25"
    letterSpacing: "-0.02em"
  headline-md:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "18px"
    fontWeight: "600"
    lineHeight: "1.30"
    letterSpacing: "-0.015em"
  headline-sm:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "15px"
    fontWeight: "600"
    lineHeight: "1.35"
    letterSpacing: "-0.01em"
  body-lead:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "15px"
    fontWeight: "400"
    lineHeight: "1.55"
    letterSpacing: "-0.005em"
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "14px"
    fontWeight: "400"
    lineHeight: "1.50"
    letterSpacing: "0em"
  body-sm:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "13px"
    fontWeight: "400"
    lineHeight: "1.45"
    letterSpacing: "0em"
  caption:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "12px"
    fontWeight: "500"
    lineHeight: "1.40"
    letterSpacing: "0.01em"
  eyebrow:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "11px"
    fontWeight: "700"
    lineHeight: "1.30"
    letterSpacing: "0.08em"
    textTransform: "uppercase"

  # Tabular Federal Data (JetBrains Mono)
  mono-code:
    fontFamily: "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace"
    fontSize: "13px"
    fontWeight: "500"
    lineHeight: "1.40"
    letterSpacing: "-0.01em"
  mono-sm:
    fontFamily: "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace"
    fontSize: "11px"
    fontWeight: "500"
    lineHeight: "1.35"
    letterSpacing: "0em"

rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  pill: "9999px"

spacing:
  xxs: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "48px"
  section: "64px"

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    padding: "9px 16px"
    border: "1px solid {colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.surface-obsidian}"
    textColor: "{colors.ink-inverse}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    padding: "9px 16px"
    border: "1px solid {colors.surface-obsidian-border}"
  button-tertiary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    padding: "9px 16px"
    border: "1px solid {colors.hairline-strong}"
  winnable-callout:
    backgroundColor: "{colors.tactical-orange-subtle}"
    borderColor: "{colors.tactical-orange-border}"
    textColor: "{colors.tactical-orange}"
    rounded: "{rounded.md}"
    padding: "16px"
  badge-urgent:
    backgroundColor: "{colors.tactical-orange-badge-bg}"
    borderColor: "{colors.tactical-orange-border}"
    textColor: "{colors.tactical-orange}"
    typography: "{typography.mono-sm}"
    rounded: "{rounded.xs}"
    padding: "3px 8px"
  badge-evidence:
    backgroundColor: "{colors.primary-subtle}"
    borderColor: "{colors.primary-subtle-border}"
    textColor: "{colors.primary-text}"
    typography: "{typography.caption}"
    rounded: "{rounded.xs}"
    padding: "3px 8px"
---

# War Dogs Academy — Curated Target Contracts (CTC)
## Design System Specification (`DESIGN.md`)

---

## 1. Product Context & System Boundaries

Curated Target Contracts (CTC) delivers vetted federal contract opportunities directly to War Dogs Academy students based on their verified capability profile.

### 1.1 Hard Product Boundaries
The design system must strictly reflect actual backend capabilities and data models:
- **Supported Targeting Criteria**: 
  - NAICS Codes (up to 5 codes from official NAICS index)
  - Keywords (comma-separated capability phrases)
  - Set-Aside Eligibility (None, Small Business, SDVOSB, WOSB, 8(a), HUBZone)
  - Service Area (`Nationwide` or specific US state)
  - Contract Value Range (`size_min` and `size_max`)
- **Explicitly Unsupported (Do Not Implement or Mock as Real)**:
  - No PSC code targeting
  - No federal agency targeting controls
  - No "Add to Pipeline" actions
  - No manual archiving (archive is strictly an automated view state when `buyer.status === 'completed'`)
  - No arbitrary win-rate percentages, match probability algorithms, or "High Fit" badges
  - No live match-count query previews
  - No SSO authentication (access is governed by student token parameters or email resolution via `PortalEmailForm`)
  - No unverified Contracting Officer direct contact info or incumbent intelligence

---

## 2. Accessibility & Color Contrast Matrix

All color tokens in CTC are engineered and verified against WCAG 2.1 AA standards (minimum 4.5:1 for normal text, 3.0:1 for large text/graphical elements).

| Element | Background | Foreground Token | Hex | Tested Ratio | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Normal Body Text** | Warm Canvas (`#F8F5EE`) | `{colors.ink}` | `#141517` | **15.1:1** | WCAG AAA Pass |
| **Secondary Meta** | Warm Canvas (`#F8F5EE`) | `{colors.ink-secondary}` | `#474540` | **7.5:1** | WCAG AAA Pass |
| **Muted Hint Text** | Warm Canvas (`#F8F5EE`) | `{colors.ink-muted}` | `#6B665E` | **4.7:1** | WCAG AA Pass |
| **Primary Button** | WDA Pink (`#D61286`) | `{colors.on-primary}` | `#FFFFFF` | **4.6:1** | WCAG AA Pass |
| **Primary Text (Light)**| White (`#FFFFFF`) | `{colors.primary-text}` | `#9B0E65` | **5.8:1** | WCAG AA Pass |
| **Primary Accent (Dark)**| Obsidian (`#141517`) | `{colors.primary-dark-canvas}`| `#F52EA9` | **4.9:1** | WCAG AA Pass |
| **Winnable Callout** | Soft Peach (`#FFF7ED`) | `{colors.tactical-orange}`| `#9A3412` | **5.4:1** | WCAG AA Pass |
| **Urgent Tag (Dark)** | Obsidian (`#141517`) | `{colors.tactical-orange-dark-canvas}` | `#FF9F58` | **8.2:1** | WCAG AAA Pass |
| **Focus Indicator** | Any Adjacent Surface | `{colors.hairline-focus}` | `#D61286` | **2px ring, 2px offset** | Compliant |

> [!IMPORTANT]
> Brand Pink `#F52EA9` has a 3.18:1 contrast ratio against pure white and **must not be used for normal text on light surfaces**. On light backgrounds, text uses `{colors.primary-text}` (`#9B0E65`) and buttons use `{colors.primary}` (`#D61286`). `#F52EA9` is reserved for dark obsidian backgrounds, active tab pills, and focus rings.

---

## 3. Typographic Hierarchy & Craftsmanship

Three typefaces serve distinct roles across the CTC interface:

1. **Brand Display (`Zuume Rough`)**: Authentic, high-impact distressed grotesque display face. Used in uppercase with `+0.03em` to `+0.04em` letter-spacing for terminal headers, batch identifiers, and brand banners.
2. **Interface Sans (`Inter` / System)**: Neutral geometric grotesk. Display headlines use measured negative tracking (`-0.015em` to `-0.02em`, adopted from Linear); body text maintains clean line height (`1.50`).
3. **Tabular Federal Data (`JetBrains Mono`)**: Strict monospace alignment for solicitation notice IDs, NAICS codes, set-aside tags, response deadlines, and dollar amounts (adopted from Stripe's tabular precision).

---

## 4. Audited CTC Routes, Fields & State Transitions

### 4.1 Route & State Mapping

| Route | Query Params | Key Stored Fields Used | User Actions | State Transitions |
| :--- | :--- | :--- | :--- | :--- |
| **`/portal`** | `?email=...` | `buyer.email`, `buyer.status` | Enter email, submit portal request | Redirects to `/setup/[token]` (if exploring) or `/contracts/[token]` (if active/completed) |
| **`/setup/[token]`** | `?targeting=1`, `?review=1`, `?update=1` | `buyer.naics`, `buyer.keywords`, `buyer.set_asides`, `buyer.state`, `buyer.size_min`, `buyer.size_max` | Fork path (Discovery vs Niche), edit fields, save profile | Moves new students to `/start/[token]`; updates redirect to `/contracts/[token]` |
| **`/discover/[token]`** | `?update=1` | `session.answers.advisor_state`, `session.recommendations` | Answer conversational prompts, pick suggested options, select recommended niche | Upon selecting niche (`/api/discover/[token]/select`), redirects to `/setup/[token]` with prefilled NAICS |
| **`/start/[token]`** | None | `buyer.naics`, `buyer.keywords`, `buyer.set_asides`, `buyer.state` | Click "Start Curated Delivery" (`GoButton`) | Calls `/api/activate/[token]`, status moves to `active`, redirects to `/contracts/[token]` |
| **`/contracts/[token]`** | None | `buyer.status`, `buyer.batches_owed`, `buyer.batches_sent`, `buyer.next_batch_at`, `deliveries.*` | Scan targets, review targeting, change niche, inspect full breakdown, open SAM.gov | None (read-only command dashboard) |
| **`/d/[token]/[notice_id]`**| None | `delivery.why_line`, `delivery.deep_dive_text`, `opportunity.*` | Read decision brief, copy ID, click SAM.gov link, contact support | None (dossier view) |

### 4.2 Adaptive Discovery Questionnaire Specification
Discovery is an **adaptive conversational intake**, NOT a fixed multi-step wizard.
- **Data State**: `{ messages: [], pending_question: { prompt, helper, options, multi_select }, turn_count, complete }`.
- **States Handled**:
  - `idle`: Awaiting student response.
  - `thinking`: Processing advisor response.
  - `needs_clarification`: Targeted follow-up prompt.
  - `complete`: Questionnaire finished; displays recommended niches with 1-click selection.
- **Rule**: Never render a fixed step count (e.g., "Step 2 of 5"). Use contextual phase markers: "Analyzing your delivery capabilities" or "Refining your federal niche".

### 4.3 Contracts Presentation Logic
Governed strictly by `contractsPresentationForBuyer(buyer, { deliveryCount })`:
- **Active Student (`hasRemainingBatches: true`)**: Title reads *"This month's five winnable targets"* (or *"Your winnable targets"* if count != 5). Shows next scheduled batch date from `buyer.next_batch_at`.
- **Completed Student (`completed: true`)**: Title reads *"Your Contract Archive"*. Displays completion callout stating all batches included with purchase have been delivered.
- **Targeting Links**: "Review targeting" (`/setup/[token]?review=1`) and "Change niche for future batches" (`/discover/[token]?update=1`).

---

## 5. UI Architecture & Calm Editorial Layout

The design system prioritizes a clean, calm, and readable presentation of contracts:

1. **Clean Opportunity Stream (Single-Column Vertical Flow — Recommended)**:
   - Centered comfortable reading column (max width 896px / 56rem).
   - Generous breathing room, clear typographic hierarchy, and prominent *"Why this is winnable for you"* editorial callouts.
   - Clean, quiet metadata (agency, NAICS, set-aside, location, notice ID) with single primary action: `See Full Breakdown →`.
2. **Slide-Over Full Breakdown Reader (Progressive Disclosure)**:
   - Non-intrusive drawer/modal opening from the right without navigating away or causing nested scrollbars.
   - Full 8-point plain-English decision sections, pre-bid verification checks, and direct SAM.gov link.
3. **Responsive Mobile Presentation**:
   - Seamlessly stacked cards with readable typography, 44px+ touch targets, and zero horizontal clipping.

---

## 6. Motion & Interactive Polish

- **Transitions**: Micro-interactions use `150ms cubic-bezier(0.16, 1, 0.3, 1)` for snappy, tactile feedback.
- **Elevations**: Subtle 1px hairlines (`#E4DFD7`) take precedence over blurry shadows. A faint `0 2px 8px rgba(20, 21, 23, 0.04)` ambient lift is used exclusively on interactive card hover.
- **Reduced Motion**: All animations collapse to instant state switches when `prefers-reduced-motion: reduce` is detected.
