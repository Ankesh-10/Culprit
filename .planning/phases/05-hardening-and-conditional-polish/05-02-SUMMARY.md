---
phase: 05-hardening-and-conditional-polish
plan: 02
subsystem: testing
tags: [near-cap, performance, accessibility, headless-chrome, cdp, paging, timeline-markers]

requires:
  - phase: 05-hardening-and-conditional-polish
    provides: scripts/serve-dist.mjs production server (the render check serves dist through it, under its CSP)
  - phase: 04-incident-console-and-investigation-flow
    provides: the console views, timeline, drawer and investigation model that this plan profiles
provides:
  - scripts/near-cap-input.mjs deterministic near-cap generator (9,990 events, 9,729 buckets, 3,000 commits, no clock or randomness)
  - tests/ui/near-cap.test.ts near-cap analysis through handleAnalyzeRequest, determinism, exact cap boundaries, bounded view builders
  - pageConsidered / CONSIDERED_PAGE_SIZE and a paged "Commits considered" table
  - commitMarkers bounded to one non-suspect marker per pixel column (top three always drawn)
  - 05-render-check.mjs real-browser near-cap profile and accessibility sweep
affects: [05-03, 05-04, ship]

requirements-completed: []

actuals:
  tokens: 16057
  tasks: 3
  commits: 3
plan_head_before: 79a30e4d25e05b2bbaff0734826aab061b7dc1dd
plan_head_after: 894570bfeda80a81445ea5aeb7f64993b48236b1

tech-stack:
  added: []
  patterns:
    - "Generator sized by arithmetic: filler width derived from the fixed error-line bytes so the log lands inside the byte cap on every call"
    - "Bounded lane: non-suspect markers claim a pixel column first-come in time order; ranked markers are exempt and reserve their columns"
    - "Standalone CDP harness copied (not imported) per phase check, with ports 4175/9225 so it can run beside the gzd check"

key-files:
  created:
    - scripts/near-cap-input.mjs
    - scripts/near-cap-input.d.mts
    - tests/ui/near-cap.test.ts
    - .planning/phases/05-hardening-and-conditional-polish/05-render-check.mjs
  modified:
    - src/ui/view-model.ts
    - src/ui/shortlist.ts
    - src/ui/timeline-geometry.ts
    - tests/ui/view-model.test.ts
    - tests/ui/timeline-geometry.test.ts

key-decisions:
  - "Page 'Commits considered' at 100 rows with an in-place 'Show next 100' that keeps focus and hands it to the table region on the last page, rather than sampling or hiding rows"
  - "Bound the commit lane by pixel column, not by count: a merged marker is never one of the top three and the full list stays in Commits considered and the data table"
  - "No generator tuning was needed: the first version ranked the planted commit first, so src/core is untouched"

patterns-established:
  - "Phase checks print PASS/WARN/FAIL lines plus METRIC lines and write profile.json, ending in RESULT PASS or RESULT FAIL (n)"

coverage:
  - id: D1
    description: "A deterministic near-cap incident analyzes through the worker handler to the planted leading suspect with byte-identical canonical JSON and Markdown, and the cap boundaries (10,000/10,001 events, 1,048,576/1,048,577 bytes, >10,000 buckets) hold exactly"
    verification:
      - kind: unit
        ref: "tests/ui/near-cap.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Commits considered is paged at 100 with a true total, and non-suspect timeline markers are at most one per pixel column while #1, #2 and #3 are always drawn"
    verification:
      - kind: unit
        ref: "tests/ui/view-model.test.ts#pageConsidered"
        status: pass
      - kind: unit
        ref: "tests/ui/timeline-geometry.test.ts#commitMarkers"
        status: pass
    human_judgment: false
  - id: D3
    description: "The near-cap result renders in a real browser within budget and the keyboard, focus, reduced-motion, forced-colours and width sweep passes"
    verification:
      - kind: integration
        ref: "node .planning/phases/05-hardening-and-conditional-polish/05-render-check.mjs"
        status: pass
      - kind: integration
        ref: "node .planning/quick/261020-gzd-landing-page-with-feature-tabs-and-scrol/261020-gzd-render-check.mjs"
        status: pass
    human_judgment: true
    rationale: "Perceived smoothness on a real display is only approximated by long-task numbers; harvested into the end-of-phase UAT."

duration: 15min
completed: 2026-10-20
status: complete
---

# Phase 5 Plan 02: Near-cap inputs are profiled and every rendered list is bounded Summary

**A deterministic near-cap incident (9,990 events, 9,729 buckets, 3,000 commits) analyzes through the worker's own handler to the planted suspect, the two unbounded renders (Commits considered, non-suspect timeline markers) are now bounded without dropping evidence, and headless Chrome shows the result in about 0.3 s with no main-thread long task over 71 ms.**

## Performance

- **Duration:** about 15 min (17:51 to 18:05 IST)
- **Completed:** 2026-10-20T12:35Z
- **Tasks:** 3 (Task 1 tracer, Task 2 auto/tdd, Task 3 auto)
- **Files:** 9 (4 created, 5 modified); nothing under `src/core` changed

## Accomplishments

- `scripts/near-cap-input.mjs` builds a 1,005,180-byte log (9,990 JSON-lines events over 9,729 five-minute buckets) and a 767,964-byte history of 3,000 commits, from integer arithmetic only. The planted commit `...0bb8` ranks first and the spike is classified `spike` with no generator tuning.
- `tests/ui/near-cap.test.ts` (8 tests) pins determinism, the worker-handler result (structured-clone safe), byte-identical canonical JSON and Markdown across two analyses, the bounded log and table views (100 of 290, 100 of 9,729), one series path with one overlay, and the exact cap boundaries.
- `pageConsidered` / `CONSIDERED_PAGE_SIZE` page the Commits considered table; `renderConsidered` appends the next page in place on "Show next 100" (button keeps focus, count line updates, last page removes both and focuses the table region).
- `commitMarkers` keeps the leading and ranked markers always and an "other" marker only if its rounded pixel column is free (earlier commit, then smaller sha, wins). Bundled fixtures return the same markers as before.
- `05-render-check.mjs` profiles the near-cap result in headless Chrome and sweeps keyboard-only timeline use, focus ring, drawer focus, reduced motion, forced colours and four widths, serving `dist/` through `scripts/serve-dist.mjs` and checking its CSP header.

## Task Commits

1. **Task 1 (tracer): near-cap generator, declarations and worker-handler test** - `c31a194` (feat)
2. **Task 2: paged Commits considered and bounded marker lane** - `31f2592` (feat)
3. **Task 3: real-browser profile and accessibility sweep** - `894570b` (test)

Tracer gate: the tracer `<verify>` is automated-only and `human_verify_mode` is `end-of-phase`, so it was re-run (near-cap test, typecheck, CLI `--write`) and passed before expansion.

## Gate evidence

| Check | Result | Measured |
|-------|--------|----------|
| `npm test -- --run tests/ui/near-cap.test.ts` | PASS (8 tests) | `METRIC near-cap analyze ms 245` (510 in the full-suite run on the same host) |
| `npm test -- --run tests/ui/view-model.test.ts tests/ui/timeline-geometry.test.ts` | PASS (62 tests; RED run showed 5 failures first) | |
| `npm run typecheck && npm test && npm run build` | PASS: 36 files, 609 tests; build emitted 4 files | |
| `node .planning/phases/05-hardening-and-conditional-polish/05-render-check.mjs` (profile + a11y, Chrome via `C:\Program Files\Google\Chrome`, served by `scripts/serve-dist.mjs`) | PASS, `RESULT PASS` | table below |
| `node .planning/quick/261020-gzd-landing-page-with-feature-tabs-and-scrol/261020-gzd-render-check.mjs` | PASS, `RESULT PASS` (run after Task 2's build) | |
| `git diff --name-only 79a30e4..HEAD -- src/core` | prints nothing | |

Browser profile (1280x720, reduced motion, near-cap input chosen through the own-files file inputs):

| Metric | Measured | Budget |
|--------|----------|--------|
| `analyze-to-result-ms` | 321 | FAIL above 10,000 |
| `main-thread-responsive-ms` (`1 + 1` while analyzing) | 0 | FAIL above 1,000 |
| `result-max-longtask-ms` | 68 (earlier run 71) | FAIL above 1,500, WARN above 500 |
| `slider-step-max-longtask-ms` (10 ArrowRight steps) | 0 (max key dispatch round trip 4 ms) | FAIL above 250, WARN above 100 |
| `resize-max-longtask-ms` (1280 to 360 to 1280) | 0 | FAIL above 500 |
| `other-marker-count` | 954 markers on a 956 px plot | at most plot width + 3 |

DOM bounds on the near-cap result: 1 series path, 1 pointer overlay, 1 leading and 2 ranked markers, Commits considered 100 rows plus "Show next 100" (summary "Commits considered (3000)"; Enter appends to 200 rows with "Showing 200 of 3,000 commits" and focus kept), data table 100 rows ("Showing 100 of 9729"), signature scope 100 of 290 log lines, no horizontal scroll at 360 px.

Accessibility sweep on the checkout case (no pointer event dispatched in this section):

| Check | Result |
|-------|--------|
| No horizontal page scroll, result shown | 320 px: 320/320, 360 px: 345/360, 768 px: 753/768, 1280 px: 1265/1280 (all PASS) |
| No horizontal page scroll, drawer open | 320 px: 320/320, 1280 px: 1265/1280 (PASS) |
| Focus ring over 40 Tab presses | 39 focus stops, all `solid`, at least 2 px, `rgb(87, 193, 255)` (PASS) |
| Keyboard-only timeline | arrow key moves the readout; Enter on the slider opens log lines; Close log lines by Enter returns focus to the slider; Enter on the data table summary opens it; a row's "Show log lines" opens the panel; Space on "Filter timeline" sets `aria-pressed="true"` and the legend shows `Filtered:` (all PASS) |
| Drawer | focus lands on `#drawer-title`; 15 Tab presses stay inside; Escape closes and returns focus to "Inspect evidence" (PASS) |
| Reduced motion | `document.getAnimations().length` 0 at first detection and 700 ms later, no `.roll-ghost`, hash 2222222, score 0.91, "Matches 5 of 5 errors" exact (PASS) |
| Forced colours | verdict renders; Tab draws a solid 2 px outline (system colour); `.ambient` display none (PASS) |
| Network and console | no console errors (CSP violations included), no off-origin requests; `/` served as `text/html; charset=utf-8` with `connect-src 'none'` in the CSP (PASS) |

## Re-verification of earlier requirements (reverifies, not completed here)

`requirements-completed: []` on purpose. Checkboxes and traceability Status for these IDs are untouched.

- INPUT-03 (Phase 2, caps): `tests/ui/near-cap.test.ts` boundary tests (10,000 events accepted and 10,001 refused with `INPUT_LIMIT`; 1,048,576 bytes accepted and 1,048,577 refused; a span past 10,000 buckets refused with "exceeds the limit of 10000" as a typed failure, not a frozen page).
- UX-03 (Phase 4, bounded log and timeline rendering, nothing hidden): near-cap view-builder tests plus the browser DOM bounds (100-row pages, true totals, every considered commit reachable through "Show next 100").
- UX-04 (Phase 4, non-hover timeline paths): keyboard-only timeline checks in the a11y section (slider keys, data-table row button, signature toggle) with no pointer event.
- UX-09 (Phase 4, accessibility): focus ring, drawer focus management, reduced motion, forced colours and the four-width scroll checks.

## Deviations from Plan

None - plan executed as written. Notes, none of which changed behaviour or scope:

- No performance budget failed, so no fix to `src/ui` was needed beyond the two planned bounds. The unbounded renderers were not re-profiled for a before/after comparison, so the numbers above do not isolate how much Task 2 contributed.
- First draft of the generator produced an inverted history range for some commits (`start` greater than `end`); fixed in the same file before the Task 1 commit. No generator tuning of counts was needed.
- First browser run found two faults in the check script itself, not the product: "Show next 100" was focused while its `<details>` was closed, and the checkout onset sits on the last interval so ArrowRight is clamped there. The script now opens the details first and tries the opposite arrow when the first is clamped, then returns to the onset interval before pressing Enter.
- `git.base-branch` reports `master` as protected; commits were made on `master` as in Plan 05-01 (sequential executor on the main working tree, `branching_strategy` is `none`). No `git update-ref` or history rewrite.

**Total deviations:** 0 auto-fixed. **Impact:** none.

## Issues Encountered

- A Python heredoc probe hung the shell once (no Python on the path); replaced with a Node edit. No files were affected.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. T-05-07 mitigated (paged table, bounded marker lane, budgets enforced in the browser run); T-05-08 mitigated (generator has no clock or randomness, test asserts identical output); T-05-09 mitigated (server and debug port bind 127.0.0.1, temporary profile deleted, both processes killed on every exit path); T-05-SC: no package installed.

## Human-check for end-of-phase UAT (non-blocking here)

- Run `node scripts/near-cap-input.mjs --write <dir>`, then `npm run preview`, open http://localhost:4173/#/app, choose "Use your own files", pick `near-cap.jsonl` and `near-cap-history.json`, press Analyze incident. While it analyzes, scroll and press Tab, then step the timeline with the arrow keys and open "Commits considered". Expect the page to keep responding, the planted suspect (`0000000`) to lead within a few seconds, slider steps to feel immediate, "Commits considered (3000)" to show 100 rows and "Show next 100", and nothing to scroll sideways.

## Next Phase Readiness

Ready for 05-03. Stopping here leaves the 05-03 items (Markdown limits line, pinned fingerprints, browser rehearsal, stale README Limitations sentence) and polish undone; the Docker image proof is still pending the CI run recorded by Plan 05-01.

## Self-Check: PASSED

Created files exist (`scripts/near-cap-input.mjs`, `scripts/near-cap-input.d.mts`, `tests/ui/near-cap.test.ts`, `05-render-check.mjs`); commits `c31a194`, `31f2592`, `894570b` are on `master`; `src/core` diff against the plan base is empty; acceptance criteria re-checked through the gate evidence runs above.

---
*Phase: 05-hardening-and-conditional-polish*
*Completed: 2026-10-20*
