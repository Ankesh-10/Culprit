---
phase: quick-261020-ftp
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/ui/motion-model.ts
  - src/ui/motion.ts
  - tests/ui/motion-model.test.ts
  - src/ui/verdict.ts
  - src/ui/app.ts
  - src/styles.css
  - tests/ui/contrast.test.ts
  - tests/ui/static-safety.test.ts
  - src/ui/timeline.ts
  - src/ui/case-picker.ts
  - src/ui/status.ts
  - index.html
  - src/ui/palette-model.ts
  - src/ui/palette.ts
  - tests/ui/palette-model.test.ts
  - .planning/quick/261020-ftp-add-motion-and-visual-life-to-the-culpri/261020-ftp-render-check.mjs
  - .planning/phases/04-incident-console-and-investigation-flow/04-UI-SPEC.md
autonomous: true
requirements: [POLISH-02, UX-09]

estimate:
  tokens: 110000
  raw_tokens: 110000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "Loading the checkout case makes the status banner and every result section fade and rise 12px over 600ms with an 80ms stagger; the hash decodes to 2222222, 'Matches 5 of 5 errors' and the 0.91 score count up, and the score and confidence meters fill, all ending on the exact values (D-01, D-03)"
    - "From the first paint the real text of the hash, score and match count is exact for assistive tech and tests (the scramble is an aria-hidden overlay), and no wrong value stays visible after the reveal or when it is skipped (D-03, D-10)"
    - "With prefers-reduced-motion: reduce the console shows every final state instantly: no running animation, no overlay, exact text, full meters, fully drawn line (D-10)"
    - "On a new result the timeline line draws in, the onset band wipes in from its left edge, commit diamonds pop in staggered and the #1 marker pulses once; stepping the slider never replays the draw-in, a filter change only crossfades the series, and the readout text fades in 150ms (D-02)"
    - "Hovering or keyboard-focusing a case card brightens its border and draws its sparkline in; first-load analysis shows a thin scanline over the text placeholder; the suspect drawer slides in from the right over a fading backdrop and closes instantly with focus returning to its opener (D-04, D-05)"
    - "The header carries one flat three-stripe red band behind its text and the page has a faint drifting dot grid; neither uses a gradient, shadow or glass, and header text stays at 4.5:1 or better over them (D-06, D-07, D-12)"
    - "Pressing / outside a text field, or Ctrl/Cmd+K, opens a command palette that filters the three cases plus 'Use your own files', moves with ArrowUp/ArrowDown, loads with Enter, closes with Esc, returns focus to the opener and announces the result count; a visible 'Press / to jump to a case' button opens it too (D-08)"
    - "npm run typecheck, npm test and npm run build are green, src/core and the package manifests are untouched, and the design-rules test still fails on gradients, shadows, glass, ungated motion or animated properties other than transform, opacity and stroke-dashoffset (D-09, D-12, D-13, D-14)"
  artifacts:
    - path: "src/ui/motion-model.ts"
      provides: "DOM-free motion maths: MOTION_TIMING, easeOutCubic, decodeFrame, countFrame, planEntrance"
      contains: "export function decodeFrame"
    - path: "src/ui/motion.ts"
      provides: "DOM driver: prefersMotion, resultSections, playEntrance returning a disposable MotionScope; the only file allowed to use animation-frame APIs"
      contains: "requestAnimationFrame"
    - path: "tests/ui/motion-model.test.ts"
      provides: "Frame-function, stagger-plan and CSS/JS timing-parity tests"
      contains: "countFrame"
    - path: "src/ui/palette-model.ts"
      provides: "Pure palette entries, filtering, keyboard reducer, count text and shortcut predicate"
      contains: "export function isPaletteShortcut"
    - path: "src/ui/palette.ts"
      provides: "Native <dialog> command palette with combobox + listbox and focus return"
      contains: "listbox"
    - path: "tests/ui/palette-model.test.ts"
      provides: "Filtering, wrap-around keyboard model, count text and shortcut predicate tests"
      contains: "isPaletteShortcut"
    - path: "src/styles.css"
      provides: "Motion tokens, gated motion block, stripe and ambient tokens and layers, palette styles"
      contains: "prefers-reduced-motion: no-preference"
    - path: "tests/ui/contrast.test.ts"
      provides: "Relaxed-but-strict design rules (motionViolations with synthetic self-tests) and decorative-layer contrast"
      contains: "motionViolations"
    - path: "tests/ui/static-safety.test.ts"
      provides: "Narrow allow-list: animation-frame APIs only in src/ui/motion.ts"
      contains: "src/ui/motion.ts"
    - path: "index.html"
      provides: "Header stripe band, ambient dot grid, palette trigger and palette dialog"
      contains: "id=\"command-palette\""
    - path: ".planning/quick/261020-ftp-add-motion-and-visual-life-to-the-culpri/261020-ftp-render-check.mjs"
      provides: "Headless render check with reduced-motion and normal-motion runs at 1280x720 and 360x740"
      contains: "Emulation.setEmulatedMedia"
    - path: ".planning/phases/04-incident-console-and-investigation-flow/04-UI-SPEC.md"
      provides: "Motion contract, reduced-motion contract, palette, stripe band, keyboard map, POLISH-02 note"
      contains: "Motion Contract"
  key_links:
    - from: "src/ui/app.ts"
      to: "src/ui/motion.ts"
      via: "render() disposes the previous MotionScope and, for a done result with a new requestId, calls playEntrance(resultSections(statusRegion, body))"
      pattern: "playEntrance\\(resultSections\\("
    - from: "src/ui/verdict.ts"
      to: "src/ui/motion.ts"
      via: "data-roll=\"decode\" on .verdict-hash and data-roll=\"count\" on .score-value and the matches fact; playEntrance starts a roll for each"
      pattern: "data-roll"
    - from: "src/ui/timeline.ts"
      to: "src/styles.css"
      via: "the primary series path carries class series-draw and pathLength 1; .motion-draw rules animate it"
      pattern: "series-draw"
    - from: "tests/ui/motion-model.test.ts"
      to: "src/styles.css"
      via: "--motion-stagger and --motion-enter in :root equal MOTION_TIMING.staggerMs and enterMs"
      pattern: "motion-stagger"
    - from: "src/ui/app.ts"
      to: "src/ui/palette.ts"
      via: "mountCommandPalette(doc, { entries: paletteEntries(BUNDLED_CASES), onLoad: loadById, onOwnFiles })"
      pattern: "mountCommandPalette\\("
    - from: "src/ui/palette.ts"
      to: "index.html"
      via: "dialog#command-palette and button#palette-trigger looked up by id"
      pattern: "palette-trigger"
    - from: "tests/ui/contrast.test.ts"
      to: "src/styles.css"
      via: "motionViolations(css) must be empty; the same function flags synthetic bad CSS"
      pattern: "motionViolations\\(css\\)"
---

<objective>
Give the Culprit console purposeful motion and visual life (user feedback after the Raycast restyle: "very minimal and lackluster, add some interesting things, motion and all") without weakening any accessibility, determinism, offline or safety rule.

Decision IDs used in this plan map to the brief `261020-ftp-BRIEF.md`:
- D-01 entrance choreography; D-02 timeline life; D-03 verdict reveal; D-04 case cards and loading; D-05 drawer; D-06 header stripe band; D-07 ambient layer; D-08 command palette.
- Hard rules: D-09 motion only via transform, opacity, stroke-dashoffset; D-10 every animation gated by `prefers-reduced-motion: no-preference`, base state is the final state, a JS failure never hides content; D-11 no timer or animation blocks input or focus, all pending motion cancelled when a new result renders; D-12 no gradients, box-shadow (other than existing inset), glass, backdrop-filter or looping attention-seeker (one-shot pulse; ambient drift is the only new loop, gated); D-13 keep every DOM id, ARIA contract, focus behaviour and tested copy, relax the design-rules test only as specified, add DOM-free tests for the pure parts; D-14 no network, no new dependency, `src/core/` untouched; D-15 static-safety stays green with a narrow animation-frame allow-list; D-16 update 04-UI-SPEC.md; D-17 leave ROADMAP/REQUIREMENTS alone (no test requires a change) and report POLISH-02 status in the summary only.

Purpose: the demo should feel alive and premium within seconds while remaining a calm, trustworthy investigation tool.
Output: two small motion modules, two small palette modules, three new or extended test files, markup hooks in verdict/timeline/case-picker/status, gated CSS, index.html layers, a re-runnable render check, and a synced UI-SPEC.
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.claude/CLAUDE.md
@.planning/quick/261020-ftp-add-motion-and-visual-life-to-the-culpri/261020-ftp-BRIEF.md
@.planning/quick/261020-exy-restyle-the-culprit-console-to-the-rayca/261020-exy-SUMMARY.md

Baseline commit at planning time: `e8c4072` (HEAD). The untracked `.claude/launch.json` is not part of this work: never stage it. Do not read 04-UI-SPEC.md (about 55 KB) before Task 3, and even then use Grep to find sections and Edit them in place.

<interfaces>
Facts gathered at planning time so you do not need to re-derive them:

- `src/ui/dom.ts`: `el(tag, { className?, text?, attrs?, on? }, children?)`, `svgEl(tag, attrs, children?)`, `clear(node)`, `icon(name, className?)`. Text-only construction; never build markup strings.
- `src/ui/app.ts` `render(previous)`: calls `renderStatus(statusRegion, ...)` first, returns early when `state.phase === 'loading' && previous.phase === 'loading'`, then switches. `loading` with `state.previous !== null` re-renders the stale result through `renderSettled(state.previous)` (this must NOT replay the entrance). The `done` branch: `showBody(renderSettled(state))` then `title.focus()`. `PageState` `done` carries `requestId`. `fixInput(target: 'log' | 'history')` opens the own-files form and focuses the field. `loadById(id)` loads a bundled case.
- `renderSettled` returns `div.result-stack` whose children are, in order: optional truncation banner, then either `section.verdict` (or `section.state-panel` + `div.copy-under-panel`), optional lineup, considered table, `div.investigation` (children: `section.timeline`, `div.log-slot` (often empty), signatures panel), trust footer.
- The status banner is `#status-region .status-banner` (hidden when no label); `renderStatus` reassigns its `className` on every render.
- `src/ui/verdict.ts`: `renderHeadline` builds `p.verdict-hash` (text = 7-char short sha) in both the suspect and "No clear culprit" modes; `renderScoreRow` builds `span.score-value` (text `0.91` for checkout); `renderFactValue` builds the `dd` for each fact, the `matches` fact text is `Matches 5 of 5 errors` for checkout and `Matches 0 of 4 errors` in another test. `renderScoreMeter` sets `--fraction` on `span.score-fill`. Confidence meter: `span.meter-segment` (`is-filled` when filled).
- `src/ui/timeline.ts` `renderTimeline`: `draw()` rebuilds the whole SVG; it runs at build time (960px default width), again from a `ResizeObserver` as soon as the real width is known, and again from `update()` when the filter changes. Unfiltered: `path.series-area` + `path.series-line`; filtered: `path.series-line.context-line` (gray total) + `path.series-area` + `path.series-line` (emphasised). Onset: `rect.onset-band` + `line.onset-bracket`. Markers: per commit a `polygon.marker-ring` then a `polygon.marker-leading|marker-ranked|marker-other`, leading drawn last. Legend keys reuse `.series-line`, `.onset-band` and marker classes inside `ul.chart-legend` (so motion selectors must be scoped to `.timeline-svg`). `syncReadout()` sets `readoutText.textContent`. `moveSelection()` only moves attributes.
- `src/ui/case-picker.ts`: cards (before any result) contain `svg.sparkline > path.sparkline-line` with `vector-effect="non-scaling-stroke"` and `preserveAspectRatio="none"`; after a result the picker becomes `.case-toggle` buttons (no sparklines). `OWN_TOGGLE_ID = 'own-files'`, `OWN_TOGGLE_TEXT = 'Use your own files'`.
- `src/ui/status.ts` `renderLoadingPlaceholder()`: `div.loading-placeholder > p` ("Analyzing locally..."), text only.
- `src/ui/drawer.ts`: native `dialog#suspect-drawer` opened with `showModal()`; Previous/Next re-fill content while `[open]` stays; close is synchronous and restores focus. No TS change is needed for D-05.
- `src/ui/cases.ts` `BUNDLED_CASES`: ids `checkout-outage`, `slow-burn`, `ambiguous`; names "Checkout outage", "Slow-burn inventory failure", "Ambiguous search regression"; each has `purpose`.
- `src/styles.css` today: `:root` token block at the top (first block, parsed by the contrast test); `.score-fill` uses `width: calc(var(--fraction, 0) * 100%)`; `.case-card:hover { border-color: var(--color-ink-2); }` (resting border is `--color-control-border`); an existing gated block near line 446 holds `.icon-spin { animation: culprit-spin 1s linear infinite; }` and its keyframes (the loading spinner: keep it); the drawer comment near line 1728 says "no animation"; `.suspect-drawer::backdrop` uses an rgba fill; `.marker-hit` already uses `transform: translate(-50%, -50%)`; button `::after` is the 44px hit band.
- `tests/ui/contrast.test.ts`: helpers `token`, `value`, `rgbaToken`, `composite`, `ratio`, `round2`; `SPEC` hex pins; "Raycast design rules" describe with the test "declares no transition: motion stays gated to POLISH-02 (D-04)" that bans the word everywhere. All other design rules (no gradient function, no backdrop-filter, inset-only box-shadow, weights, font features, Inter first, retired names, no hex literal after :root, no remote URL or @import, primary tokens) must stay exactly as strict.
- `tests/ui/static-safety.test.ts` scans raw text of every `src/**/*.ts` and `index.html`, comments included: no HTML-string sinks, no network or storage APIs, no absolute URL except the SVG namespace string in `src/ui/dom.ts` (so inline SVG in index.html must have no namespace attribute), and in `src/ui` + `src/worker` none of the clock, randomness or locale APIs (this includes any locale-aware lower-casing; use plain lower-casing). Do not even mention those API names in comments.
- `tests/core/rebuild-surface.test.ts` scans `src/styles.css` for absolute paths: always put spaces around `/` inside `calc()`.
- `tsconfig.json`: strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`; `tests/` is type-checked by `npm run typecheck`.
- Render check to copy: `.planning/quick/261020-exy-restyle-the-culprit-console-to-the-rayca/261020-exy-render-check.mjs` (vite preview on 127.0.0.1:4173, Chrome over CDP on 9223, helpers `report`, `poll`, `sleep`, `evaluate`, `press(key, code, keyCode)`, `screenshot(name, fullPage)`, probes `PAGE_METRICS`, `HIT_PROBE`, `FOCUS_PROBE`, prints `RESULT PASS` and exits 0, else exits 1, stops preview and browser in `finally`).
- Expected checkout values (pinned by tests/ui/view-model.test.ts and tests/ui/format.test.ts): hash `2222222`, score text `0.91` (raw 0.912065), matches `Matches 5 of 5 errors`.
</interfaces>

## Artifacts this plan produces

| File | Created / changed | Symbols and rules |
|------|-------------------|-------------------|
| `src/ui/motion-model.ts` | created (T1) | `MOTION_TIMING`, `easeOutCubic`, `decodeFrame`, `countFrame`, `planEntrance`, type `EntrancePlan` |
| `src/ui/motion.ts` | created (T1), extended (T2) | `MotionScope`, `prefersMotion`, `resultSections`, `playEntrance`; T2 adds the timeline `motion-draw` lifecycle |
| `tests/ui/motion-model.test.ts` | created (T1) | frame, plan and CSS/JS timing-parity tests |
| `src/ui/verdict.ts` | changed (T1) | `data-roll` hooks only; no copy change |
| `src/ui/app.ts` | changed (T1, T3) | MotionScope lifecycle in `render()`; palette mount |
| `src/styles.css` | changed (T1, T2, T3) | motion tokens, one consolidated gated motion block, `.score-fill` via `transform: scaleX`, stripe and ambient tokens and layers, palette styles |
| `tests/ui/contrast.test.ts` | changed (T1, T2) | `motionViolations` gate with synthetic self-tests; stripe pins and decorative-layer contrast |
| `tests/ui/static-safety.test.ts` | changed (T1) | animation-frame APIs allowed only in `src/ui/motion.ts` |
| `src/ui/timeline.ts` | changed (T2) | `series-draw` + `pathLength`, `--pop-index`, `marker-pulse`, crossfade on filter redraw, readout swap classes |
| `src/ui/case-picker.ts` | changed (T2) | sparkline `pathLength` |
| `src/ui/status.ts` | changed (T2) | `span.scanline` in the loading placeholder |
| `index.html` | changed (T2, T3) | `.ambient` dot grid, `.header-stripes`, palette trigger row, `dialog#command-palette` |
| `src/ui/palette-model.ts` | created (T3) | `PaletteEntry`, `paletteEntries`, `filterEntries`, `PaletteState`, `reducePalette`, `activeEntry`, `resultCountText`, `isPaletteShortcut` |
| `src/ui/palette.ts` | created (T3) | `mountCommandPalette` |
| `tests/ui/palette-model.test.ts` | created (T3) | model tests |
| `261020-ftp-render-check.mjs` | created (T1), extended (T2, T3) | reduce + normal runs at both sizes |
| `04-UI-SPEC.md` | changed (T3) | Motion Contract section and synced sections |
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1 (tracer): gated motion foundation plus entrance choreography and verdict reveal, end to end on the checkout case</name>
  <files>src/ui/motion-model.ts, src/ui/motion.ts, tests/ui/motion-model.test.ts, src/ui/verdict.ts, src/ui/app.ts, src/styles.css, tests/ui/contrast.test.ts, tests/ui/static-safety.test.ts, .planning/quick/261020-ftp-add-motion-and-visual-life-to-the-culpri/261020-ftp-render-check.mjs</files>
  <read_first>src/ui/app.ts, src/ui/verdict.ts, src/ui/dom.ts, tests/ui/contrast.test.ts, tests/ui/static-safety.test.ts, src/styles.css lines 1-70 and 400-470 and 900-940 (use Grep for anything else), the exy render check</read_first>
  <precondition>A Chromium-based browser is discoverable by the copied findChrome() (the exy render check passed on this machine) and `npm ci` dependencies are installed.</precondition>
  <behavior>
    - easeOutCubic(0) = 0, easeOutCubic(1) = 1, easeOutCubic(0.5) = 0.875; inputs below 0 or above 1 clamp; non-decreasing across 0..1 in 0.05 steps.
    - decodeFrame(s, p): returns s exactly for p >= 1 (also 1.5) and for the empty string; for every p in 0..1 the output length equals s.length; for k in 0..n, decodeFrame(s, k/n) starts with s.slice(0, k) (left-to-right lock-in); same inputs give the same output; unlocked characters come from the glyph set 0-9a-f; spaces stay spaces; p below 0 behaves as 0.
    - countFrame(text, p): animates only the first number in text; countFrame('0.91', 0) = '0.00', countFrame('0.91', 1) = '0.91'; countFrame('Matches 5 of 5 errors', 0) = 'Matches 0 of 5 errors' and at 1 the exact input; intermediate values never decrease, never exceed the final and keep the decimal count; text with no number, or whose first number is 0 (for example 'Matches 0 of 4 errors'), is returned unchanged at every p.
    - planEntrance([100, 300, 900, 1500], 720, 7) = { immediate: [{ position: 0, index: 0 }, { position: 1, index: 1 }], deferred: [2, 3] }; ten visible sections with maxIndex 7 get indices 0..7, 7, 7.
    - MOTION_TIMING pins staggerMs 80, enterMs 600, decodeMs 450, countMs 600, maxStaggerIndex 7; styles.css :root declares --motion-stagger: 80ms and --motion-enter: 600ms (read with readFileSync and compared to the constants) and --motion-ease-out: cubic-bezier(0.16, 1, 0.3, 1).
    - motionViolations(cssText) returns [] for the shipped CSS and a non-empty list for each synthetic snippet: an ungated transition on opacity; an ungated animation declaration; ungated keyframes; gated keyframes that animate width; a gated transition on all; a gated transition on background-color; a gated animation with infinite on a name other than culprit-spin or motion-drift; a gated animation using forwards or both fill. A clean gated snippet (keyframes on transform/opacity/stroke-dashoffset, backwards fill) returns [].
    - static-safety: requestAnimationFrame, cancelAnimationFrame and performance.now appear in no src file except src/ui/motion.ts.
  </behavior>
  <action>
1. RED (D-13). Create tests/ui/motion-model.test.ts covering the behaviour block (import from `../../src/ui/motion-model`; read `src/styles.css` with readFileSync like contrast.test.ts does). In tests/ui/contrast.test.ts replace ONLY the "declares no transition" test with a `describe('gated motion (D-09, D-10, D-12)')` holding a module-level function `motionViolations(cssText: string): string[]` plus the synthetic self-test cases and `expect(motionViolations(css)).toEqual([])`. Implement `motionViolations` as: strip block comments; find every `@media` whose prelude contains `prefers-reduced-motion: no-preference` and take its full brace-matched body (nested at-rules included) as gated text, the rest as ungated text; ungated text must not match the words transition, animation, will-change or `@keyframes`; in gated text, every `@keyframes` body may declare only `transform`, `opacity` and `stroke-dashoffset`; every `transition` / `transition-property` value, split on commas outside parentheses, must name only those three properties (no `all`); every `animation` / `animation-name` value may only reference keyframes defined in gated text; `infinite` is allowed only on `culprit-spin` (the existing loading spinner) and `motion-drift` (D-07); no `forwards` or `both` fill, in the shorthand or in `animation-fill-mode` (so finished animations release and `getAnimations()` settles). Keep every other design-rule test byte-for-byte. In tests/ui/static-safety.test.ts add one test: the animation-frame pattern (the two frame functions and the performance clock) matches no file in `srcFiles` except `src/ui/motion.ts` (D-15: narrow allow-list, the existing clock/randomness/locale ban is unchanged and still applies to motion.ts). Run the three files and confirm they fail.

2. `src/ui/motion-model.ts` (pure, no DOM, no clock, no randomness; D-03, D-01). Export `MOTION_TIMING` as a const object { enterMs: 600, staggerMs: 80, maxStaggerIndex: 7, rollDelayMs: 120, decodeMs: 450, countMs: 600 }. `easeOutCubic(t)` = 1 minus (1 minus clamped t) cubed. `decodeFrame(finalText, progress)`: clamp progress; return finalText when progress >= 1; locked = floor(p * n) leading characters show the final text; each other position shows a glyph from '0123456789abcdef' picked by a fixed arithmetic of position, a frame step (floor(p * 24)) and the final character code, modulo 16 (deterministic, no randomness API); spaces are kept. `countFrame(finalText, progress)`: find the first match of an unsigned integer-or-decimal token; return finalText when there is none, when progress >= 1, or when its scaled integer value is 0; otherwise scaled value = the token's digits without the dot read as an integer, current = floor(scaled * easeOutCubic(p)), formatted back with the same number of decimals by zero-padding (integer string maths, no locale formatting) and spliced in place of that first token only. `planEntrance(tops, viewportHeight, maxIndex = MOTION_TIMING.maxStaggerIndex)`: sections whose top is below viewportHeight are `immediate` with index = min(order among immediate, maxIndex); the rest are `deferred` positions.

3. `src/styles.css` (D-01, D-03, D-09, D-10, D-12). In `:root` add `--motion-ease-out: cubic-bezier(0.16, 1, 0.3, 1); --motion-enter: 600ms; --motion-stagger: 80ms; --motion-fast: 150ms; --motion-draw: 900ms; --motion-drawer: 320ms;`. Change `.score-fill` (static, outside any media query) to `width: 100%; transform: scaleX(var(--fraction, 0)); transform-origin: left center;` so the visual result is unchanged and the meter can animate with transform. Append ONE consolidated block at the end of the file, headed by a comment "Motion (POLISH-02 early, quick 261020-ftp)", as `@media (prefers-reduced-motion: no-preference) { ... }` containing: keyframes `motion-rise` (from opacity 0, translateY(12px)), `motion-fill` (from scaleX(0)), `motion-fade` (from opacity 0); `.motion-enter` animates `motion-rise` over `var(--motion-enter)` with `var(--motion-ease-out)`, fill mode `backwards`, delay `calc(var(--index, 0) * var(--motion-stagger))`; `.motion-enter .score-fill` and `.motion-enter .meter-segment.is-filled` animate `motion-fill` (transform-origin left, backwards, delay index-based plus 200ms; segments 2 and 3 add 80ms and 160ms via nth-child); `.is-rolling { position: relative; -webkit-text-fill-color: transparent; }` and `.is-rolling > .roll-ghost { position: absolute; inset: 0; -webkit-text-fill-color: currentColor; white-space: nowrap; pointer-events: none; }` (static rules, gated so reduced motion can never hide text). Every timing uses the tokens; never use forwards or both fill; no class name may contain the words transition or animation. Leave the existing `.icon-spin` gated block as it is.

4. `src/ui/motion.ts` (DOM driver; D-01, D-03, D-10, D-11). Export `interface MotionScope { dispose(): void }`; `prefersMotion(): boolean` (true only when `window.matchMedia` exists and `(prefers-reduced-motion: no-preference)` matches); `resultSections(statusRegion, body): HTMLElement[]` (the `.status-banner` when not hidden, then each child of `body`'s `.result-stack`, expanding `.investigation` into its children and skipping elements with no element child, such as an empty log slot); `playEntrance(sections): MotionScope` returning a no-op scope when `prefersMotion()` is false. Otherwise read each section's `getBoundingClientRect().top` once, call `planEntrance`, play immediate sections at once and observe deferred ones with an `IntersectionObserver` (only when `typeof IntersectionObserver === 'function'`; otherwise play them immediately with the cap index) that plays each on its first intersection with index 0 and unobserves it. Playing a section: set `--index`, add `motion-enter`, then start a roll for each `[data-roll]` descendant with delay index * staggerMs + rollDelayMs and duration decodeMs or countMs. A roll: capture the target's current textContent as the final text; if frame(final, 0) equals final, do nothing; else create `el('span', { className: 'roll-ghost', attrs: { 'aria-hidden': 'true' }, text: frame(final, 0) })`, append it, add `is-rolling`, and drive frames with `requestAnimationFrame` using the callback timestamp (start = first timestamp + delay; progress = elapsed / duration); at progress >= 1 or on cancel, a single idempotent `finish()` removes the ghost and the class. The real text node is never modified. `dispose()` cancels every pending frame (cancelAnimationFrame + finish), disconnects the observer and is safe to call twice. No setTimeout in this module; nothing here moves focus or blocks input.

5. `src/ui/verdict.ts` (D-03, D-13). Add `data-roll="decode"` to both `p.verdict-hash` elements, `data-roll="count"` to `span.score-value` and to the `dd` built for the `matches` fact. No text, class or structure change otherwise.

6. `src/ui/app.ts` (D-01, D-11). Import `playEntrance`, `resultSections` and type `MotionScope`. Hold `let motionScope: MotionScope | null = null` and `let enteredRequestId = -1`. In `render()`, right after the loading-to-loading early return, call `motionScope?.dispose()` and reset it to null (every rebuilt body cancels pending motion; latest-request-wins is unchanged). In the `done` branch, after `title.focus()`, when `state.requestId !== enteredRequestId` set `enteredRequestId` and `motionScope = playEntrance(resultSections(statusRegion, body))`. The stale re-render during loading therefore never replays the entrance (one shot per result).

7. Render check (tracer end-to-end verify). Copy the exy script to `.planning/quick/261020-ftp-add-motion-and-visual-life-to-the-culpri/261020-ftp-render-check.mjs`; update its header comment and default out dir (`culprit-261020-ftp` under the OS temp dir). Wrap the viewport loop in two motion modes, reduce and no-preference, applied with `Emulation.setEmulatedMedia({ features: [{ name: 'prefers-reduced-motion', value }] })` before each navigation; tag each line with the size and mode. Before clicking the checkout card, install a page-side sampler (via evaluate): a MutationObserver that records whether a `.roll-ghost` ever appeared, and a 6-second rAF loop recording the maximum count and the unique names of running `document.getAnimations()` entries, excluding `culprit-spin` and `motion-drift`. Poll for the result every 30ms. Immediately on detection, in both modes, read the real text (text nodes only, skipping `aria-hidden="true"` subtrees) of `.verdict .verdict-hash`, `.verdict .score-value` and `[data-fact="matches"] dd` and require `2222222`, `0.91`, `Matches 5 of 5 errors`. Reduce mode: zero running non-drift animations right away, and after 700ms the sampler reports max 0 and no ghost. Normal mode: poll up to 5s for settle (no running non-drift animation and no `.roll-ghost`), then require sampler max > 0, names including `motion-rise` and `motion-fill`, a ghost observed, full textContent of the three targets exact and no `.is-rolling`. Both modes after settle: the verdict `.score-fill` computed transform has scale x within 0.002 of 0.912065. Keep the exy FOCUS_PROBE, PAGE_METRICS (no horizontal scroll at 360px), screenshots and the drawer open/Escape check in every run (after settle in normal mode), and run HIT_PROBE in reduce runs only (scroll-triggered entrances move boxes in normal mode). Keep console-error and off-origin checks over all runs.

8. GREEN: run the three test files, the full suite, the build, then the render check, and view the normal-mode 1280 screenshot.
  </action>
  <verify>
    <automated>npm test -- --run tests/ui/motion-model.test.ts tests/ui/contrast.test.ts tests/ui/static-safety.test.ts</automated>
    <fails_when>non-zero exit, "failed" in the Vitest summary, or any of the three files reporting 0 tests</fails_when>
    <automated>npm test</automated>
    <fails_when>non-zero exit or "failed" for any suite (view-model, tracer, rebuild-surface and every core suite must stay green)</fails_when>
    <automated>npm run build</automated>
    <fails_when>non-zero exit or any "error TS" line</fails_when>
    <automated>node .planning/quick/261020-ftp-add-motion-and-visual-life-to-the-culpri/261020-ftp-render-check.mjs</automated>
    <fails_when>non-zero exit, any line starting with FAIL, or the last line is not "RESULT PASS"</fails_when>
    <automated>git diff --name-only e8c4072 -- src/core package.json package-lock.json</automated>
    <fails_when>any file path is printed (src/core or the manifests changed)</fails_when>
  </verify>
  <acceptance_criteria>
    - motion-model.test.ts covers every behaviour bullet; contrast.test.ts has `motionViolations` with at least eight failing synthetic snippets and one clean one; the other design-rule tests are unchanged.
    - The render check passes in both modes at both sizes, with exact real text at first detection and exact full text after settle.
    - No source file other than src/ui/motion.ts uses animation-frame APIs; src/core and the manifests are untouched.
  </acceptance_criteria>
  <done>Loading the checkout case plays a staggered rise of every result section, decodes the hash to 2222222, counts the match count and score up to their exact values and fills the meters; with reduced motion everything is final instantly; tests, build and both render-check modes are green. Committed as one atomic commit (feat(quick-261020-ftp): ...).</done>
</task>

<task type="auto">
  <name>Task 2: timeline life, case cards, loading scanline, drawer slide, header stripe band and ambient dot grid</name>
  <files>src/ui/timeline.ts, src/ui/motion.ts, src/ui/case-picker.ts, src/ui/status.ts, src/styles.css, index.html, tests/ui/contrast.test.ts, .planning/quick/261020-ftp-add-motion-and-visual-life-to-the-culpri/261020-ftp-render-check.mjs</files>
  <read_first>src/ui/timeline.ts (draw, syncReadout, update), src/ui/case-picker.ts, src/ui/status.ts, index.html, the gated motion block written in Task 1</read_first>
  <action>
1. Timeline hooks in `src/ui/timeline.ts` (D-02, D-09). In `draw()`: give the primary (non-context) series path, in both the unfiltered and the emphasised branch, the extra class `series-draw` and the attribute `pathLength` = '1' (never on `.context-line`, whose forced-colours dash pattern would break); set `--pop-index` (style.setProperty, value min(draw order, 8)) on each commit's `marker-ring` and mark polygon; for the leading marker append, just before its ring, a `polygon.marker-pulse` with the ring's points (decorative, base opacity 0). Give `draw` a `cause` parameter ('build' | 'resize' | 'filter', default 'resize'; the build-time call passes 'build'); when the cause is 'filter' add class `is-crossfade` to every series path it creates. In `syncReadout()`, when the readout text actually changes, swap between classes `is-swap-a` and `is-swap-b` on `readoutText` (remove both, add the other one) so the 150ms fade restarts without a forced reflow. Selection moves stay attribute-only, so stepping never replays the draw-in.

2. Timeline lifecycle in `src/ui/motion.ts` (D-02, D-11). When playing a section that contains `.series-draw` and supports `getAnimations`, also add `motion-draw`; listen on that section for `animationend` and `animationcancel` and remove `motion-draw` (and the listeners) once `section.getAnimations({ subtree: true })` is empty. This survives the immediate ResizeObserver redraw (replaced nodes restart their animation under the still-present class) and stops later resizes or filter redraws from replaying the draw-in. `dispose()` also removes these listeners.

3. Sparkline and loading in `src/ui/case-picker.ts` and `src/ui/status.ts` (D-04). Add `pathLength: '1'` to the sparkline path. Append `el('span', { className: 'scanline', attrs: { 'aria-hidden': 'true' } })` inside the loading placeholder (text stays the only content a reader gets; no skeleton shapes).

4. CSS (D-02, D-04, D-05, D-09, D-10, D-12), static parts outside the media query, motion inside the Task 1 gated block only:
   - Static: `.marker-pulse { fill: none; stroke: var(--viz-suspect); stroke-width: 2; opacity: 0; transform-box: fill-box; transform-origin: center; }`; `.case-card:focus-visible` gets the same `border-color: var(--color-ink-2)` as hover (the brief names hairline-strong, but cards rest on the 3.6:1 control border and hairline-strong would dim them to about 1.6:1, so the existing brighter ink-2 step is used and recorded as a deviation); `.loading-placeholder { position: relative; overflow: hidden; }` and `.scanline { position: absolute; left: 0; bottom: 0; width: 30%; height: 2px; background: var(--color-ink-2); opacity: 0; }`.
   - Gated keyframes: `motion-draw-line` (from stroke-dashoffset 1), `motion-wipe` (from scaleX(0)), `motion-pop` (from scale(0) and opacity 0), `motion-pulse` (0%: opacity 0 at scale 1; 10%: opacity 0.8 at scale 1; 100%: opacity 0 at scale 2.4, so the ring is invisible during its delay and after), `motion-swap-a` and `motion-swap-b` (both from opacity 0), `motion-scan` (translateX from -100% to 340% at opacity 0.35 on both ends), `motion-drawer-in` (from translateX(100%)), `motion-drawer-up` (from translateY(24px) and opacity 0).
   - Gated rules, all scoped to `.motion-draw .timeline-svg` so the legend keys never animate: `.series-draw` gets `stroke-dasharray: 1` and `motion-draw-line` over `var(--motion-draw)`; `.series-area` fades with delay plus 300ms; `.onset-band` and `.onset-bracket` wipe with `transform-box: fill-box; transform-origin: left center` and delay plus 150ms; the marker ring and mark polygons pop with `transform-box: fill-box; transform-origin: center` and delay plus 300ms plus `var(--pop-index, 0)` times 40ms; `.marker-pulse` plays `motion-pulse` once over 900ms with delay plus 800ms. Every delay starts from `calc(var(--index, 0) * var(--motion-stagger))`. `.timeline-svg .is-crossfade` fades over 200ms. `.readout-text.is-swap-a` and `.is-swap-b` play their keyframes over `var(--motion-fast)`.
   - Gated: `.case-card:hover .sparkline-line, .case-card:focus-visible .sparkline-line { stroke-dasharray: 1; animation: motion-draw-line 700ms ... backwards; }`; `.scanline` plays `motion-scan` 1200ms ease-in-out with a finite iteration count of 3 (no infinite); `.suspect-drawer[open]` plays `motion-drawer-in` over `var(--motion-drawer)` and `.suspect-drawer[open]::backdrop` plays `motion-fade` over 200ms, with a nested `@media (max-width: 639px)` switching the drawer to `motion-drawer-up`. Closing stays instant (native close is synchronous; no closing animation, focus return untouched). Update the drawer comment near line 1728 to describe the slide-in.

5. Stripe band (D-06) and ambient layer (D-07).
   - `:root`: `--stripe-1: #ff5757; --stripe-2: #e04848; --stripe-3: #a1131a; --stripe-1-opacity: 0.24; --stripe-2-opacity: 0.32; --stripe-3-opacity: 0.5; --ambient-opacity: 0.04;` (planning-time estimates put muted text at about 5.4, 5.1 and 5.3 to 1 over these composites on the page colour; the test decides).
   - index.html: as the first child of `header.site-header` add `<div class="header-stripes" aria-hidden="true">` with three empty `span` children; as the first child of `body` add `<div class="ambient" aria-hidden="true">` holding an inline `svg` (no namespace attribute, `focusable="false"`, width and height 100%) with a `pattern` of id `ambient-dots` (24 by 24, userSpaceOnUse) containing one `circle` of class `ambient-dot` (radius 1), and a full-size `rect` filled with `url(#ambient-dots)`.
   - CSS static: `.site-header { position: relative; isolation: isolate; overflow: hidden; }`; `.header-stripes` absolutely positioned at the right of the header (width about min(320px, 50%)), `z-index: -1`, `pointer-events: none`; each span absolutely positioned, taller than the header, about 28px wide, `transform: skewX(-24deg)`, flat `background: var(--stripe-N)` with `opacity: var(--stripe-N-opacity)`, spaced so no two stripes overlap (the contrast maths assumes no overlap). `.ambient { position: fixed; inset: -24px; z-index: -1; pointer-events: none; opacity: var(--ambient-opacity); }` and `.ambient-dot { fill: var(--color-ink); }`. In print and forced-colours blocks hide `.ambient` and `.header-stripes`. Flat fills only: no gradient function, no shadow, no blur.
   - CSS gated: the stripes play a one-shot entrance (from opacity 0 and translateX(48px) combined with the same skew, staggered 90ms per stripe through a per-span custom property); `.ambient` plays `motion-drift` (to translate(24px, 24px)) over 48s, linear, infinite: the only new loop, seamless because it moves exactly one pattern period.

6. Tests in `tests/ui/contrast.test.ts` (D-06, D-07, D-12): add `stripe-1`, `stripe-2`, `stripe-3` with their hex values to `SPEC`; add `describe('decorative layers keep text contrast')`: each stripe opacity token is at most 0.5 and `--ambient-opacity` at most 0.04; for each stripe, composite the stripe colour at its opacity over `color-page` and over the ambient composite (ink at the ambient opacity over page), and require `color-ink`, `color-ink-2` and `color-muted` at 4.5:1 or better on every composite; the ambient composite itself keeps muted at 4.5:1. If a stripe fails, lower its opacity token (never raise contrast by other means) and record the change. Record the computed ratios for the UI-SPEC (Task 3).

7. Render check additions (normal and reduce runs, both sizes): before loading a case, wait for `.sparkline-line`, move the mouse to the first card's centre with `Input.dispatchMouseEvent` and require (normal) `motion-draw-line` among sampled names, then after settle a computed stroke-dashoffset of 0 and a screenshot `hover-<tag>.png` (view it: the hovered sparkline must be fully drawn; if Chrome renders it partially because of the non-scaling stroke, switch the sparkline reveal to an opacity plus translateX fade and record the deviation); move the mouse away before clicking. After the result settles, scroll `#timeline-title` into view, reset the sampled names, wait for settle and require (normal) `motion-draw-line`, `motion-wipe`, `motion-pop` and `motion-pulse`, then `.timeline` without `motion-draw`; `.series-draw` has `pathLength` '1'. Focus the slider, reset names, press ArrowRight, and after 300ms require none of draw-line/wipe/pop/pulse and (normal) one of the swap names. During the drawer open require (normal) `motion-drawer-in` or `motion-drawer-up`; right after Escape the dialog is closed and focus is on the Inspect evidence button. In every run: `.header-stripes` is aria-hidden with three spans whose computed `background-image` is `none` and opacity at most 0.5, and `.ambient` is aria-hidden with computed opacity at most 0.04; normal runs see `motion-drift` running, reduce runs see no animation at all. Reduce runs require zero sampled animations for every step above.
  </action>
  <verify>
    <automated>npm test -- --run tests/ui/contrast.test.ts tests/ui/motion-model.test.ts tests/ui/static-safety.test.ts</automated>
    <fails_when>non-zero exit, "failed" in the Vitest summary, or any file reporting 0 tests</fails_when>
    <automated>npm test</automated>
    <fails_when>non-zero exit or "failed" for any suite</fails_when>
    <automated>npm run build</automated>
    <fails_when>non-zero exit or any "error TS" line</fails_when>
    <automated>node .planning/quick/261020-ftp-add-motion-and-visual-life-to-the-culpri/261020-ftp-render-check.mjs</automated>
    <fails_when>non-zero exit, any line starting with FAIL, or the last line is not "RESULT PASS"</fails_when>
  </verify>
  <acceptance_criteria>
    - The design-rule suite, including `motionViolations(css)`, passes with all new keyframes gated and animating only transform, opacity or stroke-dashoffset.
    - Stripe and ambient tokens are pinned and every header text colour clears 4.5:1 over each composite.
    - The render check confirms the draw-in plays once per result and not on stepping, the drawer animates in and closes instantly with focus returned, and nothing animates under reduced motion.
  </acceptance_criteria>
  <done>The timeline comes alive on a new result (draw, wipe, pop, single pulse, readout fade) without replaying on interaction; cards draw their sparkline on hover and focus; first-load analysis shows a scanline; the drawer slides in; the header carries a flat red three-stripe band and the page a slow dot-grid drift; all gated, all tests and both render-check modes green. Committed as one atomic commit.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: command palette, UI-SPEC sync and the full render check</name>
  <files>src/ui/palette-model.ts, src/ui/palette.ts, tests/ui/palette-model.test.ts, src/ui/app.ts, index.html, src/styles.css, .planning/quick/261020-ftp-add-motion-and-visual-life-to-the-culpri/261020-ftp-render-check.mjs, .planning/phases/04-incident-console-and-investigation-flow/04-UI-SPEC.md</files>
  <read_first>src/ui/drawer.ts lines 185-255 (focus-return pattern to mirror), src/ui/case-picker.ts, index.html, the palette-related parts of src/styles.css (kbd, .key-hint, .suspect-drawer)</read_first>
  <behavior>
    - paletteEntries(cases) for three { id, name, purpose } records returns four entries in order: the three cases (label = name, hint = purpose, kind 'case') then { id: 'own-files', label: 'Use your own files', kind: 'own' } with hint 'Paste or drop your own log and git history'.
    - filterEntries: an empty or whitespace query returns all entries in order; matching is case-insensitive on the label only and every whitespace-separated token must occur ('  SLOW ' gives only Slow-burn inventory failure; 'files' gives only Use your own files; 'checkout outage' gives only Checkout outage; 'zzz' and a markup-looking query give [] without throwing).
    - reducePalette(state, event, entries): a query event sets the query and resets active to 0, or -1 when nothing matches; move +1 and -1 wrap around the visible list (from the last to 0, from 0 to the last); moving with no results keeps -1; activeEntry returns the visible entry at active or null.
    - resultCountText: 0 gives 'No matching cases', 1 gives '1 result', 4 gives '4 results'.
    - isPaletteShortcut: '/' with no ctrl, meta or alt outside an editable target is true; '/' inside an editable target, or with ctrl, is false; 'k' or 'K' with ctrl or meta (no alt) is true even inside an editable target; ctrl+alt+k is false; plain 'k' is false; anything while a modal dialog is open is false.
  </behavior>
  <action>
1. RED: create tests/ui/palette-model.test.ts for the behaviour block using plain fixture records (no Vite raw imports). Run it and confirm it fails.

2. `src/ui/palette-model.ts` (pure; D-08): export `PaletteEntry { id: string; label: string; hint: string; kind: 'case' | 'own' }`, `paletteEntries`, `filterEntries`, `PaletteState { query: string; active: number }`, `initialPaletteState`, `PaletteEvent` ({ type: 'query'; value } | { type: 'move'; delta: 1 | -1 }), `reducePalette`, `activeEntry`, `resultCountText`, `isPaletteShortcut({ key, ctrlKey, metaKey, altKey, inEditable, modalOpen })`. Plain lower-casing only (the locale-aware variant is banned by static-safety). Import `OWN_TOGGLE_ID` and `OWN_TOGGLE_TEXT` from case-picker.ts so the label stays one source of truth only if that import keeps the module DOM-free at import time (case-picker.ts imports dom.ts, which touches `document` only inside functions); otherwise duplicate the two constants and add a test asserting they equal the case-picker exports.

3. index.html (D-08, D-13): wrap the existing `h2#input-title` in `div.panel-heading-row` together with `<button type="button" id="palette-trigger" class="button-secondary palette-trigger" aria-haspopup="dialog" aria-keyshortcuts="/ Control+K Meta+K">Press <kbd>/</kbd> to jump to a case</button>` (accessible name "Press / to jump to a case"); add `<dialog id="command-palette" class="command-palette" aria-labelledby="palette-title"></dialog>` beside the drawer dialog. Keep every existing id.

4. `src/ui/palette.ts` (D-08, D-11, D-13): export `mountCommandPalette(doc, { entries, onLoad(id: string): void, onOwnFiles(): void })`; look up `#command-palette` and `#palette-trigger` (throw a clear error when missing, like app.ts `required`). Build the content once with `el()`: an inner wrapper filling the dialog (dialog padding 0, so a click whose target is the dialog itself means the backdrop and closes it, as the drawer does); `h2#palette-title` "Jump to a case"; an `input#palette-input` (type search, autocomplete off, spellcheck false, placeholder "Search cases", `role="combobox"`, `aria-expanded="true"`, `aria-controls="palette-list"`, `aria-autocomplete="list"`, `aria-labelledby="palette-title"`); `ul#palette-list` with `role="listbox"` and `aria-label="Cases"`; a polite status line `p.palette-count` (`role="status"`, text from `resultCountText`, only rewritten when it changes); a footer `p.key-hint` with kbd keys ↑ ↓ move, Enter load, Esc close, and a `button-secondary` Close button. Rendering the list: clear it and add one `li` per visible entry with id `palette-option-<entry id>`, `role="option"`, `aria-selected` true only on the active one, class `is-active` on it, label and muted hint as text children, and a click handler that chooses it; set or remove `aria-activedescendant` on the input. The query is only ever used as input value and filter text; it is never inserted into the DOM. Open: remember the opener (`doc.activeElement` when it is an element other than body, else the trigger), reset state, clear the input, render, `showModal()`, focus the input. Input `input` event dispatches query; keydown ArrowDown/ArrowUp dispatch move and preventDefault; Enter chooses the active entry (preventDefault; nothing when there is none); Escape uses the native cancel. On `close`: unless a choice suppressed it, focus the opener if still connected, else the trigger. Choosing a case: close (focus returns to the opener) then `onLoad(id)` (the result later focuses the result heading, as a card click does). Choosing own files: close without restoring focus, then `onOwnFiles()`. Global shortcut: one `keydown` listener on `doc` that skips `defaultPrevented` and composing events, computes `inEditable` (input, textarea, select or contenteditable target) and `modalOpen` (`doc.querySelector('dialog[open]') !== null`), and when `isPaletteShortcut` is true prevents the default and opens. The trigger's click opens too. No timers.

5. `src/ui/app.ts`: call `mountCommandPalette(doc, { entries: paletteEntries(BUNDLED_CASES), onLoad: loadById, onOwnFiles: () => fixInput('log') })` once during mount. Nothing else changes; every existing control stays reachable without the palette.

6. CSS (D-08, D-12): static `.panel-heading-row` (flex, wrap, space-between, gap; h2 margin 0 inside) and `.palette-trigger` (inline-flex, gap, the kbd inside it); `.command-palette` fixed near the top (top about 15vh), width `min(560px, calc(100vw - 32px))`, padding 0, background `var(--color-raised)`, 1px `var(--color-border)`, `var(--radius-card)`, ink text, no shadow; backdrop the same neutral rgba as the drawer; options are rows with `var(--radius-row)`, the active one with `var(--color-elevated)` background plus a 4px ink left rule (selection never colour alone: aria-selected plus the rule), hint in `var(--color-ink-2)` at label size; the count line muted. Gated: `.command-palette[open]` plays a 160ms keyframe from opacity 0 with translateY(-8px) scale(0.98), and its backdrop plays `motion-fade`. Usable at 360px with no horizontal scroll.

7. Render check additions, run after the existing checkout checks in every run on a fresh navigation: blur the active element, press '/' (`Input.dispatchKeyEvent` with key '/', code 'Slash', keyCode 191, text '/') and require the palette open, focus on `#palette-input`, four options and count '4 results'; at 360px also require no horizontal scroll while it is open; `Input.insertText('slow')` gives one option containing 'Slow-burn inventory failure' and '1 result'; Escape closes it and focus lands on `#palette-trigger`. Focus the trigger and click it, press ArrowDown, require `aria-activedescendant` = `palette-option-slow-burn`, press Enter: the palette closes with focus on the trigger and `#result-title` becomes 'Result: Slow-burn inventory failure'. Focus the timeline slider and send Ctrl+K (modifiers 2, key 'k', code 'KeyK', keyCode 75): the palette opens; Escape returns focus to the slider. Open the own-files form, focus its first textarea, press '/': the palette stays closed. In normal runs the palette opening shows a sampled animation; in reduce runs none. Then let the script finish as before (stop preview and browser).

8. 04-UI-SPEC.md (D-16), scoped Edits found with Grep, no whole-file Write: add a `## Motion Contract` section (place it before `## Interaction and State Contract`) recording the motion tokens (easing, 600ms enter, 80ms stagger capped at index 7, 150ms swap, 900ms line draw, 320ms drawer, 450ms decode, 600ms count-up), the gating and base-final-state rule, the reduced-motion contract (no animation, exact text, full meters, fully drawn line), the aria-hidden roll overlay contract, the one-shot-per-result rule and what must not replay (stepping, resize) versus what crossfades (filter), the transform/opacity/stroke-dashoffset-only rule, the single new loop (ambient drift) plus the existing loading spinner, the stripe band (tokens, opacities and the contrast figures computed in Task 2) and the ambient layer, and a note that this implements part of POLISH-02 early (shortcuts plus purposeful reduced-motion-aware transitions) at the user's request. Update in place: the "Not in scope here" bullet that gates motion to Phase 5; the `prefers-reduced-motion` accessibility bullet ("Phase 4 has no transitions on the chart, drawer or cards"); the drawer section's "No slide animation in Phase 4"; the timeline section (draw-in on a new result; the key hint stays and still adds no shortcut); the Color section (stripe tokens); the input panel section (palette trigger row); and the Keyboard map (add a Global shortcuts row: / outside text fields and Ctrl/Cmd+K open the palette; a Command palette row: type to filter, ArrowUp/ArrowDown move with wrap, Enter loads, Esc closes and returns focus; keep the suspect-stepping row saying stepping shortcuts are not shipped). Do not edit ROADMAP.md or REQUIREMENTS.md and do not mark POLISH-02 complete (D-17).

9. GREEN: palette tests, full suite, build, render check; view the palette screenshot at 360px if one was taken.
  </action>
  <verify>
    <automated>npm test -- --run tests/ui/palette-model.test.ts tests/ui/static-safety.test.ts tests/ui/contrast.test.ts</automated>
    <fails_when>non-zero exit, "failed" in the Vitest summary, or any file reporting 0 tests</fails_when>
    <automated>npm run typecheck</automated>
    <fails_when>non-zero exit or any "error TS" line</fails_when>
    <automated>npm test</automated>
    <fails_when>non-zero exit or "failed" for any suite</fails_when>
    <automated>npm run build</automated>
    <fails_when>non-zero exit or any "error TS" line</fails_when>
    <automated>node .planning/quick/261020-ftp-add-motion-and-visual-life-to-the-culpri/261020-ftp-render-check.mjs</automated>
    <fails_when>non-zero exit, any line starting with FAIL, or the last line is not "RESULT PASS"</fails_when>
    <automated>git diff --name-only e8c4072 -- src/core package.json package-lock.json .planning/ROADMAP.md .planning/REQUIREMENTS.md</automated>
    <fails_when>any file path is printed</fails_when>
  </verify>
  <acceptance_criteria>
    - palette-model.test.ts covers every behaviour bullet; static-safety stays green (no HTML-string sink, no network API, no clock, randomness or locale API).
    - The render check drives '/', typing, ArrowDown, Enter, Escape and Ctrl+K and confirms focus return, the polite count and the editable-field exemption at both sizes in both motion modes.
    - 04-UI-SPEC.md contains a Motion Contract section, no longer says the drawer, chart or cards have no motion, and its keyboard map lists the palette shortcuts.
  </acceptance_criteria>
  <done>Pressing / or Ctrl/Cmd+K opens an accessible native-dialog palette that filters the cases, moves with arrows, loads with Enter and closes with Esc while returning focus; the visible trigger opens it too; the UI-SPEC records the motion and palette contracts; typecheck, tests, build and the full render check are green. Committed as one atomic commit, then the SUMMARY reports test counts, render-check observations, the POLISH-02 status (partially delivered early, still unchecked in REQUIREMENTS.md) and any deviations.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| keyboard input to palette filter | free text typed by the user drives filtering and the visible list |
| animation scheduler to DOM | rAF loops, observers and CSS animations act on nodes that a newer result may replace |
| decorative layers to readable content | stripes and the dot grid sit under header and page text |
| render check to local servers | the check spawns vite preview and a headless browser bound to 127.0.0.1 |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261020ftp-01 | Tampering | src/ui/palette.ts filter input | medium | mitigate | The query is used only as input value and as a lower-cased substring filter; list items are built with el() text from bundled constants; static-safety keeps HTML-string sinks out of src; palette-model tests feed a markup-looking query and expect [] without a throw |
| T-261020ftp-02 | Denial of Service | src/ui/motion.ts rolls, IntersectionObserver, motion-draw listeners | medium | mitigate | One MotionScope per result; render() disposes it before every body rebuild (cancelAnimationFrame, idempotent finish, observer disconnect, listener removal); no setTimeout in motion code; CSS animations on replaced nodes end with the nodes |
| T-261020ftp-03 | Tampering | verdict values shown during the reveal | high | mitigate | The real text node is never modified; the scramble lives in an aria-hidden ghost; frame functions return the exact final text at progress >= 1 (tested); finish() always removes ghost and class; the render check reads exact real text at first detection and exact full text after settle |
| T-261020ftp-04 | Elevation of Privilege | focus handling (palette, drawer) | medium | mitigate | Native showModal() makes the rest inert; Esc and backdrop close; focus returns to the opener, else the trigger; the shortcut is ignored in editable fields and while any modal dialog is open; drawer closing stays synchronous; the render check verifies each focus return |
| T-261020ftp-05 | Information Disclosure | reduced-motion preference ignored (accessibility harm) | high | mitigate | Every keyframe, animation and transition lives inside the no-preference media block (motionViolations test); JS rolls and entrance classes start only when prefersMotion() is true; the reduce render-check runs require zero animations and exact final states |
| T-261020ftp-06 | Tampering | header stripes and ambient layer over text | medium | mitigate | Flat fills at tokenised opacities (stripes <= 0.5, ambient <= 0.04), non-overlapping stripes, aria-hidden and pointer-events none; contrast.test.ts requires ink, ink-2 and muted >= 4.5:1 over every composite; both layers hidden in forced colours and print |
| T-261020ftp-07 | Information Disclosure | network and dependencies | low | mitigate | No package added (static-safety pins the four devDependencies); no remote URL in CSS (design-rule test) or src/index.html (static-safety); the render check rejects any off-origin request |
| T-261020ftp-08 | Denial of Service | render check processes | low | mitigate | Binds 127.0.0.1 only with a throwaway profile; finally-block closes the browser and kills both process trees |
| T-261020ftp-SC | Tampering | npm/pip/cargo installs | high | mitigate | No install task exists in this plan; package.json and package-lock.json must show no diff against e8c4072 (verified in Tasks 1 and 3) |
</threat_model>

<verification>
- `npm run typecheck`, `npm test` and `npm run build` are green; report the Vitest file and test counts (baseline before this plan: 29 files, 455 tests).
- `node .planning/quick/261020-ftp-add-motion-and-visual-life-to-the-culpri/261020-ftp-render-check.mjs` prints RESULT PASS: no console errors, no off-origin requests, no horizontal scroll at 360px (also with the drawer and the palette open), reduced-motion runs with zero animations and exact final text, normal-motion runs whose animations exist, settle within 5s and end on exact text.
- `git diff --name-only e8c4072 -- src/core package.json package-lock.json .planning/ROADMAP.md .planning/REQUIREMENTS.md` prints nothing.
- Screenshots (normal-mode 1280 result, hover card, 360 result, palette) were viewed and observations are recorded in the SUMMARY.
</verification>

<success_criteria>
- All eight brief items (D-01 to D-08) are visible in the running app, each one gated by the reduced-motion media query and degrading to the exact final state.
- The relaxed design-rule test still fails on gradients, non-inset shadows, glass, ungated motion, disallowed animated properties, new infinite loops and forwards fills (proved by its synthetic self-tests).
- Checkout final values unchanged: hash 2222222, score 0.91, Matches 5 of 5 errors.
- Every existing DOM id, ARIA contract, focus behaviour and tested copy is unchanged; the timeline key hint remains.
</success_criteria>

<output>
Create `.planning/quick/261020-ftp-add-motion-and-visual-life-to-the-culpri/261020-ftp-SUMMARY.md` when done. Include the commits, the test counts, the render-check observations per mode and size, the stripe contrast figures, any deviations (the case-card border step is expected), and the POLISH-02 status: partly delivered early (palette shortcuts and reduced-motion-aware transitions), suspect-stepping shortcuts not shipped, requirement left unchecked.
</output>
