---
phase: 03-evidence-ranking-and-trust-model
plan: 02
subsystem: core-analysis
tags: [ranking, confidence, determinism, typescript, vitest, input-limits]

requires:
  - phase: 03-evidence-ranking-and-trust-model
    provides: "Plan 03-01 scoreCommit, buildEvidenceIndex, SCORING_V1, toMicro/round6, shared compareText, TraceSummary"
provides:
  - "rankSuspects: eligibility (inclusive at onset window start), integer micro-unit total order, top-three cap, per-commit dispositions"
  - "deriveConfidence: band plus low-confidence / ambiguous / weak-evidence / no-clear-culprit labels from separation, line-level share, stack coverage and onset class"
  - "Required result contract: ScoredSuspect.timeGapMinutes/traceSummary, ConfidenceRationale.labels, AnalysisResult.ranking, AnalysisStream.ranking"
  - "analyze() computes the ranking; toAnalysisResult projects suspects, confidence, ranking and interpretation; timeline commitShas populated"
  - "MAX_BUCKETS = 10_000 guard turned into a typed INPUT_LIMIT outcome so analyze() stays total"
affects: [03-03 markdown rendering and fixture contracts, 04 verdict card / drawer / commit lane]

actuals:
  tokens: 13568
  tasks: 3
  commits: 0
plan_head_before: 26a32c5e4c3cc17b259fd509a310e8e2d86cdce7
plan_head_after: 26a32c5e4c3cc17b259fd509a310e8e2d86cdce7
commits: 0 (uncommitted)

tech-stack:
  added: []
  patterns:
    - "Integer micro-unit comparisons for every ordering and threshold decision; raw floats are never compared"
    - "Interpretation strings built only from short SHA, counts, separation values and UTC strings, never commit subject or author text"
    - "Typed outcome for resource limits: throw InputLimitError before allocation, convert at the analyze() boundary"

key-files:
  created:
    - src/core/ranking.ts
    - tests/core/ranking.test.ts
  modified:
    - src/core/model.ts
    - src/core/pipeline.ts
    - src/core/serialization.ts
    - src/core/buckets.ts
    - tests/core/pipeline.test.ts
    - tests/core/serialization.test.ts
    - tests/core/fixture-contract.test.ts
    - tests/core/analysis-fixture.test.ts

key-decisions:
  - "A commit at exactly onset.windowStartUtc is eligible (inclusive); one millisecond later is excluded with a reason containing 'after'"
  - "no-clear-culprit requires ambiguous AND weak-evidence together (or a non-ranked status); an ambiguous but line-level traced onset is low confidence without that label"
  - "considered[] is kept in chronological order (epoch then SHA) in the stream; canonical JSON sorts it by committedAtUtc then SHA"
  - "Bucket-level commitShas stay empty (onset helpers untouched, D-01); commit lanes live on TimelinePoint.commitShas with half-open membership"

requirements-completed: [RANK-01, RANK-02, RANK-03, RANK-04, RANK-05, RANK-06]

coverage:
  - id: D1
    description: "analyze() on the checkout fixture ranks 2222222 first (0.912065), 1111111 second, and excludes 3333333; band high, labels empty, separation 0.368012"
    requirement: RANK-03
    verification:
      - kind: unit
        ref: "tests/core/pipeline.test.ts#ranks the checkout culprit first through analyze, toAnalysisResult, and canonical JSON without mutating the stream"
        status: pass
    human_judgment: false
  - id: D2
    description: "Total deterministic order (score, trace, later commit time, SHA) on integer micro-units; shuffled inputs give byte-identical output"
    requirement: RANK-02
    verification:
      - kind: unit
        ref: "tests/core/ranking.test.ts#compareRanked total order and #rankSuspects ordering and eligibility"
        status: pass
    human_judgment: false
  - id: D3
    description: "Top-three cap with scored ranks 4 and 5 and a disposition for every supplied commit"
    requirement: RANK-03
    verification:
      - kind: unit
        ref: "tests/core/ranking.test.ts#caps suspects at three and keeps remaining eligible commits as scored with their ranks"
        status: pass
    human_judgment: false
  - id: D4
    description: "Per-signal contributions, evidence references, time gap and trace summary carried into the result and canonical JSON"
    requirement: RANK-04
    verification:
      - kind: unit
        ref: "tests/core/pipeline.test.ts and tests/core/serialization.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "Explicit low-confidence, ambiguous, weak-evidence and no-clear-culprit outcomes; no-onset and no-eligible-commits produce zero suspects"
    requirement: RANK-06
    verification:
      - kind: unit
        ref: "tests/core/ranking.test.ts#deriveConfidence thresholds and #rankSuspects honest outcomes"
        status: pass
    human_judgment: false
  - id: D6
    description: "No output string states causality, a percentage, generated text or roadmap text; every ranked interpretation says ranked suspicion is not proof"
    requirement: RANK-05
    verification:
      - kind: unit
        ref: "tests/core/ranking.test.ts#wording never presents a ranked guess as proof"
        status: pass
    human_judgment: true
    rationale: "A regex ban list proves absence of specific phrases, not that the wording reads as appropriately cautious to a human reviewer."
  - id: D7
    description: "analyze() stays total: exactly 10,000 buckets succeed, 10,001 and a two-year span return a typed INPUT_LIMIT outcome without throwing"
    requirement: RANK-06
    verification:
      - kind: unit
        ref: "tests/core/pipeline.test.ts#accepts exactly the maximum bucket count and returns a typed limit outcome one bucket beyond it"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-10-19
status: complete
---

# Phase 3 Plan 02: Ranker, confidence labels, and result-contract integration Summary

**Deterministic top-three ranker with integer-exact confidence labels (high/medium/low plus ambiguous, weak-evidence, no-clear-culprit), wired through analyze(), the required result contract and canonical JSON, with a 10,000-bucket guard that keeps analyze() total.**

## Performance

- **Duration:** about 8 min (12:41 to 12:49 UTC; the plan prompt and files were read first)
- **Tasks:** 3
- **Files:** 10 (2 created, 8 edited); production source: `ranking.ts` new, `model.ts`, `pipeline.ts`, `serialization.ts`, `buckets.ts` edited

## Accomplishments

- The real pipeline ranks the checkout culprit first: 2222222 at 0.912065, 1111111 at 0.544053, 3333333 excluded (committed 5 minutes after the 04:30 window start), band high, labels empty, separation 0.368012.
- The other two bundled fixtures match the plan's verified values: slow-burn ranks 5555555 (0.839323), 6666666, 4444444 with band medium (ramp) and no labels; ambiguous ranks 9999999, 8888888, 7777777 with band low and all four labels, and "No clear culprit is established" wording.
- Ordering is a total order on integer micro-units (`compareRanked`) and is shown to be input-order independent by a reversed-input byte-equality test.
- Every outcome carries wording that frames the result as ranked suspicion; a ban-list test (`caused by`, `the culprit is`, percentages, `generated`, `Phase N`) runs over every outcome type including hostile subject/author text.
- The Phase 2 stubs are gone: `suspects: []`, the hard-coded `confidenceFor`, `incidentInterpretation`, `PHASE_THREE_ASSUMPTION`, and the stale roadmap alternative in the fixture test regex.
- `analyze()` returns a typed `INPUT_LIMIT` outcome for a log spanning more than 10,000 UTC buckets (boundary-tested at 10,000 and 10,001, plus a two-year span with default buckets) rather than throwing.
- Timeline points now list the commits inside their half-open bucket interval; the three fixtures still have empty lanes.

## Task Commits

No commits were made (user chose no commits on protected `master`). All work is in the working tree. Per-task file lists, with the conventional commit message the orchestrator can use. Plan 03-01 is also still uncommitted, so commit 03-01 first.

1. **Task 1: End-to-end tracer** (uncommitted)
   - Message: `feat(03-02): rank checkout culprit through analyze, result contract, and canonical JSON`
   - Files: `src/core/ranking.ts` (new), `src/core/model.ts`, `src/core/pipeline.ts`, `src/core/serialization.ts`, `tests/core/pipeline.test.ts`, `tests/core/serialization.test.ts`, `tests/core/fixture-contract.test.ts`
2. **Task 2: Honest outcomes at the edges** (uncommitted)
   - Message: `test(03-02): prove tie-breaks, eligibility boundary, thresholds, empty outcomes, and wording`
   - Files: `tests/core/ranking.test.ts` (new); `src/core/ranking.ts` unchanged by this task (no behavior failed against the Task 1 implementation, see Deviations)
3. **Task 3: Bucket guard, commit lanes, stub retirement** (uncommitted)
   - Message: `feat(03-02): guard bucket allocation, expose commit lanes on the timeline, retire stub assertions`
   - Files: `src/core/buckets.ts`, `tests/core/pipeline.test.ts` (second set of edits), `tests/core/analysis-fixture.test.ts`; plus the `analyze()` try/catch and `timelineFromBuckets` edits in `src/core/pipeline.ts` (landed with Task 1, see Deviations)

**Shared with plan 03-01 (still uncommitted):** `src/core/model.ts` (03-01 added `TraceMatchKind`/`TraceSummary`; 03-02 added the ranking contract) and `src/core/normalization.ts` (03-01 only, but `ranking.ts`, `serialization.ts`, `pipeline.ts` and `buckets.ts` import its `compareText`). `src/core/ranking.ts` also imports 03-01's `evidence.ts` and `scoring.ts`. Commit 03-01 entirely before 03-02. `src/core/model.ts` mixes both plans' hunks and cannot be split cleanly by file; commit it with the 03-01 or the 03-02 Task 1 commit, whichever the script prefers, as long as 03-01's evidence/scoring files are in by then. `tests/core/pipeline.test.ts` mixes Task 1 and Task 3 hunks and is listed under both.

## Files Created/Modified

- `src/core/ranking.ts` - `rankSuspects`, `compareRanked`, `deriveConfidence`, interpretation and rationale wording.
- `src/core/model.ts` - `CONFIDENCE_LABEL_ORDER`, `ConfidenceLabel`, `RankingStatus`, `CommitDispositionStatus`, `CommitDisposition`, `RankingSummary`, `RankingOutcome`; required `timeGapMinutes`, `traceSummary`, `labels`, `ranking` fields; refreshed `UtcBucket.commitShas` comment.
- `src/core/pipeline.ts` - calls `rankSuspects`, three new assumptions (scoring weights, novelty/start-of-observation, trace scope), deep-copy projection of ranking, timeline commit lanes, bucket-guard try/catch, shared `compareText`.
- `src/core/serialization.ts` - canonical `ranking`, `labels`, `timeGapMinutes`, `traceSummary`; shared `compareText` and `SIGNAL_ORDER`. Markdown rendering untouched (Plan 03-03).
- `src/core/buckets.ts` - `MAX_BUCKETS`, pre-allocation `InputLimitError`, shared `compareText`.
- `tests/core/ranking.test.ts` - 43 tests.
- `tests/core/pipeline.test.ts`, `serialization.test.ts`, `fixture-contract.test.ts`, `analysis-fixture.test.ts` - contract builders, tracer, bucket boundary, lanes, stub retirement.

## Decisions Made

- Inclusive eligibility (`<=` window start), per research A9.
- `no-clear-culprit` needs ambiguous and weak-evidence together; this is how the ambiguous fixture earns all four labels while a merely tied but line-traced result reads "ranks first, but confidence is low".
- Interpretations never include subject or author text; a hostile-subject test covers it.
- Stream `considered` order is chronological (epoch, SHA); canonical JSON sorts independently so serialization does not depend on it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Ordering] Task 3 pipeline edits landed during Task 1**
- **Found during:** Task 1
- **Issue:** The plan puts the `analyze()` bucket try/catch and the `timelineFromBuckets(buckets, commits)` change in Task 3, but Task 1 already rewrote the same `analyze()` region and `toAnalysisResult` (which has to copy `point.commitShas`). Splitting them would have meant editing the same lines twice.
- **Fix:** Made the `pipeline.ts` try/catch and commit-lane edits together with the Task 1 pipeline edit. The `MAX_BUCKETS` guard and all Task 3 tests still landed in Task 3, and nothing observable changed between the two.
- **Files modified:** `src/core/pipeline.ts`
- **Commit:** uncommitted

**2. [Rule 1 - Test literal] Corrected an expectation in my own ranking test**
- **Found during:** Task 2
- **Issue:** I first asserted that an ambiguous onset with a line-level trace produced a "not a verdict" interpretation. By the plan's rule (`no-clear-culprit` needs ambiguous AND weak), that case is "ranks first, but confidence is low".
- **Fix:** Corrected the test and added a separate ambiguous-plus-untraced case that does assert `No clear culprit is established` and `not a verdict`. The implementation was correct as specified.
- **Files modified:** `tests/core/ranking.test.ts`
- **Commit:** uncommitted

**3. [Process - TDD order] Task 2 was not strictly test-first**
- Task 1 already had to produce a working `ranking.ts` for the tracer, so Task 2's tests were written against an existing implementation. Every behavior bullet passed on the first full run except the one miscalculated expectation in deviation 2; no change to `ranking.ts` was needed. `src/core/scoring.ts` was not touched.

**4. [Process] No commits**
- Per the no-commit instruction, `commits: 0 (uncommitted)`, and `plan_head_after` equals `plan_head_before`. The work exists in the working tree.

**Total deviations:** 2 auto-fixed (1 ordering, 1 test literal), 2 process. **Impact:** none on behavior; all fixture outcomes matched the plan's prototype values on the first run.

## Issues Encountered

- A few edits through bash heredocs lost a level of backslash escaping (`\n` became a real newline inside two test string literals). Caught immediately by the transform error and fixed with the Edit tool; no source files were affected.

## Known Stubs

None.

## Threat Flags

None new. T-03-06 (wording) is covered by the ban-list test across all outcome types; T-03-07 (bucket allocation) by the 10,000 / 10,001 / two-year tests; T-03-09 (ordering) by compareRanked and order-independence tests; T-03-10 (aliasing) by the stream-unchanged assertion after projection. T-03-08 (history size) remains accepted per D-04.

## Verification

- `npm test` (full suite): 15 files, 149 tests passed.
- `npm run typecheck`: exit 0.
- `npm run build`: succeeds (`dist/` is git-ignored).
- Plan-level targeted run (`ranking`, `pipeline`, `serialization`, `fixture-contract`, `analysis-fixture`, `onset`, `determinism`): all pass; `tests/core/onset.test.ts` is unmodified.
- Acceptance greps: `ranking.ts` exports `rankSuspects`/`compareRanked`/`deriveConfidence` and the three interfaces; `model.ts` has the new types; `pipeline.ts` has no `PHASE_THREE_ASSUMPTION`, `confidenceFor`, `incidentInterpretation` or `suspects: []`; `buckets.ts` has `export const MAX_BUCKETS = 10_000`.

## Next Phase Readiness

Plan 03-03 can render Markdown and fixture contracts on top of the required `ranking`, `labels`, `timeGapMinutes` and `traceSummary` fields. `serializeMarkdown` still ignores them (deliberately). One leftover: `src/core/signatures.ts` keeps its own private `compareText` copy (out of this plan's file list).

## Self-Check: PASSED

- Created files exist: `src/core/ranking.ts`, `tests/core/ranking.test.ts`.
- Commits: none exist by design (uncommitted at the user's direction); `git rev-list` count over the plan range is 0 and the changes are present in the working tree.
