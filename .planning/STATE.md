---
gsd_state_version: "1.0"
status: unknown
stopped_at: Phase 1 complete, ready to plan Phase 2
last_updated: "2026-10-19T08:00:41.862Z"
state_head: c771bd77a89305d5ef42ee8fd8cc67ddc75795a3
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 2
  completed_plans: 2
  percent: 20
current_phase: 2
current_phase_name: Deterministic Analysis Core
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

- **Phase:** Phase 2 complete; ready to plan Phase 3.
- **Progress:** 2/5 phases complete (40%).
- **Last action:** Completed the deterministic analysis core, including parsers, signatures, UTC buckets, onset classification, and the pure analysis pipeline.

## Decisions

- Use five coarse vertical-MVP phases: foundation/rebuild, analysis core, evidence/ranking, incident console, and hardening/conditional polish.
- Keep the analysis core pure and serializable, with a thin Vite browser shell and worker boundary for larger inputs.
- Treat the three bundled incidents as shared demo/test contracts.
- Preserve deterministic UTC output, frozen explainable ranking, explicit uncertainty, local privacy, and the documented rebuild surface as release gates.
- Keep themes, keyboard shortcuts, and motion behind the final green-check gate; omit them if they threaten core correctness or accessibility.

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

**Last session:** 2026-10-19T10:59:27.557Z
**Stopped at:** Phase 02 complete, ready to plan Phase 3
**Resume file:** .planning/phases/02-deterministic-analysis-core/02-VERIFICATION.md

- **Last session:** 2026-10-19 — Phase 2 implementation and verification completed.
- **Stopped at:** Phase 2 is complete with documented limitations; Phase 3 planning is next.
- **Resume file:** `.planning/phases/02-deterministic-analysis-core/02-VERIFICATION.md` records verification evidence and follow-up debt.
- **Next:** Plan Phase 3.

---
*State initialized: 2026-10-19*
