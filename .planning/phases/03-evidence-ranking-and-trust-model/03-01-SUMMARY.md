---
phase: 03-evidence-ranking-and-trust-model
plan: 01
subsystem: core-analysis
tags: [scoring, evidence, ranking, determinism, typescript, vitest]

requires:
  - phase: 02-analysis-pipeline
    provides: "analyze() stream: normalized events, canonical commits, error groups, onset window"
provides:
  - "Frame ownership taxonomy (application/vendor/build-output/runtime/unattributed) and strict path/line matchers"
  - "Pre-aggregated evidence index (distinct top application frames with sorted epochs)"
  - "Frozen SCORING_V1 and scoreCommit: four ordered signals with value, weight, contribution, explanation and evidence references"
  - "Shared compareText, TraceMatchKind and TraceSummary types"
affects: [03-02 ranker and contract, 03-03 serialization and fixture contracts]

actuals:
  tokens: 13500
  tasks: 3
  commits: 0
plan_head_before: 26a32c5e4c3cc17b259fd509a310e8e2d86cdce7
plan_head_after: 26a32c5e4c3cc17b259fd509a310e8e2d86cdce7

tech-stack:
  added: []
  patterns:
    - "Aggregate events once into distinct top frames, then score commits with binary search"
    - "Map for every user-keyed collection; sorted emission with compareText"
    - "Transcendental-free arithmetic (+ - * /, floor, round, min, max, halving loop) with round6 and integer micro/tenth units"

key-files:
  created:
    - src/core/evidence.ts
    - src/core/scoring.ts
    - tests/core/evidence.test.ts
    - tests/core/scoring.test.ts
  modified:
    - src/core/model.ts
    - src/core/normalization.ts

key-decisions:
  - "Same-directory siblings and basename-only matches earn no trace credit (D-03); ambiguous suffix matches earn none and are surfaced as a feature reference"
  - "Only the first application-owned frame of each error event is scored; vendor, runtime, build-output and null-path frames never earn credit"
  - "Churn ignores build-output files and names how many were ignored"
  - "IndexedFrame carries a per-signature epoch split so evidence references never rescan events"

requirements-completed: [RANK-01, RANK-04, RANK-05, RANK-07]

coverage:
  - id: D1
    description: "Checkout culprit 2222222 scores 0.912065 and the dashboard decoy 0.544053 from real fixture text"
    requirement: RANK-01
    verification:
      - kind: unit
        ref: "tests/core/scoring.test.ts#scoring tracer: checkout fixture"
        status: pass
    human_judgment: false
  - id: D2
    description: "All eight fixture commit scores and values match the frozen golden values; displayed contributions re-add to each score"
    requirement: RANK-01
    verification:
      - kind: unit
        ref: "tests/core/scoring.test.ts#frozen scoring model > golden fixture scores"
        status: pass
    human_judgment: false
  - id: D3
    description: "Each signal carries a plain-language explanation and evidence references; zero values state why"
    requirement: RANK-04
    verification:
      - kind: unit
        ref: "tests/core/scoring.test.ts#frozen scoring model > missing evidence and boundaries"
        status: pass
    human_judgment: false
  - id: D4
    description: "Evidence references: time gap, file/line ranges, error groups, log events, churn files, ambiguity refusals"
    requirement: RANK-05
    verification:
      - kind: unit
        ref: "tests/core/evidence.test.ts#evidence index"
        status: pass
    human_judgment: false
  - id: D5
    description: "Vendor/runtime/build-output/unattributed frames, loose or ambiguous paths and line boundaries never invent evidence"
    requirement: RANK-07
    verification:
      - kind: unit
        ref: "tests/core/evidence.test.ts"
        status: pass
    human_judgment: false
  - id: D6
    description: "Scoring and evidence source contain no exponentiation or transcendental math"
    requirement: RANK-01
    verification:
      - kind: unit
        ref: "tests/core/scoring.test.ts#cross-engine arithmetic"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-10-19
status: complete
---

# Phase 3 Plan 01: Evidence primitives and frozen scoring model Summary

**Frozen four-signal commit scorer (0.35/0.30/0.25/0.10) over a strict frame/path/line evidence layer, with golden scores for all three bundled fixtures and transcendental-free arithmetic.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-10-19T12:35:26Z
- **Completed:** 2026-10-19T12:43:00Z
- **Tasks:** 3
- **Files modified:** 6 (4 created, 2 edited)

## Accomplishments

- The checkout culprit scores 0.912065 (contributions 0.315 / 0.3 / 0.25 / 0.047065) and outscores the dashboard decoy at 0.544053, computed end to end from fixture text through `analyze()`.
- All eight fixture commit scores match the golden values from the plan, and every displayed contribution equals `round6(value * weight)` and re-adds to the score.
- Evidence rules refuse to invent matches: vendor, runtime, build-output and null-path frames get no credit; suffix paths need a `/` boundary and two segments; ambiguous suffixes and same-directory siblings give zero credit; line boundaries are pinned (start, end, +/-1, distance 5 and 6).
- Scoring cost is distinct frames times changed files plus a binary search, and all evidence lists are capped by `EVIDENCE_LIMITS`.

## Task Commits

No commits were made. The user declined the protected-branch override (`master` is the protected default branch), so all work is left uncommitted in the working tree for the user's later commit script. Per-task status and file lists:

1. **Task 1: End-to-end tracer** - `uncommitted` (feat). Files: `src/core/normalization.ts`, `src/core/model.ts`, `src/core/evidence.ts`, `src/core/scoring.ts`, `tests/core/scoring.test.ts`
2. **Task 2: Refuse invented evidence** - `uncommitted` (feat/test). Files: `src/core/evidence.ts`, `src/core/scoring.ts` (ambiguous-path reference), `tests/core/evidence.test.ts`
3. **Task 3: Freeze the scoring model** - `uncommitted` (feat/test). Files: `src/core/scoring.ts`, `tests/core/scoring.test.ts`

**Plan metadata:** `uncommitted` (this SUMMARY, STATE.md, ROADMAP.md).

## Files Created/Modified

- `src/core/evidence.ts` - Frame/path classification, `matchPath`, `classifyLine`, `countAtOrAfter`, `lowerBound`, `buildEvidenceIndex`.
- `src/core/scoring.ts` - `SCORING_V1`, `SIGNAL_ORDER`, `EVIDENCE_LIMITS`, `round6`, `toMicro`, `proximityValue`, `churnValue`, `scoreCommit`.
- `src/core/model.ts` - Added `TraceMatchKind` and `TraceSummary` (additive only).
- `src/core/normalization.ts` - Added exported `compareText`; the private copies elsewhere are untouched.
- `tests/core/evidence.test.ts` - 19 tests for frames, paths, lines, index and parser-driven cases.
- `tests/core/scoring.test.ts` - 21 tests: tracer, golden values, bounds, freeze, missing evidence, source scan.

## Decisions Made

- D-03 honored: no same-directory evidence. An ambiguous suffix match adds a `feature` reference stating that no trace credit was given, so the refusal is visible.
- `IndexedFrame.signatures` (epochs per signature) was added beyond the plan's interface so error-group references use binary searches, not per-commit event scans (T-03-03).
- Trace file-range references are capped at `EVIDENCE_LIMITS.files` and ordered by matched event count, since the plan said one per matched frame but also required capped, deterministic lists.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test literal] Churn upper-bound assertion relaxed for extreme input**
- **Found during:** Task 3 (design of the bounds test)
- **Issue:** The plan asks that `churnValue(1e9, 1000)` stays below 1, but `round6` rounds 0.999999965 up to exactly 1.
- **Fix:** The test asserts `<= 1` for the extreme input and `< 1` for a realistic saturated input (10,000 lines, 1000 files). The contribution cap (`round6(churn * 0.1) <= 0.1`) is also asserted. Implementation follows the specified formula unchanged.
- **Files modified:** `tests/core/scoring.test.ts`
- **Commit:** uncommitted

**2. [Rule 1 - Test literal] Corrected a tie-break test case in evidence.test.ts**
- **Found during:** Task 2
- **Issue:** My first draft of the nearest-range test mis-computed distances (line 17 is equidistant from 14 and 20, so the lower start wins).
- **Fix:** Corrected the expected ranges. The implementation was correct.
- **Files modified:** `tests/core/evidence.test.ts`
- **Commit:** uncommitted

**Process deviation (not a code deviation):** Commits were not made because the pre-commit guard treats `master` as protected and the user chose not to override it. SUMMARY `commits:` is therefore 0 and `plan_head_after` equals `plan_head_before`; the changes are uncommitted, not absent.

**Total deviations:** 2 test-level corrections, 1 process deviation. **Impact:** none on production code; all golden values matched on the first run.

## Issues Encountered

None in the code. No golden literal had to be changed.

## Known Stubs

None.

## Threat Flags

None. The new modules are pure functions with no network, file or auth surface. T-03-01 through T-03-05 are covered by tests: path/frame refusal rules, `Map`-keyed aggregation (`__proto__/a.ts` case), distinct-frame scoring with capped references, the comment-stripped source scan, and null-path (absolute path) frames classified unattributed.

## Verification

- `npm test -- --run tests/core/evidence.test.ts tests/core/scoring.test.ts`: 40 passed.
- `npm run typecheck`: exit 0.
- `npm test` (full suite): 14 files, 103 tests passed.

## Next Phase Readiness

Plan 03-02 can build `ranking.ts` on `buildEvidenceIndex` and `scoreCommit` (it supplies `score`, `traceValue`, `timeGapMinutes`, `traceSummary`, `signals`, `evidenceReferences`). Plan 03-02 should also pick up the uncommitted state: nothing here depends on a commit existing.

## Self-Check: PASSED

- Created files exist: `src/core/evidence.ts`, `src/core/scoring.ts`, `tests/core/evidence.test.ts`, `tests/core/scoring.test.ts`.
- Commits: none exist by design (uncommitted at the user's direction).
