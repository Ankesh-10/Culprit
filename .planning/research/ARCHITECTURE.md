# Culprit Architecture Research

## Architectural position

Culprit should be a small, dependency-light TypeScript monorepo-in-one-package with a strict seam between a pure analysis core and a Vite browser shell. The core receives serializable input and returns serializable output; it must not import DOM, Vite, React/UI code, filesystem APIs, locale-sensitive formatting, `Date.now()`, randomness, or network clients. This keeps the important behavior unit-testable in Node and makes the browser worker a deployment detail rather than part of the algorithm.

Suggested layout:

```text
src/
  core/
    model.ts          # public input/output and internal domain types
    pipeline.ts       # analyze(input): AnalysisResult
    logs/             # format detection, JSONL/plain-text parsing
    onset/            # bucket series and incident onset
    signatures/       # normalization and grouping
    git/              # export parsing and commit model
    scoring/          # feature extraction, fixed weights, ranking
    fixtures/         # typed fixture manifests (or test-only fixture imports)
  worker/
    analysis.worker.ts
    client.ts         # request/response protocol and cancellation
  ui/
    app.ts            # state transitions and composition
    components/       # verdict, timeline, shortlist, drawer, states
    format.ts         # UTC/date/number/markdown presentation only
  main.ts
tests/
  core/               # parser, algorithm, fixture contract tests
  worker/             # protocol tests
  ui/                 # only high-value state/render tests
fixtures/
  incidents/{checkout-outage,slow-burn,ambiguous}/
```

The exact UI framework is secondary; a thin Vite app can use plain TypeScript DOM rendering or a small view library. Avoid allowing UI convenience to leak into `core`.

## Domain contracts and boundaries

Define stable, JSON-serializable contracts first. Every collection should have an explicit ordering rule, and every timestamp should be an ISO UTC string or an integer epoch millisecond. A useful top-level contract is:

```ts
type AnalysisInput = {
  logs: { text: string; format?: 'jsonl' | 'plain' };
  history: { text: string; format: 'culprit-json' | 'git-log' };
  options?: { bucketMinutes?: number; maxLogBytes?: number };
};

type AnalysisResult = {
  schemaVersion: 1;
  incident: IncidentSummary;
  errors: ErrorGroup[];
  timeline: TimelinePoint[];
  commits: ScoredCommit[];
  warnings: string[];
};
```

Internal types should preserve evidence rather than only aggregates:

- `LogEvent`: `id`, `timestampUtc`, `level`, `message`, `stack`, `rawLine`, and parsed source metadata.
- `ErrorGroup`: stable normalized signature, representative message, count, first/last seen, event IDs, and stack frames.
- `GitCommit`: stable SHA, author/subject, committed-at UTC, parent(s), touched files, and changed line ranges.
- `TimelinePoint`: bucket start/end, event count, error-group counts, and commit IDs that fall in the bucket.
- `ScoredCommit`: commit reference, total score, confidence band, feature values, evidence references, and rank.
- `EvidenceRef`: typed pointer (`logEvent`, `errorGroup`, `fileRange`, or `feature`) so UI can open the underlying evidence without reparsing.

The core should reject malformed input with typed, actionable errors (`InvalidLogError`, `InvalidHistoryError`, `UnsupportedFormatError`, `InputLimitError`) including source, line/record, and reason. Partial parsing is acceptable only when explicitly represented in `warnings`; never silently discard malformed records.

## End-to-end data flow

1. **Input adapter** reads fixture text, pasted text, or file text in the browser and creates `AnalysisInput`. It applies a documented byte cap before worker submission.
2. **Worker protocol** sends `{ requestId, input }` to the worker. The worker calls the pure `analyze` function and returns `{ requestId, ok, result }` or `{ requestId, ok: false, error }`.
3. **Log parser** detects an explicitly selected format or tries the two supported formats in a deterministic order. JSON-lines parsing handles one event per record; plain text uses a documented timestamp/level/message convention and a continuation-line state machine for multiline stacks. Preserve raw text and line numbers for evidence.
4. **Canonicalization** normalizes timestamps to UTC, trims and normalizes whitespace, and assigns event IDs by input order. It must not use local timezone or current time.
5. **Signature grouping** derives a signature from stable error identity: normalized message (variable IDs, UUIDs, numbers, and quoted values replaced with tokens), exception/type when present, and the first meaningful application stack frame. Grouping uses a stable map and sorts groups by count descending, first-seen ascending, then signature.
6. **Onset detector** bins events into fixed-width UTC buckets. It produces the complete series, including empty buckets between min and max event time. Detect spikes and ramps using fixed baseline/warm-up rules; return `no-incident` when there is no statistically meaningful change. Onset output must include method, bucket, baseline, peak, and confidence/explanation, not just a timestamp.
7. **History parser** reads the bundled format and one documented export format into commits. The parser must preserve commit order independently of source order, normalize line ranges, and reject duplicate/conflicting SHAs. A deliberately narrow format is safer than attempting to parse arbitrary `git log` output.
8. **Feature extraction** considers only commits at or before onset (with a documented boundary rule) and calculates normalized proximity, stack/file trace match, novelty, and churn. Each feature has a value, explanation, and evidence refs.
9. **Scoring** applies frozen weights from one versioned constant. Missing evidence contributes zero, not a guessed value. Stable tie-breaking is total: score descending, trace match descending, commit time descending, SHA ascending. The result includes the formula/version so scores are explainable and fixture snapshots remain valid.
10. **UI selector/state layer** stores input source, parse status, analysis status, selected error group, selected commit, and drawer/timeline position. It consumes only result/error messages and never mutates analysis data.

## Parsing details

### Logs

Support exactly two documented styles for the MVP:

- JSONL records with a timestamp field, message/error field, optional level, exception, and stack.
- Plain text records beginning with a recognized ISO timestamp and optional level; indented or non-timestamp lines attach to the previous event as stack/message continuation.

Use a line scanner rather than a giant regex. Enforce a maximum input size and maximum events/stack lines so a hostile or accidental paste cannot freeze the page. Parse timestamps with strict ISO handling and normalize immediately. Keep parser output independent of display formatting.

### Git history

Prefer a self-describing JSON export as the bundled/documented boundary, for example commit objects with SHA, timestamp, subject, files, and `{path, added, deleted, ranges}`. If a text `git log` export is required, use explicit record and file delimiters and version it; do not infer file/range data from arbitrary prose. Changed line ranges are evidence inputs, not a full patch, so scope scoring around overlap and churn rather than pretending to display a complete diff. A later CLI can emit this same contract without changing the core.

## Scoring and explainability

Implement feature extraction separately from the weighted ranker:

```text
total = w_proximity * proximity
      + w_trace     * traceMatch
      + w_novelty   * novelty
      + w_churn     * churn
```

Keep weights and normalization constants in a frozen, named `SCORING_V1` object. Proximity should decay with time/distance from onset; trace match should reward stack-frame/file overlap; novelty should reward a first-seen error group or recently changed path; churn should be bounded so a huge unrelated commit cannot dominate. Every feature must emit a human-readable reason and evidence references. Confidence is a separate interpretation of score separation and evidence completeness; it must be low when there are no usable pre-onset commits, ambiguous ties, or weak trace support. The UI should say “most likely” and show uncertainty rather than imply causality.

## Worker boundary and large-input behavior

The worker is an adapter, not a second implementation. `analysis.worker.ts` imports the same `analyze` function used by Node tests. The protocol needs request IDs, one terminal response per request, structured serialized errors, and optional cancellation (`cancel(requestId)`). The UI ignores stale responses whose request ID is no longer current. Transferable buffers are optional; start with strings for clarity and only optimize after measuring.

For the hosted demo, document a cap (for example, a bounded number of bytes/events) and show a clear limit error. Run small fixture analysis immediately, but use the worker for all real analysis so the browser architecture is consistent. The core itself remains synchronous and deterministic; worker scheduling must not affect results.

## UI architecture and interaction model

Use a single explicit state machine:

```text
empty -> loading -> ready
                 -> error
ready -> loading (new input)
ready -> ready (select group/commit/timeline bucket)
```

State contains `analysis`, `status`, `error`, `selectedCommitSha`, `selectedErrorSignature`, `selectedBucket`, and input-source metadata. Keep selection IDs, not copied mutable domain objects. Render separate focused components:

- **Verdict card**: onset, leading suspect, score/confidence, and a short evidence summary.
- **Shortlist**: top three stable-ranked commits with score bars plus text labels; never use color alone.
- **Timeline**: accessible SVG/canvas or HTML chart with error-rate series, onset marker, commit markers, and selectable buckets. Provide a tabular/list fallback or an accessible summary for keyboard/screen-reader use.
- **Error groups**: counts and first-seen UTC times; selecting one filters highlighted timeline evidence.
- **Investigation drawer**: selected commit subject/SHA/time, touched files and line ranges, score breakdown, and linked matching log lines. Keep drawer content bounded and lazy if needed.
- **Input/status surfaces**: bundled fixture buttons, file/text inputs, loading progress copy, empty state, parse error details, low-confidence explanation, and mobile layout.

Formatting belongs in `ui/format.ts`: UTC labels, score percentages, and Markdown postmortem serialization. The core should return machine-readable values. The copy action should serialize the already computed result with stable ordering, not rerun analysis or include current time.

## Fixtures and deterministic testing

Treat the three incidents as versioned contracts, not only demo assets. Each fixture should include logs, history, a short README/manifest describing the intended onset and expected leading evidence, and any expected output assertions. The cases should exercise:

1. **Checkout outage**: sharp spike, clear matching commit, multiline stack.
2. **Slow-burn failure**: ramp, delayed onset, gradual signature growth, proving the detector is not spike-only.
3. **Ambiguous**: multiple plausible commits or weak trace evidence, proving low confidence and honest tie handling.

Tests should be layered:

- Parser unit tests for valid records, multiline attachment, malformed lines, timezone conversion, caps, and deterministic IDs.
- Signature tests for variable scrubbing, grouping, ordering, and first-seen times.
- Onset tests with hand-built bucket series for spike, ramp, no incident, gaps, and boundary timestamps.
- History tests for both formats, ranges, duplicate SHA/error behavior, and stable sorting.
- Scoring tests with fixed synthetic features that assert exact values, weights, ties, and missing evidence.
- Fixture contract tests asserting onset class/window, top suspect SHA, top-three uniqueness, confidence band, and stable serialized output. Avoid asserting every incidental UI string.
- Worker protocol tests proving success/error/stale-response behavior; browser tests should be few and focus on state transitions and keyboard/drawer behavior.

Use Vitest with a single offline command (`npm test -- --run` or `make test`), fixed locale/timezone in test setup, and snapshot or canonical JSON serialization where useful. Add a determinism test that runs `analyze` twice and compares byte-identical canonical JSON. Never use wall-clock assertions, random IDs, machine paths, or unordered object iteration in expected output.

## Dependencies and build order

Keep runtime dependencies minimal: TypeScript, Vite, Vitest, and only the chosen UI library (if any). Parsing, scoring, and formatting should use platform APIs or small local helpers; avoid date, chart, and state libraries until a concrete need appears. Lock all dependencies and pin Node 22.

Recommended vertical build order:

1. Establish contracts, canonical serialization, fixture directory, Node/Vite/TypeScript/Vitest scripts, lockfile, and offline test command.
2. Implement JSONL/plain-text log parsing with error types and parser tests.
3. Implement signature grouping and UTC event buckets.
4. Implement onset detection with spike/ramp/no-incident tests.
5. Implement history parsing and commit/range tests.
6. Implement feature extraction, frozen scoring, confidence, and fixture contract tests.
7. Wire `analyze(input)` and a worker protocol; add worker tests.
8. Build the minimum UI around one bundled checkout fixture: verdict, shortlist, timeline, and drawer.
9. Add all fixtures, file/text input, filtering, copyable Markdown, loading/error/empty/low-confidence states, accessibility, and responsive polish.
10. Run rebuild/Docker checks and offline test/build checks before submission.

This order exposes parsing and algorithm risk before visual polish while still producing a demonstrable vertical slice early.

## Safe scope cuts

If time or complexity threatens the rebuild check, retain the pure core, all three fixture analyses, verdict, top-three list, basic timeline, and evidence drawer. Cut in this order: arbitrary text history support (keep JSON export), full diff rendering (show file/range evidence), advanced filtering, animated timeline, chart library, repository upload UX, cancellation/progress percentages, and UI framework abstractions. Do not cut deterministic serialization, clear parse errors, low-confidence handling, multiline logs, onset evidence, or the fixture contract tests: those are the trust surface.

Do not add live streaming, remote services, runtime AI, configurable weights, or a CLI in this milestone. The documented history export is already a stable future boundary for a CLI, and the worker boundary leaves room for larger local inputs without changing product semantics.

## Key risks and mitigations

- **Format ambiguity**: version the export and report line-level errors; do not silently guess.
- **False certainty from scores**: expose feature breakdown, evidence, score separation, and confidence rules.
- **Timezone drift**: normalize at parse time and test under multiple `TZ` values.
- **Page freezes**: cap input and always route browser work through the worker.
- **Unstable ranking**: freeze weights, normalize inputs, and define total tie-breakers.
- **UI/core coupling**: enforce imports so `src/core` has no DOM/UI dependencies; test `analyze` in Node.
- **Demo-only behavior**: use the same fixture files and core path for buttons, tests, and worker calls.

The practical success criterion is that a fixture can be loaded, analyzed in the worker, and explained from raw log line through error group, onset bucket, feature evidence, and ranked commit without any hidden state or network dependency.
