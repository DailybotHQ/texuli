# @texuli/examples

**Private** workspace package of [Texuli](https://texuli.com) (*Small pieces.
Infinite possibilities.*): one registry of named examples, from `@texuli/core`
texels through primitives, `texuli` components and the domain packages,
shared by the fixture app, visual suite, a11y sweep and website. Write an
example once; tests, screenshots and docs all read it. It is not a layer:
`scripts/check-layers.ts` lists it as a consumer, so it may import any
package, and it publishes nothing to npm.

## Status

The registry API ships with entries for every package area (`core-safe-href`,
the primitives, `texuli` components and layouts, blocks, charts, data, media,
chat, editor, forms, canvas, sheets, workflows, slides, player and the Astro
sections). Each area is one directory in `src/` whose `entry.ts` or
`entries.ts` registers its examples; `src/index.ts` imports them all.

## Public API

| Export | Role |
| --- | --- |
| `defineExample(entry)` | Validate metadata, freeze the entry, register by `id` |
| `getExample(id)` | Look up one entry |
| `listExamples(filter?)` | Stable id order; optional `tag` / `component` filters |
| `listExampleIds()` | Ids only |
| `ExampleMeta` / `ExampleEntry` / `ExampleFilter` / `ExampleModule` | Types |
| `<name>Example` (for example `texuliComboboxExample`, `canvasEditorExample`, `workflowsViewerExample`) | Some entries are also exported by name for direct use; see `src/index.ts` |
| `reportBlueprint` / `dashboardBlueprint` / `deckBlueprint` | The player fixture blueprints (fictional data), plain JSON trees; the website builder uses them as starters |

```ts
import { defineExample } from '@texuli/examples';

export const primaryButton = defineExample({
  id: 'texuli-button-primary',
  title: 'Primary button',
  description: 'Default filled button on fictional example.com copy.',
  tags: ['button', 'texuli'],
  component: 'texuli/Button',
  props: ['variant'],
  load: () => import('./demos/ButtonPrimary.svelte'),
});
```

Import the entry module from `src/index.ts` (or a barrel the package loads) so
registration runs when consumers import `@texuli/examples`.

### Metadata rules

- `id`: kebab-case, unique across the registry
- `component`: `package/Export` (for example `core/safeHref`)
- `tags`: unique short tokens
- `load`: returns `import('…/*.svelte')` with a default component export
- Fictional data only (`example.com`); no real PII

## Fixture app

`tests/fixtures/app` imports the registry through `src/examples.ts`:

| URL | Result |
| --- | --- |
| `/?fixture=smoke` | Original smoke fixture (URL policy links) |
| `/?fixture=examples` | Lists every registered example |
| `/?fixture=<id>` | Loads and renders that example |
| `/?fixture=builder`, `/?fixture=builder-draft` | The website builder island, standalone |

## Layout

```text
packages/examples/
├── package.json
├── tsconfig.json
├── README.md
├── src/
│   ├── index.ts              public barrel (imports every area's entries)
│   ├── types.ts
│   ├── registry.ts
│   ├── scoped-theme.ts       scope a library theme mode to one example
│   ├── <area>/               entry.ts or entries.ts (side-effect register) + demo .svelte files
│   └── demos/                SafeHrefDemo.svelte (the core-safe-href demo)
└── tests/
    ├── registry.test.ts               the registry and the public barrel
    ├── registration-side-effects.test.ts
    ├── scoped-theme.test.ts
    └── examples-render.test.ts        every example with a unit check, by area
```

## Testing

```bash
pnpm vitest run packages/examples/tests
pnpm --filter @texuli/examples typecheck
npx biome check packages/examples
```

## Rules

- Private package: not published; consumers are in-repo only.
- A consumer, not a layer: it may import any package, but no package or layer imports it back. The website reads it; it never imports the website.
- No `{@html}`, `eval` or `innerHTML` in demos. Links and images go through `@texuli/core` URL helpers.
- Lazy `load()` so unused demos stay out of first paint.

---

Powered by [Dailybot](https://www.dailybot.com?utm_source=dailybotopensource&utm_medium=texuli-examples).
