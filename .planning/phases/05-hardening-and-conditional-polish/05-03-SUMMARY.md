---
phase: 05-hardening-and-conditional-polish
plan: 03
subsystem: testing
tags: [markdown-export, fingerprints, rehearsal, headless-chrome, cdp, readme, trust]

requires:
  - phase: 05-hardening-and-conditional-polish
    provides: scripts/serve-dist.mjs production server (the rehearsal runs under its CSP) and the 05-render-check.mjs harness with startServer()
  - phase: 05-hardening-and-conditional-polish
    provides: near-cap profile numbers and paged lists that the README now reports
  - phase: 04-incident-console-and-investigation-flow
    provides: the console views, trust footer and copy control that the rehearsal checks
provides:
  - serializeMarkdown Limits line (limits and truncation flag) in the Provenance section
  - tests/ui/demo-rehearsal.test.ts three-case clean-start proof of every caveat in console views and Markdown
  - tests/core/output-fingerprint.test.ts pinned SHA-256 of canonical JSON and Markdown for the three bundled cases, with order and CRLF independence
  - 05-render-check.mjs section rehearse (three cases, two sizes, clipboard denied and granted, motion and reduced motion)
  - README that describes the current product (no stale pending claim, real coverage, near-cap numbers, paged lists, Limits line, single-key shortcut note)
affects: [05-04, ship]

requirements-completed: []

actuals:
  tokens: 9020
  tasks: 2
  commits: 2
plan_head_before: e7c67d2cf6f2963dffc35cb584a4b9d522d33eb0
plan_head_after: 1e261c4cb0637109c1200d72995db4f724a72680

tech-stack:
  added: []
  patterns:
    - "Fingerprint constant pinned in a test with no update mode: a change to analysis or export output must be made deliberately"
    - "Rehearsal runs the shipped bundle on the production server and CSP, from about:blank, with the case card chosen by keyboard"

key-files:
  created:
    - tests/ui/demo-rehearsal.test.ts
    - tests/core/output-fingerprint.test.ts
  modified:
    - src/core/serialization.ts
    - tests/core/serialization.test.ts
    - tests/ui/copy.test.ts
    - .planning/phases/05-hardening-and-conditional-polish/05-render-check.mjs
    - README.md

key-decisions:
  - "The Limits line prints raw integers (no locale grouping) so the Markdown stays byte-stable; the console footer keeps its '1 MiB' wording"
  - "The rehearsal denies clipboard-write for the origin on every run except one granted checkout run, so the fallback text box and the real copy path are both exercised"
  - "The Polish gate evidence section is the last section of this file so its verdict line is also the file's last line"

patterns-established:
  - "Throwaway fingerprint probe: compute the hashes once in a scratch test, delete it, paste the constants"

coverage:
  - id: D1
    description: "Every Markdown export states its input limits and the truncation flag in Provenance; the nine fixed headings are unchanged and line counts become 71, 80, 80"
    verification:
      - kind: unit
        ref: "tests/core/serialization.test.ts#states the input limits in the Provenance section right after the Analysis line"
        status: pass
      - kind: unit
        ref: "tests/ui/copy.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Each bundled case carries its assumptions (8), rationale, UTC disclosure, provenance, limits, warnings and (ambiguous) low-confidence labels in both the console views and the Markdown, with no overclaiming wording"
    verification:
      - kind: unit
        ref: "tests/ui/demo-rehearsal.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Canonical JSON and Markdown of the three bundled cases are pinned by SHA-256 and are independent of analysis order and CRLF line endings"
    verification:
      - kind: unit
        ref: "tests/core/output-fingerprint.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "The three cases rehearse from a clean profile in headless Chrome on the production server at 1280x720 and 360x740 with zero console errors and zero off-origin requests"
    verification:
      - kind: integration
        ref: "node .planning/phases/05-hardening-and-conditional-polish/05-render-check.mjs"
        status: pass
    human_judgment: true
    rationale: "Clipboard paste fidelity into another application and whether the demo reads as judge-ready in under ten seconds need a person; harvested into the end-of-phase UAT."
  - id: D5
    description: "README no longer claims the worker and console are pending and reports the real suite, near-cap numbers, paged lists, Limits line and shortcut limitation"
    verification:
      - kind: unit
        ref: "tests/core/rebuild-surface.test.ts"
        status: pass
    human_judgment: false

duration: 7min
completed: 2026-10-20
status: complete
---

# Phase 5 Plan 03: The three demo cases are rehearsed from a clean start with every caveat visible Summary

**The copied Markdown now states its input limits and truncation flag, the SHA-256 of all three bundled outputs is pinned in a test, and headless Chrome on the production server shows every warning, assumption, UTC note, limit and low-confidence label for each demo case in the console and in the pasted text.**

## Performance

- **Duration:** about 7 min (12:37Z to 12:44Z)
- **Started:** 2026-10-20T12:37:22Z
- **Completed:** 2026-10-20T12:44Z
- **Tasks:** 2 (Task 1 tracer, Task 2 auto)
- **Files modified:** 7 (2 created, 5 modified); `src/core` touched only in `src/core/serialization.ts`

## Accomplishments

- `serializeMarkdown` adds `- Limits: 1048576 bytes of log text, 10000 events, 100 stack lines per event; input truncated: no` directly after the `- Analysis:` line in `## Provenance` (`yes` when truncated). Scoring, ranking, confidence and the canonical JSON are unchanged.
- `tests/ui/demo-rehearsal.test.ts` (18 tests) analyzes each case in a fresh worker-handler call and asserts the footer view (8 assumptions, UTC note, limits, provenance, rationale, warnings), the Markdown (8 `- Assumption: ` lines, rationale, UTC disclosure, Limits line, provenance), the ambiguous low-confidence lead with the four labels in order and `1 warning`, `- Labels: none` with `- None.` for checkout, `- Class: **ramp**` for slow-burn, the wording guard, and reverse-order equality.
- `tests/core/output-fingerprint.test.ts` (8 tests) pins six SHA-256 constants and proves identical hashes for reverse analysis order and for CRLF fixture text.
- `05-render-check.mjs` section `rehearse` (default sections are now `profile,a11y,rehearse`): per case and size it goes landing, `#/app`, case card by keyboard, then checks the verdict, caution labels, header chips, trust footer, opened disclosure, and the fallback Markdown (71, 80, 80 lines) with the clipboard denied; once the clipboard is granted for checkout and `Markdown postmortem copied (71 lines).` appears; once more with motion and the verdict settles inside 5 s.
- README: Verification describes the real suite and the two optional browser checks, Limitations loses the stale sentence and gains the paged lists, the near-cap profile, `node scripts/near-cap-input.mjs --write <dir>` and the single-key `/` shortcut note (WCAG 2.1.4), and the Export bullet mentions the limits line.

## Task Commits

1. **Task 1 (tracer): limits in the Markdown, rehearsal test, pinned fingerprints** - `b49956d` (feat)
2. **Task 2: real-browser rehearsal section and README refresh** - `1e261c4` (test)

Tracer gate: the tracer `<verify>` carries only `<automated>` commands and `human_verify_mode` is `end-of-phase`, so it was re-run (focused tests, then typecheck, full suite and build) and passed before expansion.

Pinned fingerprints (SHA-256, computed once after the Limits line landed):

| Case | Canonical JSON | Markdown |
|------|----------------|----------|
| checkout-outage | `342d447a...82bb8` | `876d100d...262c9` |
| slow-burn | `85783011...15d19` | `03fdccaf...bba1` |
| ambiguous | `a4e85249...febe` | `718bd055...dabd6` |

## Files Created/Modified

- `src/core/serialization.ts` - the one-line Limits projection (the only `src/core` edit in the phase)
- `tests/core/serialization.test.ts` - Limits line and truncated-yes tests; both heading-order tests unchanged
- `tests/ui/copy.test.ts` - line-count table 71, 80, 80
- `tests/ui/demo-rehearsal.test.ts`, `tests/core/output-fingerprint.test.ts` - new
- `.planning/phases/05-hardening-and-conditional-polish/05-render-check.mjs` - section `rehearse`
- `README.md` - Verification, Limitations, Export bullet

## Re-verification of earlier requirements (reverifies, not completed here)

`requirements-completed: []` on purpose. Checkboxes and traceability Status for these IDs are untouched, and `requirements.mark-complete` was not run.

- INPUT-06 (Phase 2, typed warnings and diagnostics kept): `demo-rehearsal.test.ts` asserts every warning and diagnostic appears in the footer view and the Markdown; the browser shows the ambiguous warning text under `1 warning`.
- RANK-06 (Phase 3, low-confidence and no-clear-culprit stay explicit): ambiguous caution lead, four labels in order and `- Labels: low-confidence, ambiguous, weak-evidence, no-clear-culprit` in both the console and the Markdown; fingerprints pin the ranking output.
- FIX-03 (Phase 3, byte-identical results): fingerprints for all three cases, reverse-order and CRLF equality.
- UX-07 (Phase 4, trust footer shows assumptions, UTC and limits): footer view test and the browser check of the opened disclosure at both sizes.
- UX-08 (Phase 4, copy Markdown with fallback): copy line counts 71, 80, 80, the denied-clipboard fallback text and the granted `copied (71 lines)` status in Chrome.

## Decisions Made

- Raw integers in the Limits line, so the export never depends on locale formatting.
- The fingerprint test has no update mode; the comment above the constant says Plan 05-04 polish must leave it untouched.
- The `Host gate:` verdict is the file's last line; the combined `Polish gate:` verdict and `05-DOCKER-EVIDENCE.md` are deliberately not written here.

## Deviations from Plan

None - plan executed as written. Notes:

- The first RED run covered the Limits assertions (8 failures) before the core edit; the fingerprint constants were then computed with a throwaway scratch test that was deleted before the commit.
- `git.base-branch` reports `master` as protected; commits were made on `master` as in Plans 05-01 and 05-02 (sequential executor on the main working tree, `branching_strategy` is `none`). No `git update-ref` or history rewrite.
- A first attempt to patch the render check through a bash heredoc failed on quoting before writing anything; the patch was redone with a script file. No files were affected.

**Total deviations:** 0 auto-fixed. **Impact:** none.

## Issues Encountered

None in the product. Windows working-tree files that were CRLF stay CRLF; git normalizes them (warnings on add).

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. T-05-10 mitigated (Limits line pinned by tests and fingerprints); T-05-11 mitigated (six fingerprints, order and CRLF independence); T-05-12 mitigated (rehearsal under `connect-src 'none'`, zero console errors and zero off-origin requests); T-05-SC: no package installed, `node:crypto` is a built-in used only in tests.

## Human-check for end-of-phase UAT (non-blocking here)

- From a fresh private browser window run `npm run build`, then `node scripts/serve-dist.mjs --host 127.0.0.1 --port 4173`, open http://127.0.0.1:4173/, use "Try the checkout outage", then load Slow-burn and Ambiguous from the console. For each, open "Assumptions and caveats", press "Copy Markdown postmortem" and paste into a text editor. Expect each case to load in one click, the ambiguous case to show the caution banner with its four labels and "1 warning", and the pasted Markdown to contain the UTC disclosure, the Limits line, the assumptions and (ambiguous) the labels and warning, with nothing reading as a certain cause. Not run by the executor; no browser rehearsal result is claimed for this item.

## Next Phase Readiness

Ready for 05-04, whose Task 1 precondition needs both gate halves.

Next steps for the person:

1. Push master (`git push origin master`) now that this plan's commits have landed, so the `ci` workflow runs on the final hardening tree. Keep that run's URL or id and the commit sha for the 05-04 precondition checkpoint.
2. Record the Docker result in `05-DOCKER-EVIDENCE.md` from that ci run or a Docker-host check. It does not exist yet and was not created here.

## Self-Check: PASSED

Created files exist (`tests/ui/demo-rehearsal.test.ts`, `tests/core/output-fingerprint.test.ts`); modified files exist; commits `b49956d` and `1e261c4` are on `master`; `git diff e7c67d2..HEAD -- src/core` names only `src/core/serialization.ts`; README has 0 occurrences of `still pending`; acceptance criteria re-checked through the host runs below. `05-DOCKER-EVIDENCE.md` was not created.

## Polish gate evidence

Host checks, run on the final working tree (Windows 11, Git Bash, host Node v24.14.1 against the pinned 22.x, Chrome at `C:\Program Files\Google\Chrome`):

| Command | Result | Key counts |
|---------|--------|------------|
| `npm run typecheck && npm test && npm run build` | PASS | typecheck clean; 38 test files, 637 tests; build emitted `index.html`, `assets/index-Bhn6x8di.js`, `assets/index-L2vJhBjQ.css`, `assets/analyze.worker-BH5YM-EM.js` |
| `npm test -- --run tests/core/rebuild-surface.test.ts` | PASS | 1 file, 7 tests |
| `node scripts/serve-dist.mjs --smoke` | PASS | 20 PASS lines, last line `SMOKE PASS` |
| `node .planning/phases/05-hardening-and-conditional-polish/05-render-check.mjs` (profile, a11y, rehearse) | PASS | 200 PASS lines, 0 FAIL, 0 WARN, last line `RESULT PASS`; analyze-to-result 316 ms, main thread answered in 1 ms, longest result task 67 ms; rehearse covered 3 cases x 2 sizes plus one granted-clipboard and one motion run with 0 console errors and 0 off-origin requests |
| `node .planning/quick/261020-gzd-landing-page-with-feature-tabs-and-scrol/261020-gzd-render-check.mjs` | PASS | 430 PASS lines, 0 FAIL, last line `RESULT PASS` |

Clean-clone rehearsal (copied from 05-01-SUMMARY.md, run at Plan 05-01 on the tree before this plan): PASS, fresh `git clone`, `npm ci --offline --no-audit --no-fund`, typecheck, test, build and smoke; no `w/crlf` entries; 35 test files, 596 tests; last line `SMOKE PASS`. Not repeated for this plan's tree.

Failing items: none.

Docker evidence: PENDING — not runnable on this host; to be recorded in 05-DOCKER-EVIDENCE.md from the ci run of the pushed hardening commit or a Docker-host check

This verdict is the host half only. It is necessary but not sufficient for polish: the full gate also needs a PASS Docker build and container probe for the same product tree, which this host cannot produce.

Host gate: GREEN
