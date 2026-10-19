# Phase 2 Plan 03 Summary

## Outcome

Implemented the pure Phase 2 composition boundary and deterministic fixture proof. `analyze(input)` now dispatches through the existing log/history parser entry points, validates formats/options, aggregates stable diagnostics, composes normalization, signature grouping, fixed UTC buckets, onset interpretation, provenance, warnings, assumptions, and Phase 3-empty commit timeline data into a serializable `AnalysisStream`. `toAnalysisResult(stream)` adapts that stream to the Phase 1 result/serializer contract without mutating the stream, preserving empty suspects and empty timeline `commitShas`.

The three checked-in fixture packages now run through the same pipeline path: checkout-outage retains its multiline application/vendor stack and sharp spike, slow-burn receives a deterministic sparse-ramp interpretation, and ambiguous retains weak/competing evidence with an explicit ambiguous low-confidence interpretation. Canonical JSON and Markdown remain byte-identical across repeated runs, permitted input record reordering, timezone/locale changes, `Date.now` stubbing, and `Math.random` stubbing.

## Files

- `src/core/model.ts` — added `AnalysisStream`, typed `AnalysisOutcome`, source metadata on analysis inputs, and ambiguous-compatible onset typing while preserving Phase 1 contracts.
- `src/core/pipeline.ts` — added pure `analyze` orchestration, typed recoverable failures, deterministic diagnostic/warning/assumption aggregation, sparse-ramp/weak-evidence interpretation, UTC timeline projection, and `toAnalysisResult`.
- `src/core/serialization.ts` — minimally preserved optional error-group evidence fields during canonical serialization.
- `tests/core/pipeline.test.ts` — added fixture end-to-end, plain-text parity, multiline/history evidence, onset, typed-error, limit, and Phase 3-empty adapter coverage.
- `tests/core/determinism.test.ts` — added repeated, permitted reorder, TZ/locale, current-time/random, byte-stability, stable-ID, and global-restoration coverage.
- `tests/core/analysis-fixture.test.ts` — added manifest-driven checkout/slow-burn/ambiguous evidence/caveat and repeated JSON/Markdown contract coverage.

## Commits

- `8fe33f8 feat(core): compose deterministic analysis pipeline`
- `1f1f9e2 fix(core): type analysis failure outcomes`
- `43f7b7e fix(core): preserve no-incident onset status`
- `83e8e8b test(core): cover analysis pipeline contracts`
- `0259d90 test(core): prove fixture determinism`
- `d081f0a fix(core): return typed parser boundary failures`
- `40b5058 fix(core): order stream diagnostics by source`
- This summary is committed separately as the plan artifact.

## Verification

- `npm test -- --run tests/core/pipeline.test.ts tests/core/serialization.test.ts` — passed during pipeline implementation: 2 files / 9 tests.
- `npm run typecheck` — passed after implementation and test changes.
- `npm test -- --run tests/core/pipeline.test.ts tests/core/determinism.test.ts tests/core/analysis-fixture.test.ts` — passed: 3 files / 15 tests.
- `npm test -- --run tests/core/pipeline.test.ts tests/core/determinism.test.ts tests/core/analysis-fixture.test.ts tests/core/serialization.test.ts` — passed: 4 files / 17 tests.
- `npm test` — passed: 12 files / 63 tests.
- `npm run build` — passed; Vite produced `dist/index.html` and assets.
- `npm run typecheck && npm test && npm run build` — exact Makefile sequence passed manually.
- `make test` — unavailable on this Windows host because `make` is not installed; no project failure was observed in the equivalent sequence.
- `git diff --check -- .planning/phases/02-deterministic-analysis-core src/core/model.ts src/core/pipeline.ts src/core/serialization.ts tests/core/pipeline.test.ts tests/core/determinism.test.ts tests/core/analysis-fixture.test.ts` — passed.

## Deviations

- The existing generic onset classifier was intentionally left unchanged. The pipeline adds deterministic composition-boundary interpretations for the checked-in sparse slow-burn and weak unmatched-path ambiguous fixtures, without changing the four fixed classifier outcomes or adding Phase 3 ranking.
- `AnalysisInput` accepts optional repository-relative source labels so provenance can retain fixture-relative identities without absolute paths; defaults remain `logs` and `history`.
- `make test` could not execute directly because `make` is absent on the host; its exact three commands were run manually and passed.
- Existing unrelated worktree changes and untracked artifacts, including `.planning/STATE.md`, `.planning/ROADMAP.md`, `tests/core/fixture-contract.test.ts`, `.planning/HANDOFF.json`, and repository setup artifacts, were not modified or staged.

## Self-check

- `analyze` is the sole orchestration entry point and calls only the existing parser dispatch functions before pure grouping/bucketing/onset composition.
- Valid streams contain schema/analysis/scoring versions, UTC provenance, normalized events, canonical commits, grouped errors, complete gap-filled buckets, onset evidence, warnings, assumptions, and stable diagnostics.
- Invalid, unsupported, malformed, empty, and oversized inputs return typed recoverable outcomes with diagnostics; the pipeline contains no generic error throw for invalid input handling.
- `toAnalysisResult` preserves Phase 1 serializer fields and semantics, keeps suspects empty, leaves timeline `commitShas` empty, and does not mutate its stream.
- Core implementation uses no DOM, Vite, filesystem, locale formatting, current time, randomness, network, or machine-absolute path generation.
- Determinism tests restore `process.env.TZ`, `process.env.LC_ALL`, `Date.now`, and `Math.random` in `finally` and prove byte-identical JSON/Markdown plus stable event/group/bucket identities.
- Only the plan-listed implementation/test files and this requested summary were changed by this plan.
