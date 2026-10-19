---
last_mapped_commit: 89ce56e1d2666fb2512c9de922ee03b463449d90
last_mapped_at: 2026-10-19
---
# External Integrations

**Analysis Date:** 2026-10-19

## APIs & External Services

**Runtime services:** None.
- The application makes no runtime HTTP, WebSocket, or other network calls. No `fetch`, `XMLHttpRequest`, `WebSocket`, or `sendBeacon` usage was found in `src/` or `index.html`.
- No AI/ML SDK, analytics, telemetry, or error-tracking SDK is present in `package.json` or `src/`.

**Build-time / install-time network:**
- npm registry - Only during `npm ci` (dependency installation from `package-lock.json`). Not used by the running application or by `npm test`/`npm run build` once dependencies exist.
- Docker base images `node:22.20.0-alpine` - Pulled by `Dockerfile` at image build time.

## Data Storage

**Databases:**
- None. No database client, ORM, or connection configuration exists.

**Browser storage:**
- No `localStorage`, `sessionStorage`, or `indexedDB` usage found in `src/`.

**File Storage:**
- Local filesystem only, at build time: `dist/` output produced by `vite build`.
- Fixtures are checked in and read by tests from `fixtures/incidents/` (`ambiguous/`, `checkout-outage/`, `slow-burn/`), each with `manifest.json`, `logs.jsonl`, `history.json`, and `expected.json`. Tests load these as repository files; they are not fetched at runtime.

**Caching:**
- None at application level. Docker layer caching is the only cache.

## Input Sources (user-supplied, not integrations)

Per `README.md` and `.planning/PROJECT.md`, the analysis consumes user-supplied data that stays in the browser:
- JSON-lines or plain-text incident logs (parsed by `src/core/log-parser.ts`)
- A versioned `culprit-json` git-history export (parsed by `src/core/history-parser.ts`; schema `schemaVersion: 1`, `format: "culprit-json"`)
- Arbitrary `git log` prose is explicitly unsupported. The app does not invoke `git` and does not read a repository directly.

Input limits documented in `README.md`: 1 MiB log text, 10,000 events, 100 stack lines per event. Loading UI (file picker/drag-and-drop) is not yet implemented.

## Authentication & Identity

**Auth Provider:**
- None. No accounts, sessions, tokens, or identity provider. The app is a local, unauthenticated static console.

## Monitoring & Observability

**Error Tracking:**
- None.

**Logs:**
- Analysis diagnostics are returned in-memory as typed results (`src/core/input-errors.ts`). No logging service or remote log sink exists.

## CI/CD & Deployment

**Hosting:**
- No hosting provider configured. Deployment is either static hosting of `dist/` or the local Docker image defined in `Dockerfile`.

**CI Pipeline:**
- None detected. No `.github/` directory, `.gitlab-ci.yml`, or other CI config is present. Verification is the local `Makefile` `test` target (`npm run typecheck`, `npm test`, `npm run build`).

**Container runtime:**
- `Dockerfile` multi-stage build; runtime serves `dist/` via an inline `node:http` server on port `4173`, with a `HEALTHCHECK` against `http://127.0.0.1:4173/`. The container makes no outbound calls.

## Environment Configuration

**Required env vars:**
- None. `.env.example` states that no secret is required for the MVP.

**Secrets location:**
- Not applicable. No secrets, API keys, or credentials are used. No `.env` file is required; `.gitignore` excludes `.env` and `.env.*` (except `.env.example`) as a precaution.

## Webhooks & Callbacks

**Incoming:**
- None.

**Outgoing:**
- None.

## Privacy Boundary

Per `.claude/CLAUDE.md` and `README.md`, logs and repository data are never uploaded, persisted remotely, sent to an AI service, or used to call a runtime endpoint. This was consistent with the code found in this analysis: there are no outbound integration points to audit.

---

*Integration audit: 2026-10-19*
