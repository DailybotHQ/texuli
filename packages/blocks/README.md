# @texuli/blocks

**Layer L5: content blocks.** The closed content vocabulary for pages,
documents and slides: schema-validated block types, framework-free family
engines, Svelte 5 renderers, the untrusted-input guard, the closed formula
AST and catalog metadata. Private workspace package (`"private": true`);
Texuli is in development, and nothing is published or deployed.

## What exists today

Every family below is implemented, exported and tested. The root barrel
`src/index.ts` re-exports the core vocabulary plus, for every family, its
`*_BLOCK_TYPES` list, `check*Block` authoring guard, `is*FamilyBlock`
narrower and `load*Family()` renderers loader. Engines stay behind their
`/engine` subpaths, and the Svelte renderers load through the
`load*Family()` loaders.

| Family | Block types | Subpaths | Doc |
| --- | --- | --- | --- |
| Core vocabulary | schemas, limits, safety, untrusted guard, text helpers, catalog (see below) | `@texuli/blocks`, `@texuli/blocks/core` | — |
| Formula | closed calculator engine: parser, AST, evaluator, limits, diagnostics | `@texuli/blocks/formula` | [formula](docs/formula.md) |
| Text | `heading`, `text`, `list`, `quote`, `callout` | `@texuli/blocks/text`, `@texuli/blocks/text/engine`, `@texuli/blocks/text/markdown`, `@texuli/blocks/text/renderers` | [text](docs/text.md) |
| Structure | `columns`, `grid`, `tabs`, `accordion`, `cards`, `divider`, `cta` | `@texuli/blocks/structure`, `@texuli/blocks/structure/engine`, `@texuli/blocks/structure/renderers` | [structure](docs/structure.md) |
| Media | `image`, `figure`, `video`, `gallery` | `@texuli/blocks/media`, `@texuli/blocks/media/engine`, `@texuli/blocks/media/renderers` | [media](docs/media.md) |
| Embed | `embed-app`, `link-preview` | `@texuli/blocks/embed`, `@texuli/blocks/embed/engine`, `@texuli/blocks/embed/renderers` | [embed](docs/embed.md) |
| Interactive | `poll`, `quiz`, `calculator`, `checklist` | `@texuli/blocks/interactive`, `@texuli/blocks/interactive/engine`, `@texuli/blocks/interactive/renderers` | [interactive](docs/interactive.md) |
| Data | `table`, `stat`, `kpi`, `chart` — chart kinds: `line`, `area`, `bar`, `stacked-bar`, `combo`, `heatmap`, `scatter` | `@texuli/blocks/data`, `@texuli/blocks/data/engine`, `@texuli/blocks/data/renderers` | [blocks-data](docs/blocks-data.md) |
| Map | `map` — places and an optional route on a basemap | `@texuli/blocks/map`, `@texuli/blocks/map/engine`, `@texuli/blocks/map/renderers` | [map](docs/map.md) |
| Diagram | `flow`, `tree`, `board`, `terminal` diagrams from validated data | `@texuli/blocks/diagram`, `@texuli/blocks/diagram/engine`, `@texuli/blocks/diagram/renderers` | — |
| Code | `code` | `@texuli/blocks/code`, `@texuli/blocks/code/engine`, `@texuli/blocks/code/tokenizer`, `@texuli/blocks/code/renderers` | [code](docs/code.md) |

`docs/` has one page per area; each page names its imports and limits.

## Core vocabulary and guard

The core engine (root and `@texuli/blocks/core`) exports:

| Area | Exports |
| --- | --- |
| Limits | `BLOCK_LIMITS` |
| Safety | `isUnsafeTextCharacter`, `classifyMediaSource`, `hasUnsafeText` |
| Schemas | `safeParseBlocks`, `safeParseBlock`, `BLOCK_TYPES`, the block types |
| Untrusted | `parseUntrustedBlocks` |
| Formula | `parseFormula`, `evaluateFormula`, `formatFormulaValue`, `FORMULA_LIMITS` |
| Catalog | `BLOCK_CATALOG`, `getCatalogEntry`, `validateBlocksForAuthoring` |
| Text | `walkBlocks`, `blockText`, `headingOutline`, `slugifyHeading` |

## Safety rules

- No zod: owned validators only (runtime allowlists).
- No HTML sinks; every href passes `safeHref` from `@texuli/core/url-policy`
  at the `untrusted` tier (action, CTA, link preview).
- Formulas are closed JSON ASTs — parsed, evaluated and formatted, never
  executed as code.
- Trojan Source attacks and bidi controls are stripped or refused.
- Fictional example data only (`example.com`).

## Layout

```text
packages/blocks/
├── docs/            one page per area (blocks-data, code, embed, formula,
│                    interactive, map, media, structure, text)
├── src/
│   ├── index.ts     root barrel: core plus per-family types, guards, loaders
│   ├── core/        vocabulary, schemas, limits, safety, untrusted, text,
│   │                catalog, formula
│   └── <family>/    text, structure, media, embed, interactive, data, map,
│                    diagram, code — engine + renderers per family; text
│                    adds markdown, code adds the tokenizer
└── tests/           one suite per family plus core, engine-subpaths,
                     formula-subpath, chart-parity, readme-subpaths
```

## Testing

```bash
pnpm vitest run packages/blocks
pnpm --filter @texuli/blocks typecheck
npx biome check packages/blocks
```

`tests/readme-subpaths.test.ts` pins this README to the package manifest:
every export subpath and every docs page must stay documented.
