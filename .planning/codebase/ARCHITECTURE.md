---
last_mapped_commit: 89ce56e1d2666fb2512c9de922ee03b463449d90
last_mapped_at: 2026-10-19
---
<!-- refreshed: 2026-10-19 -->

# Architecture

**Analysis Date:** 2026-10-19

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                 Browser shell (current state)                │
│  `index.html`  ->  `src/main.ts`  ->  `src/styles.css`       │
│  Static status card only; no input UI, no worker yet         │
└───────────────────────────┬─────────────────────────────────┘
                            │ (planned: worker protocol)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│               Pure analysis core (implemented)               │
│  `src/core/pipeline.ts`  `analyze(input) -> AnalysisOutcome` │
├──────────────┬──────────────┬──────────────┬────────────────┤
│ Log parsing  │ History parse│ Signatures   │ UTC buckets &  │
│ `log-parser` │ `history-    │ `signatures` │ onset          │
│ `normalize`  │  parser`     │              │ `buckets`,     │
│              │              │              │ `onset`        │
└──────────────┴──────┬───────┴──────────────┴────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  Result contract & serialization                             │
│  `model.ts` types, `serialization.ts` canonical JSON/Markdown│
│  `pipeline.ts` `toAnalysisResult()` adapts stream -> result  │
└─────────────────────────────────────────────────────────────┘
                      ▲
                      │ consumed by
┌─────────────────────┴───────────────────────────────────────┐
│  Verification: `tests/core/*.test.ts` against               │
│  `fixtures/incidents/{checkout-outage,slow-burn,ambiguous}`  │
└─────────────────────────────────────────────────────────────┘
```

## Pattern Overview

**Overall:** Layered pure-function core with a thin, not-yet-built browser shell. The core is dependency-free TypeScript that takes serializable text inputs and returns discriminated-union outcomes. Nothing in `src/core/` touches the DOM, the filesystem, `Date.now()`, randomness, or the network.

**Key Characteristics:**
- Pure core: every module in `src/core/` is a function of its arguments. Verified by `tests/core/determinism.test.ts`.
- Result-typed errors: parsers return `ParseOutcome<T>` (`{ ok: true, value, diagnostics } | { ok: false, error, diagnostics }`) from `src/core/input-errors.ts`, rather than throwing for input problems. Only `AnalysisInputError` (in `src/core/buckets.ts`) and plain `Error` are thrown, for invalid options and internal contract violations.
- Versioned, JSON-serializable contract: `SCHEMA_VERSION = 1`, `ANALYSIS_VERSION = 'analysis-v1'`, `SCORING_VERSION = 'scoring-v1'` are exported from `src/core/model.ts`. Output ordering is explicit (sorted by text comparison, then line/code/message).
- Two-stage result: `analyze()` produces an internal `AnalysisStream` (in `src/core/pipeline.ts`), and `toAnalysisResult()` adapts it into the public `AnalysisResult` that the serializer consumes.
- Locale-independent comparison: all sorts use the hand-written `compareText` (`<`/`>` comparison) rather than `localeCompare`. This pattern is repeated in `pipeline.ts`, `buckets.ts`, `signatures.ts`, `serialization.ts`, and `history-parser.ts`.
- Fixed, named thresholds: onset rules are exported constants in `src/core/onset.ts` (`MIN_OBSERVED_BUCKETS`, `SPIKE_BASELINE_MULTIPLIER`, `RAMP_RUN_LENGTH`, and so on). Ranking is explicitly not implemented yet.

## Layers

**Input normalization (utilities):**
- Purpose: Canonical timestamps, whitespace, repository paths, and stable IDs.
- Location: `src/core/normalization.ts`
- Contains: `normalizeTimestampUtc`, `canonicalWhitespace`, `normalizeRepositoryPath`, `stableSourceId`
- Depends on: nothing (leaf module)
- Used by: `log-parser.ts`, `history-parser.ts`, `serialization.ts`, `pipeline.ts`, `signatures.ts`

**Error and diagnostic model:**
- Purpose: Typed, actionable input errors with source, line, and record context.
- Location: `src/core/input-errors.ts`
- Contains: `InputErrorCode` union, `InputDiagnostic`, `CoreInputError` and subclasses (`EmptyInputError`, `MalformedInputError`, `UnsupportedFormatError`, `InputLimitError`, `HistoryValidationError`), `ParseOutcome<T>`
- Depends on: nothing
- Used by: both parsers, `pipeline.ts`

**Parsers (input adapters):**
- Purpose: Turn raw log and history text into validated domain documents.
- Location: `src/core/log-parser.ts` (JSON-lines and plain-text, dispatched by `parseLog`), `src/core/history-parser.ts` (`parseHistoryExport`, format `culprit-json` only)
- Depends on: `model.ts`, `input-errors.ts`, `normalization.ts`
- Used by: `pipeline.ts`

**Grouping and time-series analysis:**
- Purpose: Group errors by stable signature, bin events into fixed UTC buckets, classify onset.
- Location: `src/core/signatures.ts` (`groupErrorEvents`, `signatureForEvent`, `normalizeErrorMessage`), `src/core/buckets.ts` (`buildUtcBuckets`, `DEFAULT_BUCKET_MINUTES = 5`), `src/core/onset.ts` (`classifyOnset`)
- Depends on: `model.ts`, `normalization.ts`, `buckets.ts` (onset imports from buckets)
- Used by: `pipeline.ts`

**Orchestration:**
- Purpose: Single entry point that validates input options, runs parsers, groups, buckets, classifies, applies interpretation passes, and assembles the stream.
- Location: `src/core/pipeline.ts`
- Contains: `analyze`, `toAnalysisResult`, private interpreters `interpretSparseRamp` and `interpretWeakEvidence`, and private `ensureInput` validation
- Depends on: every core module above
- Used by: `tests/core/*.test.ts`; will be used by the worker (not yet built)

**Result contract and serialization:**
- Purpose: Public result types and the byte-stable output formats.
- Location: `src/core/model.ts` (types and version constants), `src/core/serialization.ts` (`canonicalizeResult`, `serializeCanonicalJson`, `serializeMarkdown`)
- Depends on: `model.ts`, `normalization.ts`
- Used by: tests and future UI export

**Browser shell (presentation):**
- Purpose: Renders the static landing state.
- Location: `index.html`, `src/main.ts`, `src/styles.css`
- Contains: one `querySelector('#status-copy')` that sets `textContent`. Nothing imports `src/core/` yet.
- Depends on: Vite module loading of `/src/main.ts`
- Used by: browser only

## Data Flow

### Primary Request Path (current, test-driven)

1. Caller builds an `AnalysisInput` (`{ logs: { text, format, source? }, history: { text, format, source? }, options? }`) defined in `src/core/model.ts`.
2. `analyze()` in `src/core/pipeline.ts` calls `ensureInput()`. This validates object shape, `bucketMinutes` and `maxLogBytes` (positive integers), formats (`jsonl` | `plain-text` for logs, `culprit-json` for history), and repository-relative source names.
3. `parseLog()` (`src/core/log-parser.ts`) and `parseHistoryExport()` (`src/core/history-parser.ts`) run. A failure in either returns through `analysisFailure()` with merged, sorted diagnostics.
4. `groupErrorEvents()` (`src/core/signatures.ts`) groups error and fatal events by signature.
5. `buildUtcBuckets()` (`src/core/buckets.ts`) builds the complete, gap-filled UTC bucket series.
6. `classifyOnset()` (`src/core/onset.ts`) applies the spike, ramp, insufficient-data, and none rules. `interpretSparseRamp()` and `interpretWeakEvidence()` in `pipeline.ts` may reclassify the result as `ramp` or `ambiguous`.
7. `analyze()` returns `{ ok: true, stream }` with `schemaVersion`, `provenance`, `limits`, `normalizedEvents`, `commits`, `errors`, `buckets`, `timeline`, `onset`, `warnings`, `assumptions`, and `diagnostics`.
8. `toAnalysisResult()` converts the stream to `AnalysisResult`. `suspects` is always `[]` and `commitShas` is always empty. The source comments state this is deferred to Phase 3.
9. `serializeCanonicalJson()` or `serializeMarkdown()` (`src/core/serialization.ts`) produce the final output.

### Planned Flow (from `.planning/research/ARCHITECTURE.md` and `.planning/ROADMAP.md`)

1. UI input adapter reads fixture or pasted text and enforces the byte cap.
2. A worker (`src/worker/analysis.worker.ts`, not yet present) receives `{ requestId, input }`, calls `analyze()`, and returns `{ requestId, ok, result | error }`.
3. Phase 3 adds feature extraction, scoring, and ranking that populate `suspects` and `commitShas`.
4. Phase 4 adds the incident-console UI (verdict, timeline, shortlist, evidence drawer).

**State Management:**
- The core is stateless. Each `analyze()` call is independent.
- The browser shell currently holds no state. The planned UI state machine is not implemented.

## Key Abstractions

**`AnalysisOutcome` / `ParseOutcome<T>`:**
- Purpose: Discriminated union for success or typed failure, so callers never need try/catch for input errors.
- Examples: `src/core/model.ts` (`AnalysisOutcome`), `src/core/input-errors.ts` (`ParseOutcome`)
- Pattern: `{ ok: true, ... } | { ok: false, error, diagnostics }`

**`LogEvent` and `ErrorGroup`:**
- Purpose: Normalized event with preserved raw text and source line, and the grouped signature with event IDs and first application stack frame.
- Examples: `src/core/model.ts`, produced by `src/core/log-parser.ts` and `src/core/signatures.ts`
- Pattern: `eventId` is a stable hash plus input-order ordinal (`finalizeEvents` in `log-parser.ts`).

**`UtcBucket` / `OnsetAnalysis`:**
- Purpose: Fixed-width buckets and the onset classification with baseline, peak, window, applied rule, and explanation.
- Examples: `src/core/buckets.ts`, `src/core/onset.ts`
- Pattern: The `classification` and `class` fields are kept in sync (both are set in `baseAnalysis` and `cloneOnset`), for compatibility.

**`AnalysisStream` vs `AnalysisResult`:**
- Purpose: The stream is the internal, richer shape with full normalized events and commits. The result is the public, versioned contract.
- Examples: `src/core/model.ts` (both interfaces), adapter at `src/core/pipeline.ts:289`
- Pattern: Deep-copy adapters (`{ ...frame }`, `[...group.eventIds]`) so the public output does not alias internal arrays.

## Entry Points

**Browser entry:**
- Location: `index.html` loads `/src/main.ts` as a module
- Triggers: Vite dev server (`npm run dev`) or static `dist/` served by `Dockerfile` CMD or `npm run preview`
- Responsibilities: Imports `./styles.css` and writes status copy into `#status-copy`

**Core entry:**
- Location: `src/core/pipeline.ts`, export `analyze`
- Triggers: Called from tests (`tests/core/pipeline.test.ts`, `tests/core/analysis-fixture.test.ts`) and the planned worker
- Responsibilities: Full analysis of one log and one history snapshot

**Test entry:**
- Location: `Makefile` target `test`, which runs `npm run typecheck`, `npm test` (`vitest run`), and `npm run build`
- Triggers: `make test` or the individual npm scripts

**Docker entry:**
- Location: `Dockerfile` (`FROM node:22.20.0-alpine`, build stage then runtime stage). The runtime stage copies only `dist/` and runs an inline Node `http` static server on port 4173 with SPA fallback to `index.html`.

## Architectural Constraints

- **Threading:** Single-threaded. No worker exists yet. The research document recommends `src/worker/` for large inputs, but the current core has no concurrency.
- **Global state:** No module-level mutable state in `src/core/`. Module-level constants only (for example `DEFAULT_LOG_LIMITS` in `src/core/log-parser.ts`, `SIGNAL_ORDER` in `src/core/serialization.ts`).
- **Circular imports:** None detected. Dependency direction is `pipeline` -> (`parsers`, `signatures`, `buckets`, `onset`) -> `normalization` / `input-errors` / `model`. `buckets.ts` re-exports `UtcBucket` from `model.ts`. `serialization.ts` re-exports `normalizeRepositoryPath` from `normalization.ts`.
- **Determinism:** `log-parser.ts` and `normalization.ts` must not use local time. `normalizeTimestampUtc` requires an explicit `Z` or numeric offset.
- **Layer boundary:** The research document forbids `core` from importing DOM, Vite, or UI code. This is currently respected because `src/core/` has no such imports.
- **Export naming:** `model.ts` exposes both `classification` and `class` (and `windowStartUtc` and `onsetWindow`) on `OnsetAnalysis` for backward compatibility. Both must be kept in sync.

## Anti-Patterns

### Dual-field onset objects

**What happens:** `OnsetAnalysis` and `OnsetSummary` carry duplicated fields (`classification`/`class`, `onsetWindow`/`windowStartUtc`/`windowEndUtc`). `cloneOnset` in `src/core/pipeline.ts` rebuilds both sides.
**Why it's wrong:** Any new interpretation pass that updates one field and forgets the other will silently desynchronise the stream and the result.
**Do this instead:** Update both fields through `cloneOnset` or `baseAnalysis` in `src/core/onset.ts` and `src/core/pipeline.ts`. Add a test that asserts the pair is equal, following the pattern in `tests/core/onset.test.ts`.

### Interpretation passes that reclassify onset

**What happens:** `interpretSparseRamp` and `interpretWeakEvidence` in `src/core/pipeline.ts` override the classifier output after `classifyOnset` runs.
**Why it's wrong:** The fixed classifier rules in `onset.ts` are no longer the only source of truth for classification, which makes fixture expectations harder to reason about.
**Do this instead:** Put new onset rules inside `src/core/onset.ts` and keep `pipeline.ts` as orchestration only. Each rule should name itself in `appliedRule`, as the existing rules do.

### Hard-coded stub ranking in the adapter

**What happens:** `toAnalysisResult()` returns `suspects: []`, `confidence.scoreSeparation: null`, and `evidenceCompleteness: 0`, and `confidenceFor()` derives a band from onset class alone.
**Why it's wrong:** A reader of the public result can mistake the placeholder for a real confidence signal. This is acceptable only until Phase 3.
**Do this instead:** When Phase 3 lands, replace `confidenceFor` with a score-derived band and keep the placeholder fields unreachable from the UI.

## Error Handling

**Strategy:** Result types for input errors, exceptions for programmer errors.

**Patterns:**
- Parsers return `ParseOutcome<T>`. Errors extend `CoreInputError` and carry `toDiagnostic()` (see `src/core/input-errors.ts`).
- `analyze()` never throws for bad user input. It returns `{ ok: false, error, diagnostics }`, and `ensureInput` in `pipeline.ts` handles malformed top-level shapes.
- `sourceName()` in `pipeline.ts` converts a path rejection into `AnalysisInputError`, and `ensureInput` catches it.
- Recoverable parser problems become diagnostics on successful outcomes and are summarised into `warnings` via `recoverableWarnings()`.

## Cross-Cutting Concerns

**Logging:** None. The core produces diagnostics, not logs. `console` is not used in `src/`.
**Validation:** Layered. Options are validated in `ensureInput`. Log and history records are validated in their parsers. Timestamps and paths use `normalization.ts`.
**Authentication:** Not applicable. The app has no server and no accounts.
**Privacy:** The core is network-free and the browser shell contains no network calls. `index.html` states that no data leaves the browser.

---

*Architecture analysis: 2026-10-19*
