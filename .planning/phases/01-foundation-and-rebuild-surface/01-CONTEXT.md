# Phase 1: Foundation and Rebuild Surface - Context

**Gathered:** 2026-10-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish Culprit's runnable, reproducible repository shell; create the shared incident-fixture packages; define deterministic structured-result and Markdown serialization contracts; and document the Docker, README, environment, and offline test surface that later phases must use.

</domain>

<decisions>
## Implementation Decisions

### Repository shell
- **D-01:** Use one root npm package rather than a workspace or monorepo.
- **D-02:** Pin an exact Node 22 LTS patch in `.nvmrc`, declare `engines.node: "22.x"`, use npm, and commit `package-lock.json`.
- **D-03:** Use strict TypeScript, Vite, Vitest, and native DOM/CSS initially; do not add a UI framework, charting library, date library, parser generator, or state library without a measured later requirement.
- **D-04:** Establish scripts for `dev`, `typecheck`, `test`, `build`, and `preview`. `make test` is the authoritative non-watch command and runs typecheck, Vitest, and the production build.

### Fixture packages
- **D-05:** Store the three shared incidents under `fixtures/incidents/<id>/`, with stable IDs for `checkout-outage`, `slow-burn`, and `ambiguous`.
- **D-06:** Each fixture package includes `manifest.json`, `logs.jsonl`, `history.json`, and expected interpretation data. Tests and future browser quick-load behavior consume these same repository files rather than duplicated TypeScript constants.
- **D-07:** Fixture manifests record purpose, input/history formats, expected onset class or window, expected confidence/interpretation, required evidence, caveats, and a schema version.
- **D-08:** Fixture histories use one self-describing JSON export format with commit metadata, touched repository-relative POSIX paths, and changed line ranges. Arbitrary `git log` parsing is deferred.
- **D-09:** Fixtures must contain realistic decoys, timestamp offsets, multiline traces, vendor/generated or nonmatching frames where relevant, and an honestly ambiguous case. They contain no secrets, absolute paths, random IDs, current-time values, or host-specific separators.

### Canonical serialization
- **D-10:** Define a versioned canonical result contract with explicit schema and analysis/scoring versions before implementing the analysis algorithm.
- **D-11:** Canonical JSON uses explicit object construction and documented array ordering; timestamps are UTC ISO 8601 with `Z`; paths are repository-relative POSIX paths; optional fields follow one consistent omission-or-`null` policy; and numeric formatting is stable.
- **D-12:** Canonical output includes provenance, limits, warnings, assumptions, diagnostics, confidence rationale, evidence references, and deterministic tie-break results. It must not include current time, randomness, locale output, absolute paths, UI selection state, network data, or machine-specific values.
- **D-13:** Provide `serializeCanonicalJson(result)` and `serializeMarkdown(result)` at the pure-core boundary. Markdown is generated only from the structured result, has fixed section order, ends with a newline, and includes verdict, onset, top suspects, evidence, confidence/caveats, provenance, UTC disclosure, and warnings/diagnostics.

### Rebuild and Docker surface
- **D-14:** Use a multi-stage Node 22 Docker build that installs from the committed lockfile, builds the static `dist` artifact, and serves it on one documented port without global installs or secrets.
- **D-15:** Keep runtime and tests network-free after dependencies are installed. Documentation must distinguish reproducible `npm ci`/Docker behavior from an empty-cache, fully offline dependency install claim.
- **D-16:** README is executable documentation covering purpose, privacy/no-upload boundary, Node setup, `npm ci`, development, `make test`, build/preview, Docker, static deployment/demo, supported formats, input caps, UTC/determinism assumptions, confidence semantics, and limitations. `.env.example` is present and states that no secret is required for the MVP.

### Claude's Discretion
- Exact Node 22 patch, package versions, exact result field names, exact fixture prose, exact Docker runtime server, exact documented port, and whether expected outputs are checked as files or generated snapshots, provided the decisions above and roadmap requirements remain true.
- Exact pure-core module/file decomposition and test organization.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product and phase scope
- `.planning/PROJECT.md` — product intent, constraints, privacy/determinism rules, and scope boundaries.
- `.planning/REQUIREMENTS.md` — v1 requirements and phase traceability, especially FIX-01 and BUILD-01 through BUILD-05.
- `.planning/ROADMAP.md` — Phase 1 goal, success criteria, and dependency boundary.
- `.planning/STATE.md` — current project position and handoff policy.

### Research and architecture
- `.planning/research/SUMMARY.md` — implementation order, risks, and rebuild implications.
- `.planning/research/STACK.md` — recommended Node/Vite/TypeScript/Vitest stack and dependency policy.
- `.planning/research/ARCHITECTURE.md` — core/UI boundary, fixtures, worker seam, and canonical contracts.
- `.planning/research/PITFALLS.md` — reproducibility, fixture, serialization, and Docker hazards.
- `.planning/research/FEATURES.md` — Phase 1 cut line and acceptance expectations.

### External specifications
- No external specs or ADRs — requirements and decisions are fully captured in the references above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- No application source exists yet. The repository currently contains planning artifacts and unrelated untracked inputs only.

### Established Patterns
- Planning already establishes a pure, deterministic, serializable core boundary and a thin browser shell as the intended architecture.

### Integration Points
- New repository shell, source, fixtures, tests, Dockerfile, Makefile, README, and `.env.example` will be created at repository root. Later phases consume the fixture and serialization contracts established here.

</code_context>

<specifics>
## Specific Ideas

- The demo should be a polished, trustworthy browser experience that a judge can understand in under ten seconds, but Phase 1 should prioritize rebuildability and contract stability over visual polish.
- The three fixtures are shared demo/test contracts, not disposable test-only samples.
- The output contract must support byte-identical structured and Markdown results across timezones, operating systems, locales, and repeated runs.

</specifics>

<deferred>
## Deferred Ideas

- CLI history exporter and arbitrary `git log` parsing — later tooling/analysis scope.
- Additional log/history formats — later analysis scope.
- React/Vue or other UI frameworks; chart/date/parser/state dependencies — only if later evidence requires them.
- Browser automation, themes, keyboard shortcuts, animation, advanced filtering, integrations, accounts, persistence, telemetry, and standalone PDF/HTML reports — later phases or out of scope.

</deferred>

---

*Phase: 1-Foundation and Rebuild Surface*
*Context gathered: 2026-10-19*
