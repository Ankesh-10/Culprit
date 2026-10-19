---
phase: 01-foundation-and-rebuild-surface
verified: 2026-10-19
status: passed
verdict: PASS_WITH_LIMITATIONS
requirements: [FIX-01, BUILD-01, BUILD-02, BUILD-03, BUILD-04, BUILD-05]
---

# Phase 1 Verification

## Verdict

**PASS WITH LIMITATIONS.** The implemented Phase 1 repository contracts pass all checks that can run with the available Node/npm toolchain. Docker build/run and the literal `make test` entry point could not be executed because this Windows host has neither `docker` nor `make` available. Those are verification limitations, not observed product-code failures.

## Roadmap and requirement evidence

| Requirement | Result | Evidence |
|---|---|---|
| FIX-01 | PASS | `tests/core/fixture-contract.test.ts` enumerates exactly `checkout-outage`, `slow-burn`, and `ambiguous`; each has `manifest.json`, `logs.jsonl`, `history.json`, and `expected.json`. The suite validates metadata, plausible 40-character commit histories, decoys, multiline stacks, timestamp offsets, POSIX repository paths, evidence/caveat metadata, and forbidden-value patterns. Full suite result: 7 fixture-contract tests passed. |
| BUILD-01 | PASS (host-version limitation) | `.nvmrc` pins `22.20.0`; `package.json` declares `engines.node: 22.x`; `package-lock.json` is tracked with lockfile version 3; package scripts use project-local npm tooling and no global install. Sequential `npm ci --offline --ignore-scripts` completed successfully and left the lockfile unchanged. Host is Node `v24.14.1`, so npm emitted the expected `EBADENGINE` warning; the pinned Node 22 runtime itself was not available on this host. |
| BUILD-02 | UNVERIFIED ON THIS HOST | `tests/core/rebuild-surface.test.ts` validates both Node 22 Docker stages, lockfile-driven `npm ci`, production build, `dist` copy, port `4173`, health check, and absence of global installs. The requested `docker build --tag culprit:phase1 .` could not run: the `docker` executable is unavailable. No runtime Docker result is claimed. |
| BUILD-03 | PASS FOR PHASE-1 SCOPE; ENTRY-POINT LIMITATION | `npm test` passed 3 files / 15 tests; `npm run typecheck` passed; `npm run build` passed and produced `dist/index.html`. The Makefile contains the required order (`npm run typecheck`, `npm test`, `npm run build`), but literal `make test` could not run because `make` is unavailable. Parser/onset/grouping/scoring tests are intentionally deferred to Phases 2–3; Phase 1 covers serialization, fixture, and rebuild-surface scaffolding. |
| BUILD-04 | PASS | `README.md` documents pinned Node setup, `npm ci`, development, `make test`, build/preview, Docker build/run on `4173`, static deployment/demo, privacy/no-upload behavior, supported JSONL/plain-text/history formats, the 1 MiB/10,000-event/100-stack-line cap, UTC and byte-identical determinism, confidence semantics, limitations, and dependency-cache caveats. The rebuild-surface suite's 6 tests passed. |
| BUILD-05 | PASS | `.env.example` states that no secret is required and that logs/history remain in-browser. Source-level checks cover the privacy boundary, secret patterns, and non-local endpoints; repository scans found no secrets or host absolute paths. The only URL in product build configuration is the Docker health check against `127.0.0.1`; README uses localhost for local instructions. |

## Requested checks

| Check | Result | Exact evidence / limitation |
|---|---|---|
| `npm test` | PASS | Vitest: 3 test files, 15 tests passed. |
| `npm run typecheck` | PASS | `tsc --noEmit` exited 0. |
| `npm run build` | PASS | Vite build exited 0; emitted `dist/index.html` and assets. |
| `git diff --check` | PASS | No whitespace errors; product files are clean. Existing planning-only worktree changes were not modified. |
| `make test` | NOT RUN | `make: unavailable` on this host. The exact three commands were run sequentially and passed. |
| `docker build --tag culprit:phase1 .` | NOT RUN | `docker: unavailable` on this host. Dockerfile source contracts passed; actual image build remains to be run on a host with Docker. |
| `npm ci --offline --ignore-scripts` | PASS | Completed sequentially from the committed lockfile; lockfile remained unchanged. npm warned only that the host Node 24 version is outside the declared Node 22 engine. |
| Timezone repeatability | PASS | Full 15-test suite passed with `TZ=UTC` and `TZ=America/New_York`; serialization tests assert UTC `Z` normalization and no absolute paths. |

## Deterministic serialization review

- `src/core/model.ts` defines schema, analysis, and scoring versions plus provenance, limits, warnings, assumptions, diagnostics, onset, errors, timeline, suspects, confidence, and tie-break fields.
- `src/core/serialization.ts` explicitly constructs the canonical object, normalizes timestamp offsets to UTC ISO `Z`, normalizes evidence/frame paths to repository-relative POSIX paths, sorts documented collections, rejects non-finite numbers, uses `null` for optional fields, and excludes generation time/randomness/UI state/network data.
- `serializeMarkdown` canonicalizes first, uses fixed section order, derives content only from the structured result, includes UTC/provenance/evidence/confidence/caveat/diagnostic sections, and ends with exactly one newline.
- `tests/core/serialization.test.ts` passed both repeatability/normalization tests; the three fixture repeatability tests also passed.

## Limitations and follow-up

1. Actual Docker build/run evidence is pending a host with Docker installed.
2. Literal `make test` evidence is pending a host with GNU Make (or equivalent) installed.
3. The host used Node 24 rather than the pinned Node 22.20.0; npm, typecheck, tests, and build passed with the expected engine warning.
4. `.planning/STATE.md` still describes implementation as not started and reports 0 completed phases, which is stale relative to the implementation commits and this verification. It was not changed because planning-state updates are outside this verification and internal planning documents must not be committed here.
5. Parser, onset, grouping, ranking, and browser investigation behavior are later-phase scope; this artifact verifies only Phase 1's fixture/rebuild/serialization surface.
