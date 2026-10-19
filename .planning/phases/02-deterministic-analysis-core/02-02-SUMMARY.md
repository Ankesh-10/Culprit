# Phase 2 Plan 02 Summary

## Outcome

Implemented deterministic error signatures, fixed-width UTC buckets, and onset classification while preserving the Phase 1 model and serialization contracts. Error grouping retains normalized identity, raw message variants, first/last UTC evidence, stable event IDs, application/vendor stack frames, and explicit vendor-only diagnostics. Bucket construction emits complete half-open UTC intervals with gaps, deterministic nested ordering, boundary-correct placement, and an empty series for empty input. Onset classification applies the published fixed rules for `spike`, `ramp`, wire-compatible `none`, and `insufficient-data` without current time, locale, randomness, network, DOM, filesystem, or absolute paths.

## Files

- `src/core/model.ts` — added signature evidence, `UtcBucket`, and `OnsetAnalysis` support types without removing Phase 1 fields or values.
- `src/core/signatures.ts` — added ordered conservative message normalization, event signatures, stable error grouping, raw evidence retention, application-frame preference, and vendor-only warnings.
- `src/core/buckets.ts` — added `DEFAULT_BUCKET_MINUTES`, typed width validation, exported `UtcBucket`, and complete fixed UTC half-open bucket construction.
- `src/core/onset.ts` — added fixed detection constants and deterministic spike/ramp/none/insufficient-data classification.
- `tests/core/signatures.test.ts` — added variable-token, distinct-exception, evidence-order, grouping, and vendor-only diagnostic coverage.
- `tests/core/onset.test.ts` — added UTC boundary/gap/empty/invalid-width tests plus spike, ramp, none, insufficient-data, and repeatability coverage.

## Commits

- `7fb4678 feat(core): add deterministic error signatures`
- `80b0605 feat(core): build deterministic UTC buckets`
- `fd812a1 feat(core): classify deterministic onset patterns`
- `e37cfee fix(core): export UTC bucket contract`
- This summary is committed separately as the plan artifact.

## Verification

- `npm test -- --run tests/core/signatures.test.ts` — passed, 1 file / 4 tests.
- `npm test -- --run tests/core/onset.test.ts -t "fixed UTC buckets"` — passed, 1 file / 3 tests.
- `npm test -- --run tests/core/onset.test.ts` — passed, 1 file / 7 tests.
- `npm run typecheck` — passed after each implementation task and in final verification.
- `npm test` — passed, 9 files / 48 tests.
- `npm run build` — passed; Vite produced `dist/index.html` and assets.
- `git diff --check` — passed for the plan-target changes; pre-existing unrelated worktree changes were not staged.

## Deviations

- Added `AnalysisInputError` in `src/core/buckets.ts` as the typed analysis-option error required for invalid bucket widths; existing Phase 1 input errors were intentionally not broadened.
- Added a small follow-up export commit so `UtcBucket` is available from `src/core/buckets.ts`, matching the plan artifact boundary.
- The checked-in Phase 1 fixture expected slow-burn window metadata remains untouched; this plan implements the fixed synthetic classification rules and does not alter fixture metadata or introduce the Phase 3 pipeline.
- Existing unrelated worktree changes and untracked artifacts, including `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/HANDOFF.json`, Phase 1 planning artifacts, and other repository inputs, were not modified or staged.

## Self-check

- Phase 1 `OnsetClass` values, result fields, version constants, serializer imports, and existing tests remain intact.
- Signature normalization preserves exception classes and operation words while replacing UUIDs, long identifiers, numeric values, and quoted values in ordered, locale-independent steps.
- Group, frame, bucket, and onset arrays have explicit deterministic ordering; event input order does not affect results.
- Bucket intervals are UTC ISO strings with `Z`, half-open, gap-filled, and never anchored to the current clock.
- Onset thresholds are fixed at 3 observed buckets, 3 errors, first-two-bucket baseline, spike peak >= 3 and >= 3x baseline and >= 2 over the preceding bucket, and a qualifying three-bucket ramp with final-first >= 2 above baseline.
- Only plan-listed implementation/test files plus this requested summary were changed by this plan; no serializer, planning state, roadmap, or unrelated artifact was edited.
