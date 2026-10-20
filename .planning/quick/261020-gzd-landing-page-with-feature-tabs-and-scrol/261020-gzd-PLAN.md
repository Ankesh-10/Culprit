---
phase: quick-261020-gzd
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - index.html
  - src/main.ts
  - src/ui/router.ts
  - src/ui/landing.ts
  - src/ui/landing-model.ts
  - src/ui/landing-preview.ts
  - src/ui/landing-tabs.ts
  - src/ui/landing-demo.ts
  - src/ui/app.ts
  - src/ui/motion.ts
  - src/styles.css
  - tests/ui/router.test.ts
  - tests/ui/landing-model.test.ts
  - tests/ui/landing-copy.test.ts
  - tests/ui/static-safety.test.ts
  - tests/ui/contrast.test.ts
  - README.md
  - .planning/quick/261020-gzd-landing-page-with-feature-tabs-and-scrol/261020-gzd-render-check.mjs
  - .planning/phases/04-incident-console-and-investigation-flow/04-UI-SPEC.md
autonomous: true
requirements: [UX-01, UX-09, POLISH-02]

estimate:
  tokens: 120000
  raw_tokens: 120000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "Opening the app with an empty hash (or #/) shows the landing view: a headline that wraps to at most 2 lines at every width from 320 to 1440px, one supporting sentence, a white 'Try the checkout outage' primary, an 'Open the console' secondary, a '/' key hint, and a live mini result card whose hash reads 2222222 and score 0.91, computed in the browser from the bundled checkout fixture; the console view is hidden and its case-card sparklines have not been computed (D-01, D-02, D-07)"
    - "'Try the checkout outage' opens the console and loads that case (result heading 'Result: Checkout outage', verdict hash 2222222); 'Open the console' and the header 'Console' link open #/app, 'Home' returns to #/; browser back and forward switch views; a #/app deep link opens the console directly; on every view change focus lands on the new view's heading, document.title switches between 'Culprit: find the commit that broke it' and 'Culprit — Incident analysis', aria-current marks the active nav link and an open suspect drawer is closed when leaving the console (D-03)"
    - "Six feature tabs (Onset detection, Ranked suspects, Linked timeline, Evidence drawer, Markdown postmortem, Private and offline) follow the WAI-ARIA tabs pattern with roving tabindex, ArrowLeft/ArrowRight/Home/End and automatic activation; each panel has a heading, 2-3 sentences and a real preview built by the shipped renderers from the bundled fixtures; the weights shown are the SCORING_V1 constants 0.35/0.30/0.25/0.10; with JavaScript disabled all six panels are readable (D-08)"
    - "At 640px and wider with motion allowed, the 'See it work' section pins a preview stage while five real text steps scroll past; scrolling changes the active step and its stage animates (inputs list rises, timeline line draws and onset band wipes, lineup cards rise and the #1 diamond pulses once, drawer slides in and its signal bars fill, Markdown lines reveal); every animation settles and the page always scrolls freely past the section (D-09)"
    - "With prefers-reduced-motion: reduce the landing runs zero animations: the hero card shows its exact values at once and the demo is a stacked sequence of five steps, each with its static final preview; below 640px with motion allowed the demo is stacked and each preview animates once when it enters the viewport (D-09, D-13)"
    - "The trust strip states the accepted inputs (Culprit JSON history export plus JSON-lines or plain-text logs, up to 1 MiB and 10,000 events, matching src/core constants), deterministic UTC output and 'ranked suspicion, not proof'; a final CTA, a local-only/UTC footer note and a '/' hint close the page; no banned marketing word, invented customer, quote, logo, statistic, emoji, newsletter, signup or pricing appears (D-06, D-10, D-11)"
    - "Keyboard and layout: a 'Skip to content' link leads the landing, focus is always visible, previews are inert (never in the tab order), there is no keyboard trap, and no width from 320 to 1440px scrolls horizontally (D-16)"
    - "The console's behaviour, copy, DOM ids and ARIA contracts do not regress (every inherited render-check console assertion passes at #/app); npm run typecheck, npm test and npm run build are green; src/core and the package manifests are untouched; static-safety, contrast and motionViolations stay green with only narrow, stated additions (D-02, D-04, D-12, D-13, D-14, D-15)"
  artifacts:
    - path: "src/ui/router.ts"
      provides: "Pure parseHash, routeHash, ROUTE_TITLES, ROUTE_ANNOUNCEMENTS plus mountRouter (hashchange, view toggling, title, aria-current, focus on navigation)"
      contains: "export function parseHash"
    - path: "src/ui/landing-model.ts"
      provides: "DOM-free landing maths and copy helpers: prefixIdRefs, FEATURE_TABS, tabKeyTarget, weightsText, limitsText, markdownExcerpt, DEMO_STEPS, scrollProgress, stepAt, demoMode"
      contains: "export function stepAt"
    - path: "src/ui/landing-preview.ts"
      provides: "Memoized bundled streams, preview frames with prefixed ids and inert bodies, hero card, six feature previews and five demo previews built only from the shipped renderers"
      contains: "export function renderHeroCard"
    - path: "src/ui/landing.ts"
      provides: "mountLanding returning show/hide; CTA wiring; lazy preview build; hero entrance"
      contains: "export function mountLanding"
    - path: "src/ui/landing-tabs.ts"
      provides: "WAI-ARIA tabs enhancement of the static feature panels"
      contains: "tablist"
    - path: "src/ui/landing-demo.ts"
      provides: "Scroll demo controller: scrolly, reveal and static modes; stage frames; step activation"
      contains: "export function mountDemo"
    - path: "src/ui/motion.ts"
      provides: "watchScroll: IntersectionObserver-gated passive scroll listener throttled to one animation frame; still the only file using animation-frame APIs"
      contains: "export function watchScroll"
    - path: "tests/ui/router.test.ts"
      provides: "Route parsing, hash and title tests"
      contains: "parseHash"
    - path: "tests/ui/landing-model.test.ts"
      provides: "Id prefixing, tab keyboard model, weights and limits text, Markdown excerpt, scroll progress, step mapping and mode tests"
      contains: "tabKeyTarget"
    - path: "tests/ui/landing-copy.test.ts"
      provides: "index.html landing copy guard: ids match the models, weights and limits match code, banned words, no emoji"
      contains: "SCORING_V1"
    - path: "index.html"
      provides: "#view-landing and #view-app views, landing static content, Home/Console nav in both headers, #route-status"
      contains: "id=\"view-landing\""
    - path: ".planning/quick/261020-gzd-landing-page-with-feature-tabs-and-scrol/261020-gzd-render-check.mjs"
      provides: "Headless render check: landing, routing, tabs, scroll demo, reduced motion, width sweep, plus every inherited console check at #/app"
      contains: "Emulation.setEmulatedMedia"
    - path: ".planning/phases/04-incident-console-and-investigation-flow/04-UI-SPEC.md"
      provides: "Landing View section (routes, tabs, scroll demo, reduced-motion contract, hero size)"
      contains: "## Landing View"
  key_links:
    - from: "src/main.ts"
      to: "src/ui/router.ts"
      via: "mountApp, then mountLanding, then mountRouter whose onEnter calls landing.show()/hide() and consoleApi.activate()/deactivate()"
      pattern: "mountRouter\\("
    - from: "src/ui/landing.ts"
      to: "src/ui/app.ts"
      via: "a plain click on a[data-try-case] calls onTryCase(id): router.navigate('app') then consoleApi.loadCase(id)"
      pattern: "data-try-case"
    - from: "src/ui/app.ts"
      to: "src/ui/palette.ts"
      via: "palette onLoad and onOwnFiles call options.onOpenConsole() before loading, so / works from the landing"
      pattern: "onOpenConsole"
    - from: "src/ui/landing-preview.ts"
      to: "src/worker/protocol.ts"
      via: "bundledStream(id) memoizes handleAnalyzeRequest on toAnalysisInput(findCase(id))"
      pattern: "handleAnalyzeRequest"
    - from: "src/ui/landing-preview.ts"
      to: "src/ui/timeline.ts, src/ui/shortlist.ts, src/ui/drawer.ts, src/ui/copy.ts"
      via: "renderTimeline, renderShortlist, renderDrawerContent and buildPostmortemMarkdown output wrapped by prepareRendered (prefixed ids, stripped focus hooks, inert body)"
      pattern: "prepareRendered\\("
    - from: "src/ui/landing-demo.ts"
      to: "src/ui/motion.ts"
      via: "watchScroll(track, onFrame) feeds scrollProgress/stepAt from landing-model"
      pattern: "watchScroll\\("
    - from: "tests/ui/landing-copy.test.ts"
      to: "index.html"
      via: "weightsText(SCORING_V1.weights) and limitsText(DEFAULT_LOG_LIMITS) must appear verbatim; FEATURE_TABS and DEMO_STEPS ids must have matching markup"
      pattern: "weightsText\\("
    - from: "tests/ui/static-safety.test.ts"
      to: "src/ui/motion.ts"
      via: "scroll listeners may be added only in src/ui/motion.ts and only as passive; the animation-frame allow-list stays exactly ['src/ui/motion.ts']"
      pattern: "passive"
---

<objective>
Add a landing page to Culprit, in the same `index.html`, shown by default at `#/`, with the existing console at `#/app`. The landing has a hero with a live result card, six feature tabs with real previews, a scroll-driven "See it work" demo, a trust strip and a final call to action. It keeps the Raycast-derived style, the gated motion rules and the offline, honest stance.

Decision IDs map to `261020-gzd-BRIEF.md` (every decision there is LOCKED):
- D-01 Architecture: plain DOM, one static Vite app, no router library, no new dependency, `src/core/` untouched; landing is a view at `#/` (empty hash), console at `#/app`.
- D-02 Console contract: console DOM, ids, ARIA and tests stay intact; the console region is hidden while the landing shows; the console's idle sparkline analysis runs only once the console is shown; the landing may analyze bundled fixtures only for its own previews.
- D-03 Navigation: every "Open the console" control sets `location.hash`; both headers carry a Home/Console link pair; back/forward work; `#/app` deep links; on view change focus moves to the new view's `tabindex="-1"` heading and `document.title` updates; one minimal `aria-live` announcement.
- D-04 Tests: existing tests updated only narrowly; DOM-free Vitest for route parsing, tab and keyboard model, scroll-progress to step mapping and formatting.
- D-05 Modules: landing code in new small modules (`router.ts`, `landing.ts`, `landing-model.ts`, `landing-preview.ts`, plus `landing-tabs.ts` and `landing-demo.ts` to keep each file small); `app.ts` changes stay small.
- D-06 Voice: calm, plain, evidence-first; banned words elevate, seamless, unleash, next-gen, game-changer, delve, "AI-powered", revolutionary; no invented customers, quotes, logos, stats, benchmarks or certainty; "ranked suspicion, not proof"; no emoji.
- D-07 Hero (headline at most 2 lines, supporting sentence, white primary "Try the checkout outage", secondary "Open the console", `/` hint, live mini preview that animates on load, stripe band language reused).
- D-08 Feature tabs (WAI-ARIA pattern, six tabs, real renderer previews, text-only DOM, static markup readable without JS).
- D-09 Scroll demo ("See it work": sticky stage, five steps, pure tested progress mapping, IntersectionObserver plus passive rAF-throttled scroll listener in `src/ui/motion.ts`, transform/opacity/stroke-dashoffset only, reduced-motion stacked static, phones stacked with once-on-enter animation, never trap scroll, step text real).
- D-10 Trust strip (three facts, limits verified against code).
- D-11 Final CTA, footer note (local only, UTC), "Press /" hint; no newsletter, signup, pricing or social proof.
- D-12 Style: existing tokens only, no gradient, box-shadow, glass or new hue; radius 10/8/6/4; same type scale plus at most one documented hero size; weights 400/500.
- D-13 Motion: everything inside `@media (prefers-reduced-motion: no-preference)` with an instant correct final state otherwise; contrast pins pass and every new pair is pinned; `motionViolations` stays green and is relaxed only if strictly needed (this plan needs no relaxation).
- D-14 Hard rules: no network, CDN, remote font or image, new npm dependency, HTML-string sink or network API; static-safety green.
- D-15 Build: `npm run build` keeps producing a static bundle that works from `vite preview`; README note only where needed; `tests/core/rebuild-surface.test.ts` stays green.
- D-16 Accessibility: skip link on the landing, visible focus, tabs keyboard model, no keyboard trap, usable 320-1440px with no horizontal scroll.
- D-17 `04-UI-SPEC.md` gets a short "Landing View" section; no other section is rewritten.
- D-18 Done means: typecheck, test and build green with counts; render check at 1280x720 and 360x740 (landing, tabs, scroll demo, reduced motion, `#/app` deep link with hash `2222222`), screenshots saved and viewed, servers and browsers started by the check stopped (never the dev server on 5173).

Purpose: a visitor should understand within seconds what Culprit does, see it working on real bundled data, and reach the console in one click, without any claim the code cannot back.
Output: six new source modules (router, landing, landing-model, landing-preview, landing-tabs, landing-demo), a small `app.ts` API, a `watchScroll` helper in `motion.ts`, landing markup and CSS, three new test files plus narrow additions to two existing ones, a re-runnable render check, a README line and a UI-SPEC section.
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.claude/CLAUDE.md
@.planning/quick/261020-gzd-landing-page-with-feature-tabs-and-scrol/261020-gzd-BRIEF.md
@.planning/quick/261020-ftp-add-motion-and-visual-life-to-the-culpri/261020-ftp-SUMMARY.md

Baseline commit at planning time: `7033140` (HEAD on master). The untracked `.claude/launch.json` is not part of this work: never stage it. Do not read `04-UI-SPEC.md` (about 55 KB) before Task 3, and then use Grep to find the insertion point and Edit in place. All paths below are repository-root-relative; run every command from the checkout root.

<interfaces>
Facts gathered at planning time (verified against the code) so you do not need to re-derive them:

- `src/ui/dom.ts`: `el(tag, { className?, text?, attrs?, on? }, children?)`, `svgEl(tag, attrs, children?)`, `clear(node)`, `icon(name, className?)` (an `svg > use href="#icon-NAME"` from the sprite in index.html). Text-only construction; never build markup strings. `inert` can be set with `attrs: { inert: '' }` or the `inert` property.
- `src/main.ts` today: imports `./styles.css`, calls `mountApp(document)`. It is a rebuild-surface contract file.
- `src/ui/app.ts` `mountApp(doc)`: looks up `#case-picker`, `#status-region`, `#result`, `#result-title`, `#result-body`, `#skip-timeline`, `#suspect-drawer` with a throwing `required()`; `loadById(id)` loads a bundled case; `fixInput('log')` opens the own-files form and focuses the log field; `computeSparklines()` runs `handleAnalyzeRequest` for each bundled case on idle and is currently called at the end of `mountApp`; `mountCommandPalette(doc, { entries: paletteEntries(BUNDLED_CASES), onLoad: loadById, onOwnFiles: () => fixInput('log') })` is the last line. A done result calls `title.focus()`. `dismissSuspectDrawer(drawer)` (from drawer.ts) closes the drawer without restoring focus.
- `src/ui/palette.ts`: a document-level keydown opens the palette on `/` (outside editable targets) or Ctrl/Cmd+K, anywhere in the page; on close it focuses the opener (the focused element, else `#palette-trigger`). It looks up `#command-palette` and `#palette-trigger` by id.
- `src/ui/drawer.ts`: `restoreFocus` searches the whole document for `[data-suspect-rank="N"]` when its opener is gone, so preview copies of renderer output must not carry `data-suspect-rank`. `renderDrawerContent(view, handlers, close?)` returns a DocumentFragment (header with `h2#drawer-title`, then `div.drawer-body` with Summary, Why it ranks here (`li.signal-row` with `span.contribution-fill` whose width is `calc(var(--fraction) * 100%)`), Changed files and line ranges (ends with the `DIFF_NOTE` text "Culprit's history export lists changed line ranges, not diff text. ..."), Evidence, Caveat). `DrawerHandlers` = `{ onStep(rank), onShowLogLines(signature) }`.
- `src/ui/drawer-model.ts`: `buildDrawerView(stream, rank): DrawerView | null`, `DIFF_NOTE`.
- `src/ui/shortlist.ts`: `renderShortlist(view, { onInspect })` returns `section.lineup[aria-labelledby=lineup-title]` with `h2#lineup-title` "Suspect lineup" and `ol.lineup-list > li.lineup-card[data-rank]` (the leading card has `.is-leading` and an `svg.rank-diamond.is-leading`); Inspect buttons carry `data-suspect-rank`.
- `src/ui/timeline.ts`: `renderTimeline(stream, initialInvestigation(stream), { onEvent, onInspect })` returns a `TimelineView { element, update, focusById, dispose }`; `element` is `section.panel.timeline` with `h2#timeline-title`, a `pattern#timeline-hatch` in its SVG, `div.timeline-slider[role=slider][data-focus-id]`, `button.marker-hit[data-suspect-rank]`, a `details.table-twin`, and `path.series-line.series-draw` (pathLength 1), `rect.onset-band`, `line.onset-bracket`, marker polygons and `polygon.marker-pulse`. It sizes itself from a ResizeObserver on its chart host (it ignores width 0, so a hidden copy redraws when shown) and reads `window.innerWidth` for tick count. Adding the class `motion-draw` to any ancestor plays the gated draw-in (`.motion-draw .timeline-svg ...` rules in styles.css).
- `src/ui/verdict.ts`: exports `renderScoreMeter(fraction)` (`span.score-meter > span.score-fill` with `--fraction`) and `renderConfidenceMeter(view.confidence)`.
- `src/ui/view-model.ts`: `buildVerdictView(stream)` gives `{ heading: 'Most likely suspect', confidence { band, filled, text: 'Ranking confidence: High', ariaLabel, hasLabels }, headline { mode, shortSha, subject }, score { value, text, fraction }, caveat (STANDING_CAVEAT 'Ranked suspicion from log timing and stack evidence. Verify the diff before acting.'), ... }`; `buildShortlistView(stream)` gives `{ heading, countText, rows: ShortlistRow[] }` with `rank, rankLabel, leading, diamond, shortSha, subject, byline, gap, scoreText, scoreFraction, traceChip, matches`. Commits made after the onset window start are excluded from ranking (src/core/ranking.ts), so the checkout lineup may hold fewer than three rows: never assume three.
- `src/ui/copy.ts`: `buildPostmortemMarkdown(stream)` = `serializeMarkdown(toAnalysisResult(stream))`, newline-terminated.
- `src/ui/case-picker.ts`: `patternChip(onsetClass)` gives 'Sharp spike' / 'Slow ramp' / 'Ambiguous'. `src/ui/sparkline.ts`: `sparklinePath(counts, width, height)` ('' when nothing to draw). `src/ui/format.ts`: `formatUtcInterval(startIso, endIso)`, `formatUtcClock(iso)`, `formatInteger(n)` ('10,000', locale-free).
- `src/ui/cases.ts`: `BUNDLED_CASES` ids `checkout-outage`, `slow-burn`, `ambiguous` (names "Checkout outage", "Slow-burn inventory failure", "Ambiguous search regression"); `findCase(id)`, `toAnalysisInput(case)`; each case has `logsText`, `historyText`, `logsSource`, `historySource`. Checkout: 6 log lines (+05:30 offsets), 3 commits, onset window 04:30 to 04:35 UTC, class spike, hash `2222222`, score text `0.91` (raw 0.912065), matches `Matches 5 of 5 errors`.
- `src/worker/protocol.ts`: `handleAnalyzeRequest({ type: 'analyze', requestId: 0, input })` returns `{ type: 'result', stream }` or a failure response; app.ts already uses it on the main thread for sparklines.
- `src/core/scoring.ts`: `SCORING_V1.weights` = `{ proximity: 0.35, 'trace-match': 0.3, novelty: 0.25, churn: 0.1 }`, `SIGNAL_ORDER` = proximity, trace-match, novelty, churn. `src/core/log-parser.ts`: `DEFAULT_LOG_LIMITS.maxLogBytes` = 1_048_576, `.maxEvents` = 10_000. Importing these read-only from src/ui is fine; editing src/core is not.
- `src/ui/motion.ts`: `MotionScope { dispose() }`, `prefersMotion()`, `resultSections`, `playEntrance(sections)` (adds `motion-enter` plus `--index`, starts `[data-roll]` decode/count rolls on aria-hidden overlays, holds `motion-draw` on sections containing `.series-draw`, defers below-the-fold sections through an IntersectionObserver, returns a no-op scope under reduced motion). It is the only file allowed to use the animation-frame functions.
- `src/styles.css`: `:root` is the first block (parsed by contrast.test.ts); `[hidden] { display: none !important; }` exists; type tokens `--text-display: 48px`, `--text-heading: 24px`, `--text-body: 16px`, `--text-label: 14px`, `--leading-display: 1.1`; `.skip-link` (shown on focus); `.site-header` (relative, isolate, overflow hidden) with `.header-stripes` (three skewed spans, stripe tokens and opacity tokens) and `.brand`, `.wordmark`, `.purpose`, `.header-chips`; `.button-primary`/`.button-secondary` (min-height 36px, 44px `::after` hit band, the first `.button-primary {` block must stay the original because contrast.test.ts reads it); `.key-hint` and `kbd` keycaps; `.score-fill` is `transform: scaleX(var(--fraction))`. The single consolidated gated block (near line 2340) holds keyframes `motion-rise` (opacity plus 12px translateY), `motion-fill` (scaleX from 0), `motion-fade`, `motion-draw-line`, `motion-wipe`, `motion-pop`, `motion-pulse`, `motion-stripe-in`, `motion-drift` and others; add new landing motion inside that block or a second block with the identical media prelude.
- `tests/ui/contrast.test.ts` design rules: no `gradient(`, no `backdrop-filter`, only inset box-shadow, font weights 400/500 only, no hex literal after `:root`, no remote URL or `@import`. `motionViolations(css)`: after stripping comments, ungated CSS must not contain the words transition, animation, will-change or `@keyframes` anywhere (that includes class names and custom-property names such as `.no-animation`); gated keyframes may set only transform, opacity, stroke-dashoffset; transitions only on those three; no forwards/both fill; infinite only on `culprit-spin` and `motion-drift`.
- `tests/ui/static-safety.test.ts` scans the raw text of every `src/**/*.ts` and `index.html`, comments included: no HTML-string sink, no network API, no browser storage API, no absolute URL (except the SVG namespace in dom.ts; so no `xmlns` and no `http` text in index.html), and in src/ui and src/worker none of the clock, randomness or locale APIs. Never write any of those API names anywhere in src/ or index.html, not even in comments or landing copy; describe them generically ("network or storage API").
- `tests/core/rebuild-surface.test.ts` scans README.md, src/main.ts and src/styles.css (among others): no text matching whitespace or line-start followed by `/app`, `/var`, `/tmp`, `/home`, `/Users`, `/workspace`, and no absolute URL other than localhost. So always write the route as `#/app` (never "at /app"), and keep spaces on both sides of `/` inside `calc()`.
- `tests/ui/intake.test.ts` requires README to keep the heading text "Using the console" and "FONTS.md".
- `tsconfig.json`: strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`; tests are type-checked by `npm run typecheck`.
- Render check to copy: `.planning/quick/261020-ftp-add-motion-and-visual-life-to-the-culpri/261020-ftp-render-check.mjs` (vite preview on 127.0.0.1:4173 with `--strictPort`, Chrome or Edge over CDP on 9223, throwaway profile under `--out`, helpers `report`, `poll`, `sleep`, `evaluate`, `press`, `pressText`, `screenshot`, probes `PAGE_METRICS`, `HIT_PROBE`, `FOCUS_PROBE`, `SAMPLER_INSTALL`/`SAMPLER_READ`/`SAMPLER_RESET`, `RUNNING_NOW`, `SETTLED_NOW`, `REAL_TEXT`, `DECOR_PROBE`, `TIMELINE_PROBE`, `runPaletteChecks`; prints `RESULT PASS` and exits 0, else exits 1; stops preview and browser in `finally`). Today every console check navigates to `${ORIGIN}/`.
</interfaces>

## DOM and module contract (shared by all three tasks)

| Hook | Where | Owner |
|------|-------|-------|
| `p#route-status.visually-hidden[role=status][aria-live=polite][aria-atomic=true]` | body, before the views | router (text only on navigation) |
| `div#view-landing.view` (visible in static markup) and `div#view-app.view[hidden]` | body; `#view-app` wraps the two existing console skip links and the existing `main#app` unchanged | router toggles `hidden` |
| `a.skip-link[href="#landing-title"]` "Skip to content" | first child of `#view-landing` | static |
| `header.site-header.landing-header` with `.header-stripes` (same three spans), `.brand` and `nav.site-nav[aria-label=Site]` holding `a[data-route=landing][href="#/"]` "Home" and `a[data-route=app][href="#/app"]` "Console" | `#view-landing`; the same `nav.site-nav` is appended inside the existing console `.site-header` | router sets `aria-current="page"` |
| `main#landing.landing` with `section.hero`, `section#features`, `section#demo.demo`, `section#trust`, `section#start.landing-cta`, `footer.landing-footer` | `#view-landing` | static, enhanced by landing.ts |
| `h1#landing-title[tabindex=-1]`; `h2#input-title` gains `tabindex="-1"` | headings that receive focus on navigation | router |
| `a.button-primary[href="#/app"][data-try-case=checkout-outage]` "Try the checkout outage" and `a.button-secondary[href="#/app"]` "Open the console" | hero and final CTA | landing.ts |
| `div.preview-slot[data-preview=KEY]` | hero (`hero`), each feature panel (tab id), each demo step (`demo-` plus step id) | landing-preview builders |
| `div.preview-frame[role=region][aria-label]` > `p.preview-caption` + `p.visually-hidden` summary + `div.preview-body[inert]` | built into slots | `previewFrame()` |
| Tabs: `div.feature-tablist[data-tablist][hidden]` > `button.feature-tab#feature-tab-ID[data-tab=ID]`; panels `section.feature-panel#feature-panel-ID[data-panel=ID][aria-labelledby=feature-heading-ID]` > `h3#feature-heading-ID`, `p`, preview slot | `#features` | landing-tabs.ts adds roles and state |
| Demo: `section#demo.demo` > `h2#demo-title`, intro `p`, `div.demo-progress[aria-hidden=true] > span.demo-progress-fill`, `div.demo-stage[hidden]`, `div.demo-track` > five `article.demo-step[data-demo-step=ID][aria-labelledby=demo-heading-ID]` > `p.demo-step-count` "Step N of 5", `h3#demo-heading-ID`, `p`, preview slot | `#demo` | landing-demo.ts (`.is-scrolly`, `.is-active`, `--demo-progress`) |

Feature tab ids, in order: `onset`, `suspects`, `timeline`, `drawer`, `postmortem`, `offline`. Demo step ids, in order: `inputs`, `onset`, `suspects`, `evidence`, `postmortem`.

## Artifacts this plan produces

| File | Created / changed | Symbols and rules |
|------|-------------------|-------------------|
| `src/ui/router.ts` | created (T1) | `Route`, `HashTarget`, `parseHash`, `routeHash`, `ROUTE_TITLES`, `ROUTE_ANNOUNCEMENTS`, `ROUTE_HEADING_IDS`, `ROUTE_VIEW_IDS`, `Router`, `mountRouter` |
| `src/ui/landing-model.ts` | created (T1), extended (T2, T3) | `prefixIdRefs`; T2 `FEATURE_TABS`, `FeatureTabId`, `tabKeyTarget`, `weightsText`, `limitsText`, `markdownExcerpt`; T3 `DEMO_STEPS`, `DemoStepId`, `scrollProgress`, `stepAt`, `demoMode` |
| `src/ui/landing-preview.ts` | created (T1), extended (T2, T3) | `bundledStream`, `previewFrame`, `prepareRendered`, `renderHeroCard`; T2 `renderFeaturePreview`; T3 `renderDemoPreview` |
| `src/ui/landing.ts` | created (T1), extended (T2, T3) | `LandingView { show, hide }`, `mountLanding(doc, { onTryCase })` |
| `src/ui/landing-tabs.ts` | created (T2) | `mountFeatureTabs(root)` |
| `src/ui/landing-demo.ts` | created (T3) | `DemoController { start, stop }`, `mountDemo(section, build)` |
| `src/ui/app.ts` | changed (T1) | `ConsoleApi { loadCase, activate, deactivate }`, `mountApp(doc, { onOpenConsole? })` |
| `src/ui/motion.ts` | changed (T3) | `watchScroll(target, onFrame): MotionScope` |
| `src/main.ts` | changed (T1) | mount order app, landing, router |
| `index.html` | changed (T1, T2, T3) | views, nav, landing content, `#route-status`, title |
| `src/styles.css` | changed (T1, T2, T3) | `--text-hero: 64px`, views, nav, hero, tabs, previews, demo, trust, CTA, gated landing motion |
| `tests/ui/router.test.ts` | created (T1) | route tests |
| `tests/ui/landing-model.test.ts` | created (T1), extended (T2, T3) | model tests |
| `tests/ui/landing-copy.test.ts` | created (T2), extended (T3) | index.html copy guard |
| `tests/ui/contrast.test.ts` | changed (T2) | one new landing-pairs test; nothing relaxed |
| `tests/ui/static-safety.test.ts` | changed (T3) | passive scroll listener rule; rAF allow-list unchanged |
| `README.md` | changed (T1) | one sentence in "Using the console" |
| `261020-gzd-render-check.mjs` | created (T1), extended (T2, T3) | landing, routing, tabs, demo, sweep, inherited console checks |
| `04-UI-SPEC.md` | changed (T3) | new "Landing View" section only |

## Locked copy (use verbatim unless the code proves a statement false; then fix the wording and record it as a deviation)

- Title (landing): `Culprit: find the commit that broke it`. Title (console, unchanged string): `Culprit — Incident analysis`.
- Hero h1: `Which commit broke production?` Supporting sentence: `Paste an error log and your git history and get a ranked, explainable shortlist of the commits to check first, entirely in your browser.` Hint: `Press <kbd>/</kbd> to jump to a case.` (the palette works from both views, so the hint is true on the landing too; the brief's "once inside" wording is satisfied).
- Tabs (label / panel heading / text):
  - Onset detection / Find when the errors started / Culprit buckets error events on a UTC timeline and finds the interval where the rate breaks from its baseline. It labels the shape as a sharp spike, a slow ramp or ambiguous, and says so when it cannot tell. Timestamps with offsets are normalized to UTC first.
  - Ranked suspects / Rank the commits worth checking first / Every commit made before the onset window gets a fixed-weight score from four signals: proximity 0.35, trace match 0.30, novelty 0.25, churn 0.10. The weights are frozen in the code, so the same input always gives the same order. A score is ranked suspicion, not proof.
  - Linked timeline / See errors and commits on one UTC axis / The error rate, the onset window and the commits share one time axis, with the top suspects marked. Filter by error signature, step through intervals with the arrow keys, or read the same values in the data table, so nothing depends on hover.
  - Evidence drawer / Check the arithmetic behind every rank / The drawer shows each signal's value, weight and contribution, the changed files and line ranges, and where they overlap stack frames in the log. The history export lists line ranges, not diff text, so open the commit in your repository to read the diff.
  - Markdown postmortem / Copy a postmortem you can paste anywhere / One button copies a Markdown summary of the verdict, evidence, confidence and caveats. The same deterministic serializer produces it every time; if the clipboard is unavailable, the text appears selected so you can copy it by hand.
  - Private and offline / Nothing leaves your browser / Logs and history are read and analyzed on this page; nothing is uploaded and no account is needed. Culprit makes no network requests, so it keeps working without a connection once the page is open, and the same input always produces the same bytes.
- Offline panel facts (static list in that panel, alongside its preview): `No network code: tests/ui/static-safety.test.ts fails npm test if the source uses a network or storage API or contains an absolute URL.` / `Byte-identical output: tests/core/determinism.test.ts runs the same analysis repeatedly and compares the bytes.` / `Local analysis: the previews on this page were computed in your browser from the bundled fixtures.` Verify each against the named file before committing.
- Demo (section h2 `See it work`, intro `The checkout outage case, step by step, rendered by the same code as the console.`):
  - inputs / Paste a log and the git history / Culprit reads JSON-lines or plain-text logs and a Culprit JSON history export. Nothing is uploaded; the text stays in this page.
  - onset / Find the onset / Errors are counted per interval on a UTC axis, and the onset window marks where the rate breaks from its baseline. Here it is a sharp spike.
  - suspects / Rank the suspects / Every commit made before the onset window is scored on proximity, trace match, novelty and churn. The leading suspect carries the diamond; the score is ranked suspicion, not proof.
  - evidence / Read the evidence / The drawer breaks the score into its four contributions and lists the changed line ranges that overlap the failing stack frames.
  - postmortem / Hand off a postmortem / Copy the result as Markdown with the verdict, evidence, confidence and caveats, ready for the incident channel.
- Trust strip (h2 `How it works`): `Inputs: a Culprit JSON history export plus JSON-lines or plain-text logs, up to 1 MiB and 10,000 events.` / `Deterministic UTC output: the same input gives byte-identical results, with every time shown in UTC.` / `Ranked suspicion, not proof: Culprit tells you where to look first; a person still confirms the cause.`
- Final CTA (h2 `Start with a bundled incident`): `Three bundled cases show a sharp spike, a slow ramp and an ambiguous result, or bring your own log and history.` plus the same two links and the `/` hint. Footer: `Local only: nothing leaves this browser. All times UTC.`
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1 (tracer): hash router, landing view shell, hero with a live result card and header nav, end to end from #/ to the loaded checkout case</name>
  <files>index.html, src/main.ts, src/ui/router.ts, src/ui/landing.ts, src/ui/landing-preview.ts, src/ui/landing-model.ts, src/ui/app.ts, src/styles.css, tests/ui/router.test.ts, tests/ui/landing-model.test.ts, README.md, .planning/quick/261020-gzd-landing-page-with-feature-tabs-and-scrol/261020-gzd-render-check.mjs</files>
  <read_first>index.html, src/main.ts, src/ui/app.ts, src/ui/dom.ts, src/ui/motion.ts, src/ui/verdict.ts (exports only), src/ui/view-model.ts lines 40-200, src/ui/case-picker.ts, src/ui/palette.ts, tests/ui/static-safety.test.ts, tests/core/rebuild-surface.test.ts lines 84-96, src/styles.css lines 1-385 and 2334-2530 (Grep for anything else), README.md lines 100-115, the ftp render check</read_first>
  <precondition>A Chromium-based browser is discoverable by the copied findChrome() (the ftp render check passed on this machine), `npm ci` dependencies are installed, and ports 4173 and 9223 are free (a dev server on 5173 may be running: leave it alone).</precondition>
  <behavior>
    - parseHash('') , parseHash('#') and parseHash('#/') give { kind: 'route', route: 'landing' }; parseHash('#/app') and parseHash('#/app/') give { kind: 'route', route: 'app' }; any other value starting with '#/' (for example '#/APP', '#/settings', '#/app/extra') gives route 'landing'.
    - parseHash('#result') gives { kind: 'fragment', id: 'result' }; parseHash('#timeline-title') gives the fragment 'timeline-title'; a percent-encoded fragment is decoded; a malformed one such as '#%E0%A4%A' does not throw and returns the raw text after '#'.
    - routeHash('landing') is '#/' and routeHash('app') is '#/app'; parseHash(routeHash(r)) round-trips for both routes.
    - ROUTE_TITLES.landing is 'Culprit: find the commit that broke it' and ROUTE_TITLES.app is exactly 'Culprit — Incident analysis' (the original static title, em dash included); ROUTE_HEADING_IDS are { landing: 'landing-title', app: 'input-title' }; ROUTE_VIEW_IDS are { landing: 'view-landing', app: 'view-app' }; ROUTE_ANNOUNCEMENTS are short non-empty strings that differ per route.
    - prefixIdRefs('a b', 'p') is 'p-a p-b'; surrounding and repeated whitespace collapses to single spaces; '' and whitespace-only give ''.
  </behavior>
  <action>
1. RED (D-04). Create tests/ui/router.test.ts and tests/ui/landing-model.test.ts covering the behaviour block; import from `../../src/ui/router` and `../../src/ui/landing-model`. Both modules must be importable without a DOM (no top-level document or window access). Run them and confirm they fail.

2. `src/ui/router.ts` (D-01, D-03). Export `type Route = 'landing' | 'app'`, `type HashTarget`, `parseHash(hash)`, `routeHash(route)`, the four const maps from the behaviour block and `interface Router { current(): Route; navigate(route: Route): void }`. `mountRouter(doc, { onEnter(route, cause: 'initial' | 'navigate') })`:
   - Resolves a target: a route target maps directly; a fragment target maps to the view whose element contains `doc.getElementById(id)` (use getElementById only, never a selector string built from the hash), and to the current route when no element matches (at start-up: 'landing'). The hash text is never inserted into the DOM or the title.
   - `apply(route, cause)`: when the route equals the current one and cause is 'navigate', do nothing. Otherwise toggle `hidden` on `#view-landing` and `#view-app`, set `document.title` from ROUTE_TITLES, set `aria-current="page"` on every `a[data-route]` whose data-route equals the route and remove it from the others, call `onEnter(route, cause)`, and for cause 'navigate' only: scroll the window to the top, focus the heading from ROUTE_HEADING_IDS with `preventScroll: true`, and set `#route-status` text to the announcement (initial load moves no focus and announces nothing).
   - `navigate(route)` applies synchronously (so callers can focus inside the new view straight away) and then sets `location.hash` to routeHash(route) when it differs; the resulting hashchange then sees an unchanged route and does nothing.
   - A `hashchange` listener resolves `location.hash` and applies with cause 'navigate'. Apply the initial route once inside mountRouter with cause 'initial'.

3. `src/ui/app.ts` (D-02, D-05; keep the diff small). Change the signature to `mountApp(doc, options: { onOpenConsole?: () => void } = {}): ConsoleApi` with `ConsoleApi { loadCase(id: string): void; activate(): void; deactivate(): void }`. Remove the unconditional `computeSparklines()` call at the end; `activate()` runs it once (guard flag) the first time the console is shown. `deactivate()` calls `dismissSuspectDrawer(drawer)` so a modal drawer never stays open over the landing. `loadCase` is `loadById`. The palette's `onLoad` becomes: call `options.onOpenConsole?.()`, then `loadById(id)`; `onOwnFiles` becomes: call `options.onOpenConsole?.()`, then `fixInput('log')`. Nothing else in the console changes.

4. `src/ui/landing-model.ts`: export `prefixIdRefs(value, prefix)` (split on whitespace, drop empties, prefix each token with `PREFIX-`, join with one space). Keep the file DOM-free; later tasks extend it.

5. `src/ui/landing-preview.ts` (D-07, D-14):
   - `bundledStream(id: BundledCaseId): AnalysisStream | null`: memoized per id; calls `handleAnalyzeRequest({ type: 'analyze', requestId: 0, input: toAnalysisInput(case) })` inside try/catch; any failure returns null.
   - `previewFrame({ label, caption, summary, body, inertBody })`: builds the `div.preview-frame[role=region][aria-label=label]` with `p.preview-caption` (caption text), `p.visually-hidden` (summary text built from real values) and `div.preview-body` holding `body`, marked inert when `inertBody` is true.
   - `prepareRendered(root, prefix)`: walks root and every descendant element; rewrites each `id` to `PREFIX-id`; rewrites `aria-labelledby`, `aria-describedby`, `aria-controls`, `aria-activedescendant` and `for` with prefixIdRefs; removes `data-suspect-rank`, `data-focus-id` and `data-roll`; leaves `href` alone (sprite icons use `use href="#icon-..."`). Every renderer copy placed on the landing must pass through it (T-261020gzd-04).
   - `renderHeroCard(stream)`: from buildVerdictView and buildShortlistView (return null when either is null): a `div.preview-frame.hero-card[role=region]` labelled `Live preview: Checkout outage result`, not inert (it has no controls), containing the caption `Live preview · Checkout outage, analyzed in this browser`; `p.hero-card-label` (view.heading); `p.hero-hash` (shortSha, `data-roll="decode"`); `p.hero-subject`; a `div.score-line` with renderScoreMeter(fraction), `span.score-value` (score text, `data-roll="count"`) and the caption 'rounded for display'; renderConfidenceMeter(view.confidence); an aria-hidden sparkline svg built with sparklinePath over `stream.timeline` error counts (same structure and classes as case-picker's, `vector-effect` non-scaling) beside a chip from patternChip(stream.onset.class) and the onset window from formatUtcInterval when both window ends are non-null; a short `ol` of the remaining lineup rows (rankLabel, shortSha, scoreText; however many exist); and `p.hero-caveat` with view.caveat. Text only through el()/svgEl().

6. `src/ui/landing.ts`: `mountLanding(doc, { onTryCase(id) }): LandingView { show(); hide() }`. At mount: wire every `a[data-try-case]`: on a plain primary click (no modifier keys, button 0) call `preventDefault()` then `onTryCase(id)`; modified clicks keep the native link behaviour. `show()`: on the first call build the hero card into `[data-preview=hero]` from bundledStream('checkout-outage') (on null leave the slot with a one-line `p` "Preview unavailable."; the landing text is unaffected) and keep `playEntrance([card])` as the current MotionScope (the existing helper gives the rise, the meter fill and the hash and score rolls, and is a no-op under reduced motion; per D-13 no new frame code here). `hide()` disposes that scope.

7. `src/main.ts`: keep the stylesheet import; `const consoleApi = mountApp(document, { onOpenConsole: () => router?.navigate('app') })`; `const landing = mountLanding(document, { onTryCase: (id) => { router?.navigate('app'); consoleApi.loadCase(id); } })`; then `router = mountRouter(document, { onEnter })` where onEnter for 'app' calls `landing.hide()` and `consoleApi.activate()`, and for 'landing' calls `consoleApi.deactivate()` and `landing.show()`. Declare `let router: Router | null = null` before. Write routes only as `'#/app'`-style strings (rebuild-surface scans this file).

8. `index.html` (D-01, D-03, D-07, D-16): static `<title>` becomes the landing title. Add `p#route-status` before the views. Wrap the two existing console skip links and the existing `main#app` (unchanged inside, apart from the nav and the heading tabindex) in `div#view-app.view[hidden]`. Add `tabindex="-1"` to `h2#input-title` and append the `nav.site-nav` (Home and Console links) inside the existing console `.site-header` after `.header-chips`. Before `#view-app`, add `div#view-landing.view` with the skip link, the landing header (`.header-stripes` with three spans, `.brand` with the diamond icon and the `p.wordmark`, the nav), and `main#landing.landing` containing `section.hero[aria-labelledby=landing-title]`: the h1, `p.hero-lede`, `div.hero-actions` with the two links, `p.key-hint` with the kbd, and `div.hero-preview` holding a second `div.header-stripes.is-hero[aria-hidden=true]` (three spans; same tokens, no new colour or opacity) and the `[data-preview=hero]` slot. Inline svg uses only `use href="#icon-..."` with no namespace attribute. No other landing section yet.

9. `src/styles.css` (D-12, D-13, D-16): add `--text-hero: 64px` to `:root` (the one new size, landing h1 at 1024px and wider only). h1 sizes: below 640px `--text-heading`, 640 to 1023px `--text-display`, 1024px and wider `--text-hero`, all at `--leading-display` and weight 500, so "Which commit broke production?" stays within 2 lines at every width (the headline spans the full content width; the copy and card sit in a row below it: one column below 1024px, about 7fr/5fr at 1024px and wider). `.landing` shares `.shell` max-width and padding. Nav links: inline-flex, min-height `--hit-min`, muted text; `[aria-current="page"]` gets ink text plus an underline (not colour alone). `a.button-primary` and `a.button-secondary` (placed after the existing button blocks) become inline-flex, centred, no text decoration. `.header-stripes.is-hero` sits behind the card inside a relative, overflow-hidden `.hero-preview`, and the card itself has an opaque surface, so no text sits over a stripe except on `--color-page` (the pinned figures). Hero card: surface ladder, 1px hairline, radius 10px, mono 24px hash. Extend the existing gated `.header-stripes span` entrance selectors only if needed; any hero sparkline wipe reuses `motion-wipe` inside the gated block. Tokens only, no hex after `:root`, no gradient, shadow, glass, `transition` or `animation` word outside the gated block, no `/app` after whitespace, spaces around `/` in calc().

10. README.md (D-15): in "Using the console", change the first sentence so it says the page opens on a short landing page at `#/`, and that "Open the console" (or the `#/app` address) opens the console, where you choose one of the three bundled incidents. Keep the heading text and every string rebuild-surface.test.ts and intake.test.ts assert.

11. Render check (D-18). Copy the ftp script to `.planning/quick/261020-gzd-landing-page-with-feature-tabs-and-scrol/261020-gzd-render-check.mjs`; default `--out` becomes `tmpdir()/culprit-261020-gzd`; header comment names this task. Every inherited console check navigates to `${ORIGIN}/#/app` instead of `${ORIGIN}/` and every console selector is scoped with `#app ` (verdict, score fill, case cards, sparklines, header stripes, `section.timeline`, `.timeline-svg`, `.timeline-slider`, lineup), because Task 2 puts copies of those classes on the landing; ids and body-level dialogs stay as they are. Add `runLandingChecks(tag, fileTag, width, reduce)` for all four mode and size runs:
   - At `${ORIGIN}/`: `#view-landing` visible and `#view-app` hidden; title is the landing title; h1 text exact and its line count (height divided by computed line-height, rounded) at most 2; hero card real text (aria-hidden excluded, REAL_TEXT style) hash `2222222` and score `0.91` at first detection; reduce: sampler max 0 and no `.roll-ghost` after 700 ms; motion: sampler names include `motion-rise` and the page settles within 5 s with exact text; `#app .case-card .sparkline-line` count is 0 after 1 s on the landing (console analysis not run, D-02); the Home link has `aria-current="page"`; scrollWidth not above innerWidth; at 1280 the first Tab focuses the landing skip link with the 2px rgb(87, 193, 255) ring.
   - A trusted click (Input.dispatchMouseEvent at the element centre) on the hero "Try the checkout outage": hash `#/app`, `#view-app` visible, `#view-landing` hidden, console title, `#result-title` 'Result: Checkout outage', `#app .verdict .verdict-hash` real text `2222222`, Console link `aria-current`.
   - Open the drawer from Inspect evidence, then `history.back()`: landing visible, drawer closed, focus on `#landing-title`, landing title, `#route-status` text non-empty; `history.forward()`: console visible with focus on `#input-title`.
   - From a fresh `${ORIGIN}/`, press `/` with focus on the body, Enter on the first option: the console view shows and 'Result: Checkout outage' loads.
   - A fresh `${ORIGIN}/#/app` load shows the console directly with the console title and a case-card sparkline within 5 s.
   Save `hero-${fileTag}.png` (viewport) for each run. Keep every inherited check.
  </action>
  <verify>
    <automated>npm test -- tests/ui/router.test.ts tests/ui/landing-model.test.ts tests/ui/static-safety.test.ts tests/core/rebuild-surface.test.ts tests/ui/intake.test.ts</automated>
    <fails_when>any listed test fails, or vitest reports no tests collected for router.test.ts or landing-model.test.ts</fails_when>
    <automated>npm run typecheck && npm test && npm run build && node .planning/quick/261020-gzd-landing-page-with-feature-tabs-and-scrol/261020-gzd-render-check.mjs</automated>
    <fails_when>tsc reports an error, any test fails, the build fails, or the render check prints a FAIL line, exits non-zero or does not end with RESULT PASS</fails_when>
    <automated>test -z "$(git diff --name-only 7033140 -- src/core package.json package-lock.json)"</automated>
    <fails_when>the command exits non-zero because a file under src/core or a package manifest changed</fails_when>
  </verify>
  <done>An empty hash shows the landing hero with a live card reading 2222222 / 0.91; the hero primary opens the console and loads the checkout case; Home/Console links, back/forward and the #/app deep link switch views with focus on the view heading, the right title and aria-current; leaving the console closes the drawer; `/` works from the landing; console sparklines only compute once the console is shown; every inherited console render check passes at #/app; typecheck, test and build are green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: six ARIA feature tabs with real previews, trust strip, final CTA and footer</name>
  <files>index.html, src/ui/landing-tabs.ts, src/ui/landing-model.ts, src/ui/landing-preview.ts, src/ui/landing.ts, src/styles.css, tests/ui/landing-model.test.ts, tests/ui/landing-copy.test.ts, tests/ui/contrast.test.ts, .planning/quick/261020-gzd-landing-page-with-feature-tabs-and-scrol/261020-gzd-render-check.mjs</files>
  <read_first>src/ui/landing.ts, src/ui/landing-preview.ts, src/ui/landing-model.ts (all from Task 1), src/ui/shortlist.ts, src/ui/timeline.ts lines 23-50 and 130-250, src/ui/drawer.ts lines 160-180, src/ui/drawer-model.ts lines 1-30 and 141-189, src/ui/copy.ts lines 1-30, src/core/scoring.ts lines 16-57, src/core/log-parser.ts lines 10-20, tests/core/determinism.test.ts lines 55-100, tests/ui/contrast.test.ts lines 1-120</read_first>
  <behavior>
    - FEATURE_TABS ids are exactly onset, suspects, timeline, drawer, postmortem, offline in that order, with labels 'Onset detection', 'Ranked suspects', 'Linked timeline', 'Evidence drawer', 'Markdown postmortem', 'Private and offline'.
    - tabKeyTarget(current, key, count): with count 6, ArrowRight from 5 gives 0 and from 2 gives 3; ArrowLeft from 0 gives 5; Home gives 0; End gives 5; any other key ('Enter', ' ', 'ArrowUp', 'Tab') gives null; count 0 gives null; a current outside 0..count-1 is clamped before moving.
    - weightsText(SCORING_V1.weights) is exactly 'proximity 0.35, trace match 0.30, novelty 0.25, churn 0.10' (SIGNAL_ORDER, two decimals); changing a weight in a test copy changes the text.
    - limitsText(DEFAULT_LOG_LIMITS) is exactly 'up to 1 MiB and 10,000 events' (bytes divided by 1048576 shown as an integer when exact, else one decimal; events through formatInteger).
    - markdownExcerpt(text, 14) returns the first 14 lines without the trailing newline; text with fewer lines returns all of them; '' returns []; '\r\n' line ends are handled.
    - landing-copy test over index.html: it contains weightsText(SCORING_V1.weights) and limitsText(DEFAULT_LOG_LIMITS) verbatim; for every FEATURE_TABS id it contains id="feature-tab-ID" and id="feature-panel-ID"; case-insensitively it contains none of elevate, seamless, unleash, next-gen, game-changer, delve, AI-powered, revolutionary, trusted by, testimonial, newsletter, pricing, sign up, subscribe; it contains no Extended_Pictographic character; it contains 'ranked suspicion, not proof' (case-insensitive).
    - contrast: a new test pins the landing pairs: color-ink-2 over color-grid at 3:1 or better (progress and weight bars, non-text) and color-muted, color-ink-2 and color-ink over color-page and color-surface at 4.5:1 or better (tab labels, captions, step text); no existing assertion changes.
  </behavior>
  <action>
1. RED (D-04, D-06). Extend tests/ui/landing-model.test.ts and create tests/ui/landing-copy.test.ts (read index.html with readFileSync like static-safety does; import SCORING_V1 from src/core/scoring and DEFAULT_LOG_LIMITS from src/core/log-parser read-only). Add the landing-pairs test to tests/ui/contrast.test.ts reusing its `value`, `ratio` and `round2` helpers. Run and confirm the new cases fail.

2. `src/ui/landing-model.ts`: add FEATURE_TABS (readonly array of `{ id, label }` as const), `type FeatureTabId`, `tabKeyTarget`, `weightsText(weights)` (labels proximity, trace match, novelty, churn in SIGNAL_ORDER; `toFixed(2)`), `limitsText(limits)` and `markdownExcerpt(text, maxLines)`, all DOM-free and free of the banned clock, randomness and locale APIs.

3. `index.html` (D-08, D-10, D-11): after the hero add `section#features.landing-section[aria-labelledby=features-title]` with `h2#features-title` "What it does", the `div.feature-tablist[data-tablist][hidden]` with the six `button.feature-tab` (type button, ids and data-tab per the contract, labels from FEATURE_TABS) and the six `section.feature-panel` blocks with the locked headings, text, the offline facts list in the offline panel, and a `[data-preview=ID]` slot each. All panels are visible in static markup, so without JavaScript all six read as plain sections. Then `section#trust` (h2 "How it works", three facts as a list), `section#start.landing-cta` (h2, sentence, the two links with `data-try-case` on the primary, the `/` hint) and `footer.landing-footer` (the local-only and UTC note, each with its lock or clock icon). Add no placeholder for the demo: Task 3 inserts `section#demo` between `#features` and `#trust`. Use the locked copy; the weights and limits text must equal the model output exactly (the copy test enforces it).

4. `src/ui/landing-tabs.ts` (D-08, D-16): `mountFeatureTabs(root)`: find the tablist and panels by data attributes; set `role="tablist"` and `aria-label="Features"` on the list and unhide it; each tab gets `role="tab"`, `aria-controls` (its panel id), `aria-selected` and roving `tabindex` (0 on the selected tab, -1 elsewhere); each panel gets `role="tabpanel"`, `aria-labelledby` pointing at its tab id, `tabindex="0"`, and `hidden` unless selected (first tab selected). Click selects and focuses that tab. Keydown on a tab uses tabKeyTarget; when it returns an index, `preventDefault()`, select and focus that tab (automatic activation). Select only toggles attributes and `hidden`; the panel fade-rise is pure CSS (a gated animation on `.feature-panel[role="tabpanel"]` restarts each time the panel is unhidden). No timer, no focus theft on load.

5. `src/ui/landing-preview.ts` (D-08, D-14): add `renderFeaturePreview(id, prefix)` returning a preview frame (or null when data is missing) built with previewFrame and, for renderer output, prepareRendered with prefix `PREFIX-ID` (the landing passes `feature`):
   - onset: one row per bundled case from bundledStream: case name, an aria-hidden sparkline (sparklinePath over that stream's timeline error counts), the patternChip, and the onset window via formatUtcInterval or the stream's own `onset.explanation` when the window is null. Built with el()/svgEl() (not a console renderer, but only real stream values).
   - suspects: renderShortlist(buildShortlistView(checkout), { onInspect: no-op }) plus a small weights list (label, weight text, a bar whose fill is `transform: scaleX(weight)`), derived from SCORING_V1 and SIGNAL_ORDER.
   - timeline: renderTimeline(checkout, initialInvestigation(checkout), no-op handlers).element (keep the TimelineView so it is never rebuilt; the landing never disposes it while the page lives).
   - drawer: a div holding renderDrawerContent(buildDrawerView(checkout, 1), no-op handlers).
   - postmortem: `pre.preview-markdown` whose children are one `span.md-line` per line of markdownExcerpt(buildPostmortemMarkdown(checkout), 14), each followed by a newline text node, with `--line-index` set per span (Task 3 reuses this builder for the line reveal).
   - offline: a short facts block computed from the checkout stream (number of log events and commits read, onset class), labelled "Computed in this browser".
   Each frame: label 'Preview: <tab label>, rendered from the bundled Checkout outage case' (the onset frame names all three cases), caption 'Live preview · bundled fixtures', a visually-hidden one-sentence summary from real values, body inert for renderer previews. Wrap each builder in try/catch; a failure leaves "Preview unavailable." in that slot only.

6. `src/ui/landing.ts`: on the first show() (after the hero card), call mountFeatureTabs on `#features` and fill each `[data-preview=ID]` slot on idle (requestIdleCallback with a setTimeout 0 fallback, as app.ts does), then hand the timeline preview nothing else: its ResizeObserver redraws it when its panel is shown.

7. `src/styles.css` (D-12, D-13, D-16): tablist wraps (`flex-wrap`) so six tabs never scroll horizontally at 320px; each tab min-height `--hit-min`, radius 8px, muted text and transparent 1px border at rest; the selected tab gets ink text, the raised surface and a `--color-control-border` border (shape plus colour, never colour alone); `:focus-visible` uses the existing focus ring. Panels: heading Body 16px/500, text ink-2. Preview frames: surface or elevated background, 1px hairline, radius 10px, padding, `overflow: hidden`, a sensible max-height for tall renderer output (drawer, timeline), and nested console panels inside a frame drop their own border and padding; console component classes keep their styles. Trust strip as three cards or a list on the surface ladder; CTA and footer muted text. Inside the gated block: `.feature-panel[role="tabpanel"]` fade-rise (opacity plus translateY, backwards fill, at most 240 ms) and nothing else new. No new hue, no gradient, shadow or glass, tokens only; the only new size remains `--text-hero`.

8. Render check: add `runTabChecks(tag, fileTag, width, reduce)` to every run at `${ORIGIN}/`: the tablist is visible with 6 `[role=tab]`; exactly one `aria-selected="true"` (the first) and exactly one tab with tabindex 0; each tab's aria-controls names an existing `[role=tabpanel]` whose aria-labelledby is that tab's id; only the selected panel is visible. Click the third tab (trusted mouse event): it is selected and focused, its panel visible and its `svg.timeline-svg` width above 0. Then ArrowRight selects and focuses the fourth, End the sixth, Home the first, ArrowLeft wraps to the sixth (dispatch real key events). With each panel selected: its `.preview-frame` has role region and an aria-label and its `.preview-body` (when present) is inert; scrollWidth not above innerWidth. Document-wide: no duplicate `id` values, no `[data-suspect-rank]` inside `#view-landing`. Suspects panel: the leading `.lineup-hash` text is `2222222`. Postmortem panel: `.md-line` count is between 1 and 14 and the first line's text is exactly `# Culprit analysis` (the serializer's first line, src/core/serialization.ts). Motion runs: a tab switch samples a rise animation and settles; reduce runs: sampler max 0 across the switches. Trust strip text contains '1 MiB' and '10,000 events'. Save `tabs-${fileTag}.png` with the features section in view.
  </action>
  <verify>
    <automated>npm test -- tests/ui/landing-model.test.ts tests/ui/landing-copy.test.ts tests/ui/contrast.test.ts tests/ui/static-safety.test.ts</automated>
    <fails_when>any listed test fails or landing-copy.test.ts collects no tests</fails_when>
    <automated>npm run typecheck && npm test && npm run build && node .planning/quick/261020-gzd-landing-page-with-feature-tabs-and-scrol/261020-gzd-render-check.mjs</automated>
    <fails_when>tsc reports an error, any test fails, the build fails, or the render check prints a FAIL line, exits non-zero or does not end with RESULT PASS</fails_when>
  </verify>
  <done>Six feature tabs work by click and by ArrowLeft/ArrowRight/Home/End with correct roles, aria-selected, aria-controls, aria-labelledby and roving tabindex; each panel shows its heading, text and a real, inert preview from the shipped renderers with no duplicate ids; weights and limits in the page match the code; the trust strip, final CTA and footer are present; reduced motion runs nothing; all checks green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: scroll-driven "See it work" demo with reduced-motion and phone fallbacks, UI-SPEC Landing View section and the full render check</name>
  <files>index.html, src/ui/landing-demo.ts, src/ui/motion.ts, src/ui/landing-model.ts, src/ui/landing-preview.ts, src/ui/landing.ts, src/styles.css, tests/ui/landing-model.test.ts, tests/ui/landing-copy.test.ts, tests/ui/static-safety.test.ts, .planning/phases/04-incident-console-and-investigation-flow/04-UI-SPEC.md, .planning/quick/261020-gzd-landing-page-with-feature-tabs-and-scrol/261020-gzd-render-check.mjs</files>
  <read_first>src/ui/motion.ts, src/ui/landing.ts, src/ui/landing-preview.ts, src/ui/landing-model.ts, tests/ui/static-safety.test.ts, src/styles.css gated block (Grep "prefers-reduced-motion: no-preference"), the render check from Task 2; in 04-UI-SPEC.md only Grep for "## Interaction and State Contract" and "## Motion Contract"</read_first>
  <behavior>
    - DEMO_STEPS ids are exactly inputs, onset, suspects, evidence, postmortem in that order, each with a short title.
    - scrollProgress(top, height, viewport): (0, 4000, 800) gives 0; (-1600, 4000, 800) gives 0.5; (-3200, 4000, 800) gives 1; (500, 4000, 800) gives 0 and (-9000, 4000, 800) gives 1 (clamped); when height is not greater than viewport it gives 1 if top is 0 or less, else 0; any NaN or infinite input gives 0.
    - stepAt(progress, 5): 0 gives { index: 0, local: 0 }; 0.19 gives index 0; 0.2 gives index 1 with local 0; 0.5 gives index 2 with local 0.5; 0.999 gives index 4; 1 gives { index: 4, local: 1 }; negative or NaN progress gives { index: 0, local: 0 }; count 0 gives { index: 0, local: 0 }; local is always within 0..1.
    - demoMode({ motion, wide }): motion and wide give 'scrolly'; motion and not wide give 'reveal'; no motion gives 'static' whatever the width.
    - landing-copy: index.html contains data-demo-step="ID" and id="demo-heading-ID" for every DEMO_STEPS id, 'Step 1 of 5' through 'Step 5 of 5', and the heading 'See it work'.
    - static-safety: every `addEventListener('scroll'` (either quote style) appears only in src/ui/motion.ts and each such call passes an options object with `passive: true`; the animation-frame allow-list assertion stays exactly ['src/ui/motion.ts'] (not extended).
  </behavior>
  <action>
1. RED (D-04, D-09). Extend tests/ui/landing-model.test.ts and tests/ui/landing-copy.test.ts; add the scroll-listener test to tests/ui/static-safety.test.ts next to the animation-frame test (do not change that test). Run and confirm the new cases fail.

2. `src/ui/landing-model.ts`: add DEMO_STEPS, `type DemoStepId`, `scrollProgress`, `stepAt` (index = min(count - 1, floor(p * count)); local = p * count - index, clamped) and `demoMode`.

3. `src/ui/motion.ts` (D-09, D-13; the one file allowed to use animation-frame functions, so the static-safety allow-list is NOT extended; the narrow addition is the passive-scroll rule): export `watchScroll(target, onFrame: (rect: DOMRect, viewportHeight: number) => void): MotionScope`. When prefersMotion() is false return the no-op scope. Otherwise observe `target` with an IntersectionObserver (guarded by a typeof check; without it, listen all the time): while it intersects, add one window `scroll` listener with `{ passive: true }` and one `resize` listener; each event schedules at most one pending animation frame, which calls onFrame with the target's bounding rect and `window.innerHeight`; run one frame when observation starts intersecting. When it stops intersecting, remove both listeners and cancel the pending frame. `dispose()` disconnects the observer, removes listeners and cancels the frame; safe to call twice. Never call preventDefault, never set scroll position, no timers.

4. `index.html`: insert `section#demo.landing-section.demo[aria-labelledby=demo-title]` between `#features` and `#trust` following the contract table (progress bar, hidden stage, track with the five `article.demo-step` blocks, each with "Step N of 5", the locked heading and text, and a `[data-preview=demo-ID]` slot). Static markup is the stacked sequence, so it reads correctly without JavaScript and under reduced motion.

5. `src/ui/landing-preview.ts`: add `renderDemoPreview(stepId)` returning a frame (prefix `demo-ID`, label 'Preview: step N, <title>', caption 'Live preview · Checkout outage'):
   - inputs: two compact lists built with el(): the first three raw lines of the checkout `logsText` under the caption `logs.jsonl · N lines` (mono, wrapping, the frame clips height; never an ellipsis on a hash or path) and one row per `stream.commits` entry (shortSha of 7, formatUtcClock time plus ' UTC', subject) under `history.json · N commits`, each row with `--row-index`; N values computed from the real text and stream.
   - onset: a fresh renderTimeline copy (separate TimelineView from the tab copy).
   - suspects: a renderShortlist copy (cards get `--card-index`).
   - evidence: a renderDrawerContent copy (signal rows get `--signal-index`).
   - postmortem: the same Markdown builder as the tab preview.
   Every renderer copy passes through prepareRendered; every body is inert.

6. `src/ui/landing-demo.ts` (D-09, D-16): `mountDemo(section, build: (id: DemoStepId) => HTMLElement | null): DemoController { start(); stop() }`.
   - start(): build each step's frame once into its slot (lazy, first start only); compute the mode with demoMode({ motion: prefersMotion(), wide: matchMedia('(min-width: 640px)').matches }) and enter it; subscribe to `change` on both media queries (removed in stop) to re-enter the right mode.
   - scrolly: add `.is-scrolly` to the section, unhide `.demo-stage`, move every frame into the stage (with `data-demo-frame=ID`), then `watchScroll(track, onFrame)`: progress = scrollProgress(rect.top, rect.height, viewportHeight), set `--demo-progress` on the section, and when stepAt(progress, 5).index changes: move `.is-active` to that step article and that frame, set `aria-hidden="true"` on every inactive frame and remove it from the active one; on the onset frame toggle the `motion-draw` class with activation so the existing gated draw-in (line draw, band wipe, marker pop, one pulse) replays when the step becomes active.
   - reveal (narrow, motion allowed): frames stay in their steps; the controller keeps `playEntrance(frames)` as its scope, so each frame fades and rises once when it first enters the viewport (and the timeline copy draws in through playEntrance's existing draw-in hold).
   - static (reduced motion): frames stay in their steps; nothing is observed and no class is added.
   - Leaving a mode disposes its scope, removes `.is-scrolly`, `.is-active`, `aria-hidden` and `motion-draw`, hides the stage and moves frames back into their slots, so every mode switch ends in the correct stacked or pinned state. stop() leaves the current mode the same way (the landing is hidden, so the scroll listener must be gone).
   - Never call preventDefault on wheel, touch or key events, never use scroll snapping, never move focus.

7. `src/ui/landing.ts`: mount the demo once with `mountDemo(#demo, renderDemoPreview)`; show() calls demo.start() after the previews; hide() calls demo.stop().

8. `src/styles.css` (D-09, D-12, D-13): stacked base layout for `.demo-step` (text then its frame). Inside the gated block, nested under `@media (min-width: 640px)`: `.demo.is-scrolly` becomes two columns (track and stage); each step has `min-height` of about 80vh so the section is roughly 400 to 500vh; `.demo-stage` is `position: sticky` with a top offset that centres a stage of about `min(560px, 76vh)`; no ancestor of the stage may set overflow to hidden, auto or clip (that disables sticky). Frames in the stage are stacked absolutely; inactive frames have opacity 0 and a small translateY, the active one opacity 1 and none, with a transition on opacity and transform only. Active step text is ink with a 2px ink left rule; inactive step text is muted (an instant colour change, no colour transition); "Step N of 5" always shows. Per-step activation animations, all backwards fill, all transform or opacity: inputs rows rise staggered by `--row-index`; lineup cards rise staggered by `--card-index` and the leading `.rank-diamond.is-leading` pulses once (a new keyframe on transform scale only, played once); the evidence frame body slides in (translateX plus opacity) and each `.contribution-fill` fills with `motion-fill` from its left edge (transform-origin left; never animate width) staggered by `--signal-index`; `.md-line` (display inline-block) fade-rises staggered by `--line-index`. The progress fill uses `transform: scaleX(var(--demo-progress, 0))` with origin left, ink-2 over the grid track (pinned in Task 2). Outside scrolly mode (reduced motion, narrow, no JS) the stage stays hidden and every frame is visible in its step. Same token, word and calc rules as before.

9. 04-UI-SPEC.md (D-17): Grep for "## Interaction and State Contract" and Edit to insert a new `## Landing View` section (with a trailing `---`) right before it. Contents, short: routes (`#/` default and empty hash, `#/app` console, fragments resolve to the view that holds them, focus on `#landing-title` / `#input-title` on navigation, the two titles, `#route-status`, drawer closed on leaving, console sparklines computed on first console show); hero (copy, `--text-hero` 64px at 1024px and wider as the one landing-only size, 48px display at 640 to 1023px, 24px heading below 640px, headline at most 2 lines; the stripe band reused behind the card; console typography unchanged); feature tabs (six ids, WAI-ARIA tabs with roving tabindex and ArrowLeft/ArrowRight/Home/End automatic activation, static panels readable without JS, previews as inert labelled regions with prefixed ids); scroll demo (scrolly, reveal and static modes, progress mapping, watchScroll as an IntersectionObserver-gated passive listener with one pending frame, never trapping scroll); reduced-motion contract (no scroll-driven animation, stacked static previews, zero running animations, instant final values); the narrow static-safety addition (passive scroll listeners only in src/ui/motion.ts; animation-frame allow-list unchanged); the landing contrast pairs. Do not edit any other section.

10. Render check (D-18): add `runDemoChecks(tag, fileTag, width, reduce)` to every run at `${ORIGIN}/`, plus a width sweep:
   - 1280 motion: `.demo` has `is-scrolly` and the stage computes `position: sticky`. For k = 0..4, `window.scrollTo` the track top plus (k + 0.5) / 5 of (track height minus innerHeight), wait two frames: the active step id equals DEMO_STEPS[k], exactly one frame lacks aria-hidden and it is that step's frame, `--demo-progress` increases with k; the sampler sees the matching animations (onset: `motion-draw-line`; suspects: a card rise and the diamond pulse; evidence: `motion-fill`; postmortem: the line reveal), then RUNNING_NOW returns to 0 within 3 s. Through CDP `DOMDebugger.getEventListeners` on the window object: while the demo is in view exactly one `scroll` listener exists and it is passive; after scrolling to the page bottom (scrollY plus innerHeight reaches scrollHeight minus 2, so scroll is never trapped) and navigating to `#/app`, zero `scroll` listeners remain. Save `demo-mid-${fileTag}.png` at k = 2.
   - 360 motion: no `is-scrolly`; five `.demo-step` each containing its `.preview-frame`; scrolling each frame into view gives it `motion-enter` and the page settles.
   - Reduce runs (both sizes): no `is-scrolly`, stage hidden, five frames in their steps, no `motion-enter` inside `#view-landing`, sampler max 0 while scrolling from the top of the page to the bottom in viewport steps; save `mobile-360-reduce.png` (full page) and `mobile-360-motion.png` (viewport at the demo).
   - Sweep (reduce, landing at the top, then motion at 1280 and 1440): widths 320, 360, 640, 768, 1024, 1280, 1440 by 800 high: scrollWidth not above innerWidth and h1 line count at most 2 at every width.
   After the run, view every saved screenshot (hero, tabs, demo-mid, mobile) with the Read tool and record observations in the SUMMARY. Confirm nothing listens on 4173 or 9223 afterwards and that the 5173 dev server, if it was running, is untouched.
  </action>
  <verify>
    <automated>npm test -- tests/ui/landing-model.test.ts tests/ui/landing-copy.test.ts tests/ui/static-safety.test.ts tests/ui/contrast.test.ts</automated>
    <fails_when>any listed test fails, or the animation-frame allow-list assertion no longer equals exactly ['src/ui/motion.ts']</fails_when>
    <automated>npm run typecheck && npm test && npm run build && node .planning/quick/261020-gzd-landing-page-with-feature-tabs-and-scrol/261020-gzd-render-check.mjs</automated>
    <fails_when>tsc reports an error, any test fails, the build fails, or the render check prints a FAIL line, exits non-zero or does not end with RESULT PASS</fails_when>
    <automated>test -z "$(git diff --name-only 7033140 -- src/core package.json package-lock.json .planning/ROADMAP.md .planning/REQUIREMENTS.md)" && grep -c "^## Landing View" .planning/phases/04-incident-console-and-investigation-flow/04-UI-SPEC.md</automated>
    <fails_when>a protected file changed, or the grep count is not exactly 1</fails_when>
  </verify>
  <done>The demo pins its stage at 640px and wider with motion, scrolling advances the five steps with settling animations and a passive listener that exists only while the demo is in view; phones get once-on-enter animations; reduced motion shows five stacked static steps with zero animations; no width from 320 to 1440 scrolls horizontally and the headline stays within 2 lines; 04-UI-SPEC.md has the Landing View section; typecheck, test (with counts), build and the full render check are green; screenshots were viewed and observations recorded.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| bundled fixture text to landing DOM | commit subjects, authors, raw log lines and Markdown from the fixtures reach the page through the preview builders |
| location.hash to router | the hash is user-controlled (typed, linked, history) and decides which view shows and which element gets focus |
| page scroll to motion driver | scroll and resize events drive work on every frame while the demo is visible |
| landing previews to console focus contracts | renderer copies share class names, ids and data hooks with the live console |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261020gzd-01 | Tampering | src/ui/landing-preview.ts, src/ui/landing-demo.ts (fixture-derived text) | high | mitigate | Text reaches the DOM only through el(), svgEl() and textContent (the shipped renderers already do); static-safety's HTML-sink test covers every new file; the render check reads real text only |
| T-261020gzd-02 | Tampering | src/ui/router.ts hash handling | medium | mitigate | parseHash is an allow-list ('#/', '#/app', else landing); fragments are resolved only with getElementById (never a selector string), decoding is wrapped in try/catch, and hash text is never written to the DOM or the title; router.test.ts covers malformed input |
| T-261020gzd-03 | Denial of service | src/ui/motion.ts watchScroll and the demo controller | medium | mitigate | One passive scroll listener only while the demo intersects, at most one pending animation frame, removed on stop() and dispose(); static-safety enforces passive scroll listeners only in motion.ts; the render check counts window scroll listeners in view and after leaving to #/app |
| T-261020gzd-04 | Tampering | renderer copies on the landing (ids, data-suspect-rank, data-focus-id) | medium | mitigate | prepareRendered prefixes every id and id reference and strips the focus hooks, previews are inert; the render check asserts no duplicate id in the document and no data-suspect-rank inside #view-landing, and every inherited console focus check passes |
| T-261020gzd-05 | Denial of service | keyboard access (tabs, previews, route changes, modal drawer) | medium | mitigate | Roving tabindex with no trap, inert previews out of the tab order, focus moved to the view heading on navigation, deactivate() closes the drawer when leaving the console; render check covers Tab, arrow keys, back/forward |
| T-261020gzd-06 | Denial of service | motion under reduced-motion preference (vestibular safety) | medium | mitigate | All landing motion is inside the no-preference media query, watchScroll and playEntrance are no-ops without motion, reduced mode is stacked and static; motionViolations stays green and the render check samples zero animations |
| T-261020gzd-07 | Information disclosure | landing previews | low | accept | The landing renders only the bundled fixtures; user-supplied logs never reach it; no network or storage API exists (static-safety) |
| T-261020gzd-08 | Spoofing | landing copy (claims about weights, limits, privacy) | low | mitigate | landing-copy.test.ts pins weights and limits to SCORING_V1 and DEFAULT_LOG_LIMITS, bans the listed marketing words and emoji, requires 'ranked suspicion, not proof'; offline facts name only test files that exist and say what they check |
| T-261020gzd-SC | Tampering | npm/pip/cargo installs | high | mitigate | No install task in this plan; static-safety pins no runtime dependency and exactly four devDependencies; the package manifests diff is empty against 7033140 |
</threat_model>

<verification>
- `npm run typecheck` green; `npm test` green with file and test counts reported (baseline before this plan: 31 files, 514 tests); `npm run build` green.
- `git diff --name-only 7033140 -- src/core package.json package-lock.json .planning/ROADMAP.md .planning/REQUIREMENTS.md` prints nothing.
- The render check prints `RESULT PASS` with no FAIL lines across the reduce and motion runs at 1280x720 and 360x740 plus the width sweep; no console errors; no off-origin requests; screenshots (hero, tabs, demo-mid, mobile) saved under the OS temp dir (or `--out`) and viewed.
- static-safety: animation-frame allow-list still exactly ['src/ui/motion.ts']; new rule: passive scroll listeners only in src/ui/motion.ts. contrast: every pre-existing assertion unchanged, one landing-pairs test added, motionViolations unrelaxed.
</verification>

<success_criteria>
- A first-time visitor at `#/` sees what Culprit does, a live result computed from a real bundled case, and reaches the loaded checkout case in one click.
- The six feature tabs and the five-step demo show real renderer output, follow the WAI-ARIA and reduced-motion contracts, and never trap keyboard or scroll.
- The console at `#/app` behaves exactly as before, and every gate (typecheck, tests, build, render check, design rules, static safety, rebuild surface) is green.
</success_criteria>

<output>
Create `.planning/quick/261020-gzd-landing-page-with-feature-tabs-and-scrol/261020-gzd-SUMMARY.md` when done, recording test counts, render-check observations per run, screenshot paths and what each screenshot showed, any copy wording changed because the code disproved it, and the static-safety and contrast additions.
</output>
