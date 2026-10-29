# @texuli/tokens

The theme engine and design tokens of [Texuli](https://texuli.com), an
MIT-licensed Svelte 5 component library by Dailybot, Inc. (*Small pieces.
Infinite possibilities.*). `@texuli/tokens` defines the `--tx-*` CSS custom
property contract every styled Texuli component reads, computes palettes in
OKLCH, ships a library of 210 ready-made themes, generates new themes from a
brand color, a mood or an image, and checks contrast against WCAG AA.

Use it to theme the [`texuli`](https://www.npmjs.com/package/texuli)
components, or on its own as a framework-free token engine for any CSS
(including a Tailwind 4 preset). The engine is plain TypeScript with no
runtime dependencies.

> **Status: 0.x release.** Texuli is in development. The packages are
> published to npm as `0.5.0`, a pre-1.0 release (1.0.0 will be the first
> stable release). Under 0.x, a new minor (`0.6.0`) may contain breaking
> changes, so pin the exact version or use `^0.5.0`, which accepts only 0.5.x.

## Install

```bash
npm install @texuli/tokens
```

```bash
pnpm add @texuli/tokens
# or
yarn add @texuli/tokens
```

No peer dependencies. Import the base stylesheet once, in your app's global
CSS or entry module:

```css
@import '@texuli/tokens/base.css';
/* optional: Windows High Contrast and other forced-colors modes */
@import '@texuli/tokens/forced-colors.css';
```

`base.css` declares the `tx.base` and `tx.components` cascade layers and the
reset, focus, motion and surface rules. The colors come from a theme, which
you apply at runtime (below).

## Quick start

Apply a library theme to the whole page:

```ts
import '@texuli/tokens/base.css';
import { applyTheme } from '@texuli/tokens/css';
import { loadLibraryTheme } from '@texuli/tokens/library';

loadLibraryTheme('enterprise-neutral').then((theme) => {
  applyTheme(document.documentElement, { theme, mode: 'light' });
});
```

`applyTheme` writes the validated `--tx-*` properties and the
`data-tx-theme` and `data-tx-mode` attributes on any element, so you can
also theme a single preview panel. `clearTheme` undoes it.

Generate a brand theme and compile it to static CSS instead:

```ts
import { compileThemeCss } from '@texuli/tokens/css';
import { generateThemeFromSeed } from '@texuli/tokens/generator';

const theme = generateThemeFromSeed({ seed: '#2f6fed', id: 'acme' });
const css = compileThemeCss(theme);
// Light and dark rules scoped to [data-tx-theme='acme'][data-tx-mode='light' | 'dark']
```

## What's inside

| Purpose | Subpath | What it does |
| --- | --- | --- |
| Stylesheets | `base.css`, `forced-colors.css`, `tailwind/preset.css` | Base layer, forced-colors mapping, Tailwind 4 preset |
| Apply themes | `css` | `applyTheme`, `clearTheme`, `themeVariables`, `compileThemeCss` |
| Token contract | `contract` | The `--tx-*` contract and the `Theme` type |
| Palette engine | `palette` | OKLCH scales, tones and contrast pairs |
| Theme library | `library` | 64 themes with lazy loaders: `loadLibraryTheme`, `listThemeLibrary`, `searchThemeLibrary` |
| Expanded library | `library-expand` | 146 more themes (6 built-ins, then 140 curated) |
| Single theme | `build` | `buildLibraryTheme`: build one theme from a compact definition without loading the catalog |
| Theme generator | `generator` | `generateThemeFromSeed`, `generateThemeFromMood`, `generateThemeFromImage` |
| Contrast gate | `aa-gate`, `aa-gate/components` | WCAG AA checks for theme and component color pairs |
| Color modes | `modes` | Light, dark, system and high-contrast resolution: `resolveColorMode`, `applyColorMode` |
| No-flash bootstrap | `no-flash` | `noFlashScript`, `cacheAppearance`: replay the stored theme and mode before first paint |
| Forced colors | `forced-colors` | `compileForcedColorsCss` and the system-color role map |
| Style presets | `style-presets` | Shared style presets on top of the contract |
| Tailwind 4 | `tailwind` | Utilities mapped onto the `--tx-*` contract |

The root entry (`@texuli/tokens`) re-exports the engine areas; the theme
libraries and `build` stay behind their subpaths so unused themes are never
bundled.

With Tailwind 4, import in this order: `tailwindcss`, then
`@texuli/tokens/tailwind/preset.css`, then `@texuli/tokens/base.css`.

## Key guarantees

- **Contrast checked.** Every library theme passes the WCAG AA gate in light
  and dark mode; the generator can target AAA text contrast.
- **Validated values.** Themes are validated before they are written or
  serialized, so arbitrary input cannot inject CSS.
- **No flash, CSP-friendly.** The no-flash script body is deterministic for a
  namespace, so you can hash it for a `script-src` policy. It replays only
  allowlisted `--tx-*` values and fails closed on malformed cache data.
- **Accessible modes.** Forced-colors mode maps every semantic role to a
  system color, `prefers-contrast: more` strengthens chrome, and
  `prefers-reduced-motion` is respected.
- **Right-to-left.** Safe-area tokens have logical aliases that flip under
  `dir="rtl"`.
- **SSR-friendly.** No module touches `window` or `document` at import time;
  only the functions that write to an element or read storage do.

## Documentation

- Website: [texuli.com](https://texuli.com), the
  [theme gallery](https://texuli.com/gallery-themes/), the
  [theme studio](https://texuli.com/theme-studio/) and the
  [theming guide](https://texuli.com/guides/theming/)
- Compiled CSS and scoped themes: [tokens-css.md](https://github.com/DailybotHQ/texuli/blob/main/packages/tokens/docs/tokens-css.md)
- Token contract: [tokens-contract.md](https://github.com/DailybotHQ/texuli/blob/main/packages/tokens/docs/tokens-contract.md)
- Motion tokens (durations, easings, springs): [tokens-motion.md](https://github.com/DailybotHQ/texuli/blob/main/packages/tokens/docs/tokens-motion.md)
- Theme generator: [tokens-generator.md](https://github.com/DailybotHQ/texuli/blob/main/packages/tokens/docs/tokens-generator.md)
- Theme libraries: [tokens-library-port.md](https://github.com/DailybotHQ/texuli/blob/main/packages/tokens/docs/tokens-library-port.md)
  and [tokens-library-expand.md](https://github.com/DailybotHQ/texuli/blob/main/packages/tokens/docs/tokens-library-expand.md)
- Color modes and no-flash: [tokens-modes.md](https://github.com/DailybotHQ/texuli/blob/main/packages/tokens/docs/tokens-modes.md)
  and [tokens-no-flash.md](https://github.com/DailybotHQ/texuli/blob/main/packages/tokens/docs/tokens-no-flash.md)
- Contrast gate: [tokens-aa-gate.md](https://github.com/DailybotHQ/texuli/blob/main/packages/tokens/docs/tokens-aa-gate.md)
- Forced colors: [tokens-forced-colors.md](https://github.com/DailybotHQ/texuli/blob/main/packages/tokens/docs/tokens-forced-colors.md)
- Tailwind 4 preset: [tokens-tailwind.md](https://github.com/DailybotHQ/texuli/blob/main/packages/tokens/docs/tokens-tailwind.md)

## Related packages

- [`texuli`](https://www.npmjs.com/package/texuli): styled Svelte 5 components that read these tokens.
- [`@texuli/primitives`](https://www.npmjs.com/package/@texuli/primitives): headless primitives for your own styled layer.
- [`@texuli/core`](https://www.npmjs.com/package/@texuli/core): framework-free behavior and URL policy.

## Contributing

Source, issues and contribution guidelines live at
[github.com/DailybotHQ/texuli](https://github.com/DailybotHQ/texuli). Report
bugs at [github.com/DailybotHQ/texuli/issues](https://github.com/DailybotHQ/texuli/issues).

## License

MIT © Dailybot, Inc. Powered by [Dailybot](https://www.dailybot.com?utm_source=dailybotopensource&utm_medium=texuli-tokens).
