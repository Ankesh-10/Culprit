---
phase: 03-evidence-ranking-and-trust-model
verified: 2026-10-19T13:00:00Z
status: passed
score: 4/4 roadmap success criteria verified (9/9 requirements satisfied; 15/15 threat mitigations confirmed or dispositioned)
covered_files:
  - ".planning/phases/03-evidence-ranking-and-trust-model/03-01-PLAN.md"
  - ".planning/phases/03-evidence-ranking-and-trust-model/03-01-SUMMARY.md"
  - ".planning/phases/03-evidence-ranking-and-trust-model/03-02-PLAN.md"
  - ".planning/phases/03-evidence-ranking-and-trust-model/03-02-SUMMARY.md"
  - ".planning/phases/03-evidence-ranking-and-trust-model/03-03-PLAN.md"
  - ".planning/phases/03-evidence-ranking-and-trust-model/03-03-SUMMARY.md"
  - "README.md"
  - "fixtures/incidents/slow-burn/expected.json"
  - "src/core/buckets.ts"
  - "src/core/evidence.ts"
  - "src/core/markdown.ts"
  - "src/core/model.ts"
  - "src/core/normalization.ts"
  - "src/core/pipeline.ts"
  - "src/core/ranking.ts"
  - "src/core/scoring.ts"
  - "src/core/serialization.ts"
  - "tests/core/golden/ambiguous.canonical.json"
covered_digest: "v3:sha256:0bf3209ea89b98ed6c4ec47a52f9e129618c7274e8b744553b9f20fb9a1debd9"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 3: Evidence, Ranking, and Trust Model Verification Report

**Phase Goal:** Correlate pre-onset history with error evidence using frozen explainable signals and produce an honest, deterministic top-three interpretation for all bundled incidents.
**Verified:** 2026-10-19
**Status:** passed
**Re-verification:** No, initial verification

All Phase 3 work is uncommitted in the working tree (by design, via `commit-phase3.sh`). Verification ran against the working tree. No source, config or guard files were edited and nothing was committed.

## Commands Run (host: Node v24, no `make`)

| Command | Result |
| ------- | ------ |
| `npm run typecheck` | exit 0, no TS errors |
| `npm test` | 17 files, 190 tests, all passed |
| `npm run build` | typecheck then `vite build`, wrote `dist/index.html` + assets, exit 0 |
| Independent probe (vite-node script in scratchpad, outside the repo) running `analyze` + `toAnalysisResult` + `serializeMarkdown` on all three fixtures | outputs match the claimed golden values (see below) |

## Goal Achievement

### Roadmap Success Criteria

| # | Success criterion | Status | Evidence |
| - | ----------------- | ------ | -------- |
| 1 | Eligible pre-onset commits scored with versioned frozen proximity, trace-match, novelty and bounded churn weights; every signal exposes value, contribution, explanation, evidence refs | VERIFIED | `SCORING_V1` (`src/core/scoring.ts:21`) is `Object.freeze`d with weights 0.35 / 0.30 / 0.25 / 0.10, 60 min half-life, churn constants, thresholds. `scoreCommit` (line 363) emits four `SignalContribution`s in `SIGNAL_ORDER`, each with value, weight, `round6(value*weight)`, a one-sentence explanation and evidence references. `scoringVersion: 'scoring-v1'` in the stream. Churn is capped (`0.7*lines/(lines+50) + 0.3*min(1,...)` < 1, times 0.1). Probe output for checkout 2222222: values/contributions 0.315 / 0.3 / 0.25 / 0.047065, score 0.912065, with explanations and `file-range` / `error-group` / `log-event` / `feature` references. Hand check: 12 min gives 1 - 0.2/2 = 0.9; churn 65 lines, 2 files gives 0.7*65/115 + 0.3*0.25 = 0.470652. |
| 2 | Path separators, repo prefixes, line-range boundaries, generic/vendor/generated frames, missing files and unmatched evidence handled without crashes or invented matches | VERIFIED | `evidence.ts`: `classifyPath` (runtime / vendor / build-output / application), `classifyFrame` (null path is unattributed; parser vendor flag wins), `topApplicationFrame` walks the event's own frames in original order (never `ErrorGroup.stackFrames`), `matchPath` (exact first, suffix only on a `/` boundary with at least 2 segments, more than one candidate is `ambiguous` with zero credit, no sibling or basename credit), `classifyLine` (inclusive ranges, 5-line nearby band, null line is file-only). Ambiguous matches add a visible "no trace credit was given" feature reference (`scoring.ts:231`). Aggregation uses `Map` keyed by `JSON.stringify([path,line])`. `tests/core/evidence.test.ts` (19 tests) pins every boundary including `__proto__` paths and parser-driven Windows-relative and absolute paths. Ambiguous fixture: vendor first frame skipped, all trace values 0, no invented match. |
| 3 | Stable top-three ordering with deterministic tie-breaking, explicit exclusions / weak evidence, qualitative low-confidence / ambiguous / weak-evidence / no-clear-culprit outcomes rather than causal certainty | VERIFIED | `rankSuspects` (`ranking.ts:214`): eligibility `epoch <= windowStart` (inclusive), `compareRanked` over integer micro-units (score, trace, later commit time, SHA by code unit), `topN = 3`, `considered` lists every commit as top-three / scored / excluded with reasons. `deriveConfidence` derives band + labels from integer thresholds (separation 50000 / 150000 micro, line-level share, 3/4 stack coverage, onset class). No-onset and no-eligible-commits produce zero suspects, band low, `no-clear-culprit`. Wording: every interpretation and rationale ends with a not-proof / not-a-verdict clause; `ranking.test.ts` wording-ban regex covers all outcomes. Behavior-dependent truths (tie-break, +/-1 ms eligibility, order independence, threshold boundaries 49999/50000, 149999/150000) are each exercised by a passing named test in `ranking.test.ts` (43 tests). |
| 4 | Contract tests: checkout culprit first, slow-burn and ambiguous have stable intended interpretations, identical input gives byte-identical structured and Markdown output | VERIFIED | Probe: checkout 2222222 first (0.912065, band high, labels none, 3333333 excluded as after window start 04:30); slow-burn 5555555 first (0.839323, band medium, ramp wording, not the nearest commit 6666666); ambiguous 9999999 / 8888888 / 7777777 near-tie (0.575417 / 0.563158 / 0.540694), band low, labels `low-confidence, ambiguous, weak-evidence, no-clear-culprit`, interpretation "No clear culprit is established". `fixture-ranking.test.ts` (27 tests) pins these plus the actual onset windows against `expected.json`, a committed golden file for ambiguous, a hand-derived ambiguous oracle recomputed without the scoring module, and the frozen constants. `determinism.test.ts` `it.each` over three fixtures covers repeat, reversed logs and history, TZ (two zones), LC_ALL, `Date.now` and `Math.random` stubs for canonical JSON, Markdown and suspect order. |

### Requirements Coverage

| Requirement | Plans | Status | Evidence |
| ----------- | ----- | ------ | -------- |
| RANK-01 frozen proximity / trace / novelty / churn with documented weights | 03-01, 03-02 | SATISFIED | `SCORING_V1`, `scoreCommit`, README "How ranking works", assumption string in every result. |
| RANK-02 stable ordering and deterministic tie-break | 03-02, 03-03 | SATISFIED | `compareRanked` on integers, `compareText` SHA tie-break, shuffled-input identical test, determinism suite. No `Date.now`, `Math.random`, locale API, `Math.pow/exp/log` in `src/core` (grep clean). |
| RANK-03 top-three shortlist, not a single claim | 03-02, 03-03 | SATISFIED | `SCORING_V1.topN = 3`; slow-burn and ambiguous return exactly three; Markdown "Top suspects" lists the shortlist plus also-scored and not-eligible commits. |
| RANK-04 per-signal contribution in plain language | 03-01, 03-02, 03-03 | SATISFIED | Each signal has a plain sentence; Markdown prints `value v x weight w = contribution c` per signal plus `Total score` that equals the sum. |
| RANK-05 evidence references (time distance, files/lines, matching frames, groups, churn) | 03-01, 03-02, 03-03 | SATISFIED | `timeGapMinutes`, `file-range` with line ranges, `log-event` with frame path:line, `error-group` match counts, churn per-file references (build-output excluded), all capped by `EVIDENCE_LIMITS`. |
| RANK-06 explicit low-confidence / ambiguous / weak-evidence / no-clear-culprit | 03-02, 03-03 | SATISFIED | `ConfidenceRationale.labels`, `CONFIDENCE_LABEL_ORDER`, `Labels:` line in Markdown; ambiguous fixture carries all four labels. |
| RANK-07 exclude/downweight generic/vendor/generated frames; path/line mismatches safe | 03-01 | SATISFIED | Frame taxonomy and `matchPath` / `classifyLine` rules above; both vendor-only and no-stack events yield zero trace, weak-evidence, no crash. |
| FIX-02 checkout culprit first; slow-burn and ambiguous interpretations stable | 03-03 | SATISFIED | `fixture-ranking.test.ts`, golden projections, golden file; fixture `expected.json` onset pinned (one-line D-01 edit). |
| FIX-03 byte-identical structured and Markdown output | 03-03 | SATISFIED | `determinism.test.ts` three-fixture suite; ambiguous output equals the golden file byte-for-byte after `trimEnd()`. |

No orphaned requirements: ROADMAP maps exactly these nine IDs to Phase 3 and all are claimed by at least one plan.

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `pipeline.analyze()` | `ranking.rankSuspects` | `pipeline.ts:250` `rankSuspects({ commits, events: normalizedEvents, errors, onset })`, result stored as `stream.ranking` (line 289) | WIRED | Called after onset interpretation; output flows into the returned stream. |
| `ranking.rankSuspects` | `scoring.scoreCommit` / `evidence.buildEvidenceIndex` | `ranking.ts:216` builds the index once; line 274 scores each eligible commit; `toMicro` for ordering | WIRED | Real data path, not stubbed. |
| `scoring.scoreCommit` | `evidence.matchPath` / `classifyLine` / `classifyPath` / `lowerBound` / `countAtOrAfter` | `scoring.ts:186-200`, `332`, `246` | WIRED | |
| `pipeline.toAnalysisResult` | `stream.ranking` | suspects, confidence (with labels), ranking summary, `incident.interpretation` all copied from `stream.ranking` (lines 318, 330-345) | WIRED | Deep copies; pipeline test asserts the stream is unchanged after projection. |
| `AnalysisResult` | `serialization.canonicalizeResult` | `canonicalSuspect` (timeGap, traceSummary), `canonicalRanking`, labels in `CONFIDENCE_LABEL_ORDER` order | WIRED | Golden JSON contains `ranking` and `labels`. |
| `AnalysisResult` | `serialization.serializeMarkdown` | every user-derived string goes through `escapeMarkdown` / `inlineCode` (`serialization.ts:239-311`) | WIRED | Probe Markdown for checkout shows ranked list, labels, per-signal lines, excluded 3333333, assumptions. |
| `buckets.buildUtcBuckets` | `pipeline.analyze` try/catch | `InputLimitError` before allocation, converted to typed `{ ok:false }` | WIRED | Boundary tests at 10,000 vs 10,001 buckets and a two-year span through `analyze()`. |
| `fixture-ranking.test` | `manifest.json` / `expected.json` / golden file | reads shared fixture files | WIRED | |

### Phase 2 Stub Removal

| Stub | Status | Evidence |
| ---- | ------ | -------- |
| `PHASE_THREE_ASSUMPTION` | GONE | `grep` over `src/` returns no match. |
| `confidenceFor` / `incidentInterpretation` | GONE | No match in `src/`. |
| `suspects: []` | GONE | No match in `src/`; `toAnalysisResult` projects `stream.ranking.suspects`. |
| Roadmap text ("Phase 3", "deferred") in output | GONE | No match in `src/`; `analysis-fixture.test.ts` asserts no assumption, warning, interpretation or rationale contains them, and its rationale regex is now `/weak|competing/i`. |
| Timeline `commitShas: []` forced empty | REPLACED | Half-open commit lanes in `timelineFromBuckets`; three synthetic cases tested; fixtures still empty because their commits fall outside bucket ranges. |

### Anti-Patterns Found

None. Scans of `src/core/*.ts`, `tests/core/*.ts` and `README.md` for TBD / FIXME / XXX / TODO / HACK / PLACEHOLDER / console.log / "not yet implemented" returned no hits. No `Math.pow/exp/log/sqrt/hypot/cbrt/random`, no exponent operator, no `Date.now`, `new Date()` (no-arg), `toLocale*` or `Intl.*` in `src/core`. No stub returns: the zero-value branches in `scoring.ts` are specific, explained cases rather than placeholders.

### Threat Model Mitigations (T-03-01 .. T-03-15)

| ID | Disposition | Status | Evidence |
| -- | ----------- | ------ | -------- |
| T-03-01 spoofed path/frame match | mitigate | CONFIRMED | `matchPath` / `classifyFrame` rules in `evidence.ts`; each rule has an `evidence.test.ts` case (slash boundary, single segment, ambiguous, sibling, case variants, vendor / runtime / build-output / unattributed). |
| T-03-02 tampering via aggregation keys | mitigate | CONFIRMED | `Map`/`Set` only; key is `JSON.stringify([path,line])`; `__proto__/a.ts` tests in `evidence.test.ts`; sorted emission with `compareText`. |
| T-03-03 per-commit scan DoS | mitigate | CONFIRMED | Events aggregated once into distinct frames with sorted epochs; per commit it is frames x changed files plus binary search (`lowerBound`); references capped by `EVIDENCE_LIMITS`. |
| T-03-04 cross-engine arithmetic | mitigate | CONFIRMED | Only `+ - * /`, floor/round/min/max, halving loop; integer tenths for trace strength; comment-stripped source-scan tests for `scoring.ts` and `evidence.ts` pass; independent grep clean. |
| T-03-05 host path disclosure | mitigate | CONFIRMED | Absolute / drive paths are nulled by the parser and classified `unattributed`; parser-driven test covers Windows and POSIX absolute paths; golden file and README have no host paths (`rebuild-surface.test.ts` passes). |
| T-03-06 overstated verdict wording | mitigate | CONFIRMED | Band and labels from integer thresholds; every interpretation and rationale carries a not-proof or not-a-verdict clause; wording-ban regex test across all outcomes; probe outputs read correctly. |
| T-03-07 bucket allocation DoS | mitigate | CONFIRMED | `MAX_BUCKETS = 10_000` checked before allocation; `analyze()` returns typed `INPUT_LIMIT`; boundary tests at 10,000 (ok) and 10,001 (limit) and a two-year span. |
| T-03-08 unbounded history size | accept | ACCEPTED | Per D-04; documented in README Limitations ("History size is not capped yet"). Carry forward to hardening. |
| T-03-09 ordering determinism | mitigate | CONFIRMED | Integer micro-unit `compareRanked`, sorted input copies, reversed-input and SHA tie-break tests. |
| T-03-10 result aliasing stream | mitigate | CONFIRMED | `toAnalysisResult` deep-copies suspects, signals, evidence, dispositions, timeline; pipeline test compares stream JSON before and after. |
| T-03-11 Markdown injection | mitigate | CONFIRMED | `escapeMarkdown` escapes `\ ` * _ [ ] < > # ~ |` and flattens whitespace; `inlineCode` lengthens the fence; hostile-input test in `serialization.test.ts` covers links, HTML, headings, emphasis, pipes, newlines. |
| T-03-12 forged headings via newlines | mitigate | CONFIRMED | Whitespace flattening; test asserts only fixed and per-suspect headings start lines with `#`. |
| T-03-13 silent output drift | mitigate | CONFIRMED | Inline golden projections plus committed `ambiguous.canonical.json`, cross-checked against a hand-derived oracle recomputed without `scoring.ts`; no update mode in tests. |
| T-03-14 README/golden disclosure | mitigate | CONFIRMED | `rebuild-surface.test.ts` passes; golden file contains only repository-relative paths. |
| T-03-15 DOM rendering of result strings | transfer | TRANSFERRED | Owned by Phase 4 planner: render with `textContent` only. Not testable in this phase. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Checkout culprit ranks first, band high | vite-node probe (scratchpad) | 2222222 0.912065, band high, labels `[]`, 3333333 excluded | PASS |
| Slow-burn leader is the traced commit, not the nearest | same | 5555555 0.839323 first; 6666666 second; band medium | PASS |
| Ambiguous is a labeled near-tie | same | four labels, band low, trace none for all, separation 0.012259 | PASS |
| Onset windows match fixtures | same | spike 04:30-04:35, ramp 08:10-08:40, ambiguous 10:06-10:24 (UTC) | PASS |
| Full suite | `npm test` | 190 / 190 passed | PASS |

### Probe Execution

Step 7c: SKIPPED. No `probe-*.sh` scripts are declared by the phase plans and none exist under `scripts/`.

### Human Verification Required

None. The phase delivers a pure core library and test contracts, not UI. Every behavior-dependent truth (ordering, tie-break, eligibility boundary, order independence, threshold boundaries, bucket guard) has a passing automated test, so `behavior_unverified` is 0. Visual and accessibility checks belong to Phase 4.

### Fixture Change Audit

`git diff -- fixtures` shows exactly one changed line: `fixtures/incidents/slow-burn/expected.json` `windowEndUtc` `2026-10-19T08:35:00Z` to `2026-10-19T08:40:00Z`. This matches the user-approved D-01 decision recorded in `03-RESEARCH.md`. Onset logic in `pipeline.ts` (`interpretSparseRamp`, `interpretWeakEvidence`, `cloneOnset`, `classifyOnset`) is unchanged.

## Notes (non-blocking)

Bookkeeping, already recorded and not goal gaps:

1. `.planning/STATE.md` frontmatter is stale after the `state.advance-plan` and `update-progress` tool failures.
2. `requirements.mark-complete` returned `not_found`, so the RANK-01..07, FIX-02 and FIX-03 checkboxes in `.planning/REQUIREMENTS.md` are still `[ ]` and the traceability table still says `Mapped`. Tick them when the orchestrator closes the phase.
3. `.planning/ROADMAP.md` still lists Phase 3 plans as complete (3/3) but the phase itself is not yet marked done; leave to the orchestrator.

Design observations for later phases (no action needed now, all documented in README Limitations):

- The onset window start can sit after the first error (checkout: first error 04:20:30, window start 04:30). Eligibility and proximity are measured from the window start, so a commit landing between the first error and the window start would still be eligible. This is the accepted D-01 behavior since onset logic is unchanged.
- Novelty is 1.0 for every candidate in all three fixtures because every log starts after every commit. It is disclosed in an assumption string and README, so it is declared rather than coincidental. It contributes no discrimination on the bundled data.
- `classifyPath` treats any path whose first segment is `internal/` as runtime. That is correct for Node internals but would also hide a Go-style `internal/` application package. Documented in README.
- `escapeMarkdown` does not neutralize bare `http(s)://` autolinks or HTML entities. `[`, `<`, `>` and line starts are neutralized, so links with text, HTML and headings cannot be injected. Low risk; revisit if the Markdown is rendered by a GFM-autolinking viewer.

## Gaps Summary

No gaps. All four ROADMAP success criteria, all nine requirement IDs, all key links, the Phase 2 stub removal and the threat-model mitigations (T-03-08 accepted, T-03-15 transferred) are verified against the actual code and a passing typecheck, 190-test suite and production build.

---

_Verified: 2026-10-19_
_Verifier: Claude (gsd-verifier)_
