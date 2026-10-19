# Fonts

Culprit's UI is designed for **Geist** (interface text) and **Geist Mono** (commit hashes, file paths,
signatures and log lines).

## Expected files

| File | Used for |
|------|----------|
| `Geist-Variable.woff2` | Interface text |
| `GeistMono-Variable.woff2` | Hashes, paths, signatures, log lines |
| `OFL.txt` | The SIL Open Font License 1.1 text, which must ship beside the fonts |

## Source and licence

The official Geist release by Vercel, latin subset, converted to variable WOFF2. Geist and Geist Mono are
licensed under the SIL Open Font License 1.1. The licence text must be committed as `OFL.txt` in this
folder whenever the font files are.

The files are bundled locally through `import.meta.glob` in `src/ui/fonts.ts` and are never fetched from a
CDN or any other origin. `tests/ui/case-picker.test.ts` fails if a `.woff2` here has an unexpected name or
no `OFL.txt` beside it.

## Current status: system font fallback

The font files are not committed yet, so the UI renders with
`system-ui, -apple-system, "Segoe UI", sans-serif` and
`ui-monospace, "SFMono-Regular", Consolas, monospace` until they are added. No code change is needed when
they are: drop the three files into this folder and rebuild.
