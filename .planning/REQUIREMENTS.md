# Requirements: Culprit

**Defined:** 2026-10-19  
**Core Value:** Given a log and recent git history, Culprit must produce a deterministic, evidence-backed shortlist of likely culprit commits quickly enough to guide the next human investigation.

## v1 Requirements

Requirements for the initial release. Each maps to exactly one roadmap phase.

### Input and Analysis

- [ ] **INPUT-01**: User can load a JSON-lines log file through drag-and-drop or a file picker.
- [ ] **INPUT-02**: User can load a plain-text log whose entries use an ISO timestamp and level.
- [ ] **INPUT-03**: User receives a clear, recoverable validation error for empty, malformed, unsupported, or oversized log input.
- [ ] **INPUT-04**: System attaches supported multiline stack traces to their originating error events and reports line-aware diagnostics when attachment fails.
- [ ] **INPUT-05**: User can load one documented git-history export containing commit hash, author, timestamp, message, touched files, and changed line ranges.
- [ ] **INPUT-06**: System normalizes log and commit timestamps to UTC and communicates that assumption in the result.
- [ ] **INPUT-07**: System detects the incident onset and produces a deterministic per-bucket error-rate series for spike, ramp, no-incident, and insufficient-data inputs.
- [ ] **INPUT-08**: System groups error events into normalized signatures by stripping variable numbers, identifiers, and quoted values while preserving first-seen time and count.

### Ranking and Evidence

- [x] **RANK-01**: System scores eligible pre-onset commits using frozen proximity, trace-match, novelty, and churn signals with documented weights.
- [x] **RANK-02**: System returns stable ordering and deterministic tie-breaking for identical inputs, independent of current time, randomness, locale, or machine-specific paths.
- [x] **RANK-03**: User can see a top-three suspect shortlist rather than a single unqualified culprit claim.
- [x] **RANK-04**: User can inspect each suspect’s total suspicion score and each signal’s contribution in plain language.
- [x] **RANK-05**: User can see evidence references for each suspect, including relevant time distance, files/line ranges, matching stack frames, error groups, and churn information when available.
- [x] **RANK-06**: System labels low-confidence, ambiguous, weak-evidence, and no-clear-culprit outcomes explicitly instead of presenting a ranked guess as causal proof.
- [x] **RANK-07**: System excludes or downweights generic/vendor/generated stack frames and handles path/line-range mismatches without crashing or inventing evidence.

### Investigation Experience

- [x] **UX-01**: User can load each of the three bundled incidents in one click: checkout outage, slow-burn failure, and ambiguous case.
- [x] **UX-02**: User sees a verdict card with the leading suspect’s short hash, message, author, time gap, relevant files/lines, matching error count, score, evidence, and confidence.
- [x] **UX-03**: User can explore an accessible timeline showing error rate, incident onset, commit markers, and the highlighted leading suspect on a shared time axis.
- [x] **UX-04**: User can select a timeline spike or error group and inspect the underlying log lines through an equivalent non-hover interaction.
- [x] **UX-05**: User can open a suspect detail drawer showing relevant diff/line evidence and one explanation per ranking signal.
- [x] **UX-06**: User can view error signatures in a table with counts and first-seen times and use a selected signature to filter the timeline.
- [x] **UX-07**: User can copy a deterministic Markdown postmortem containing the verdict, evidence, confidence, UTC note, and relevant caveats, with visible success/fallback feedback.
- [x] **UX-08**: User can understand empty, loading, error, no-incident, low-confidence, and completed states without relying on color alone.
- [x] **UX-09**: User can operate the core result experience with keyboard navigation, visible focus, readable labels, and usable layout at laptop and phone widths.

### Fixtures and Reproducibility

- [ ] **FIX-01**: The three bundled incidents include plausible commit histories, decoys, logs, expected outcomes, and metadata that explain what each case demonstrates.
- [x] **FIX-02**: The known culprit ranks first for the clear checkout case and the intended leading interpretation is stable for the slow-burn and ambiguous cases under automated tests.
- [x] **FIX-03**: Repeating analysis with identical fixture input produces byte-identical structured output and Markdown output.
- [ ] **BUILD-01**: Repository setup pins the Node runtime, commits a dependency lockfile, and keeps dependencies installed only within the project.
- [ ] **BUILD-02**: Docker installs, builds, and runs the project without absolute machine paths or secrets.
- [ ] **BUILD-03**: A single documented offline test command passes on a clean rebuild, including parser, onset, grouping, scoring, determinism, fixture, and key UI-contract tests.
- [ ] **BUILD-04**: README documents setup, run, test, deploy/demo steps, offline/privacy behavior, supported formats, limitations, and the hosted-demo size boundary.
- [ ] **BUILD-05**: The project includes a secret-free `.env.example` and never sends user logs or repository data to a remote service.

### Conditional Polish

- [ ] **POLISH-01**: If all committed analysis, evidence, accessibility, fixture, and rebuild checks are green, the UI may add system-aware dark/light themes without reducing contrast or introducing network dependencies.
- [ ] **POLISH-02**: If all committed checks are green, the UI may add keyboard shortcuts for stepping through suspects and purposeful motion for verdict/timeline/drawer transitions.

## v2 Requirements

Deferred until the focused browser workflow proves its value and the offline MVP is stable.

### Integrations and Operations

- **V2-OPS-01**: User can stream live logs into an active incident.
- **V2-OPS-02**: User can connect Culprit directly to GitHub, Slack, PagerDuty, or another monitoring service.
- **V2-OPS-03**: User can store, share, or revisit analyses through accounts, a database, or cloud storage.

### Analysis Expansion

- **V2-ANALYSIS-01**: User can analyze additional log formats, stack-trace styles, or repository-history schemas.
- **V2-ANALYSIS-02**: User can configure ranking weights or create custom scoring profiles.
- **V2-ANALYSIS-03**: User can compare multiple saved incidents or establish historical baselines.
- **V2-ANALYSIS-04**: User can export a standalone HTML or PDF report.

### Local Tooling

- **V2-CLI-01**: User can run a CLI helper that exports local git history for browser analysis.
- **V2-CLI-02**: User can run the complete analysis from a terminal without opening the web app.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Runtime AI or machine learning diagnosis | Would add nondeterminism, network/key/privacy risk, cost, and unsupported authority to a deliberately explainable heuristic. |
| Auto-fix, rollback, or deployment actions | Culprit narrows investigation; it must not take high-impact corrective action based on suspicion. |
| Whole-repository browser upload | Increases privacy, memory, parsing, and UI scope beyond the documented history-export boundary. |
| Single-cause or probability guarantee | The product must communicate suspicion and uncertainty honestly. |
| Fancy graph visualization | It adds visual complexity without improving the core evidence path and can weaken accessibility. |
| Historical persistence, telemetry, or analytics | Conflicts with the local privacy promise and is not needed to prove the first-pass value. |

## Traceability

Each explicitly listed v1 requirement maps to exactly one roadmap phase.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INPUT-01 | Phase 2 — Deterministic Analysis Core | Mapped |
| INPUT-02 | Phase 2 — Deterministic Analysis Core | Mapped |
| INPUT-03 | Phase 2 — Deterministic Analysis Core | Mapped |
| INPUT-04 | Phase 2 — Deterministic Analysis Core | Mapped |
| INPUT-05 | Phase 2 — Deterministic Analysis Core | Mapped |
| INPUT-06 | Phase 2 — Deterministic Analysis Core | Mapped |
| INPUT-07 | Phase 2 — Deterministic Analysis Core | Mapped |
| INPUT-08 | Phase 2 — Deterministic Analysis Core | Mapped |
| RANK-01 | Phase 3 — Evidence, Ranking, and Trust Model | Complete |
| RANK-02 | Phase 3 — Evidence, Ranking, and Trust Model | Complete |
| RANK-03 | Phase 3 — Evidence, Ranking, and Trust Model | Complete |
| RANK-04 | Phase 3 — Evidence, Ranking, and Trust Model | Complete |
| RANK-05 | Phase 3 — Evidence, Ranking, and Trust Model | Complete |
| RANK-06 | Phase 3 — Evidence, Ranking, and Trust Model | Complete |
| RANK-07 | Phase 3 — Evidence, Ranking, and Trust Model | Complete |
| UX-01 | Phase 4 — Incident Console and Investigation Flow | Complete |
| UX-02 | Phase 4 — Incident Console and Investigation Flow | Complete |
| UX-03 | Phase 4 — Incident Console and Investigation Flow | Complete |
| UX-04 | Phase 4 — Incident Console and Investigation Flow | Complete |
| UX-05 | Phase 4 — Incident Console and Investigation Flow | Complete |
| UX-06 | Phase 4 — Incident Console and Investigation Flow | Complete |
| UX-07 | Phase 4 — Incident Console and Investigation Flow | Complete |
| UX-08 | Phase 4 — Incident Console and Investigation Flow | Complete |
| UX-09 | Phase 4 — Incident Console and Investigation Flow | Complete |
| FIX-01 | Phase 1 — Foundation and Rebuild Surface | Mapped |
| FIX-02 | Phase 3 — Evidence, Ranking, and Trust Model | Complete |
| FIX-03 | Phase 3 — Evidence, Ranking, and Trust Model | Complete |
| BUILD-01 | Phase 1 — Foundation and Rebuild Surface | Mapped |
| BUILD-02 | Phase 1 — Foundation and Rebuild Surface | Mapped |
| BUILD-03 | Phase 1 — Foundation and Rebuild Surface | Mapped |
| BUILD-04 | Phase 1 — Foundation and Rebuild Surface | Mapped |
| BUILD-05 | Phase 1 — Foundation and Rebuild Surface | Mapped |
| POLISH-01 | Phase 5 — Hardening and Conditional Polish | Mapped |
| POLISH-02 | Phase 5 — Hardening and Conditional Polish | Mapped |

**Coverage:**
- Explicitly listed v1 requirements: 34 total
- Mapped to phases: 34
- Unmapped: 0
- Coverage: 100%

---
*Requirements defined: 2026-10-19*  
*Last updated: 2026-10-19 after requirements definition*
