---
last_mapped_commit: 89ce56e1d2666fb2512c9de922ee03b463449d90
last_mapped_at: 2026-10-19
---
# Codebase Structure

**Analysis Date:** 2026-10-19

## Directory Layout

```
Culprit/
├── .claude/                 # Project instructions (CLAUDE.md); not shipped
├── .planning/               # GSD planning artifacts (PROJECT, ROADMAP, phases, research, codebase maps)
│   ├── codebase/            # Codebase map documents (this file lives here)
│   ├── phases/              # Per-phase PLAN, SUMMARY, CONTEXT, VERIFICATION, UAT files
│   └── research/            # Stack, architecture, features, pitfalls research
├── fixtures/
│   └── incidents/           # Three bundled incident packages (shared demo and test contract)
│       ├── checkout-outage/
│       ├── slow-burn/
│       └── ambiguous/
├── src/
│   ├── core/                # Pure, DOM-free analysis core (implemented)
│   ├── main.ts              # Browser entry (status shell only)
│   └── styles.css           # Global stylesheet
├── tests/
│   └── core/                # Vitest suites for src/core and the rebuild surface
├── index.html               # Vite HTML entry
├── vite.config.ts           # Vite build config (sourcemap off, es2022 target)
├── tsconfig.json            # App type-check config (src, tests, vite.config.ts)
├── tsconfig.node.json       # Type-check config for vite.config.ts
├── package.json             # Scripts and pinned devDependencies
├── package-lock.json        # Committed lockfile for `npm ci`
├── .nvmrc                   # Pins Node 22.20.0
├── Dockerfile               # Multi-stage build; static server on port 4173
├── .dockerignore            # Excludes tests, planning, docs, and source artifacts from the image
├── .env.example             # Documents that no secrets are required
├── Makefile                 # `make test` = typecheck + vitest + build
├── commit-phase1.sh         # One-off phase-1 commit helper (excluded from Docker context)
└── README.md                # Setup, run, test, deploy, privacy
```

Ignored or generated (not in the repository): `node_modules/`, `dist/`, `coverage/`, `*.tsbuildinfo` (see `.gitignore`).

## Directory Purposes

**`src/core/`:**
- Purpose: Pure TypeScript analysis: parsing, normalization, grouping, bucketing, onset, pipeline, result contract, serialization.
- Contains: One module per concern. `model.ts` is the shared type file.
- Key files:
  - `src/core/pipeline.ts`: `analyze()` and `toAnalysisResult()`
  - `src/core/model.ts`: all public and internal types and version constants
  - `src/core/log-parser.ts`: JSON-lines and plain-text log parsing (`parseLog`)
  - `src/core/history-parser.ts`: `culprit-json` history export parsing
  - `src/core/input-errors.ts`: error classes and `ParseOutcome`
  - `src/core/normalization.ts`: timestamp, whitespace, path, and stable-ID helpers
  - `src/core/signatures.ts`: error signature normalization and grouping
  - `src/core/buckets.ts`: UTC bucket construction
  - `src/core/onset.ts`: onset classifier and threshold constants
  - `src/core/serialization.ts`: canonical JSON and Markdown output

**`src/` (top level):**
- Purpose: Browser shell.
- Contains: `main.ts` (sets `#status-copy` text), `styles.css` (global CSS, imported from `main.ts`).
- Key files: `src/main.ts`, `src/styles.css`

**`tests/core/`:**
- Purpose: Vitest suites. Each core module has a matching `*.test.ts`.
- Contains: 12 test files.
- Key files:
  - `tests/core/fixture-contract.test.ts` (314 lines; fixture manifest contract)
  - `tests/core/analysis-fixture.test.ts` (runs `analyze` on each fixture)
  - `tests/core/determinism.test.ts` (same input gives byte-equal output)
  - `tests/core/rebuild-surface.test.ts` (asserts `.nvmrc`, `package.json` scripts, and lockfile shape)
  - `tests/core/pipeline.test.ts`

**`fixtures/incidents/<id>/`:**
- Purpose: Self-contained incident packages used by both tests and the demo.
- Contains per fixture: `logs.jsonl`, `history.json`, `expected.json`, `manifest.json`.
- Key files: `fixtures/incidents/checkout-outage/manifest.json` (fixture metadata), `fixtures/incidents/slow-burn/expected.json`, `fixtures/incidents/ambiguous/expected.json`.

**`.planning/`:**
- Purpose: GSD workflow state. Not part of the runtime and excluded from Docker (`.dockerignore`).
- Key files: `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/config.json`.

**`.planning/phases/`:**
- Purpose: One directory per phase, numbered `NN-slug`. Each holds `NN-CONTEXT.md`, `NN-NN-PLAN.md`, `NN-NN-SUMMARY.md`, `NN-VERIFICATION.md`, and `NN-UAT.md`.
- Existing: `01-foundation-and-rebuild-surface/`, `02-deterministic-analysis-core/`.

## Key File Locations

**Entry Points:**
- `index.html`: HTML shell that loads `/src/main.ts`
- `src/main.ts`: browser module entry
- `src/core/pipeline.ts`: core API entry (`analyze`)

**Configuration:**
- `package.json`: scripts (`dev`, `typecheck`, `test`, `build`, `preview`) and dev dependencies
- `tsconfig.json`: strict TypeScript, `moduleResolution: Bundler`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`
- `tsconfig.node.json`: type-check config scoped to `vite.config.ts` (composite)
- `vite.config.ts`: build options
- `.nvmrc`: `22.20.0`
- `.env.example`: placeholder documenting no required secrets

**Core Logic:**
- `src/core/`: all analysis logic (see Directory Purposes)

**Testing:**
- `tests/core/`: all tests
- `Makefile`: `make test` target
- `fixtures/incidents/`: shared test data

**Build and Deploy:**
- `Dockerfile`: multi-stage build and static runtime
- `.dockerignore`: image context exclusions

## Naming Conventions

**Files:**
- Source modules: `kebab-case.ts` (for example `log-parser.ts`, `input-errors.ts`, `history-parser.ts`)
- Tests: `kebab-case.test.ts` mirroring the source module name (for example `tests/core/log-parser.test.ts` for `src/core/log-parser.ts`)
- Fixture directories: `kebab-case` incident IDs (`checkout-outage`, `slow-burn`, `ambiguous`)
- Fixture files: fixed names `logs.jsonl`, `history.json`, `expected.json`, `manifest.json`
- Planning docs: `UPPERCASE.md`; phase plans `NN-NN-PLAN.md`

**Directories:**
- Lowercase, single-word or kebab-case (`src/core`, `tests/core`, `fixtures/incidents`)
- Phase directories: `NN-kebab-slug` (`01-foundation-and-rebuild-surface`)

**Code identifiers:**
- Functions: `camelCase` (`parseLog`, `groupErrorEvents`, `classifyOnset`)
- Types and interfaces: `PascalCase` (`AnalysisInput`, `OnsetAnalysis`)
- Exported constants: `SCREAMING_SNAKE_CASE` (`DEFAULT_LOG_LIMITS`, `MIN_OBSERVED_BUCKETS`, `SCHEMA_VERSION`)
- Error codes: `SCREAMING_SNAKE_CASE` strings (`INVALID_ANALYSIS_INPUT`, `HISTORY_VALIDATION`)
- Private helpers: `camelCase` with no export

**Imports:**
- Relative imports with explicit `./` and no file extension (for example `from './model'`)
- Type-only imports use `import type` (required by `verbatimModuleSyntax`)

## Where to Add New Code

**New analysis rule or onset interpretation:**
- Implementation: `src/core/onset.ts` (classifier rules and constants)
- Orchestration hook: `src/core/pipeline.ts` (only if it needs a new pass)
- Tests: `tests/core/onset.test.ts`, plus a fixture case in `tests/core/fixture-contract.test.ts` if the rule changes a bundled incident

**Phase 3 ranking (planned):**
- Feature extraction and scoring: new `src/core/scoring/` directory, per `.planning/research/ARCHITECTURE.md`. Keep it pure.
- Wire into: `src/core/pipeline.ts` (populate `suspects` in `toAnalysisResult`)
- Tests: `tests/core/scoring.test.ts` (new file, following the `*.test.ts` naming)

**New log format:**
- Implementation: add a parser function next to `parseJsonLinesLog` and `parsePlainTextLog` in `src/core/log-parser.ts`, and extend the `LogFormat` union in `src/core/model.ts` and the `parseLog` switch.
- Tests: `tests/core/log-parser.test.ts`

**New history format:**
- Implementation: `src/core/history-parser.ts`. Extend `HistoryFormat` in `src/core/model.ts`. `ensureInput` in `src/core/pipeline.ts` currently accepts only `culprit-json`, so update it too.

**New error type or code:**
- Implementation: `src/core/input-errors.ts` (add to `InputErrorCode`, then add a subclass if needed)

**New normalization helper:**
- Shared helpers: `src/core/normalization.ts`

**New fixture incident:**
- Location: `fixtures/incidents/<incident-id>/` with the four fixed files. Add it to the fixture ID list used by `tests/core/fixture-contract.test.ts` and `tests/core/analysis-fixture.test.ts`.

**Worker (planned):**
- Location: `src/worker/analysis.worker.ts` and `src/worker/client.ts` (new directories, not yet created)
- Imports `analyze` from `src/core/pipeline.ts`. Core must not import from `src/worker/`.

**UI components (planned):**
- Location: `src/ui/` with `app.ts`, `components/`, and `format.ts` (new directories, not yet created)
- Must not be imported from `src/core/`.

**New test:**
- Core unit tests: `tests/core/<module>.test.ts`
- Worker or UI tests (planned): `tests/worker/`, `tests/ui/`

**Shared helpers:**
- Pure helpers: `src/core/normalization.ts`
- DOM helpers (future): `src/ui/format.ts`

## Special Directories

**`fixtures/incidents/`:**
- Purpose: Demo and test data, referenced by path from tests.
- Generated: No
- Committed: Yes
- Note: Fixture paths are repository-relative and read by `tests/core/fixture-contract.test.ts` (`fixtureRoot` resolves from `import.meta.url`).

**`.planning/`:**
- Purpose: GSD planning and state.
- Generated: Partly (by GSD commands)
- Committed: Yes (except `.planning/milestone.lock` per `.gitignore`)

**`.planning/codebase/`:**
- Purpose: Codebase map documents consumed by GSD planning commands.
- Generated: Yes (by `/gsd-map-codebase`)
- Committed: Yes

**`dist/`:**
- Purpose: Vite production output.
- Generated: Yes (`npm run build`)
- Committed: No (`.gitignore`)

**`node_modules/`:**
- Purpose: npm dependencies.
- Generated: Yes (`npm ci`)
- Committed: No

**`.claude/`:**
- Purpose: Claude Code project instructions.
- Generated: No
- Committed: Yes

---

*Structure analysis: 2026-10-19*
