---
last_mapped_commit: 89ce56e1d2666fb2512c9de922ee03b463449d90
last_mapped_at: 2026-10-19
---
# Testing Patterns

**Analysis Date:** 2026-10-19

## Test Framework

**Runner:**
- Vitest 3.2.4 (pinned in `package.json` devDependencies; exact version also in `package-lock.json`).
- Config: no `vitest.config.*`. Vitest reads `vite.config.ts` at the repo root, which only sets `build` options. Test globals are typed via `tsconfig.json` `"types": ["node", "vitest/globals"]`, but tests import `describe`, `expect`, `it` explicitly from `'vitest'` and should continue to do so.
- Test environment is Node (no jsdom or happy-dom installed). DOM code in `src/main.ts` is not unit-tested.

**Assertion Library:**
- Vitest built-in `expect` (Chai-style matchers plus `toEqual`, `toMatchObject`, `toThrowError`, `toBe`).

**Run Commands:**

```bash
npm test                 # Run all tests once (vitest run). Single offline test command.
npm run typecheck        # tsc --noEmit over src, tests, vite.config.ts
npm run build            # typecheck then vite build (production bundle to dist/)
make test                # typecheck + test + build, the full local gate (Makefile)
npm run dev              # Vite dev server (not part of tests)
```

- Watch mode is not scripted. Use `npx vitest` (without `run`) manually if needed. Do not add `vitest` without `run` to the `test` script; it must stay non-watch.
- Coverage is not scripted. No `@vitest/coverage-*` package is installed.

## Test File Organization

**Location:**
- All tests live in a separate tree: `tests/core/`. Tests are not co-located with source.
- There is one test directory level (`tests/core/`) mirroring `src/core/`.
- The `tests/` tree currently contains only `tests/core/`. UI tests have no home yet.

**Naming:**
- `<module-or-concern>.test.ts`, kebab-case, matching the source module where one exists:
  - `log-parser.test.ts` tests `src/core/log-parser.ts`
  - `history-parser.test.ts` tests `src/core/history-parser.ts`
  - `onset.test.ts` tests `src/core/onset.ts` and also `src/core/buckets.ts` (buckets are exercised inside onset tests; there is no `buckets.test.ts`)
  - `signatures.test.ts` tests `src/core/signatures.ts`
  - `normalization.test.ts`, `input-errors.test.ts`, `serialization.test.ts`
- Cross-cutting suites use descriptive names: `pipeline.test.ts`, `determinism.test.ts`, `analysis-fixture.test.ts`, `fixture-contract.test.ts`, `rebuild-surface.test.ts`.

**Structure:**

```
tests/
└── core/
    ├── analysis-fixture.test.ts     # analyze() over each shared fixture, checks manifest contract
    ├── determinism.test.ts          # byte-identical output, reordering, TZ/locale/Date.now/Math.random isolation
    ├── fixture-contract.test.ts     # validates fixtures/incidents/* files against expected.json and manifest.json
    ├── history-parser.test.ts
    ├── input-errors.test.ts         # stable error codes and ParseOutcome shape
    ├── log-parser.test.ts
    ├── normalization.test.ts
    ├── onset.test.ts
    ├── pipeline.test.ts
    ├── rebuild-surface.test.ts      # checks .nvmrc, package.json scripts, lockfile version
    ├── serialization.test.ts
    └── signatures.test.ts
```

- 12 test files, about 41 `it(...)` cases, 7 `toThrow*` assertions at last count.

## Test Structure

**Suite Organization:**
Standard Vitest `describe`/`it` nesting, one `describe` per module or concern, with human-readable sentence titles:

```typescript
import { describe, expect, it } from 'vitest';
import type { ErrorGroup, LogEvent, UtcBucket } from '../../src/core/model';
import { buildUtcBuckets } from '../../src/core/buckets';
import { classifyOnset } from '../../src/core/onset';

function event(id: string, timestampUtc: string): LogEvent { /* minimal fixture builder */ }

describe('fixed UTC buckets', () => {
  it('uses half-open boundaries and includes gaps', () => {
    const events = [event('e1', '2026-10-19T08:00:00Z'), event('e2', '2026-10-19T08:10:00Z')];
    const buckets = buildUtcBuckets(events, [group(['e1', 'e2'])], 5);
    expect(buckets.map((bucket) => [bucket.bucketStartUtc, bucket.bucketEndUtc, bucket.errorCount])).toEqual([...]);
  });
});
```

**Patterns:**
- Setup: small local builder functions at the top of the file (`event(...)`, `group(...)`, `bucket(...)`, `input(...)`). Build the minimum typed object; do not share mutable state between tests.
- Teardown: none via `afterEach`. Global overrides are restored with `try { ... } finally { ... }` (see Mocking).
- Assertion: prefer `toEqual` on full projections (mapped tuples) over field-by-field checks. Use `toBe` for primitives, `toBeNull` for nullable fields.
- Table-driven cases use `it.each(fixtureIds)('... %s', (fixtureId) => { ... })` (see `tests/core/analysis-fixture.test.ts`).
- Error assertions: `expect(() => fn()).toThrowError('substring')` for message text, and compare `.code` on the typed error for stable codes.
- Typed narrowing in tests: `if (!outcome.ok) throw outcome.error;` before reading `outcome.stream`.

## Mocking

**Framework:** None. No `vi.mock`, `vi.fn`, or `vi.spyOn` is used (0 files at last check). Test doubles are plain data built by hand.

**Patterns:**
Determinism is tested by directly overriding globals and restoring them in `finally`. Copy this pattern from `tests/core/determinism.test.ts`:

```typescript
const originalTz = process.env.TZ;
const originalDateNow = Date.now;
const originalRandom = Math.random;
const baseline = serialized(input(checkoutLogs, checkoutHistory));
try {
  process.env.TZ = 'America/Los_Angeles';
  Date.now = () => 1;
  Math.random = () => 0.987654321;
  const variant = serialized(input(checkoutLogs, checkoutHistory));
  expect(variant).toEqual(baseline);
} finally {
  process.env.TZ = originalTz;   // restore even if the variant throws
  Date.now = originalDateNow;
  Math.random = originalRandom;
}
```

- Restore original values in `finally`. Save originals before overriding.
- When `process.env.X` was undefined originally, assigning `undefined` restores it to the string `"undefined"` in Node; handle that explicitly if a new test needs to unset a variable.

**What to Mock:**
- Non-determinism sources only: `Date.now`, `Math.random`, `process.env.TZ`, locale variables.
- Nothing else. Core functions are pure and take plain objects.

**What NOT to Mock:**
- Parsers, normalization, signature grouping, onset classification, and serialization. Exercise them with real inputs.
- Fixture files. Read them from disk through `readFileSync(new URL('../../fixtures/...', import.meta.url), 'utf8')`.

## Fixtures and Factories

**Shared incident fixtures:**
- Location: `fixtures/incidents/<id>/` at the repo root (not under `tests/`). Current IDs: `checkout-outage` (spike), `slow-burn`, `ambiguous`.
- Each directory contains:
  - `logs.jsonl` (JSON-lines log input)
  - `history.json` (`culprit-json` history export with commits and ranges)
  - `expected.json` (expected analysis outcome)
  - `manifest.json` (`schemaVersion`, `id`, `name`, `purpose`, `inputFormats`, `expected.onsetClass`, `expected.confidence`, `requiredEvidence`, `caveats`)
- Tests load them with `new URL('../../fixtures/incidents/...', import.meta.url)` or `fileURLToPath(...)`; do not hard-code absolute paths (determinism rule).

**Inline factories:**

```typescript
function input(logs: string, history: string): AnalysisInput {
  return {
    logs: { text: logs, format: 'jsonl', source: 'fixtures/incidents/checkout-outage/logs.jsonl' },
    history: { text: history, format: 'culprit-json', source: 'fixtures/incidents/checkout-outage/history.json' },
    options: null,
  };
}
```

- Use repository-relative `source` strings in fixtures, never absolute paths.
- Timestamps in tests use explicit UTC (`'2026-10-19T08:00:00Z'`) or offsets (`'+00:00'`) so they exercise normalization.

**Location:**
- Inline builders live at the top of each test file. There is no shared `tests/helpers` or `tests/fixtures` directory. A helper used by two or more files should be extracted into `tests/core/_helpers.ts` (not present yet); `fixture-contract.test.ts` and `analysis-fixture.test.ts` currently duplicate the `fixtureIds` list.

## Coverage

**Requirements:** None enforced. No threshold in config or scripts.

**View Coverage:** Not configured. To measure ad hoc, install `@vitest/coverage-v8` at the pinned Vitest version and run `npx vitest run --coverage`. Do not add coverage to the default `test` script without updating the offline lockfile.

## Test Types

**Unit Tests:**
- Most of `tests/core/`. Each core module is tested in isolation with hand-built inputs (log parser edge cases, history validation, normalization, signature grouping, onset classification boundaries, serialization stability).
- Boundary cases are explicit: half-open bucket edges, zero-width or fractional bucket sizes, empty inputs, invalid timestamps, invalid SHAs (must be 40 lowercase hex characters).

**Integration Tests:**
- `tests/core/pipeline.test.ts` and `tests/core/analysis-fixture.test.ts` run `analyze()` end to end over real text inputs.
- `tests/core/fixture-contract.test.ts` checks that shipped fixtures and their `expected.json` / `manifest.json` stay consistent with `serializeCanonicalJson` and `serializeMarkdown` output.

**Determinism / Contract Tests:**
- `tests/core/determinism.test.ts`: repeated calls, permitted record reordering, environment variants.
- `tests/core/serialization.test.ts`: canonical JSON key order and Markdown output stability.
- `tests/core/rebuild-surface.test.ts`: pins `.nvmrc` to `22.20.0`, `engines.node` to `22.x`, the exact npm script set, and lockfile `lockfileVersion >= 3`. Update this test when intentionally changing the Node pin or scripts.

**E2E Tests:**
- Not used. No Playwright or browser automation is installed (by project decision).
- The UI is verified manually via `npm run dev` / `npm run preview` and the Docker image (`Dockerfile`, port 4173).

## Common Patterns

**Async Testing:**
- Not applicable; core is synchronous. The worker protocol is not implemented yet. If added, test the message protocol with plain function calls before adding worker-level tests.

**Error Testing:**

```typescript
it('rejects non-positive, fractional, and non-finite widths', () => {
  expect(() => buildUtcBuckets([], [], 0)).toThrowError('positive integer');
  expect(() => buildUtcBuckets([], [], 1.5)).toThrowError('positive integer');
  expect(() => buildUtcBuckets([], [], Number.NaN)).toThrowError('positive integer');
});
```

```typescript
it('keeps stable codes and nullable source context', () => {
  const errors = [new EmptyInputError({ source: 'logs' }), new MalformedInputError('bad record', { source: 'logs', line: 2, record: 2 })];
  expect(errors.map((error) => error.code)).toEqual(['EMPTY_INPUT', 'MALFORMED_RECORD']);
  expect(errors[1]?.line).toBe(2);
});
```

**Outcome Testing (preferred for public API):**

```typescript
const outcome = analyze(candidate);
if (!outcome.ok) throw outcome.error;
const result = toAnalysisResult(outcome.stream);
expect(serializeCanonicalJson(result)).toEqual(serializeCanonicalJson(expectedResult));
```

## Guidance for New Tests

- Add a `tests/core/<module>.test.ts` next to the existing file for each new core module, and extend the matching file when changing behavior.
- Every new analysis rule needs a boundary test and at least one fixture-level assertion if it affects the verdict.
- Keep tests offline and deterministic: no `Date.now()`, no `new Date()` without arguments, no network, no reading `.env`.
- Keep the single command `npm test` green and fast; `make test` must also pass `typecheck` and `build`.

---

*Testing analysis: 2026-10-19*
