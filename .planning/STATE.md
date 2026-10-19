---
gsd_state_version: "1.0"
status: phase_complete
stopped_at: Completed 04-01-PLAN.md
last_updated: "2026-10-19T16:55:44.650Z"
state_head: 8a7d15bd9fccba63267d1c4c4b84ce953ce7d6cb
progress:
  total_phases: 5
  completed_phases: 3
  total_plans: 16
  completed_plans: 9
  percent: 56
current_phase: 3
current_phase_name: Evidence, Ranking, and Trust Model
---

# Culprit State

## Current Project Reference

- **Project:** Culprit
- **Core value:** Produce a deterministic, evidence-backed shortlist of likely culprit commits from a supplied log and recent git history.
- **Milestone:** Initial offline-first browser MVP
- **Roadmap:** `.planning/ROADMAP.md`
- **Requirements:** `.planning/REQUIREMENTS.md`
- **Mode:** Vertical MVP
- **Granularity:** Coarse

## Current Position

- **Phase:** Phase 3 complete and verified; ready to plan Phase 4.
- **Progress:** 2/5 phases complete (40%).
- **Last action:** Completed the deterministic analysis core, including parsers, signatures, UTC buckets, onset classification, and the pure analysis pipeline.

## Decisions

- Use five coarse vertical-MVP phases: foundation/rebuild, analysis core, evidence/ranking, incident console, and hardening/conditional polish.
- Keep the analysis core pure and serializable, with a thin Vite browser shell and worker boundary for larger inputs.
- Treat the three bundled incidents as shared demo/test contracts.
- Preserve deterministic UTC output, frozen explainable ranking, explicit uncertainty, local privacy, and the documented rebuild surface as release gates.
- Keep themes, keyboard shortcuts, and motion behind the final green-check gate; omit them if they threaten core correctness or accessibility.
- [Phase 03]: 03-01: No same-directory or basename-only trace credit; ambiguous suffix matches earn zero and are surfaced as evidence
- [Phase 03]: 03-01: Scoring uses only + - * /, floor/round/min/max and halving loops; churn ignores build-output files; scoring-v1 weights frozen at 0.35/0.30/0.25/0.10
- [Phase 04]: 04-01: client and worker share handleAnalyzeRequest so worker and main-thread fallback results are identical by construction
- [Phase 04]: 04-01: static-safety test scans raw src/ and index.html text (comments included) for HTML sinks, network/storage APIs, URLs and dependencies

## Blockers

- No implementation blocker is known. Exact Node/package/Docker patch choices remain setup-phase work.

## Next Action

Plan Phase 3: implement explainable pre-onset commit ranking, evidence correlation, confidence outcomes, and deterministic top-three suspect results.

## Handoff Policy

- Work is intentionally split across separate chats and sessions.
- Create or refresh `.planning/HANDOFF.json` and the relevant `.continue-here.md` before ending every session or phase.
- Resume each new chat with `/gsd-resume-work` before starting implementation.
- Complete a phase handoff before moving to the next phase; optional polish must not bypass the handoff or verification gates.

## Session Continuity

**Last session:** 2026-10-19T16:55:44.424Z
**Stopped at:** Completed 04-01-PLAN.md
**Resume file:** None

- **Last session:** 2026-10-19 — Phase 2 implementation and verification completed.
- **Stopped at:** Phase 2 is complete with documented limitations; Phase 3 planning is next.
- **Resume file:** `.planning/phases/02-deterministic-analysis-core/02-VERIFICATION.md` records verification evidence and follow-up debt.
- **Next:** Plan Phase 3.

---
*State initialized: 2026-10-19*

## Performance Metrics

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 03 P01 | 8 min | 3 tasks | 6 files |
| Phase 03 P02 | 8 min | 3 tasks | 10 files |
| Phase 04 P01 | 5 min | 2 tasks | 13 files |
