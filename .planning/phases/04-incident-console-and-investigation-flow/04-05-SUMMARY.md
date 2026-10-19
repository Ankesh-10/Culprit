---
phase: 04-incident-console-and-investigation-flow
plan: 05
subsystem: ui
tags: [plain-dom, error-signatures, filter, emphasis-chart, log-scope, vitest]

requires:
  - phase: 04-incident-console-and-investigation-flow
    provides: "Plan 04-04 investigation model, SVG timeline, readout bar, log lines panel and table twin"
provides:
  - Error signatures table with aria-pressed "Filter timeline" toggles (UX-06)
  - One-signature filter threaded through chart, readout, log lines and data table
  - Emphasis chart form (gray total plus blue signature line, no y-axis rescale)
  - Filter chip with "Clear filter", bucket and signature log scopes
affects: [04-06, 04-07, 04-08]

estimate:
  tokens: 48000
  raw_tokens: 48000
  tasks: 2
  confidence: low

actuals:
  tokens: 8500
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Filter state lives in the pure investigation reducer (filter, logPanel.scope); renderers only draw it"
    - "renderSignatures returns { element, update, focusById } and updates pressed state in place so a focused toggle keeps focus"
    - "Signature-keyed lookups on plain-object signatureCounts go through Object.hasOwn (countForSignature)"
    - "The y-axis maximum always comes from the unfiltered totals (buildSeries.yMax)"

key-files:
  created:
    - src/ui/signatures.ts
  modified:
    - src/ui/investigation-model.ts
    - src/ui/timeline.ts
    - src/ui/app.ts
    - src/ui/format.ts
    - src/styles.css
    - tests/ui/investigation-model.test.ts

key-decisions:
  - "A selection change (slider, jump, table row) returns an open signature-scope log panel to the selected interval (bucket scope), so the panel never contradicts the readout"
  - "A signature-scope open request without an active filter falls back to bucket scope"
  - "Filtered readout noun follows the interval total: '1 of 2 errors', '0 of 1 error'"
  - "While filtering, the peak dot stays on the unfiltered peak but is drawn in context gray; the selection ring follows the emphasised series"
  - "Clear filter returns focus to the slider when the control removed itself; a signature toggle keeps focus because it is updated in place"
  - "The empty-table text lives once in the model (NO_ERRORS_TEXT) and signatures.ts renders it from the view"

requirements-completed: [UX-06, UX-04, UX-09]

coverage:
  - id: D1
    description: "Error signatures table lists every signature with Events and First seen (HH:MM:SS UTC, full date in title and in the accessible name only when the day differs), sorted events desc, first seen, signature; ambiguous order cameras, notebooks, tablets"
    requirement: UX-06
    verification:
      - kind: unit
        ref: "tests/ui/investigation-model.test.ts#buildSignatureRows"
        status: pass
      - kind: unit
        ref: "tests/ui/investigation-model.test.ts#signature table edge cases"
        status: pass
    human_judgment: false
  - id: D2
    description: "Toggle is aria-pressed, reads 'Filtering — clear' when pressed with accent rule plus check icon, one active signature at a time"
    requirement: UX-06
    verification:
      - kind: unit
        ref: "tests/ui/investigation-model.test.ts#buildSignatureRows"
        status: pass
      - kind: unit
        ref: "tests/ui/investigation-model.test.ts#filter scope transitions"
        status: pass
    human_judgment: true
    rationale: "Rule and icon rendering was seen in a headless Chrome screenshot at 1280px; sign-off on visuals at both widths is deferred to the Plan 04-08 walk-through."
  - id: D3
    description: "Filtering draws the emphasis form (gray All errors, blue filtered line) without rescaling the y-axis; legend reads 'Filtered: {signature}'"
    requirement: UX-06
    verification:
      - kind: unit
        ref: "tests/ui/investigation-model.test.ts#buildSeries"
        status: pass
    human_judgment: true
    rationale: "Series maths is unit-tested; line rendering and legend text were observed in headless Chrome (y ticks stayed 2/1/0) with formal sign-off in Plan 04-08."
  - id: D4
    description: "Cameras filter on the ambiguous case reads '10:05–10:10 UTC · 1 of 2 errors · 2 signatures · Inside onset window'; turning the filter on opens all 2 events of the signature, and Show log lines for an interval shows only its matching events"
    requirement: UX-04
    verification:
      - kind: unit
        ref: "tests/ui/investigation-model.test.ts#signature filter"
        status: pass
      - kind: unit
        ref: "tests/ui/investigation-model.test.ts#log panel headings with a filter"
        status: pass
    human_judgment: false
  - id: D5
    description: "Filter chip with Clear filter, filtered data-table Errors column [0, 1, 0, 1, 0], scope transitions on clear, empty-table text, prototype-safe signature lookups"
    requirement: UX-06
    verification:
      - kind: unit
        ref: "tests/ui/investigation-model.test.ts#filtered data table"
        status: pass
      - kind: unit
        ref: "tests/ui/investigation-model.test.ts#countForSignature"
        status: pass
    human_judgment: true
    rationale: "Chip, Clear filter focus handling and the 360px horizontal scroll of the signatures region were driven through headless Chrome (CDP) with expected values; the manual keyboard and phone walk-through is deferred to Plan 04-08."

duration: 5 min
completed: 2026-10-19
status: complete
plan_head_before: 71387d97723f54e8cecb46e764e7a0e07b9416d2
plan_head_after: d5041cf874baef97c17e20fa8e7e75d3e66965bc
commits: 2
---

# Phase 4 Plan 05: Error signatures that filter the investigation Summary

**An accessible error-signatures table whose aria-pressed toggles filter the chart (gray total plus blue signature line on an unchanged y-axis), the readout ("1 of 2 errors"), the log lines (signature scope or interval scope) and the data table, with a "Filtered: ..." chip and Clear filter, on prototype-safe signature lookups.**

## Performance

- **Duration:** 5 min measured from the first edit (plus reading time before it)
- **Completed:** 2026-10-19T17:37:12Z
- **Tasks:** 2
- **Files:** 7 (1 created, 6 modified)

## Accomplishments
- `src/ui/investigation-model.ts`: `filter` and `logPanel.scope` on `InvestigationState`, `set-filter` event, `countForSignature` (`Object.hasOwn`), `buildSignatureRows`, `buildSeries` (yMax from totals), filter-aware `buildReadout`, `selectLogLines`, `buildLogPanelView` (both heading forms) and `buildTableTwinRows`.
- `src/ui/signatures.ts`: `renderSignatures` region (`role="region"`, `aria-label="Error signatures"`, `tabindex="0"`) with sticky first column on phones, `th scope="row"` carrying the accessible name, mono signature plus a 2-line-clamped representative message, tabular Events, First seen with a date `title`, and in-place-updating toggles.
- `src/ui/timeline.ts`: emphasis form, legend keys 'All errors' and 'Filtered: {signature}', header chip with 'Clear filter', and a full re-render (chart, legend, chip, table twin) on filter change.
- `src/ui/app.ts`: signatures section after the timeline and log panel, combined re-render on every investigation event, shared focus resolver for timeline and signatures openers, focus rescue when Clear filter removes itself.
- Headless Chrome (CDP) run against the built preview: ambiguous case, cameras toggle gave pressed state, chip, legend, readout `10:05–10:10 UTC · 1 of 2 errors · 2 signatures · Inside onset window`, 2 log rows, y ticks 2/1/0, table Errors `0,1,0,1,0`; stepping then "Show log lines" gave the interval scope with the signature; Clear filter restored everything and focused the slider; toggle on then off kept focus on the toggle and closed the panel; at 360px the page did not scroll horizontally and the signatures region scrolled internally (577px content in a 264px region); no console errors.

## Task Commits

1. **Task 1 (tracer): signature filter across chart, readout and log lines** - `dd458fc` (feat)
2. **Task 2: edge cases, filtered data table, scope transitions, prototype-safe lookups (tests)** - `d5041cf` (test)

**Plan metadata:** committed separately (docs: complete plan)

## Tracer gate

Task 1 tracer verified end to end (investigation-model and timeline-geometry tests, typecheck, build, static-safety) before Task 2. `human_verify_mode` is `end-of-phase` and the tracer `<verify>` is automated-only, so no checkpoint was raised.

## TDD notes (Task 2)

The tracer implementation already contained every Task 2 behaviour the pure model needs (empty text, accessible-date rule, filtered table twin, `set-filter(null)` transitions, both heading forms, the `Object.hasOwn` guard) and the chip, Clear filter and empty row, so Task 2's new tests passed on first run and no valid RED state existed: there was no failing step to commit. They are characterization tests. Their strength was checked by mutation: replacing the `Object.hasOwn` guard with a plain lookup made 2 tests fail (the 'constructor' cases); the guard was restored. `workflow.tdd_mode` is not enabled, so the `tdd-red-evidence` classifier was not run.

## Files Created/Modified
- `src/ui/signatures.ts` - new signatures table renderer
- `src/ui/investigation-model.ts`, `src/ui/timeline.ts`, `src/ui/app.ts`, `src/styles.css` - filter state, emphasis form, chip, composition, styles (including forced-colors rules)
- `src/ui/format.ts` - `formatUtcDateSeconds` for the first-seen `title`
- `tests/ui/investigation-model.test.ts` - 9 new cases in the tracer plus 18 in Task 2 (44 total)

## Decisions Made
See `key-decisions` in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

None. Two small things differ from the plan text:

- **`src/ui/format.ts` added to the file list.** `formatUtcDateSeconds` (`YYYY-MM-DD HH:MM:SS UTC`) was added instead of slicing ISO strings in the model, so non-ISO input degrades like the other formatters. Commit `dd458fc`.
- **Empty-table string location.** The acceptance wording "`src/ui/signatures.ts` contains 'No errors in this log'" is met by behaviour, not by literal text: the string is the model constant `NO_ERRORS_TEXT` that `signatures.ts` renders (single source of truth, unit-tested). `src/ui/log-lines.ts` needed no change because it already renders the heading text from `buildLogPanelView`.

**Total deviations:** 0 auto-fixed, 2 clarifications. **Impact:** none on behaviour.

## Issues Encountered
- A first Bash call mixing a heredoc and non-ASCII characters failed to parse before running; the edit scripts were rewritten through the Write tool and applied from files.
- The Task 2 human-check (real browser at both widths) is non-blocking and deferred to Plan 04-08; the CDP run above is an early signal, not the sign-off.
- Readout reads "0 of 0 errors" on a quiet interval while filtering (spec form `{filtered} of {total} errors`); left as specified.

## Known Stubs

None.

## Threat Flags

None. T-04-15 mitigated and tested (`Object.hasOwn`; 'constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf' return 0 on every checkout interval, and a mutation check proved the tests bite). T-04-16 mitigated: signature text reaches the page only through `textContent`, `setAttribute` and `el`/`svgEl` text children (static-safety green). T-04-SC-05: no package installed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Ready for Plan 04-06 (suspect drawer): its "Show matching log lines" action can dispatch `set-filter(signature)` then `open-log-lines` with scope `signature` using the same events, and `focusControl` in `app.ts` is the place to add drawer opener ids.

## Self-Check: PASSED

`src/ui/signatures.ts` exists; commits `dd458fc` and `d5041cf` are ancestors of HEAD; `npm run typecheck`, `npm test` (26 files, 350 tests) and `npm run build` pass.

---
*Phase: 04-incident-console-and-investigation-flow*
*Completed: 2026-10-19*
