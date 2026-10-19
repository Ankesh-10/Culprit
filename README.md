# Culprit

Culprit is an offline-first incident-analysis web app for answering “which commit most likely broke production?” from a supplied log and a narrow git-history export. It produces deterministic, evidence-backed ranked suspicion rather than claiming causal certainty.

## Privacy and local boundary

The MVP runs entirely in the browser. User logs and repository history stay local and are never uploaded, persisted remotely, sent to an AI service, or used to call a runtime endpoint. The checked-in fixtures, source, and build assets are the complete application input. `.env.example` documents the intentional absence of secrets: no secret is required for the MVP.

## Requirements and setup

Use the pinned Node 22.20.0 runtime and npm. With `nvm` installed:

```sh
nvm use
npm ci
```

`npm ci` installs exactly the committed `package-lock.json`. It may use the npm registry during the initial dependency installation. Tests and the built application make no network requests after dependencies are available. A truly network-isolated clean machine needs a populated npm cache or a preloaded Docker/BuildKit cache; this repository does not pretend that an empty cache can install packages offline.

## Development

Start the Vite development server:

```sh
npm run dev
```

The browser shell is local and serves on Vite's normal development port. For a production build and local static demo:

```sh
npm run build
npm run preview -- --host 0.0.0.0 --port 4173
```

`npm run build` writes the static artifact to `dist/`. The preview command serves that artifact on port `4173`.

## Verification

`make test` is the authoritative single, non-watch verification command. It runs the steps in this order:

```sh
make test
```

1. `npm run typecheck`
2. `npm test` (Vitest in non-watch mode)
3. `npm run build`

The command is offline-capable after project dependencies are installed. It covers the current core serialization and three shared incident fixture contracts; later phases extend the same Vitest discovery with parser, onset, grouping, scoring, determinism, worker, and UI-contract tests. No test starts a server, requires Docker, reads a machine-specific absolute path, or calls a remote URL.

## Docker

The multi-stage Dockerfile uses Node `22.20.0` for both build and runtime stages. The build stage copies `package.json` and `package-lock.json`, runs `npm ci`, copies the repository, and produces `dist/`. The runtime stage contains only Node and the static `dist/` artifact; its small built-in HTTP server listens on `0.0.0.0:4173`. No global package install or secret is used.

Build and run it with:

```sh
docker build --tag culprit:phase1 .
docker run --rm --publish 4173:4173 culprit:phase1
```

Open <http://localhost:4173/>. `GET /` serves `dist/index.html`; static assets are served from `dist/`, and application routes fall back to `index.html`. The image health check requests the local root URL and reports unhealthy for a non-success response. Docker's `npm ci` still needs registry access unless its builder has a populated cache; the running image is network-free.

## Static deployment and demo

For a static host, run `npm run build` and publish the contents of `dist/` as the site root. For a local or LAN demo, use:

```sh
npm run preview -- --host 0.0.0.0 --port 4173
```

The app has no server-side API, database, upload destination, or runtime service to configure.

## Supported input boundary

The analysis boundary accepts:

- JSON-lines logs with an ISO 8601 timestamp, level, message/error field, and optional exception and multiline stack.
- Plain-text logs using the documented ISO timestamp and level prefix, with continuation lines for supported multiline stack traces.
- The versioned `culprit-json` history export containing commit SHA, author, timestamp, subject, repository-relative POSIX file paths, and inclusive changed line ranges.

Arbitrary `git log` prose, additional log formats, whole-repository uploads, and live streams are outside the MVP. The hosted-demo input cap is 1 MiB of log text, 10,000 events, and 100 stack lines per event; the analysis must report a limit rather than silently accepting a larger input.

## UTC, determinism, and confidence

All supplied timestamps are normalized and displayed in UTC. The MVP trusts event timestamps and does not correct for clock skew or delayed ingestion. Identical inputs produce byte-identical structured JSON and Markdown output: no current time, randomness, locale-sensitive formatting, machine-specific absolute path, or network data enters the result. Repository paths in evidence use POSIX separators and are relative to the supplied repository.

Scores are ranked suspicion, not probability or proof. A high, medium, or low confidence band reflects observable onset quality, evidence coverage, score separation, and input completeness. “No clear culprit” and ambiguous/low-confidence outcomes are valid results and must remain explicit when evidence conflicts or is weak.

## Limitations

Culprit narrows investigation; it does not roll back code, auto-fix a deployment, establish causality, or replace human review. The initial fixture and serialization foundation does not yet implement the complete parser, onset detector, scoring engine, worker, or investigation console. Those later phases must consume the same fixture files and preserve the local privacy, UTC, determinism, confidence, and rebuild contracts documented here.
