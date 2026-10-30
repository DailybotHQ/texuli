# Tokens: Tailwind 4 preset

**Package:** `@texuli/tokens`  
**Source:** `packages/tokens/src/tailwind/`  
**Tests:** `packages/tokens/tests/tailwind.test.ts`  
**Task:** T-tokens-tailwind

## Purpose

Map Tailwind 4 utilities to the Texuli `--tx-*` token contract (colors, radius,
shadows, spacing, typography, motion) so product CSS stays themeable without
hard-coded palette values.

## Import order

```css
@import 'tailwindcss';
@import '@texuli/tokens/tailwind/preset.css';
@import '@texuli/tokens/base.css';
```

1. Tailwind core  
2. This preset (`@theme inline` + utilities + dark variant)  
3. Base layer (`@layer tx.base, tx.components`) so consumer / component classes win  

Themes still need `applyTheme` or `compileThemeCss` so the `--tx-*` variables
exist at runtime.

## What the preset provides

| Kind | Details |
| --- | --- |
| `@custom-variant dark` | `[data-tx-mode="dark"]` and legacy `.dark` |
| `@theme inline` | Colors (50 semantic roles + interaction + charts), radius scale, fonts, text sizes, `--spacing` from `--tx-space-unit` (0.25rem × density, so `p-4` equals `--tx-space-4`), durations, shadows |
| Safe-area utilities | `pt-safe`, `pb-safe`, `ps-safe`, `pe-safe`, `px-safe`, `py-safe` using **logical** properties and RTL-swapped `env()` insets |
| App / touch | `h-app`, `min-h-app`, `max-h-app`, `min-h-touch` (`--tx-target-size`, default 44px) |

## TypeScript map

```ts
import {
  TAILWIND_THEME_ENTRIES,
  TAILWIND_PRESET_PACKAGE_PATH,
  tailwindPresetCssHref,
} from '@texuli/tokens/tailwind';
```

`TAILWIND_THEME_ENTRIES` is the contract tests use to keep `preset.css` honest.
Every `tokenVar` is a `--tx-*` name from the three-tier contract / CSS apply path.

## Class composition

Do **not** add `clsx`, `tailwind-merge`, or `tailwind-variants`. Use Texuli `cx` /
`variants` when components need them. Cascade priority: unlayered consumer CSS
and `tx.components` override `tx.base`.

## Contrast

WCAG 2.x only (APCA out of scope). The AA gate lives on palette roles, not in
this preset.

## Size

Preset CSS is measured gzip in tests; it must stay under the shared base budget
contribution (base CSS ≤ 6 KB gzip overall for the tokens CSS surface).
