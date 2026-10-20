---
phase: quick-261020-ftp
plan: 01
subsystem: ui
tags: [motion, reduced-motion, command-palette, svg, accessibility, vitest]
requires:
  - phase: 04-incident-console-and-investigation-flow
    provides: console UI, UI-SPEC, Raycast restyle (quick 261020-exy)
provides:
  - gated entrance choreography, verdict reveal, timeline draw-in, card sparkline sweep, loading scanline, drawer slide
  - flat three-stripe header band and a faint drifting dot grid
  - command palette (/ and Ctrl/Cmd+K) on a native dialog
  - motionViolations design-rule gate and decorative-layer contrast pins
  - re-runnable render check with reduce and no-preference runs at 1280x720 and 360x740
affects: [POLISH-02, 04-UI-SPEC]
tech-stack:
  added: []
  patterns:
    - motion only through transform, opacity and stroke-dashoffset, all inside prefers-reduced-motion no-preference
    - base state is the final state; script adds classes and an aria-hidden overlay, never edits real text
    - per-result MotionScope disposed before every body rebuild
key-files:
  created:
    - src/ui/motion-model.ts
    - src/ui/motion.ts
    - src/ui/palette-model.ts
    - src/ui/palette.ts
    - tests/ui/motion-model.test.ts
    - tests/ui/palette-model.test.ts
    - .planning/quick/261020-ftp-add-motion-and-visual-life-to-the-culpri/261020-ftp-render-check.mjs
  modified:
    - src/ui/app.ts
    - src/ui/verdict.ts
    - src/ui/timeline.ts
    - src/ui/status.ts
    - src/styles.css
    - index.html
    - tests/ui/contrast.test.ts
    - tests/ui/static-safety.test.ts
    - .planning/phases/04-incident-console-and-investigation-flow/04-UI-SPEC.md
key-decisions:
  - "Card sparkline reveal uses a scaleX wipe, not stroke-dashoffset, because the line has a non-scaling stroke"
  - "Case-card focus-visible border uses ink-2 (same as hover), not hairline-strong, which would dim cards to about 1.6:1"
  - "Palette search handles Escape itself so one press closes it even though type=search clears itself on Escape"
  - "Timeline draw-in is a motion-draw class held only while animations run, so resize, stepping and filter never replay it"
patterns-established:
  - "motionViolations(css): brace-matched gated-block extraction with synthetic bad-CSS self-tests"
  - "Page-side animation sampler in the render check (getAnimations names and maximum per frame)"
status: complete
completed: 2026-10-20
plan_head_before: e8c4072625744331830574d0651b1fd68bf784f1
plan_head_after: f98b9cb33290bbfdc0c7e4cac945be37b6fb15f5
commits: 3
actuals:
  tokens: 34200
  tasks: 3
  commits: 3
---

# Phase quick-261020-ftp Plan 01: Motion and visual life Summary

**Gated, reduced-motion-safe motion for the whole console (staggered entrance, hash decode and count-up, timeline draw-in, card sweep, scanline, drawer slide), a flat red stripe band and dot grid, and a / and Ctrl/Cmd+K command palette, with the design-rules test relaxed only as far as gated transform, opacity and stroke-dashoffset motion.**

## What was added

Task 1 (tracer, `c302fef`): entrance choreography and verdict reveal end to end on the checkout case.
- `src/ui/motion-model.ts`: `MOTION_TIMING`, `easeOutCubic`, `decodeFrame`, `countFrame`, `planEntrance` (pure, no clock or randomness).
- `src/ui/motion.ts`: `prefersMotion`, `resultSections`, `playEntrance` returning a disposable `MotionScope`; the only file using animation-frame APIs. The hash, score and matches roll on an `aria-hidden` `.roll-ghost` overlay, so the real text node is exact from first paint and removed overlays always leave exact text.
- `verdict.ts` carries `data-roll` hooks; `app.ts` disposes the previous scope in every body rebuild and plays the entrance once per `requestId` (the stale re-render during loading never replays it).
- `styles.css`: motion tokens, `.score-fill` now `scaleX(var(--fraction))`, one consolidated gated block.
- `contrast.test.ts`: the old "no transition" test is replaced by `motionViolations(css)` with 12 failing synthetic snippets and one clean one; every other design rule is unchanged. `static-safety.test.ts`: animation-frame APIs allowed only in `src/ui/motion.ts`.

Task 2 (`1b83661`): timeline life, cards, loading, drawer, stripes, ambient.
- Timeline: `series-draw` line (`pathLength` 1), onset wipe, staggered `--pop-index` marker pop, one-shot `marker-pulse` on the leading marker, 200 ms crossfade on filter redraws, 150 ms readout fade (alternating `is-swap-a`/`is-swap-b`). The `motion-draw` class is held by `motion.ts` only while animations run.
- Cards sweep their sparkline in on hover and focus; the loading placeholder gets a 3-sweep `.scanline`; the drawer slides in from the right (from below on phones) over a fading backdrop and still closes instantly.
- `.header-stripes` (three flat skewed stripes, `#ff5757`, `#e04848`, `#a1131a` at 0.24, 0.32, 0.5) and `.ambient` dot grid (0.04, one 48 s `motion-drift` loop), both aria-hidden, pointer-events none, hidden in print and forced colours.
- Contrast pins: every stripe opacity at most 0.5, ambient at most 0.04, ink, ink-2 and muted at 4.5:1 or better over each stripe, over each stripe on an ambient dot, and over the dot alone.

Task 3 (`f98b9cb`): command palette and UI-SPEC.
- `palette-model.ts` (entries, label filter, wrap-around reducer, count text, shortcut predicate) and `palette.ts` (native `<dialog>` combobox plus listbox, polite count, focus return to the opener). `/` outside editable targets and Ctrl/Cmd+K open it; a visible "Press / to jump to a case" button does too. Choosing a case closes then loads; choosing own files closes without focus restore and focuses the log field.
- `04-UI-SPEC.md`: new Motion Contract, stripe and ambient token table with contrast figures, palette trigger row, drawer, timeline, loading, keyboard map rows and the reduced-motion bullet updated in place.

## Stripe and ambient contrast figures (muted `#9c9c9d`, the weakest text colour)

| Layer | Over page | Over an ambient dot |
|-------|-----------|---------------------|
| stripe-1 `#ff5757` @ 0.24 | 5.42 | 4.98 |
| stripe-2 `#e04848` @ 0.32 | 5.13 | 4.69 |
| stripe-3 `#a1131a` @ 0.5 | 5.29 | 5.02 |
| ambient dot alone | 6.89 | n/a |

Ink is 11.70 to 13.54 and ink-2 8.09 to 9.35 over the stripes; no opacity had to be lowered.

## Verification

- `npm run typecheck` green; `npm test` green: 31 files, 514 tests (baseline before the plan: 29 files, 455 tests); `npm run build` green.
- `git diff --name-only e8c4072 -- src/core package.json package-lock.json .planning/ROADMAP.md .planning/REQUIREMENTS.md` prints nothing.
- Render check (`261020-ftp-render-check.mjs`): `RESULT PASS`, 166 PASS lines, no FAIL or WARN, no console errors, no off-origin requests. Screenshots in `%TEMP%\culprit-261020-ftp` (result, hover, timeline, drawer, palette in both modes and sizes).

### Render-check observations, reduce runs (`prefers-reduced-motion: reduce`, 1280x720 and 360x740)
- Real text exact at first detection (hash `2222222`, score `0.91`, `Matches 5 of 5 errors`); zero running animations at first detection and a sampler maximum of 0 with no `.roll-ghost` and no names after 700 ms; ambient drift not running.
- Score fill `scaleX` 0.912065 immediately; settled full text exact; no `.is-rolling`.
- Card hover, timeline scrolled into view, slider step, drawer open and palette open all sampled zero animations; sparkline ends with dasharray `none` and transform `none`; hovered border `rgb(205, 205, 205)` (ink-2).
- Escape closed the drawer immediately with focus on Inspect evidence; HIT_PROBE passed (9 buttons, smallest 36 px drawn height); no horizontal scroll at 360 (also with the drawer and the palette open).

### Render-check observations, normal-motion runs (`no-preference`, both sizes)
- Real text exact at first detection; the entrance settled within the 5 s limit with up to 6 simultaneous animations, names `motion-rise` and `motion-fill`, an overlay observed, ambient `motion-drift` running; final full text exact, `.is-rolling` count 0, score fill 0.912065.
- Hover sampled `motion-wipe`; timeline scroll-in sampled `motion-draw-line`, `motion-wipe`, `motion-pop`, `motion-pulse`, `motion-fade`, then `.timeline` had released `motion-draw`; `.series-draw` `pathLength` 1.
- Stepping the slider replayed none of draw-line, wipe, pop, pulse and showed `motion-swap-a`; the drawer sampled `motion-drawer-in` plus `motion-fade` at 1280 and `motion-drawer-up` plus `motion-fade` at 360; the palette opening sampled `motion-palette-in` plus `motion-fade`.
- Palette (all four runs): `/` opens it with focus on the search field and 4 options, "4 results"; typing "slow" leaves one option, "1 result"; Escape closes it and focus lands on the trigger; trigger click then ArrowDown gives `aria-activedescendant` `palette-option-slow-burn`, Enter closes with focus returned to the trigger (captured in the close handler) and loads Slow-burn; Ctrl+K opens it from the timeline slider and Escape returns focus to the slider; `/` inside the own-files textarea does not open it; choosing "Use your own files" focuses the form.
- Viewed screenshots: the 1280 result shows the normal verdict layout with the stripe band at the header right and a barely visible dot grid; the 360 result shows the stripes behind the wrapped header chips with text legible; the palette at 360 fits the width with every option, count line, key hints and Close visible.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Sparkline dash draw left a dashed line on hover**
- **Found during:** Task 2 (viewed `hover-1280-motion.png`)
- **Issue:** `stroke-dasharray: 1` on the hovered sparkline persisted after the animation and, with `vector-effect: non-scaling-stroke`, rendered a gapped line.
- **Fix:** the plan's own fallback: the card reveal is a `scaleX` wipe (`motion-wipe`, transform-origin left) instead of stroke-dashoffset; the `pathLength` attribute added to the sparkline was reverted, so `case-picker.ts` is unchanged. The render check asserts dasharray `none` and transform `none` after settling.
- **Files modified:** `src/styles.css`, render check. **Commit:** `1b83661`

**2. [Rule 1 - Bug] Escape did not close the palette once a query was typed**
- **Found during:** Task 3 render check
- **Issue:** `type="search"` clears itself on Escape and consumes the key, so the dialog stayed open.
- **Fix:** the search field handles Escape itself (`preventDefault`, `dialog.close()`), so one press always closes and returns focus.
- **Files modified:** `src/ui/palette.ts`. **Commit:** `f98b9cb`

**3. [Plan-expected] Case-card focus-visible border step**
- The brief names hairline-strong, but cards rest on the 3.6:1 control border and hairline-strong would dim them to about 1.6:1, so hover and `:focus-visible` both use the existing brighter ink-2 step.

**4. Render-check adjustments (test script only, no product change):** the own-files textarea sits in a collapsed `<details>`, so the "slash in a text field" check opens the disclosure before focusing; the slider step falls back to ArrowLeft when the selection already sits on the last interval; the palette focus-return assertion is captured in a page-side `close` listener because the result heading takes focus moments later.

**Total deviations:** 2 auto-fixed bugs plus the expected card-border step. **Impact:** none on scope; all brief decisions D-01 to D-08 delivered.

## Auth gates
None.

## POLISH-02 status
Partly delivered early: global shortcuts (`/`, Ctrl/Cmd+K) and purposeful reduced-motion-aware transitions are shipped. Suspect-stepping shortcuts are NOT shipped. REQUIREMENTS.md and ROADMAP.md are untouched (no test required a change) and POLISH-02 remains unchecked.

## Known Stubs
None. Decorative layers (`.header-stripes`, `.ambient`, `.scanline`, `.marker-pulse`) are intentionally empty and aria-hidden.

## Threat Flags
None: no new network endpoint, storage, auth path or trust boundary. The palette query is used only as input value and filter text (a markup-looking query is a tested no-match), and `static-safety` stays green.

## Self-Check: PASSED
- Created files present: `src/ui/motion-model.ts`, `src/ui/motion.ts`, `src/ui/palette-model.ts`, `src/ui/palette.ts`, `tests/ui/motion-model.test.ts`, `tests/ui/palette-model.test.ts`, `261020-ftp-render-check.mjs`.
- Commits reachable from HEAD: `c302fef`, `1b83661`, `f98b9cb`; `git rev-list --count e8c4072..HEAD` is 3.
- Servers and browsers started by the render check were stopped by its `finally` block; nothing is listening on 4173 or 9223.
