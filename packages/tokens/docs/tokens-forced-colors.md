# Forced colors and prefers-contrast

**Package:** `@texuli/tokens`  
**Source:** `packages/tokens/src/forced-colors/`  
**Tests:** `packages/tokens/tests/forced-colors.test.ts`

## Goal

When the operating system forces a limited palette (`forced-colors: active`,
Windows High Contrast, and similar), every Texuli semantic role still maps to a
**CSS system color**. Focus rings, borders and selection stay visible. Under
`prefers-contrast: more`, chrome widths and critical roles step up even when
forced-colors is off.

WCAG 2.x contrast for authored light/dark themes is owned by the palette
task. This module does not implement APCA.

## Import

```css
@import '@texuli/tokens/base.css';
@import '@texuli/tokens/forced-colors.css';
```

Or inject the same bytes at runtime:

```ts
import { compileForcedColorsCss } from '@texuli/tokens/forced-colors';

styleElement.textContent = compileForcedColorsCss();
```

Rules live in `@layer tx.base` so consumer CSS and `tx.components` can override
non-forced properties. Under forced colors the browser still maps paints to the
system palette through the `--tx-*` variables.

## Mapping

`FORCED_COLORS_ROLE_MAP` assigns every `SEMANTIC_ROLES` entry a system keyword
(`Canvas`, `CanvasText`, `Highlight`, `ButtonBorder`, `LinkText`, …). Interactive
roles also get:

| State | System color |
| --- | --- |
| `disabled` | `GrayText` |
| `focus` | `Highlight` |
| `hover` / `active` | same as the role default |

Visibility-critical roles (`border`, `borderStrong`, `ring`, `selection`,
`selectionForeground`, `foreground`, `link`) never use a lone `Canvas` fill
that would erase chrome.

`createForcedColorsPalette()` builds a full `SemanticPalette` from that map.
`checkForcedColorsCoverage()` is the automated audit used in tests (and later
by component token checks): missing roles, non-system colors and invisible
chrome mappings fail.

## Prefers-contrast

`@media (prefers-contrast: more)` thickens `--tx-border-width` and
`--tx-focus-ring-width` and anchors border / ring / selection variables to
system fallbacks. Mode resolution (`@texuli/tokens/modes`) already selects
`high-contrast` when the user prefers more contrast and mode is `system`.

## API

| Export | Role |
| --- | --- |
| `FORCED_COLORS_ROLE_MAP` | Role → system color |
| `createForcedColorsPalette()` | Full semantic palette |
| `forcedColorsCssVariables()` | Flat `--tx-*` map |
| `compileForcedColorsCss()` | Stylesheet string |
| `checkForcedColorsCoverage()` | Audit issues |
| `SYSTEM_COLOR_KEYWORDS` | Allowlist |

## Budget

The shipped `forced-colors.css` is measured under 1.5 KB gzip in tests (well
under the 6 KB base CSS ceiling). Library theme modules stay on their own
≤ 1.5 KB gzip budgets and do not embed this sheet.
