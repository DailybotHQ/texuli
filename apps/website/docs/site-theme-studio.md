# Theme studio (texuli.com)

**App:** `apps/website`  
**Path:** `/theme-studio/`  
**Tests:** `scripts/tests/site-loaders.test.ts`, `tests/e2e/site-theme-studio.spec.ts`

## Goal

Build a Texuli theme from:

1. **Color** — brand hex (+ optional secondary) via `generateThemeFromSeed`
2. **Words** — mood phrases via `generateThemeFromMood` / `MOODS`
3. **Image** — local file only; `readImagePixels` → `generateThemeFromImage` (no network)

Then **tune roles**, **preview** Button / Badge / Card / Input / link live, run the
**WCAG 2.x AA (or AAA) gate**, and **export** CSS (`compileThemeCss`) or JSON.

Static Astro page + one Svelte island. APCA is out of scope.

## Layout

| Piece | Role |
| --- | --- |
| `studio.ts` | Pure generate / role override / AA summary / export |
| `ThemeStudio.svelte` | Island UI |
| `PreviewKit.svelte` | Live components on applied `--tx-*` vars |

## Validation

```bash
pnpm vitest run scripts/tests/site-loaders.test.ts
pnpm build
TEXULI_E2E_PORT=4880 pnpm exec playwright test tests/e2e/site-theme-studio.spec.ts
```

## Limits

- Role overrides re-run `defineTheme`; invalid values surface as errors.
- Image decoding requires a same-origin / file-backed image (object URL).
- AA list shows failing pairs only (the generator already solves most pairs).

## Sticky header (site chrome)

The site header is sticky. A small module script in `SiteHeader.astro` sets `--site-header-height` on
`<html>`; `BaseLayout` applies `scroll-padding-top: var(--site-header-height)`
(with an 8rem fallback) so focus and in-page anchors clear the bar (WCAG
2.4.11). Studio e2e never uses `force: true` clicks.
