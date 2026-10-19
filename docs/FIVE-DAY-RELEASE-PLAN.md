# Five-day platform refresh release plan

Dates: October 19-23, 2026 (Asia/Karachi). Day 1 includes today.
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

Tests: access/portal/recovery presentation, theme, glass, dropdowns, dialogs,
liquid/ambient/access motion, cursor, scrollbars, and updated support tests.
Gate: entry flows, keyboard support, readable light/dark contrast, reduced
motion, native fallback behavior, and no broken imports or asset requests.

## Day 3: workspace, account and targeting

Include SetupWorkspace, WorkspaceNavigation, Shell, NicheForm, GoButton,
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
conversation route's reset cleanup, discoveryPresentation/discoveryLoadingState
tests, and remaining Discovery-dependent continuity tests. Review the existing
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
briefMotion tests, and the final `docs/PRIVATE-BROWSER-ACCESS.md`. Review
`docs/DESIGN.md` and include only relevant, intentional documentation/assets.

Gate: matching pink/charcoal cards, equal-height CTAs, external-link icons,
buyer-scoped/canonical detail routes, smooth reversible accordion transitions,
reduced motion, responsive layout, and successful access-to-logout journeys.
Run the complete test suite and an isolated production build. Resolve known
stale Discovery/playbook/support source assertions before their owning batch
ships; do not relabel failures as passes. Check final credential-free client
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

Current preparation authorizes a new local branch and Day 1 staging only.
It does not authorize a commit, push, deployment, or scheduled future action.

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
