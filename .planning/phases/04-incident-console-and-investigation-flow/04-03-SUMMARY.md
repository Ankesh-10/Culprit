---
phase: 04-incident-console-and-investigation-flow
plan: 03
subsystem: ui
tags: [plain-dom, verdict-card, suspect-lineup, utc-formatting, wording-guard, vitest]

requires:
  - phase: 04-incident-console-and-investigation-flow
    provides: "Plan 04-01 worker client, DOM helpers, verdict headline; Plan 04-02 page state machine, status panels, token stylesheet"
provides:
  - Deterministic string-sliced UTC, duration, score, range and plural formatters (no clock, locale or zone API)
  - Full evidence-first verdict view and renderer (caution banner, facts, trace chip, score with helper, evidence preview)
  - Suspect lineup (top-three cards) and "Commits considered" table with verbatim exclusion reasons
  - Done-state composition per result kind (verdict + lineup + considered, or state panel [+ considered])
  - Wording guard test that rejects causal phrases and percentages across all three bundled cases
affects: [04-04, 04-05, 04-06, 04-07, 04-08]

estimate:
  tokens: 62000
  tasks: 2

actuals:
  tokens: 12100
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Formatters slice normalized ISO strings with one regex; non-ISO input is returned unchanged"
    - "Views are pure data (VerdictView, ShortlistView, ConsideredRow); renderers only turn them into text-only DOM"
    - "Score meter fill width is set through a --fraction custom property via style.setProperty, never an HTML string"
    - "Wording guard walks every string of the three view builders and bans causal phrases and percentages"

key-files:
  created:
    - src/ui/format.ts
    - src/ui/shortlist.ts
    - tests/ui/format.test.ts
    - tests/ui/view-model.test.ts
  modified:
    - src/ui/view-model.ts
    - src/ui/verdict.ts
    - src/ui/app.ts
    - src/styles.css

key-decisions:
  - "Files and lines are deduplicated on path plus line range before taking the first two, so the checkout duplicate payment.ts reference collapses and moreCount is 0"
  - "The info icon beside the confidence words is driven by a new confidence.hasLabels flag; the caution banner shows for a low band or any label"
  - "Empty exclusion reasons render as an em dash in the table while the view keeps an empty string"
  - "Score meters are decorative (aria-hidden); the numeric score and 'rounded for display' caption are always visible text"

requirements-completed: [UX-02, UX-08, UX-09]

coverage:
  - id: D1
    description: "Verdict card for the checkout case shows 2222222, subject, Jordan Lee, 2026-10-19 04:18 UTC, 12 min before onset window start, deduplicated file ranges, Matches 5 of 5 errors, Exact line, score 0.91 with helper and standing caveat"
    requirement: UX-02
    verification:
      - kind: unit
        ref: "tests/ui/view-model.test.ts#buildVerdictView shows every evidence fact for the checkout case"
        status: pass
    human_judgment: true
    rationale: "Visual hierarchy, 48px mono hash, clamping and two-column layout need a browser; deferred to the Plan 04-08 walk-through."
  - id: D2
    description: "Confidence in words, three-segment meter and chips; ambiguous caution banner with four ordered chips and Leading candidate; slow-burn ramp caveat and Medium"
    requirement: UX-08
    verification:
      - kind: unit
        ref: "tests/ui/view-model.test.ts#buildVerdictView"
        status: pass
    human_judgment: true
    rationale: "That the meter and warning stripe read without colour is a rendered judgment."
  - id: D3
    description: "Deterministic UTC, duration, score, range and plural formatting identical under different process time zones"
    requirement: UX-02
    verification:
      - kind: unit
        ref: "tests/ui/format.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Suspect lineup rows (2/3/3, null for zero suspects) and Commits considered rows including 3333333 Excluded with its verbatim reason and a synthetic Scored mapping"
    requirement: UX-02
    verification:
      - kind: unit
        ref: "tests/ui/view-model.test.ts#buildShortlistView"
        status: pass
      - kind: unit
        ref: "tests/ui/view-model.test.ts#buildConsideredRows"
        status: pass
    human_judgment: true
    rationale: "Three/two/one column responsive lineup, 3-line clamp and the scrollable table at 360px are layout behaviours; deferred to the Plan 04-08 walk-through."
  - id: D5
    description: "No verdict, lineup or considered text says caused, root cause, culprit found, broke production or shows a percentage"
    requirement: UX-08
    verification:
      - kind: unit
        ref: "tests/ui/view-model.test.ts#wording guard"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-10-19
status: complete
plan_head_before: 11c6d32d60d3ff14d68799923a12b9947061500c
plan_head_after: f0f8730a9d314f0b242b6173e228a275c7c1ce85
commits: 3
---

# Phase 4 Plan 03: Evidence-first verdict card and the suspect lineup Summary

**The headline became a full evidence-first verdict card (hash, subject, author, UTC commit time, gap, deduplicated file ranges, matching errors, trace chip, 2-decimal score with caveat, confidence in words, segments and chips) followed by a "Suspect lineup" of ranked cards and an explicit "Commits considered" table, all through string-sliced formatters that ignore the viewer's time zone.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-10-19T17:08:11Z
- **Completed:** 2026-10-19T17:14:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- `src/ui/format.ts`: `formatUtcClock/DateTime/Seconds/Interval`, `formatDuration`, `formatTimeGap`, `formatGapShort`, `formatScore`, `plural`, `formatMiB`, `formatLineRange`, `formatPathRange`, `formatCompactCount`, `traceMatchLabel`; no Date construction, locale or clock API, proven identical under `Asia/Kolkata` and `America/Los_Angeles`.
- `buildVerdictView` now carries `caution`, `facts` (Author, Committed, Time gap, Onset, Files and lines, Matching errors), `traceChip`, `score`, `scoreHelper`, `evidencePreview`; `buildStatusView` uses `plural`.
- `renderVerdict` follows the UI-SPEC order: heading row with the `role="img"` confidence meter, caution banner with warning stripe and ordered chips, interpretation, headline, description-list facts, score row, evidence preview and the standing caveat; 2fr/1fr from 1024px.
- `buildShortlistView` / `buildConsideredRows` and `renderShortlist` / `renderConsidered`: one card per suspect (text tag "Leading" on #1, aqua diamond only on #1), and a details/summary table with Rank, Short hash, Subject, Status, Score and Reason in a focusable scroll region.
- `app.ts` composes verdict + lineup + considered for completed and low-confidence results, state panel + considered for no-eligible-commits, and only the panel for no-incident and insufficient-data.

## Task Commits

1. **Task 1: Tracer, verdict card with deterministic formatting** - `2393c84` (feat)
2. **Task 2 RED: failing lineup, considered-list and wording-guard tests** - `0979b83` (test)
3. **Task 2 GREEN: lineup, commits considered and result composition** - `f0f8730` (feat)

**Plan metadata:** committed separately (docs: complete plan)

## Tracer gate

Task 1 tracer verified end to end (format, view-model, tracer, static-safety and page-states tests, typecheck, full suite and build) before Task 2 expanded. `human_verify_mode` is `end-of-phase` and the tracer's `<verify>` is automated-only, so no checkpoint was raised.

## TDD notes (Task 2)

- RED (`0979b83`): `buildShortlistView` and `buildConsideredRows` were interface-only stubs throwing "not implemented"; 8 tests failed on that throw (lineup counts, null case, checkout rows, considered rows, synthetic Scored, three wording-guard cases) with typecheck green. Semantic assessment: valid RED, failing on the planned behaviors rather than import or syntax faults. `workflow.tdd_mode` is not enabled, so the `tdd-red-evidence` classifier was not run.
- GREEN (`f0f8730`): 24 files / 279 tests pass; typecheck and build pass.
- REFACTOR: none needed.

## Files Created/Modified
- `src/ui/format.ts` - deterministic UTC, duration, score, range, plural formatters
- `src/ui/view-model.ts` - extended `VerdictView`, new `ShortlistView`/`ConsideredRow` builders
- `src/ui/verdict.ts` - full verdict renderer, exported confidence and score meters
- `src/ui/shortlist.ts` - lineup and considered renderers
- `src/ui/app.ts` - done-state composition per result kind
- `src/styles.css` - verdict, meter, caution banner, lineup grid, table and forced-colors rules
- `tests/ui/format.test.ts`, `tests/ui/view-model.test.ts` - 10 + 11 tests

## Decisions Made
- Files and lines are deduplicated before slicing to two, matching the plan's checkout expectation (`moreCount` 0).
- `confidence.hasLabels` drives the info icon; the caution banner shows for a low band or any label.
- Score meters are decorative; value and the "rounded for display" caption are always text.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- A scratch Python edit turned `\b` in a regex into backspace characters and a `'\n'` into a literal newline in `tests/ui/view-model.test.ts`; both were caught by the typecheck and the red run and corrected before the RED commit. No production file was affected.
- The Task 2 human-check (1280x720 and 360x740 walk-through of lineup columns, clamping, scrollable table) was not run in a real browser here; it is non-blocking and deferred to Plan 04-08 as the plan specifies.
- The verdict's "Inspect evidence" / "See all evidence" and "Copy Markdown postmortem" controls are intentionally absent until Plans 04-06 and 04-07.

## Known Stubs

None. (The `buildShortlistView` / `buildConsideredRows` stubs existed only between the RED and GREEN commits.)

## Threat Flags

None. T-04-09 (all values via `el` text and `setAttribute`; static-safety green), T-04-10 (confidence in words plus segments plus chips, standing caveat and score helper always rendered, wording guard) and T-04-11 (every supplied commit listed with status text and verbatim exclusion reason) are implemented and tested.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Ready for Plan 04-04. The verdict, lineup and considered list are in place; the timeline, drawer ("Inspect evidence") and copy flow attach to these regions.

## Self-Check: PASSED

All plan files exist (`src/ui/format.ts`, `src/ui/shortlist.ts`, `tests/ui/format.test.ts`, `tests/ui/view-model.test.ts` and the four modified files); commits `2393c84`, `0979b83`, `f0f8730` are ancestors of HEAD; `npm run typecheck`, `npm test` (24 files, 279 tests) and `npm run build` pass.

---
*Phase: 04-incident-console-and-investigation-flow*
*Completed: 2026-10-19*
