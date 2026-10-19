# Phase 1 Plan 02 Summary

## Outcome

Completed the shared three-fixture contract and repository rebuild surface. The repository now contains realistic slow-burn and ambiguous incident packages, disk-enumerated fixture validation, a lockfile-driven Node 22 multi-stage Docker build, a built-in static runtime on port 4173, a secret-free environment example, an authoritative Makefile test sequence, executable setup/deployment documentation, and source-level rebuild checks.

## Completed work

- Added `slow-burn` and `ambiguous` fixture packages with `manifest.json`, `logs.jsonl`, `history.json`, and `expected.json`.
- Extended fixture tests to enumerate `checkout-outage`, `slow-burn`, and `ambiguous` from disk, validate schema/content/evidence metadata, and reject unsafe paths, secrets, current-time/random placeholders, and host separators in fixture paths.
- Added a two-stage Node `22.20.0-alpine` Dockerfile that installs with `npm ci`, builds `dist`, copies only the static artifact to runtime, serves on `4173`, and reports local health status.
- Added `.dockerignore`, secret-free `.env.example`, and a root `Makefile` whose `test` target runs typecheck, Vitest, and production build in order.
- Added README coverage for local privacy/no-upload behavior, Node setup, development, verification, build/preview, Docker, static deployment/demo, supported formats/history boundary, hosted-demo caps, UTC/determinism, confidence semantics, limitations, and dependency-cache caveats.
- Added rebuild-surface tests covering runtime/lockfile/scripts, Docker stages/port/install, Makefile ordering, documented commands, privacy/secret/path constraints, and Docker-context exclusions.

## Commits

- `ca384bb test: complete incident fixture contracts`
- `ce2a035 build: add reproducible rebuild surface`
- `c771bd7 test: guard repository rebuild contracts`

## Verification

- `npm test -- --run tests/core/fixture-contract.test.ts` passed: 7 tests.
- `npm test -- --run tests/core/rebuild-surface.test.ts` passed: 6 tests.
- Exact Makefile command sequence run manually as `npm run typecheck && npm test && npm run build` passed.
- Full `npm test` passed: 3 files, 15 tests.
- `npm run typecheck` passed.
- `npm run build` passed and produced `dist/index.html`.
- `git diff --check` passed for plan-target files.

## Environment notes

- `make test` could not be invoked on this Windows host because `make` is not installed. Its exact three commands were run in order manually and passed; the Makefile remains the documented Linux/clean-rebuild entry point.
- `docker build --tag culprit:phase1 .` could not be invoked because Docker is not installed/available on this host. Dockerfile structure and contracts are covered by `tests/core/rebuild-surface.test.ts`; the README records the dependency-cache requirement honestly.
- Existing `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/HANDOFF.json`, `.planning/milestone.lock`, `.planning/phases/` artifacts, `.opencode/`, the PRD PDF, `NUL`, and other pre-existing untracked inputs were not staged or modified by this plan. This SUMMARY is intentionally uncommitted per instruction.
