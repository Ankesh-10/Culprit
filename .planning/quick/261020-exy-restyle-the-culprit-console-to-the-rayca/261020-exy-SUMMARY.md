---
phase: quick-261020-exy
plan: 01
subsystem: ui
tags: [css, design-tokens, raycast, accessibility, render-check]
requires: []
provides:
  - Raycast dark token set in src/styles.css (surface ladder, white primary, blue focus, soft warning badge)
  - Optional local Inter font hook (Inter-Variable.woff2) in src/ui/fonts.ts
  - Timeline keycap hint and soft warning badges for caution labels
  - Re-runnable headless render check (CDP) for 1280x720 and 360x740
affects: [src/styles.css, src/ui/verdict.ts, src/ui/timeline.ts, tests/ui/contrast.test.ts, 04-UI-SPEC.md]
tech-stack:
  added: []
  patterns: [tokens-only colour, centred ::after hit band, mono literal-rendering group]
key-files:
  created:
    - .planning/quick/261020-exy-restyle-the-culprit-console-to-the-rayca/261020-exy-render-check.mjs
  modified:
    - src/styles.css
    - src/ui/fonts.ts
    - src/ui/verdict.ts
    - src/ui/timeline.ts
    - tests/ui/contrast.test.ts
    - tests/ui/case-picker.test.ts
    - src/assets/fonts/FONTS.md
    - README.md
    - index.html
    - .planning/phases/04-incident-console-and-investigation-flow/04-UI-SPEC.md
key-decisions:
  - "Font stack: Inter, Geist, Segoe UI Variable Text, Segoe UI Variable, system-ui: Chrome maps system-ui on Windows to static Segoe UI (no 500 face), so medium text would flatten to 400 under font-synthesis none"
  - "Geist kept second so the existing optional Geist file stays meaningful"
  - "Controls use ash #6a6b6c as border (hairline-strong overlay is about 1.6:1, below the 3:1 non-text rule); static containers use the #242728 hairline"
  - "Disabled primary text uses muted (6.9:1) rather than ash so the label stays readable"
  - "Selection and meters are ink / ink-2, not accent; blue marks keyboard focus only"
  - "Clear inputs confirm uses secondary chrome inside the critical-striped row (no status fill on buttons)"
  - "Format select stays 44px tall (a select cannot carry the ::after hit band)"
  - "One kbd key hint on the timeline only, documenting keys the slider already handles"
duration: ~55 min
completed: 2026-10-20
status: complete
commits: 3
plan_head_before: 319d08d91a24439b7d38b8f07e2762a2c513bb89
plan_head_after: 18227b3f2299322a58a4521b2e520c32d8dc96d9
actuals:
  tokens: 60000
  tasks: 3
  commits: 3
---

# Quick 261020-exy: Raycast restyle of the Culprit console Summary

Culprit's console now runs on the Raycast dark system purely through tokens and a few component rules: a four-step surface ladder with 1px hairlines and no shadows, one solid white primary button, blue focus rings, ink selection rules, soft yellow warning badges, flat keycaps, and Inter-first type at weights 400/500 with ss03. Behaviour, copy, DOM and ARIA contracts are unchanged apart from the caution-chip icons and the timeline key hint.

## Commits

| Task | Commit | Content |
|------|--------|---------|
| 1 (tracer) | e796c45 | :root tokens, base type, controls, radii, font hook, token/design-rule/font tests, FONTS.md, README note, theme-color |
| 2 | 402f14d | Soft warning badges (icon plus text), kbd keycaps and timeline key hint, hairline containers, table header rules, tooltip, neutral drawer backdrop |
| 3 | 18227b3 | Render check script, centred 44px hit band fix, 04-UI-SPEC.md sync |

## Token changes (old to new, from `git diff 319d08d -- src/styles.css`)

| Token | Old | New |
|-------|-----|-----|
| --color-page | #0b1220 | #07080a |
| --color-surface | #121e31 | #0d0d0d |
| --color-raised | #1a2a42 | #121212 |
| --color-ink | #e9eef5 | #f4f4f6 |
| --color-ink-2 | #b7c3d4 | #cdcdcd |
| --color-muted | #8fa0b8 | #9c9c9d |
| --color-border | #2d405b | #242728 |
| --color-control-border | #66799a | #6a6b6c |
| --color-grid | #22324a | #242728 |
| --color-axis | #46587a | #434345 |
| --color-good | #0ca30c | #59d499 |
| --color-warning | #fab219 | #ffc533 |
| --color-critical | #d03b3b | #ff6161 |
| --font-ui | Geist, system-ui, -apple-system, "Segoe UI", sans-serif | Inter, Geist, "Segoe UI Variable Text", "Segoe UI Variable", system-ui, -apple-system, "Segoe UI", sans-serif |

Unchanged: --color-serious #ec835a, the four --viz-* colours (#3987e5, #d95926, #199e70, #8fa0b8), spacing, type sizes and line heights, --font-mono, --weight-regular.

New tokens: --color-elevated #101111, --color-hairline-strong rgba(255,255,255,0.16), --color-primary #ffffff, --color-primary-pressed #e8e8e8, --color-on-primary #000000, --color-focus #57c1ff, --color-warning-soft rgba(255,197,51,0.15), --radius-card 10px, --radius-control 8px, --radius-row 6px, --radius-key 4px, --control-height 36px, --hit-min 44px, --weight-medium 500.

Retired tokens: --color-accent (#7dd3fc), --color-on-accent (#06222f), --color-destructive (#d03b3b), --weight-semibold (600). A test fails if any reappears.

## Verified contrast (pinned in tests/ui/contrast.test.ts)

ink/surface 17.69, ink-2 12.23, muted 7.09 (6.83 on raised), focus 9.7 (10 on page), control-border 3.64 (3.51 on raised), good 10.46, warning 12.3, serious 7.37, critical 6.6 (6.36 on raised), black on white 21, black on #e8e8e8 17.14, warning on the 15% soft tint 9.12 over surface and 8.6 over raised. Data-viz marks on #0d0d0d: errors 5.34, onset 5.00, suspect 5.71, context 7.30; none needed to move (D-05). All planning-time figures matched the test's WCAG math exactly.

## Render check (Task 3)

`261020-exy-render-check.mjs`, headless Chrome over CDP, localhost only: RESULT PASS on both the checkout and the ambiguous cases (the latter via an ad-hoc copy to see the soft badges).

- 1280x720: first Tab shows a solid 2px rgb(87, 193, 255) ring with 2px offset; body rgb(7, 8, 10); weights in use 400 and 500 only; verdict heading top 406px (limit 720); no overflow; drawer opens and Escape closes it.
- 360x740: scrollWidth 360 = innerWidth 360, also with the drawer open; weights 400 and 500 only.
- 9 core-path buttons draw 36.0px tall and accept clicks 3px beyond both edges at both sizes.
- No console errors; no off-origin request (the favicon 404 is reported INFO only).
- Rendered fonts: #result-title Segoe UI Variable; .verdict-hash and .chip-warning text Consolas / Segoe UI Variable (no WOFF2 committed, so Inter and Geist are not active).
- Screenshots (viewed): near-black canvas with hairline cards, no gradients, shadows or stray colour; white left rule plus check on the loaded case toggle; confidence meter in ink-2 on the dark track; soft yellow badges ("Low confidence", "Ambiguous", "Weak evidence", "No clear culprit") each with alert icon and text on a raised caution banner with a 4px yellow stripe; keycap hint "Keys: ← → move between intervals, Enter opens log lines" between chart and readout bar; blue series line, orange onset band and aqua leading marker crisp on #0d0d0d with no label collisions or clipping; drawer legible at 360px with a neutral backdrop. The Analyze incident button itself was not screenshotted (it lives in the collapsed own-files form); it is covered by the primary-token design-rule test.

Script left behind for re-runs: `node .planning/quick/261020-exy-restyle-the-culprit-console-to-the-rayca/261020-exy-render-check.mjs --out <dir>` after `npm run build`. The preview server and the browser are stopped by the script (port 4173 verified closed, no leftover Chrome).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Hit band was only about 3px past the border, not 4px, and the probe flagged hidden buttons**
- **Found during:** Task 3 first render-check run
- **Issue:** The `inset: calc((36px - 44px) / 2) 0` band is measured from the padding box, so the 1px border left it 3px past the visible edge; and the probe counted buttons inside the closed Timeline data table details.
- **Fix:** Band is now explicit: `top: 50%; height: var(--hit-min); transform: translateY(-50%)` (centred 44px). The probe skips buttons where `checkVisibility()` is false and reports what was hit when a miss occurs. Adjacent stacked buttons with an 8px gap split the gap between them, so the probe checks 3px beyond each edge rather than a full 4px.
- **Files modified:** src/styles.css, 261020-exy-render-check.mjs
- **Commit:** 18227b3

No other deviations. No package was installed, src/core and package manifests are untouched (verified by git diff against 319d08d), no font binary was added.

## Known Stubs

None.

## Threat Flags

None. The only new DOM nodes are built with el() and icon() (text and attribute only); the CSS has no remote URL or @import (enforced by the design-rules test); the render check binds only to 127.0.0.1 with a throwaway profile and closes both children.

## Gates

- npm run typecheck: green (tsc --noEmit, no errors)
- npm test: 29 test files, 455 tests, all passed
- npm run build: green
- git diff --name-only 319d08d -- src/core package.json package-lock.json: empty

## Self-Check: PASSED

- Commits e796c45, 402f14d, 18227b3 exist in history on master.
- Render check, UI-SPEC, styles.css, fonts.ts, verdict.ts, timeline.ts and both test files exist and carry the described changes.
