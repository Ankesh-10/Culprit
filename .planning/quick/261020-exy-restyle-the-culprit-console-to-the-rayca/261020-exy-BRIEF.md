# Quick task 261020-exy: Raycast restyle of the Culprit console

Source design: C:\Users\Asus\Desktop\code\awesome-design-md\design-md\raycast\DESIGN.md (read it in full), tweaked by the taste-skill minimalist-ui rules. The user chose this direction; the decisions below are LOCKED, do not re-ask.

## Locked decisions

1. **Base = Raycast dark system.** canvas `#07080a`, surface `#0d0d0d`, elevated `#101111`, card `#121212`, hairline `#242728`, hairline-strong `rgba(255,255,255,0.16)`, ink `#f4f4f6`, body `#cdcdcd`, mute `#9c9c9d`, ash `#6a6b6c`. Elevation from the surface ladder only, no shadows. Radii: 10px cards, 8px buttons/inputs, 6px rows, 4px keycaps/kbd/badges. Card padding 16-24px. Controls 36px visual height BUT keep the 44px touch-target minimum on the core path from 04-UI-SPEC.md.
2. **Primary CTA** ("Analyze incident" and any primary) = solid white `#ffffff` with `#000000` text, 8px radius (not a full pill: minimalist rule bans pills on large controls), pressed `#e8e8e8`. The sky-blue `#7dd3fc` accent is retired as a fill. Focus ring stays visible and >= 3:1 against its neighbours (2px, 2px offset; use Raycast accent-blue `#57c1ff` or white). Selected-state cues (left rule + check icon) stay: never color alone.
3. **Typography:** Inter first, then system-ui fallback; `font-feature-settings: "calt","kern","liga","ss03"` on body. Map Raycast sizes onto the existing four-size scale where possible (48/24/16/14), weights 400 and 500 (replace 600 with 500 where Raycast uses 500; keep hierarchy readable). Mono (Geist Mono, then ui-monospace) stays for hashes, paths, log lines, signatures and `kbd`. DO NOT fetch Inter from a CDN and DO NOT add npm dependencies. If no Inter file is on disk the system-ui fallback applies. Extend `src/ui/fonts.ts` and `src/assets/fonts/FONTS.md` so an optional `Inter-Variable.woff2` (+ `OFL.txt`) in `src/assets/fonts/` is picked up exactly like Geist is (update its tests in tests/ui/case-picker.test.ts accordingly; keep the "licence file beside any WOFF2" rule).
4. **Minimalist-skill tweaks that apply:** no gradients anywhere (drop Raycast's hero stripe and keycap gradient; keycaps flat `#121212`); no glass; no emoji; soft status badges using Raycast soft accents (rgba 0.15 background + accent text) ALWAYS with icon + text label; `kbd` micro-UI for keyboard hints (border hairline, radius 4px, mono, flat card background); off-black body text, never pure black on text outside the white button; generous but not huge whitespace.
5. **Data-viz colors stay** (`#3987e5` errors, `#d95926` onset, `#199e70` suspect, `#8fa0b8` context). Re-validate on the new chart surface `#0d0d0d` (non-text >= 3:1); only adjust if one fails, and then update documented figures.
6. **Accent rule (Raycast):** yellow/red/green/blue appear only in status badges/icons and chart marks, never on buttons or text chrome.

## Constraints

- Plain DOM, native CSS, offline, no CDN, no new dependencies. Do NOT touch `src/core/`.
- Keep every behavior and DOM/aria contract exercised by `tests/ui/*`. Where a test pins a visual token (tests/ui/contrast.test.ts pins the :root tokens to the UI-SPEC hex values and recorded ratios) update the test AND `.planning/phases/04-incident-console-and-investigation-flow/04-UI-SPEC.md` (Color, Typography, Spacing, Design System font row, Identity section, Palette Validation Record) so they stay consistent with the new palette. Recompute every contrast ratio with real WCAG math; text pairs >= 4.5:1, non-text >= 3:1, on the page, surface and raised backgrounds the UI actually uses.
- Keep forced-colors, print and `prefers-reduced-motion` rules working.
- The loaded-case / selected states must still be distinguishable without color (rule + check + text).
- src/styles.css uses `:root` tokens (~2000 lines): prefer changing tokens and a small number of component rules over rewriting; rename tokens only if the contrast test and all references are updated.

## Done means

- `npm run typecheck`, `npm test`, `npm run build` all green.
- A headless-browser screenshot check at 1280x720 and 360x740 of the checkout case (build, `vite preview`, drive Chrome over CDP or the available browser tooling) with no console errors and no horizontal scroll at 360px; report what was observed. Stop any server/browser you start.
- UI-SPEC and tests updated to match; summary lists every token that changed.
