# @texuli/astro

**Layer L8: adapters.** Astro 7 integration, token stylesheet, static content components, and a closed
content-block parser for Texuli sites. Published to npm as `0.1.0-next.1` under the `next`
dist-tag (by CI, with provenance); no stable release (`latest` is reserved
for 1.0.0), so install it with `@next`. The workspace package stays
`"private": true`.

## Install and configure

Add the Astro Svelte integration when the site uses Svelte islands, then add
Texuli's integration to the Astro config:

```ts
import svelte from '@astrojs/svelte';
import { defineConfig } from 'astro/config';
import { texuli } from '@texuli/astro';

export default defineConfig({
  integrations: [svelte(), texuli({ namespace: 'docs' })],
});
```

Import the Texuli stylesheet once from a site-owned global stylesheet:

```css
@import '@texuli/astro/styles.css';
```

Use the same `namespace` in Texuli's appearance writer and the integration so
the early bootstrap reads the cache entry that the site writes. The default
namespace is `site`. See [integration setup and CSP](docs/integration.md) and
[stylesheet contents](docs/styles.md).

## Entry points

| Import | Purpose | Documentation |
| --- | --- | --- |
| `@texuli/astro` | `texuli`, `themeBootstrapScript`, `TexuliAstroOptions`, density/radius types, and `parseTexuliBlocks` | [Integration](docs/integration.md), [content parser](docs/content.md) |
| `@texuli/astro/integration` | Integration and theme-bootstrap API | [Integration](docs/integration.md) |
| `@texuli/astro/content` | Closed-schema content-block parser | [Content parser](docs/content.md) |
| `@texuli/astro/site` | Validated site model, page metadata and sitemap for Protoyard static sites | [Site model](docs/site.md) |
| `@texuli/astro/styles.css` | Token base, forced-colors rules, density/radius variants, and print rules | [Stylesheet](docs/styles.md) |
| `@texuli/astro/layouts/ContentLayout` | Semantic HTML document shell | [ContentLayout](docs/layouts-content-layout.md) |
| `@texuli/astro/sections/Hero` | Static hero section | [Hero](docs/sections-hero.md) |
| `@texuli/astro/sections/Section` | Static width-constrained section | [Section](docs/sections-section.md) |

The package peers on Astro Svelte integration and Svelte 5 for sites that use
Svelte islands. The layout and section components in this package render static
HTML and do not hydrate themselves.

## Components and content

```astro
---
import '@texuli/astro/styles.css';
import ContentLayout from '@texuli/astro/layouts/ContentLayout';
import Hero from '@texuli/astro/sections/Hero';
import Section from '@texuli/astro/sections/Section';
---

<ContentLayout title="Stories" description="A collection of stories.">
  <Hero title="Stories" align="center">
    <a href="https://example.com/stories">Browse stories</a>
  </Hero>
  <Section width="reading">
    <p>Static Astro content.</p>
  </Section>
</ContentLayout>
```

For structured content, `parseTexuliBlocks(value)` validates unknown input
against `@texuli/blocks` and returns either the typed blocks or schema issues.
It does not render HTML or interpret unknown block types. See [content
parsing](docs/content.md). For whole-site definitions — pages, navigation,
canonical metadata and a sitemap — `defineSite` validates the export and
returns the frozen model the layouts consume. See the [site
model](docs/site.md). The Protoyard `site` export that fills this model is
planned on the Protoyard side.

## Fixtures and checks

The packed consumer fixtures live under `tests/consumers/fixtures/`:

- `astro-plain` installs the packed Astro package, uses this integration and
  stylesheet, renders the layout and sections, and includes a Svelte smoke
  island.
- `astro-tailwind` checks the Astro/Tailwind consumer path with token CSS; it
  does not install `@texuli/astro`.

Package behavior is covered by `packages/astro/tests/astro.test.ts`
(content blocks, the theme integration, the layout contract and the site
model). The consumer harness builds and
serves the packed fixtures in `tests/consumers/consumers.spec.ts`.

```bash
pnpm vitest run packages/astro
pnpm --filter @texuli/astro typecheck
npx biome check packages/astro
pnpm verify:packages --filter packages/astro
```

The package source and exports are listed in [`package.json`](package.json).
