---
phase: 04-incident-console-and-investigation-flow
plan: 02
subsystem: ui
tags: [plain-dom, state-machine, css-tokens, svg-sparkline, wcag-contrast, local-fonts, vitest]

requires:
  - phase: 04-incident-console-and-investigation-flow
    provides: "Plan 04-01 worker client, bundled cases, DOM helpers, verdict renderer, static-safety test"
provides:
  - Pure page state machine (idle, loading, done, error) with latest-request-wins and the 150 ms banner rule
  - Status banner, polite announcer, no-suspect panels, empty, loading and error renderers with verbatim UI-SPEC copy
  - Case cards with real error-rate sparklines and a wrapping case switcher
  - Flat token stylesheet (UI-SPEC hex values) with 2px accent focus ring and forced-colors rules
  - Local Geist font loader with the system stacks as the recorded fallback
  - WCAG contrast test over the shipped CSS tokens
affects: [04-03, 04-04, 04-05, 04-06, 04-07, 04-08]

estimate:
  tokens: 78000
  tasks: 2

actuals:
  tokens: 16900
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Reducer-driven rendering: every load dispatches start then succeeded or failed with a captured requestId; stale responses are dropped by reducePage"
    - "Status banner sits outside the live region; a separate visually hidden announcer changes text only when the announcement changes"
    - "Tokens on :root are pinned to the UI-SPEC hex values by a pure Vitest test that also computes WCAG ratios"
    - "Optional assets via import.meta.glob: absent font files mean the system stacks, with no code change when they are added"

key-files:
  created:
    - src/ui/state.ts
    - src/ui/status.ts
    - src/ui/case-picker.ts
    - src/ui/sparkline.ts
    - src/ui/fonts.ts
    - src/assets/fonts/FONTS.md
    - tests/ui/page-states.test.ts
    - tests/ui/case-picker.test.ts
    - tests/ui/contrast.test.ts
  modified:
    - src/ui/view-model.ts
    - src/ui/app.ts
    - src/ui/dom.ts
    - src/styles.css
    - index.html

key-decisions:
  - "The visible status banner is outside the live region and a separate .status-announcer (#status, role status) carries the announcement, so a state change is announced once"
  - "Loading with a previous result keeps it rendered at 60% opacity (is-stale on the result region); first load shows a text-only placeholder"
  - "Case picker re-renders restore focus to the same data-case-id so keyboard focus survives the card to switcher collapse"
  - "Sparklines are computed on idle by running handleAnalyzeRequest on the main thread per case; a failure omits that card's line only"

requirements-completed: [UX-08, UX-09, UX-01]

coverage:
  - id: D1
    description: "Every page state (idle, loading, error, no-incident, insufficient-data, no-eligible-commits, low-confidence, completed) has an icon plus visible text, the specified announcement, and no state relies on colour alone"
    requirement: UX-08
    verification:
      - kind: unit
        ref: "tests/ui/page-states.test.ts#buildStatusView"
        status: pass
      - kind: unit
        ref: "tests/ui/page-states.test.ts#wording discipline"
        status: pass
    human_judgment: true
    rationale: "Icon rendering, focus moving to the result heading and the live-region announcement are DOM behaviour not exercised in the node-environment suite; verified in the Plan 04-08 walk-through."
  - id: D2
    description: "Latest request wins; loading banner only after 150 ms; previous result dims to 60% with aria-busy"
    requirement: UX-08
    verification:
      - kind: unit
        ref: "tests/ui/page-states.test.ts#reducePage"
        status: pass
      - kind: unit
        ref: "tests/ui/page-states.test.ts#scheduleLoadingBanner"
        status: pass
    human_judgment: true
    rationale: "The dimmed previous result and the delayed banner are visual timing behaviours; the reducer and scheduler are tested, the rendered effect is for the human walk-through."
  - id: D3
    description: "Honest explanation panels for no incident, not enough data and no eligible commits instead of a verdict"
    requirement: UX-08
    verification:
      - kind: unit
        ref: "tests/ui/page-states.test.ts#buildStatePanel"
        status: pass
    human_judgment: false
  - id: D4
    description: "Case cards with real sparklines, pattern chips and a collapsing wrapping switcher; sparkline failure never blocks loading"
    requirement: UX-01
    verification:
      - kind: unit
        ref: "tests/ui/case-picker.test.ts#sparklinePath"
        status: pass
      - kind: unit
        ref: "tests/ui/case-picker.test.ts#patternChip"
        status: pass
    human_judgment: true
    rationale: "Card layout, switcher wrapping at 320px and sparkline appearance need a browser; deferred to the Plan 04-08 walk-through as the plan specifies."
  - id: D5
    description: "Flat token stylesheet, visible 2px accent focus ring, and WCAG contrast of every token pair (text >= 4.5:1, non-text >= 3:1) matching the UI-SPEC figures"
    requirement: UX-09
    verification:
      - kind: unit
        ref: "tests/ui/contrast.test.ts"
        status: pass
      - kind: unit
        ref: "tests/core/rebuild-surface.test.ts"
        status: pass
    human_judgment: true
    rationale: "Focus-ring visibility and responsive layout are rendered behaviours; the token values and ratios are machine-checked."
  - id: D6
    description: "Fonts resolve only from the local bundle; Geist loads when licensed files are present, otherwise the system stacks apply"
    verification:
      - kind: unit
        ref: "tests/ui/case-picker.test.ts#fontFacesFromGlob"
        status: pass
      - kind: unit
        ref: "tests/ui/case-picker.test.ts#bundled font licence"
        status: pass
      - kind: unit
        ref: "tests/ui/static-safety.test.ts"
        status: pass
    human_judgment: false

duration: 10min
completed: 2026-10-19
status: complete
plan_head_before: 3eb8525b432c84f178464c2bed7541e9ed76e87e
plan_head_after: 6018bd4aa3b9753d6876ccf8fc12151bb698c5b5
commits: 3
---

# Phase 4 Plan 02: Honest page states and the case-file visual system Summary

**A reducer-driven console where every state shows an icon plus text (150 ms loading rule, latest request wins, announced and focused results, explanation panels for no-suspect outcomes), with sparkline case cards, a collapsing switcher and a flat token stylesheet whose contrast is machine-checked against the UI-SPEC.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-10-19T16:56:00Z
- **Completed:** 2026-10-19T17:06:00Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- `reducePage` / `scheduleLoadingBanner`: idle, loading (banner flag, previous result retained across restarts), done and error; events for a superseded request return the same state object, so a slow earlier load can never overwrite a newer one.
- `buildStatusView`, `buildStatePanel`, `EMPTY_STATE` with verbatim UI-SPEC copy: `Analysis complete. Top suspect 2222222, high ranking confidence.`, the ambiguous lead sentence with `1 warning`, and panels for the three no-suspect kinds. A wording-ban test rejects causal phrases and percentages across all six streams.
- `mountApp` now dispatches through the reducer; entering done focuses `#result-title`, entering error focuses the error heading, the result region carries `aria-busy` and `.is-stale` (60% opacity) while a new load runs.
- Case cards (name, real sparkline from the pure core on idle, manifest purpose, pattern chip, accent rule plus check when loaded) collapse to a wrapping switcher after the first result; re-rendering restores focus to the same case.
- `src/styles.css` rewritten as the UI-SPEC token system (no gradient, shadow, uppercase or eyebrow), 2px accent focus ring with 2px offset, loader spin only under `prefers-reduced-motion: no-preference`, forced-colors rules.
- `tests/ui/contrast.test.ts` parses the `:root` tokens, pins all 17 to the UI-SPEC hex values, and passes every text pair (>= 4.5), non-text pair (>= 3) and the pinned figures (for example muted on raised 5.43, critical on raised 3.01, on-accent 9.86, white on destructive 4.80).

## Task Commits

1. **Task 1: Tracer, page state machine to focused announced result** - `76b4ca0` (feat)
2. **Task 2 RED: failing case-picker, font loader and contrast tests** - `65b1ecd` (test)
3. **Task 2 GREEN: case cards, sparklines, token stylesheet, local fonts** - `6018bd4` (feat)

**Plan metadata:** committed separately (docs: complete plan)

## Tracer gate

Task 1 tracer verified end to end (page-states, tracer and static-safety tests, typecheck, build) before Task 2 expanded. `human_verify_mode` is `end-of-phase` and the tracer's `<verify>` is automated-only, so no checkpoint was raised.

## TDD notes (Task 2)

- RED (`65b1ecd`): `sparkline.ts`, `fonts.ts` and `case-picker.ts` were interface-only stubs that throw "not implemented"; the 30 failures were the planned behaviors (sparkline, pattern chip, font mapping, missing `FONTS.md`, and all 17 token pins plus 3 contrast tests against the old stylesheet) with `npm run typecheck` green. Semantic assessment: valid RED, failing on the planned assertions rather than import or syntax faults. One test (the OFL check) passed at RED by design because no font files exist, as the plan specifies. `workflow.tdd_mode` is not enabled, so the `tdd-red-evidence` classifier was not run.
- GREEN (`6018bd4`): all 22 test files / 258 tests pass.
- REFACTOR: none needed.

## Files Created/Modified
- `src/ui/state.ts` - page state machine and banner scheduler
- `src/ui/status.ts` - banner, announcer, panels, empty, loading and error renderers
- `src/ui/view-model.ts` - status and state-panel views, empty-state copy
- `src/ui/case-picker.ts`, `src/ui/sparkline.ts` - case cards, switcher, sparkline path
- `src/ui/fonts.ts`, `src/assets/fonts/FONTS.md` - local font registration and provenance
- `src/ui/app.ts` - reducer-driven controller, idle sparklines, font registration
- `src/ui/dom.ts` - `icon()` takes an optional class name
- `src/styles.css`, `index.html` - token stylesheet, icon sprite, header chips, status region
- `tests/ui/page-states.test.ts`, `case-picker.test.ts`, `contrast.test.ts` - 17 + 11 + 20 tests

## Decisions Made
- Banner outside the live region, separate announcer, so one announcement per state change.
- Previous result stays visible and dimmed; the body is not re-rendered on `banner-due`.
- Picker re-render preserves focus via `data-case-id`.
- Sparklines run `handleAnalyzeRequest` on the main thread on idle; failures are silent per card.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `icon()` could not carry a CSS class**
- **Found during:** Task 1 (status banner needs a spinning loader icon and styled check icons)
- **Issue:** `src/ui/dom.ts` `icon(name)` accepted no class, so `.icon-spin`, `.case-check` and `.icon` could not be applied to the shared sprite icon.
- **Fix:** added an optional `className` parameter; existing callers are unchanged.
- **Files modified:** `src/ui/dom.ts` (not in the plan's file list)
- **Commit:** `76b4ca0`

**2. [Rule 1 - Bug] Skip link pointed at a hidden element**
- **Found during:** Task 2 (index.html rewrite)
- **Issue:** "Skip to results" targeted `#result-title`, which is `hidden` until a result exists, so the link did nothing on the idle page.
- **Fix:** the link targets `#result`, which now has `tabindex="-1"` so it can take focus.
- **Files modified:** `index.html`
- **Commit:** `6018bd4`

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug). **Impact:** none on scope; one extra file touched (14 vs 13).

## Issues Encountered
- The announcer is `#status` (role status) inside the new non-live `#status-region` wrapper rather than the whole region being the live region, a deliberate change to avoid double announcements; nothing outside this plan referenced the old element.
- The rendered page (focus ring, wrapping at 320px, dimmed reload, sparkline look) was not observed in a real browser here; the Task 2 human-check is non-blocking and deferred to the Plan 04-08 walk-through as specified.

## Known Stubs

None. (`src/ui/case-picker.ts`, `src/ui/fonts.ts` and `src/ui/sparkline.ts` were interface-only stubs only between the RED and GREEN commits.) The Geist WOFF2 files are intentionally not committed; `FONTS.md` records "Current status: system font fallback".

## Threat Flags

None. T-04-06 (copy taken verbatim, wording-ban test), T-04-07 (reducer drops stale responses, both cases tested) and T-04-08 (fonts only via `import.meta.glob`, no absolute URLs, `rebuild-surface` and `static-safety` green) are implemented and tested.

## User Setup Required

None. Optional: add `Geist-Variable.woff2`, `GeistMono-Variable.woff2` and `OFL.txt` to `src/assets/fonts/` to switch from the system fallback to Geist.

## Next Phase Readiness
- Ready for Plan 04-03. The reducer, status renderers, picker and token stylesheet are in place for the remaining regions (verdict detail, shortlist, timeline, drawer, own-files form).

## Self-Check: PASSED

All 14 plan files exist; commits `76b4ca0`, `65b1ecd`, `6018bd4` are ancestors of HEAD; `npm run typecheck`, `npm test` (22 files, 258 tests) and `npm run build` pass.

---
*Phase: 04-incident-console-and-investigation-flow*
*Completed: 2026-10-19*
