---
phase: quick-261020-exy
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/styles.css
  - tests/ui/contrast.test.ts
  - src/ui/fonts.ts
  - tests/ui/case-picker.test.ts
  - src/assets/fonts/FONTS.md
  - README.md
  - index.html
  - src/ui/verdict.ts
  - src/ui/timeline.ts
  - .planning/quick/261020-exy-restyle-the-culprit-console-to-the-rayca/261020-exy-render-check.mjs
  - .planning/phases/04-incident-console-and-investigation-flow/04-UI-SPEC.md
autonomous: true
requirements: [UX-03, UX-08, UX-09]

estimate:
  tokens: 90000
  raw_tokens: 90000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "Opening the console shows the Raycast dark ladder: page #07080a, cards #0d0d0d edged by a 1px #242728 hairline with 10px corners, and no gradient, glass or drop shadow anywhere (D-01, D-04)"
    - "Analyze incident is the only solid white control (black text, 8px corners, #e8e8e8 when pressed); no button is filled with blue, red, green or yellow, and the Clear inputs confirmation uses secondary chrome (D-02, D-06)"
    - "Every keyboard focus shows a 2px #57c1ff ring with a 2px offset, while the loaded case, active signature filter and selected table row show a 4px ink left rule plus a check icon or row fill, never colour alone (D-02)"
    - "Warning chips (confidence caution labels and warning count chips) are soft yellow badges, a 15% #ffc533 tint with #ffc533 text, and always carry an alert icon and a text label (D-04)"
    - "The timeline shows a keycap hint with flat #121212 kbd keys for the arrow keys and Enter, and its data colours are unchanged and at least 5:1 on the #0d0d0d chart surface (D-04, D-05)"
    - "Interface text uses Inter when the optional local Inter-Variable.woff2 is present and a local system face otherwise, at weights 400 and 500 only with ss03 enabled on body; hashes, paths, signatures and log lines stay monospace; nothing is fetched from another origin (D-03)"
    - "At 1280x720 and 360x740 the checkout case renders with no console errors, no off-origin request and no horizontal scroll at 360px, and core-path buttons draw 36px tall while accepting clicks across a 44px band (D-01)"
    - "npm run typecheck, npm test and npm run build pass, and 04-UI-SPEC.md states the same tokens and contrast figures that tests/ui/contrast.test.ts pins"
  artifacts:
    - path: "src/styles.css"
      provides: "Raycast :root tokens (surface ladder, white primary, focus blue, Raycast status accents, radii, 36px control height) and every component rule restyled through them"
      contains: "--color-focus: #57c1ff"
    - path: "tests/ui/contrast.test.ts"
      provides: "Token pins, WCAG ratios on page/surface/elevated/raised, soft-badge composite contrast and the Raycast design-rules suite"
      contains: "Raycast design rules"
    - path: "src/ui/fonts.ts"
      provides: "Local font loader mapping Inter-Variable.woff2 first, then Geist and Geist Mono"
      contains: "Inter-Variable.woff2"
    - path: "tests/ui/case-picker.test.ts"
      provides: "Font mapping order and the licence-beside-WOFF2 rule for three allowed files"
      contains: "Inter-Variable.woff2"
    - path: "src/assets/fonts/FONTS.md"
      provides: "Font provenance note naming Inter, Geist and Geist Mono and the OFL rule"
      contains: "Inter-Variable.woff2"
    - path: "src/ui/verdict.ts"
      provides: "Caution label chips rendered as soft warning badges with icon plus text"
      contains: "chip chip-warning"
    - path: "src/ui/timeline.ts"
      provides: "Timeline key hint built from kbd keycaps"
      contains: "key-hint"
    - path: "index.html"
      provides: "theme-color matching the new canvas"
      contains: "#07080a"
    - path: ".planning/quick/261020-exy-restyle-the-culprit-console-to-the-rayca/261020-exy-render-check.mjs"
      provides: "Re-runnable headless render check (Chrome over CDP) at 1280x720 and 360x740"
      contains: "Page.captureScreenshot"
    - path: ".planning/phases/04-incident-console-and-investigation-flow/04-UI-SPEC.md"
      provides: "UI contract synced to the Raycast palette, typography, radii, controls and validation record"
      contains: "#07080a"
  key_links:
    - from: "tests/ui/contrast.test.ts"
      to: "src/styles.css"
      via: "readFileSync of src/styles.css, first :root block token regex, WCAG luminance math"
      pattern: "color-page': '#07080a'"
    - from: "src/ui/fonts.ts"
      to: "src/assets/fonts/"
      via: "import.meta.glob('../assets/fonts/*.woff2') mapped by file name"
      pattern: "Inter-Variable\\.woff2"
    - from: "src/styles.css"
      to: "src/ui/fonts.ts"
      via: "--font-ui names the family 'Inter' that registerLocalFonts registers as a FontFace"
      pattern: "--font-ui:\\s*Inter"
    - from: "src/ui/timeline.ts"
      to: "src/styles.css"
      via: "kbd elements inside p.key-hint are drawn by the kbd and .key-hint rules"
      pattern: "el\\('kbd'"
    - from: "src/ui/verdict.ts"
      to: "src/styles.css"
      via: "caution chips carry class 'chip chip-warning', drawn by the soft warning badge rule"
      pattern: "chip chip-warning"
    - from: ".planning/phases/04-incident-console-and-investigation-flow/04-UI-SPEC.md"
      to: "tests/ui/contrast.test.ts"
      via: "recorded contrast figures equal the pinned figures"
      pattern: "17\\.69"
---

<objective>
Restyle the Culprit incident console to the Raycast dark design system, tweaked by the minimalist-ui rules, without changing any behaviour, copy, DOM or ARIA contract that `tests/ui/*` exercises (the one addition is a visible keycap hint for timeline keys the slider already supports).

The brief's six locked decisions are cited here as D-01 to D-06 (brief decision N = D-0N): D-01 surface ladder, hairlines, radii, 36px controls with 44px hit areas; D-02 white primary CTA, focus ring, selection cues; D-03 Inter plus ss03, weights 400/500, mono for data, optional local Inter file; D-04 no gradients, glass or emoji, soft status badges with icon plus text, kbd keycaps, off-black text; D-05 data-viz colours stay and are re-validated on #0d0d0d; D-06 accents only in status badges/icons and chart marks.

Purpose: the demo should read as a calm, premium developer tool while staying offline, deterministic and accessible (contrast, visible focus, colour never alone, usable at 360px).
Output: restyled `src/styles.css`, updated token and font tests, an optional local Inter font hook, two small DOM additions (caution chip icons, timeline key hint), a re-runnable headless render check, and a synced 04-UI-SPEC.md.
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.claude/CLAUDE.md
@.planning/quick/261020-exy-restyle-the-culprit-console-to-the-rayca/261020-exy-BRIEF.md

The brief names the source DESIGN.md (Raycast). Every value this plan needs is restated below, so you do not need to read DESIGN.md. Read `04-UI-SPEC.md` only in Task 3 (it is about 55 KB).

Baseline commit at planning time: `319d08d` (HEAD). Host Node is v24 (global `fetch` and `WebSocket` available); the project pins Node 22.x and Node 22.4+ also has both globals.

<interfaces>
From src/ui/dom.ts (text-only DOM construction; never use markup strings):
- `el(tag, { className?, text?, attrs?, on? }, children?: Array<Node | string>)` returns the element; string children become text nodes.
- `icon(name, className?)` returns an `aria-hidden` 16px SVG `<use href="#icon-{name}">`; `alert-triangle` and `check` exist in the index.html sprite.

From src/ui/fonts.ts (current; Task 1 extends it):
- `interface FontFaceSpec { family: 'Geist' | 'Geist Mono'; url: string }`
- `fontFacesFromGlob(record: Record<string, string>): FontFaceSpec[]` maps by base file name in EXPECTED_FILES order.
- `registerLocalFonts(): void` adds a FontFace per found file with `weight: '100 900'`, `display: 'swap'`.

From src/ui/timeline.ts `renderTimeline` (around lines 175-195 and 589): `title`, `legend`, `chartHost` are built, then `section.append(header, title, legend, chartHost)`, then the optional `noteLine`, then `readoutBar` and `twin`.

From src/ui/verdict.ts `renderCaution` (around line 30): chips render as `el('li', { className: 'chip', text: chip })` inside `ul.chip-list[aria-label="Confidence labels"]`.

Selectors used by the render check: case card `button[data-case-id="checkout-outage"]` (accessible name "Load Checkout outage"); after a result the picker becomes `.case-toggle` buttons; result heading `#result-title` (text starts with "Result:"); verdict section `.verdict`; verdict and lineup buttons labelled "Inspect evidence"; copy button "Copy Markdown postmortem"; readout button text starts with "Show log lines"; drawer `dialog#suspect-drawer`.
</interfaces>

## Artifacts this plan produces

| File | Created / changed | Symbols and rules |
|------|-------------------|-------------------|
| `src/styles.css` | changed | `:root` tokens: changed `--color-page`, `--color-surface`, `--color-raised`, `--color-ink`, `--color-ink-2`, `--color-muted`, `--color-border`, `--color-control-border`, `--color-grid`, `--color-axis`, `--color-good`, `--color-warning`, `--color-critical`, `--font-ui`; new `--color-elevated`, `--color-hairline-strong`, `--color-primary`, `--color-primary-pressed`, `--color-on-primary`, `--color-focus`, `--color-warning-soft`, `--radius-card`, `--radius-control`, `--radius-row`, `--radius-key`, `--control-height`, `--hit-min`, `--weight-medium`; retired: the sky-blue accent, its on-accent text colour, the destructive fill and the semibold weight token. New rules: `kbd`, `.key-hint`, mono literal-rendering group, button `::after` hit band, `b, strong, th` weight |
| `tests/ui/contrast.test.ts` | changed | new `SPEC`, `rgbaToken`, `composite`, four `BACKGROUNDS`, new pinned figures, `describe('Raycast design rules')` |
| `src/ui/fonts.ts` | changed | `FontFaceSpec['family']` adds `'Inter'`; `EXPECTED_FILES` lists `Inter-Variable.woff2` first |
| `tests/ui/case-picker.test.ts` | changed | font mapping order and three-file licence allow-list |
| `src/assets/fonts/FONTS.md`, `README.md` | changed | Inter + Geist + Geist Mono provenance and OFL rule; README font note |
| `index.html` | changed | `meta[name=theme-color]` content |
| `src/ui/verdict.ts` | changed | `renderCaution` chips become soft badges with icon |
| `src/ui/timeline.ts` | changed | `keyHint` paragraph with `kbd` keycaps |
| `.planning/quick/261020-exy-restyle-the-culprit-console-to-the-rayca/261020-exy-render-check.mjs` | created | headless Chrome render check (CDP) |
| `.planning/phases/04-incident-console-and-investigation-flow/04-UI-SPEC.md` | changed | Design System font row, Identity, Spacing (radii, controls), Typography, Color, Data-viz marks, Palette Validation Record, regions, focus, copy |

## Source coverage audit

| Source | Item | Covered by |
|--------|------|-----------|
| GOAL | Restyle the console to the Raycast dark system, tweaked by minimalist-ui rules | Tasks 1-3 |
| CONTEXT | D-01 ladder, hairlines, no shadows, radii 10/8/6/4, card padding 16-24, 36px controls with 44px core-path hit areas | Task 1 (tokens, radii, controls), Task 2 (containers), Task 3 (hit probe) |
| CONTEXT | D-02 white primary, pressed #e8e8e8, sky-blue retired as fill, 2px focus ring >= 3:1, selection = rule + check | Task 1 |
| CONTEXT | D-03 Inter first + system fallback, ss03 features, 48/24/16/14 sizes, weights 400/500, mono for data and kbd, optional local Inter file + OFL, no CDN, no deps | Task 1 |
| CONTEXT | D-04 no gradients, no glass, no emoji, soft status badges with icon + text, kbd micro-UI, off-black text | Task 1 (design-rules test), Task 2 (badges, kbd) |
| CONTEXT | D-05 viz colours stay, re-validated on #0d0d0d, documented | Task 1 (test), Task 3 (UI-SPEC record) |
| CONTEXT | D-06 accents only in badges/icons and chart marks | Task 1 (destructive button, selection cues), Task 2 (badges) |
| Constraint | Plain DOM, native CSS, offline, no new dependencies, no src/core edits | Tasks 1-3; Task 3 git-diff gate |
| Constraint | Keep DOM/ARIA contracts in tests/ui; update tests and UI-SPEC where a token is pinned | Task 1 (tests), Task 3 (UI-SPEC) |
| Constraint | Forced-colors, print and reduced-motion rules keep working | Task 1 (no transition rule), Task 2 (forced-colors) |
| Done | typecheck, test, build green; screenshots at 1280x720 and 360x740, no console errors, no horizontal scroll at 360; summary lists every changed token | Task 3 |

No deferred ideas exist for this quick task. Nothing is unplanned.

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: Raycast tokens end to end: :root palette, base type, controls and pinned tests through the built bundle</name>
  <files>src/styles.css, tests/ui/contrast.test.ts, tests/ui/case-picker.test.ts, src/ui/fonts.ts, src/assets/fonts/FONTS.md, README.md, index.html</files>
  <read_first>
    - src/styles.css (read the whole file once, about 2030 lines; then use Grep for specific selectors)
    - tests/ui/contrast.test.ts
    - tests/ui/case-picker.test.ts (fontFacesFromGlob and bundled font licence blocks, lines 61-91)
    - src/ui/fonts.ts
    - src/assets/fonts/FONTS.md
    - README.md (the font note near line 133 only)
    - index.html
    - .planning/quick/261020-exy-restyle-the-culprit-console-to-the-rayca/261020-exy-BRIEF.md
  </read_first>
  <behavior>
    - Token pins: each :root token named below equals its new hex value; the retired accent, on-accent, destructive and semibold tokens are absent.
    - Text pairs (ink, ink-2, muted) are at least 4.5:1 on page, surface, elevated and raised; black on white and on #e8e8e8 is at least 4.5:1; warning text on the 15% warning tint is at least 4.5:1 over surface and raised.
    - Non-text (focus, control-border, good, warning, serious, critical) is at least 3:1 on all four backgrounds; the four data-viz colours are at least 3:1 on page and surface.
    - Pinned figures match the values listed in the action (the same numbers go into the UI-SPEC in Task 3).
    - Design rules: no gradient, no backdrop-filter, only inset box-shadow, no transition, font weights 400/500 only, body enables ss03, --font-ui starts with Inter, no hex literal outside :root, no remote URL or @import, the primary button uses the primary tokens.
    - fontFacesFromGlob maps Inter, Geist, Geist Mono in that order and ignores other files; the licence test allows exactly three WOFF2 names and requires OFL.txt beside any of them.
  </behavior>
  <action>
Work in this order so the tests go red before the CSS changes.

1. Tests first (RED).
   a. In tests/ui/contrast.test.ts keep the helpers `token`, `value`, `channel`, `luminance`, `ratio`, `round2` and the first-`:root`-block extraction. Replace `SPEC` with exactly these pins: color-page #07080a, color-surface #0d0d0d, color-elevated #101111, color-raised #121212, color-ink #f4f4f6, color-ink-2 #cdcdcd, color-muted #9c9c9d, color-border #242728, color-control-border #6a6b6c, color-grid #242728, color-axis #434345, color-primary #ffffff, color-primary-pressed #e8e8e8, color-on-primary #000000, color-focus #57c1ff, color-good #59d499, color-warning #ffc533, color-serious #ec835a, color-critical #ff6161, viz-series-errors #3987e5, viz-onset #d95926, viz-suspect #199e70, viz-context #8fa0b8.
   b. Add `rgbaToken(name)` that reads a `--name: rgba(r, g, b, a);` declaration from the :root block (throws when missing) and `composite(rgba, backgroundHex)` that alpha-blends each channel over the background, rounds each channel to an integer and returns a 6-digit hex.
   c. `BACKGROUNDS` becomes color-page, color-surface, color-elevated, color-raised. The text test checks color-ink, color-ink-2 and color-muted on all four (>= 4.5), color-on-primary on color-primary and on color-primary-pressed (>= 4.5), and color-warning on the color-warning-soft composite over color-surface and over color-raised (>= 4.5). Remove the white-on-destructive check (that token is retired).
   d. The non-text test checks color-focus, color-control-border, color-good, color-warning, color-serious and color-critical on all four backgrounds (>= 3), and viz-series-errors, viz-onset, viz-suspect and viz-context on page and surface (>= 3).
   e. The pinned-figures test pins (2-decimal rounding): ink/surface 17.69, ink-2/surface 12.23, muted/surface 7.09, muted/raised 6.83, focus/surface 9.7, focus/page 10, control-border/surface 3.64, control-border/raised 3.51, good/surface 10.46, warning/surface 12.3, serious/surface 7.37, critical/surface 6.6, critical/raised 6.36, viz-series-errors/surface 5.34, viz-onset/surface 5, viz-suspect/surface 5.71, viz-context/surface 7.3, on-primary/primary 21, on-primary/primary-pressed 17.14, warning over the soft composite on surface 9.12 and on raised 8.6. These were computed at planning time with the same WCAG formula; if one differs at the second decimal, trust the formula, pin the computed value and carry that value into the UI-SPEC in Task 3.
   f. Add `describe('Raycast design rules')` over the whole CSS text, each assertion naming its decision in the test title: no `gradient(` (D-04); no `backdrop-filter` (D-04, no glass); every `box-shadow:` value starts with `inset` (D-01, elevation from the surface ladder only); no `transition` (motion stays gated to POLISH-02); every `font-weight:` value is one of `var(--weight-regular)`, `var(--weight-medium)`, `400`, `500` and :root declares `--weight-medium: 500` (D-03); the `body` rule's `font-feature-settings` lists "calt", "kern", "liga" and "ss03" (D-03); the `--font-ui` value starts with `Inter` (D-03); the retired names `--color-accent`, `--color-on-accent`, `--color-destructive`, `--weight-semibold` and the retired sky-blue hex `#7dd3fc` appear nowhere in the file, comments included (D-02, D-06); after the first :root block there is no hex colour literal (match `#` plus 3, 6 or 8 hex digits not followed by a word character or hyphen, so `#timeline-hatch` and `#result-title` never match) so every colour flows from a token (D-01, D-04 off-black text); no `http:`, `https:` or `@import` (offline, T-261020exy-01); the `.button-primary {` block uses `var(--color-primary)` for background and `var(--color-on-primary)` for colour (D-02).
   g. In tests/ui/case-picker.test.ts replace the fontFacesFromGlob cases: a shuffled record holding `../assets/fonts/GeistMono-Variable.woff2`, `../assets/fonts/Inter-Variable.woff2`, `../assets/fonts/Other.woff2` and `../assets/fonts/Geist-Variable.woff2` maps to Inter, Geist, Geist Mono in that order with Other ignored; a record holding only the Inter file maps to just Inter; an empty record maps to an empty array. The licence test allows exactly `Inter-Variable.woff2`, `Geist-Variable.woff2` and `GeistMono-Variable.woff2` and still requires `OFL.txt` beside any WOFF2 (D-03).
   Run both files and confirm they fail against the current CSS and loader.

2. :root (D-01, D-02, D-03, D-05). Rewrite the token block with: surfaces `--color-page` #07080a, `--color-surface` #0d0d0d, `--color-elevated` #101111, `--color-raised` #121212; text `--color-ink` #f4f4f6, `--color-ink-2` #cdcdcd, `--color-muted` #9c9c9d; lines `--color-border` #242728 (hairline), `--color-hairline-strong` rgba(255, 255, 255, 0.16), `--color-control-border` #6a6b6c (Raycast ash: the hairline-strong overlay is only about 1.6:1, so it cannot carry the 3:1 control rule; static containers use the hairline, interactive controls use ash), `--color-grid` #242728, `--color-axis` #434345; action `--color-primary` #ffffff, `--color-primary-pressed` #e8e8e8, `--color-on-primary` #000000, `--color-focus` #57c1ff; status `--color-good` #59d499, `--color-warning` #ffc533, `--color-warning-soft` rgba(255, 197, 51, 0.15), `--color-serious` #ec835a (unchanged, reserved), `--color-critical` #ff6161; the four viz tokens unchanged (D-05: each clears 3:1 on the new surfaces, the lowest is onset at 5.00:1 on #0d0d0d, so none moves); spacing tokens unchanged; radii `--radius-card` 10px, `--radius-control` 8px, `--radius-row` 6px, `--radius-key` 4px; `--control-height` 36px and `--hit-min` 44px; type sizes and line heights unchanged (body stays 1.5 so the verdict keeps its above-the-fold place at 1280x720; no letter-spacing is added); `--weight-regular` 400 and `--weight-medium` 500 in place of the retired semibold token; `--font-ui` set to Inter, Geist, "Segoe UI Variable Text", "Segoe UI Variable", system-ui, -apple-system, "Segoe UI", sans-serif. Rationale for that stack (record it in a short CSS comment and in the summary): Inter first per D-03; Geist second so the existing optional Geist file stays meaningful; the Segoe UI Variable names precede system-ui because Chrome's system-ui on Windows resolves to static Segoe UI, which has no 500 face, and with `font-synthesis: none` medium text would silently render at 400 and flatten the hierarchy. `--font-mono` is unchanged. Delete the retired accent, on-accent and destructive colour tokens and the semibold weight token. Rewrite the file's head comment to describe the Raycast dark system without naming any retired token.

3. Base and typography (D-03, D-04). In the `body` rule add `font-feature-settings: "calt", "kern", "liga", "ss03";` (literal, not via a token). Add `b, strong, th { font-weight: var(--weight-medium); }` so the user-agent bold (700) never appears. Replace every `var(--weight-semibold)` with `var(--weight-medium)` across the file (34 occurrences at planning time; the 48px Display hash also moves to 500). Add one grouped rule listing every selector that sets `font-family: var(--font-mono)` (find them with a search; about 20, for example `.verdict-hash`, `.lineup-hash`, the `.col-mono` cells, `.log-message`, `.log-stack-text`, `.signature-name`, `.filter-chip`, `.drawer-title`, `.drawer-sha`, `.signal-math`, `.file-path`, `.range-text`, `.trust-line`, `.own-textarea`, `.copy-fallback-text`, `.level-chip`, `.fact-value.is-mono`, `.trust-detail .is-mono`) plus `kbd`, setting `font-feature-settings: normal` and `font-variant-ligatures: none`, so untrusted hashes, paths and log text render exactly as written. Skip link: background raised, 1px hairline border, control radius. Focus (D-02): the `:focus-visible`, `.drop-zone:focus-within`, `.timeline-slider:focus-visible` and `.marker-hit:focus-visible` outlines use `var(--color-focus)`, 2px, offsets unchanged. Blue marks keyboard focus only, so focus stays distinct from selection (ink) and from the white primary button; the ring is 9.7:1 on surface and 10:1 on page.

4. Retired accent references (D-02, D-06). Map every remaining use of the retired accent: focus outlines go to `var(--color-focus)` (step 3); the loaded `.case-card` / `.case-toggle` 4px left rule, `.case-check`, `.toggle-check`, the selected twin-row and pressed signature-row `inset 4px` rules, the `.readout-bar` left rule and the chart `.selected-ring` stroke go to `var(--color-ink)` (selection is white and never colour alone: the rule pairs with the check icon, `aria-pressed` and the row fill); `.meter-segment.is-filled`, `.score-fill` and `.contribution-fill` go to `var(--color-ink-2)` on the existing `var(--color-grid)` track.

5. Radii (D-01). Replace literal `border-radius` values with tokens: `--radius-card` for `.panel`, `.case-card`, `.status-banner`, `.lineup-card`, `.considered`, `.table-twin`, `.trust-footer`, `.clear-confirm`; `--radius-control` for the three button classes, `.case-toggle`, `.own-textarea`, `.drop-zone`, `.own-select`, `.copy-fallback-text`, `.skip-link`; `--radius-row` for `.caution-banner`, `.readout-bar`, `.chart-tooltip`, `.timeline-slider`; `--radius-key` for `.chip`. Leave the drawer's 0 and `.marker-hit`'s 50%.

6. Controls (D-01, D-02, D-06).
   - `.button-primary`, `.button-secondary` and `.button-destructive` share: `position: relative`, `min-height: var(--control-height)`, padding 0 `var(--space-md)`, control radius, `font: inherit`, medium weight, pointer cursor, plus an `::after` with empty content, `position: absolute` and `inset: calc((var(--control-height) - var(--hit-min)) / 2) 0` (a transparent 4px band above and below, so each button draws 36px but accepts clicks across 44px; the core-path 44px minimum from 04-UI-SPEC.md holds). Before adding `position: relative`, search for any rule that already positions these classes and keep that positioning if found.
   - `.button-primary`: background and 1px border `var(--color-primary)`, colour `var(--color-on-primary)`; `:hover:not(:disabled)` and `:active:not(:disabled)` switch background and border to `var(--color-primary-pressed)`; disabled: background `var(--color-elevated)`, border `var(--color-control-border)`, colour `var(--color-muted)` (kept at 6.9:1 rather than Raycast ash so the disabled label stays readable), cursor not-allowed. This is the page's only solid white control (Analyze incident is the only `.button-primary` in src/ui).
   - `.button-secondary`: transparent background, 1px `var(--color-control-border)`, colour `var(--color-ink)`; hover background `var(--color-raised)` with border `var(--color-muted)`.
   - `.button-destructive`: identical chrome to secondary. Per D-06 no button carries a status fill; the confirm row's critical stripe, its "Clear inputs:" lead and the button label carry the meaning. The literal white text colour in the old destructive rule goes away with it.
   - `.case-toggle`: `min-height: var(--control-height)` at every width (delete the 640px override to 48px), `position: relative` with the same `::after` band, background `var(--color-elevated)`.
   - Positioned buttons now paint above non-positioned siblings, so give the sticky first-column cells of `.considered-table` and `.signatures-table` (inside their max-width 639px blocks) `z-index: 1`; scrolled row buttons then slide under the sticky column.
   - `.drawer-close` and `.drawer-nav-button` keep `min-width: 44px`. `.own-select` stays 44px tall: it is a single-line field (Raycast's store-search-bar height) and a select cannot carry the `::after` band.

7. Containers and inputs (D-01). `.panel`: background surface, `1px solid var(--color-border)`, card radius, padding 16px / 24px unchanged. `.case-card`: background `var(--color-elevated)`, 1px `var(--color-control-border)` (it is a button), card radius; hover border `var(--color-ink-2)`. `.own-textarea`, `.own-select` and `.copy-fallback-text`: background `var(--color-elevated)`, 1px `var(--color-control-border)`, control radius. `.drop-zone` keeps its 2px dashed control border and control radius; drag-over keeps the solid ink border and raised fill. Add no `transition` or new `animation` anywhere.

8. Fonts (D-03). In src/ui/fonts.ts the `FontFaceSpec` family union becomes `'Inter' | 'Geist' | 'Geist Mono'` and `EXPECTED_FILES` lists `Inter-Variable.woff2` mapped to `Inter` first, then the two Geist entries; update the doc comments ("Inter first"); `registerLocalFonts` is unchanged (its `'100 900'` weight range covers Inter's variable axis). Do NOT download or commit any font file, and add no CDN or remote reference anywhere. In src/assets/fonts/FONTS.md describe Inter (preferred interface face), Geist (second interface choice) and Geist Mono (hashes, paths, signatures, log lines, kbd); add `Inter-Variable.woff2` to the expected-files table; state that `OFL.txt` must carry the SIL OFL 1.1 text plus the copyright notice of every committed family and must sit beside any WOFF2 (the test enforces it); keep the status section accurate: no WOFF2 is committed, so the interface renders with the Segoe UI Variable / system stack and the mono fallback, and adding files needs no code change. In README.md update only the font note near line 133 to the same facts (no URLs, no absolute paths: README is part of the rebuild-surface contract).

9. index.html: set the `theme-color` meta content to #07080a. Change nothing else in that file.

10. GREEN: run the two test files, then the full suite and the build, then confirm the bundled CSS carries the new tokens (the bundle keeps the space after the colon in custom properties, so match with optional whitespace).
  </action>
  <verify>
    <automated>npm test -- --run tests/ui/contrast.test.ts tests/ui/case-picker.test.ts</automated>
    <fails_when>non-zero exit, "failed" in the Vitest summary, or either file reporting 0 tests</fails_when>
    <automated>npm test</automated>
    <fails_when>non-zero exit or "failed" for any suite (static-safety, rebuild-surface and every core suite must stay green)</fails_when>
    <automated>npm run build</automated>
    <fails_when>non-zero exit or any "error TS" line</fails_when>
    <automated>node -e "const fs=require('fs');const d='dist/assets';const css=fs.readdirSync(d).filter((n)=>n.endsWith('.css')).map((n)=>fs.readFileSync(d+'/'+n,'utf8')).join('');for(const re of [/--color-page:\s*#07080a/,/--color-focus:\s*#57c1ff/,/ss03/,/--radius-card:\s*10px/]){if(!re.test(css)){console.error('missing in bundle: '+re);process.exit(1)}}console.log('bundle ok')"</automated>
    <fails_when>non-zero exit or "missing in bundle" on stderr (the new tokens did not reach the shipped CSS)</fails_when>
  </verify>
  <acceptance_criteria>
    - tests/ui/contrast.test.ts pins the 23 token values above, checks four backgrounds, pins the listed figures and contains a passing "Raycast design rules" describe block.
    - tests/ui/case-picker.test.ts expects Inter, Geist, Geist Mono order and allows exactly three WOFF2 names with OFL.txt beside them.
    - src/ui/fonts.ts exports the extended family union; no font binary was added under src/assets/fonts.
    - index.html theme-color is #07080a; the built CSS under dist/assets contains the new tokens.
  </acceptance_criteria>
  <done>The console renders in the Raycast palette through tokens alone: white Analyze button, blue focus ring, ink selection rules, 10/8/6/4 radii, 36px controls with a 44px hit band, Inter-first type at 400/500 with ss03; the token, contrast, design-rule and font tests pass, the full suite and the build are green, and the bundle carries the new tokens. Committed as one atomic commit.</done>
</task>

<task type="auto">
  <name>Task 2: Components: soft status badges, kbd keycaps with a timeline key hint, hairline containers, tables, chart surface and drawer</name>
  <files>src/styles.css, src/ui/verdict.ts, src/ui/timeline.ts</files>
  <read_first>
    - src/styles.css (Grep the selectors named below instead of re-reading the whole file)
    - src/ui/verdict.ts (lines 1-45: imports, renderConfidenceMeter comment, renderCaution)
    - src/ui/timeline.ts (lines 170-215 and 585-595: title/legend/chartHost construction and the section.append call)
    - src/ui/dom.ts
  </read_first>
  <action>
1. Badges (D-04, D-06).
   - `.chip` (neutral metadata: header chips, pattern, trace match, evidence type, overlap, level, Leading): background `var(--color-raised)`, `1px solid var(--color-border)`, colour `var(--color-ink-2)`, key radius, padding unchanged; `.leading-tag` keeps ink text. Chips are not controls, so the hairline is enough.
   - `.chip-warning` becomes the soft status badge: background `var(--color-warning-soft)`, border colour transparent, colour `var(--color-warning)`, and `.chip-warning .icon` colour `var(--color-warning)` (9.12:1 over surface and 8.6:1 over raised, both pinned in Task 1). The two existing warning count chips (status banner, trust footer) already carry the alert icon plus text.
   - In src/ui/verdict.ts `renderCaution`, render each caution label as `el('li', { className: 'chip chip-warning' }, [icon('alert-triangle', 'icon'), chip])` so every soft badge carries icon plus text (D-04). The `ul.chip-list` and its `aria-label`, the label order and the label text stay exactly as they are. Update the `renderConfidenceMeter` doc comment so it says the filled segments carry the ink fill.
   - Status icons keep their tone colours (good, warning, critical) and banner text stays ink; no status colour lands on a button, heading, link or body text (D-06).

2. Keycaps (D-04).
   - Add a `kbd` rule: `display: inline-block`, `min-width: 20px`, padding 0 `var(--space-xs)`, `1px solid var(--color-border)`, key radius, flat background `var(--color-raised)` (no gradient), colour `var(--color-ink-2)` (11.78:1), mono font, Label size, `line-height: 20px`, centred text.
   - Add `.key-hint`: margin `var(--space-sm)` 0 0, colour `var(--color-ink-2)`, Label size and line height; normal inline flow so the text wraps at 360px.
   - In src/ui/timeline.ts `renderTimeline`, build one `keyHint` paragraph beside the existing `title` / `legend` construction: `el('p', { className: 'key-hint' }, ['Keys: ', el('kbd', { text: '←' }), ' ', el('kbd', { text: '→' }), ' move between intervals, ', el('kbd', { text: 'Enter' }), ' opens log lines'])`, using literal spaces in the strings so assistive tech reads separate words. Append it right after `chartHost`: `section.append(header, title, legend, chartHost, keyHint)`; the note line, readout bar and table twin follow unchanged. The arrows are U+2190 and U+2192 (not emoji). Text-only construction through `el()`; no markup strings. The hint documents keys the slider already handles (04-UI-SPEC Keyboard map), so it adds no shortcut and POLISH-02 stays gated.

3. Containers (D-01).
   - `.status-banner`: add `1px solid var(--color-border)`; `.status-banner.tone-critical` keeps its 4px critical left rule with padding-left adjusted so the text stays aligned beside the 1px hairline on the other sides.
   - `.caution-banner` and `.clear-confirm`: background `var(--color-raised)`, 1px hairline on the other sides, keep the 4px warning / critical left rule. These stripes are status indicators that always ship with an icon or a bold lead plus text, which D-06 allows (Task 3 records this reading in the UI-SPEC).
   - `.lineup-card`: background `var(--color-raised)` with the hairline (already via the token). `.considered`, `.table-twin` and `.trust-footer` keep their hairline through the token.
   - Table header cells (`.considered-table th`, `.twin-table th`, `.log-table th`, `.signatures-table th`) take a `1px solid var(--color-hairline-strong)` bottom rule; body rows keep the hairline; selected and pressed rows keep the raised fill plus the 4px ink inset rule from Task 1.

4. Chart surface (D-05). The timeline panel stays on `var(--color-surface)` (#0d0d0d). Confirm `.marker-ring` and `.peak-dot` read `var(--color-surface)` rather than a fixed colour. `.chart-tooltip`: background `var(--color-raised)`, 1px hairline, row radius. Gridlines and the baseline take the new grid and axis tokens. Do not change any viz token.

5. Drawer. `.suspect-drawer` keeps background `var(--color-raised)` and its hairline left edge; `.drawer-header` keeps raised with the hairline bottom; `.suspect-drawer::backdrop` becomes `rgba(0, 0, 0, 0.72)` (neutral, no blur). The in-drawer secondary hover may stay `var(--color-grid)`.

6. Forced colours, print, motion. In `@media (forced-colors: active)` add `kbd` to the CanvasText-bordered set and keep every existing rule (`.chip-warning` is covered through `.chip`). Confirm the `@media print` block and the `prefers-reduced-motion` block still work and reference only live tokens (the Task 1 design-rules test fails on any retired name). Add no transition, gradient, emoji or shadow.
  </action>
  <verify>
    <automated>npm run typecheck</automated>
    <fails_when>non-zero exit or any "error TS" line (verdict.ts or timeline.ts no longer type-check)</fails_when>
    <automated>npm test</automated>
    <fails_when>non-zero exit or "failed" for any suite, including the design-rules, static-safety and view-model suites</fails_when>
    <automated>npm run build</automated>
    <fails_when>non-zero exit or any "error TS" line</fails_when>
    <automated>node -e "const fs=require('fs');const css=fs.readFileSync('src/styles.css','utf8');const tl=fs.readFileSync('src/ui/timeline.ts','utf8');const vd=fs.readFileSync('src/ui/verdict.ts','utf8');const checks=[[/(^|\n)kbd\s*\{[^}]*var\(--color-raised\)/,css,'kbd rule'],[/\.chip-warning\s*\{[^}]*var\(--color-warning-soft\)/,css,'soft warning badge'],[/\.key-hint\s*\{/,css,'key-hint rule'],[/el\('kbd'/,tl,'kbd in timeline'],[/chip chip-warning/,vd,'caution badge in verdict']];for(const [re,text,name] of checks){if(!re.test(text)){console.error('missing: '+name);process.exit(1)}}console.log('components ok')"</automated>
    <fails_when>non-zero exit or "missing:" on stderr</fails_when>
  </verify>
  <acceptance_criteria>
    - styles.css has a flat `kbd` rule on the raised surface, a `.key-hint` rule and a `.chip-warning` rule on the 15% warning tint.
    - timeline.ts appends a `p.key-hint` with three `kbd` elements after the chart host; verdict.ts renders caution labels as `chip chip-warning` items with the alert icon.
    - Status banner, caution banner, confirm row, lineup cards, tables, tooltip and drawer use the hairline / raised ladder with no shadow or gradient; the backdrop is neutral.
  </acceptance_criteria>
  <done>Badges, keycaps, containers, tables, chart chrome and the drawer follow the Raycast ladder with minimalist rules; warning badges always show icon plus text; the timeline shows its keycap hint; typecheck, the full suite and the build are green. Committed as one atomic commit.</done>
</task>

<task type="auto">
  <name>Task 3: Headless render check at 1280x720 and 360x740, fix what it finds, then sync 04-UI-SPEC</name>
  <files>.planning/quick/261020-exy-restyle-the-culprit-console-to-the-rayca/261020-exy-render-check.mjs, .planning/phases/04-incident-console-and-investigation-flow/04-UI-SPEC.md, src/styles.css</files>
  <precondition>Google Chrome or Microsoft Edge is installed at its default Windows path, or CHROME_PATH points at a Chromium-based browser, and ports 4173 and 9223 on 127.0.0.1 are free.</precondition>
  <read_first>
    - .planning/phases/04-incident-console-and-investigation-flow/04-UI-SPEC.md (once, whole file)
    - tests/ui/contrast.test.ts (the pinned figures to copy into the UI-SPEC)
    - src/ui/case-picker.ts lines 60-100 (case button attributes) only if a selector in the interfaces block does not resolve
  </read_first>
  <action>
1. Write the render check as an ES module at `.planning/quick/261020-exy-restyle-the-culprit-console-to-the-rayca/261020-exy-render-check.mjs`. Use only Node built-ins (`node:child_process`, `node:fs`, `node:os`, `node:path`) plus the global `fetch` and `WebSocket`; no npm package. It runs from the repo root and:
   a. Accepts `--out <dir>` (default: `culprit-261020-exy` under `os.tmpdir()`) and `--chrome <path>` (default: the `CHROME_PATH` env var, then the standard Chrome and Edge install paths on Windows, then `google-chrome` or `chromium` on PATH). Exits 1 with "run npm run build first" when `dist/index.html` is missing.
   b. Spawns the preview server as `process.execPath` with `node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4173 --strictPort` and polls `http://127.0.0.1:4173/` until it answers 200 (15 s limit).
   c. Spawns the browser headless with `--headless=new --remote-debugging-port=9223 --user-data-dir=<out>/profile --no-first-run --no-default-browser-check --disable-extensions --disable-background-networking --disable-component-update --disable-sync about:blank`, polls `http://127.0.0.1:9223/json/list` for a page target and connects a WebSocket to its `webSocketDebuggerUrl` with a small send(method, params) helper (id-to-promise map plus event listeners).
   d. Enables Page, Runtime, Log, Network, DOM and CSS. It records console errors (`Runtime.consoleAPICalled` of type error or assert, `Runtime.exceptionThrown`, `Log.entryAdded` at level error; an entry whose URL ends with `/favicon.ico` is reported as INFO rather than an error) and every `Network.requestWillBeSent` URL whose origin is not `http://127.0.0.1:4173` and is not `data:` or `blob:` (FAIL "off-origin request": privacy and offline proof).
   e. For each viewport, 1280x720 (mobile false) then 360x740 (mobile true), both at deviceScaleFactor 1 via `Emulation.setDeviceMetricsOverride`: navigate to the preview URL and wait for `Page.loadEventFired`; at 1280 only, before loading a case, press Tab once through `Input.dispatchKeyEvent` (keyDown and keyUp, key Tab, code Tab, windowsVirtualKeyCode 9) and PASS when the active element's computed outline is solid, 2px and `rgb(87, 193, 255)`; click `button[data-case-id="checkout-outage"]` through `Runtime.evaluate` and poll up to 10 s until `#result-title` is visible with text starting "Result:" and `.verdict` exists; then check: body background is `rgb(7, 8, 10)`; `document.documentElement.scrollWidth <= window.innerWidth` (FAIL at 360 when wider; print both widths at both sizes); the set of computed `font-weight` values over every element that has a direct non-empty text node is a subset of 400 and 500; at 1280 the `.verdict` heading's document top (rect.top plus scrollY) is at most 720 (WARN, not FAIL, when it is lower, and print the value); a hit-area probe over the core-path buttons (every `.case-toggle`, the buttons whose text is "Inspect evidence", the button whose text is "Copy Markdown postmortem" and the readout button whose text starts with "Show log lines"): scroll each to the viewport centre, then `document.elementFromPoint(centreX, rect.top - 3)` and `(centreX, rect.bottom + 3)` must both resolve through `closest('button')` to that same button and `rect.height` must be at least 35.5 (FAIL listing any miss); `CSS.getPlatformFontsForNode` for `#result-title` and `.verdict-hash` prints the rendered family names (INFO); `Page.captureScreenshot` (png) writes `<out>/culprit-<width>x<height>.png`. At 360 only, also click the verdict's "Inspect evidence" button, wait until `#suspect-drawer` has the `open` attribute, re-check horizontal overflow, write `<out>/culprit-360x740-drawer.png`, dispatch Escape and confirm the dialog closed.
   f. Always cleans up in a finally block: `Browser.close` over CDP, then kill the browser and preview children (if a child is still alive on Windows, run `taskkill /pid <pid> /T /F` through spawnSync). Prints one line per check (`PASS`, `FAIL`, `WARN`, `INFO` plus detail), the screenshot paths, and a last line `RESULT PASS` or `RESULT FAIL (<count>)`, then exits 0 or 1.
   Keep the script free of secrets; the default browser paths are tooling paths, never analysis input.

2. Run `npm run build`, then run the script with `--out` pointed at your session scratchpad directory. Open each PNG with the Read tool and write down what you see at each size: canvas and card tones, the white Analyze or case controls, the soft warning badges on the ambiguous-style labels if present, the keycap hint, the chart colours on the dark surface, label collisions or clipping on the timeline (dataviz step 7), the drawer at 360, and anything off-system (gradients, shadows, stray colour). If any check fails, fix the cause in src/styles.css (or the Task 2 DOM lines if the defect is there), rerun `npm test` and `npm run build`, and rerun the script; after two fix rounds that still fail, stop and record the remaining failure as a deviation in the summary instead of widening scope.

3. Sync `.planning/phases/04-incident-console-and-investigation-flow/04-UI-SPEC.md` to what shipped (the contrast test is the source of the numbers):
   - Frontmatter: add `revised: "2026-10-20"`. Under the title add one blockquote line: revised by quick task 261020-exy to the Raycast dark system (surface ladder, white primary, blue focus only, Inter with ss03, weights 400/500), tweaked by minimalist-ui rules; behaviour, copy, DOM and ARIA contracts unchanged apart from the timeline key hint.
   - Design System font row: Inter (optional local `Inter-Variable.woff2`), then Geist, then "Segoe UI Variable Text" / system stack for the interface; Geist Mono stack for data and kbd; `font-feature-settings: "calt", "kern", "liga", "ss03"` on body, mono resets features and ligatures; no CDN; status: no WOFF2 committed, system stacks in use; why Segoe UI Variable precedes system-ui.
   - Identity and idea: keep the diamond motif (wordmark ink, rank markers unchanged, loaded-case check now ink). Rewrite the ornaments bullet: a four-step surface ladder (page #07080a, surface #0d0d0d, elevated #101111, raised #121212), every card edged by a 1px #242728 hairline, no shadows, gradients, glass, emoji or eyebrows; chrome is monochrome: white marks the one primary action, ink marks selection, #57c1ff marks keyboard focus only; status accents appear only in icons, status stripes and soft badges; data-viz colours only in chart marks.
   - Spacing: replace the 44px exception with: controls draw 36px and keep a 44px hit area through a transparent 4px band above and below; icon-only buttons stay 44px wide; the format select stays 44px. Add a radius table (card 10px, control 8px, row 6px, key 4px; drawer 0; marker hit circle). Case switcher: one row of 36px controls with 44px hit areas.
   - Typography: weights 400 and 500 only (Display hash 500, Heading 500, Label strong 500, button text 500); features as above; mono renders literally.
   - Color: replace the Dominant/Secondary/Raised/Accent/Destructive table and the ink/chrome table with the new tokens and their ratios on #0d0d0d (ink 17.69, ink-2 12.23, muted 7.09 and 6.83 on raised, control-border 3.64 and 3.51 on raised, focus 9.7 and 10 on page, hairline and grid #242728 decorative, axis #434345, hairline-strong rgba(255,255,255,0.16) for table header rules). Replace the accent reserved list with: primary white reserved for Analyze incident (black text 21:1, pressed #e8e8e8 17.14:1); focus blue reserved for focus rings; selection is a 4px ink rule plus check icon or raised row fill; meters fill ink-2 on the #242728 track; the Clear inputs confirmation uses secondary chrome inside the critical-striped confirm row (D-06: no status fill on buttons). Status table: good #59d499 10.46, warning #ffc533 12.3, serious #ec835a 7.37 (reserved), critical #ff6161 6.6 (6.36 on raised); soft warning badge = 15% #ffc533 tint with #ffc533 text (9.12 over surface, 8.6 over raised), always with icon plus text; banner text stays ink except inside soft badges; status stripes count as status indicators.
   - Data Visualization Contract: surface rings and leading-suspect ring #0d0d0d; selected bucket ring ink #f4f4f6; gridlines #242728, baseline #434345; tooltip #121212 with 1px hairline and 6px radius; accessibility pass sentence: text 7.09:1 or higher on the chart surface, series/onset/suspect/context marks 5.00:1 or higher on #0d0d0d.
   - Palette Validation Record: add a row for the Raycast surfaces (errors 5.34 / 5.51, onset 5.00 / 5.16, suspect 5.71 / 5.88, context 7.30 / 7.53 on #0d0d0d / #07080a, computed with the WCAG formula in tests/ui/contrast.test.ts; pairwise colour-difference figures are surface-independent and unchanged) and note the 2026-10-20 render check at 1280x720 and 360x740 with what you observed in step 2.
   - Layout and Regions, Input panel, Verdict card, Timeline card, Suspect drawer: card radius 10px with hairline; case cards on elevated with the ash border, ink left rule and check; Analyze solid white with black text; confidence meter ink-2 on #242728; the key hint sits between the chart and the readout bar; drawer backdrop rgba(0,0,0,0.72); contribution bar ink-2 on #242728.
   - Focus and visibility: 2px #57c1ff outline with 2px offset; skip link ink on #121212. Responsive: the switcher row text.
   - Copywriting: add a row "Timeline key hint | Keys: ← → move between intervals, Enter opens log lines (keys drawn as kbd keycaps)"; change the destructive confirmation note from the critical fill to secondary chrome inside the critical-striped row.
   - Every hex value from the pre-change `:root` block (see `git show 319d08d:src/styles.css`, lines 4-25) other than the four data-viz values and the unchanged serious value must be gone from the UI-SPEC, along with the old navy dialog backdrop; describe the earlier palette by name if you need to refer to it, never by value. The light-theme reference row in the Palette Validation Record stays.

4. Final gates: typecheck, full test suite, build, a re-run of the render check, a check that the preview port is closed, and a git diff against `319d08d` proving src/core, package.json and package-lock.json are untouched. In the summary list every token that changed as old value to new value (from `git diff 319d08d -- src/styles.css`), every new and retired token, the rendered font families reported by the script, and the screenshot observations.
  </action>
  <verify>
    <automated>npm run build</automated>
    <fails_when>non-zero exit or any "error TS" line</fails_when>
    <automated>node .planning/quick/261020-exy-restyle-the-culprit-console-to-the-rayca/261020-exy-render-check.mjs</automated>
    <fails_when>non-zero exit, a "RESULT FAIL" line, or any line starting with "FAIL" (console error, off-origin request, horizontal overflow at 360px, focus ring mismatch, weight outside 400/500, or a hit-area miss)</fails_when>
    <automated>node -e "fetch('http://127.0.0.1:4173/').then(()=>{console.error('preview still running');process.exit(1)},()=>{console.log('preview stopped');process.exit(0)})"</automated>
    <fails_when>exit 1 or "preview still running" on stderr (the check left its server behind)</fails_when>
    <automated>node -e "const t=require('fs').readFileSync('.planning/phases/04-incident-console-and-investigation-flow/04-UI-SPEC.md','utf8');const gone=t.match(/#(0b1220|121e31|1a2a42|7dd3fc|06222f|d03b3b|e9eef5|b7c3d4|2d405b|66799a|22324a|46587a|0ca30c|fab219)\b|rgba\(5, ?10, ?18/gi);if(gone){console.error('stale values: '+[...new Set(gone)].join(' '));process.exit(1)}for(const v of ['#07080a','#0d0d0d','#101111','#121212','#f4f4f6','#cdcdcd','#9c9c9d','#6a6b6c','#242728','#57c1ff','#59d499','#ffc533','#ff6161','ss03','Inter-Variable.woff2','17.69','9.12','5.34','revised:']){if(!t.includes(v)){console.error('missing: '+v);process.exit(1)}}console.log('ui-spec ok')"</automated>
    <fails_when>non-zero exit, "stale values" or "missing:" on stderr</fails_when>
    <automated>npm run typecheck</automated>
    <fails_when>non-zero exit or any "error TS" line</fails_when>
    <automated>npm test</automated>
    <fails_when>non-zero exit or "failed" for any suite</fails_when>
    <automated>node -e "const out=require('child_process').execSync('git diff --name-only 319d08d -- src/core package.json package-lock.json').toString().trim();if(out){console.error('touched: '+out);process.exit(1)}console.log('core and dependencies untouched')"</automated>
    <fails_when>non-zero exit or "touched:" on stderr (src/core or the dependency manifests changed)</fails_when>
  </verify>
  <acceptance_criteria>
    - The render check exists in the quick-task folder, uses no npm package, prints RESULT PASS, and stops its own server and browser.
    - Screenshots at 1280x720, 360x740 and the 360x740 drawer were viewed and described in the summary, with the rendered font families.
    - 04-UI-SPEC.md carries the new tokens, figures, radii, control heights, focus colour, key hint copy and validation row, and none of the retired palette values.
  </acceptance_criteria>
  <done>The checkout case renders cleanly at both sizes with no console error, no off-origin request and no 360px horizontal scroll; core-path buttons keep 44px hit areas; 04-UI-SPEC.md matches the shipped tokens and pinned figures; typecheck, tests and build are green; src/core and dependencies are untouched; the summary lists every changed token and the observations. Committed as one atomic commit (the docs commit of PLAN, SUMMARY and STATE is left to the orchestrator).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| user files and paste -> browser DOM | Log and history text is untrusted and reaches the page as text nodes; this plan adds DOM nodes next to it (caution chip icons, key hint) |
| bundle -> network | The shipped app must make no request beyond its own origin; a font or stylesheet fetched from a CDN would leak usage and break offline use |
| developer machine -> headless browser | The render check opens a local debugging port and a preview server for the duration of the check |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261020exy-01 | Information disclosure | src/styles.css, src/ui/fonts.ts (font loading) | high | mitigate | Inter is loaded only from `src/assets/fonts` through `import.meta.glob`; no file is downloaded; the design-rules test fails on `http:`, `https:` or `@import` in styles.css; static-safety keeps rejecting absolute URLs and network APIs in src and index.html; the render check FAILs on any off-origin request |
| T-261020exy-02 | Tampering (XSS) | src/ui/verdict.ts, src/ui/timeline.ts | medium | mitigate | New nodes are built only with `el()` and `icon()` (textContent / setAttribute); static-safety keeps failing on innerHTML, outerHTML, insertAdjacentHTML and document.write |
| T-261020exy-03 | Spoofing (misleading UI) | mono data rendering | low | mitigate | Mono selectors reset font features and ligatures, so hashes, paths and log lines display exactly as written rather than as ligature or stylistic-set substitutes |
| T-261020exy-04 | Elevation of privilege | render-check debugging port | low | mitigate | Chrome binds the debugging port to 127.0.0.1 with a throwaway profile under the output directory; the script closes the browser and kills both children in a finally block; a verify step confirms the preview port is closed |
| T-261020exy-05 | Repudiation | font licensing | low | accept | No font binary is committed; the licence test still requires OFL.txt beside any WOFF2 a human adds later |
| T-261020exy-SC | Tampering | npm/pip/cargo installs | high | mitigate | No package is installed in this plan; static-safety pins exactly four dev dependencies and the Task 3 git diff gate proves package.json and package-lock.json are unchanged; the package-legitimacy gate has nothing to admit |
</threat_model>

<verification>
- `npm run typecheck`, `npm test` and `npm run build` are green after every task.
- tests/ui/contrast.test.ts pins the new tokens, recomputes WCAG ratios on page, surface, elevated and raised, checks the soft-badge composite and enforces the Raycast design rules (no gradient, glass, drop shadow or transition; weights 400/500; ss03; Inter first; no hex outside :root; no remote URL).
- The render check at 1280x720 and 360x740 reports RESULT PASS: no console error, no off-origin request, no horizontal overflow at 360px, blue 2px focus ring, weights 400/500, 44px hit band on core-path buttons; screenshots viewed and described.
- 04-UI-SPEC.md states the same tokens and figures as the tests and no retired palette value.
- `git diff --name-only 319d08d -- src/core package.json package-lock.json` is empty.
</verification>

<success_criteria>
- Every locked decision D-01 to D-06 is visible in the shipped CSS and enforced by a test or the render check.
- All tests/ui DOM and ARIA contracts still pass unchanged; the only DOM additions are the caution chip icons and the timeline key hint.
- Forced-colors, print and reduced-motion rules still apply; selection stays rule plus check or row fill, never colour alone.
- The summary lists every changed, new and retired token, the rendered font families and the screenshot observations.
</success_criteria>

<output>
Create `.planning/quick/261020-exy-restyle-the-culprit-console-to-the-rayca/261020-exy-SUMMARY.md` with `status: complete` in its frontmatter when done. Include the token change table (old to new), new and retired tokens, the discretion choices made here (Segoe UI Variable before system-ui, Geist kept second, ash as control border, muted for disabled text, ink selection and meters, secondary chrome for the destructive confirm, 44px select, one kbd hint on the timeline), render-check output, screenshot observations and any deviation.
</output>
