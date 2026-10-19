# Culprit

## What This Is

Culprit is an offline-first incident-analysis web app for developers who need to answer “which commit most likely broke production?” quickly. A user provides an error log and git history; Culprit detects the incident onset, ranks suspect commits with explainable evidence, and presents the result through a focused incident-console UI.

The first milestone is a polished, trustworthy demo for a solo buildathon project. It should feel useful within seconds, work without a server or network, and make the analysis easy for a person to verify rather than pretending to provide certainty.

## Core Value

Given a log and recent git history, Culprit must produce a deterministic, evidence-backed shortlist of likely culprit commits quickly enough to guide the next human investigation.

## Business Context

- **Customer**: Developers, small teams, and on-call engineers investigating a fresh production failure.
- **Revenue model**: None for the buildathon MVP; this is a self-contained product demonstration.
- **Success metric**: A judge can load a bundled incident and understand the leading suspect and its evidence in under ten seconds.
- **Strategy notes**: Buildathon submission; prioritize a small, polished, rebuildable product over breadth.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Parse supported JSON-lines and plain-text logs, including multiline stack traces and clear invalid-input errors.
- [ ] Parse bundled git history and one documented export format into commits, touched files, and changed line ranges.
- [ ] Detect the incident onset and error-rate series deterministically, including spikes, ramps, and no-incident input.
- [ ] Group normalized error signatures and record counts and first-seen times.
- [ ] Rank pre-onset commits using explainable proximity, trace-match, novelty, and churn signals with frozen weights.
- [ ] Show a verdict card and top-three suspect shortlist with scores, evidence, confidence, and relevant commit details.
- [ ] Provide an interactive timeline connecting error rate, onset, commits, and underlying log lines.
- [ ] Provide focused suspect investigation through diff/line evidence and error-group filtering when it improves the core workflow.
- [ ] Let users load the three bundled incidents in one click and copy a concise Markdown postmortem.
- [ ] Deliver intentional empty, loading, error, low-confidence, responsive, and accessible states.
- [ ] Run entirely in the browser with no runtime AI, network dependency, account, database, or remote upload.
- [ ] Rebuild from scratch with pinned Node, a lockfile, Docker, and one offline test command.

### Out of Scope

- Live log streaming — the MVP analyzes a supplied snapshot to keep the experience deterministic and finishable.
- Accounts, databases, cloud storage, and hosted processing — user logs and repositories must stay local.
- Runtime machine learning or AI calls — the ranking must be plain, explainable code.
- More than the two documented log/stack-trace styles — additional formats would dilute the focused MVP.
- Auto-fixing, rollback, or integrations with GitHub, Slack, PagerDuty, or similar services — Culprit narrows investigation but does not take corrective action.
- Uploading an entire repository in the browser — the MVP uses bundled history and a documented export boundary.
- User-configurable ranking weights — fixed weights keep results explainable and tests stable.
- CLI helper in the first roadmap — local git export can be added after the browser workflow is proven.

## Context

- The primary demo user has a log file, a repository history export, and little time after a deploy-related failure.
- The core architecture should separate a pure TypeScript analysis library from a thin web interface so parsing, onset detection, signatures, scoring, and determinism are easy to unit test.
- The intended stack direction is Node 22, TypeScript, Vitest, and Vite; choices remain open until the setup phase confirms the smallest reliable implementation.
- All timestamps must normalize to UTC and the UI must say so. Identical inputs must produce byte-identical outputs with no current-time or random-number dependency.
- Large logs must not freeze the page; parsing should have a documented cap for the hosted demo and use a worker when needed.
- Three fictional fixtures drive both the demo and the tests: checkout outage, slow-burn failure, and ambiguous case.
- “Perfect” means trustworthy analysis first, then trust/accessibility refinements. Secondary features are cut rather than allowed to weaken the rebuild check or core experience.
- The repository must not contain the source PRD as copied product documentation; planning artifacts should capture the distilled project context only.

## Constraints

- **Delivery**: Buildathon deadline is 20 Oct 2026 at 23:59 IST — use incremental checkpoints and keep buffer for rebuild and submission work.
- **Reproducibility**: Keep a pinned Node runtime, lockfile, Dockerfile, `.env.example`, README, and an offline-capable single test command in the repository.
- **Offline execution**: Tests and the demo build must work without network access after dependencies are installed; no runtime calls to external services.
- **Privacy**: Logs and repository data stay in the browser and are never sent anywhere.
- **Determinism**: Analysis output cannot depend on current time, randomness, machine-specific absolute paths, or network state.
- **Scope**: Must-have analysis and verdict behavior takes precedence over “should” and “nice” UI features.
- **Accessibility**: Colour cannot be the only signal, focus must be visible, contrast must pass, and the UI must remain usable at laptop and phone widths.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Vertical MVP structure | An end-to-end slice is the fastest way to prove the product and expose integration risk. | — Pending |
| Three bundled incidents | Clear, gradual, and ambiguous cases demonstrate both usefulness and honesty. | — Pending |
| Defer the CLI helper | The browser demo and pure core deliver the primary value; CLI expansion can follow without risking the deadline. | — Pending |
| Protect trustworthy analysis first | Correctness, evidence, confidence, and deterministic behavior matter more than feature count. | — Pending |
| Add trust/accessibility refinements only after core | These improve the product without adding a second product surface. | — Pending |
| Prefer Node 22 + TypeScript + Vitest + Vite unless setup disproves it | The PRD points to a small, testable, reproducible web stack. | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. “What This Is” still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-10-19 after initialization from the Culprit PRD and project questioning*
