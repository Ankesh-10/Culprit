# Culprit Pitfalls and Mitigations

This report turns the project constraints into implementation guardrails for the buildathon MVP. The recurring theme is that a plausible-looking incident console can be less trustworthy than a smaller analysis that exposes its assumptions. Every recommendation below should preserve deterministic, local, explainable behavior.

## Roadmap phase key

The phase names below are a suggested mapping for the roadmap. If the final roadmap uses different numbers, retain the ownership implied by the names rather than the numbers.

1. **Foundation and rebuild** — Node/TypeScript/Vite setup, fixtures, lockfile, Docker, README, offline test command.
2. **Analysis core** — input models, parsers, normalization, UTC handling, signatures, onset/error-rate detection, deterministic serialization.
3. **Evidence and ranking** — commit/history export parsing, stack-frame-to-diff matching, scoring, confidence and explanations.
4. **Incident-console UI** — verdict, shortlist, filters, details, loading/error/empty/low-confidence states, postmortem copy.
5. **Timeline and interaction** — SVG timeline, linked log lines, commit markers, responsive interaction and performance.
6. **Trust, accessibility, and release hardening** — accessibility audit, fixture realism, cross-browser/performance checks, clean rebuild and submission rehearsal.

## 1. Log parsing

### Pitfall: accepting malformed or subtly different input as valid

- **Warning signs:** A parser silently drops lines, returns an empty analysis for malformed JSON, treats a JSON object as a valid JSON-lines stream, or reports only a generic “analysis failed.” Input with a UTF-8 BOM, CRLF endings, blank lines, or trailing whitespace behaves differently from the same content normalized.
- **Prevention/mitigation:** Define the two supported formats explicitly. Parse JSON-lines line-by-line with line numbers and validate the minimum event contract; parse plain text with a documented timestamp/level/message convention. Preserve source line numbers and rejected-line counts. Normalize BOM, CRLF, and trailing newline deliberately, but do not silently discard nonblank invalid records. Return typed, actionable errors (format, line, field, reason) and a partial-input policy that is visible in the UI.
- **Roadmap phase:** **2 — Analysis core**, with representative malformed cases added in **1 — Foundation and rebuild**.

### Pitfall: multiline stacks are split into unrelated events

- **Warning signs:** An exception header and its `at ...` lines become separate errors; stack depth is zero; line numbers or `Caused by` chains disappear; a continuation line is counted as a new incident.
- **Prevention/mitigation:** Build a stateful plain-text parser with explicit event boundaries and continuation rules. Keep the raw block alongside normalized fields. Support only the documented stack styles, and reject/label ambiguous continuation rather than guessing. Test interleaved timestamps, indented frames, nested causes, tabs, and a stack at end-of-file without a final newline.
- **Roadmap phase:** **2 — Analysis core**.

### Pitfall: normalizing messages destroys useful signature distinctions

- **Warning signs:** Every `userId`, UUID, URL, or number is replaced indiscriminately, causing unrelated failures to merge; conversely, harmless request IDs produce one signature per line. The UI says “same error” while raw messages clearly differ in operation or exception type.
- **Prevention/mitigation:** Use a conservative, ordered normalization policy (UUIDs, high-cardinality IDs, paths, and numeric values only where justified). Keep both `rawMessage` and `normalizedSignature`; include exception class and stable message text in the signature. Add fixture assertions for both intended grouping and intentionally distinct errors. Show group counts and first-seen evidence so a user can challenge grouping.
- **Roadmap phase:** **2 — Analysis core**, verified through fixture work in **6 — Trust, accessibility, and release hardening**.

## 2. Timestamps and timezones

### Pitfall: mixed offsets create a false onset or wrong commit ordering

- **Warning signs:** An event at `10:00+05:30` sorts after `09:45Z` when it should precede it; timestamps without an offset are interpreted according to the developer machine; daylight-saving transitions produce duplicate or backward times; the chart and detail panel disagree.
- **Prevention/mitigation:** Require an offset or an explicit documented assumption for every supported timestamp. Parse to epoch milliseconds and retain the original string plus normalized UTC ISO output. Never use the browser’s local timezone as an implicit parser default. Sort by epoch, then stable source index for ties. Reject impossible dates and surface assumed timezone metadata. Put “all times shown in UTC” next to the timeline and details.
- **Roadmap phase:** **2 — Analysis core**; the display and copy are checked in **4 — Incident-console UI**.

### Pitfall: timestamp precision and ties change the deterministic answer

- **Warning signs:** Millisecond-vs-second interpretation changes the first-seen time; two records at the same timestamp reorder between runs; onset moves because an implementation uses `Date.now()` or unstable object iteration.
- **Prevention/mitigation:** Define accepted precision and conversion rules. Use stable sort keys `(timestamp, sourceIndex)` for logs and `(commitTimestamp, commitId)` for history, with a clearly documented tie-break. Derive every output from supplied input only; snapshot canonical serialized analysis output in tests. Avoid locale formatting in ranking or exported Markdown.
- **Roadmap phase:** **2 — Analysis core**, enforced by rebuild checks in **1 — Foundation and rebuild**.

## 3. Incident onset and error-rate detection

### Pitfall: a single noisy event is mistaken for the incident

- **Warning signs:** One isolated error moves onset to the first log line; a low-volume service cannot trigger an onset; a gradual ramp is missed; a quiet period is called an incident; boundary timestamps produce off-by-one buckets.
- **Prevention/mitigation:** Specify bucket width, baseline window, minimum counts, spike threshold, ramp rule, and no-incident result before coding. Return onset status (`spike`, `ramp`, `none`, `insufficient-data`) plus the evidence used, not only a timestamp. Use half-open UTC intervals and test sparse, bursty, gradual, constant, single-event, empty, and exactly-at-boundary data. Keep detection deterministic and avoid tuning against only the showcase fixture.
- **Roadmap phase:** **2 — Analysis core**.

### Pitfall: deploy timing is treated as causality

- **Warning signs:** The nearest commit before the first error always wins, even when the error existed earlier or the commit touched unrelated code. A post-onset commit is shown as a culprit. The UI uses language such as “caused by” for temporal correlation alone.
- **Prevention/mitigation:** Make the eligible set explicitly pre-onset (with a documented boundary policy), but keep temporal proximity as one signal. Separately report onset confidence and culprit confidence. If no baseline or onset is found, do not manufacture a suspect; return a low-confidence/no-incident state.
- **Roadmap phase:** **2 — Analysis core** for eligibility; **3 — Evidence and ranking** for language and confidence.

### Pitfall: clock skew and logging delays are ignored

- **Warning signs:** Events from different services appear to start in an impossible order; a known fixture’s onset is later than the deploy by an arbitrary amount; a log ingestion timestamp is confused with event time.
- **Prevention/mitigation:** Document that the MVP trusts the supplied event timestamp and does not infer cross-host clock correction. If fields distinguish event and ingestion time, choose one explicitly and show it. Add a fixture with delayed ingestion and label the limitation rather than silently “fixing” it.
- **Roadmap phase:** **2 — Analysis core**, with disclosure in **4 — Incident-console UI**.

## 4. Stack-frame-to-diff matching

### Pitfall: file and line paths do not normalize to the same identity

- **Warning signs:** `src\\checkout.ts`, `./src/checkout.ts`, and repository-prefixed paths fail to match; URL-encoded paths or monorepo package prefixes produce zero evidence; Windows paths leak into output and make snapshots machine-specific.
- **Prevention/mitigation:** Define a repository-relative POSIX path canonicalizer: normalize separators, remove `./`, strip only a documented source-root prefix, reject traversal, and preserve an “unmatched path” reason. Keep the original frame for display. Test Windows-style, package-root, generated-file, and missing-file paths without using absolute local paths.
- **Roadmap phase:** **3 — Evidence and ranking**, with cross-platform fixtures in **1 — Foundation and rebuild**.

### Pitfall: line-range semantics produce false matches

- **Warning signs:** A frame exactly at the first or last changed line is excluded; a hunk’s deleted lines are treated as current changed lines; a broad diff makes every frame match; a file-only change receives the same strength as an exact frame match.
- **Prevention/mitigation:** Parse diff hunks into explicit new-file ranges, use inclusive line semantics, and distinguish exact-line, nearby-line, file-only, and no-match evidence. Handle additions, deletions, renames, binary files, and zero-length ranges. Cap or decay proximity so a huge generated diff cannot dominate. Unit-test boundary values and explain the match type in the evidence card.
- **Roadmap phase:** **3 — Evidence and ranking**.

### Pitfall: stack matching overweights generic library frames

- **Warning signs:** `node_modules`, framework internals, or a shared utility outrank the application frame; the top suspect changes when an extra framework frame is added to the same stack.
- **Prevention/mitigation:** Prefer the first relevant application-owned frame, define excluded/vendor/generated path rules, and retain all frames for audit. Do not discard all unmatched frames: show why they were ignored. Make ownership configurable only as an input boundary (repository root), not as user-tuned ranking weights.
- **Roadmap phase:** **3 — Evidence and ranking**.

## 5. Ranking heuristics

### Pitfall: frozen weights become an opaque magic score

- **Warning signs:** A score changes after a refactor that should be behavior-preserving; a commit with no trace match wins because churn is large; users cannot reproduce the top three from the displayed evidence; equal scores reorder.
- **Prevention/mitigation:** Freeze named, normalized signals and weights in one versioned module. Define missing-signal behavior and score bounds. Return per-signal contributions, eligible/excluded commits, and stable tie-breaks. Keep the score as a prioritization aid, not a probability. Add golden tests for each signal in isolation, equal-score ordering, and adversarial combinations.
- **Roadmap phase:** **3 — Evidence and ranking**.

### Pitfall: novelty and churn reward the wrong change

- **Warning signs:** A large formatting/refactor commit outranks a small targeted bug fix; a first-seen error gets a novelty boost despite no matching file; a commit touching many files wins by volume alone.
- **Prevention/mitigation:** Normalize churn with caps or logarithmic scaling and treat it as a weak tie-breaker. Define novelty relative to the pre-onset history and the error signature, not global repository novelty. Require evidence thresholds for strong claims and show negative evidence (no trace match, unrelated paths). Use the three fixtures to ensure the intended leading suspect wins for the intended reason.
- **Roadmap phase:** **3 — Evidence and ranking**, fixture calibration in **6 — Trust, accessibility, and release hardening**.

## 6. Misleading confidence

### Pitfall: a rank is presented as a probability

- **Warning signs:** “87% likely” appears without calibration data; a top-ranked commit is called “the culprit” when all candidates are weak; confidence stays high when logs are sparse or no stack frame matches.
- **Prevention/mitigation:** Label the output “ranked suspicion” and use qualitative confidence bands tied to observable evidence coverage, separation from the runner-up, onset quality, and input completeness. Define a hard low-confidence path for no onset, no eligible commits, conflicting signals, sparse logs, or tied candidates. Explain why confidence is low. Never imply statistical calibration unless benchmark data exists.
- **Roadmap phase:** **3 — Evidence and ranking**; wording and visual treatment in **4 — Incident-console UI**.

### Pitfall: polished UI hides uncertainty and data loss

- **Warning signs:** An empty chart looks like zero errors; truncated logs are not disclosed; parser warnings are below the fold; a “no culprit” result looks like a successful analysis.
- **Prevention/mitigation:** Carry analysis warnings, caps, dropped/invalid counts, and assumptions as first-class result metadata. Render explicit empty, partial, no-incident, and low-confidence states. Add a compact “how this was decided” section with links to source lines, matched frames, and commit ranges. Ensure Markdown postmortems include limitations, not just the verdict.
- **Roadmap phase:** **4 — Incident-console UI**, with metadata designed in **2/3**.

## 7. Browser performance

### Pitfall: synchronous parsing freezes the demo

- **Warning signs:** The tab becomes unresponsive while loading a large paste; typing or file selection lags; a spinner cannot paint until analysis finishes; memory grows after repeated loads.
- **Prevention/mitigation:** Set and document a hosted-demo input cap before implementation. Parse in a Web Worker for inputs above a small threshold, transfer plain data rather than cloning giant strings repeatedly, and make cancellation/replacement explicit. Bound retained raw lines and destroy worker state after completion. Measure with a fixture near the cap and check first paint, parse time, peak memory where available, and repeated runs.
- **Roadmap phase:** **5 — Timeline and interaction** for worker integration/perf; cap and measurement harness begin in **1/2**.

### Pitfall: rendering raw logs or thousands of SVG nodes overwhelms the DOM

- **Warning signs:** Timeline scrolling becomes janky; every log line is rendered even when invisible; tooltips trigger layout thrashing; a large incident crashes mobile browsers.
- **Prevention/mitigation:** Keep analysis data separate from view data; aggregate error-rate bins and virtualize or window detailed log rows. Limit SVG marks to visible/meaningful points, use a stable scale, and avoid per-node expensive filters. Provide a text/table fallback. Performance-test a fixture substantially larger than the three showcase incidents.
- **Roadmap phase:** **5 — Timeline and interaction**.

## 8. SVG timelines

### Pitfall: visual alignment is semantically wrong

- **Warning signs:** Commit markers sit one bucket away from their timestamp; onset line does not intersect the error-rate series; UTC labels round across day boundaries; resize changes positions due to stale dimensions.
- **Prevention/mitigation:** Use one shared epoch-to-x scale for all layers and one documented bucket convention. Keep SVG geometry derived from immutable analysis output, recalculate on resize with `ResizeObserver`, and test known coordinates plus boundary timestamps. Add a visible UTC axis and exact timestamp in focus/tooltip details.
- **Roadmap phase:** **5 — Timeline and interaction**.

### Pitfall: SVG is inaccessible or unusable without hover

- **Warning signs:** Keyboard users cannot reach commit markers; screen readers receive an unlabeled chart; color-only series cannot be distinguished; tooltip content disappears before it can be read; touch has no equivalent interaction.
- **Prevention/mitigation:** Give the chart a title and description, provide a data-table/list alternative, and expose focusable markers with accessible names containing timestamp, rate, and commit. Use patterns/dashes/labels in addition to color, support keyboard focus and click/tap, and ensure focus rings survive SVG styling. Test at 200% zoom and with reduced motion.
- **Roadmap phase:** **6 — Trust, accessibility, and release hardening**, while the semantic fallback is designed in **5**.

## 9. Accessibility and responsive states

### Pitfall: status is conveyed by color, layout, or motion alone

- **Warning signs:** Red/amber/green badges are indistinguishable in grayscale; focus is clipped in cards or modals; mobile users must horizontally scroll the evidence table; loading animation has no status text.
- **Prevention/mitigation:** Pair color with text, icon/shape, and accessible labels. Use semantic headings, landmarks, buttons, live-region updates for analysis completion/errors, visible `:focus-visible`, and reduced-motion behavior. Test keyboard-only navigation, screen-reader names, contrast, 320px width, 200% zoom, and touch target sizes. Design cards to stack rather than shrink unreadably.
- **Roadmap phase:** **4 — Incident-console UI** for states/layout; **6** for audit and fixes.

### Pitfall: copied Markdown is incomplete or misleading

- **Warning signs:** The copy action omits UTC context, score components, source lines, warnings, or the low-confidence explanation; clipboard failure leaves no feedback.
- **Prevention/mitigation:** Generate Markdown from the canonical analysis result, not DOM text. Include input summary, onset, top three, evidence, confidence rationale, warnings, and UTC note. Provide a visible success/failure status and a select-to-copy fallback. Snapshot the output for all three fixtures.
- **Roadmap phase:** **4 — Incident-console UI**.

## 10. Fixture realism

### Pitfall: fixtures teach the algorithm an unrealistically easy lesson

- **Warning signs:** The culprit is always the immediately preceding commit; every error has a perfect frame match; timestamps are all UTC and evenly spaced; ambiguous case is only a tied score manufactured by deleting evidence.
- **Prevention/mitigation:** Make the three fixtures deliberately adversarial but understandable: include deploy-adjacent unrelated commits, pre-existing low-rate errors, multiline causes, mixed timestamp offsets, ramps and spikes, vendor frames, a rename or nonmatching diff, and an ambiguous pair with honest low confidence. Keep fixture provenance documented and assert the expected *reasoning*, not merely the winner.
- **Roadmap phase:** **1 — Foundation and rebuild** for fixture schema/content; **6** for realism review.

### Pitfall: fixtures and tests drift apart

- **Warning signs:** UI snapshots pass while parser tests use different data; changing a fixture silently changes the intended verdict; the demo and unit tests serialize timestamps differently.
- **Prevention/mitigation:** Store fixtures once in a typed, repository-relative location and have demo loading and tests consume the same files. Add a fixture manifest describing expected format, onset class, top-suspect expectation, confidence band, and known caveats. Use canonical JSON/Markdown snapshots and review fixture changes as behavior changes.
- **Roadmap phase:** **1 — Foundation and rebuild**, maintained through **2–4**.

## 11. Offline Docker rebuilds and reproducibility

### Pitfall: “offline” works only on the author’s machine

- **Warning signs:** Docker build fetches unpinned packages, tests call a CDN or remote font, Vite expects network access, a global Node tool is required, or the lockfile is ignored. The app works from a warm cache but fails on a clean Linux host.
- **Prevention/mitigation:** Pin Node 22 in `.nvmrc` and the Docker base image, commit the package-manager lockfile, use `npm ci` (or the selected equivalent), and keep all runtime assets local. Make Docker install system packages explicitly and run the same `make test` command used by CI/rebuild instructions. Verify from a clean checkout with network disabled after dependencies are available; do not claim dependency installation itself is offline unless the image/cache is pre-provisioned.
- **Roadmap phase:** **1 — Foundation and rebuild**, re-run in **6 — Trust, accessibility, and release hardening**.

### Pitfall: machine-specific paths or generated artifacts break determinism

- **Warning signs:** Snapshot output contains `C:\Users\...`, absolute repository roots, locale-specific dates, random IDs, current timestamps, or OS-specific separators. Docker and host builds produce different hashes or test results.
- **Prevention/mitigation:** Keep paths repository-relative and canonicalized to POSIX in the analysis boundary. Inject no current time or randomness into results. Set a stable locale/timezone in tests where formatting is unavoidable, but prefer UTC ISO output. Exclude build output from analysis and validate a clean checkout build twice for identical result artifacts.
- **Roadmap phase:** **1 — Foundation and rebuild** and **2 — Analysis core**.

### Pitfall: README and Dockerfile describe a path that was not actually rebuilt

- **Warning signs:** README says `npm test` while the real command is different; Docker exposes the wrong port; production preview depends on a dev-only global package; a clean build misses fixture files or worker assets.
- **Prevention/mitigation:** Treat setup/run/test/deploy instructions as executable acceptance criteria. Add a single offline-capable `make test` that runs typecheck, unit tests, and build as appropriate. Test the Docker image from a clean checkout, including serving the built app and loading each bundled incident. Keep `.env.example` present even if the MVP has no secrets, and fail clearly if an unexpected environment variable is required.
- **Roadmap phase:** **1 — Foundation and rebuild**, final rehearsal in **6**.

## Buildathon prioritization

If schedule pressure forces cuts, preserve these in order: (1) parser correctness and explicit invalid-input behavior, (2) UTC/onset determinism, (3) evidence-linked ranking with low-confidence honesty, (4) the three realistic fixtures, (5) accessible non-hover timeline fallback, and (6) rebuild verification. Cut decorative animation, deep filtering, and extra input formats before weakening those foundations. A smaller result that a judge can reproduce from the displayed log line, frame, diff range, and frozen score is more valuable than a broader console that only looks convincing.
