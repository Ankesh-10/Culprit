# Culprit Roadmap

## Project Summary

Culprit is an offline-first, browser-only incident-analysis console. Given a supported log snapshot and a documented git-history export, it detects incident onset, groups errors, and returns a deterministic, evidence-backed shortlist of likely suspect commits. The first milestone optimizes for a polished, trustworthy demo that a judge can understand in under ten seconds while keeping all analysis local, explainable, and reproducible.

**Roadmap shape:** five coarse vertical-MVP phases. The pure TypeScript analysis core is built early, then progressively exposed through the console; every phase ends with an observable, testable slice. The final phase is gated polish and release hardening rather than a substitute for unfinished core behavior.

## Phase 1: Foundation and Rebuild Surface

**Status:** Complete (2026-10-19; PASS WITH LIMITATIONS recorded in `01-VERIFICATION.md`)

**Goal:** Establish a runnable, reproducible project shell and shared fixture contracts so every later vertical slice can be tested and rebuilt.

**Mode:** mvp

**Requirements mapped:** FIX-01, BUILD-01, BUILD-02, BUILD-03, BUILD-04, BUILD-05

**Success criteria:**

- A clean checkout identifies and uses the pinned Node 22 runtime, installs from the committed lockfile, and has no global or machine-specific dependency.
- Vite/strict TypeScript/Vitest scripts, `make test`, Docker build/run instructions, `.env.example`, and README setup/run/test/deploy/privacy instructions exist and agree with the actual project commands.
- Three repository-relative fixture packages exist for checkout outage, slow-burn failure, and ambiguous analysis, each with plausible logs/history, metadata, expected interpretation, and no secrets or absolute paths.
- The canonical structured-result and Markdown serialization contract is defined, with test scaffolding that is independent of locale, current time, randomness, network, and host paths.

**Dependencies:** None.

## Phase 2: Deterministic Analysis Core

**Status:** Complete (2026-10-19; PASS WITH LIMITATIONS recorded in `02-VERIFICATION.md`)

**Plans:**

- [x] 02-01: Strict input contracts and parsers
- [x] 02-02: Signatures, fixed UTC buckets, and onset classification
- [x] 02-03: Pure analyze pipeline and fixture determinism

**Goal:** Turn supported local inputs into a strict, UTC-normalized, deterministic analysis stream with diagnostics, signatures, buckets, and onset classification.

**Mode:** mvp

**Requirements mapped:** INPUT-01, INPUT-02, INPUT-03, INPUT-04, INPUT-05, INPUT-06, INPUT-07, INPUT-08

**Success criteria:**

- JSON-lines and the documented ISO-timestamp plain-text format parse through shared contracts, with empty/malformed/unsupported/oversized input producing recoverable typed errors and line-aware diagnostics.
- Supported multiline stack traces remain attached to their originating events; ambiguous or failed attachment is represented as a diagnostic rather than silently discarded.
- The documented git-history export yields commits, authors, UTC timestamps, messages, touched repository-relative files, and changed line ranges with validation for missing or conflicting records.
- Logs and commits normalize to UTC and stable source identities; repeated analysis produces the same canonical data regardless of machine timezone, locale, current time, or input ordering where the contract permits.
- Signature groups preserve normalized identity, first-seen time, counts, and source references, while the fixed UTC bucket series correctly distinguishes spike, ramp, no-incident, and insufficient-data inputs.

**Dependencies:** Phase 1 fixture and contract surface.

## Phase 3: Evidence, Ranking, and Trust Model

**Plans:** 3/3 plans complete

- [x] 03-01: Evidence primitives and frozen scoring model (evidence.ts, scoring.ts, golden scores)
- [x] 03-02: Ranker, confidence labels, and result-contract integration (ranking.ts, pipeline wiring, bucket guard)
- [x] 03-03: Escaped Markdown export and fixture ranking contracts (markdown.ts, FIX-02/FIX-03, README)

**Goal:** Correlate pre-onset history with error evidence using frozen explainable signals and produce an honest, deterministic top-three interpretation for all bundled incidents.

**Mode:** mvp

**Requirements mapped:** RANK-01, RANK-02, RANK-03, RANK-04, RANK-05, RANK-06, RANK-07, FIX-02, FIX-03

**Success criteria:**

- Eligible pre-onset commits are scored with versioned frozen proximity, trace-match, novelty, and bounded churn weights; every signal exposes its value, contribution, explanation, and evidence references.
- Path separators, repository prefixes, line-range boundaries, generic/vendor/generated frames, missing files, and unmatched evidence are handled without crashes or invented matches.
- Results contain a stable top-three ordering with deterministic tie-breaking, explicit exclusions/weak evidence, and qualitative low-confidence, ambiguous, weak-evidence, or no-clear-culprit outcomes rather than causal certainty.
- Contract tests show the known checkout culprit ranks first, the slow-burn and ambiguous fixtures have their intended stable interpretations, and identical fixture inputs produce byte-identical structured and Markdown outputs.

**Dependencies:** Phase 2 parsed events, signatures, onset, and history model.

## Phase 4: Incident Console and Investigation Flow

**Plans:** 8/8 plans complete

- [x] 04-01: One-click case analysis through the worker boundary (cases.ts, protocol/worker/client, verdict headline, static safety)
- [x] 04-02: Honest page states and the case-file visual system (state.ts, status.ts, case cards and sparklines, tokens, local fonts with fallback)
- [x] 04-03: Evidence-first verdict card and suspect lineup (format.ts, verdict facts, lineup, commits considered)
- [x] 04-04: Linked timeline investigation and log lines (timeline-geometry.ts, investigation-model.ts, slider, table twin)
- [x] 04-05: Error signatures that filter the investigation (signatures.ts, emphasis form, filtered readout and log lines)
- [x] 04-06: The suspect drawer (drawer-model.ts, drawer.ts, openers from verdict, lineup and timeline markers)
- [x] 04-07: Markdown postmortem copy and the trust footer (copy.ts, copy feedback, trust-footer.ts)
- [x] 04-08: Own files, recoverable validation errors, and the end-of-phase walk-through (intake.ts, inputs.ts, human checkpoint)

**Goal:** Make the analysis useful in the browser through one-click case studies, an evidence-first verdict, linked timeline investigation, and recoverable accessible states.

**Mode:** mvp

**Requirements mapped:** UX-01, UX-02, UX-03, UX-04, UX-05, UX-06, UX-07, UX-08, UX-09

**Success criteria:**

- A user can load any of the three bundled incidents in one click, or provide supported file/text inputs, and see explicit empty, loading, validation-error, no-incident, low-confidence, and completed states.
- The verdict card and top-three shortlist show the leading short hash, message, author, UTC/time gap, files/lines, matching error count, score, evidence, and confidence without implying proof.
- An accessible shared-time-axis timeline connects error rates, onset, commits, and the highlighted suspect; selecting a spike or error group reaches equivalent underlying log-line information without hover.
- A suspect detail drawer exposes relevant diff/line evidence and one plain-language explanation per ranking signal, while the error-signature table shows counts/first-seen times and filters the timeline.
- The user can copy deterministic Markdown containing verdict, evidence, confidence, UTC note, and caveats, with visible success/fallback feedback; keyboard navigation, visible focus, readable labels, non-color status cues, and laptop/phone layouts work on the core result path.

**Dependencies:** Phase 3 analysis/result contracts; Phase 1 fixtures. Worker execution and bounded rendering are used where needed to preserve responsiveness.

## Phase 5: Hardening and Conditional Polish

**Plans:** 3/4 plans executed (sequential waves 1-4; one shared working tree)

- [x] 05-01-PLAN.md — Clean Linux-oriented rebuild path: tested `scripts/serve-dist.mjs` Docker server (MIME types, CSP, traversal/malformed-path safety), LF-pinned clean-clone rehearsal, GitHub Actions CI with Docker build and probe
- [x] 05-02-PLAN.md — Near-cap profiling and bounded rendering: deterministic near-cap generator, worker-handler and boundary tests, paged "Commits considered", bounded marker lane, real-browser profile and accessibility sweep
- [x] 05-03-PLAN.md — Three-case clean-start rehearsal: limits line in the Markdown, caveat-visibility and output-fingerprint tests, real-browser rehearsal on the production server, README refresh, host gate verdict (Docker item pending)
- [ ] 05-04-PLAN.md — Gated polish (only with `Host gate: GREEN` plus a recorded PASS Docker build and container probe for the same tree; otherwise omitted): system-aware light theme (POLISH-01) and drawer-scoped J/K suspect stepping with a reduced-motion-gated fade (POLISH-02)

**Goal:** Verify the complete vertical slice on the documented rebuild path, fix trust/accessibility/performance gaps, and only then add optional visual polish behind a green-check gate.

**Mode:** mvp

**Requirements mapped:** POLISH-01, POLISH-02

**Success criteria:**

- The full analysis, evidence, accessibility, fixture, Docker/rebuild, and offline test/build checks are green on a clean Linux-oriented rebuild path before optional polish is enabled.
- Near-cap inputs are profiled; worker usage, bounded log/timeline rendering, responsive layouts, visible focus, contrast, reduced-motion behavior, and non-hover timeline fallback are verified without changing analysis output.
- The three demo cases are rehearsed from a clean start, with warnings, assumptions, UTC provenance, truncation limits, and low-confidence reasoning remaining visible in the console and Markdown output.
- **Gate:** only if all committed checks above pass, system-aware dark/light themes may be added without contrast regressions or network dependencies.
- **Gate:** only if all committed checks above pass, keyboard shortcuts for suspect stepping and purposeful reduced-motion-aware verdict/timeline/drawer transitions may be added without hiding equivalent controls.

**Dependencies:** Phases 1–4 complete and all required checks green. If the gate is not green, ship hardening and omit optional polish.

## Coverage Summary

All 34 explicitly listed v1 requirement IDs are mapped exactly once:

- Phase 1: 6 requirements — FIX-01, BUILD-01 through BUILD-05.
- Phase 2: 8 requirements — INPUT-01 through INPUT-08.
- Phase 3: 9 requirements — RANK-01 through RANK-07, FIX-02, FIX-03.
- Phase 4: 9 requirements — UX-01 through UX-09.
- Phase 5: 2 requirements — POLISH-01, POLISH-02.

**Coverage:** 34/34 listed v1 requirements mapped (100%); 0 unmapped; no v2 or out-of-scope requirements included.

---
*Roadmap created: 2026-10-19*
