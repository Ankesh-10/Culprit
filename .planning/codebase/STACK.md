---
last_mapped_commit: 89ce56e1d2666fb2512c9de922ee03b463449d90
last_mapped_at: 2026-10-19
---
# Technology Stack

**Analysis Date:** 2026-10-19

## Languages

**Primary:**
- TypeScript 5.9.3 - All application code in `src/` (core analysis in `src/core/`, browser entry in `src/main.ts`) and tests in `tests/core/`
- Target `ES2022` per `tsconfig.json` and `vite.config.ts`

**Secondary:**
- CSS - Native stylesheet at `src/styles.css`, imported from `src/main.ts`
- HTML - Single document shell at `index.html`
- JavaScript (Node) - Inline `node -e` static server in `Dockerfile` CMD; `vite.config.ts` and `tsconfig.node.json` cover build config
- Shell/Make - `Makefile` (`make test`), `commit-phase1.sh` (repository helper, not part of runtime)

## Runtime

**Environment:**
- Node.js pinned to `22.20.0` in `.nvmrc` and in both Docker stages (`node:22.20.0-alpine` in `Dockerfile`)
- `package.json` declares `"engines": { "node": "22.x" }`
- Application runtime is the browser; Node is used only for tooling, tests, and the Docker static server

**Package Manager:**
- npm (version shipped with Node 22.20.0; no separate pin)
- Lockfile: present - `package-lock.json` (lockfileVersion 3)
- Install command for reproducible setup: `npm ci`
- Module type: ESM (`"type": "module"` in `package.json`)

## Frameworks

**Core:**
- None at runtime. The UI is plain DOM modules and semantic HTML (`index.html`, `src/main.ts`). No React, Vue, Svelte, or other UI framework is present.

**Build/Dev:**
- Vite 7.1.10 - Dev server (`npm run dev`), production bundle (`npm run build` -> `vite build`), and preview (`npm run preview`). Config: `vite.config.ts` (sourcemaps disabled, build target `es2022`)
- TypeScript 5.9.3 - Type checking only (`noEmit: true`); config in `tsconfig.json` (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `moduleResolution: "Bundler"`) and `tsconfig.node.json` (composite, covers `vite.config.ts`)
- esbuild 0.25.12 - Transitive dependency of Vite (not used directly)
- Rollup 4.64.10 - Transitive dependency of Vite for production bundling

**Testing:**
- Vitest 3.2.4 - Test runner. Script: `vitest run` (non-watch). Test globals typed via `vitest/globals` in `tsconfig.json`. Tests live in `tests/core/*.test.ts`

## Key Dependencies

**Critical (devDependencies only; `package.json` has no `dependencies` section):**
- `vite` 7.1.10 - Bundles `index.html` and `src/` into static assets in `dist/`
- `vitest` 3.2.4 - Runs the offline unit and fixture-contract suite
- `typescript` 5.9.3 - Strict type checking gate used by `npm run typecheck` and before `vite build` in `npm run build`
- `@types/node` 22.15.33 - Node typings for `vite.config.ts` and the test environment

**Infrastructure:**
- Transitive packages recorded in `package-lock.json` include `@esbuild/*` and `@rollup/rollup-*` per-platform binaries, `@vitest/*` (expect, mocker, runner, snapshot, spy, utils), `chai`, `fdir`, and `debug` test-support utilities. Platform-specific optional binaries are listed for all targets, so `npm ci` on Windows (win32-x64) and Linux (alpine/musl) both resolve correctly from the same lockfile.

**Runtime application dependencies:** none. The shipped bundle contains only first-party code and the CSS/HTML shell.

## Configuration

**Environment:**
- `.env.example` documents that no secret is required for the MVP. No `.env` file is required or read by the build.
- No environment variables are consumed by application code (`src/`).
- `NODE_ENV=production` is set in the Docker runtime stage only.

**Build:**
- `vite.config.ts` - Minimal config (`sourcemap: false`, `target: 'es2022'`)
- `tsconfig.json` - Application and test type-check config; includes `src`, `tests`, `vite.config.ts`
- `tsconfig.node.json` - Config-file type check for `vite.config.ts`
- `package.json` scripts:
  - `dev`: `vite`
  - `typecheck`: `tsc --noEmit`
  - `test`: `vitest run`
  - `build`: `npm run typecheck && vite build`
  - `preview`: `vite preview`
- `Makefile` - `test` target runs `npm run typecheck`, `npm test`, `npm run build` in sequence (the authoritative single verification command)
- `.gitignore` - Excludes `node_modules/`, `dist/`, `coverage/`, `*.tsbuildinfo`, and `.env`/`.env.*` except `.env.example`
- `.dockerignore` - Excludes `tests/`, `README.md`, `Dockerfile`, `.planning/`, `.claude/`, `.git/`, and the product PDF from the build context

**Assets and fonts:**
- No `public/` directory, no `@font-face` rules, and no font files are present yet. `src/styles.css` contains no `url()` references.

## Docker

**Build stage** (`Dockerfile`, `FROM node:22.20.0-alpine AS build`):
- `WORKDIR /app`, copies `package.json` and `package-lock.json`, runs `npm ci`, copies the rest of the context, runs `npm run build`

**Runtime stage** (`FROM node:22.20.0-alpine AS runtime`):
- Copies only `dist/` from the build stage
- Serves `dist/` with a built-in `node:http` server (no Express or other package) on `0.0.0.0:4173`, with SPA fallback to `index.html`, path-traversal guard, and only `.js`/`.css`/default content types
- `HEALTHCHECK` fetches `http://127.0.0.1:4173/` every 30s
- Expose: `4173`

Note: the runtime server's content-type map only distinguishes `.js` and `.css`; `.html` and other assets fall through to `application/octet-stream` for non-root paths. The root path is served as `index.html` with `text/html`.

## Platform Requirements

**Development:**
- Node.js 22.20.0 (via `nvm use` reading `.nvmrc`), npm, and a registry connection for the first `npm ci`
- Git for repository history fixtures; no other system tools
- Windows, macOS, or Linux; the lockfile contains optional platform binaries for all of them

**Production:**
- Static hosting of the `dist/` directory, or the provided Docker image (Node 22 Alpine)
- No database, server-side runtime, or external service required

---

*Stack analysis: 2026-10-19*
