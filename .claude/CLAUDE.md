<!-- GSD:project-start source:PROJECT.md -->

## Project

**Culprit**

Culprit is an offline-first incident-analysis web app for developers who need to answer “which commit most likely broke production?” quickly. A user provides an error log and git history; Culprit detects the incident onset, ranks suspect commits with explainable evidence, and presents the result through a focused incident-console UI.

The first milestone is a polished, trustworthy demo for a solo buildathon project. It should feel useful within seconds, work without a server or network, and make the analysis easy for a person to verify rather than pretending to provide certainty.

**Core Value:** Given a log and recent git history, Culprit must produce a deterministic, evidence-backed shortlist of likely culprit commits quickly enough to guide the next human investigation.

### Constraints

- **Delivery**: Buildathon deadline is 20 Oct 2026 at 23:59 IST — use incremental checkpoints and keep buffer for rebuild and submission work.
- **Reproducibility**: Keep a pinned Node runtime, lockfile, Dockerfile, `.env.example`, README, and an offline-capable single test command in the repository.
- **Offline execution**: Tests and the demo build must work without network access after dependencies are installed; no runtime calls to external services.
- **Privacy**: Logs and repository data stay in the browser and are never sent anywhere.
- **Determinism**: Analysis output cannot depend on current time, randomness, machine-specific absolute paths, or network state.
- **Scope**: Must-have analysis and verdict behavior takes precedence over “should” and “nice” UI features.
- **Accessibility**: Colour cannot be the only signal, focus must be visible, contrast must pass, and the UI must remain usable at laptop and phone widths.

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## Executive summary

## Recommended stack

### Runtime and package management

- **Node.js 22 LTS, exact patch pinned in `.nvmrc`** (recommended confidence: High). Use the latest approved Node 22 patch available when setup is performed; an example such as `22.20.0` is plausible for the 2025 LTS line but should be verified rather than copied blindly. The current workstation reports Node `v24.14.1`, so it is evidence of the host only, not the project runtime.
- **npm shipped with that Node release** (High). Do not introduce pnpm/Yarn/Corepack policy for this small project. Commit `package-lock.json` with a current npm compatible with the chosen Node line and run `npm ci`.
- Add `.nvmrc` and optionally an `engines.node` range such as `22.x`; the `.nvmrc` is the exact human/tooling pin, while `engines` gives a useful failure for accidental Node 24/20 use.

### Build and application

- **Vite 7.x** (High for the tool family; Medium for an exact patch). It provides a small static build, native worker bundling, TypeScript-aware development ergonomics, and predictable production assets without a server. Pin the exact resolved version in the lockfile. Vite 7's Node requirement is compatible with Node 22 LTS.
- **TypeScript 5.x, `strict: true`** (High). Use separate `tsconfig.json`/`tsconfig.node.json` only if Vite configuration needs it. Prefer `moduleResolution: "Bundler"`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, and `noEmit: true` for application type-checking; Vite emits the browser bundle.
- **Plain DOM modules, semantic HTML, and native CSS** (High). A small incident console does not need React/Vue/Svelte. Use modules and explicit state transitions; this keeps the analysis core independent of the DOM and reduces dependency and bundle surface.
- **Native Web Worker API** (High). Put parsing and ranking behind a small message protocol (`AnalyzeRequest`/`AnalyzeResponse`) and use `new Worker(new URL(..., import.meta.url), { type: "module" })`. Keep a main-thread path for tiny fixtures and a clear error/termination path. This avoids freezing the UI on large logs without adding a worker framework.
- **Hand-authored SVG timeline** (High). Render the error-rate series, onset marker, commits, and hit targets from normalized data. SVG is sufficient for the required interaction and accessibility labels; a chart package would add configuration, version, and visual-default complexity.
- **Local font files** (High). Include the chosen WOFF2 files under `public/fonts` or `src/assets`, declare `@font-face`, and use `font-display: swap`. Do not depend on Google Fonts, CDN CSS, or a browser-installed font for the demo's visual identity. Record the font license/source in a small local note if required by its license.

### Testing and checks

- **Vitest 3.x** (High for the family; Medium for an exact patch). Use `vitest run` for the single offline test command. Test the pure core heavily: JSONL/plain-text parsing, multiline traces, invalid inputs, UTC normalization, onset classes, signature grouping, fixed-weight scoring, ties, no-incident/ambiguous cases, and byte-stable serialized output. Add a small worker protocol test only if it catches a real integration risk.
- Use Vite's native build and `tsc --noEmit` as separate scripts, then one `test` script that is deterministic. A suitable minimal set is:
- **No browser automation dependency for the MVP** (High). The key behavior is pure and can be verified offline with Vitest. Add Playwright only if a later acceptance check genuinely needs a real-browser smoke test; it requires separately cached browser binaries and makes offline Docker materially larger.

### Project shape

## Alternatives rejected

| Alternative | Decision | Reason |
|---|---|---|
| React + component/UI kit | Reject for MVP | Adds framework, JSX, rendering and dependency surface without helping the pure analysis problem. Native DOM is enough for a few console views. |
| Vue/Svelte/Solid | Reject for MVP | Reasonable technologies, but another compiler/runtime convention is unnecessary when the UI is intentionally narrow. Reconsider only after measured UI complexity. |
| D3, Plotly, ECharts, or a chart wrapper | Reject | The required chart is one SVG timeline with a few marks. Hand-authored SVG gives exact keyboard/focus behavior and deterministic geometry. |
| Tailwind or a CSS framework | Reject | Native CSS keeps the build offline and makes visual tokens explicit; a utility framework would add config and generated CSS for a small surface. |
| Moment, Luxon, date-fns, or Temporal polyfill | Reject initially | UTC conversion and a small set of display formats can use `Date` plus explicit helpers. Avoid a date dependency and locale drift; add one only if parsing requirements expand. |
| Papa Parse, Chevrotain, PEG/parser generators | Reject initially | The supported formats are JSON-lines and two documented text styles. Small explicit parsers are easier to cap, explain, and test. |
| Zustand/Redux/XState | Reject | A local state machine and event handlers are enough; introduce a state library only if transitions become demonstrably hard to review. |
| Next.js/Remix/Electron/Tauri | Reject | Server/runtime shell contradicts the browser-only, no-account, no-upload requirement and complicates the static Docker/demo path. |
| Runtime AI/ML SDK | Reject | Explicitly out of scope; frozen weighted heuristics are required for trust and repeatability. |
| npm packages fetched during app execution | Reject | Violates the offline/no-network runtime boundary. All assets and code must ship in the static bundle. |

## Reproducibility/offline build

## Confidence

- **High:** Node 22 LTS pin, npm lockfile/`npm ci`, Vite static build, strict TypeScript, Vitest, native Web Workers, SVG, local fonts, no runtime network, and pure-core separation. These follow directly from the project constraints and stable platform capabilities.
- **Medium-high:** Vite 7.x with Node 22 and Vitest 3.x. The compatibility direction is sound, but exact releases should be resolved together and committed; do not mix a lockfile generated under an unsupported Node/npm combination.
- **Medium:** exact Docker base tag/digest and exact font family. Select and record these during setup after checking the target Linux architecture and license. A digest is strongest for reproducibility but must be refreshed deliberately for security updates.
- **Low/conditional:** Playwright, a UI framework, chart library, or extra parser/date dependency. None is needed by the summarized PRD; their inclusion should require a concrete failing requirement or measured performance/accessibility gap.

## Sources/verification notes

- **Primary local source:** `.planning/PROJECT.md`, especially requirements 28–39, context 54–60, and constraints 63–71. It explicitly calls for Node 22, TypeScript, Vitest, Vite, workers for large logs, local/offline operation, pinned rebuilds, Docker, and a single offline test command.
- **Repository inspection (2026-10-19):** no `package.json`, lockfile, source tree, README, Dockerfile, or existing application dependencies were present to validate against. The repository contains the distilled project file and PRD PDF artifacts only; therefore this report is a greenfield recommendation rather than a compatibility audit.
- **Local tool evidence:** the workstation reports Node `v24.14.1` and npm `11.11.0`; this confirms the host is not yet running the required Node 22 project pin. No package versions were inferred from that host result.
- **Standards/platform basis:** Node 22 is the requested LTS line; Vite's static bundling and worker URL pattern, the TypeScript compiler, Web Workers, SVG, WOFF2, and Vitest's non-watch `run` mode are all standard choices for an offline browser application. Exact package patches, Docker digest, and font license remain setup-time verification items and must be recorded in the committed lockfile/README rather than guessed here.

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-fast` for a trivial task inline, with no subagents and no PLAN.md
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
