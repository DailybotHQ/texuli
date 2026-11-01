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
> published to npm as `0.11.5`, a pre-1.0 release (1.0.0 will be the first
> stable release). Under 0.x, a new minor (`0.12.0`) may contain breaking
> changes, so pin the exact version or use `^0.11.0`, which accepts only 0.11.x.

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

`base.css` declares the `tx.base` and `tx.components` cascade layers, the
system token defaults, and the reset, focus, motion and surface rules. The
colors come from a theme, which you apply at runtime (below).

**A host must load `base.css` or `system.css`.** Since token contract v2
(`0.9.0`), component CSS reads the system tokens (`--tx-space-unit`,
`--tx-size-icon-sm`, `--tx-shape-radius-*`…) with no fallback, and a theme
does not declare them. A host with its own reset that loads neither renders
controls with no size. A host that keeps its own reset can load the system
token defaults alone (from `0.10.0`):

```css
@import '@texuli/tokens/system.css';
```

`system.css` is the same generated token block as `base.css` (one renderer
writes both, and a test holds `base.css` to a superset), with no reset, motion
tables or focus ring hook: 1,189 B of CSS gzip instead of 2,781 B (measured by
`pnpm size`).

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
| Stylesheets | `base.css`, `system.css`, `forced-colors.css`, `tailwind/preset.css` | Base layer, the system token defaults alone (from `0.10.0`), forced-colors mapping, Tailwind 4 preset |
| Apply themes | `css` | `applyTheme`, `clearTheme`, `themeVariables`, `compileThemeCss` |
| Token contract | `contract` | The `--tx-*` contract and the `Theme` type |
| Palette engine | `palette` | OKLCH scales, tones and contrast pairs |
| Theme library | `library` | 64 themes with lazy loaders: `loadLibraryTheme`, `listThemeLibrary`, `searchThemeLibrary` |
| Expanded library | `library-expand` | 146 more themes (6 built-ins, then 140 curated) |
| Library ids | `library-ids` | From `0.11.0`: every library theme id (6 built-in, 64 port, 140 expand; 210) with no metadata, `isLibraryThemeId` and `libraryThemeSet`, for synchronous id checks (1.7 KB gzip) |
| Single theme | `build` | `buildLibraryTheme`: build one theme from a compact definition without loading the catalog |
| Theme generator | `generator` | `generateThemeFromSeed`, `generateThemeFromMood`, `generateThemeFromImage` |
| Contrast gate | `aa-gate`, `aa-gate/components` | WCAG AA checks for theme and component color pairs |
| Color modes | `modes` | Light, dark, system and high-contrast resolution: `resolveColorMode`, `applyColorMode` |
| No-flash bootstrap | `no-flash` | `noFlashScript`, `cacheAppearance`: replay the stored theme and mode before first paint |
| Forced colors | `forced-colors` | `compileForcedColorsCss` and the system-color role map |
| Style presets | `style-presets` | Shared style presets on top of the contract |
| Tailwind 4 | `tailwind` | Utilities mapped onto the `--tx-*` contract |
| Motion tokens | `motion` | New in `0.6.0`: 5 durations, 5 easings and 3 springs as data (`MOTION_DURATIONS`, `MOTION_EASINGS`, `MOTION_SPRINGS`), behind the `--tx-motion-*` properties in `base.css` |
| System tokens | `system` | From `0.9.0` (token contract v2, ADR-020): 151 system tokens in 11 families (space, size, type roles, elevation, shape, layers, opacity, layout, icons, status, data-viz). `base.css` declares the 123 non-chart defaults once per token scope (generated); CSS reads them plainly with `systemVar(name)` (`var(--tx-space-4)`) |
| Component tokens | `components` | From `0.9.0`: the component token registry (57 components, 364 tokens: the `texuli` styled families plus 9 domain families). Component tokens are never declared (0 B until set): CSS reads them with `componentVar(component, key)`, one fallback level (`var(--tx-button-radius, var(--tx-shape-radius-lg))`), and design systems set them on their scope. `checkTokenReads` guards the read forms; every `texuli` styled component reads its tokens, and the domain packages read theirs |
| Chart tokens | `data-viz` | From `0.9.0`: `dataVizVariables(theme, mode)` returns all 28 `--tx-chart-*` values for any theme, derived when the theme has no `charts` |
| Renames | `renames`, `renames.json` | From `0.9.0`: the machine-readable `--tx-*` rename list for codemods (empty: contract v2 renames nothing) |
| Design systems | `design-system/compile`, `design-system/validate` | From `0.10.0` (ADR-021, ADR-022): `compileDesignSystem` turns a design-system document into concrete `--tx-*` variables per mode with enforced contrast, focus and target guarantees (refusals with codes and JSON paths), `resolveDesignSystem` follows `extends` (`texuli:<id>` library themes, `id@x.y.z` from your resolver), variants and patches, and `fromTheme` turns any `Theme` into a document. `validate` re-checks compiled maps with `checkDesignSystemGuarantees`. Both are lazy: the root never imports them. `design-system/compile-core` (from `0.11.0`, G127) is the compiler without the theme library: `resolveDesignSystemCore` loads `texuli:<id>` bases only through a `loadLibraryBase` you pass. |
| Design-system runtime | `design-system/apply` | From `0.10.0` (ADR-023): `applyDesignSystem(el, compiled, { mode })` writes a compiled map on one element in one style write with the allowlisted attributes and `[data-tx-scope]`, registers fonts lazily and returns a restoring dispose; `designSystemStyle` is the same declarations for SSR and `designSystemAppearance` for the no-flash replay (byte-identical, tested). Lazy, 2,040 B gzip |
| Design-system I/O | `design-system/import`, `design-system/emit`, `design-system/report`, `design-system/diff`, `design-system/fixtures` | From `0.10.0`: importers (brand one-liner, W3C DTCG, Tokens Studio, flat role palette, Texuli `Theme`, logo pixels) that return a valid document plus warnings and never throw; deterministic emitters (scoped CSS, Tailwind preset, DTCG, Tokens Studio, flat palette, compiled JSON); a static report page escaped by construction; `diffDesignSystems` (token changes per mode, contrast regressions, default changes); fictional fixtures, including a `protoyard-theme/v1`-shaped palette, with lossless round trips. All lazy |

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

## New in 0.6.0

Ships in `0.6.0`; the `0.5.0` release predates it:

- `@texuli/tokens/motion` and the `--tx-motion-*` properties, which reduced
  motion zeroes ([tokens-motion](https://github.com/DailybotHQ/texuli/blob/main/packages/tokens/docs/tokens-motion.md)).
- **Breaking:** under `prefers-reduced-motion: reduce`, `base.css` sets
  animation and transition durations and delays to `0s` (it was `0.01ms`),
  so `visibility` changes are instant (G78); a `0s` transition fires no
  `transitionend`.

## Documentation

- Website: [texuli.com](https://texuli.com), the
  [theme gallery](https://texuli.com/gallery-themes/), the
  [theme studio](https://texuli.com/theme-studio/) and the
  [theming guide](https://texuli.com/guides/theming/)
- Compiled CSS and scoped themes: [tokens-css.md](https://github.com/DailybotHQ/texuli/blob/main/packages/tokens/docs/tokens-css.md)
- Token contract: [tokens-contract.md](https://github.com/DailybotHQ/texuli/blob/main/packages/tokens/docs/tokens-contract.md)
- Token contract v2 tables (system families and component tokens, generated): [tokens-components.md](https://github.com/DailybotHQ/texuli/blob/main/packages/tokens/docs/tokens-components.md)
- Motion tokens (durations, easings, springs): [tokens-motion.md](https://github.com/DailybotHQ/texuli/blob/main/packages/tokens/docs/tokens-motion.md)
- Theme generator: [tokens-generator.md](https://github.com/DailybotHQ/texuli/blob/main/packages/tokens/docs/tokens-generator.md)
- Theme libraries: [tokens-library-port.md](https://github.com/DailybotHQ/texuli/blob/main/packages/tokens/docs/tokens-library-port.md)
  and [tokens-library-expand.md](https://github.com/DailybotHQ/texuli/blob/main/packages/tokens/docs/tokens-library-expand.md);
  every library id without metadata: [tokens-library-ids.md](https://github.com/DailybotHQ/texuli/blob/main/packages/tokens/docs/tokens-library-ids.md)
- Color modes and no-flash: [tokens-modes.md](https://github.com/DailybotHQ/texuli/blob/main/packages/tokens/docs/tokens-modes.md)
  and [tokens-no-flash.md](https://github.com/DailybotHQ/texuli/blob/main/packages/tokens/docs/tokens-no-flash.md)
- Design-system compiler (from `0.10.0`): [design-system-compiler.md](https://github.com/DailybotHQ/texuli/blob/main/packages/tokens/docs/design-system-compiler.md)
- Design-system runtime (from `0.10.0`): [design-system-runtime.md](https://github.com/DailybotHQ/texuli/blob/main/packages/tokens/docs/design-system-runtime.md)
- Design-system importers, emitters, report and diff (from `0.10.0`): [design-system-io.md](https://github.com/DailybotHQ/texuli/blob/main/packages/tokens/docs/design-system-io.md)
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
