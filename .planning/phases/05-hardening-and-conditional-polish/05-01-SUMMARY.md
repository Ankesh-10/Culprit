---
phase: 05-hardening-and-conditional-polish
plan: 01
subsystem: infra
tags: [docker, node-http, csp, github-actions, gitattributes, smoke-test]

requires:
  - phase: 01-foundation-and-rebuild-surface
    provides: Dockerfile, Makefile, .nvmrc, lockfile and README rebuild surface that this plan hardens
provides:
  - scripts/serve-dist.mjs production static server (MIME map, traversal and malformed-escape refusal, CSP with connect-src none, --smoke self-check)
  - Dockerfile runtime stage that runs the script as USER node
  - .gitattributes pinning LF for every text file
  - .github/workflows/ci.yml Linux rebuild (pinned Node, npm ci, make test, smoke, docker build, container probe)
  - README Docker and Verification sections describing the real server, headers, smoke run and host limits
affects: [05-02, 05-03, 05-04, ship]

actuals:
  tokens: 6854
  tasks: 2
  commits: 3
plan_head_before: 915c8855f44bf28afe92f1d21112f42c7c38333e
plan_head_after: 195ca7cca14a23ee5eb8fcbcf56d415a2c54950c

tech-stack:
  added: []
  patterns:
    - "Pure request resolver (no filesystem) separated from the http server so it can be unit tested without opening a port"
    - "Raw-path smoke probing with node:http request (not fetch) so dot segments and bad escapes reach the server unnormalised"

key-files:
  created:
    - scripts/serve-dist.mjs
    - scripts/serve-dist.d.mts
    - tests/core/serve-dist.test.ts
    - .gitattributes
    - .github/workflows/ci.yml
  modified:
    - Dockerfile
    - tests/core/rebuild-surface.test.ts
    - README.md

key-decisions:
  - "Docker runtime serves dist/ through a tested script instead of an inline node -e server: the old one sent index.html with a binary content type (browser download) and crashed on a malformed percent-escape"
  - "Every response carries default-src 'none' and connect-src 'none' CSP, nosniff and no-referrer so the served page cannot open a network connection"
  - "Pin LF with * text=auto eol=lf so clean clones are byte-identical across platforms"
  - "Docker image proof is delegated to the CI run; no Docker evidence file is fabricated from this host"

patterns-established:
  - "Smoke mode in the shipped server script gives one command that proves the build output is servable"

requirements-completed: []

coverage:
  - id: D1
    description: "Production static server resolves paths purely, maps content types, refuses traversal and malformed escapes with 400, serves GET/HEAD only, and sends the CSP/nosniff/no-referrer headers"
    verification:
      - kind: unit
        ref: "tests/core/serve-dist.test.ts"
        status: pass
      - kind: integration
        ref: "npm run build && node scripts/serve-dist.mjs --smoke"
        status: pass
    human_judgment: false
  - id: D2
    description: "Dockerfile runtime stage runs scripts/serve-dist.mjs as USER node and rebuild-surface contract tests pin it"
    verification:
      - kind: unit
        ref: "tests/core/rebuild-surface.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "LF-pinned clean clone installs offline and passes typecheck, tests, build and smoke on this host"
    verification:
      - kind: integration
        ref: "clean-clone rehearsal command from 05-01-PLAN Task 2 verify"
        status: pass
    human_judgment: false
  - id: D4
    description: "Linux CI workflow builds and probes the Docker image; the image itself has never been built on this host"
    verification:
      - kind: unit
        ref: "tests/core/rebuild-surface.test.ts#pins LF line endings and commits a Linux CI rebuild with the pinned Node"
        status: pass
    human_judgment: true
    rationale: "No Docker, make, gh or WSL on this host; the ci run on GitHub (or a Docker host) is the only evidence the image builds and serves the demo."

duration: 6min
completed: 2026-10-20
status: complete
---

# Phase 5 Plan 01: A clean, Linux-oriented rebuild path that actually serves the demo Summary

**Docker runtime now serves the demo through a unit-tested Node static server (correct MIME types, traversal and malformed-escape refusal, network-forbidding CSP, built-in `--smoke` check), with an LF-pinned clean-clone rehearsal and a Linux CI workflow that builds and probes the image.**

## Performance

- **Duration:** about 6 min
- **Completed:** 2026-10-20T12:21Z
- **Tasks:** 2 (Task 1 tracer, Task 2 auto)
- **Files modified:** 8 (5 created, 3 modified)

## Accomplishments

- Replaced the inline Docker `node -e` server (HTML sent as a binary download; `decodeURIComponent` crash on `/%E0%A4%A`) with `scripts/serve-dist.mjs`, run as `USER node`.
- Every response carries `Content-Security-Policy` (`default-src 'none'`, `connect-src 'none'`, self-only script/worker/style), `X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer`.
- `node scripts/serve-dist.mjs --smoke` probes the real `dist/` over loopback with raw requests and ends with `SMOKE PASS`.
- `.gitattributes` makes every clone LF; `git ls-files --eol` in a fresh clone shows 199 `w/lf`, 1 `w/-text` (the PDF) and no `w/crlf`.
- `.github/workflows/ci.yml` rebuilds on `ubuntu-24.04` with the `.nvmrc` Node, builds the image, probes the container for `200 text/html; charset=utf-8`, and runs the smoke check inside the image.
- README Docker and Verification sections describe all of the above and state that Docker and make were not available on the development host.

## Task Commits

1. **Task 1: Tracer, production static server end to end** - `81a0e5b` (feat)
2. **Task 2: LF pin, CI workflow, README** - `08e8c7e` (chore, `.gitattributes` committed first so the clone rehearsal sees it) and `195ca7c` (ci)

**Plan metadata:** committed separately after this file (docs: complete plan).

Tracer gate: the tracer `<verify>` carries only `<automated>` commands and `human_verify_mode` is `end-of-phase`, so it was re-run (unit tests, `npm run build && node scripts/serve-dist.mjs --smoke`, full `npm test`): all green, expansion continued.

## Files Created/Modified

- `scripts/serve-dist.mjs` - `contentTypeFor`, `resolveStaticRequest`, `SECURITY_HEADERS`, `createStaticServer`, `runSmoke`; flags `--host`, `--port`, `--smoke`
- `scripts/serve-dist.d.mts` - strict-mode type declarations for the five exports
- `tests/core/serve-dist.test.ts` - 36 offline tests of the pure resolver, MIME map and headers (no server started)
- `Dockerfile` - runtime copies the script, `USER node`, exec-form `CMD ["node", "scripts/serve-dist.mjs"]`; HEALTHCHECK, EXPOSE and dist copy unchanged
- `tests/core/rebuild-surface.test.ts` - Docker CMD/script/USER expectations, script added to the host-path/URL/secret scan, new `.gitattributes` + workflow test
- `.gitattributes`, `.github/workflows/ci.yml` - new
- `README.md` - Docker and Verification sections only (Limitations and console sections untouched)

## Gate evidence

| Check | Result |
|-------|--------|
| `npm run typecheck && npm test && npm run build` in the working tree | PASS: 35 test files, 596 tests; build emitted `index.html`, `assets/index-lg7r6t11.js`, `assets/index-L2vJhBjQ.css`, `assets/analyze.worker-BH5YM-EM.js` |
| `node scripts/serve-dist.mjs --smoke` after build | PASS: 20 PASS lines, last line `SMOKE PASS`, exit 0 |
| Clean-clone rehearsal (fresh `git clone`, `npm ci --offline --no-audit --no-fund`, typecheck, test, build, smoke) | PASS: no `w/crlf` entries; 35 test files, 596 tests; same 4 build output files; last line `SMOKE PASS`; host Node v24.14.1 / npm 11.11.0 produced the expected `EBADENGINE` warning (required 22.x); temporary clone deleted |
| Docker image | PENDING - not runnable on this host; recorded in 05-DOCKER-EVIDENCE.md from the ci run of the pushed hardening commit or a Docker-host check (required by the Plan 05-04 Task 1 precondition). 05-DOCKER-EVIDENCE.md was deliberately not created here. |

## Re-verification of Phase 1 requirements (reverifies, not completed here)

BUILD-01 to BUILD-05 are owned by Phase 1; their checkboxes and traceability Status are untouched.

- BUILD-01 (pinned reproducible install): clean clone `npm ci --offline` from the lockfile succeeded; rebuild-surface test pins `.nvmrc`, `engines`, lockfile.
- BUILD-02 (Docker rebuild path): Dockerfile contract tests green and the server it runs passes the smoke run on the host build; the image build itself is PENDING the CI run (see Docker image row).
- BUILD-03 (single offline test command): the clone ran typecheck, test and build offline; the CI workflow runs `make test` on Linux (not yet observed).
- BUILD-04 (README documents the rebuild surface): README Docker and Verification sections updated and pinned by the rebuild-surface test.
- BUILD-05 (no network/privacy): CSP `connect-src 'none'` on every response, asserted by unit test and smoke run; server logs nothing and the script/workflow make no outbound requests other than loopback probes.

## Decisions Made

- Used `SECURITY_HEADERS` as a frozen constant merged under per-response headers so error responses cannot omit the CSP.
- Fallback to `index.html` only for extensionless paths; a missing asset is a real 404 so a stale script URL never receives HTML.
- `decodeURIComponent` failure, backslash, NUL and decoded `..` segments all map to 400 before any filesystem access, and the resolved path is re-checked to stay inside `dist/`.

## Deviations from Plan

None to the deliverables - plan executed as written. Process notes:

- The Task 1 test file was written before the implementation, but the RED run (import failure) was not executed separately before writing the script.
- The `git.base-branch --is-protected` probe reports `master` as protected. Commits were made on `master` because the orchestrator dispatched this plan as a sequential executor on the main working tree, `branching_strategy` is `none`, and every earlier phase commit lives on `master`. No `git update-ref` or history rewrite was used.
- Local working-tree files that were already CRLF stay CRLF on this host (index is LF); git prints CRLF/LF warnings on add. Not a content change.

**Total deviations:** 0 auto-fixed. **Impact:** none.

## Issues Encountered

- A first attempt to edit the Dockerfile through an inline Python/node script hung and changed nothing; the file was rewritten with the Write tool instead.

## Known Stubs

None.

## Threat Flags

None beyond the plan's threat register (T-05-01 to T-05-05 mitigated in `scripts/serve-dist.mjs` and the Dockerfile; T-05-06 accepted).

## Human-check for end-of-phase UAT (non-blocking here)

- Push `master` and open the GitHub Actions run for the pushed commit: expect `ci` green including `make test`, both smoke steps, `docker build` and the container probe. Or on a Docker host: `docker build --tag culprit:phase1 .`, `docker run --rm --publish 4173:4173 culprit:phase1`, then open http://localhost:4173/ and http://localhost:4173/#/app; expect the landing page to render (not download), the console to open and the checkout case to show 2222222. Record the run URL or id and the commit sha in `05-DOCKER-EVIDENCE.md` before any Plan 05-04 polish.
- Nothing has been pushed from this plan; push `master` right after this plan so a Linux failure surfaces early (cut-line guidance).

## Next Phase Readiness

Ready for 05-02. The Docker half of the Phase 5 polish gate stays unproven until the CI run or a Docker-host check is recorded.

## Self-Check: PASSED

Created files exist (`scripts/serve-dist.mjs`, `scripts/serve-dist.d.mts`, `tests/core/serve-dist.test.ts`, `.gitattributes`, `.github/workflows/ci.yml`); commits `81a0e5b`, `08e8c7e`, `195ca7c` are on `master`; acceptance criteria re-checked via the gate evidence runs above.

---
*Phase: 05-hardening-and-conditional-polish*
*Completed: 2026-10-20*
