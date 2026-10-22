# Five-day platform refresh release plan

Planned release dates: October 19-23, 2026 (Asia/Karachi). Day 1 is October 19.
Batch labels describe the plan; record actual preparation/commit dates.
Branch: `revamp/curated-targeted-contracts`. All five daily batches will be
committed and pushed to this same branch.

These are review and release batches of work already present locally, not a claim
that the implementation was created on five separate days. Use actual commit
dates. Each batch delivers a coherent capability with its dependencies and
tests; balance is by review effort and user impact, not identical file counts.
One commit and push per day is a proposed cadence, not an automated schedule.

| Day | Substantial update | Suggested commit subject |
| --- | --- | --- |
| Oct 19 | Private browser access, clean-route adapters, cookie authorization, and reliable protected logout | `feat(auth): add private browser sessions and secure logout` |
| Oct 20 | Shared visual system and public entry experience: light/dark surfaces, glass, brand controls, home/portal/access/recovery | `feat(ui): establish branded themes and member entry experience` |
| Oct 21 | Responsive workspace and targeting: sidebar, mobile account menu, profile/logout, controls and saved targeting | `feat(workspace): add responsive navigation and targeting experience` |
| Oct 22 | Discovery: conversational flow, message actions/TTS/editing, loading states, numbered recommendations and reset continuity | `feat(discovery): refresh advisor chat and niche recommendations` |
| Oct 23 | Contracts and reader: archive/detail surfaces, consistent outbound actions, animated decision brief, cross-surface acceptance | `feat(contracts): refresh archive and decision brief experience` |

## Day 1: stage now; do not commit or push yet

Exact implementation scope:

- `lib/buyerUrls.js`, `lib/buyerSession.js`, `lib/requestOrigin.js`, changes to
  `lib/buyers.js` and `lib/journey.js`, and `middleware.js`.
- `app/auth/access/route.js`, `app/auth/logout/route.js`.
- Clean route adapters: `app/{contracts,discover,setup,start,targeting}/page.js`
  and `app/d/[token]/page.js`. These reuse the existing page implementations;
  their visual rewrites are not part of Day 1.
- `test/buyerSession.test.mjs`, `docs/PRIVATE-ACCESS-CORE.md`, and this plan.

Acceptance: export the Git index to an isolated directory and run its tests,
not just the full working tree. Check same-origin and native private-form
logout redirects/expiry, cross-site rejection, legacy link exchange, cookie
flags, scoped lookups, and safe destination handling. Do not stage environment
files, generated artifacts, design references, unused images, or later UI work.

## Day 2: visual foundations and member entry

Review the shared CSS foundation together: `app/layout.js`, theme/glass/liquid,
workspace/portal/recovery/setup/contracts/contract-flow rules, access motion,
popups, dropdowns, scrollbars, cursor, and workspace-navigation styles. Layout
imports must all resolve in this batch even where later page wiring is pending.

Include the shared Button, CTCIcon, Modal, Select, ThemeSwitch, LiquidInteractions,
AccessExperience, BetaNotice, PortalFrame and RecoveryScreen components, their
helpers (`theme`, `dialog`, `liquid`, `cursor`, `accessMotion`, `ambientMotion`),
and `lib/ui.js` if required by those components. Include AccessForm,
PortalEmailForm, SupportCTA and the `/`, `/portal`, `/access`, and not-found pages
with all transitive local imports. Keep illustration-only components with the
first page that consumes them. Include only actually referenced brand assets.
Include Shell here as shared recovery/theme chrome: its NotFound export must
use RecoveryScreen and its header must expose a theme slot. The workspace and
page rewrites that consume this foundation stay in their later batches.

Tests: access/portal/recovery presentation, theme, glass, dropdowns, dialogs,
liquid/ambient/access motion, cursor, scrollbars, and updated support tests.
Gate: entry flows, keyboard support, readable light/dark contrast, reduced
motion, native fallback behavior, and no broken imports or asset requests.

## Day 3: workspace, account and targeting

Include SetupWorkspace, WorkspaceNavigation, NicheForm, GoButton,
targetingControls, setup/start/targeting legacy page implementations, and their
required illustrations. Verify transitive imports against Days 1-2. Include
workspaceNavigation, setupPresentation, targetingControls, startUx and
setupDiscoveryContinuity tests with the UI they exercise. Stage only the test
hunks that apply to this batch if a continuity test also depends on Day 4.

Gate: compact landscape branding; smooth collapse/expand; meaningful tooltips
and shortcut; no false collapsed-rail overflow; mobile avatar/account menu;
logout last and red; saved targeting/profile editing; consistent cards,
dropdowns, and thin borderless scrollbars. Check both themes and touch/keyboard.

## Day 4: Discovery and recommendations

Include DiscoveryForm, the discover legacy page, its illustrations, the
conversation route's reset cleanup, discoveryPresentation/discoveryLoadingState/
discoveryReset
tests, and remaining Discovery-dependent continuity tests. The standalone
navigation-icon parity and Discovery-to-setup update-mode assertions are in
`test/discoveryPresentation.test.mjs`; they were separated from the October 21
workspace batch without dropping their coverage. Review the existing
playbookRecommendation test against the new presentation without weakening its
behavioral coverage. Include `test/buyerAccessPresentation.test.mjs` now that
setup, targeting, and Discovery all use whitelisted client profile props.

Gate: saved conversation continuity, reset clears stale recommendations,
content-hugging numbered cards, translucent loading states, correct icons,
copy/TTS, one active utterance, preferred natural English voice with fallback,
and hover/focus-only user actions that remain usable on touch devices.

## Day 5: Contracts, reader, and release acceptance

Include contracts/deep-dive legacy pages, AssetViewer, DecisionBrief,
ContractArchiveIllustration, `lib/contractsPresentation.js`, `lib/briefMotion.js`,
contractsPresentation/contractsScreen/contractFlowPresentation/readerWorkspace/
briefMotion tests, `test/visualIntegration.test.mjs`, and the final
`docs/PRIVATE-BROWSER-ACCESS.md`. The visual integration tests retain all
cross-page assertions separated from the independent Day 2 foundation tests;
keep this file unstaged until the dependent page rewrites are included. Review
`docs/DESIGN.md` and include only relevant, intentional documentation/assets.

Gate: matching pink/charcoal cards, equal-height CTAs, external-link icons,
buyer-scoped/canonical detail routes, smooth reversible accordion transitions,
reduced motion, responsive layout, and successful access-to-logout journeys.
Run the complete test suite and an isolated production build. Keep the updated
Discovery/playbook/support regression checks passing; do not relabel failures
as passes. Check final credential-free client
props and clean browser navigation, not just server unit tests.

## Daily release procedure

1. Inspect the existing index and worktree. Preserve unrelated work. Stage only
   that day's cohesive changes and any required earlier dependency fixes.
2. Export the index and test the snapshot independently. Check whitespace,
   imports, applicable tests, and a production build before each push. Perform
   browser acceptance where available; record any unavailable checks honestly.
3. Review the staged diff for credentials, personal data, accidental artifacts,
   and unrelated changes. Fix any gate failures before proceeding.
4. With the user's go-ahead to publish, commit the reviewed batch with an honest
   subject, then push the release branch. First push can use
   `git push -u origin revamp/curated-targeted-contracts`; later pushes use
   `git push`. Check the intended remote first. No force push or backdating.
5. Record actual checks and results in the commit/PR notes. Keep future changes
   unstaged. Dates are targets: do not publish a broken batch to meet cadence.

Prepare and stage a daily batch when requested by the user. Preparation alone
does not authorize a commit, push, deployment, or scheduled future action.

## Preparation verification: October 19

- Exported Day 1's Git index independently of the remaining worktree changes.
  Core session/logout tests: 17 passed, zero failed.
- Full staged-snapshot suite: 355 tests, 350 passed, four failed, one skipped.
  The same four failures reproduce on base commit `1906f2a`: the compact ranking
  output-limit assertion and three support/feedback wording assertions. They
  are not introduced by this batch; they remain open release-gate items.
- Isolated production build: passed compilation, type/lint checks, static-page
  generation, and build tracing. Used a same-drive snapshot with a dependency
  junction; no local environment file or private credentials were copied.
- Live localhost HTTP checks, using synthetic request metadata and no member
  cookie: normal same-origin and native private-form POSTs return 303, expire
  the session cookie, and redirect to `/portal?logged_out=1`. Cross-site and
  opaque-origin requests without required metadata return 403 without setting
  a cookie. This is an endpoint check, not a completed interactive browser test.
- No commit, push, deployment, or future automation was performed. Keep the
  remaining UI changes unstaged. Manual browser acceptance and the existing
  failing assertions still require review before publication.

## October 20 batch: prepared October 21

The user requested preparation/staging of the October 20 batch on October 21.
The October 19 foundation is already committed as `17794db`; it is not staged
again. Keep the existing `revamp/curated-targeted-contracts` branch and actual
Git timestamps. No commit or push is part of this preparation.

Scope: shared UI/theme/control helpers and all CSS imported by the root layout;
home, portal, access, recovery and not-found pages; shared Shell recovery/theme
chrome; support form styling; independent presentation/interaction tests. All
required logos and heading fonts are already tracked. Unused generated images,
design references, environment files, and later page rewrites stay unstaged.

The shared glass/theme/scrollbar tests retain their CSS, contrast and behavior
coverage. Cross-page wiring assertions have moved intact to the unstaged
`test/visualIntegration.test.mjs` for the final dependent batch. Support tests
now check the shared Modal/dialog boundary and the existing Slack report layout,
retaining category, technical context, sanitization and credential-redaction
assertions. No support transport/provider behavior was changed.

Verification of the independently exported index:

- All 112 tests for this batch pass: entry/recovery presentation, theme, glass,
  motion, cursor, dropdowns, dialogs, scrollbars, and support.
- Full snapshot suite: 451 tests, 449 passed, one failed, one skipped. The
  remaining failure is the preexisting compact playbook ranking output-limit
  assertion, owned by the later Discovery review. The three stale support
  assertions documented on October 19 are now aligned and pass.
- Production build passes compilation, type/lint checks, static generation and
  build tracing. The isolated snapshot contains no local environment files.
- Production HTTP smoke checks return the expected branded frames: `/`,
  `/portal`, and `/access` return 200; a missing page returns the branded 404.
  Entry responses retain private/no-store and no-referrer headers. Referenced
  logos and both Zuume heading fonts return 200 and are already in Git.
- The eight moved cross-page integration checks pass against the full local
  redesign; their test file intentionally remains unstaged with later pages.
  Interactive browser/visual acceptance is not claimed by these checks.
- 55 files staged on the existing revamp branch. Later page/component rewrites,
  unused assets, and cross-page integration tests remain unstaged. No commit,
  push, deployment, scheduled action, or backdated Git operation was performed.

## October 21 batch: prepared October 22

The user requested the October 21 workspace/targeting batch on October 22.
The first two batches are already committed through `155e47c`. Preparation
keeps `revamp/curated-targeted-contracts` and actual Git timestamps; it does not
include committing or pushing.

Manifest (15 files including this plan):

- Workspace components: SetupWorkspace, WorkspaceNavigation, NicheForm,
  GoButton, and the code-native NicheFocusIllustration.
- `lib/targetingControls.js`; setup, start and targeting `[token]/page.js`
  implementations (the clean-route adapters are already committed).
- Tests: workspaceNavigation, setupPresentation, targetingControls, startUx,
  and setupDiscoveryContinuity, plus this plan.

Scope includes desktop/tablet sidebar collapse, mobile header account menu,
profile/avatar, descriptive collapsed-rail tooltips, landscape sidebar branding,
logout-last danger action, editable targeting controls and budget ranges,
read-only/future-batch review, and the separate start/search gate. Existing
shared CSS, buttons, modal, theme and brand assets are reused from October 20.
Profile editing still uses the existing profile PUT; saving does not activate
a buyer or pull contracts. Setup/targeting client props use the public profile
whitelist. Existing Discovery and Contracts page rewrites remain unstaged.

Verification of the independently exported index:

- All 64 batch-relevant tests pass, including responsive navigation state,
  keyboard shortcuts/tooltips, focus/inert behavior, safe storage failure,
  targeting search cancellation/cache, input identity, profile persistence,
  budget controls, state-aware redirects and setup/start continuity.
- Full snapshot suite: 495 tests, 493 passed, one failed, one skipped. The only
  failure is the preexisting compact playbook ranking output-limit assertion,
  left for the Discovery batch; no new test failures were introduced.
- Two Discovery-specific integration checks were moved intact to the unstaged
  Discovery presentation tests; both pass against the full local redesign.
- Isolated production build passes compilation, type/lint checks, static
  generation and build tracing. No local environment files were copied.
- Production HTTP checks without a session show signed-out recovery for
  `/setup` (normal/direct/review/update modes), `/start`, and `/targeting`;
  private/no-store and no-referrer headers remain intact, with no editable
  profile shown. Tracked landscape/stacked logos and favicon return 200.
  Authenticated UI is covered by synthetic component/handler tests, not live
  member requests. Interactive browser/visual acceptance is not claimed.
- Later Discovery/Contracts changes, cross-page integration tests, unused
  generated images, design references and environment files stay unstaged.
  No commit, push, deployment, scheduled action or backdating was performed.

## October 22 batch: prepared October 22

The first three batches are committed through `d4b3cc0`. This batch stays on
`revamp/curated-targeted-contracts`. Only staging is requested; no commit or
push is part of this preparation.

Manifest (nine files including this plan):

- `app/_components/DiscoveryForm.jsx`, `app/discover/[token]/page.js`, and
  `app/api/discover/[token]/conversation/route.js`.
- Tests: discoveryPresentation, discoveryLoadingState, discoveryReset,
  buyerAccessPresentation, and playbookRecommendation, plus this plan.

The batch includes shared workspace integration, conversational message
actions, copy and opt-in TTS, hover/focus user controls with touch fallbacks,
answer editing, local loading states, numbered recommendations and compact
card spacing. Voice selection prefers natural English voices when available;
it still depends on the browser's voice catalog. No audio provider is added.
Discovery receives whitelisted profile/session props. No generated images are
needed; the existing tracked logos are reused.

Explicit new-chat reset now clears persisted recommendations and selection
alongside the conversation. Ordinary resume leaves saved work intact. A route
regression test runs the real reset handler and session normalization with
synthetic persistence, then resumes it to check that old niches cannot return.
It also checks that an absent buyer cannot read or reset a session.

The old loading test expected removed remote Lottie frames and obsolete markup.
Its replacement checks persisted chat reconciliation, native accessible loading,
busy controls, keyboard entry and reduced-motion scrolling. The presentation
tests exercise the rendered controls, message actions, loading and voice logic.
The old ranking test expected a schema maxItems property that the current code
does not send. It now returns ten mock rankings and verifies the existing server
cap of eight, canonical IDs and removal of provider-supplied NAICS. The ranking
implementation and provider schema were not changed.

Verification of the independently exported index:

- Full suite: 537 tests, 536 passed, zero failed, one skipped. The skipped test
  is the existing opt-in live provider check; no real provider calls or member
  records were used. The previously documented playbook failure is resolved
  by the corrected behavioral test, not by skipping it or changing the cap.
- Focused Discovery/profile/ranking suite: 143 tests, 142 passed, zero failed,
  and the same one live-provider skip.
- Isolated production build passes compilation, type/lint checks, static
  generation and build tracing. No local environment files were copied.
- Production HTTP checks show signed-out recovery for `/discover` and its
  update mode, with private/no-store and no-referrer headers. An unauthenticated
  new-chat reset returns 404 without changing a session cookie. Referenced
  tracked brand images return 200.
- Authenticated presentation, reset persistence and TTS behavior were checked
  with synthetic fixtures and mocks. Interactive browser, real audio playback
  and live provider acceptance were not tested.
- Contracts/reader rewrites, their integration tests, final design/access docs,
  design references and unused generated assets remain unstaged. No commit,
  push, deployment, scheduled action or backdating was performed.
