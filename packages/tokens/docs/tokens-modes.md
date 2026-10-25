# Color modes

`@texuli/tokens/modes` resolves a requested mode (`light`, `dark`,
`high-contrast` or `system`) without reading browser globals at module load.
Pass a `matchMedia` function in tests or non-browser hosts; the default reads
`globalThis.matchMedia` only when resolution runs and falls back to light if
the API is absent or throws.

```ts
import { resolveColorMode, resolveSemanticPalette } from '@texuli/tokens/modes';

const mode = resolveColorMode('system');
const palette = resolveSemanticPalette(theme, mode);
```

Light and dark use the theme's separately authored semantic palettes. High
contrast uses platform system colors (`Canvas`, `CanvasText`, `Highlight`,
`HighlightText`, and related values) across the semantic roles. This keeps the
palette aligned with the user's contrast environment rather than attempting to
derive a high-contrast palette by mechanically inverting light or dark colors.
For `system`, `prefers-contrast: more` selects high contrast before checking
`prefers-color-scheme: dark`; other contrast preferences follow the color
scheme. Explicit light, dark and high-contrast choices are preserved.

`applyColorMode(element, mode)` writes `data-tx-mode`, updates the `.light` and
`.dark` compatibility classes and sets the browser `color-scheme`. It returns
the resolved mode so a caller can select matching theme tokens. The high
contrast palette is available from `createHighContrastPalette()` or through
`resolveSemanticPalette(theme, 'high-contrast')`.

For a first-paint mode selection, include the generated script body in the
document head before stylesheets. It reads only the mode key for the supplied
namespace (`texuli.<namespace>.mode`), accepts only the four known values, and
uses system preferences when the stored or fallback mode is `system`:

```ts
import { colorModeBootstrapScript } from '@texuli/tokens/modes';

const script = colorModeBootstrapScript('billing', 'system');
```

The function returns script contents without a `<script>` wrapper. A CSP
deployment can hash those exact contents; changing the namespace or fallback
changes the script and its hash. The helper does not persist user choices;
callers that offer a mode picker should store its selection under
`colorModeStorageKey(namespace)` before calling `applyColorMode`.
