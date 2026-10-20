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

- JSON-lines logs with one object per nonblank line. Each object requires `timestamp` (ISO-8601 with `Z` or a numeric offset) and a non-empty string `message` or `error`. It may contain `level` (`trace`, `debug`, `info`, `warn`, `error`, or `fatal`), string `exception`, and string `stack`; other fields are rejected. Records retain their physical line and record numbers.
- Plain-text logs whose event prefix is exactly `<ISO-8601 timestamp with Z or numeric offset> <lowercase level> <message>`, where level is one of `trace|debug|info|warn|error|fatal`. Indented lines, `at ...` frames, and `Caused by:` lines attach to the preceding event, including a final stack with no trailing newline. Orphan, ambiguous, timestamp-conflicting, and over-limit continuations remain line-aware `STACK_ATTACHMENT` diagnostics.
- Exactly the versioned `culprit-json` history object: `{ "schemaVersion": 1, "format": "culprit-json", "repository": string, "commits": [...] }`. Each commit requires a lowercase 40-character hexadecimal `sha`, non-empty `author`, offset-bearing `timestamp`, `message` or compatibility alias `subject`, and `files`. Canonical output exposes both `message` and `subject` with the same text. Each file has a repository-relative POSIX `path`, finite non-negative integer `added`/`deleted` counts, and inclusive integer `ranges` where `1 <= start <= end`. Commits sort by UTC timestamp then SHA; files sort by path; ranges sort by start then end.

Timestamps are normalized immediately to UTC ISO strings ending in `Z`; timestamps without an explicit offset are invalid. Repository paths convert backslashes to `/`, remove one leading `./`, and reject absolute or traversal paths. Empty input, malformed JSON, missing fields, unsupported fields/formats, invalid timestamps, history conflicts, and size-limit failures use typed errors with stable codes and nullable source line/record/field context. Recoverable malformed records and stack attachment failures are returned in diagnostics rather than silently dropped. Arbitrary `git log` prose is unsupported.

Arbitrary `git log` prose, additional log formats, whole-repository uploads, and live streams are outside the MVP. The hosted-demo input cap is 1 MiB of log text, 10,000 events, and 100 stack lines per event; the analysis must report a limit rather than silently accepting a larger input.

## UTC, determinism, and confidence

All supplied timestamps are normalized and displayed in UTC. The MVP trusts event timestamps and does not correct for clock skew or delayed ingestion. Identical inputs produce byte-identical structured JSON and Markdown output: no current time, randomness, locale-sensitive formatting, machine-specific absolute path, or network data enters the result. Repository paths in evidence use POSIX separators and are relative to the supplied repository.

Scores are ranked suspicion, not probability or proof. A high, medium, or low confidence band reflects observable onset quality, evidence coverage, score separation, and input completeness. “No clear culprit” and ambiguous/low-confidence outcomes are valid results and must remain explicit when evidence conflicts or is weak.

## How ranking works

Ranking is a frozen, explainable heuristic (`scoring-v1`). It never uses a model, randomness, or the current time.

- **Eligibility.** A commit is eligible when it was committed at or before the onset window start (inclusive). Later commits are still listed, as not eligible, with the reason.
- **Score.** `score = 0.35 × proximity + 0.30 × trace match + 0.25 × novelty + 0.10 × churn`. Each signal has a value between 0 and 1; the report shows every value, its weight, and its contribution, and the displayed contributions add up to the score.
  - *Proximity* halves for every 60 minutes between the commit and the onset window start.
  - *Trace match* looks at the first application-owned stack frame of each error event: a changed line containing the frame line scores 1.0, a changed line within 5 lines scores 0.6, and a change to the same file scores 0.3. The signal is the average over all error events.
  - *Novelty* is the share of error events whose signature first appears at or after the commit.
  - *Churn* is a bounded function of changed lines and files touched and adds at most 0.10.
- **Rounding.** Scores and contributions are rounded to 6 decimals. Comparisons use integer micro-units, so ordering does not depend on floating-point noise.
- **Tie-break.** Candidates are ordered by score, then trace match, then the newer commit, then SHA. At most three suspects are shown; remaining eligible commits are listed as also scored.
- **Confidence band and labels.** A separation below 0.05 between the top two scores, or an ambiguous onset, is labeled `ambiguous`. Fewer than half of the error events matching a changed line is labeled `weak-evidence`. `ambiguous` together with `weak-evidence` is labeled `no-clear-culprit`. Any of these puts the band at low and adds `low-confidence`. Otherwise a gradual ramp, a separation below 0.15, or application stack frames on fewer than three quarters of the error events cap the band at medium; everything else is high.
- **Export.** The Markdown export escapes all supplied text (commit subjects, authors, log-derived details, diagnostics) so it cannot add headings, links, HTML, or extra lines. Every ranked report states that scores are ranked suspicion, not probability or proof of causality.

## Using the console

The page opens on a short landing page at `#/`; "Open the console" (or the `#/app` address) opens the console, where you choose one of the three bundled incidents, and one click loads and analyzes it. "Try the checkout outage" on the landing page opens the console with that case already loaded. The checkout case is a sharp spike, the slow-burn case is a gradual ramp, and the ambiguous case has no clear culprit. A result shows the most likely suspect with its evidence, a short lineup, a timeline of errors with the onset and suspect commits, a signature table, and a trust footer with warnings and limits. "Inspect evidence" opens the suspect drawer, and "Copy Markdown postmortem" copies the report. When the clipboard is unavailable (for example a plain-HTTP address that is not localhost), the Markdown appears in a selected text box so it can be copied by hand; "Hide Markdown" collapses it.

To analyze your own incident, choose "Use your own files". The form has two fields:

- **Log**: a JSON-lines or plain-text log (`.jsonl`, `.log`, `.txt`). The format is auto-detected by a fixed rule: when the first non-empty line starts with `{` it is read as JSON-lines, otherwise as plain text. The detected format is shown beside the format choice, which you can override.
- **Git history**: a Culprit JSON history export (`.json`) as described under the supported input boundary. Raw `git log` output is not accepted.

Each field takes a chosen file, a dropped file, or pasted text under "Or paste text". The limits are 1 MiB of log text, 10,000 events and 100 stack lines per event. A file over 1 MiB is refused before it is read, with a message naming its size. "Analyze incident" stays disabled until both fields have content. If an analysis fails, the page lists each problem in plain language with a "Fix input" link that moves focus to the field to fix, and your inputs stay filled. "Clear inputs" asks for confirmation first and leaves any shown result in place. Files and pasted text are processed in the page only; nothing is uploaded or stored.

Keyboard use: Tab reaches every control, including the file pickers (Enter or Space opens them), and the focus ring is always visible. On the timeline slider, Left and Right move one step, PageUp and PageDown move a larger step, Home and End jump to the ends, and Enter opens the log lines for the selected interval. Escape closes the suspect drawer and returns focus to the control that opened it, and cancels the Clear inputs confirmation.

## Limitations

Culprit narrows investigation; it does not roll back code, auto-fix a deployment, establish causality, or replace human review. The parser, onset detector, evidence ranking, and Markdown export are implemented; the worker and investigation console are still pending. Those later phases must consume the same fixture files and preserve the local privacy, UTC, determinism, confidence, and rebuild contracts documented here.

Ranking limits:

- Only the top application frame of each error is scored. There is no credit for a change to a different file in the same directory.
- Vendor, runtime, build-output, and absolute-path frames are not matched. Top-level directories named `dist`, `build`, `out`, `coverage`, or `internal` are treated as non-application.
- Novelty treats the start of the supplied log as the start of observation.
- The onset window can start after the first error; the onset heuristics are unchanged by ranking.
- History size is not capped yet.
- Timelines over 10,000 buckets are rejected with an input-limit error.

Font note: the UI ships with system font stacks (Segoe UI Variable or the platform UI face for text, a monospace stack for hashes, paths and log lines). To use Inter (preferred), Geist or Geist Mono instead, add the matching WOFF2 files (`Inter-Variable.woff2`, `Geist-Variable.woff2`, `GeistMono-Variable.woff2`) and `OFL.txt` under `src/assets/fonts` (see `FONTS.md` in that folder); the build bundles them locally and never loads fonts from a network.
