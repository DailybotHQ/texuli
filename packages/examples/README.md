# @texuli/examples

**Private** workspace package: one registry of named component examples shared by
the fixture app, visual suite, a11y sweep and website. Write an example once;
tests, screenshots and docs all read it.

## Status

The registry API and a seed example (`core-safe-href` over `@texuli/core`
`safeHref`) ship. Component packages add entry modules as they land.

## Public API

| Export | Role |
| --- | --- |
| `defineExample(entry)` | Validate metadata, freeze the entry, register by `id` |
| `getExample(id)` | Look up one entry |
| `listExamples(filter?)` | Stable id order; optional `tag` / `component` filters |
| `listExampleIds()` | Ids only |
| `ExampleMeta` / `ExampleEntry` / `ExampleFilter` | Types |
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

## Layout

```text
packages/examples/
├── package.json
├── tsconfig.json
├── README.md
├── src/
│   ├── index.ts              public barrel (imports entries)
│   ├── types.ts
│   ├── registry.ts
│   ├── entries/              one module per example (side-effect register)
│   └── demos/                Svelte demo components
└── tests/
    └── registry.test.ts
```

## Testing

```bash
pnpm vitest run packages/examples/tests
pnpm --filter @texuli/examples typecheck
npx biome check packages/examples
```

## Rules

- Private package: not published; consumers are in-repo only.
- Dependencies point down only (`core`, later styled packages). No website import reverse.
- No `{@html}`, `eval` or `innerHTML` in demos. Links and images go through `@texuli/core` URL helpers.
- Lazy `load()` so unused demos stay out of first paint.
