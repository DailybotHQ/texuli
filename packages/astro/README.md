# @texuli/astro

The Astro integration for [Texuli](https://texuli.com), an MIT-licensed
Svelte 5 component library by Dailybot, Inc. (*Small pieces. Infinite
possibilities.*). Add one integration to an Astro 7 site to get Texuli's
design tokens and a no-flash light and dark bootstrap. The package also
provides static layout and section components that ship no JavaScript, a
closed-schema parser for structured content blocks, and a validated site
model for pages, navigation, metadata and a sitemap. Use Texuli's Svelte
components as islands wherever a page needs interaction.

> **Status: 0.x release.** Texuli is in development. The packages are
> published to npm as `0.8.0`, a pre-1.0 release (1.0.0 will be the first
> stable release). Under 0.x, a new minor (`0.9.0`) may contain breaking
> changes, so pin the exact version or use `^0.8.0`, which accepts only 0.8.x.

## Install

```bash
npm install @texuli/astro @astrojs/svelte svelte
```

`@astrojs/svelte` (`^9.1.0`) and Svelte 5 (`^5.57.2`) are peer
dependencies, for sites that use Svelte islands. Astro 7 is installed as a
dependency.

Import the Texuli stylesheet once, from a site-owned global stylesheet:

```css
@import '@texuli/astro/styles.css';
```

## Quick start

Add the integration to `astro.config.mjs`:

```ts
import svelte from '@astrojs/svelte';
import { defineConfig } from 'astro/config';
import { texuli } from '@texuli/astro';

export default defineConfig({
  integrations: [svelte(), texuli({ namespace: 'docs' })],
});
```

Use the same `namespace` in the appearance switcher
(`@texuli/astro/appearance`) so the early bootstrap reads the appearance the
site stores. The default namespace is
`site`.

Then build pages from the static components:

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

## What's inside

| Import | What it does |
| --- | --- |
| `@texuli/astro` | `texuli`, `themeBootstrapScript`, `parseTexuliBlocks` and `defineSite`, with their types |
| `@texuli/astro/integration` | The integration and the theme bootstrap (namespace, fallback mode, density and radius) |
| `@texuli/astro/appearance` | `AppearanceSwitcher`: a light, dark or system island that persists per site in the bootstrap's appearance cache, with its framework-free model |
| `@texuli/astro/content` | `parseTexuliBlocks`: validates unknown input against the `@texuli/blocks` schemas |
| `@texuli/astro/site` | `defineSite` and helpers: a validated, frozen site model with page metadata and a sitemap |
| `@texuli/astro/styles.css` | Token base, forced-colors rules, density and radius variants, and print rules |
| `@texuli/astro/layouts/ContentLayout` | A semantic HTML document shell |
| `@texuli/astro/sections/Hero` | A static hero section |
| `@texuli/astro/sections/Section` | A static, width-constrained section |

## New in 0.6.0

`AppearanceSwitcher` `size="sm"`, and same-tab sync between switchers of
one namespace (`APPEARANCE_CHANGE_EVENT`, G74), ship in `0.6.0`; the
`0.5.0` release predates them
([appearance](https://github.com/DailybotHQ/texuli/blob/main/packages/astro/docs/appearance.md)).

## New in 0.5.0

`@texuli/astro/appearance` (`AppearanceSwitcher`) and `ContentLayout`
children, host TOC entries, TOC levels and preserved heading ids ship in `0.5.0`;
the `0.4.0` release predates them
([appearance](https://github.com/DailybotHQ/texuli/blob/main/packages/astro/docs/appearance.md)).

## Key guarantees

- **Static by default.** The layout and section components render HTML
  and never hydrate themselves. The appearance switcher is the one island,
  hydrated only where a page places it.
- **Closed content schema.** `parseTexuliBlocks` returns typed blocks or
  schema issues. It renders no HTML and does not interpret unknown block
  types.
- **Validated site model.** `defineSite` checks the whole definition
  against a closed schema, including the site URL against the Texuli URL
  policy, and throws a `TypeError` naming the failing field.
- **CSP-aware bootstrap.** The inline theme bootstrap is deterministic. The
  package writes no CSP headers; a site using hash-based CSP computes the
  hash of `themeBootstrapScript(options)`, or sets `bootstrap: 'manual'`
  and places the script itself.

## Documentation

- Website: [texuli.com](https://texuli.com) and the
  [getting started guide](https://texuli.com/guides/getting-started/)
- Appearance switcher: [appearance.md](https://github.com/DailybotHQ/texuli/blob/main/packages/astro/docs/appearance.md)
- Integration setup and CSP: [integration.md](https://github.com/DailybotHQ/texuli/blob/main/packages/astro/docs/integration.md)
- Stylesheet contents: [styles.md](https://github.com/DailybotHQ/texuli/blob/main/packages/astro/docs/styles.md)
- Content parsing: [content.md](https://github.com/DailybotHQ/texuli/blob/main/packages/astro/docs/content.md)
- Site model: [site.md](https://github.com/DailybotHQ/texuli/blob/main/packages/astro/docs/site.md)
- Components: [ContentLayout](https://github.com/DailybotHQ/texuli/blob/main/packages/astro/docs/layouts-content-layout.md), [Hero](https://github.com/DailybotHQ/texuli/blob/main/packages/astro/docs/sections-hero.md), [Section](https://github.com/DailybotHQ/texuli/blob/main/packages/astro/docs/sections-section.md)

## Related packages

- [`texuli`](https://www.npmjs.com/package/texuli): the styled Svelte 5 components to use as islands.
- [`@texuli/tokens`](https://www.npmjs.com/package/@texuli/tokens): the theme engine and design tokens.
- [`@texuli/blocks`](https://www.npmjs.com/package/@texuli/blocks): the content blocks `parseTexuliBlocks` validates.

## Contributing

Source, issues and contribution guidelines live at
[github.com/DailybotHQ/texuli](https://github.com/DailybotHQ/texuli). Report
bugs at [github.com/DailybotHQ/texuli/issues](https://github.com/DailybotHQ/texuli/issues).

## License

MIT © Dailybot, Inc. Powered by [Dailybot](https://www.dailybot.com?utm_source=dailybotopensource&utm_medium=texuli-astro).
