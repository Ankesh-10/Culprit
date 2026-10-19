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

- **Phase:** Roadmap creation complete; implementation has not started.
- **Progress:** 0/5 phases complete (0%).
- **Last action:** Created the initial five-phase roadmap and mapped every listed v1 requirement exactly once.

## Decisions

- Use five coarse vertical-MVP phases: foundation/rebuild, analysis core, evidence/ranking, incident console, and hardening/conditional polish.
- Keep the analysis core pure and serializable, with a thin Vite browser shell and worker boundary for larger inputs.
- Treat the three bundled incidents as shared demo/test contracts.
- Preserve deterministic UTC output, frozen explainable ranking, explicit uncertainty, local privacy, and the documented rebuild surface as release gates.
- Keep themes, keyboard shortcuts, and motion behind the final green-check gate; omit them if they threaten core correctness or accessibility.

## Blockers

- No implementation blocker is known. Exact Node/package/Docker patch choices remain setup-phase work.

## Next Action

Begin Phase 1 by creating the pinned Node 22 Vite/TypeScript/Vitest project, fixture manifest, canonical serialization contract, Dockerfile, `.env.example`, README, and offline `make test` command; run the checks before proceeding to Phase 2.

## Handoff Policy

- Work is intentionally split across separate chats and sessions.
- Create or refresh `.planning/HANDOFF.json` and the relevant `.continue-here.md` before ending every session or phase.
- Resume each new chat with `/gsd-resume-work` before starting implementation.
- Complete a phase handoff before moving to the next phase; optional polish must not bypass the handoff or verification gates.

---
*State initialized: 2026-10-19*
