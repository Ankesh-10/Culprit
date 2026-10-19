---
phase: 02-deterministic-analysis-core
verified: 2026-10-19
status: passed
verdict: PASS_WITH_LIMITATIONS
requirements: [INPUT-01, INPUT-02, INPUT-03, INPUT-04, INPUT-05, INPUT-06, INPUT-07, INPUT-08]
---

# Phase 2 Verification

## Verdict

**PASS WITH LIMITATIONS.** The deterministic analysis-core goal is implemented and the automated checks pass. The parser and pipeline boundary is ready for the browser console. Browser file-picker/drag-and-drop loading is not implemented yet; that interaction belongs to Phase 4's incident-console work even though INPUT-01, INPUT-02, and INPUT-05 are currently mapped to this phase in the requirements table.

## Phase-goal evidence

| Area | Result | Evidence |
|---|---|---|
| JSON-lines and plain-text parsing | PASS | `src/core/log-parser.ts`; `tests/core/log-parser.test.ts`; `tests/core/pipeline.test.ts` |
| Typed errors and diagnostics | PASS | `src/core/input-errors.ts`; parser and pipeline tests cover empty, malformed, unsupported, and oversized inputs with line/record context |
| Multiline stack attachment | PASS | `src/core/log-parser.ts`; fixture and pipeline tests preserve application/vendor stack evidence and attachment diagnostics |
| `culprit-json` history export | PASS | `src/core/history-parser.ts`; `tests/core/history-parser.test.ts` cover fields, paths, ranges, aliases, duplicates, and conflicts |
| UTC/path/source normalization | PASS | `src/core/normalization.ts`; normalization, parser, history, and determinism tests |
| Signatures | PASS | `src/core/signatures.ts`; `tests/core/signatures.test.ts` cover variable scrubbing, counts, first-seen time, event IDs, and frame evidence |
| Buckets and onset | PASS | `src/core/buckets.ts` and `src/core/onset.ts`; `tests/core/onset.test.ts` cover UTC boundaries, gaps, spike, ramp, none, and insufficient-data |
| Pure composition | PASS | `src/core/pipeline.ts`; pipeline, fixture, serialization, and determinism tests |

## Requirement evidence

| Requirement | Result | Notes |
|---|---|---|
| INPUT-01 | PASS WITH LIMITATION | JSONL parser and pipeline are complete; browser picker/drop interaction is deferred to Phase 4. |
| INPUT-02 | PASS WITH LIMITATION | Plain-text parser and documented grammar are complete; browser input wiring is deferred to Phase 4. |
| INPUT-03 | PASS | Recoverable typed errors and diagnostics are implemented and tested. |
| INPUT-04 | PASS | Multiline attachment and line-aware diagnostics are implemented; additional overflow/conflicting-continuation cases remain useful follow-up coverage. |
| INPUT-05 | PASS WITH LIMITATION | History export parser is complete; browser file loading is deferred to Phase 4. |
| INPUT-06 | PASS | UTC normalization and disclosure are present in structured and Markdown output. |
| INPUT-07 | PASS | Fixed UTC buckets and deterministic spike/ramp/none/insufficient-data classification are implemented and tested. |
| INPUT-08 | PASS | Stable normalized signatures preserve first-seen time, counts, source event IDs, and stack evidence. |

## Checks run

| Command | Result |
|---|---|
| `npm test` | PASS — 12 files, 63 tests |
| `npm run typecheck` | PASS |
| `npm run build` | PASS — produced `dist/index.html` |
| `npm run typecheck && npm test && npm run build` | PASS — equivalent Makefile sequence |
| `git diff --check` | PASS |
| `make test` | NOT RUN — GNU Make unavailable on this Windows host |

## Determinism and privacy review

- Repeated and permitted reordered fixture inputs produce byte-identical canonical JSON and Markdown.
- Tests cover UTC and America/Los_Angeles timezone variants, locale changes, `Date.now` stubbing, and `Math.random` stubbing with global restoration.
- Pure core modules contain no DOM, Vite, filesystem, network, locale-formatting, current-time, or randomness dependency.
- Repository paths are normalized to relative POSIX form; absolute and traversal paths are rejected.
- No secrets or runtime remote endpoints were introduced.

## Limitations and follow-up

1. Phase 4 must wire the parser/pipeline boundary to browser file-picker, drag-and-drop, and any supported text-input controls before claiming the literal user-facing portions of INPUT-01, INPUT-02, and INPUT-05.
2. Add focused direct tests for exact 1 MiB/event/stack caps, timestamp-conflicting continuation lines, stack overflow, and a normal no-incident pipeline input with unmatched stack evidence.
3. Literal Docker and `make test` execution remains environment-dependent on this host; source contracts and the equivalent npm sequence pass.

## Completion recommendation

Mark Phase 2 complete for its deterministic analysis-core goal, retain the limitations above as verification debt, and carry the browser-loading work into Phase 4 rather than weakening the pure-core boundary.
