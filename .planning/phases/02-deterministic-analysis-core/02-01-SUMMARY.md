# Phase 2 Plan 01 Summary

## Outcome

Implemented the deterministic Phase 2 input boundary. Phase 1 result/model and serializer exports remain available, while the pure core now provides UTC/path/whitespace normalization, content-derived source IDs, typed recoverable input errors, strict JSONL/plain-text log parsing, multiline stack diagnostics, and canonical validation of the versioned `culprit-json` history export.

## Files

- `src/core/model.ts` — added normalized log/history domain contracts while preserving all Phase 1 result types and version constants.
- `src/core/input-errors.ts` — added stable input error codes, diagnostics, typed error classes, and `ParseOutcome<T>`.
- `src/core/normalization.ts` — added explicit-offset UTC normalization, repository-relative POSIX paths, canonical whitespace, and deterministic source IDs.
- `src/core/serialization.ts` — preserved the Phase 1 `normalizeRepositoryPath` import path through a shared implementation and retained serialization behavior.
- `src/core/log-parser.ts` — added bounded JSONL/plain-text parsing and `parseLog` dispatch with deterministic event IDs/order and stack-frame diagnostics.
- `src/core/history-parser.ts` — added strict versioned `culprit-json` parsing, validation, aliases, duplicate/conflict handling, and canonical ordering.
- `tests/core/normalization.test.ts`, `tests/core/input-errors.test.ts`, `tests/core/log-parser.test.ts`, `tests/core/history-parser.test.ts` — added focused contract and boundary coverage.
- `README.md` — documented exact log/history schemas, UTC/path rules, stack behavior, caps, diagnostics, and unsupported arbitrary git-log prose.

## Commits

- `af1df03 feat(core): add normalized input contracts`
- `797392d feat(core): parse deterministic log inputs`
- `91331fb feat(core): validate culprit history exports`
- `9f22192 fix(core): reject conflicting history aliases`
- This summary is committed separately as the plan artifact.

## Verification

- `npm test -- --run tests/core/normalization.test.ts tests/core/input-errors.test.ts tests/core/serialization.test.ts` — passed, 3 files / 7 tests.
- `npm run typecheck` — passed after each implementation task and in the final verification.
- `npm test -- --run tests/core/log-parser.test.ts` — passed, 1 file / 6 tests.
- `npm test -- --run tests/core/history-parser.test.ts` — passed, 1 file / 8 tests.
- `npm test -- --run tests/core/normalization.test.ts tests/core/input-errors.test.ts tests/core/log-parser.test.ts tests/core/history-parser.test.ts tests/core/serialization.test.ts` — passed, 5 files / 21 tests.
- `npm test` — passed, 7 files / 37 tests.
- `npm run build` — passed; Vite produced `dist/index.html` and assets.
- `git diff --check` — passed.

## Deviations

- Added one small follow-up fix commit after the history task to reject conflicting `message`/`subject` aliases and empty touched-file arrays; this strengthens the stated validation contract without changing the public schema.
- Existing unrelated worktree changes and untracked artifacts, including `.planning/STATE.md`, were not modified or staged.
- No Docker or `make test` invocation was added to this plan’s verification because those Phase 1 rebuild-surface checks remain environment-dependent; the existing full Vitest, typecheck, and build checks passed.

## Self-check

- Phase 1 model names, version constants, serializer exports, canonical UTC output, and path behavior remain intact.
- Pure core modules use no DOM, Vite, filesystem, locale, current-time, randomness, or network APIs.
- Accepted timestamps require `Z` or an explicit numeric offset; accepted paths are repository-relative POSIX identities.
- Invalid records are never silently discarded: outcomes retain typed errors or line/record-aware diagnostics, and multiline stack failures retain raw lines.
- The implementation changes only the plan-listed source, test, README, and required summary files.
