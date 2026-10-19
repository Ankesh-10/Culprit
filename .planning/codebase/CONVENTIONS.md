---
last_mapped_commit: 89ce56e1d2666fb2512c9de922ee03b463449d90
last_mapped_at: 2026-10-19
---
# Coding Conventions

**Analysis Date:** 2026-10-19

## Naming Patterns

**Files:**
- Source modules use kebab-case under `src/core/`: `log-parser.ts`, `history-parser.ts`, `input-errors.ts`, `normalization.ts`, `pipeline.ts`, `serialization.ts`, `signatures.ts`, `buckets.ts`, `onset.ts`, `model.ts`.
- Test files mirror the source name with a `.test.ts` suffix under `tests/core/`: `tests/core/onset.test.ts`, `tests/core/log-parser.test.ts`, `tests/core/fixture-contract.test.ts`.
- Browser entry point is `src/main.ts`; stylesheet is `src/styles.css`.
- Fixture directories are kebab-case incident names: `fixtures/incidents/checkout-outage/`, `fixtures/incidents/slow-burn/`, `fixtures/incidents/ambiguous/`, each holding `logs.jsonl`, `history.json`, `expected.json`, `manifest.json`.

**Functions:**
- camelCase verbs describing the transformation: `parseLog`, `parseHistoryExport`, `normalizeTimestampUtc`, `normalizeRepositoryPath`, `normalizeErrorMessage`, `signatureForEvent`, `groupErrorEvents`, `classifyOnset`, `buildUtcBuckets`, `serializeCanonicalJson`, `serializeMarkdown`, `toAnalysisResult`.
- Module-private helpers are declared as non-exported `function` declarations near their use, for example `compareText`, `compareEvents`, `frameKey`, `sortedUnique` in `src/core/signatures.ts`, and `diagnosticOrder`, `publicDiagnostic`, `invalidOutcome` in `src/core/pipeline.ts`.
- Local validators in parsers are named `assert*`/`require*`-style and throw on failure. Example: `history-parser.ts` line ~36 `throw new HistoryValidationError(\`${label} must be an object.\`, ...)`.

**Variables:**
- `const` is the default; `let` only for loop state or accumulators (see `longestRun`/`currentRun` in `src/core/pipeline.ts`).
- Module-level constants use SCREAMING_SNAKE_CASE for configuration and compiled regexes: `DEFAULT_LOG_LIMITS` (`src/core/log-parser.ts`), `DEFAULT_BUCKET_MINUTES` (`src/core/buckets.ts`), `UUID_PATTERN`, `LONG_HEX_PATTERN`, `REQUEST_IDENTIFIER_PATTERN` (`src/core/signatures.ts`), `LOG_LEVELS`, `JSON_FIELDS`, `PREFIX_PATTERN` (`src/core/log-parser.ts`).
- Numeric literals use underscore separators: `1_048_576`, `10_000`, `300_000`.
- Message-level constants that describe assumptions are named `*_ASSUMPTION` (for example `UTC_ASSUMPTION`, `CAUSALITY_ASSUMPTION` in `src/core/pipeline.ts`).

**Types and Interfaces:**
- Domain shapes are exported `interface` declarations in `src/core/model.ts`, for example `LogEvent`, `ErrorGroup`, `UtcBucket`, `OnsetAnalysis`, `AnalysisResult`, `AnalysisInput`.
- Unions are exported `type` aliases: `OnsetClass`, `LogFormat`, `LogLevel`, `Diagnostic['source']`.
- Error code unions are string-literal types: `InputErrorCode` in `src/core/input-errors.ts` (`'EMPTY_INPUT' | 'MALFORMED_RECORD' | ...`). Codes are SCREAMING_SNAKE_CASE strings and are part of the public contract, asserted by tests.
- Options objects use `interface` (`LogParserOptions`, `InputErrorDetails`) with optional fields; `exactOptionalPropertyTypes` is on, so optional fields must not be assigned `undefined` explicitly.

## Code Style

**Formatting:**
- No Prettier or formatter config is committed. Observed style is consistent by hand:
  - 2-space indentation.
  - Single quotes for strings (`'utf8'`, `'trace'`), with template literals for interpolation.
  - Semicolons on all statements.
  - Trailing commas in multi-line object and array literals.
  - Soft wrap around 120 characters. About 159 lines across `src/core/*.ts` and `tests/core/*.ts` exceed 120 characters, and about 37 source lines exceed 160, so treat 120 as the target and avoid growing long lines further.
- Single-line `if` bodies without braces are used for guard clauses: `if (bucket === undefined) throw new AnalysisInputError(...)`, `if (month < 1 || ...) { throw ... }` also appears with braces. Either is accepted; prefer braces when the body is multi-line.

**Linting:**
- No ESLint or Biome config is present. Quality is enforced by the TypeScript compiler only.
- `tsconfig.json` is the authoritative strictness setting: `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, `verbatimModuleSyntax: true`, `isolatedModules: true`, `noEmit: true`, `moduleResolution: "Bundler"`, `allowImportingTsExtensions: true`.
- Consequences to follow: indexed access returns `T | undefined` and must be narrowed (for example `onset.buckets[index]?.errorCount ?? 0`, `nonEmpty.at(-1)` followed by an `undefined` check); `import type` is required for type-only imports; inline `type` modifiers are used in mixed imports (`import { UnsupportedFormatError, type InputDiagnostic } from './input-errors'`).
- No `any`, `@ts-ignore`, or `@ts-expect-error` appears in `src/` or `tests/`. Keep it that way.
- No `console.*` calls appear in `src/`.

## Import Organization

**Order:**
1. Type-only imports from domain model first: `import type { ... } from './model';`
2. Value imports from sibling core modules, grouped by module.
3. Node built-ins in tests use the `node:` prefix: `import { readFileSync } from 'node:fs';`
4. Test framework last in the test header: `import { describe, expect, it } from 'vitest';`

Observed in `src/core/pipeline.ts`: `model` types, then `buckets`, `log-parser`, `history-parser`, `signatures`, `onset`, `normalization`, `input-errors`.

**Path Aliases:**
- None. Imports are relative. `src` modules import `./x`, tests import `../../src/core/x`.
- Explicit `.ts` extensions are not used in import specifiers; bundler resolution is relied on.

**Barrel Files:**
- Not used. Each module is imported directly from its file.

## Error Handling

The codebase uses two complementary styles. Follow both as they are used today:

**1. Throwing typed errors inside core helpers.** Helpers throw a class from `src/core/input-errors.ts` or a local error class:
- `CoreInputError` base class carries `code`, `source`, `line`, `record`, `field`, `raw`, and exposes `toDiagnostic()`.
- Subclasses: `EmptyInputError`, `MalformedInputError`, `UnsupportedFormatError`, `InputLimitError`, `HistoryValidationError`.
- `AnalysisInputError` (in `src/core/buckets.ts`) is used for bucket and timestamp validation.
- Example: `src/core/history-parser.ts` line ~95 `throw new HistoryValidationError('sha must be exactly 40 lowercase hexadecimal characters.', { ...details, field: 'sha' });`.
- Pass structured details through the `details` object (`{ source, line, record, field, raw }`) rather than concatenating them into the message.

**2. Returning outcome unions at the public boundary.** Public entry points do not throw for expected input problems. They return a discriminated union:
- `ParseOutcome<T>` in `src/core/input-errors.ts`: `{ ok: true; value; diagnostics } | { ok: false; error; diagnostics }`.
- `AnalysisOutcome` returned from `analyze()` in `src/core/pipeline.ts`. Use `invalidOutcome(error, diagnostic)` to build failures.
- Callers narrow with `if (!outcome.ok) throw outcome.error;` in tests, or `if (!failure.ok) expect(failure.error.code)...`.

**Known inconsistency to avoid repeating:** `normalizeTimestampUtc` in `src/core/normalization.ts` throws a plain `RangeError`, while nearby validators throw `HistoryValidationError`/`AnalysisInputError`. New code should throw a `CoreInputError` subclass so diagnostics keep stable codes. Do not add more bare `Error` or `RangeError` throws at the core boundary.

**Diagnostics:** Diagnostics are sorted deterministically before being returned (`diagnosticOrder` in `src/core/pipeline.ts` sorts by `source`, `line`, `code`, `message` using `compareText`). New diagnostic producers must keep this order.

## Logging

**Framework:** None. `console` is not used in `src/`. The core is pure and returns data; the UI in `src/main.ts` writes to the DOM via `textContent`.

**Patterns:**
- Do not add logging to `src/core/`. Surface information through `diagnostics` arrays.
- Diagnostics carry `source`, `code`, `message`, `line`, `record`; they are the logging channel.

## Comments

**When to Comment:**
- Explain why a non-obvious rule exists (determinism, ordering, rounding), not what the code does. Example in `src/core/signatures.ts`: "Replace only high-cardinality values while retaining the words that explain the operation. Replacement order is intentional and locale independent."
- Mark assumptions and deliberate limits in constants (`*_ASSUMPTION`) and in phase notes such as `PHASE_THREE_ASSUMPTION` in `src/core/pipeline.ts`.
- Test files use short descriptive `it(...)` titles instead of inline comments.

**JSDoc/TSDoc:**
- Used sparingly on exported functions: about 6 source files carry `/** ... */` blocks, for example `normalizeTimestampUtc`, `normalizeErrorMessage`, `signatureForEvent`, `interpretSparseRamp`.
- Use a one-line `/** ... */` summary. Do not add `@param`/`@returns` tags unless the signature is ambiguous.

## Function Design

**Size:** Keep helpers small and single-purpose. `pipeline.ts` is the orchestration file (328 lines) and composes the others; new behaviour should go into a focused module and be called from `analyze()`.

**Parameters:**
- Positional parameters for 1-3 required values (`buildUtcBuckets(events, groups, bucketMinutes)`).
- Options objects with optional fields for anything else (`LogParserOptions`, `InputErrorDetails`). Provide defaults via `DEFAULT_*` constants rather than magic numbers.
- Use `readonly` on interface fields that must not change after construction (`readonly code: InputErrorCode` in `CoreInputError`).

**Return Values:**
- Pure functions return new objects. Copy arrays and nested records before returning when they originate from input: `[...bucket.eventIds]`, `{ ...bucket.signatureCounts }` (see `cloneOnset` in `src/core/pipeline.ts`).
- Output arrays are sorted with explicit comparators; never rely on insertion order from `Map`/`Set` without sorting. Use `sortedUnique` (`src/core/signatures.ts`) for string sets.
- Use `Date.parse` / ISO strings for time; keep timestamps as UTC ISO strings with milliseconds (`2026-10-19T08:00:00.000Z`) in outputs.

## Determinism Rules (project constraint)

These are enforced by tests in `tests/core/determinism.test.ts` and must be followed in all core code:
- No `Date.now()`, `new Date()` without arguments, `Math.random()`, `process.env` reads, or locale-dependent formatting (`toLocaleString`, `Intl`) inside `src/core/`.
- Compare strings with `compareText` (code-unit comparison), not `localeCompare`.
- Analysis output must be byte-identical for permitted record reordering. Sort before emitting.
- Repository paths are validated with `normalizeRepositoryPath` (repo-relative, traversal-free). Never emit absolute or machine-specific paths.

## Module Design

**Exports:**
- Named exports only. `export default` is not used anywhere.
- Each core module exports the functions and types that other modules or tests need; keep helpers unexported.
- Types live in `src/core/model.ts` and are re-used across modules via `import type`.

**Barrel Files:** Not used.

**Browser code:** `src/main.ts` is a side-effect module that queries the DOM with `document.querySelector<HTMLElement>('#id')` and guards for `null` before use. Keep DOM code out of `src/core/` so it stays testable under Node.

---

*Convention analysis: 2026-10-19*
