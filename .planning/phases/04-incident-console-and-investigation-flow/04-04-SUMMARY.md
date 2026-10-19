---
phase: 04-incident-console-and-investigation-flow
plan: 04
subsystem: ui
tags: [plain-dom, svg-timeline, slider, log-lines, table-twin, label-collisions, vitest]

requires:
  - phase: 04-incident-console-and-investigation-flow
    provides: "Plan 04-01 DOM helpers and worker client; Plan 04-02 page state machine and token stylesheet; Plan 04-03 verdict, lineup, considered list and formatters"
provides:
  - Pure timeline geometry (domain with clip rule, shared UTC scale, single line/area/overlay paths, onset band, nearest-bucket lookup, commit markers, label collisions, ticks, domain note)
  - Pure investigation model (selection reducer, readout text, log line selection, log panel view, table twin rows)
  - One accessible SVG timeline (slider, readout bar, legend, jump buttons, tooltip, table twin) wired into every done-state result
  - Log lines panel with focus-in on open and focus-return on close
affects: [04-05, 04-06, 04-07, 04-08]

estimate:
  tokens: 74000
  raw_tokens: 74000
  tasks: 2
  confidence: low

actuals:
  tokens: 22600
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Geometry and selection state are pure modules; renderers only turn them into text-only DOM and SVG built with svgEl"
    - "renderTimeline returns a view with update(state), so keyboard steps move the crosshair, readout and table highlight in place and never lose focus or the table disclosure state"
    - "Controls that can open the log panel carry data-focus-id; the app remembers the id and re-resolves it on close, falling back to the slider"
    - "A 10,000-interval timeline is one line path, one area path and one pointer overlay rect; pointer lookups reuse precomputed bucket centres"
    - "Labels are resolved by priority (onset, #1, #2/#3, peak) with clamp-then-intersect; a dropped label never removes its marker"

key-files:
  created:
    - src/ui/timeline-geometry.ts
    - src/ui/investigation-model.ts
    - src/ui/timeline.ts
    - src/ui/log-lines.ts
    - tests/ui/timeline-geometry.test.ts
    - tests/ui/investigation-model.test.ts
  modified:
    - src/ui/app.ts
    - src/styles.css
    - index.html

key-decisions:
  - "PageUp is step -12 and PageDown is +12, exactly as the plan states (the reverse of the ARIA slider convention)"
  - "The timeline is built once per result and updated in place; the ResizeObserver redraws only the SVG, so the slider element keeps focus"
  - "Tick count, plot height and the #2/#3 label drop follow the viewport width (window.innerWidth), while the SVG width follows its container"
  - "Tooltip lines are the readout text split on the separator, so the tooltip and the readout bar cannot drift apart"
  - "A row button in the table twin dispatches select then open-log-lines with the opener id row-N, and the table disclosure is reopened if focus must return to it"

requirements-completed: [UX-03, UX-04, UX-09]

coverage:
  - id: D1
    description: "One shared-UTC-axis chart with errors line and wash, onset band with bracket and 'Onset window' label, and a commit lane with a 16px leading diamond '#1 {shortSha}', 12px '#2'/'#3' diamonds and 8px hollow others"
    requirement: UX-03
    verification:
      - kind: unit
        ref: "tests/ui/timeline-geometry.test.ts#commitMarkers"
        status: pass
      - kind: unit
        ref: "tests/ui/timeline-geometry.test.ts#onsetBand"
        status: pass
    human_judgment: true
    rationale: "Rendered appearance was inspected with headless Chrome screenshots at 1280 and 360 widths, but sign-off on label legibility and clipping is deferred to the Plan 04-08 walk-through."
  - id: D2
    description: "Domain rule: earlier of first interval and earliest eligible commit to the later of last interval and latest eligible commit, clipped to one log span before the first interval beyond six log spans, with earlier/later notes"
    requirement: UX-03
    verification:
      - kind: unit
        ref: "tests/ui/timeline-geometry.test.ts#computeDomain"
        status: pass
      - kind: unit
        ref: "tests/ui/timeline-geometry.test.ts#domainNote"
        status: pass
    human_judgment: false
  - id: D3
    description: "Onset interval selected on load (2/2/1) and the readout bar states '04:30–04:35 UTC · 3 errors · 1 signature · Inside onset window' with 'Show log lines (3)', announced as one polite atomic unit"
    requirement: UX-04
    verification:
      - kind: unit
        ref: "tests/ui/investigation-model.test.ts#default and peak selection"
        status: pass
      - kind: unit
        ref: "tests/ui/investigation-model.test.ts#buildReadout"
        status: pass
    human_judgment: false
  - id: D4
    description: "Slider keyboard map, Jump to onset/peak, readout log button and per-row table buttons reach the log lines without hover; the panel takes focus on open and Close returns it to the opener"
    requirement: UX-04
    verification:
      - kind: unit
        ref: "tests/ui/investigation-model.test.ts#reduceInvestigation"
        status: pass
      - kind: unit
        ref: "tests/ui/investigation-model.test.ts#log lines"
        status: pass
    human_judgment: true
    rationale: "DOM keyboard and focus behaviour has no automated browser test in the MVP. It was driven through headless Chrome over the DevTools protocol (arrows, PageDown, Home, End, Enter, close, row buttons, jump buttons, hover) with all expected values observed; the full keyboard walk-through is deferred to Plan 04-08."
  - id: D5
    description: "Label collisions by priority with clamp, #2/#3 always dropped on phone, a dropped label never removes its marker"
    requirement: UX-09
    verification:
      - kind: unit
        ref: "tests/ui/timeline-geometry.test.ts#resolveLabels"
        status: pass
    human_judgment: true
    rationale: "Collision outcome on real glyph widths and the 360px layout needs a rendered check; seen correct in screenshots, formal sign-off in Plan 04-08."
  - id: D6
    description: "Table twin has exactly one row per interval (3/8/5) with text onset flags, 100-row paging and a true total; log panel shows the empty text for a quiet interval"
    requirement: UX-04
    verification:
      - kind: unit
        ref: "tests/ui/investigation-model.test.ts#buildTableTwinRows"
        status: pass
    human_judgment: false
  - id: D7
    description: "10,000-interval timeline draws as one line path (one M, 9,999 L), one area path and one overlay rect"
    requirement: UX-09
    verification:
      - kind: unit
        ref: "tests/ui/timeline-geometry.test.ts#paths"
        status: pass
    human_judgment: false

duration: 14min
completed: 2026-10-19
status: complete
plan_head_before: 873dfd3d44f3800454a59090b7b3751e35268ab6
plan_head_after: 86c051e51842090477cc87088cbcb721d46843f5
commits: 3
---

# Phase 4 Plan 04: Linked timeline investigation and log lines Summary

**A hand-authored SVG timeline on one shared UTC axis (errors line and wash, onset band, ranked commit diamonds with priority-resolved labels) that is a keyboard slider with an always-visible readout bar, jump buttons, hover tooltip and a paged data-table twin, all opening a focus-managed log lines panel for the selected interval.**

## Performance

- **Duration:** 14 min
- **Completed:** 2026-10-19T17:28:07Z
- **Tasks:** 2
- **Files:** 9 (6 created, 3 modified)

## Accomplishments
- `src/ui/timeline-geometry.ts`: `computeDomain` (clip at six log spans, inclusive hidden counts), `createXScale`, `yForValue`, `seriesPath`/`areaPath` (two-decimal strings), `buildPlotGeometry` (exactly one overlay rect), `onsetBand`, `nearestBucketIndex`/`bucketIndexFromX` (binary search, ties earlier), `commitMarkers`, `resolveLabels`/`clampLabelX`/`estimateLabelWidth`, `computeTicks`, `domainNote`.
- `src/ui/investigation-model.ts`: selection state and `reduceInvestigation` (clamped step, jumps, open/close, paging), `defaultBucketIndex` (2/2/1), `peakBucketIndex` (2/1/1), `buildReadout`, `selectLogLines` (eventId map cached per stream in a `WeakMap`), `buildLogPanelView`, `buildTableTwinRows`.
- `src/ui/timeline.ts`: gridlines at 0/mid/max, baseline, onset band with bracket, peak dot, commit lane with surface rings and a leader for the leading suspect, direct labels filtered through `resolveLabels`, UTC ticks with the date once in the axis title, mark-shaped legend, `role="slider"` wrapper with the specified aria attributes and key map, readout bar, hover tooltip on fine pointers, domain note, and the "Timeline data table" disclosure.
- `src/ui/log-lines.ts` and `src/ui/app.ts`: log panel with `Close log lines`, "Show next 100", empty text; the app keeps investigation state, remembers the opener id and returns focus on close; "Skip to timeline" is shown only while a timeline exists.
- Headless Chrome (DevTools protocol) check against the built preview: onset interval selected on load for checkout, slow-burn and ambiguous, readout text exact, no console errors, no horizontal scroll at 360px, `#2`/`#3` labels dropped at 360px, tooltip text matches the readout.

## Task Commits

1. **Task 1: Tracer, onset interval selected, readout bar, log lines panel** - `33e1286` (feat)
2. **Task 2 RED: failing marker, label-collision, tick, domain-note and table-twin tests** - `54d08c8` (test)
3. **Task 2 GREEN: complete chart, jump buttons, tooltip, table twin, skip link** - `86c051e` (feat)

**Plan metadata:** committed separately (docs: complete plan)

## Tracer gate

Task 1 tracer verified end to end (geometry and model tests, typecheck, build, static-safety) before Task 2 expanded. `human_verify_mode` is `end-of-phase` and the tracer's `<verify>` is automated-only, so no checkpoint was raised.

## TDD notes (Task 2)

- RED (`54d08c8`): `commitMarkers`, `estimateLabelWidth`, `clampLabelX`, `resolveLabels`, `computeTicks`, `domainNote` and `buildTableTwinRows` were interface-only stubs throwing "not implemented"; 18 tests failed on that throw with typecheck green. Valid RED: the planned behaviours fail, not imports or syntax. `workflow.tdd_mode` is not enabled, so the `tdd-red-evidence` classifier was not run.
- GREEN (`86c051e`): 26 files / 324 tests pass; typecheck and build pass.
- REFACTOR: none needed.

## Files Created/Modified
- `src/ui/timeline-geometry.ts`, `src/ui/investigation-model.ts` - pure modules
- `src/ui/timeline.ts`, `src/ui/log-lines.ts` - renderers
- `src/ui/app.ts` - investigation state, composition, focus handling, skip-link toggle
- `src/styles.css` - timeline, legend, marks, tooltip, readout, table twin, log table, forced-colors and print rules
- `index.html` - "Skip to timeline" link
- `tests/ui/timeline-geometry.test.ts`, `tests/ui/investigation-model.test.ts` - 31 + 27 cases (13 + 14 in the tracer, the rest from the RED commit)

## Decisions Made
- PageUp/PageDown follow the plan literally (PageUp -12, PageDown +12).
- Timeline is updated in place via `view.update(state)` instead of re-rendered, which keeps slider focus, the open table disclosure and the pointer overlay stable.
- Viewport width (not container width) drives tick count, plot height and `#2`/`#3` label dropping, matching the UI-SPEC breakpoints.
- Tooltip content is derived from the readout string so the two cannot disagree.

## Deviations from Plan

None - plan executed exactly as written.

(Two small additions inside the plan's intent: `onsetBucketIndex`/`investigationContext` helpers shared by the reducer and renderer, and an optional precomputed `centers` argument on `nearestBucketIndex`/`bucketIndexFromX` so hover stays O(log n) at 10,000 intervals.)

## Issues Encountered
- A first Bash call mixing a quoted heredoc and a `grep` pattern with non-ASCII characters failed to parse; no command ran. The appended tests were written through scratch files instead and verified.
- The Task 2 human-check (real browser at 1280x720 and 360x740) is non-blocking and deferred to Plan 04-08. A programmatic Chrome run over the DevTools protocol was done as an early signal (see Accomplishments), not as the sign-off.
- Peak label "Peak N" is dropped when it overlaps the onset label (for example checkout and ambiguous, where the peak is inside the onset window); the peak dot and the readout still carry the value, as the priority rule specifies.

## Known Stubs

None. (The Task 2 stubs existed only between the RED and GREEN commits.)

## Threat Flags

None. T-04-12 (SVG and table text only via `svgEl`/`el` text and `setAttribute`; static-safety green), T-04-13 (one path per series, one overlay rect, 100 rows at a time, eventId map built once per stream; near-cap interactive profiling remains the Phase 5 backstop) and T-04-SC-04 (no package added) are implemented.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Ready for Plan 04-05 (signature table and filter): `InvestigationState` carries no filter yet, and `buildLogPanelView`/`buildTableTwinRows` are the slice points to extend. Plan 04-06 makes the top-three commit markers focusable buttons.

## Self-Check: PASSED

All plan files exist (`src/ui/timeline-geometry.ts`, `src/ui/investigation-model.ts`, `src/ui/timeline.ts`, `src/ui/log-lines.ts`, `tests/ui/timeline-geometry.test.ts`, `tests/ui/investigation-model.test.ts` and the three modified files); commits `33e1286`, `54d08c8`, `86c051e` are ancestors of HEAD; `npm run typecheck`, `npm test` (26 files, 324 tests) and `npm run build` pass; `index.html` contains the "Skip to timeline" link targeting `#timeline-title`.

---
*Phase: 04-incident-console-and-investigation-flow*
*Completed: 2026-10-19*
