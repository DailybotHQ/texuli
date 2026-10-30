# Cascade layers and compiled CSS

**Package:** `@texuli/tokens`
**Source:** `packages/tokens/src/css/`  
**Import:** `@texuli/tokens/css` (preferred) or the root barrel
**Tests:** `packages/tokens/tests/css.test.ts`

## Precompiled base stylesheet

Import `@texuli/tokens/base.css` once in the application stylesheet. It is a
plain CSS file; it does not require Tailwind or a CSS transform. It declares
`@layer tx.base, tx.components` and puts reset, focus, motion and surface rules
in the lower-priority `tx.base` layer. Unlayered consumer CSS and later
`tx.components` rules can override those normal declarations.

## Scoped themes

`themeVariables({ theme, mode, density?, reducedMotion? })` returns validated
custom properties for one mode. `compileThemeCss(theme)` emits light and dark
rules scoped to `[data-tx-theme="<id>"][data-tx-mode="light|dark"]` inside
`tx.base`; applying the attributes to any element scopes the properties to
that element and its descendants. The theme is validated again before CSS
serialization, so a type cast cannot bypass CSS-value checks.

```ts
import { applyTheme, clearTheme, compileThemeCss } from '@texuli/tokens/css';

const styleElement = document.createElement('style');
styleElement.textContent = compileThemeCss(theme);
document.head.append(styleElement);
applyTheme(previewElement, { theme, mode: 'dark' });
// On preview teardown:
clearTheme(previewElement);
```

`applyTheme` sets the `data-tx-theme`, `data-tx-mode`, `data-tx-motion` and
`data-tx-surface` attributes on any supplied element, and writes the validated
custom properties there. `clearTheme` removes those properties and attributes.
Neither function accesses `window` or `document` at module initialization.

### Element scopes (ADR-023)

`applyTheme` also marks the element as a token scope, `data-tx-scope` (an
empty value; a value the host already set, such as `data-tx-scope="studio"`,
is kept, and `clearTheme` removes only the empty marker). Several scopes can
share a page, each with its own theme and mode:

- `base.css` declares the system token defaults on
  `:where(:root, [data-tx-theme], [data-tx-scope])`, so space, radius and
  type steps derive from the nearest scope's density and radius;
- overlays rendered in place inherit the scope; portaled ones (dialogs and
  sheets) mount in a scoped portal root that mirrors the scope's `data-tx-*`
  attributes and inline `--tx-*` variables and follows their changes
  ([core-portal](../../core/docs/core-portal.md#token-scopes-adr-023));
- `tests/e2e/theme-scopes.spec.ts` renders two themes side by side, one
  dark, with open overlays in each, and checks their computed colors and axe.

A theme applied to `<html>` is page-wide: body portals inherit it as before.

Theme presets, the theme library, mode preference resolution and share-link
encoding are owned by separate tasks. The base stylesheet currently leaves
forced-colors mapping to the forced-colors task.
