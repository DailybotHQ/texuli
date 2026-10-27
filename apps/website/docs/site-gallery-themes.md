# texuli.com: theme gallery

**App:** `apps/website`  
**Route:** `/gallery-themes/`  
**Components:** `src/components/gallery-themes/`  
**Tests:** `tests/e2e/site-gallery-themes.spec.ts` · `scripts/tests/site-loaders.test.ts`

## Goal

Every library theme as a **live preview card** (light, dark, high contrast)
with its **palette**, **WCAG 2.x AA contrast scores**, and **one-click apply**.
Static output, no runtime network, axe clean in light and dark on desktop and
Pixel 7.

## How it works

| Piece | Role |
| --- | --- |
| `buildGalleryThemeCards()` | Build-time: full library themes + `runAaGateOnTheme` → compact card rows |
| `buildThemeLibraryCss()` / `buildHighContrastModeCss()` | Reused from the theme switcher; inlined only on this page |
| `ThemeGallery.svelte` | Island: filter, preview-mode toggle, cards, Apply |
| `applySiteAppearance()` | Same no-flash cache as `/theme-switcher/` so the whole site follows |

Each card’s preview surface sets `data-tx-theme` and `data-tx-mode` so the
inlined library CSS paints a real light/dark/high-contrast sample. Swatch
dots also carry the authored hex (or system color keywords for high contrast).

### Scores

For each mode the card shows:

- **AA pass** / **N issues** / **system colors** (high-contrast pairs are mostly
  non-hex and skipped by the gate — not failures)
- Worst **text** and **UI** ratio among checked pairs (`formatRatio`)

Overall card pass/fail uses **light + dark** only (authored palettes).

## Usage

```bash
pnpm build
pnpm --filter @texuli/website preview
# open /gallery-themes/
```

```ts
import {
  buildGalleryThemeCards,
  filterGalleryCards,
  formatRatio,
} from '../components/gallery-themes/index.ts';
```

## Tests

```bash
pnpm vitest run scripts/tests/site-loaders.test.ts
bash -c 'pnpm build && TEXULI_E2E_PORT=4910 pnpm exec playwright test tests/e2e/site-gallery-themes.spec.ts'
```

The e2e spec serves `apps/website/dist` on a free loopback port and checks
Chromium, WebKit and Pixel 7:

- 200+ theme cards with live previews and score rows;
- filter and AA status toggle;
- Apply updates `data-tx-theme` / `data-tx-mode` and persists across reload;
- no foreign network;
- axe WCAG 2.1 A/AA in light and dark.

## Limits

- Primary nav may not link here yet (foundation `NAV`); open `/gallery-themes/`
  directly.
- Page HTML is large (~same order as the theme switcher) because library CSS
  is inlined on this route only.
- High-contrast mode scores often show “system colors” (skipped non-hex);
  that is expected for CSS system keywords.
- APCA is out of scope; only WCAG 2.x contrast ratios are used.
