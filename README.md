<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="brand/texuli-logo-dark.png">
    <img src="brand/texuli-logo-light.png" alt="Texuli" width="320">
  </picture>
</p>

# Texuli

**Small pieces. Infinite possibilities.**

Texuli is a Svelte 5 component library, built from scratch, for people and
for agents. It is made of small pieces it owns end to end:
- **Texels** are framework-free behavior and policy: focus, dismissal,
  positioning, ids, the URL policy.
- Texels compose into headless **primitives** held to the WAI-ARIA APG
  patterns.
- Primitives, with an OKLCH **theme engine**, become styled **components**
  and layouts.
- Components compose into complete **interfaces**: apps, dashboards, data
  views, charts, media, chat and documents.
- An **agent catalog** and its renderer with no HTML sinks let agents emit
  interfaces safely.

> **Status: in development, not released.** Nothing is on npm yet (packages
> are `private: true`), and texuli.com is not deployed.

## What's inside

| Package | What it is |
| --- | --- |
| [`@texuli/core`](packages/core/README.md) | Texels: framework-free behavior and policy (overlay engine, roving focus, positioning, URL policy…) |
| [`@texuli/primitives`](packages/primitives/README.md) | 41 owned, headless primitives, one subpath each |
| [`@texuli/tokens`](packages/tokens/README.md) | The OKLCH theme engine, the `--tx-*` token contract, 200+ themes, compiled CSS |
| [`texuli`](packages/texuli/README.md) | Styled components, icons, layouts and app shells |
| [`@texuli/data`](packages/data/README.md) · [`@texuli/charts`](packages/charts/README.md) · [`@texuli/media`](packages/media/README.md) · [`@texuli/chat`](packages/chat/README.md) | Data views, every chart family, media, chat |
| [`@texuli/blocks`](packages/blocks/README.md) | Content blocks for pages, documents and slides |
| [`@texuli/catalog`](packages/catalog/README.md) | The agent catalog and the sink-free renderer |
| [`@texuli/tools`](packages/tools/README.md) | Copy-in CLI, LLM docs, A2UI adapter, custom elements, the MCP server |
| [`apps/website`](apps/website/README.md) | texuli.com: docs, live demos, themes, playground |
| [`skills/texuli`](skills/texuli/SKILL.md) | The agent skill for building with Texuli |

Dependencies point down only (core → primitives → tokens → texuli →
domain packages → blocks → catalog → tools). See
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Principles

- **Owned.** Every primitive, the positioning, the class helpers and the
  theme engine are built here. No component library underneath.
- **Accessible.** Every gate runs axe with zero exclusions in light, dark and
  forced colors, plus keyboard walks, RTL and reduced motion. There is a
  behavior suite per primitive on Chromium, WebKit and Pixel 7.
- **Safe for agent output.** No HTML sinks, and a two-tier URL policy on
  every link and media source.
- **Small.** Every export subpath has a gzip budget (`pnpm size`).

## Develop

```bash
pnpm install
pnpm check     # lint, typecheck, tests and the layer guard
pnpm dev       # texuli.com on http://localhost:4321
pnpm build     # build the website
```

Browser checks, visuals, sizes and packaging are in
[docs/TESTING_GUIDE.md](docs/TESTING_GUIDE.md). Every command is in
[docs/DEVELOPMENT_COMMANDS.md](docs/DEVELOPMENT_COMMANDS.md), and every
guide is in [docs/README.md](docs/README.md). Agents start at
[AGENTS.md](AGENTS.md).

## License

MIT © Dailybot, Inc.
