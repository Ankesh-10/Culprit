# Feature research: a trustworthy incident-analysis MVP

## Scope and product test

Culprit is a local, deterministic incident-analysis console: a developer supplies a
log snapshot and git-history export, and gets a short, verifiable answer to “which
commit most likely broke production?”. The MVP should optimize for **time to a
useful, honest shortlist**, not for complete observability or change-management
coverage.

The feature test used below is deliberately strict. A feature belongs in v1 only if
it improves the supplied-log-to-suspect workflow, can be implemented without a
server or runtime AI, has deterministic behavior that can be unit tested, and does
not make the demo harder to understand in a few seconds. Complexity is relative to
this project: **S** = a focused parser/UI addition, **M** = a new analysis or
interaction path with several edge cases, **L** = a second product surface or a
substantial platform/integration commitment.

## Product guardrails

These are acceptance criteria for every feature, rather than optional polish:

- **Explainability:** every ranking claim should point to observable inputs (time
  proximity, stack/file overlap, novelty, or churn) and expose how the score was
  formed. No opaque model confidence or unsupported causal language.
- **Honest uncertainty:** show the top three where possible, explicitly label low
  confidence and no-incident/ambiguous outcomes, and make “no clear culprit” a
  successful result rather than an error.
- **Offline privacy:** logs and repository data remain in-browser; no accounts,
  uploads, cloud calls, analytics, or runtime AI. Browser APIs and bundled fixtures
  are acceptable.
- **Determinism:** UTC-normalized timestamps, frozen weights, stable ordering, no
  current-time or random-number dependency, and byte-identical results for
  identical inputs.
- **Accessibility:** semantic structure, keyboard operation, visible focus,
  sufficient contrast, text labels in addition to color/position, responsive
  behavior, and usable empty/loading/error states.

## Table stakes

These capabilities define the minimum credible incident-analysis workflow. They
should be built as one vertical slice and are all **v1: yes**.

| Feature | User value | Complexity | Dependencies | v1? |
|---|---|---:|---|---|
| Bundled incident quick-load | A judge can reach a meaningful result instantly and compare clear, gradual, and ambiguous cases without preparing files. | S | Three deterministic fixtures; reset/replace input state. | **Yes** |
| JSON-lines and plain-text log ingestion | Covers the two promised input styles and makes the tool useful beyond fixtures. | M | Parser library, multiline stack-trace rules, size cap, invalid-input diagnostics. | **Yes** |
| Git history export ingestion | Supplies the change set needed for correlation while respecting the no-repository-upload boundary. | M | One documented export schema; commits, touched files, line ranges, timestamps, messages. | **Yes** |
| Clear validation and recoverable errors | Prevents an opaque blank screen when a file is malformed, unsupported, oversized, or missing required fields. | S | Shared error model; accessible inline/status messaging; retry/reset path. | **Yes** |
| Error-signature normalization and grouping | Turns noisy repeated stack traces/messages into a small set of incident signals and reveals first-seen time and counts. | M | Stable normalization rules; bounded parsing; deterministic group IDs/order. | **Yes** |
| Incident onset and error-rate series | Establishes the temporal anchor for “before the incident” and distinguishes spike, ramp, and no-incident inputs. | M | UTC parsing; fixed bucketing; threshold/heuristic rules; fixture coverage. | **Yes** |
| Explainable suspect ranking | Produces the core answer: a frozen-weight score from proximity, trace/file match, novelty, and churn. | M | Parsed logs/history, onset detector, scoring contract, stable tie-breakers. | **Yes** |
| Top-three shortlist with confidence | Gives a useful investigation starting point without pretending to identify one certain cause. | S | Ranking output; confidence bands; explicit low-confidence/ambiguous state. | **Yes** |
| Evidence per suspect | Lets a human verify why a commit appears: matching file/trace, time distance, novelty, churn, and relevant log group. | M | Score contributions retained in analysis result; links from card to details. | **Yes** |
| Interactive incident timeline | Connects error rate, onset, commits, and underlying log lines so temporal claims are inspectable. | M | Stable event model; keyboard-accessible timeline alternative; responsive rendering. | **Yes** |
| Focused suspect detail and diff/line evidence | Moves from shortlist to the exact touched files/line ranges that deserve review. | M | Exported line ranges; selected suspect state; safe text rendering; error-group filter. | **Yes** |
| Concise Markdown postmortem copy | Converts analysis into a useful handoff while preserving evidence, confidence, and caveats. | S | Deterministic serializer; Clipboard API with visible fallback/status. | **Yes** |
| Intentional empty, loading, no-incident, low-confidence, and responsive states | Builds trust in normal and edge cases and satisfies the laptop/phone demo path. | M | State model; CSS responsive layout; accessible live/status regions. | **Yes** |

### Table-stakes implementation note

The parser, detector, scorer, and serializer should live in a pure TypeScript core;
the UI should only orchestrate input and presentation. This keeps the highest-risk
claims testable offline and allows the demo fixtures to exercise the same path as
user-provided data. A documented hosted-demo log cap is preferable to a fragile
promise of arbitrary-scale processing; a worker can be added if profiling shows
the cap is insufficient.

## Differentiators

These make Culprit more trustworthy or pleasant than a generic “sort commits by
time” screen. The first group is worth the buildathon; the rest should wait until
the vertical slice is stable.

| Feature | User value | Complexity | Dependencies | v1? |
|---|---|---:|---|---|
| Evidence-first score breakdown | Makes the ranking auditable at a glance and teaches the user what the tool can/cannot infer. | S | Scoring contributions and labels; accessible disclosure UI. | **Yes** |
| “Why not certain?” confidence explanation | Prevents over-trust by naming ties, weak signals, sparse history, or competing error groups behind low confidence. | M | Confidence policy tied to deterministic score separation/data sufficiency. | **Yes** |
| Linked log-line inspection | Lets users jump from a timeline/group to the exact normalized/raw lines that support it. | M | Stable source line references; bounded retained excerpts; accessible modal/panel alternative. | **Yes, if it stays focused** |
| Fixture case-study labels | Makes the three demos pedagogically distinct: checkout outage, slow-burn failure, and ambiguous case. | S | Fixture metadata; brief “what to notice” copy. | **Yes** |
| Analysis summary with input provenance | Shows file names, row/commit counts, UTC note, parser format, and analysis version so a result can be reproduced. | S | Input metadata; deterministic analysis version string. | **Yes** |
| Keyboard-first timeline navigation | Makes a dense visual useful without a mouse and improves screen-reader discoverability. | M | Roving focus or list alternative; semantic event labels; focus styling. | **Yes, folded into accessibility** |
| Web Worker parsing for large snapshots | Keeps the page responsive when a supplied log approaches the documented cap. | M | Worker-safe core, progress/cancel protocol, testable serialization. | **Maybe: only if profiling requires it** |
| Side-by-side commit comparison | Helps a user compare the top two suspects’ evidence before opening a real diff. | M | Selected suspect state; compact responsive comparison layout. | **No** |
| Exportable standalone report | Provides a saved artifact for a ticket or review without sharing source data with a service. | M | Stable HTML/Markdown/PDF approach; privacy review; download UI. | **No** |
| Historical baseline or repeated-run comparison | Could distinguish a new regression from a known recurring error. | L | Multiple snapshots, persistence or user-managed files, new UX and semantics. | **No** |

The highest-return differentiator is not more signals; it is making existing signals
legible. A smaller shortlist with inspectable evidence beats a larger ranking with
more heuristics. Any additional signal should be added only with a fixture, a
plain-language explanation, and a test for deterministic tie behavior.

## Anti-features

These are tempting because they sound like “production readiness”, but they would
weaken the MVP’s privacy, explainability, or delivery odds. Treat them as explicit
product boundaries.

| Anti-feature | Why users may ask for it | Why it is harmful now | v1 decision |
|---|---|---|---|
| Runtime AI/LLM diagnosis | Natural-language root-cause summaries sound powerful. | Adds network/key/privacy risk, nondeterminism, cost, and an authority the evidence cannot support. | **Exclude** |
| Live log streaming | Feels closer to an observability product. | Expands into transport, state, timing, and operational concerns; undermines the deterministic snapshot demo. | **Exclude** |
| Whole-repository browser upload | Seems easier than defining an export. | Increases privacy risk, parsing scope, memory pressure, and UI complexity; the documented export is sufficient. | **Exclude** |
| GitHub/Slack/PagerDuty integrations | Makes the tool fit existing workflows. | Requires credentials, network paths, API maintenance, and an approval/auth surface unrelated to proving the core value. | **Exclude** |
| Auto-fix, rollback, or deploy action | Could reduce time to recovery. | Moves from evidence to high-impact intervention and requires confidence far beyond this analysis. | **Exclude** |
| User-configurable scoring weights | Appeals to advanced users. | Makes results harder to compare, explain, and test; fixed weights are a trust feature for v1. | **Exclude** |
| Accounts, database, cloud storage, or telemetry | Enables history, sharing, and product metrics. | Violates offline-first privacy and adds infrastructure that does not improve the core demo. | **Exclude** |
| “Single culprit” guarantee or causal language | Gives a crisp answer under pressure. | Misrepresents correlation and encourages unsafe action, especially for ambiguous fixtures. | **Exclude** |
| Dozens of log formats and language-specific parsers | Broadens potential audience. | Dilutes the two documented formats and makes error semantics difficult to validate before the deadline. | **Exclude** |
| Fancy graph/network visualization | Looks impressive in a demo. | Can hide evidence, be inaccessible, and consume time better spent on the timeline and detail view. | **Exclude** |

## Optional refinements

These are worthwhile only after the core flow, rebuild, and meaningful tests pass.
They should never displace parser correctness, low-confidence behavior, or
accessibility.

| Refinement | User value | Complexity | Dependencies | v1? |
|---|---|---:|---|---|
| Drag-and-drop plus file picker | Faster input with familiar interaction. | S | Browser File API; keyboard-equivalent picker; validation states. | **Yes, if cheap** |
| Paste log/history text directly | Useful for a quick demo or terminal copy. | S | Textarea; same parser/validation path; size cap. | **Yes, if cheap** |
| Search/filter within error groups and commits | Reduces scanning in a dense result. | S | Stable displayed fields; accessible filter controls. | **Maybe** |
| Compact/detailed density toggle | Supports laptop investigation and small phone screens. | S | Two tested layout modes; preserved semantics. | **No, unless layout needs it** |
| Theme or dark mode | Comfort and visual preference. | M | Contrast audit across statuses, focus, charts, and code. | **No** |
| Print stylesheet | Makes a postmortem easier to archive. | S | Print-specific layout; no hidden evidence. | **No** |
| Copy individual evidence snippets | Speeds issue-ticket writing. | S | Clipboard status feedback; deterministic text. | **Maybe** |
| Local recent-result persistence | Avoids reloading inputs during one session. | M | Explicit browser storage consent/clear behavior; privacy copy; schema versioning. | **No** |
| Localization-ready labels and time formatting | Future reach and clearer locale handling. | M | Message catalog; UTC policy; layout expansion tests. | **No** |
| Performance telemetry shown locally | Helps diagnose parse cost. | S | Deterministic or clearly labeled elapsed-time handling. | **No** |

## Recommended v1 cut line

The smallest complete and trustworthy release contains:

1. A pure, unit-tested pipeline for the two log styles and one git export format:
   parse → normalize/group → detect onset/rate → rank → serialize.
2. Three bundled fixtures, one-click loading, and a clear format/documentation
   boundary for user inputs.
3. A verdict card that says the leading interpretation, top three suspects, score
   evidence, and confidence; it must visibly support “no clear culprit”.
4. A linked, keyboard-usable timeline and suspect detail view with diff/line and
   error-group evidence.
5. Recoverable validation, loading, empty, no-incident, low-confidence, and
   responsive states, including non-color cues and visible focus.
6. Deterministic Markdown postmortem copy and input provenance (including UTC).
7. A rebuildable project surface: pinned Node, lockfile, Dockerfile, `.env.example`,
   README steps, and one offline test command.

Defer every feature that introduces a second persistence, integration, or action
surface. In particular, do not spend the buildathon budget on more ranking
features until the existing four signals are understandable and their failure
modes are covered by the three fixtures. The winning demo is one in which a judge
can load an incident, follow the onset-to-commit evidence, see why confidence is
limited, and independently decide what to inspect next in under ten seconds.

## Verification checklist for feature acceptance

- Same inputs produce the same structured result and Markdown output on repeated
  runs and on a clean Linux rebuild.
- A spike, ramp, no-incident, and ambiguous case each produce the intended state;
  ambiguous data does not force a false winner.
- Invalid JSON-lines, malformed timestamps, unsupported history, missing fields,
  multiline traces, and size-limit violations produce actionable messages.
- The top-three cards expose evidence and do not rely on color alone; keyboard and
  screen-reader users can reach the same information as pointer users.
- Raw logs/history never leave the browser, and the UI communicates that boundary.
- Tests run offline with the single documented command, with no current-time,
  randomness, network, or machine-specific absolute-path dependency.
