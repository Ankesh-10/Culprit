# Culprit stack research

**Scope:** smallest reliable stack for the offline-first, browser-only incident-analysis MVP described in `.planning/PROJECT.md`.

## Executive summary

Use a deliberately boring TypeScript application: **Node 22 LTS, Vite, TypeScript, Vitest, native browser APIs, and no runtime dependencies beyond the application itself**. Keep the analysis engine in a dependency-light `src/core` package/module, run it synchronously for small inputs and in a browser Web Worker for large inputs, and render the timeline with hand-authored SVG. This directly supports the product constraints: deterministic ranking, no server, no network at runtime, fast bundled fixtures, and a rebuild that can be audited by a solo developer.

The important reproducibility choice is not a large framework; it is exact toolchain pinning. Pin an exact Node 22 patch in `.nvmrc`, commit `package-lock.json`, use `npm ci` rather than `npm install` in CI/Docker, and make the test script `vitest run` (non-watch, non-interactive). The lockfile, local fonts, fixture data, and source code are the complete runtime input. Avoid a UI framework, charting library, date library, parser generator, state-management package, or runtime AI SDK until a measured requirement proves one necessary.

**Recommendation confidence: High.** The stack is conventional, small, and satisfies the stated browser/offline boundary. Exact package patch numbers should be selected during setup with the Node version available on the build machine, then frozen in the lockfile; the package *families* below are the durable recommendation.

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
  - `npm run typecheck`: `tsc --noEmit`
  - `npm run build`: `npm run typecheck && vite build`
  - `npm test`: `vitest run`
- **No browser automation dependency for the MVP** (High). The key behavior is pure and can be verified offline with Vitest. Add Playwright only if a later acceptance check genuinely needs a real-browser smoke test; it requires separately cached browser binaries and makes offline Docker materially larger.

### Project shape

Recommended small layout:

```text
src/
  core/       # pure types, parsers, onset/signatures, scoring, stable serialization
  worker/      # thin worker adapter around core
  ui/         # DOM state, verdict, shortlist, accessible SVG timeline
  main.ts
tests/        # core and worker-contract tests
public/fonts/ # checked-in WOFF2 assets
fixtures/     # three bundled incidents, also test inputs
```

Keep timestamps as epoch milliseconds or ISO strings normalized to UTC at the boundary. Use explicit stable sorting (score descending, then timestamp/commit id as documented), never `Date.now()`, `Math.random()`, locale-sensitive formatting, or machine-specific absolute paths in analysis output.

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

1. **Pin and verify:** commit `.nvmrc`, `package.json`, `package-lock.json`, `tsconfig*.json`, `vite.config.ts`, and `Dockerfile`. The README must state exact `nvm use`, install, run, test, and deploy commands.
2. **Install reproducibly:** use `npm ci`; never regenerate the lockfile as part of Docker or tests. The lockfile is the dependency graph and integrity record.
3. **Offline tests:** after dependencies are present in the local npm cache, run `npm test -- --run` (or simply `npm test` when the script is already `vitest run`) with network disabled. Tests must not fetch fixtures, fonts, or browser binaries.
4. **Docker:** use a Node 22 slim image selected and documented at setup time, copy lockfiles first, run `npm ci`, then copy sources and run the build. For truly network-isolated rebuilds, pre-populate an npm cache/artifact directory in the build context or use a preloaded BuildKit cache; `npm ci --offline` cannot install packages that are absent from the cache. Do not hide a network download in a Docker `RUN` step.
5. **Serve static output:** a production image may use a tiny static server stage, but the app itself remains static. If adding a server package solely for Docker, keep it out of the browser bundle and pin it like every other dependency. A documented host-side `npm run preview -- --host 0.0.0.0` is sufficient for the demo.
6. **Deterministic verification:** build twice from the same checkout and compare the generated asset manifest or normalized output. Do not promise byte-identical hashed bundles across different Vite/Node patches unless verified; the product's stronger requirement is byte-identical *analysis output*. Pinning makes the build environment reproducible.
7. **No secrets or machine paths:** commit `.env.example` only if Vite needs a documented empty configuration; do not use `VITE_*` values for secrets. Exclude absolute paths, usernames, and timestamps from fixtures, reports, source maps, and snapshots where practical.

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
