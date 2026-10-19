---
phase: 03-evidence-ranking-and-trust-model
plan: 03
subsystem: core-analysis
tags: [markdown, escaping, fixtures, golden, determinism, readme, typescript, vitest]

requires:
  - phase: 03-evidence-ranking-and-trust-model
    provides: "Plan 03-01 scoring/evidence; Plan 03-02 ranking, confidence labels, result contract with ranking/labels/timeGapMinutes/traceSummary"
provides:
  - "escapeMarkdown / inlineCode helpers (whitespace collapsed, structural characters escaped, adaptive backtick fence)"
  - "Ranked, injection-safe serializeMarkdown: verdict labels, leading suspect, top-three plus also-scored and not-eligible lines, per-signal value x weight = contribution lines, totals, ranking status, assumptions"
  - "FIX-02 contract: onset class/window pinned to expected.json for all fixtures, inline golden projections, ambiguous golden file, hand-derived oracle, frozen-constant assertions"
  - "FIX-03: byte-identical ranked JSON and Markdown for all three fixtures under repeat, reorder, TZ x2, LC_ALL, Date.now, Math.random"
  - "README: How ranking works and extended Limitations"
affects: [04 investigation console (renders result strings; must use textContent only per T-03-15)]

actuals:
  tokens: 13100
  tasks: 3
  commits: 0
plan_head_before: 26a32c5e4c3cc17b259fd509a310e8e2d86cdce7
plan_head_after: 26a32c5e4c3cc17b259fd509a310e8e2d86cdce7
commits: 0 (uncommitted)

tech-stack:
  added: []
  patterns:
    - "Every user-derived string in Markdown passes through escapeMarkdown (prose) or inlineCode (paths, SHAs, sources)"
    - "Golden snapshot is never the only oracle: hand-derived arithmetic recomputed in the test without importing the scoring module, plus pinned constants"
    - "Tests have no snapshot update mode; regeneration is a deliberate change tied to a SCORING_VERSION bump"

key-files:
  created:
    - src/core/markdown.ts
    - tests/core/markdown.test.ts
    - tests/core/fixture-ranking.test.ts
    - tests/core/golden/ambiguous.canonical.json
  modified:
    - src/core/serialization.ts
    - tests/core/serialization.test.ts
    - tests/core/determinism.test.ts
    - fixtures/incidents/slow-burn/expected.json
    - README.md

key-decisions:
  - "D-01 (user approved, RESEARCH Q1): slow-burn expected.json windowEndUtc 08:35:00Z to 08:40:00Z; onset logic untouched; only fixture expectation changed"
  - "Suspect-level evidence references are listed under each suspect; per-signal references stay in canonical JSON, not duplicated in Markdown"
  - "Markdown numbers render with String(value); no toFixed or locale APIs"
  - "README documents the band rule as implemented: ambiguous or weak evidence gives low; ramp, separation under 0.15 or application-frame coverage under three quarters caps at medium"

requirements-completed: [RANK-02, RANK-03, RANK-04, RANK-05, RANK-06, FIX-02, FIX-03]

coverage:
  - id: D1
    description: "Checkout Markdown shows 2222222 first, Labels: none, Confidence high, trace-match value 1 x weight 0.3 = contribution 0.3, Total score 0.912065, and 3333333 as not eligible"
    requirement: RANK-03
    verification:
      - kind: unit
        ref: "tests/core/serialization.test.ts#ranked Markdown export"
        status: pass
    human_judgment: false
  - id: D2
    description: "Hostile subjects, authors, warnings and diagnostics cannot add headings, links, HTML or extra lines"
    requirement: RANK-05
    verification:
      - kind: unit
        ref: "tests/core/serialization.test.ts#cannot be hijacked by hostile commit, warning, or diagnostic text; tests/core/markdown.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Checkout 2222222 first (high), slow-burn 5555555 first (medium, not nearest commit), ambiguous low-confidence near-tie with zero trace"
    requirement: FIX-02
    verification:
      - kind: unit
        ref: "tests/core/fixture-ranking.test.ts#fixture ranking contract (FIX-02)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Actual onset class, window start and end equal expected.json for all three fixtures"
    requirement: FIX-02
    verification:
      - kind: unit
        ref: "tests/core/fixture-ranking.test.ts#pins the actual onset class and window"
        status: pass
    human_judgment: false
  - id: D5
    description: "Ambiguous golden numbers cross-checked against a hand-derived oracle recomputed without the scoring module, and frozen constants pinned separately"
    requirement: FIX-02
    verification:
      - kind: unit
        ref: "tests/core/fixture-ranking.test.ts#ambiguous fixture: hand-derived oracle; frozen scoring constants"
        status: pass
    human_judgment: false
  - id: D6
    description: "Ranked JSON, Markdown and suspect order byte-identical for all fixtures across repeat, reorder, TZ, locale, Date.now and Math.random variants"
    requirement: FIX-03
    verification:
      - kind: unit
        ref: "tests/core/determinism.test.ts#ranked fixture byte identity"
        status: pass
    human_judgment: false
  - id: D7
    description: "README explains eligibility, frozen weights, tie-break, bands and labels, and ranking limitations in plain language"
    requirement: RANK-06
    verification:
      - kind: unit
        ref: "tests/core/rebuild-surface.test.ts (phrase, absolute-path and URL rules still pass)"
        status: pass
    human_judgment: true
    rationale: "Tests prove required phrases survive and no host path or remote URL appears, not that the explanation is clear to a reader."

duration: 12min
completed: 2026-10-19
status: complete
---

# Phase 3 Plan 03: Escaped Markdown export and fixture ranking contracts Summary

**Deterministic, injection-safe ranked Markdown postmortem plus locked fixture contracts: checkout and slow-burn culprits rank first, the ambiguous case is a labeled near-tie checked against a hand-derived oracle, and ranked output is byte-identical across environments.**

## Performance

- **Duration:** about 12 min
- **Tasks:** 3
- **Files:** 9 (4 created, 5 edited); the golden file is one of the created files

## Accomplishments

- `serializeMarkdown` now renders the ranked result: confidence band and labels, leading suspect with UTC time and gap, top-three lines, also-scored and not-eligible lines with reasons, one line per signal as `value x weight = contribution` with a total, ranking status, and assumptions. The nine headings, single trailing newline and UTC disclosure are unchanged.
- Every user-derived string goes through `escapeMarkdown` or `inlineCode`. A hostile test (multi-line `# Owned` subject with link, script tag, backticks, emphasis and pipes; author `](x)`; warning `## fake heading`; diagnostic `<img src=x>`) shows the only `#` lines are the fixed headings and the per-suspect heading, with the whole subject staying on its own line.
- All three fixtures are pinned: onset class and window equal `expected.json` (slow-burn end corrected), band equals the manifest, and inline golden projections match the Plan 03-01/03-02 values with no literal changes needed.
- The ambiguous canonical JSON is frozen in `tests/core/golden/ambiguous.canonical.json`. It is not the only oracle: per-signal values, contributions and scores for 9999999, 8888888 and 7777777 are recomputed in the test with plain arithmetic (no scoring import) and must agree with the live result and the parsed golden file; separation 12259 and #1-#3 34723 micro-units are asserted too.
- Weights, signal order, half-life, churn constants, trace strength tenths and separation thresholds are pinned independently of any fixture.
- README gained `## How ranking works` and extended Limitations; the stale "scoring engine not implemented" sentence now names only the worker and console as pending.

## Task Commits

No commits were made (user chose no commits on protected `master`). Everything is in the working tree. Suggested conventional messages and exact files per task:

1. **Task 1: Tracer: ranked, escaped Markdown export** (uncommitted)
   - Message: `feat(03-03): export ranked verdict as escaped Markdown postmortem`
   - Files: `src/core/markdown.ts` (new), `src/core/serialization.ts`, `tests/core/markdown.test.ts` (new), `tests/core/serialization.test.ts`
2. **Task 2: Fixture ranking contract and onset pin** (uncommitted)
   - Message: `test(03-03): lock fixture ranking contract, onset windows, and ambiguous golden with hand-derived oracle`
   - Files: `tests/core/fixture-ranking.test.ts` (new), `tests/core/golden/ambiguous.canonical.json` (new), `fixtures/incidents/slow-burn/expected.json`
3. **Task 3: Ranked byte identity and README** (uncommitted)
   - Message: `docs(03-03): prove ranked byte identity for all fixtures and document how ranking works`
   - Files: `tests/core/determinism.test.ts`, `README.md`

**Shared with earlier uncommitted plans:** `src/core/serialization.ts` (03-02 added canonical ranking projection; 03-03 adds the Markdown rewrite and the `markdown` import) and `tests/core/serialization.test.ts` (03-02 contract builder; 03-03 appends the ranked Markdown tests and `analyze`/`readFileSync` imports). Commit 03-01 and 03-02 before 03-03. The other 03-03 files are untouched by earlier plans.

## Files Created/Modified

- `src/core/markdown.ts` - `escapeMarkdown`, `inlineCode`.
- `src/core/serialization.ts` - ranked, escaped `serializeMarkdown`; new `markdownDispositions`; evidence lines via `inlineCode`/`escapeMarkdown`.
- `tests/core/markdown.test.ts` - 8 tests for escaping and fences.
- `tests/core/serialization.test.ts` - checkout tracer, nine-heading order, hostile-input tests (3 added).
- `tests/core/fixture-ranking.test.ts` - 27 tests: structural invariants, onset pin, golden projections, Markdown honesty, per-fixture behaviors, golden file, constants, oracle.
- `tests/core/golden/ambiguous.canonical.json` - frozen canonical JSON (single line plus trailing newline).
- `fixtures/incidents/slow-burn/expected.json` - one line: `windowEndUtc` 08:35:00Z to 08:40:00Z (D-01).
- `tests/core/determinism.test.ts` - `input` takes a fixture id; new three-fixture `it.each`; the two original tests are unchanged.
- `README.md` - `## How ranking works`, extended Limitations.

## Decisions Made

- D-01 applied exactly as approved: one line in one fixture file; `git diff -- fixtures` shows only that line; `src/core/pipeline.ts` onset helpers untouched.
- Per-signal evidence references are not repeated in Markdown (suspect-level references are listed, as the plan specified); the full set remains in canonical JSON.
- The golden file is generated once with a throwaway script outside the repository, then the script was deleted. The test compares after `trimEnd()` so a CRLF checkout cannot break it, and there is no update mode.

## Deviations from Plan

None - plan executed as written, apart from two test-literal self-corrections:

**1. [Rule 1 - Test literal] Hostile-test assertion on `<img`**
- **Found during:** Task 1
- **Issue:** My first draft asserted the output does not contain `<img`, but the correctly escaped text `\<img src=x\>` contains that substring.
- **Fix:** Assert there is no unescaped `<` (`/(?:^|[^\\])</m`) and that the escaped form is present. Implementation unchanged.
- **Files modified:** `tests/core/serialization.test.ts`
- **Commit:** uncommitted

**2. [Process] No commits**
- Per the no-commit instruction, `commits: 0 (uncommitted)` and `plan_head_after` equals `plan_head_before`. Changes exist in the working tree.

**Total deviations:** 1 test-literal fix, 1 process. **Impact:** none on production code; every golden value matched on the first run and no golden or fixture literal beyond D-01 was changed.

## Issues Encountered

- The Tasks' markdown test strings contain backslashes; they were written with Edit/Write (not heredocs), so no escaping was lost.
- An early shell command I issued with nested heredocs hung and was backgrounded; it wrote nothing (the follow-up edits were done with Edit).

## Known Stubs

None.

## Threat Flags

None new. T-03-11 and T-03-12 (injection, forged lines) are covered by the hostile-input and markdown unit tests; T-03-13 (silent drift) by inline projections, the golden file, the hand-derived oracle and pinned constants; T-03-14 by the unchanged rebuild-surface rules and a pre-write check that the golden file has no drive-letter or backslash path. T-03-15 is transferred to Phase 4: render result strings with `textContent` only. Markdown escaping does not protect DOM rendering.

## Verification

- `npm test -- --run tests/core/markdown.test.ts tests/core/serialization.test.ts tests/core/analysis-fixture.test.ts tests/core/fixture-contract.test.ts`: 29 passed.
- `npm test -- --run tests/core/fixture-ranking.test.ts tests/core/fixture-contract.test.ts tests/core/analysis-fixture.test.ts`: 43 passed.
- `npm run typecheck && npm test && npm run build`: exit 0; 17 files, 190 tests passed; Vite build wrote `dist/index.html`.
- `git diff -- fixtures`: one line changed in `fixtures/incidents/slow-burn/expected.json`.
- Golden check: contains `0.575417`, `0.563158`, `0.540694`, the four labels and `"status":"ranked"`; no drive letter or backslash path.

## Next Phase Readiness

Phase 3 is functionally complete: ranking, confidence, Markdown export and fixture contracts are in place. Phase 4 (worker and console) can consume `AnalysisResult` and `serializeMarkdown` as is. Remaining reminders: history size cap (D-04), `src/core/signatures.ts` still has a private `compareText` copy, and DOM rendering must not use HTML sinks.

## Self-Check: PASSED

- Created files exist: `src/core/markdown.ts`, `tests/core/markdown.test.ts`, `tests/core/fixture-ranking.test.ts`, `tests/core/golden/ambiguous.canonical.json`.
- Commits: none exist by design (uncommitted at the user's direction); `plan_head_after` equals `plan_head_before`.
