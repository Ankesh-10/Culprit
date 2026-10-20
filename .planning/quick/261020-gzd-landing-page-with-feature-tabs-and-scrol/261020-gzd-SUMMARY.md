---
phase: quick-261020-gzd
plan: 01
subsystem: ui
tags: [landing, router, tabs, scroll-demo, motion, accessibility]
status: complete
requirements: [UX-01, UX-09, POLISH-02]
key-files:
  created:
    - src/ui/router.ts
    - src/ui/landing.ts
    - src/ui/landing-model.ts
    - src/ui/landing-preview.ts
    - src/ui/landing-tabs.ts
    - src/ui/landing-demo.ts
    - tests/ui/router.test.ts
    - tests/ui/landing-model.test.ts
    - tests/ui/landing-copy.test.ts
    - .planning/quick/261020-gzd-landing-page-with-feature-tabs-and-scrol/261020-gzd-render-check.mjs
  modified:
    - index.html
    - src/main.ts
    - src/ui/app.ts
    - src/ui/motion.ts
    - src/styles.css
    - tests/ui/static-safety.test.ts
    - tests/ui/contrast.test.ts
    - README.md
    - .planning/phases/04-incident-console-and-investigation-flow/04-UI-SPEC.md
commits: 6
plan_head_before: 7033140709163a7906df30a42e3e8e00aec8531e
plan_head_after: e0163079024a76d929981df98877d230a1f824c7
actuals:
  tasks: 3
  commits: 6
completed: 2026-10-20
---

# Quick 261020-gzd: landing page with feature tabs and a scroll-driven demo

One-liner: a hash-routed landing view (`#/`) with a live hero result card, six WAI-ARIA feature tabs with real renderer previews, a sticky scroll-driven "See it work" demo with reduced-motion and phone fallbacks, a trust strip and final CTA, with the console untouched at `#/app`.

## What was added

- `src/ui/router.ts`: pure `parseHash`, `routeHash` and tables (allow-list: `#/app` is the console, any other `#/...` the landing, fragments resolved with getElementById) plus `mountRouter` (view toggling, title, `aria-current`, focus on the view heading, `#route-status` announcement, no focus move on initial load).
- `src/ui/app.ts`: `mountApp(doc, { onOpenConsole })` now returns `ConsoleApi { loadCase, activate, deactivate }`. Sparklines run on first `activate()`; `deactivate()` closes the suspect drawer; the palette opens the console first.
- `src/ui/landing.ts`, `landing-preview.ts`, `landing-tabs.ts`, `landing-demo.ts`, `landing-model.ts`: hero card, tabs, previews, demo controller and the DOM-free maths (`prefixIdRefs`, `FEATURE_TABS`, `tabKeyTarget`, `weightsText`, `limitsText`, `markdownExcerpt`, `DEMO_STEPS`, `scrollProgress`, `stepAt`, `demoMode`).
- `src/ui/motion.ts`: `watchScroll` (IntersectionObserver-gated passive scroll plus resize listener, one pending frame, removed on leave and dispose).
- `index.html` views, nav, landing copy; `src/styles.css` landing layout, `--text-hero: 64px` (the one new size), gated motion; README sentence; UI-SPEC "Landing View" section.
- Tests: 3 new files (router, landing-model, landing-copy), one passive-scroll-listener rule in static-safety, one landing-pairs test in contrast. Nothing existing was relaxed; `motionViolations` is unchanged and green.

## Verification

- `npm run typecheck` green. `npm test`: 34 files, 559 tests passed (baseline 31 files, 514 tests). `npm run build` green.
- `src/core`, `package.json`, `package-lock.json`, ROADMAP.md and REQUIREMENTS.md are untouched (diff against 7033140 is empty). 6 commits since 7033140.
- Render check (`261020-gzd-render-check.mjs`, vite preview on 4173, Chrome on 9223): `RESULT PASS`, 430 PASS lines, 0 FAIL, no console errors, no off-origin requests.

## Render-check observations

Runs: 1280x720 and 360x740, each with reduce and no-preference, plus a width sweep (320, 360, 640, 768, 1024, 1280, 1440 at 800 high in reduce, and 1280 and 1440 in motion).

Normal motion, 1280x720:
- Landing visible, console hidden, landing title, h1 exact (one line at 64px); hero card real text 2222222 / 0.91 at first detection; entrance samples `motion-rise` and settles; case-card sparklines are 0 on the landing (console analysis deferred); first Tab focuses "Skip to content" with the 2px rgb(87, 193, 255) ring.
- Trusted click on "Try the checkout outage": hash `#/app`, console title, "Result: Checkout outage", verdict hash 2222222, Console link `aria-current`. Back: landing, drawer closed, focus on `#landing-title`, non-empty route announcement; forward: console with focus on `#input-title`. Home link and "Open the console" switch views. `/` on the landing opens the palette and Enter shows the console with the checkout case. `#/app` deep link shows the console and sparklines appear.
- Tabs: 6 tabs and 6 panels, roving tabindex, click selects and focuses, ArrowRight/End/Home/ArrowLeft (wrap) correct, Tab leaves the tablist for the panel, panel switch samples `motion-rise` and settles; no duplicate ids; no `data-suspect-rank` in the landing; renderer previews inert; nothing from previews in the tab order; leading hash 2222222; postmortem preview is 14 lines starting `# Culprit analysis`; trust strip states 1 MiB and 10,000 events.
- Scroll demo: `.demo.is-scrolly`, stage `position: sticky`. For k = 0..4 the active step is inputs, onset, suspects, evidence, postmortem, exactly one frame is not aria-hidden and it is that step's frame, `--demo-progress` rises; sampler saw `motion-draw-line` (onset), `motion-rise` and `motion-diamond` (suspects), `motion-fill` and `motion-slide-in` (evidence), `motion-rise` (postmortem); all settle. While the demo is in view there is exactly one window scroll listener and it is passive; at the top of the page (demo out of view) zero; back at the demo one; after navigating to `#/app` zero and no `is-scrolly`. The page scrolled to its very bottom (never trapped).

Normal motion, 360x740: no `is-scrolly`, stage hidden, five steps each hold their frame; each frame gets `motion-enter` when scrolled into view and the page settles; tab and routing checks as above; no horizontal scroll.

Reduced motion, 1280x720 and 360x740: hero card exact at once, sampler max 0, no roll ghost, no ambient drift; tab switches run no animation; demo has no `is-scrolly`, stage hidden, five frames in their steps, no `motion-enter` anywhere in the landing; scrolling the whole page samples 0 animations; no window scroll listener.

Sweep: no horizontal scroll at any width, h1 spans at most 2 lines at every width (checked in reduce 320 to 1440 and motion 1280 and 1440).

Inherited console checks (palette, drawer, timeline, hit areas, weights, hover sweep, entrance) all pass at `#/app`.

## Screenshots (in `%TEMP%\culprit-261020-gzd`, 35 files; viewed)

- `hero-1280-motion.png`: wordmark and Home/Console nav top-left and right over the stripe band, one-line 64px headline, lede, white primary and outlined secondary, `/` keycap hint, and on the right an opaque result card (2222222, score 0.91 bar, High confidence, sparkline, "Sharp spike", onset 04:30-04:35 UTC, #2 1111111 0.54, caveat) with stripes peeking behind it. Empty space bottom-left under the hint (accepted).
- `hero-360-reduce.png`: two-line headline, stacked full-width buttons, hint, card below.
- `tabs-1280-motion.png`, `tabs-360-motion.png`: "What it does" with the six tabs (selected tab outlined on the raised surface), heading, text and the real timeline preview with onset band and the #1 marker; the tabs wrap onto three rows at 360.
- `demo-mid-1280-motion.png`: step 3 of 5 active (ink left rule, ink heading, muted other steps not visible here), sticky stage with the real lineup cards (#1 Leading 0.91, #2 0.54), cropped cleanly inside the stage.
- `mobile-360-motion.png`: stacked lineup preview inside the reveal flow. `mobile-360-reduce.png` (full page, 360x7198): hero, tabs, five stacked steps each with its static preview, trust strip, CTA and footer, no overflow.

## Deviations from Plan

**1. [Rule 1 - Bug] prepareRendered split id references on the letter s.** While writing the idempotent version I introduced `split(/s+/)` (lost backslash) instead of `/\s+/`. Caught by a failing test run before the task commit; fixed and committed with the demo task (1d4543a). The render check's duplicate-id and focus-hook assertions pass with the corrected code.

**2. [Rule 2 - Consistency] prepareRendered is idempotent and previews keep it applied.** The timeline redraws its chart (and its `pattern#timeline-hatch`) from a resize observer, which would re-introduce un-prefixed ids. `prepareRendered` skips already-prefixed ids and references, and the timeline preview wraps it in a MutationObserver (`keepPrepared`). Known limitation: the print and forced-colors CSS refer to `url(#timeline-hatch)`, so in those modes the landing timeline's onset band hatch resolves to the console's pattern id (hidden view) and may not render. The band colour and legend still show; this affects only print and forced-colors.

**3. [Copy wording, code disproved] "before the onset window" became "at or before the start of the onset window".** `src/core/ranking.ts` treats a commit as eligible when it is committed at or before the onset window start (inclusive). Changed in the Ranked suspects panel and demo step 3.

**4. [Preview content] Inspect-evidence buttons and the drawer's previous/next/close controls are removed from preview copies** (they would be inert look-alikes; the drawer preview shows what they open). The demo inputs preview uses `formatUtcClock` as is (it already ends in "UTC", so " UTC" is not appended twice).

**5. [Render check] Three non-inert previews.** The onset rows, Markdown excerpt and offline facts are plain text built from stream values, not console renderer output, so their preview bodies are not marked inert (they contain no interactive element); renderer previews (suspects, timeline, drawer, every demo frame) are inert. The render check asserts "no preview content in the tab order" instead of "every preview body inert". Frames are loaded via `about:blank` first and the frame sampler is installed on every new document so entrances that start at load are seen.

**6. [Render check] "Scroll listener removed" is asserted with the page scrolled to the top** (and after navigating to `#/app`), not at the page bottom: at the bottom of the page the end of the demo track is still within the 720px viewport, so one listener there is correct.

## Claims in landing copy verified against code

- Weights 0.35/0.30/0.25/0.10 and order: `SCORING_V1.weights` and `SIGNAL_ORDER` (src/core/scoring.ts); `weightsText` generates the string and `landing-copy.test.ts` pins it in index.html.
- "up to 1 MiB and 10,000 events": `DEFAULT_LOG_LIMITS` (1_048_576 and 10_000) via `limitsText`, pinned the same way.
- Eligible commits: ranking.ts (inclusive at or before the window start), see deviation 3. Frozen weights and identical order for identical input: scoring constants comment and `tests/core/determinism.test.ts`.
- Offline facts: `tests/ui/static-safety.test.ts` scans src and index.html for network and storage APIs and absolute URLs; `tests/core/determinism.test.ts` ("byte-identical across repeated calls and permitted record reordering") compares serialized output. "Computed in this browser" values come from the main-thread `handleAnalyzeRequest` on the bundled fixtures.
- Markdown content (verdict, evidence, confidence and caveats sections; first line `# Culprit analysis`): src/core/serialization.ts; clipboard fallback text selected for manual copy: README and `src/ui/copy.ts`.
- Linked timeline (shared UTC axis, onset window, markers, signature filter, arrow keys, data table twin): src/ui/timeline.ts, signatures.ts and the console render check.
- Evidence drawer (value, weight, contribution; changed files and ranges; no diff text note): drawer-model.ts (`DIFF_NOTE`) and drawer.ts.
- Onset shapes (spike, ramp, ambiguous) and UTC normalization of offset timestamps: fixtures and case-picker chips; the checkout fixture uses +05:30 offsets and the card shows 04:30-04:35 UTC.
- No privacy claim beyond "nothing leaves this browser": no network or storage API exists (static-safety) and the landing renders only bundled fixtures.
- No banned marketing word, invented customer, quote, logo, statistic, emoji, newsletter, signup or pricing appears (`landing-copy.test.ts`).

## Static-safety and contrast additions

- static-safety: scroll listeners only in `src/ui/motion.ts` and each must pass `passive: true`; animation-frame allow-list unchanged (`['src/ui/motion.ts']`).
- contrast: one `landing colour pairs` describe (ink-2 over grid at 3:1; muted, ink-2 and ink over page and surface at 4.5:1; ink on raised and control-border on page). No existing assertion changed; `motionViolations` not relaxed.

## Known Stubs

None. The only conditional placeholder is the "Preview unavailable." line shown if a bundled analysis fails (never in practice).

## Threat Flags

None beyond the plan's register: the new surface is the hash router (allow-listed, never written to the DOM), the passive scroll listener (lifecycle verified in the render check) and inert, id-prefixed renderer copies.

## Self-Check: PASSED

All created files exist; the 6 commits (3aa2cb5, f3cceef, 234ec93, 5f28c80, 1d4543a, e016307) are ancestors of HEAD; typecheck, test and build green; render check `RESULT PASS`; ports 4173 and 9223 have no listener; `.claude/launch.json` was never staged.
