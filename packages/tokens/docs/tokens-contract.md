# Three-tier token contract

**Package:** `@texuli/tokens`  
**Source:** `packages/tokens/src/contract/`  
**Import:** `@texuli/tokens/contract` (preferred) or the root barrel  
**Tests:** `packages/tokens/tests/contract.test.ts`

## Tiers

| Tier | What | API |
| --- | --- | --- |
| 1 Reference | Named OKLCH 11-step scales from fixed seeds | `REFERENCE_SCALE_IDS`, `getReferenceScale`, `getAllReferenceScales` |
| 2 Semantic | 50 roles; interactive roles carry hover/active/disabled/focus | `SEMANTIC_ROLES`, `INTERACTION_STATES`, palette on `Theme.light` / `Theme.dark` |
| 3 Component hooks | Opt-in `button` / `card` / `focusRing` / `input` | `ComponentHooks`, `deriveComponentHooks`, `data-tx-*` keys |

CSS custom properties use the **`--tx-*`** prefix (`tokenToCssVar`, `semanticTokenToCssVar`).

## Theme document

Agents emit a JSON theme that `validateTheme` / `defineTheme` accept:

- `id` (kebab), `name`, optional `description`
- System-first `fontFamily` / `fontFamilyMono` defaults (no unshipped webfont names)
- `radius`, `density` (0.75–1.25)
- Full `light` and `dark` semantic palettes (every role required)
- Optional `style`, `charts`, `components`

There is **no zod** (or other schema library) in this package. Validation is an
owned TypeScript walker. `THEME_JSON_SCHEMA` / `getThemeJsonSchema()` is the
offline JSON Schema mirror for agents and CI.

## CSS value safety

`isSafeCssColor`, `isSafeFontFamily`, `isSafeCssLength`, and `isSafeCssEasing`
refuse injection (`url(`, `;`, `{}`, `<>`, `\`, `!`) and unbalanced quotes or
parentheses. Colors may use hex, keywords, and allowlisted functions
(`rgb`, `hsl`, `oklch`, `color-mix`, `var`, `calc`, …).

## Contrast

WCAG 2.x contrast lives in the palette module (`contrastRatio`). **APCA is out
of scope** (license). The AA gate task owns pair lists over these roles.

## Not in this task

- Six built-in presets and share-link encode/decode → library-port task
- CSS apply / `@layer tx.base` emission → T-tokens-css
- Tailwind `@theme` mapping → T-tokens-tailwind

## Example

```ts
import {
  defineTheme,
  getReferenceScale,
  tokenToCssVar,
  validateTheme,
} from '@texuli/tokens';

const brand = getReferenceScale('violet');
tokenToCssVar('primaryForeground'); // '--tx-primary-foreground'

const result = validateTheme({
  id: 'demo',
  name: 'Demo',
  light: { /* all 50 roles */ },
  dark: { /* all 50 roles */ },
});
```
