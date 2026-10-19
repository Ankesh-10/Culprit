# Phase 3: Evidence, Ranking, and Trust Model - Pattern Map

**Mapped:** 2026-10-19
**Files analyzed:** 15 (7 new src/tests-core modules + 5 new tests + 3 edits/docs)
**Analogs found:** 14 / 15 (all analogs are git-tracked under `src/core` and `tests/core`)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/core/evidence.ts` (new) | utility | transform | `src/core/signatures.ts` | exact (pure frame/string logic) |
| `src/core/scoring.ts` (new) | utility/config | transform | `src/core/onset.ts` (fixed-rule classifier) + `serialization.ts` `SIGNAL_ORDER` | role-match |
| `src/core/ranking.ts` (new) | service | batch/transform | `src/core/signatures.ts` `groupErrorEvents` | role-match |
| `src/core/markdown.ts` (new) | utility | transform | `src/core/normalization.ts` | role-match |
| `src/core/model.ts` (edit) | model | n/a | itself, lines 183-265 | exact |
| `src/core/pipeline.ts` (edit) | service | request-response | itself, `analyze` / `toAnalysisResult` | exact |
| `src/core/serialization.ts` (edit) | utility | transform | itself, `canonicalSuspect` / `serializeMarkdown` | exact |
| `src/core/normalization.ts` (edit, export `compareText`) | utility | transform | itself | exact |
| `tests/core/evidence.test.ts`, `scoring.test.ts`, `ranking.test.ts`, `markdown.test.ts` (new) | test | transform | `tests/core/onset.test.ts`, `signatures.test.ts` | exact |
| `tests/core/fixture-ranking.test.ts` (new) | test | request-response | `tests/core/determinism.test.ts` + `analysis-fixture.test.ts` | exact |
| `tests/core/pipeline.test.ts`, `analysis-fixture.test.ts`, `serialization.test.ts`, `fixture-contract.test.ts` (edit) | test | n/a | themselves | exact |
| README "How ranking works" | docs | n/a | existing README | n/a (no analog read) |

## Pattern Assignments

### `src/core/evidence.ts` (utility, transform)

**Analog:** `src/core/signatures.ts`

**Imports pattern** (lines 1-2): type-only imports from `./model`, named imports from sibling modules, no `.ts` extension, no barrels.
```typescript
import type { ErrorGroup, LogEvent, StackFrame } from './model';
import { canonicalWhitespace } from './normalization';
```

**Frame ownership pattern to replace/extend** (lines 31-33). This is the private Phase 2 definition. `classifyFrame` must be stricter, but leave the original untouched, since changing it alters signatures and canonical output:
```typescript
function firstApplicationFrame(event: LogEvent): StackFrame | null {
  return event.stackFrames.find((frame) => frame.filePath !== null && !frame.vendor) ?? null;
}
```
Walk `event.stackFrames` (ordered) per event. Do NOT read `ErrorGroup.stackFrames`, which is re-sorted by `mergeFrames` (lines 65-77, vendor flag then key).

**Deterministic text ordering** (lines 11-13; duplicated at pipeline.ts:33, serialization.ts:17). Export one copy from `normalization.ts` and import it in the new modules:
```typescript
function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
```

**Map-then-sort-before-emit pattern** (lines 84-96). Use `Map` for user-keyed data (never `Record`), and sort entries with `compareText` before output:
```typescript
const groups = new Map<string, LogEvent[]>();
...
return [...groups.entries()]
  .sort(([left], [right]) => compareText(left, right))
```

**Error handling:** pure total functions returning discriminated unions (`PathMatch`, `TraceMatchKind`). Use the RESEARCH.md snippets for `matchPath` and `classifyLine`. Throw only for internal invariants (signatures.ts:99 uses `throw new Error('Error group cannot be empty.')`). Boundary errors use `CoreInputError` subclasses from `src/core/input-errors.ts`.

---

### `src/core/scoring.ts` (utility/config, transform)

**Analog:** `src/core/serialization.ts` lines 15 and 21-26 (frozen signal order plus finite-number guard), `src/core/pipeline.ts` lines 22-31 (module-level frozen constants).

```typescript
const SIGNAL_ORDER: SignalContribution['signal'][] = ['proximity', 'trace-match', 'novelty', 'churn'];

function finiteNumber(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
  return Object.is(value, -0) ? 0 : value;
}
```
Copy the `-0` to `0` handling into `round6`. Define `SCORING_V1` and `round6` from the RESEARCH.md "Frozen constants" block. Use only `+ - * /`, `Math.floor`, `Math.round`, `Math.min`, `Math.max` (no `exp`, `log`, `pow`, `**`). Reuse `SIGNAL_ORDER`: export it from `scoring.ts` and import it into `serialization.ts` to avoid a second copy. Keep `scoringVersion: 'scoring-v1'` (pipeline.ts:247).

---

### `src/core/ranking.ts` (service, batch)

**Analog:** `src/core/signatures.ts` `groupErrorEvents` (deterministic sort, then Map aggregate, then sorted emit), plus `src/core/pipeline.ts` `interpretWeakEvidence` (lines 133-150) for the "consume `onset`, don't mutate it" shape.

**Epoch comparison pattern** (signatures.ts:15-19):
```typescript
function compareEvents(left: LogEvent, right: LogEvent): number {
  const leftEpoch = Date.parse(left.timestampUtc);
  const rightEpoch = Date.parse(right.timestampUtc);
  return leftEpoch - rightEpoch || compareText(left.eventId, right.eventId);
}
```
Use the same `a - b || compareText(...)` chain for `compareRanked` (RESEARCH.md "Total ordering"). Compare integer micro-units, never raw floats.

**Inputs from stream** (model.ts 250-265): `GitCommit { sha, author, subject, timestampUtc, files: ChangedFile[{path, added, deleted, ranges: {start,end}[]}] }`, `LogEvent.stackFrames`, `ErrorGroup.firstSeenUtc/eventIds/signature`, and `OnsetAnalysis.windowStartUtc` (null means status `no-onset`).

**Output shapes:** `ScoredSuspect` (model.ts 201-212: `rank, sha, shortSha, subject, author, committedAtUtc, score, signals, evidenceReferences, tieBreakKey`), `SignalContribution` (192-199), `EvidenceReference` (183-190: `type, sourceId, path, lineStart, lineEnd, detail`). Use `tieBreakKey` consistent with pipeline.ts:324-325 (`score, trace-match, committedAtUtc, sha`).

**Per-signal contribution:** `contribution = round6(value * weight)`, `score = round6(sum in SIGNAL_ORDER)`. Missing evidence gives value 0 with an explanation of why.

---

### `src/core/markdown.ts` (utility, transform)

**Analog:** `src/core/normalization.ts` (small exported pure string helpers: `canonicalWhitespace` at line 34, `normalizeRepositoryPath` at line 39). Same style: named exports, single quotes, no deps. Use the RESEARCH.md `escapeMarkdown` / `inlineCode` bodies verbatim. Do not escape `. , : -`, because existing tests `toContain` plain prose.

---

### `src/core/model.ts` (edit, additive types)

Append beside the existing types. Existing types to extend: `ScoredSuspect` (201-212), `ConfidenceRationale` (214-219), `AnalysisResult` (226-241), `AnalysisStream` (250-265). New required fields (per RESEARCH Open Question 5): `ScoredSuspect.timeGapMinutes/traceSummary`, `ConfidenceRationale.labels`, `AnalysisResult.ranking`, `AnalysisStream.ranking`. Existing union types at lines 17-19 (`ConfidenceBand`, `SignalName`, `EvidenceType`) stay. Add `ConfidenceLabel`, `RankingStatus`, `TraceMatchKind`, `CommitDispositionStatus`, `TraceSummary`, `CommitDisposition`, `RankingSummary` as in the RESEARCH sketch. Note `TraceMatchKind` is also in the evidence.ts snippet: define it once in `model.ts` and import it. `UtcBucket.commitShas` (line 153-154, "Reserved for Phase 3") may be populated with half-open `[start,end)` membership, but fixtures stay empty.

---

### `src/core/pipeline.ts` (edit, request-response)

**Analog:** itself.

**Integration point** (lines 229-233, then the return at 242-267): call `rankSuspects(commits, normalizedEvents, errors, onset)` after `onset` is computed and add `ranking` to the returned `stream`:
```typescript
const errors = groupErrorEvents(normalizedEvents);
const buckets = buildUtcBuckets(normalizedEvents, errors, checked.bucketMinutes);
const onset = interpretWeakEvidence(interpretSparseRamp(classifyOnset(buckets)), errors, commits, normalizedEvents);
```
**Remove/replace:**
- line 28 `PHASE_THREE_ASSUMPTION` (delete it from the `assumptions` array at line 241; keep `UTC_ASSUMPTION`, `TIMESTAMP_ASSUMPTION`, `CAUSALITY_ASSUMPTION`, `WEAK_EVIDENCE_ASSUMPTION`; tests match `/UTC|timestamp/` and `/causal/`)
- line 271 spike text "after Phase 3 ranking" (`incidentInterpretation`)
- lines 278-286 `confidenceFor` (hard-coded band)
- line 321 `suspects: []`, line 322 `confidence: confidenceFor(...)`, and `commitShas: []` at line 320

**Adapter pattern to keep** (lines 312-319): copy arrays/objects with spread so the result does not alias the stream.

**Do not edit** `interpretSparseRamp` line 116 (`nonEmpty[1]`) or `interpretWeakEvidence` line 140 (`errorTimes[1]`); pin them with a test instead.

**Optional guard:** `buildUtcBuckets` can throw `AnalysisInputError` out of `analyze()`. If adding `MAX_BUCKETS`, return via `invalidOutcome(...)` as in lines 58-60 and 154-155.

---

### `src/core/serialization.ts` (edit, transform)

**Analog:** itself.

**Canonicalization pattern to extend** (lines 101-116 `canonicalSuspect`; 182-187 confidence block). Add the new fields through `finiteNumber`/explicit copies, keep key order fixed, use `null` rather than omission:
```typescript
function canonicalSuspect(suspect: ScoredSuspect): ScoredSuspect {
  return {
    rank: finiteNumber(suspect.rank, 'suspect rank'),
    ...
    signals: [...suspect.signals]
      .sort((left, right) => SIGNAL_ORDER.indexOf(left.signal) - SIGNAL_ORDER.indexOf(right.signal))
      .map(canonicalSignal),
    evidenceReferences: canonicalEvidenceList(suspect.evidenceReferences),
    tieBreakKey: suspect.tieBreakKey,
  };
}
```
Add `canonicalRanking` (sort `considered` by `compareText(sha)` or a documented order; `utcTimestamp(...)` on every timestamp) and `labels` in fixed order `['low-confidence','ambiguous','weak-evidence','no-clear-culprit']`. Update the doc comment at lines 128-133.

**Markdown** (lines 199-243). Wrap every user-derived interpolation with `escapeMarkdown`/`inlineCode`: line 203 (`reference.detail`, `location`), 221 (`suspect.subject`), 223 (`suspect.shortSha`/subject), 225 (`signal.explanation`), 228-229 (warnings/diagnostics), 233, 237, 238 (sources). Keep headings and section order. Add labels, per-signal lines and a "ranked suspicion, not probability" caveat. Avoid "caused by" or "the culprit is".

---

### `tests/core/evidence.test.ts`, `scoring.test.ts`, `ranking.test.ts`, `markdown.test.ts` (test)

**Analog:** `tests/core/onset.test.ts` lines 1-40: vitest imports, local factory helpers building literal model objects (`event()`, `group()`, `bucket()`), no fixtures on disk.
```typescript
import { describe, expect, it } from 'vitest';
import type { ErrorGroup, LogEvent, UtcBucket } from '../../src/core/model';
import { buildUtcBuckets } from '../../src/core/buckets';
import { classifyOnset } from '../../src/core/onset';
```
Use relative `../../src/core/<module>` imports and `describe`/`it`. Build a `commit()` factory the same way as `event()` (a full `GitCommit` literal including `source: { source: 'test', line: null, record: null }`). Scoring tests assert hard-coded literals, plus integer weight sum `35+30+25+10 === 100` (not float equality).

---

### `tests/core/fixture-ranking.test.ts` (test, request-response)

**Analog:** `tests/core/determinism.test.ts` lines 1-60.

```typescript
const checkoutLogs = readFileSync(new URL('../../fixtures/incidents/checkout-outage/logs.jsonl', import.meta.url), 'utf8');
function input(logs: string, history: string): AnalysisInput {
  return {
    logs: { text: logs, format: 'jsonl', source: 'fixtures/incidents/checkout-outage/logs.jsonl' },
    history: { text: history, format: 'culprit-json', source: 'fixtures/incidents/checkout-outage/history.json' },
    options: null,
  };
}
function serialized(candidate: AnalysisInput) {
  const outcome = analyze(candidate);
  if (!outcome.ok) throw outcome.error;
  const result = toAnalysisResult(outcome.stream);
  return { json: serializeCanonicalJson(result), markdown: serializeMarkdown(result), ... };
}
```
Copy `reorderLogs`/`reorderHistory` (lines 31-38) and the TZ/LC_ALL/`Date.now`/`Math.random` stubbing with restore-in-`finally` (lines 49-60) for FIX-03. For FIX-02 use `it.each(fixtureIds)` over fixture manifests (RESEARCH "Contract test skeleton"). Assert interpretation for the ambiguous fixture (labels, spread < 0.05, trace 0), not a specific #1.

### Edited tests (pipeline / analysis-fixture / serialization / fixture-contract)

Stub-encoding assertions to update: `tests/core/pipeline.test.ts:110-120` ("projects a stream without ranking suspects"), `tests/core/analysis-fixture.test.ts:53` (`/weak|competing|Phase 3/i`), `tests/core/pipeline.test.ts:57-58` (stays true). The `AnalysisResult` literal builders `makeResult` (serialization.test.ts) and `buildTracerResult` (fixture-contract.test.ts) must gain the new required fields or `tsc --noEmit` fails.

## Shared Patterns

### Deterministic ordering
**Source:** `src/core/signatures.ts` lines 11-13, 94-96. **Apply to:** every new module. Use the single exported `compareText`; never `localeCompare`; sort `Map`/`Set` iteration before emit.

### Finite, `-0`-safe numbers
**Source:** `src/core/serialization.ts` lines 21-26. **Apply to:** `scoring.ts` (`round6`), `serialization.ts` additions.

### Input errors at the boundary
**Source:** `src/core/pipeline.ts` lines 54-60 (`optionDiagnostic`, `invalidOutcome`) and `src/core/input-errors.ts`. **Apply to:** any new guard in `analyze()` (for example a bucket cap). Ranking itself is total and does not throw on odd input.

### Path identity
**Source:** `src/core/normalization.ts` `normalizeRepositoryPath` (line 39), used at `serialization.ts:40`, `pipeline.ts:65`. **Apply to:** evidence path refs. Do not add ad-hoc `replace` chains.

### Style
Named exports only, no barrels, single quotes, semicolons, ~120 cols, no `console`, no `any`, `import type` for types (`verbatimModuleSyntax`), `exactOptionalPropertyTypes` (spread-conditional pattern as at pipeline.ts:316-318: `...(x === undefined ? {} : { x: [...x] })`).

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| Binary search over sorted event times (inside `ranking.ts`) | utility | transform | No existing search helper; write a small local lower-bound over a `number[]` |
| README ranking paragraph | docs | n/a | Doc only; follow the existing README section style |

## Metadata

**Analog search scope:** `src/core/*.ts`, `tests/core/*.ts` (23 files globbed; `signatures.ts`, `pipeline.ts`, `serialization.ts`, `model.ts` lines 58-270, `onset.test.ts` head, `determinism.test.ts` head read)
**Tracked-source gate:** all named analogs are plain tracked files under `src/core` and `tests/core`; no capability mirror paths used.
**Pattern extraction date:** 2026-10-19
