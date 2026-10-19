---
last_mapped_commit: 89ce56e1d2666fb2512c9de922ee03b463449d90
last_mapped_at: 2026-10-19
---
# Codebase Concerns

**Analysis Date:** 2026-10-19

## Tech Debt

**Core ranking and UI are not implemented (Phases 3–4 pending):**
- Issue: The product's core value (ranked culprit commits) is stubbed. `toAnalysisResult` always returns `suspects: []`, and `timeline` always carries `commitShas: []`. The browser entry point only swaps a status string and performs no parsing, analysis, or rendering.
- Files: `src/core/pipeline.ts` (lines 289–328, `suspects: []`, `commitShas: []` via `timelineFromBuckets`), `src/core/model.ts`, `src/main.ts` (entire file is 8 lines, placeholder copy only), `index.html`, `.planning/ROADMAP.md` (Phase 3 and 4 unchecked), `.planning/STATE.md` ("Next Action: Plan Phase 3").
- Impact: Any user-facing claim of a verdict or suspect shortlist is currently unsupported. The shipped demo shows only a static shell.
- Fix approach: Implement Phase 3 (pre-onset eligibility, frozen weighted signals, tie-break as already documented in `toAnalysisResult.tieBreak`) and Phase 4 (worker boundary, verdict/shortlist UI) before any demo claims are made. Keep the placeholder copy out of release builds.

**Hard-coded confidence and onset wording that assumes unfinished ranking:**
- Issue: `confidenceFor` returns `band: 'medium'` for any `spike` onset even though `suspects` is always empty and `evidenceCompleteness` is hard-coded to `0`. `incidentInterpretation` tells users to "investigate pre-onset evidence after Phase 3 ranking", which is internal roadmap text leaking into output.
- Files: `src/core/pipeline.ts` (`confidenceFor` ~lines 278–286; `incidentInterpretation` ~lines 270–276), `src/core/serialization.ts` (renders `Confidence: **medium**` in Markdown, line ~233).
- Impact: A postmortem Markdown export can state "Confidence: medium" for an incident with zero scored suspects. This conflicts with the project's "explicit uncertainty" requirement.
- Fix approach: Derive confidence only from scored evidence. Return `low` or a dedicated "no suspects" state when `suspects.length === 0`, and rewrite interpretation copy to be user-facing.

**Hard-coded result metadata:**
- Issue: `limits.truncated` is always `false` (`src/core/pipeline.ts` line ~256), even though parsers can reject oversized input rather than truncate. `history.repository` is parsed (`src/core/history-parser.ts` line ~165) but never propagated into `AnalysisStream` or results.
- Files: `src/core/pipeline.ts`, `src/core/history-parser.ts`.
- Impact: Metadata presented as truth does not reflect what happened; the field has no meaning until a truncation policy exists.
- Fix approach: Either compute `truncated` from real drop/limit events or remove the field until a policy exists. Carry `repository` into provenance or drop it from the parsed document.

**Duplicated helper logic across modules:**
- Issue: `compareText` is re-implemented locally in `pipeline.ts`, `buckets.ts`, `signatures.ts`, and `serialization.ts`, while `buckets.ts` and `history-parser.ts` order by `Date.parse` subtraction. `serialization.ts` also uses default `.sort()` on `eventIds` and `errorGroupSignatures` while other places use `compareText`.
- Files: `src/core/pipeline.ts` (line 33), `src/core/buckets.ts` (line 17), `src/core/onset.ts`, `src/core/signatures.ts` (line 11), `src/core/serialization.ts` (lines 17, 72, 85–86).
- Impact: Ordering rules are not centralized, so determinism depends on each copy being identical. Default `.sort()` uses UTF-16 code-unit order, which currently matches `<`/`>` comparison but is an unstated coupling.
- Fix approach: Export one `compareText` (and one ordering policy document) from `src/core/normalization.ts` and import it everywhere.

**Unexplained index choice in heuristics (possible off-by-one):**
- Issue: `interpretSparseRamp` starts the ramp window at `nonEmpty[1]` (the second non-empty bucket), and `interpretWeakEvidence` starts at `errorTimes[1] ?? errorTimes[0]` (the second error timestamp). Neither comment justifies skipping the first element, and the choice is not covered by a documented rule.
- Files: `src/core/pipeline.ts` (lines 116 and 140).
- Impact: Reported onset windows may begin one event/bucket late. This is a determinism-safe but possibly incorrect window; fixture tests may be encoding the same assumption.
- Fix approach: Confirm intent against the PRD. If first-element is intended, document it inline; otherwise use index 0 and update fixture expectations.

**Stray and clutter files at repository root:**
- Issue: `commit-phase1.sh` is a one-off script committed at the root. `.dockerignore` references a literal `NUL` file (a Windows artifact) and a PDF, and `.opencode/` plus `.planning/state.json` sit alongside the source.
- Files: `commit-phase1.sh`, `.dockerignore`, `.gitignore`.
- Impact: Confusing for reviewers and for the "documented rebuild surface" requirement. `NUL` on Windows can break tooling that tries to create or copy it.
- Fix approach: Remove `commit-phase1.sh` once phase commits are done, remove the `NUL` entry from `.dockerignore`, and keep only documented scripts at root.

## Known Bugs

**Docker demo serves `index.html` and assets with `application/octet-stream`:**
- Symptoms: Browsers may download `index.html` instead of rendering it when the container is accessed at `/` or `/index.html`. Only `.js` and `.css` receive correct MIME types; `.html`, `.svg`, `.woff2`, `.json`, and `.map` fall through to `application/octet-stream`.
- Files: `Dockerfile` (inline `CMD` server; the `contentType` ternary `filePath.endsWith('.js') ? ... : filePath.endsWith('.css') ? ... : 'application/octet-stream'`). The SPA fallback path does set `text/html`, but the direct-file path does not.
- Trigger: `docker run --rm --publish 4173:4173 culprit:phase1`, then open `http://localhost:4173/`. The primary path `/` reads `index.html` successfully and takes the octet-stream branch.
- Workaround: Use `npm run preview -- --host 0.0.0.0 --port 4173` instead of the container. Fix by mapping `.html`, `.svg`, `.woff2`, `.json`, `.map`, and `.png` in the MIME table, or by replacing the inline script with a checked-in `scripts/serve.mjs`.

**Stack-frame regex has ambiguous alternation (possible catastrophic backtracking):**
- Symptoms: A single long plain-text stack line with many parenthesis-like tokens could take superlinear time in parsing. Not reproduced in this review.
- Files: `src/core/log-parser.ts` lines 76–77. The pattern `\(([^():]+|[^()]+):` uses two alternatives that match the same characters, combined with `(.+?)\s+`.
- Trigger: A line of roughly 1 MB (the default `maxLogBytes`) with repeated `at x (` fragments and no closing colon-digit pattern.
- Workaround: Bound line length before regex matching (e.g., skip frame parsing for lines over 4 KB) and simplify the alternation to `[^():]+`. Add a timing test to `tests/core/log-parser.test.ts`.

**Markdown output does not escape user-controlled text:**
- Symptoms: Commit subjects, diagnostic messages (which embed raw field names such as `Unsupported log field "${unknownField}"`), and signal explanations are inserted verbatim into headings and bullets. A subject containing `#`, backticks, or links renders as formatting in the exported report.
- Files: `src/core/serialization.ts` lines 221–225 (suspect lines and evidence headings), line 229 (diagnostics), `src/core/pipeline.ts` line ~56 (diagnostic message construction with user-supplied keys).
- Trigger: A history subject or log field name containing Markdown syntax.
- Workaround: None in code. Add a `escapeMarkdown` helper for interpolated user text and a test covering `#`, `*`, `` ` ``, `[`, and newlines.

## Security Considerations

**Docker server has no security headers and no Content-Security-Policy:**
- Risk: The privacy guarantee ("logs never leave the browser") is policy, not enforced by the page. Any injected script could exfiltrate pasted logs via `fetch` or `img` requests, and nothing in the HTML blocks it.
- Files: `index.html` (no CSP `<meta http-equiv>`), `Dockerfile` (`response.writeHead` calls set only `Content-Type`).
- Current mitigation: Source code contains no network calls (checked: no `fetch(`, `XMLHttpRequest`, or `innerHTML` in `src/`). The app is static.
- Recommendations: Add a restrictive CSP meta tag in `index.html` (`default-src 'self'; connect-src 'none'; img-src 'self' data:; object-src 'none'; base-uri 'none'`) and send `X-Content-Type-Options: nosniff`, `Cache-Control`, and a CSP header from the container server.

**Container serves on all interfaces by default:**
- Risk: `server.listen(4173, '0.0.0.0')` exposes the demo on every network interface of the host, including LAN peers, for a tool whose selling point is local-only data handling.
- Files: `Dockerfile` (inline server), `README.md` (documents `--host 0.0.0.0` for preview).
- Current mitigation: Path traversal guard (`filePath.startsWith(root + path.sep)`) prevents reading outside `dist/`. Decoding uses `decodeURIComponent`, which can throw on malformed `%` sequences; the handler is not wrapped in try/catch, so a malformed URL can crash the process.
- Recommendations: Bind to `127.0.0.1` by default (documented opt-in for `0.0.0.0`), wrap `decodeURIComponent` in try/catch, and reject requests with methods other than GET/HEAD.

**Base image is tag-pinned, not digest-pinned:**
- Risk: `FROM node:22.20.0-alpine` can change under the same tag; the reproducibility requirement is only partially met.
- Files: `Dockerfile` (lines 1 and 9).
- Current mitigation: Exact patch tag and committed `package-lock.json`.
- Recommendations: Record the image digest in the README and pin `FROM node:22.20.0-alpine@sha256:<digest>` after verifying it on the target architecture.

**Untrusted input is parsed without a size bound for history:**
- Risk: `parseHistoryExport` calls `JSON.parse(text)` on the full history payload with no byte limit (only logs have `maxLogBytes`). A very large history file can freeze the tab or exhaust memory.
- Files: `src/core/history-parser.ts` line ~149, `src/core/pipeline.ts` lines 171–174.
- Current mitigation: None for history. Logs are capped at 1 MiB by default.
- Recommendations: Add `maxHistoryBytes` alongside `maxLogBytes`, enforce it before parsing, and surface an `INPUT_LIMIT` diagnostic.

**Unbounded time-bucket allocation from caller-controlled timestamps:**
- Risk: `buildUtcBuckets` creates an entry for every bucket between the first and last error timestamp (`for (let start = firstBucketEpoch; start <= lastBucketEpoch; ...)`). Two timestamps years apart at the default 5-minute width produce millions of `UtcBucket` objects with ISO strings, which can exhaust memory or hang the page. Timestamps such as `0001-01-01T00:00:00Z` and `9999-12-31T23:59:59Z` are both accepted by `normalizeTimestampUtc`.
- Files: `src/core/buckets.ts` lines 52–73; `src/core/normalization.ts` lines 2–31 (accepts any four-digit year).
- Current mitigation: None. `bucketMinutes` is validated as a positive integer but has no upper bound.
- Recommendations: Cap the number of buckets (for example 10,000), return an `INPUT_LIMIT` diagnostic when exceeded, and add a test with a two-year span.

## Performance Bottlenecks

**Synchronous analysis on the main thread (planned worker not yet wired):**
- Problem: `analyze()` runs parsing, grouping, bucketing, and classification synchronously. The planned Web Worker boundary (see `.planning/research/PITFALLS.md` section 7 and `.planning/ROADMAP.md` Phase 4) does not exist.
- Files: `src/core/pipeline.ts` (`analyze`), `src/main.ts`.
- Cause: Entire log is parsed and sorted on the calling thread. `groupErrorEvents` sorts with `Date.parse` inside the comparator (`src/core/signatures.ts` line 86), and `buildUtcBuckets` re-parses timestamps (`src/core/buckets.ts` lines 26, 61, 81).
- Improvement path: Parse once to epoch milliseconds and carry the numeric key, then move `analyze` into a module worker with a typed request/response protocol.

**Repeated sorting and cloning in the timeline adapter:**
- Problem: `toAnalysisResult` and `canonicalizeResult` deep-copy errors, frames, and timeline points, and re-sort them on every call. `serializeMarkdown` calls `canonicalizeResult` again and re-sorts evidence.
- Files: `src/core/pipeline.ts` (`toAnalysisResult`), `src/core/serialization.ts` (`canonicalizeResult`, `serializeMarkdown`).
- Cause: Defensive copying at every boundary.
- Improvement path: Acceptable for fixture sizes; measure before optimizing. Canonicalize once and pass the canonical object to the Markdown and JSON serializers.

## Fragile Areas

**Onset heuristics depend on fixed buckets and the first two buckets as baseline:**
- Files: `src/core/onset.ts` (`classifyBuckets`, lines 44–112), `src/core/pipeline.ts` (`interpretSparseRamp`, `interpretWeakEvidence`).
- Why fragile: The baseline is the mean of the first two buckets. If an incident begins in bucket 0 or 1, the baseline already includes incident errors and the spike rule can miss the onset. The thresholds (`SPIKE_MIN_PEAK_COUNT = 3`, `SPIKE_BASELINE_MULTIPLIER = 3`, `RAMP_MIN_INCREASE = 2`) were tuned by inspection, and `pipeline.ts` layers two post-hoc reinterpretations on top of `classifyOnset`.
- Safe modification: Change one rule at a time and rerun all three fixtures in `tests/core/fixture-contract.test.ts`. Do not tune thresholds against a single fixture; the PITFALLS report warns about this.
- Test coverage: `tests/core/onset.test.ts` (107 lines) covers the named rules. No test covers incidents that start within the first two buckets or the interaction between `interpretSparseRamp` and `classifyOnset`.

**Signature grouping merges distinct failures:**
- Files: `src/core/signatures.ts` (`normalizeErrorMessage`, lines 39–48; `signatureForEvent`, lines 51–59).
- Why fragile: Numbers, quoted strings, and generic identifiers of 12+ characters are replaced with `<number>`, `<value>`, and `<id>`. `Failed to load user 42` and `Failed to load order 99` collapse to one group. Once grouping is wrong, bucket counts, onset, and the future ranking all inherit the error.
- Safe modification: Keep the exception class and an operation keyword in the signature, and add fixtures where distinct operations must remain separate.
- Test coverage: `tests/core/signatures.test.ts` (62 lines). No test asserts that two messages differing only in a numeric or quoted value are kept separate.

**Plain-text log grammar is narrow and silently demotes lines to diagnostics:**
- Files: `src/core/log-parser.ts` (`PREFIX_PATTERN` line 29, `isContinuation` lines 240–242, `parsePlainTextLog` lines 253–314).
- Why fragile: Only ISO-8601 timestamps followed by a lowercase level word are accepted. Lines with uppercase levels (`ERROR`), epoch timestamps, or leading BOM-adjusted content are demoted to `STACK_ATTACHMENT` diagnostics rather than failing. Diagnostics are retained, but the analysis still succeeds with fewer events.
- Safe modification: Add a fixture with uppercase levels and verify the resulting diagnostic count is shown to the user before extending the grammar.
- Test coverage: `tests/core/log-parser.test.ts` (59 lines) covers the basic prefix and one malformed line case.

**Inline Docker server is unreadable and untested:**
- Files: `Dockerfile` (single-line `CMD ["node", "-e", "..."]` with escaped regexes and a nested callback chain).
- Why fragile: Any change requires re-escaping inside JSON; the MIME bug above survived review because the logic is not testable outside the container.
- Safe modification: Move the server into `scripts/serve.mjs`, add it to `tsconfig.node.json`, and test it with a Vitest case that starts it on an ephemeral port.
- Test coverage: No test exercises the container server behaviourally. `tests/core/rebuild-surface.test.ts` (line 42) only string-matches `server.listen(4173` in the Dockerfile text.

## Scaling Limits

**Log size and event count:**
- Current capacity: `maxLogBytes` default 1,048,576 bytes; `maxEvents` 10,000; `maxStackLines` 100 (`src/core/log-parser.ts` lines 14–18).
- Limit: Inputs above these limits fail the whole analysis (`limitFailure`), with no partial result. Callers can raise `maxLogBytes` without any upper bound (`src/core/pipeline.ts` lines 157–166 accept any positive integer).
- Scaling path: Add a hard ceiling on `maxLogBytes` in `ensureInput`, document the supported ceiling in the UI, and consider streaming parse for larger logs once the worker exists.

**History size:**
- Current capacity: No limit at all.
- Limit: Entire history JSON is held in memory and parsed in one call, and every file in every commit is retained (`src/core/history-parser.ts` `parseCommit`).
- Scaling path: See the history size bound recommendation in Security Considerations.

## Dependencies at Risk

**Pinned tooling is current but unverified on the target runtime:**
- Risk: `package.json` pins Vite 7.1.10, Vitest 3.2.4, TypeScript 5.9.3, and `@types/node` 22.15.33. `.nvmrc` pins Node 22.20.0, and `engines` says `22.x`. `@types/node` 22.15.33 is older than the pinned runtime patch 22.20.0; this is minor version drift, not a confirmed type error.
- Impact: Low for the browser bundle; minor type drift in any Node-side script.
- Migration plan: Align `@types/node` with the pinned runtime minor (22.20.x) and confirm `npm ci` on a clean machine.

**Dependency on `Inter` font name without bundled font file:**
- Risk: `src/styles.css` lists `Inter` first in `font-family`, but no `@font-face` or font file exists. Rendering depends on what the host has installed, which conflicts with the "local font files" recommendation in `.planning/research/STACK.md`.
- Impact: Visual inconsistency across machines; no network request is made, so privacy is unaffected.
- Migration plan: Bundle a WOFF2 under `public/fonts/`, declare `@font-face` with `font-display: swap`, and record the license.

## Missing Critical Features

**Accessibility and responsive verification not yet possible:**
- Problem: The only UI is a static card. Focus visibility, keyboard flow for the timeline and suspect list, and contrast of future elements have no tests or checklist.
- Blocks: Requirements for visible focus, color-independent signals, and phone-width usability cannot be verified until Phase 4 exists.

**No privacy assertion in tests:**
- Problem: Nothing in the test suite asserts that the built bundle contains no network call sites or that `dist/` references no external origins.
- Blocks: The "no logs leave the browser" constraint is enforced by convention only.

## Test Coverage Gaps

**Input size and span limits:**
- What's not tested: History JSON larger than any practical bound; bucket explosion from timestamps years apart; `maxLogBytes` set to very large values.
- Files: `src/core/history-parser.ts`, `src/core/buckets.ts`, `src/core/pipeline.ts`.
- Risk: Memory exhaustion or frozen tab on crafted input.
- Priority: High

**Markdown escaping and report safety:**
- What's not tested: Commit subjects or diagnostic messages containing Markdown control characters in `serializeMarkdown`.
- Files: `src/core/serialization.ts`, `tests/core/serialization.test.ts`.
- Risk: Malformed or misleading postmortem output.
- Priority: Medium

**Docker static server behaviour:**
- What's not tested: MIME types for `.html`, `.svg`, `.woff2`, and `.json`; malformed percent-encoding; path traversal attempts; HEAD requests.
- Files: `Dockerfile`.
- Risk: The MIME bug above is reachable on the documented demo path with no failing test.
- Priority: High

**Plain-text stack and timing:**
- What's not tested: Long adversarial stack lines (regex timing), mixed-case levels, stacks split by blank lines, and CRLF-only input.
- Files: `src/core/log-parser.ts`, `tests/core/log-parser.test.ts`.
- Risk: Parser slowdowns or silent demotion of events.
- Priority: Medium

**Onset edge cases:**
- What's not tested: Incidents beginning in the first two buckets (baseline contamination), exact-boundary timestamps across bucket edges, and the index choice in `interpretSparseRamp` / `interpretWeakEvidence`.
- Files: `src/core/onset.ts`, `src/core/pipeline.ts`, `tests/core/onset.test.ts`.
- Risk: Onset window placed one bucket or event late without any test failing.
- Priority: High

---

*Concerns audit: 2026-10-19*
