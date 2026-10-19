---
phase: 04-incident-console-and-investigation-flow
plan: 07
subsystem: ui
tags: [plain-dom, clipboard, markdown-postmortem, trust-footer, vitest]

requires:
  - phase: 04-incident-console-and-investigation-flow
    provides: "Plan 04-03 verdict actions row and formatters; Plan 04-06 drawer session API and verdict actions row"
provides:
  - "Copy Markdown postmortem: serializeMarkdown(toAnalysisResult(stream)) computed on each copy, clipboard write with a visible selected-textarea fallback"
  - "Copy-feedback reducer (reduceCopyFeedback) with no timers"
  - "Warnings and caveats trust footer on every done result, plus the truncation banner"
  - "Locale-free formatInteger"
affects: [04-08]

estimate:
  tokens: 56000
  raw_tokens: 56000
  tasks: 2
  confidence: low

actuals:
  tokens: 11500
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "renderCopyControl returns { element, button, update } so the button node (and its focus) is never replaced when feedback changes; the role=status line is always in the DOM"
    - "copyText takes an injected { clipboard, protocol } environment so every clipboard path is unit-tested without a DOM"
    - "composeResult in app.ts appends the trust footer last and prepends the truncation banner for every done kind"

key-files:
  created:
    - src/ui/copy.ts
    - src/ui/trust-footer.ts
    - tests/ui/copy.test.ts
  modified:
    - src/ui/state.ts
    - src/ui/verdict.ts
    - src/ui/app.ts
    - src/ui/view-model.ts
    - src/ui/format.ts
    - src/styles.css
    - tests/ui/view-model.test.ts
    - tests/ui/format.test.ts

key-decisions:
  - "Copy feedback resets on every new result, every drawer open, every Previous/Next step and every drawer close event; there is no timer"
  - "Hide Markdown returns focus to the copy button so the focus target is never lost"
  - "In the verdict actions row the copy control uses display: contents so the button joins the row and the status and fallback wrap onto their own line; under a state panel it is a standalone flex block"
  - "A result with no warnings or diagnostics shows 'No warnings or diagnostics were reported.' under the footer heading (planner discretion, no count chip)"
  - "The count chip counts warnings plus diagnostics, singular/plural via plural()"

requirements-completed: [UX-07, UX-08, UX-09]

coverage:
  - id: D1
    description: "Copy Markdown postmortem puts serializeMarkdown(toAnalysisResult(stream)) on the clipboard, byte-identical for direct, worker-cloned and repeated analyses; success status 'Markdown postmortem copied (N lines).' (70/79/79 for checkout/slow-burn/ambiguous); button label never changes"
    requirement: UX-07
    verification:
      - kind: unit
        ref: "tests/ui/copy.test.ts#buildPostmortemMarkdown (UI-SPEC Verification Hook 6)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Clipboard missing, rejecting, throwing or file: reveals the selected read-only box with the warning message and a Hide Markdown button; status persists with no timer; reset on result and drawer interaction"
    requirement: UX-07
    verification:
      - kind: unit
        ref: "tests/ui/copy.test.ts#copyText and #reduceCopyFeedback"
        status: pass
      - kind: command
        ref: "headless Chrome over CDP against the built preview: native click fell back with 6187 characters selected; stubbed clipboard gave 'copied (70 lines)' with 70 newlines; status survived 1.5 s; drawer open cleared it"
        status: pass
    human_judgment: true
    rationale: "Real clipboard permission and insecure-context (LAN) behaviour, and paste fidelity, need a real browser session; deferred to the Plan 04-08 walk-through as the plan states."
  - id: D3
    description: "No-incident, insufficient-data and no-eligible-commits results offer the copy control under the state panel"
    requirement: UX-07
    verification:
      - kind: other
        ref: "src/ui/app.ts renderSettled places createCopyControl() under renderStatePanel; build and typecheck pass"
        status: unknown
    human_judgment: true
    rationale: "Placement for the three state-panel kinds was not exercised in a browser; only the verdict path was driven."
  - id: D4
    description: "Warnings and caveats footer lists every warning then diagnostic (source/code, line, message), count chip ('1 warning' for ambiguous), and a closed 'Assumptions and caveats' disclosure whose summary shows 'UTC · local · not proof' and holds rationale, assumptions, versions, provenance, exact limits line and the UTC note"
    requirement: UX-08
    verification:
      - kind: unit
        ref: "tests/ui/view-model.test.ts#buildTrustFooterView"
        status: pass
      - kind: unit
        ref: "tests/ui/format.test.ts#formatInteger"
        status: pass
    human_judgment: false
  - id: D5
    description: "Truncated input shows 'Input was truncated at the limit; results use only the lines that were read.' at the top of the result"
    requirement: UX-08
    verification:
      - kind: unit
        ref: "tests/ui/view-model.test.ts#shows the truncation banner and renders diagnostics after warnings"
        status: pass
    human_judgment: true
    rationale: "No bundled case is truncated, so the banner rendering was verified by the view-model test only, not visually."
  - id: D6
    description: "Keyboard operability and no horizontal page scroll at 360px (UX-09) for the copy control and footer"
    requirement: UX-09
    verification:
      - kind: command
        ref: "headless Chrome over CDP: 360x740 scrollWidth 360 equals clientWidth 360; copy button 296x44"
        status: pass
    human_judgment: true
    rationale: "Real-keyboard and touch sign-off deferred to the Plan 04-08 walk-through."

duration: 15 min
completed: 2026-10-19
status: complete
plan_head_before: 0fefeb8e0a2cd0882400e5dcb77b764ce893ce09
plan_head_after: 7cbe3d96a26b07a026ce48bf36d4f9bdecf7bb72
commits: 3
---

# Phase 4 Plan 07: Markdown postmortem copy and the trust footer Summary

**A one-click "Copy Markdown postmortem" that copies exactly serializeMarkdown(toAnalysisResult(stream)) with an announced success line or a selected read-only fallback box, plus a "Warnings and caveats" footer and truncation banner that keep every warning, diagnostic, assumption, limit and the UTC note beside the result.**

## Performance

- **Duration:** about 15 min
- **Completed:** 2026-10-19T18:03:00Z
- **Tasks:** 2
- **Files:** 11 (3 created, 8 modified)

## Accomplishments
- `src/ui/copy.ts`: `buildPostmortemMarkdown`, `markdownLineCount`, `copyText` (file:, missing clipboard, rejected or throwing write all resolve to `'fallback'`; the legacy copy command is not used), `renderCopyControl`.
- `src/ui/state.ts`: `CopyFeedback`, `CopyEvent`, `reduceCopyFeedback`, `COPY_FALLBACK_MESSAGE`; no timers.
- `src/ui/app.ts`: copy control in the verdict actions row (after Inspect evidence) and under the state panel for no-suspect results; stale-result guard on the async clipboard write; `composeResult` appends the footer last and prepends the truncation banner.
- `src/ui/view-model.ts`, `src/ui/trust-footer.ts`, `src/ui/format.ts`: `buildTrustFooterView`, `renderTrustFooter`, `renderTruncationBanner`, `formatInteger`.
- Headless Chrome (CDP) against the built preview: checkout footer closed with summary "Assumptions and caveatsUTC · local · not proof" and no chip; native click in headless fell back with the whole 6,187-character Markdown selected in the focused textarea; Hide Markdown cleared it and returned focus to the button; a stubbed clipboard gave "Markdown postmortem copied (70 lines)." with 70 newlines in the received text; the status persisted past 1.5 s and cleared on drawer open; ambiguous showed "1 warning", the warning text, and the full disclosure with the exact limits and UTC lines; at 360px no horizontal scroll and the button is 44px high; no console errors.

## Task Commits

1. **Task 1 (tracer): copy button, on-demand Markdown, clipboard, status line or selected fallback** - `4ebd8b1` (feat)
2. **Task 2 RED: failing tests for footer view and integer formatting (typed stubs)** - `becee0d` (test)
3. **Task 2 GREEN: footer, truncation banner, formatInteger** - `7cbe3d9` (feat)

**Plan metadata:** committed separately (docs: complete plan)

## Tracer gate

Task 1 tracer verified end to end (copy tests, page-states, static-safety, typecheck, build) before Task 2. `human_verify_mode` is `end-of-phase` and the tracer `<verify>` is automated-only, so no checkpoint was raised.

## TDD notes (Task 2)

- RED (`becee0d`): `formatInteger` and `buildTrustFooterView` were typed stubs; 8 new tests failed on values with typecheck green. Valid RED.
- GREEN (`7cbe3d9`): 28 files / 405 tests pass, typecheck and build pass.
- REFACTOR: none needed.

## Files Created/Modified
- `src/ui/copy.ts`, `src/ui/trust-footer.ts`, `tests/ui/copy.test.ts` - new
- `src/ui/state.ts`, `src/ui/verdict.ts`, `src/ui/app.ts`, `src/ui/view-model.ts`, `src/ui/format.ts` - reducer, placement, composition, footer view, integer formatting
- `src/styles.css` - copy control, status line, fallback box, footer, disclosure
- `tests/ui/view-model.test.ts`, `tests/ui/format.test.ts` - extended

## Decisions Made
See `key-decisions` in the frontmatter.

## Deviations from Plan

None - plan executed exactly as written. Two small discretionary additions: the "No warnings or diagnostics were reported." line for a clean result, and `renderVerdict` taking an optional `extraActions` argument to place the copy control in the actions row.

## Issues Encountered
- Task 2's human-check (real browser, LAN insecure context) is non-blocking and deferred to Plan 04-08; the CDP run above is an early signal only. The headless native click falling back is a real clipboard refusal, which doubled as a fallback-path check, but the success path was exercised with a stubbed clipboard.
- The branch is `master`, which `git.base-branch --is-protected` reports as protected. The dispatch explicitly directed this sequential executor to commit on master (as Plans 04-01 to 04-06 did, `branching_strategy: none`), so the pre-commit assertion was noted and not overridden in config.

## Known Stubs

None. (The RED stubs existed only between `becee0d` and `7cbe3d9`.)

## Threat Flags

None. T-04-19 mitigated: the UI copies exactly `serializeMarkdown(toAnalysisResult(stream))`, proven byte-equal by tests. T-04-20 mitigated: every outcome is visible in a role=status line, failure reveals selected text, no legacy copy command (asserted by a source test). T-04-21 mitigated: all text goes through `el`/`textContent` and the textarea `value`; `static-safety.test.ts` stays green. T-04-SC-07: no package installed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Ready for Plan 04-08: the human-check items (clipboard on localhost versus an insecure LAN origin, real keyboard walk through load, timeline, drawer and copy, truncation banner on a genuinely truncated input) are queued for its walk-through.

## Self-Check: PASSED

`src/ui/copy.ts`, `src/ui/trust-footer.ts` and `tests/ui/copy.test.ts` exist; commits `4ebd8b1`, `becee0d` and `7cbe3d9` are ancestors of HEAD; `npm run typecheck`, `npm test` (28 files, 405 tests) and `npm run build` pass.

---
*Phase: 04-incident-console-and-investigation-flow*
*Completed: 2026-10-19*
