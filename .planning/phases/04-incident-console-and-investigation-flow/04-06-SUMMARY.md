---
phase: 04-incident-console-and-investigation-flow
plan: 06
subsystem: ui
tags: [plain-dom, native-dialog, suspect-drawer, focus-management, svg-timeline, vitest]

requires:
  - phase: 04-incident-console-and-investigation-flow
    provides: "Plan 04-03 verdict, lineup and formatters; Plan 04-04 SVG timeline and investigation reducer; Plan 04-05 signature filter and log scopes"
provides:
  - Pure suspect-drawer view model (summary, one arithmetic row per ranking signal, changed files with line ranges, evidence list with log-line actions)
  - Native dialog drawer (showModal) with title focus, focus return and Previous/Next suspect
  - Drawer openers on the verdict, evidence preview, lineup cards and top-three timeline markers
  - Show matching log lines action that closes the drawer, filters by signature and focuses the log panel heading
affects: [04-07, 04-08]

estimate:
  tokens: 62000
  raw_tokens: 62000
  tasks: 2
  confidence: low

actuals:
  tokens: 10800
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "buildDrawerView is pure over the AnalysisStream (suspects from toAnalysisResult, files and event ownership from stream.commits and stream.errors) so the drawer text is unit-tested without a DOM"
    - "drawer.ts keeps one session per dialog (opener, rank, restoreFocus) in a WeakMap; the close event restores focus to the opener, else a control with the same data-suspect-rank, else the result heading"
    - "dismissSuspectDrawer closes without focus return so an action that moves focus elsewhere (log lines) is not overridden"
    - "Top-three commit markers are real buttons in an absolutely positioned layer beside the aria-hidden SVG, outside the role=slider element"

key-files:
  created:
    - src/ui/drawer-model.ts
    - src/ui/drawer.ts
    - tests/ui/drawer-model.test.ts
  modified:
    - src/ui/verdict.ts
    - src/ui/shortlist.ts
    - src/ui/timeline.ts
    - src/ui/app.ts
    - index.html
    - src/styles.css

key-decisions:
  - "Bar fill is the signal value (clamped, 0 when weight is 0), which equals contribution / weight exactly; the stored contribution is rounded to 6 decimals so the literal quotient gives 0.47065 for checkout churn instead of the pinned 0.470652"
  - "Changed files are listed in the order stream.commits holds them (by path), not the plan's example order; the history export order is not preserved by the parser"
  - "Previous/Next suspect re-render the open dialog in place and put focus on the new title, so the change is announced and a button that just became disabled never holds focus"
  - "Marker buttons are DOM-ordered by rank (#1, #2, #3) with z-index 4 minus rank so the leading marker wins overlapping 44px touch targets"
  - "A click on the dialog backdrop closes the drawer (target is the dialog itself, content sits inside)"

requirements-completed: [UX-05, UX-02, UX-09]

coverage:
  - id: D1
    description: "Drawer 'Why it ranks here' has exactly one row per ranking signal in the order proximity, trace match, novelty, churn with 'value V x weight W = C' at 3 decimals, a share-of-weight bar, the data explanation, and the total line 'Total suspicion score 0.912 (sum of the contributions above), rounded for display.'"
    requirement: UX-05
    verification:
      - kind: unit
        ref: "tests/ui/drawer-model.test.ts#buildDrawerView: checkout rank 1"
        status: pass
    human_judgment: false
  - id: D2
    description: "Changed files and line ranges from stream.commits with +added -deleted counts, L-ranges, the 'Overlaps stack frame at line N' chip (smallest cited line, inclusive bounds, same path only), the fixed 'not diff text' note, and no files for a commit absent from the history"
    requirement: UX-05
    verification:
      - kind: unit
        ref: "tests/ui/drawer-model.test.ts#changed files and line ranges"
        status: pass
    human_judgment: false
  - id: D3
    description: "Evidence section lists every reference with type label, location and detail; error-group and log-event items carry a signature action (null for an orphan event), file-range and feature items none"
    requirement: UX-05
    verification:
      - kind: unit
        ref: "tests/ui/drawer-model.test.ts#evidence list"
        status: pass
    human_judgment: false
  - id: D4
    description: "Drawer is a modal dialog 480px right-anchored from 640px and full screen below; focus lands on the title and returns to the opener on Close or Escape; Previous/Next disabled at the ends; Show matching log lines closes, filters and focuses the log panel heading; opens from the verdict, See all evidence, lineup cards and #1/#2/#3 markers by Enter, Space and click"
    requirement: UX-09
    verification:
      - kind: command
        ref: "headless Chrome over CDP against the built preview: checkout and ambiguous at 1280x720 and 360x740"
        status: pass
    human_judgment: true
    rationale: "Driven programmatically (dialog size, focus ids, Escape and Close focus return, Enter and Space on markers, log-line hand-off, no horizontal page scroll at 360px, no console errors). Real-keyboard and touch sign-off, marker hit areas on a coarse pointer, and the Tab trap are deferred to the Plan 04-08 walk-through."
  - id: D5
    description: "No claim of cause, 'culprit found', root cause or percentage in any drawer string except the fixed caveat that says the score is not proof"
    requirement: UX-05
    verification:
      - kind: unit
        ref: "tests/ui/drawer-model.test.ts#signal titles and static wording"
        status: pass
    human_judgment: false

duration: 8 min
completed: 2026-10-19
status: complete
plan_head_before: bc8a4140503ac06e28326457ca59dd60522a3193
plan_head_after: deb284bc589e1f4ab55b08738e242cdefa6905dd
commits: 3
---

# Phase 4 Plan 06: The suspect drawer Summary

**A native modal suspect drawer that shows, per suspect, one plain-language row per ranking signal with its exact arithmetic, the real changed line ranges with stack-frame overlap, every evidence item with a "Show matching log lines" hand-off, and a fixed not-proof caveat, opened from the verdict, the lineup and focusable top-three timeline markers with focus managed on open and close.**

## Performance

- **Duration:** 8 min measured from the first edit (plus reading time before it)
- **Completed:** 2026-10-19T17:50:00Z
- **Tasks:** 2
- **Files:** 9 (3 created, 6 modified)

## Accomplishments
- `src/ui/drawer-model.ts`: `SIGNAL_TITLES`, `DRAWER_CAVEAT`, `DIFF_NOTE`, `buildDrawerView` (null for an unknown rank; `prevRank`/`nextRank`; summary; four signal rows; total line; `files`, `diffNote`, `evidence`).
- `src/ui/drawer.ts`: `renderDrawerContent`, `openSuspectDrawer` (`showModal()`, title focus), `updateSuspectDrawer`, `dismissSuspectDrawer`; sections Summary, Why it ranks here, Changed files and line ranges, Evidence, Caveat; backdrop click closes.
- `src/ui/verdict.ts`, `src/ui/shortlist.ts`: "Inspect evidence" on the verdict and on every lineup card, "See all evidence" under the evidence preview, all with `data-suspect-rank`.
- `src/ui/timeline.ts`: top-three markers are `role="button"` `tabindex="0"` buttons labelled "Open suspect #N {sha}" in a layer beside the SVG (24px, 44px on coarse pointers, accent focus ring); other commits stay non-interactive.
- `src/ui/app.ts`: one `inspectSuspect` path for every opener; Previous/Next; "Show matching log lines" dismisses the drawer then dispatches `set-filter(signature)` and `open-log-lines('signature')`.
- Headless Chrome (CDP) against the built preview: checkout drawer 480x720 at x=785 with focus on `drawer-title`; Escape and Close returned focus to the verdict button or See all evidence; lineup card 2 and the markers returned focus correctly; Next/Previous disabled at the ends; math strings, total line and files `payment.ts +46 -9 L104-126 Overlaps stack frame at line 118` and `handler.ts +8 -2 L36-49` matched; "Show matching log lines" gave the filter chip, a 5-event signature panel and focus on `log-lines-title`; ambiguous drawer showed "No trace match" with only `package.json +3 -3 L12-14`; at 360x740 the drawer was 360x740, nav buttons icon-only, no horizontal page scroll; no console errors.

## Task Commits

1. **Task 1 (tracer): verdict "Inspect evidence" opens the drawer with per-signal arithmetic** - `3edc831` (feat)
2. **Task 2 RED: failing tests for changed files, overlap and evidence** - `4b6268f` (test)
3. **Task 2 GREEN: line ranges, evidence with log-line links, lineup and marker openers** - `deb284b` (feat)

**Plan metadata:** committed separately (docs: complete plan)

## Tracer gate

Task 1 tracer verified end to end (drawer-model and view-model tests, typecheck, build, static-safety) before Task 2. `human_verify_mode` is `end-of-phase` and the tracer `<verify>` is automated-only, so no checkpoint was raised.

## TDD notes (Task 2)

- RED (`4b6268f`): `files`, `diffNote` and `evidence` were interface-only stubs (`[]`, `''`, `[]`); 9 new tests failed on values with typecheck green. Valid RED.
- GREEN (`deb284b`): 27 files / 371 tests pass, typecheck and build pass. Two tests were corrected in the same commit after the real file order (see deviation 2) and a test indexing slip; the implementation did not change for them.
- REFACTOR: none needed. `workflow.tdd_mode` is not enabled, so the `tdd-red-evidence` classifier was not run.

## Files Created/Modified
- `src/ui/drawer-model.ts`, `src/ui/drawer.ts`, `tests/ui/drawer-model.test.ts` - new
- `src/ui/verdict.ts`, `src/ui/shortlist.ts`, `src/ui/timeline.ts`, `src/ui/app.ts` - openers, marker buttons, composition
- `index.html` - `dialog#suspect-drawer`
- `src/styles.css` - verdict actions, drawer, signal rows, contribution bars, files, evidence, marker hit areas, forced-colors rules

## Decisions Made
See `key-decisions` in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Bar fraction used the rounded contribution**
- **Found during:** Task 1
- **Issue:** The plan defines `barFraction = contribution / weight` and pins checkout churn at 0.470652 within 1e-6. The stored contribution is `round6(value * weight)` = 0.047065, so the quotient is 0.47065 (2e-6 off), failing the plan's own assertion.
- **Fix:** `barFraction` returns the clamped signal `value` (0 when weight is 0). Mathematically identical to contribution / weight, without the rounding error.
- **Files modified:** `src/ui/drawer-model.ts`
- **Commit:** `3edc831`

**2. [Rule 1 - Plan assumption] File order is the stream's, not the history's**
- **Found during:** Task 2 GREEN
- **Issue:** The behavior bullet lists payment.ts before handler.ts "in the commit's file order". `stream.commits` holds files sorted by path (handler.ts first); the history order is not preserved by the parser.
- **Fix:** The drawer lists files in `stream.commits` order and the test pins that order. No sort was invented. Content (counts, ranges, overlap chip) is as specified.
- **Files modified:** `tests/ui/drawer-model.test.ts`
- **Commit:** `deb284b`

**Total deviations:** 2 auto-fixed (2 Rule 1). **Impact:** none on the contracted strings; ordering of the two checkout files differs from the plan's example.

## Issues Encountered
- The Task 2 human-check (real browser at both widths, keyboard and mouse) is non-blocking and deferred to Plan 04-08. The CDP run above is an early signal, not the sign-off. The real Tab focus trap and the 44px coarse-pointer marker size are the items it must confirm.
- Checkout has only two eligible suspects (the third commit lands after onset), so its markers and lineup show #1 and #2; the ambiguous case shows all three.

## Known Stubs

None. (The Task 2 stubs existed only between the RED and GREEN commits.)

## Threat Flags

None. T-04-17 mitigated: all drawer text reaches the page through `el`/`textContent` and `setAttribute`; `tests/ui/static-safety.test.ts` stays green. T-04-18 mitigated: only `stream.commits` ranges and counts are shown with the fixed "not diff text" note, a missing commit yields no files, the caveat and per-signal arithmetic are always present, and the wording-ban test pins it. T-04-SC-06: no package installed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Ready for Plan 04-07 (copy flow and trust footer): the verdict actions row (`.verdict-actions`) already exists and takes the "Copy Markdown postmortem" button beside "Inspect evidence"; copy status should clear on drawer interaction per the UI-SPEC, and the drawer session API (`openSuspectDrawer`, `dismissSuspectDrawer`) is the hook.

## Self-Check: PASSED

`src/ui/drawer-model.ts`, `src/ui/drawer.ts` and `tests/ui/drawer-model.test.ts` exist; commits `3edc831`, `4b6268f` and `deb284b` are ancestors of HEAD; `index.html` contains `dialog#suspect-drawer`; `drawer.ts` calls `showModal()`; `npm run typecheck`, `npm test` (27 files, 371 tests) and `npm run build` pass.

---
*Phase: 04-incident-console-and-investigation-flow*
*Completed: 2026-10-19*
