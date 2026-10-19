# Phase 3: Evidence, Ranking, and Trust Model - Research

**Researched:** 2026-10-19
**Domain:** Pure TypeScript heuristic ranking (frozen weighted signals), evidence correlation, qualitative confidence, deterministic Markdown/JSON output
**Confidence:** HIGH on codebase facts, fixture behavior and the PRD-frozen weights; MEDIUM on the signal constants and thresholds (design choices validated against the three fixtures, not against real incidents)

<user_constraints>
## User Constraints (from CONTEXT.md)

No `03-CONTEXT.md` exists (user chose to continue without `/gsd-discuss-phase`). There are therefore no locked decisions, no declared discretion areas and no deferred ideas from a discuss step.

### Locked Decisions
None from CONTEXT.md. The effective locks come from higher-authority sources and are treated as locked:
- PRD weights are frozen: `score = 0.35 * proximity + 0.30 * traceMatch + 0.25 * novelty + 0.10 * churn` (PRD section 4).
- `.claude/CLAUDE.md`: offline, deterministic, no runtime dependencies, plain TypeScript, Vitest, no network, privacy, accessibility.
- `.planning/REQUIREMENTS.md` v2 / Out of Scope: no configurable weights, no runtime AI/ML, no probability claims.

### Claude's Discretion
Everything else in Phase 3 (signal formulas, constants, thresholds, module layout, result-contract extensions, wording). Recommendations below are marked `[ASSUMED]` where they are design choices rather than facts.

### Deferred Ideas (OUT OF SCOPE)
- User-configurable weights (V2-ANALYSIS-02), CLI helper, extra log/history formats, UI work (Phase 4), themes/shortcuts/motion (Phase 5).
</user_constraints>

## Project Constraints (from CLAUDE.md)

- Node 22 pin (`.nvmrc`), `npm ci`, committed lockfile; **zero new runtime dependencies**; plain DOM, Vitest, strict TS (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`).
- **Determinism:** output must not depend on current time, randomness, machine-specific absolute paths, locale, or network state.
- **Offline:** tests and build work without network; single offline test command (`npm test` = `vitest run`; `make test` = typecheck + test + build).
- **Privacy:** logs/repo data never leave the browser (core is network-free; keep it so).
- **Scope:** Must-have analysis/verdict behavior beats "should/nice" UI.
- **GSD enforcement:** repo edits go through a GSD workflow (plan then execute); this research does not edit source.
- Conventions (from `.planning/codebase/CONVENTIONS.md`): kebab-case modules in `src/core/`, named exports only, no barrels, single quotes, semicolons, 120-col target, `compareText` (not `localeCompare`), `Map`/`Set` iteration always sorted before emit, throw `CoreInputError` subclasses at the boundary (not bare `Error`), no `console`, no `any`.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RANK-01 | Score eligible pre-onset commits with frozen proximity, trace-match, novelty, churn signals and documented weights | `SCORING_V1` constant object with PRD weights; four pure signal functions; eligibility = commit time <= onset window start; formulas in Architecture Patterns / Code Examples |
| RANK-02 | Stable ordering and deterministic tie-breaking independent of time/randomness/locale/paths | Integer micro-unit comparison (score, trace, commit epoch desc, SHA asc); transcendental-free math; `Map` not object keys; reorder tests |
| RANK-03 | Top-three shortlist, not one unqualified claim | `suspects` = top 3 of ranked list; `considered[]` retains every commit's disposition |
| RANK-04 | Total score and per-signal contribution in plain language | `SignalContribution` already has `value/weight/contribution/explanation`; score = round of sum of rounded contributions so displayed numbers add up |
| RANK-05 | Evidence references: time distance, files/line ranges, matching frames, error groups, churn | `EvidenceReference` types already exist; per-signal reference recipe table below; add `timeGapMinutes` and `traceSummary` to `ScoredSuspect` so Phase 4 does not parse strings |
| RANK-06 | Explicit low-confidence / ambiguous / weak-evidence / no-clear-culprit labels | `ConfidenceLabel[]` + band derivation rules; verified to reproduce the manifest bands (high / medium / low) on the three fixtures |
| RANK-07 | Exclude/downweight generic/vendor/generated frames; handle path/line mismatches without crashing or inventing evidence | `evidence.ts` frame classifier + path matcher + inclusive line matcher with segment-boundary suffix rule and ambiguity refusal |
| FIX-02 | Known culprit ranks first (checkout); intended interpretation stable for slow-burn and ambiguous | Prototype run: culprit first on checkout and slow-burn for half-life 30/60/120 and both reference choices; ambiguous asserted as interpretation (near-tie), not as a specific #1 |
| FIX-03 | Byte-identical structured and Markdown output for identical fixture input | Existing determinism harness extended to ranked output; no `Math.exp/log/pow`; rounding rule; Markdown escaping helper |
</phase_requirements>

## Summary

Phase 2 left a clean seam for ranking. `analyze()` returns an `AnalysisStream` containing normalized events, canonical commits (sorted by time then SHA), error groups, buckets and an onset; `toAnalysisResult()` currently forces `suspects: []`, `commitShas: []`, and a hard-coded confidence band. The public `AnalysisResult` contract in `src/core/model.ts` already contains `ScoredSuspect`, `SignalContribution`, `EvidenceReference`, `ConfidenceRationale` and `TieBreakMetadata`, and `serializeMarkdown` already knows how to print suspects. Phase 3 is therefore mostly: (1) new pure modules for evidence matching, frozen scoring and ranking; (2) a small, additive contract extension; (3) honest confidence/labels; (4) Markdown escaping; (5) contract tests that pin the three fixtures.

Four findings change how the plan should be written. **(a)** `ErrorGroup.stackFrames` is order-lossy (frames are re-sorted by vendor flag then by key in `mergeFrames`), so the "top application frame" cannot be read from the group; the ranker must walk `normalizedEvents` via `ErrorGroup.eventIds`. **(b)** In all three fixtures every commit predates the first log bucket, so per-bucket `commitShas` stays empty by construction and Phase 4's commit lane must come from a per-commit disposition list, not from buckets. **(c)** The expected onset windows in `expected.json` were evidently matched to the Phase 2 heuristics (`nonEmpty[1]`, `errorTimes[1]`), and the slow-burn `windowEndUtc` (`08:35:00Z`) disagrees with the actual analysis output (`08:40:00.000Z`) with no test noticing; ranking must be insulated from this rather than "fixing" onset. **(d)** `Math.exp/log/pow` are implementation-approximated by the ECMAScript spec, and judges rebuild on Linux/Node 22 while the dev host runs Node 24 on Windows, so scoring should use only `+ - * /`, comparisons, and exact power-of-two scaling, then round to 6 decimals.

With the prescribed constants (PRD weights, 60-minute half-life piecewise-exponential proximity, top-application-frame trace match, log-relative novelty, saturating churn), a prototype run against the real analysis streams ranks the checkout culprit first (0.912 vs 0.544), the slow-burn reservation commit first (0.839 vs 0.550), and produces a near-tie (spread 0.035) with zero trace evidence for the ambiguous fixture. The qualitative rules reproduce the manifest bands: high, medium (ramp cap), low.

**Primary recommendation:** Implement `evidence.ts`, `scoring.ts`, `ranking.ts` (+ `markdown.ts`) as pure modules called from `analyze()`; put the ranking outcome in `AnalysisStream`; extend `AnalysisResult` additively (`ranking`, `ConfidenceRationale.labels`, `ScoredSuspect.timeGapMinutes/traceSummary`); do not change onset windows; escape all user text in Markdown; and write contract tests that assert interpretation (band, labels, status, ordering invariants) rather than only a winning SHA.

## Architectural Responsibility Map

Culprit is browser-only with no server; "tiers" here are the layers of the offline app.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Eligibility, signal math, ranking, confidence labels | Core library (`src/core`, pure TS) | Worker (later, calls same function) | Must be Node-testable, deterministic and DOM-free (CLAUDE.md, ARCHITECTURE) |
| Frame classification, path/line-range matching | Core library | — | Pure string/number logic; shared by scoring and tests |
| Canonical JSON and Markdown serialization (incl. escaping) | Core library (`serialization.ts`, `markdown.ts`) | Browser UI (copy button, Phase 4) | Output bytes are part of the determinism contract (FIX-03) |
| Verdict wording ("most likely", never "caused by") | Core library (text templates in result) | Browser UI renders only | Keeps export and UI wording identical |
| Fixture expectations and contract tests | `fixtures/` + `tests/core` | — | Fixtures are shared demo/test contracts |
| Rendering of suspects, drawer, timeline | Browser UI | — | Phase 4; Phase 3 only supplies structured data |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.9.3 (pinned) | Strict typed core | Already pinned `[VERIFIED: package.json devDependencies]` |
| Vitest | 3.2.4 (pinned) | Contract and unit tests | Already pinned; `npm test` = `vitest run` `[VERIFIED: package.json scripts]` |
| Vite | 7.1.10 (pinned) | Build only; unaffected | Already pinned |

### Supporting
None. **Phase 3 adds zero dependencies.** `vite-node` (bundled with Vitest) is available locally for ad-hoc scripts `[VERIFIED: node_modules/.bin listing]` but is not a project script.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-written signal functions | A scoring/ML or fuzzy-match library | Violates "plain, explainable code", adds nondeterminism and dependency surface (PRD non-goals) |
| `Math.exp` / `Math.log` for decay and churn | Piecewise-exponential + rational saturation (recommended) | Transcendentals may differ in the last bit across engines; recommended forms use only IEEE basic ops |
| Markdown library for escaping | ~25-line local helper | A dependency for one function contradicts the stack decision |

**Installation:** none.

**Version verification:** no new packages, so no registry lookups were required.

## Package Legitimacy Audit

No external packages are installed or recommended in this phase. Nothing to audit. **Packages removed due to [SLOP]:** none. **Packages flagged [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram

```
 logs text ──► parseLog ─────────────┐
                                     ├─► normalizedEvents (UTC, sorted)
 history JSON ─► parseHistoryExport ─┘        │            commits (time, sha order)
                                              ▼                   │
                          groupErrorEvents ─► errors (groups, eventIds, counts, firstSeen)
                                              │
                          buildUtcBuckets ─► classifyOnset ─► interpret* ─► onset (class, windowStartUtc)
                                              │                   │
                                              ▼                   ▼
                      ┌───────────────────────────────────────────────────────┐
                      │ rankSuspects(commits, events, errors, onset)   [NEW]   │
                      │  1 reference = onset.windowStartUtc (null → no-onset)  │
                      │  2 eligibility: commit <= reference, else excluded     │
                      │  3 per distinct top-app-frame: sorted event times      │
                      │       (frame classifier: vendor/generated/runtime skip)│
                      │  4 per eligible commit: 4 signals (+ evidence refs)    │
                      │  5 score = round6(sum of round6 contributions)         │
                      │  6 sort: score↓ trace↓ commitTime↓ sha↑ (micro ints)   │
                      │  7 top 3 → suspects; all commits → considered[]        │
                      │  8 confidence: labels + band + rationale               │
                      └───────────────────────────────────────────────────────┘
                                              │ stream.ranking
                                              ▼
                      toAnalysisResult ─► canonicalizeResult ─► serializeCanonicalJson
                                                            └─► serializeMarkdown (escaped)
```

### Recommended Project Structure
```
src/core/
├── evidence.ts      # NEW: classifyFrame, matchPath, classifyLine, topApplicationFrame
├── scoring.ts       # NEW: SCORING_V1 (frozen), proximity/trace/novelty/churn functions, round6
├── ranking.ts       # NEW: rankSuspects, confidence labels/band, interpretation text
├── markdown.ts      # NEW: escapeMarkdown, inlineCode
├── model.ts         # EDIT: additive types (ranking, labels, traceSummary, timeGapMinutes)
├── pipeline.ts      # EDIT: call rankSuspects in analyze(); remove stub confidence/interpretation
├── serialization.ts # EDIT: canonicalize new fields; escape user text in Markdown
└── normalization.ts # EDIT (optional): export one shared compareText
tests/core/
├── evidence.test.ts, scoring.test.ts, ranking.test.ts, markdown.test.ts   # NEW
└── fixture-ranking.test.ts                                                 # NEW: FIX-02/FIX-03 contract
```

### Pattern 1: Frozen, versioned scoring object
**What:** One `Object.freeze`d `SCORING_V1` holding weights, half-life, strength table, churn constants, thresholds and `topN`. `SCORING_VERSION = 'scoring-v1'` stays (weights equal the PRD's).
**When to use:** every signal function takes its constants from it; no magic numbers elsewhere.
**Rule for changing it:** any constant change bumps the version string and regenerates golden values deliberately.

### Pattern 2: Signal functions return value + evidence, never prose-only
Each signal returns `{ value: 0..1, explanation, evidenceReferences }`; the ranker multiplies by weight, rounds, and assembles `SignalContribution`. Missing evidence returns value `0` with an explanation that says *why* it is zero (ARCHITECTURE: "Missing evidence contributes zero, not a guessed value"). Weights are **not** renormalized when a signal is unavailable (keeps scores comparable and bounded in [0,1]).

### Pattern 3: Aggregate events once, then score commits cheaply
Build, once, `Map<frameKey, { path, line, times: number[] (sorted epoch ms) }>` of each error event's **top application frame**. For each commit, per distinct frame: classify match once and count events with `time >= commitEpoch` by binary search. Cost is `commits x distinctFrames x log(events)`, not `commits x events`. History has no size cap today (CONCERNS), so avoid nested loops over all events per commit.

### Signal definitions (prescribed)

All values rounded with `round6(x) = Math.round(x * 1e6) / 1e6`.

| Signal | Definition (value in [0,1]) | Evidence references |
|--------|-----------------------------|---------------------|
| **proximity** | `gap = max(0, (referenceEpoch - commitEpoch)/60000)` minutes; value is piecewise-exponential with a 60-minute half-life: `2^-k * (1 - r/2)` where `k = floor(gap/H)`, `r = gap/H - k` (exact halving, no `pow`). 12 min → 0.90, 60 min → 0.50, 120 min → 0.25 | one `feature` ref: `"<gap> min before onset window start <ISO>"` |
| **trace-match** | For each error event at or after the commit's time, take its top *application* frame; strength = best over the commit's changed files: `exact-line` 1.0, `nearby-line` (<= 5 lines outside a range) 0.6, `file-only` 0.3, none 0. value = sum(strength) / totalErrorEvents. Only the **top** application frame is scored (PRD: "the top stack frame of many errors"); other matched application frames are listed as supporting evidence with no score | `file-range` ref(s) (path, lineStart/lineEnd = matching changed range), `error-group` ref(s) (signature + "N of M error events"), up to 3 `log-event` refs (earliest matching event IDs) |
| **novelty** | Share of error events whose signature group has `firstSeenUtc >= commitTime` (signature never seen before the commit, per PRD "1 if brand new after the commit, 0 if it existed before"). Aggregated over groups so over-split signatures (see Pitfall 6) do not distort it | `error-group` ref(s): signature + first-seen UTC |
| **churn** | `lines = sum(added+deleted)` over non-generated files, `files = count`; `value = 0.7 * lines/(lines+50) + 0.3 * min(1, (files-1)/4)`. Saturating, bounded < 1, max contribution 0.10 | `file-range` refs per touched file (sorted by path; cap 5) |

**Final score:** `score = round6(sum of round6(value_i * weight_i))`, so a reader can re-add the displayed contributions.

### Eligibility, ordering, top three
- `referenceUtc = onset.windowStartUtc`. If `null` (none / insufficient-data) → status `no-onset`, `suspects: []`, no manufactured suspect (PITFALLS section 2).
- Eligible iff `commit.timestampUtc <= referenceUtc` (inclusive, documented; test +/-1 ms). Others are `excluded` with reason `after-onset` and kept in `considered[]`.
- Sort with integer micro-units: score desc, trace value desc, commit epoch desc, SHA asc (matches the existing `tieBreak` strings). `suspects = ranked.slice(0, 3)`; `rank = index + 1`.

### Confidence labels and band (prescribed; thresholds `[ASSUMED]`)

Inputs: `sep` = top score minus runner-up (null if fewer than 2 scored), `lineLevelShare` = (error events whose top frame exact/nearby-matches the leader) / totalErrors, `stackCoverage` = errors with an application frame / totalErrors, `onset.class`.

| Label (fixed output order) | Rule |
|----------------------------|------|
| `ambiguous` | `sep !== null && sep < 0.05`, or `onset.class === 'ambiguous'` |
| `weak-evidence` | `stackCoverage === 0` (trace unavailable) or `lineLevelShare < 0.5` |
| `no-clear-culprit` | `ambiguous && weak-evidence`, or status is `no-onset` / `no-eligible-commits` |
| `low-confidence` | band is `low` (emitted last in rule order, listed first in output) |

Band: `low` if `ambiguous` or `weak-evidence` or status != `ranked`; else `medium` if `onset.class === 'ramp'`, or `sep === null`, or `sep < 0.15`, or `stackCoverage < 0.75`; else `high`. `evidenceCompleteness = round6(stackCoverage)`. Output label order: `['low-confidence','ambiguous','weak-evidence','no-clear-culprit']` filtered. This reproduces the manifest bands on all three fixtures (below).

### Anti-Patterns to Avoid
- **Reading the top frame from `ErrorGroup.stackFrames`:** order-lossy (see Pitfall 1).
- **Changing onset windows to suit ranking:** windows are pinned by Phase 1 `expected.json` and Phase 2 verification; read `onset.windowStartUtc` and stay robust.
- **Plain objects keyed by file path or signature:** `__proto__` is a legal repo-relative path; use `Map`.
- **Using the nearest commit as the answer:** proximity is 0.35 of a bounded score and cannot beat an exact-line trace match (0.30 + novelty) in the fixtures; do not add a proximity-only fast path.
- **Probability language:** never "87% likely", "caused by", or an unqualified "the culprit".

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Path identity | Ad-hoc `replace` chains | Existing `normalizeRepositoryPath` (already used by both parsers) plus the segment-boundary suffix rule in `evidence.ts` | Separators, `./`, traversal and absolute paths are already rejected `[VERIFIED: src/core/normalization.ts:39-53]` |
| Stable IDs/ordering | New hashing or locale sort | `stableSourceId`, `compareText` (export one shared copy) | 4 duplicate `compareText` copies exist; do not add a 5th |
| Canonical output ordering | New serializer | `canonicalizeResult` / `serializeCanonicalJson` (extend) | Already sorts, rejects non-finite numbers, maps `-0` to `0` |
| Exponential decay / log scaling | `Math.exp`, `Math.log`, `Math.pow`, `**` | Piecewise halving and rational saturation (Code Examples) | Engine-approximated functions risk last-bit divergence between Node 22 (Docker) and Node 24 (host) |
| Markdown escaping | Inline string concatenation of user text | `escapeMarkdown` / `inlineCode` helpers with tests | Subjects, authors, diagnostics and signatures are attacker-influenced text |

**Key insight:** ranking quality here depends far more on *defining evidence precisely and refusing to invent matches* than on clever scoring. Keep the arithmetic trivial and the evidence taxonomy strict.

## Common Pitfalls

### Pitfall 1: `ErrorGroup.stackFrames` loses stack order
**What goes wrong:** the "top frame" is mis-identified; in checkout the merged list is `handler.ts:42`, `payment.ts:118`, vendor, though the top frame is `payment.ts:118`.
**Why:** `mergeFrames` sorts by `Number(left.vendor) - Number(right.vendor)` then by key `[VERIFIED: src/core/signatures.ts:73-76]`; `firstApplicationFrame` is private `[VERIFIED: src/core/signatures.ts:31 "function firstApplicationFrame(event: LogEvent): StackFrame | null {"]`.
**How to avoid:** iterate `stream.normalizedEvents` (ordered frames) for error/fatal events, selecting the first frame that `classifyFrame` calls `application`. Do not alter `mergeFrames` (changes canonical output).
**Warning signs:** trace match changes when frames are reordered alphabetically.

### Pitfall 2: All fixture commits precede the first bucket
**What goes wrong:** populating `timeline[].commitShas` by bucket membership yields empty arrays for every fixture (checkout commits 04:05/04:18/04:35 vs buckets starting 04:20; the 04:35 commit equals the last bucket's exclusive end).
**How to avoid:** still assign in-range commits to buckets (half-open `[start,end)`), but expose `ranking.considered[]` (every commit with status, rank, score, reason) as the source for Phase 4's commit lane. Existing assertions at `tests/core/pipeline.test.ts:57-58` stay true for fixtures.

### Pitfall 3: Onset-window quirks and the fixture/actual mismatch
**What goes wrong:** `interpretSparseRamp` uses `const first = nonEmpty[1];` `[VERIFIED: src/core/pipeline.ts:116]` and `interpretWeakEvidence` uses `const startUtc = errorTimes[1] ?? errorTimes[0] ?? onset.buckets[0]?.bucketStartUtc;` `[VERIFIED: src/core/pipeline.ts:140]`. Running the pipeline shows slow-burn window `2026-10-19T08:10:00.000Z`→`2026-10-19T08:40:00.000Z` while `expected.json` says `"windowEndUtc": "2026-10-19T08:35:00Z"`; ambiguous start `10:06` equals the second error time, not the first (10:05). No test compares actual windows to `expected.json` (`grep` of `tests/` shows only `fixture-contract.test.ts` reads it, to build a tracer result). The `[1]` indices look reverse-engineered from `expected.json`.
**How to avoid:** do **not** alter onset in Phase 3. Rank against `onset.windowStartUtc`, and because novelty and trace only count errors at/after each commit, a commit that lands between the true first error and a late window start is automatically penalized (novelty 0 for already-seen signatures). Add a test that pins actual vs expected onset (see Open Question 1). Sensitivity run: using first-error time instead of window start as the proximity reference changes no top-1 on checkout or slow-burn.

### Pitfall 4: Float sums and non-associativity
**What goes wrong:** `0.35 + 0.30 + 0.25 + 0.10 === 0.9999999999999999` in IEEE doubles, so a naive "weights sum to 1" test fails and sums reorder by input order.
**How to avoid:** assert weights in integer percent (35+30+25+10 = 100) or `toBeCloseTo`; always sum contributions in the fixed `SIGNAL_ORDER`; compare with integer micro-units.

### Pitfall 5: Cross-engine numeric drift
**What goes wrong:** judges run `docker build ... npm test` on Node 22.20.0 Alpine; the dev host is Node 24.14.1 on Windows `[VERIFIED: node --version = v24.14.1; .nvmrc pins 22.20.0 per ARCHITECTURE.md]`. ECMAScript marks `Math.exp`/`Math.pow` results implementation-approximated `[CITED: tc39.es/ecma262 via search summary; engine divergence discussion at redirect.github.com/endojs/endo/discussions/1946]`.
**How to avoid:** only `+ - * /`, comparisons, `Math.floor`, `Math.round`, `Math.min/max`, and halving loops; round to 6 decimals; add a test that scores a fixed synthetic input and compares to hard-coded literals.

### Pitfall 6: Signature over-splitting distorts naive "dominant signature" logic
**What goes wrong:** ambiguous fixture messages ("search request failed for term notebooks") are unquoted, so they become three groups (cameras 2, notebooks 1, tablets 1) `[VERIFIED: vite-node run of analyze() this session]`. A "dominant signature" rule would pick `cameras` arbitrarily.
**How to avoid:** novelty and trace aggregate over all groups/events (event-weighted). Do not tune `normalizeErrorMessage` in Phase 3.

### Pitfall 7: Invented matches from loose path logic
**What goes wrong:** `index.ts` matching `src/a/index.ts`; same-directory files counted as matches; ambiguous monorepo suffixes.
**How to avoid:** exact normalized equality first; else suffix match only on a `/` boundary, only when the shorter path has >= 2 segments, and only if exactly one changed file qualifies (>1 → `ambiguous`, treated as no match, mentioned in evidence). No same-directory credit in `scoring-v1`.

### Pitfall 8: Frames the Phase 2 parser calls "application"
**What goes wrong:** `node:internal/process/task_queues` parses to `vendor:false` with a non-null path; `webpack:///./src/a.ts` and `dist/bundle.min.js` also look like application frames; absolute paths (`/app/src/a.ts`, `C:\app\...`, UNC) become `filePath: null` `[VERIFIED: vite-node parseLog probe this session]`.
**How to avoid:** `classifyFrame` returns `application | vendor | generated | runtime | unattributed`. Rules: `unattributed` = null path; `runtime` = `node:` prefix, `internal/` prefix, `<anonymous>`, `native`, or any `scheme://`; `vendor` = parser flag or a `node_modules`, `vendor`, `third_party`, `site-packages` segment; `generated` = first segment in `dist, build, out, coverage, .next` or any `generated`/`__generated__` segment, or suffix `.min.js`, `.bundle.js`, `.map`, `.d.ts`. Keep the Phase 2 `vendor` flag untouched. Document that absolute-path frames cannot be matched today (known limitation; surface as a warning).

### Pitfall 9: Markdown injection through user text
**What goes wrong:** `serializeMarkdown` currently interpolates subjects/diagnostics verbatim (`src/core/serialization.ts` lines 221-229). With real suspects now reachable, a subject such as `[x](javascript:...)`, `# heading`, or a multi-line message alters the postmortem.
**How to avoid:** `escapeMarkdown` (collapse whitespace/newlines, backslash-escape `\ ` * _ [ ] < > # ~ |`) for all interpolated user text; `inlineCode` chooses a fence longer than the longest backtick run. Apply to subject, author, evidence detail, diagnostics, warnings, signatures, paths. Do not escape `.`, `,`, `:`, `-` (existing tests `toContain` plain prose strings).

### Pitfall 10: Tests that encode the stub
`tests/core/pipeline.test.ts:110-120` ("projects a stream without ranking suspects") and `tests/core/analysis-fixture.test.ts:53` (`/weak|competing|Phase 3/i`) assume the stub. Also `serialization.test.ts` (`makeResult`) and `fixture-contract.test.ts` (`buildTracerResult`) construct `AnalysisResult` literals; adding required fields breaks `tsc --noEmit` until those builders are updated. Plan this as an explicit task (see Plan Decomposition).

### Pitfall 11: Hard-coded wording that leaks roadmap text
`incidentInterpretation('spike')` returns "investigate pre-onset evidence after Phase 3 ranking", and `PHASE_THREE_ASSUMPTION` says ranking is "intentionally deferred". Both must be removed or the exported postmortem contradicts the verdict. Keep `UTC_ASSUMPTION`, `TIMESTAMP_ASSUMPTION`, `CAUSALITY_ASSUMPTION`, `WEAK_EVIDENCE_ASSUMPTION` (tests match `/UTC|timestamp/` and `/causal/`).

## Code Examples

Design values below are `[ASSUMED]` constants chosen in this research; shapes use only types quoted from `src/core/model.ts`.

Quoted contract values `[VERIFIED: src/core/model.ts:17-19]`:
`export type ConfidenceBand = 'high' | 'medium' | 'low';` / `export type SignalName = 'proximity' | 'trace-match' | 'novelty' | 'churn';` / `export type EvidenceType = 'log-event' | 'error-group' | 'file-range' | 'feature';`
Existing tie-break strings `[VERIFIED: src/core/pipeline.ts:324-325]`: `rule: 'score descending, trace match descending, commit time descending, SHA ascending',` and `appliedOrder: ['score', 'trace-match', 'committedAtUtc', 'sha'],`.
Inclusive ranges `[VERIFIED: src/core/history-parser.ts:83]`: `'Inclusive range start must be <= end.'`

### Frozen constants
```typescript
// src/core/scoring.ts
import type { SignalName } from './model';

export const SCORING_V1 = Object.freeze({
  // PRD section 4: score = 0.35 * proximity + 0.30 * traceMatch + 0.25 * novelty + 0.10 * churn
  weights: Object.freeze<Record<SignalName, number>>({ proximity: 0.35, 'trace-match': 0.3, novelty: 0.25, churn: 0.1 }),
  proximityHalfLifeMinutes: 60,
  nearbyLines: 5,
  traceStrength: Object.freeze({ 'exact-line': 1, 'nearby-line': 0.6, 'file-only': 0.3, none: 0 }),
  churn: Object.freeze({ halfSaturationLines: 50, lineShare: 0.7, fileShare: 0.3, fileCap: 5 }),
  topN: 3,
  thresholds: Object.freeze({ ambiguousSeparation: 0.05, clearSeparation: 0.15, lineLevelShare: 0.5, stackCoverage: 0.75 }),
});

export function round6(value: number): number {
  const rounded = Math.round(value * 1e6) / 1e6;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/** Piecewise-exponential decay with exact halving; avoids Math.pow/exp for cross-engine stability. */
export function proximity(gapMinutes: number, halfLifeMinutes = SCORING_V1.proximityHalfLifeMinutes): number {
  if (!(gapMinutes > 0)) return 1;
  const halfLives = gapMinutes / halfLifeMinutes;
  const whole = Math.min(Math.floor(halfLives), 64);
  let scale = 1;
  for (let step = 0; step < whole; step += 1) scale /= 2;
  return round6(scale * (1 - (halfLives - Math.floor(halfLives)) / 2));
}

export function churn(linesChanged: number, filesTouched: number): number {
  const c = SCORING_V1.churn;
  const lines = c.lineShare * (linesChanged / (linesChanged + c.halfSaturationLines));
  const files = c.fileShare * Math.min(1, Math.max(0, filesTouched - 1) / (c.fileCap - 1));
  return round6(lines + files);
}
```

### Evidence matching
```typescript
// src/core/evidence.ts
import type { ChangedLineRange } from './model';
import { compareText } from './normalization'; // after exporting one shared copy

export type TraceMatchKind = 'exact-line' | 'nearby-line' | 'file-only' | 'none';
export type PathMatch =
  | { kind: 'exact' | 'prefix-stripped'; path: string }
  | { kind: 'ambiguous'; paths: string[] }
  | { kind: 'none' };

const segments = (path: string): number => path.split('/').length;

export function matchPath(framePath: string, changedPaths: readonly string[]): PathMatch {
  if (changedPaths.includes(framePath)) return { kind: 'exact', path: framePath };
  const candidates = changedPaths
    .filter((changed) =>
      (segments(changed) >= 2 && framePath.endsWith(`/${changed}`)) ||
      (segments(framePath) >= 2 && changed.endsWith(`/${framePath}`)))
    .sort(compareText);
  const only = candidates[0];
  if (candidates.length === 1 && only !== undefined) return { kind: 'prefix-stripped', path: only };
  return candidates.length > 1 ? { kind: 'ambiguous', paths: candidates } : { kind: 'none' };
}

/** Inclusive range semantics; `line === null` can only ever be file-only. */
export function classifyLine(line: number | null, ranges: readonly ChangedLineRange[], nearby: number): TraceMatchKind {
  if (line === null) return 'file-only';
  let best: TraceMatchKind = 'file-only';
  for (const range of ranges) {
    if (line >= range.start && line <= range.end) return 'exact-line';
    const distance = line < range.start ? range.start - line : line - range.end;
    if (distance <= nearby) best = 'nearby-line';
  }
  return best;
}
```

### Total ordering
```typescript
interface Ranked { scoreMicro: number; traceMicro: number; committedEpoch: number; sha: string }
export function compareRanked(a: Ranked, b: Ranked): number {
  return (b.scoreMicro - a.scoreMicro)
    || (b.traceMicro - a.traceMicro)
    || (b.committedEpoch - a.committedEpoch)
    || compareText(a.sha, b.sha);
}
// scoreMicro = Math.round(score * 1e6) (integers); never compare raw floats.
```

### Markdown helpers
```typescript
// src/core/markdown.ts
export function escapeMarkdown(text: string): string {
  return text.replace(/\s+/g, ' ').trim().replace(/[\\`*_[\]<>#~|]/g, '\\$&');
}
export function inlineCode(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  const longest = Math.max(0, ...(flat.match(/`+/g) ?? []).map((run) => run.length));
  const fence = '`'.repeat(longest + 1);
  return `${fence}${flat.startsWith('`') || flat.endsWith('`') ? ` ${flat} ` : flat}${fence}`;
}
```

### Additive contract (sketch for `model.ts`)
```typescript
export type ConfidenceLabel = 'low-confidence' | 'ambiguous' | 'weak-evidence' | 'no-clear-culprit';
export type RankingStatus = 'ranked' | 'no-onset' | 'no-eligible-commits';
export type TraceMatchKind = 'exact-line' | 'nearby-line' | 'file-only' | 'none';
export type CommitDispositionStatus = 'top-three' | 'scored' | 'excluded';

export interface TraceSummary { matchKind: TraceMatchKind; matchedErrorCount: number; lineLevelErrorCount: number; totalErrorCount: number }
export interface CommitDisposition {
  sha: string; shortSha: string; subject: string; author: string; committedAtUtc: TimestampUtc;
  status: CommitDispositionStatus; rank: number | null; score: number | null; reason: string | null;
}
export interface RankingSummary { status: RankingStatus; referenceUtc: TimestampUtc | null; eligibleCount: number; considered: CommitDisposition[] }
// ScoredSuspect += timeGapMinutes: number; traceSummary: TraceSummary
// ConfidenceRationale += labels: ConfidenceLabel[]
// AnalysisResult += ranking: RankingSummary ; AnalysisStream += ranking (internal richer form is fine)
```

### Prototype results (real streams, proposed constants, half-life 60, reference = window start)
`[VERIFIED: vite-node prototype run this session; targets for golden tests, to be re-confirmed by the implementation]`

| Fixture | Rank | SHA | Score | Notes |
|---------|------|-----|-------|-------|
| checkout-outage (spike) | 1 | `2222222…` payment retry | 0.912065 | exact-line match payment.ts:118 in 104-126; 5 of 5 errors |
| | 2 | `1111111…` dashboard decoy | 0.544053 | separation 0.368; `3333333…` (04:35) excluded `after-onset` though it also covers line 118 |
| slow-burn (ramp) | 1 | `5555555…` reservation batch | 0.839323 | exact-line reservation.ts:87 in 72-96; 6 of 6 errors; nearest commit `6666666…` is only 0.550277 |
| | 2 / 3 | `6666666…` / `4444444…` | 0.550277 / 0.474871 | separation 0.289; ramp caps band at medium |
| ambiguous (onset `ambiguous`) | 1 / 2 / 3 | `9999999…` / `8888888…` / `7777777…` | 0.575417 / 0.563158 / 0.540694 | trace 0 for all (top app frame `src/search/service.ts` untouched); separation 0.012 |

Sensitivity (half-life 30/60/120 x reference window-start/first-error): checkout and slow-burn culprit is #1 in all six combinations; ambiguous #1 changes with half-life (`8888888…` leads at 120), confirming the contract must assert the *interpretation*, not a particular #1 in the near-tie.

### Contract test skeleton (FIX-02 / FIX-03)
```typescript
it.each(fixtureIds)('ranks %s consistently with its manifest', (id) => {
  const manifest = JSON.parse(read(id, 'manifest.json')) as { expected: { confidence: string; onsetClass: string } };
  const result = toAnalysisResult(streamFor(id));
  expect(result.confidence.band).toBe(manifest.expected.confidence);
  expect(result.suspects.length).toBeLessThanOrEqual(3);
  expect(result.suspects.map((s) => s.rank)).toEqual(result.suspects.map((_, i) => i + 1));
  expect(serializeCanonicalJson(result)).toBe(serializeCanonicalJson(toAnalysisResult(streamFor(id))));
  expect(serializeMarkdown(result)).toBe(serializeMarkdown(toAnalysisResult(streamFor(id))));
});
// checkout: suspects[0].sha === '2222222222222222222222222222222222222222'; '3333333333333333333333333333333333333333'
//   appears in ranking.considered with status 'excluded' and is not in suspects.
// slow-burn: suspects[0].sha === '5555555555555555555555555555555555555555'; labels contain neither 'ambiguous' nor 'weak-evidence'.
// ambiguous: labels include 'ambiguous','weak-evidence','no-clear-culprit','low-confidence'; every suspect's trace signal value is 0;
//   spread between #1 and #3 < 0.05; Markdown contains no unqualified "culprit is" claim.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Nearest-commit-wins | Multi-signal bounded score with explicit evidence and labels | Phase 3 design | A decoy that is closest in time cannot win (PRD: "the real one is not the closest in time") |
| Single confidence band from onset class (`confidenceFor`) | Band derived from separation, line-level evidence share, onset quality, stack coverage | Phase 3 | Removes hard-coded "medium" for zero-suspect results |

**Deprecated/outdated (in this repo):** `confidenceFor`, `incidentInterpretation` stub text, `PHASE_THREE_ASSUMPTION`, the `suspects: []` adapter line.

## Carry-forward concerns (from `.planning/codebase/CONCERNS.md`) and disposition

| Concern | Disposition in Phase 3 |
|---------|------------------------|
| Hard-coded `medium` confidence / roadmap text in output | **Fix** — replace with derived band/labels/interpretation |
| Markdown not escaping user text | **Fix** — `markdown.ts` + tests (suspect lines are now reachable) |
| Possible off-by-one in `interpretSparseRamp` / `interpretWeakEvidence` | **Do not change windows.** Document, pin with a test, insulate ranking (Pitfall 3). Revisit in Phase 5 only with a deliberate fixture update |
| Unbounded bucket allocation | **Recommended small guard now** (`MAX_BUCKETS`, e.g. 10,000 → typed `INPUT_LIMIT` outcome) so `analyze()` stays total before ranking runs; otherwise defer to Phase 5 with an explicit note. `buildUtcBuckets` can currently throw out of `analyze()` |
| `compareText` duplicated 4x | **Recommended** — export one from `normalization.ts`; new modules import it; mechanical replacement is optional |
| No history size/commit cap | **Defer** (Phase 5); ranking is `O(commits x distinctFrames x log events)` so it is not the bottleneck |
| `limits.truncated` always false, `history.repository` unused | Not Phase 3; do not use `repository` for path stripping (suffix rule covers it) |
| Signature merging/over-splitting | Not Phase 3; aggregate over groups (Pitfall 6) |

## Recommended Plan Decomposition (mirrors Phase 2's three sequential plans)

1. **03-01 Evidence primitives and frozen scoring model** — `evidence.ts`, `scoring.ts`, shared `compareText`; golden unit tests: path separators/`./`/prefix/ambiguous suffix, inclusive range boundaries (start, end, start-1, end+1, +5/+6 nearby cut-off), vendor/generated/runtime/unattributed frames, missing file, null line, proximity knots (0/30/60/120 min), churn bounds (`< 1`, monotonic), weights integer-sum check, hard-coded-literal score test.
2. **03-02 Ranker, confidence/labels and contract extension** — `ranking.ts`, `model.ts` additions, `pipeline.ts` integration (`analyze` computes ranking; delete stubs), eligibility boundary +/-1 ms, `no-onset` / `no-eligible-commits` / single-commit cases, tie-break tests with synthetic equal scores, input-order independence, events without stack, update the two `AnalysisResult` literal builders and the stub-asserting tests.
3. **03-03 Serialization, fixtures contract and docs** — `canonicalizeResult` for new fields, `markdown.ts` escaping and new Markdown sections (verdict wording, labels, per-signal lines, UTC note, "ranked suspicion, not probability"), fixture ranking contract tests (FIX-02), byte-identity incl. TZ/locale/Date/Math stubs (FIX-03), onset-vs-`expected.json` pin test, README "How ranking works / limitations" paragraph.

Plans are sequential (shared files `model.ts`, `pipeline.ts`, `serialization.ts`).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 60-minute half-life, piecewise-exponential interpolation is an acceptable reading of "decays exponentially" | Signal definitions | Different decay changes absolute scores (fixture winners robust for 30-120 min) |
| A2 | Trace strengths 1.0 / 0.6 / 0.3 and 5-line "nearby" window | Signal definitions | Changes trace values and `weak-evidence` borderline cases |
| A3 | Churn formula (`lines/(lines+50)`, 70/30 lines/files split, file cap 5) | Signal definitions | Small effect (max 0.10 of score) |
| A4 | Thresholds 0.05 (ambiguous), 0.15 (clear), 0.5 (line-level share), 0.75 (coverage) | Confidence rules | Bands could shift on real data; fixtures validated only |
| A5 | Novelty treats the supplied log start as the observation start (absence before log start counts as "not seen") | Signal definitions | Overstates novelty when the log window starts after the commit; mitigated by an explicit assumption string in output. All three fixture logs start after every commit |
| A6 | Only the top application frame is scored; deeper application frames are supporting evidence only | Signal definitions | A culprit in a caller frame gets no score; documented limitation |
| A7 | No same-directory/sibling-file credit in `scoring-v1` | Pitfall 7 | Ambiguous fixture ranks the dependency-metadata chore #1 on proximity alone; with sibling credit `8888888…` would lead and match the PRD story "real one is not the closest in time" |
| A8 | Frame classifier path lists (`dist/build/out/coverage/.next`, `generated`, suffixes) | Pitfall 8 | A legitimate `build/` source dir would be treated as generated |
| A9 | Eligibility cutoff is inclusive at `onset.windowStartUtc` | Eligibility | A commit exactly at window start could be unfairly included/excluded |
| A10 | Recommended contract additions (`ranking`, `labels`, `timeGapMinutes`, `traceSummary`) match what Phase 4 needs for UX-02/UX-05 | Code Examples | Phase 4 would parse strings or require another contract change |
| A11 | ECMAScript treats `Math.exp`/`Math.pow` as implementation-approximated (taken from a search summary, spec text itself not retrieved) | Pitfall 5 | If wrong, the transcendental-free rule is merely conservative |

## Open Questions (RESOLVED)

1. **Fix slow-burn `expected.json` end and pin actual onset windows?** — **RESOLVED (user-approved, planning decision D-01).**
   - Known: actual end `08:40:00.000Z` vs expected `08:35:00Z`; ambiguous end `10:24` equals the last error time, checkout end `04:35` equals the bucket end; no test compares them.
   - Recommendation: change slow-burn `windowEndUtc` to `2026-10-19T08:40:00Z` (bucket-exclusive end) and add a Phase 3 test comparing `class`, `windowStartUtc`, `windowEndUtc` for all fixtures via `Date.parse` equality. Needs user OK since it edits a Phase 1 fixture.
   - **Resolution:** On 2026-10-19, during `/gsd-plan-phase 3` revision (iteration 1), the user was asked directly and explicitly chose **"Edit expected.json (Recommended)"**: change the slow-burn `expected.json` `onset.windowEndUtc` from `2026-10-19T08:35:00Z` to `2026-10-19T08:40:00Z` and add a test that pins each fixture's actual onset class, window start and window end against its `expected.json`. Onset logic in `src/core/pipeline.ts` stays unchanged. Implemented by Plan 03-03 Task 2 (D-01).
2. **Pin which SHA is #1 in the ambiguous fixture?** — **RESOLVED (planning decision D-02).**
   - Known: #1 flips with half-life; spread is 0.012.
   - Recommendation: assert interpretation invariants (labels, band, status, spread < 0.05, top-3 set = all three SHAs) plus one golden canonical-JSON snapshot that is explicitly frozen for `scoring-v1`; note in the test that order inside a near-tie carries no meaning.
   - **Resolution:** Adopted as D-02: the ambiguous fixture is asserted through interpretation invariants plus one frozen golden snapshot, never a required #1 SHA; the snapshot is cross-checked by a hand-derived per-signal arithmetic oracle (Plan 03-03 Task 2).
3. **Sibling-directory weak evidence (A7)?** — **RESOLVED (planning decision D-03).** Recommendation: no for v1 ("no invented matches"); revisit only if the demo narrative needs the adapter/cache commits to outrank the chore commit. **Resolution:** Adopted as D-03: no same-directory or sibling evidence in `scoring-v1` (Plan 03-01 Task 2).
4. **Bucket-count guard now or in Phase 5?** — **RESOLVED (planning decision D-04).** Recommendation: now (about 15 lines; makes `analyze()` total). **Resolution:** Adopted as D-04: `MAX_BUCKETS = 10_000` guard returning a typed `INPUT_LIMIT` outcome lands now (Plan 03-02 Task 3); a history size cap stays out of this phase.
5. **Contract extension (A10) approval:** — **RESOLVED (planning decision D-05).** Recommend required (non-optional) fields and updating the two test builders, rather than optional fields that weaken Phase 4's types. **Resolution:** Adopted as D-05: all new contract fields are required and the `makeResult` / `buildTracerResult` literal builders are updated (Plan 03-02 Task 1).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | tests/typecheck | yes | v24.14.1 on host (`.nvmrc` pins 22.20.0) | CI/Docker uses 22.20.0; keep scoring transcendental-free |
| npm / vitest / tsc / vite-node | tests, typecheck, scratch scripts | yes | local `node_modules/.bin` | — |
| `make` | `make test` | no (Windows host) | — | run `npm run typecheck && npm test && npm run build` (as Phase 2 did) |
| Docker | rebuild check (not needed to implement Phase 3) | not probed | — | Phase 5 gate |
| `pdftotext` | reading PRD (research only) | yes | — | — |

**Missing dependencies with no fallback:** none.

## Security Domain

`security_enforcement` is enabled (ASVS level 1 per `.planning/config.json`). Phase 3 has no auth, sessions, network or persistence.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication / V3 Session | no | — (no accounts, no server) |
| V4 Access Control | no | — |
| V5 Validation, Sanitization, Encoding | **yes** | `normalizeRepositoryPath` for every path in evidence; `escapeMarkdown`/`inlineCode` for all exported user text; `Map` for user-keyed collections |
| V6 Cryptography | no | `stableSourceId` is a non-cryptographic content hash, not a security control |
| V8 Data Protection / privacy | yes (inherited) | no network calls in `src/core`; no wall-clock or machine paths in output |
| V12 Files / resources (DoS) | yes | bounded work: `O(commits x distinctFrames x log events)`; bucket guard (Open Question 4); history size cap deferred |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Markdown injection via commit subject/author/diagnostic (links, headings, HTML) in the exported postmortem | Tampering / Spoofing | `escapeMarkdown`, `inlineCode`, tests with `#`, `*`, backtick, `[x](y)`, `<script>`, newline |
| Prototype pollution via path/signature as object key (`__proto__` is a valid repo-relative path) | Tampering | `Map`/`Set`; no `Record<string, …>` keyed by user text in new code |
| Path traversal/absolute paths in evidence | Information disclosure | Already rejected by `normalizeRepositoryPath`; evidence built only from normalized paths |
| Crafted history causing slow ranking (many commits/files) | Denial of service | Pre-aggregated frame index + binary search; follow-up history cap |
| Crafted logs spanning years (bucket explosion) before ranking | Denial of service | `MAX_BUCKETS` guard returning a typed `INPUT_LIMIT` outcome |
| UI later rendering result strings with `innerHTML` | Tampering (XSS) | Phase 4 must use `textContent`; note for Phase 4 planner |

## Sources

### Primary (HIGH confidence)
- Local PRD text extracted with `pdftotext` from `Culprit Product Requirements Document.pdf`, sections 4 (score formula, signal rules, honesty rules), 5, 8 (scoring tests), 9 (sample incidents) — frozen weights and rules of thumb.
- Repository files read this session: `src/core/{model,pipeline,serialization,signatures,normalization,onset,buckets,history-parser,log-parser}.ts`, `tests/core/{analysis-fixture,fixture-contract,serialization,determinism,pipeline}.test.ts`, `fixtures/incidents/*/{manifest,expected,history,logs}`, `.planning/{REQUIREMENTS,ROADMAP,STATE}.md`, `.planning/codebase/*.md`, `.planning/research/{ARCHITECTURE,PITFALLS,SUMMARY}.md`, Phase 2 verification/summary.
- Executed `analyze()` on all three fixtures and the scoring prototype via `vite-node` (scratch scripts outside the repo).

### Secondary (MEDIUM confidence)
- Search summary on ECMAScript implementation-approximated math: tc39.es spec index (section body not retrievable), https://tc39.es/archives/bugzilla/126/, https://redirect.github.com/endojs/endo/discussions/1946 , https://www.freecodecamp.org/news/i-found-a-bug-in-v8s-exponentiation-operator-dcddfa5b8482/

### Tertiary (LOW confidence)
- None relied upon for decisions.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; versions read from `package.json`.
- Architecture: HIGH — seams, field names and tests verified in code; contract extension is a recommendation.
- Signal constants/thresholds: MEDIUM — validated only on three fixtures plus sensitivity runs; flagged `[ASSUMED]`.
- Pitfalls: HIGH for codebase-derived ones (verified by execution); MEDIUM for cross-engine math claim.

**Research date:** 2026-10-19
**Valid until:** 2026-11-18 (stable; invalidate if Phase 2 onset logic or fixtures change)
