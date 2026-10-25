# @texuli/tokens

**Layer L2: the OKLCH theme engine.** The `--tx-*` token contract, the theme
library (210 themes) and the compiled CSS that every styled Texuli component
consumes. Private workspace package (`"private": true`), not published.

## What exists today

Every area below is implemented, exported and tested. The root barrel
`src/index.ts` re-exports the engine areas (palette, contract, css,
generator, library-expand, aa-gate, modes, no-flash, forced-colors,
style-presets, tailwind); the library loaders and the single-theme builder
stay behind their subpaths so tree-shaking works.

| Area | Subpath | What it does | Doc |
| --- | --- | --- | --- |
| Palette engine | `@texuli/tokens/palette` | OKLCH color math: scales, tones, contrast pairs | [tokens-palette](docs/tokens-palette.md) |
| Token contract | `@texuli/tokens/contract` | The three-tier `--tx-*` contract and the `Theme` type | [tokens-contract](docs/tokens-contract.md) |
| Compiled CSS | `@texuli/tokens/css` and `@texuli/tokens/base.css` | Cascade layers and the compiled `--tx-*` custom properties | [tokens-css](docs/tokens-css.md) |
| Theme library (port) | `@texuli/tokens/library` | The 64-theme port with lazy definition loaders | [tokens-library-port](docs/tokens-library-port.md) |
| Theme library (expand) | `@texuli/tokens/library-expand` | The 146-theme expanded set: the 6 Protoyard built-ins plus 140 curated | [tokens-library-expand](docs/tokens-library-expand.md) |
| Single-theme build | `@texuli/tokens/build` | Build one complete `Theme` from a compact definition, without loading the catalog | — |
| Theme generator | `@texuli/tokens/generator` | Generate a full theme from a seed and mood | [tokens-generator](docs/tokens-generator.md) |
| AA gate | `@texuli/tokens/aa-gate` (plus `aa-gate/components`) | WCAG AA checks for every theme and component pair | [tokens-aa-gate](docs/tokens-aa-gate.md) |
| Color modes | `@texuli/tokens/modes` | Light and dark mode handling on the contract | [tokens-modes](docs/tokens-modes.md) |
| No-flash bootstrap | `@texuli/tokens/no-flash` | Inline script contract that applies the stored mode before first paint | [tokens-no-flash](docs/tokens-no-flash.md) |
| Forced colors | `@texuli/tokens/forced-colors` and `forced-colors.css` | `forced-colors` and `prefers-contrast` support | [tokens-forced-colors](docs/tokens-forced-colors.md) |
| Style presets | `@texuli/tokens/style-presets` | Shared style presets on top of the contract | [tokens-style-presets](docs/tokens-style-presets.md) |
| Tailwind preset | `@texuli/tokens/tailwind` and `tailwind/preset.css` | The Tailwind 4 preset mapping the contract | [tokens-tailwind](docs/tokens-tailwind.md) |

The theme library is 210 themes: 64 in the port plus 146 in the expanded set
(6 Protoyard built-ins — violet, ocean, emerald, rose, amber, monochrome —
then 140 curated).
`tests/library-expand.test.ts` pins both counts and the unique ids. Soft tone
roles (`primarySoft`, `successSoft`, …) are produced by the library port and
the generator for pastel fills: [tokens-tone-soft](docs/tokens-tone-soft.md).

## Rules

- Themes are data: a `Theme` is a plain object validated against the
  contract. The engine is pure math; the only DOM contact is the no-flash
  bootstrap script the package emits and the generator's `readImagePixels`
  helper, which takes the `document` as an explicit argument.
- Every theme passes the AA gate in light and dark before it ships.
- New budgets are never raised; size-sensitive areas keep their measured
  entries in `texuli.budgets.json`.

## Testing

```bash
pnpm vitest run packages/tokens            # 15 test files
pnpm --filter @texuli/tokens typecheck     # tsc -p tsconfig.json
npx biome check packages/tokens            # lint + format
```
