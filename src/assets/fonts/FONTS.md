# Fonts

Culprit's UI is designed for three open-source families:

- **Inter** is the preferred interface face. It is used at weights 400 and 500 with the `ss03` stylistic set
  enabled on the page body.
- **Geist** is the second interface choice, used when no Inter file is present.
- **Geist Mono** carries commit hashes, file paths, signatures, log lines and `kbd` keycaps. These always
  render literally, with stylistic sets and ligatures switched off.

## Expected files

| File | Used for |
|------|----------|
| `Inter-Variable.woff2` | Interface text (preferred) |
| `Geist-Variable.woff2` | Interface text (second choice) |
| `GeistMono-Variable.woff2` | Hashes, paths, signatures, log lines, `kbd` |
| `OFL.txt` | The SIL Open Font License 1.1 text, which must ship beside the fonts |

## Source and licence

Inter is released by Rasmus Andersson; Geist and Geist Mono are the official Vercel releases. Use the latin
subset converted to variable WOFF2. All three families are licensed under the SIL Open Font License 1.1.
`OFL.txt` must carry the licence text plus the copyright notice of every family whose file is committed, and
it must sit in this folder beside any WOFF2.

The files are bundled locally through `import.meta.glob` in `src/ui/fonts.ts` and are never fetched from a
CDN or any other origin. `tests/ui/case-picker.test.ts` fails if a `.woff2` here has an unexpected name or
no `OFL.txt` beside it.

## Current status: system font fallback

No WOFF2 file is committed yet, so the interface renders with
`"Segoe UI Variable Text", "Segoe UI Variable", system-ui, -apple-system, "Segoe UI", sans-serif` and the
mono text with `ui-monospace, "SFMono-Regular", Consolas, monospace`. The Segoe UI Variable names come
before `system-ui` on purpose: Chrome on Windows resolves `system-ui` to the static Segoe UI, which has no
medium (500) face. No code change is needed when files are added: drop them into this folder, add
`OFL.txt`, and rebuild.
