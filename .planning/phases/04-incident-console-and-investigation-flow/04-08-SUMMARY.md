---
phase: 04-incident-console-and-investigation-flow
plan: 08
subsystem: ui
tags: [plain-dom, own-files, drag-and-drop, validation-errors, vitest]

requires:
  - phase: 04-incident-console-and-investigation-flow
    provides: "Plans 04-01..04-07: worker client, state reducer, case picker, status/error panel, verdict, timeline, drawer, copy and trust footer"
provides:
  - "Use your own files: paste, file pick or drag-and-drop for a log and a Culprit JSON history, analyzed through the same state machine and worker client as bundled cases"
  - "Pre-read 1 MiB gate (checkFileSize on File.size before file.text()), log format Auto-detect/JSON-lines/Plain text with a Detected label, file chip with Remove file"
  - "buildErrorSummary: diagnostic-to-plain-language mapping with Fix input links that focus the field to fix; inputs stay filled"
  - "Two-step inline Clear inputs confirmation (focus on Keep inputs, Escape cancels)"
  - "README Using the console section and font note"
affects: []

estimate:
  tokens: 78000
  raw_tokens: 78000
  tasks: 3
  confidence: low

tech-stack:
  added: []
  patterns:
    - "inputs.ts builds the form once and updates it in place (refresh) so typing and file choices never lose focus"
    - "Stale async file reads are dropped with a per-field read token; the file input value is reset after each choice so the same file can be chosen again"
    - "Source names are always distinct (history/{name} on a collision) so a diagnostic maps to exactly one field"

key-files:
  created:
    - src/ui/intake.ts
    - src/ui/inputs.ts
    - tests/ui/intake.test.ts
  modified:
    - src/ui/view-model.ts
    - src/ui/status.ts
    - src/ui/case-picker.ts
    - src/ui/app.ts
    - src/styles.css
    - README.md
    - tests/ui/view-model.test.ts

key-decisions:
  - "File reads and the Clear inputs confirmation live in inputs.ts (not app.ts); the form owns its transient UI state and reports draft changes and a confirmed clear through handlers, so app.ts only holds the draft and dispatches start/cleared"
  - "A loaded file's text is also placed in the paste box (editing it detaches the file name), so what is analyzed is always visible and editable"
  - "A refused or unreadable file leaves any previously loaded file in place and shows a role=alert message under the field"

requirements-completed: []

coverage:
  - id: D1
    description: "Pasting the checkout log and history reaches the same verdict (2222222) under 'Result: pasted log'; a chosen file gives 'Result: {file name}'"
    requirement: UX-01
    verification:
      - kind: unit
        ref: "tests/ui/intake.test.ts#buildOwnAnalysisInput"
        status: pass
      - kind: command
        ref: "headless Chrome over CDP against the built preview: dropped incident.jsonl + pasted history gave 'Result: incident.jsonl' with 2222222 in the verdict and focus on the result title"
        status: pass
    human_judgment: false
  - id: D2
    description: "Files over 1 MiB are refused before reading with '{name} is {x.x} MiB. The limit is 1 MiB. Trim the file to the incident window and choose it again.' (exact boundary 1,048,576 accepted, 1,048,577 refused)"
    requirement: UX-08
    verification:
      - kind: unit
        ref: "tests/ui/intake.test.ts#checkFileSize"
        status: pass
      - kind: command
        ref: "CDP: a 1.5 MiB File on the log input showed the exact message in the role=alert element"
        status: pass
    human_judgment: false
  - id: D3
    description: "Validation errors use the mapped copy, keep inputs filled, move focus to the error heading, and each Fix input link focuses the field"
    requirement: UX-08
    verification:
      - kind: unit
        ref: "tests/ui/view-model.test.ts#buildErrorSummary"
        status: pass
      - kind: command
        ref: "CDP: history '{' showed \"The git history couldn't be read...\" with a Fix input link; focus was on the H3 heading; Fix input focused #own-history-text and the log text (2004 chars) stayed filled"
        status: pass
    human_judgment: false
  - id: D4
    description: "Clear inputs two-step confirmation: focus lands on Keep inputs, Escape cancels and returns focus to Clear inputs, confirming empties the fields, leaves a shown result, and returns an error page to the empty state"
    requirement: UX-09
    verification:
      - kind: command
        ref: "CDP against the built preview: Keep inputs focused, Escape closed the row, confirm emptied both fields with 'Result: incident.jsonl' retained; after an error the page returned to the empty state"
        status: pass
    human_judgment: true
    rationale: "Real keyboard operation and visible focus rings are confirmed in the Task 3 walk-through."
  - id: D5
    description: "Drop zone cue is not colour alone: dashed to solid border and the text changes to 'Release to load'; keyboard path via the visually hidden file input"
    requirement: UX-09
    verification:
      - kind: command
        ref: "CDP: dragover set is-drag-over and 'Release to load'; dragleave restored 'Drop a file or choose one'"
        status: pass
    human_judgment: true
    rationale: "Visual look of the zone, 320px layout and the 200-character file-name wrap are checked in the Task 3 walk-through."

duration: 40 min
status: partial
plan_head_before: eca8085f6cf2089698fa6ba8fcda0516401e1abf
plan_head_after: 8e307b6f2e8eadfebc683d44a805473081980b03
commits: 3
---

# Phase 4 Plan 08: Bring your own log and history, recoverable validation errors, and the end-of-phase walk-through (PARTIAL: Tasks 1-2 done, Task 3 checkpoint pending)

**Developers can analyze their own incident by pasting, picking or dropping a log and a Culprit JSON history, with a 1 MiB pre-read gate, format auto-detection, plain-language field-mapped errors with Fix input links, and a safe two-step Clear inputs; the plan stops at the single end-of-phase human walk-through.**

## Status

Tasks 1 and 2 are complete and committed. Task 3 (`checkpoint:human-verify`, `gate="blocking"`) is awaiting the user. This summary is partial; it is finalized (requirements marked complete, `status: complete`) after the user replies. Requirement IDs UX-08, UX-09 and UX-01 are therefore not yet marked complete.

## Task Commits

1. **Task 1 (tracer): paste a log and a history, analyze, get the verdict or field-mapped errors** - `f83f324`
2. **Task 2 RED: failing tests for file size gate, display text and README notes** - `53f6476`
3. **Task 2 GREEN: file pick, drag-and-drop, 1 MiB gate, format choice, Clear inputs, README** - `8e307b6`

## Accomplishments

- Task 1 was inherited from the interrupted executor; its tests (`intake`, `view-model`, `tracer`, `static-safety`) were re-run and pass.
- `checkFileSize`, `formatFileSize`, `detectedFormatLabel`, `fileChipText` added to `src/ui/intake.ts`; the boundary is exact (1,048,576 accepted, 1,048,577 refused).
- `src/ui/inputs.ts` now has drop zones (hidden but focusable file inputs, `.jsonl,.log,.txt` / `.json`), the dashed-to-solid drag cue with 'Release to load', file chip with 'Remove file', role=alert refusal messages, the log format select with the Detected label, and Clear inputs with the inline confirmation.
- README gained "Using the console" and the Geist font note (FONTS.md); `tests/core/rebuild-surface.test.ts` still passes.
- Early browser signal (not the sign-off): headless Chrome over CDP against the built preview exercised toggle, disabled reason, oversize refusal, drag cue, dropped file, paste, analyze (2222222), Clear inputs flow, history-`{` error with Fix input, and error-page clear. No page overflow at 1262px.

## Verification

`npm run typecheck`, `npm test` (29 files, 437 tests) and `npm run build` pass at `8e307b6`.

## Deviations from Plan

None - plan executed as written. One structural choice: the plan's step 3 has app.ts own the async file reads and confirmation state; they live in `inputs.ts` instead (see key-decisions), which keeps the `checkFileSize(` before `file.text()` key link inside inputs.ts as the plan's key_links require.

## Known Stubs

None.

## Threat Flags

None. T-04-22 mitigated (size gate before read, boundary tested), T-04-23 (text-only DOM, `static-safety.test.ts` green), T-04-24 (`safeSourceName` fallbacks tested), T-04-25 (no storage API, inputs in memory only). T-04-26 and T-04-SC-08: no fonts added, no package installed.

## Pending: Task 3 checkpoint

See the checkpoint return to the orchestrator for the exact walk-through steps (0-8, including the optional Geist fonts step). After "approved with fonts", FONTS.md "Current status" becomes "Geist bundled locally" and `npm test` / `npm run build` are re-run.

## Self-Check: PASSED

`src/ui/intake.ts`, `src/ui/inputs.ts`, `tests/ui/intake.test.ts` exist; commits `f83f324`, `53f6476`, `8e307b6` are ancestors of HEAD.
