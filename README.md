<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="brand/texuli-logo-dark.png">
  <img src="brand/texuli-logo-light.png" alt="Texuli" width="440">
</picture>

# Texuli

### Small pieces. Build anything. Built for the agentic era.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Svelte 5](https://img.shields.io/badge/Svelte_5-FF3E00?logo=svelte&logoColor=white)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](docs/STANDARDS.md)
[![Node.js 24.20+](https://img.shields.io/badge/node-%E2%89%A524.20-339933.svg?logo=node.js&logoColor=white)](package.json)
[![Status: in development](https://img.shields.io/badge/status-in_development-yellow)](docs/RELEASE.md)

**Small pieces. Infinite possibilities.** Texuli is an open-source Svelte 5
component library, built from scratch and owned end to end. Framework-free
*texels* compose into accessible headless primitives; with the OKLCH theme
engine those become styled components and whole interfaces — apps,
dashboards, data views, charts, media, chat, documents and slide decks.
Agents get a catalog whose output renders through a sink-free renderer, so
the same pieces are safe to hand to a machine.

[Quickstart](#60-second-start) ·
[The layers](#small-pieces-all-the-way-down) ·
[What you can build](#what-you-can-build) ·
[Built for agents](#built-for-agents) ·
[Quality](#measured-quality) ·
[Honest boundaries](#honest-boundaries) ·
[Docs](#documentation)

![The Texuli website](docs/assets/screenshots/homepage.png)

> **Status: in development, not released.** The screenshot above is a local
> build of the texuli.com website — texuli.com is not deployed. The package
> names are reserved on npm as `0.1.0-next.0` (dist-tag `next`); the
> workspace packages stay `private: true` and no stable release is out
> ([RELEASE](docs/RELEASE.md)).

</div>

## Why

A UI built by an agent is only as good as the pieces it is allowed to use.
When components come from many places, nobody owns the focus order, the
dismissal behavior, the contrast math or what a link is allowed to point at —
and an agent writing markup into your app inherits every one of those gaps.

Texuli takes the opposite bet: **own every piece.** The overlay engine, the
roving focus, the positioning, the class helpers and the theme engine are
written here, held to the WAI-ARIA Authoring Practices, budgeted per export
subpath, and documented for people and agents alike. Small pieces, verified
one by one — so whatever you or your agents build on top is made of parts
that behave.

## 60-second start

You need Node.js 24.20 or newer and pnpm 11 (through Corepack).

```bash
git clone https://github.com/DailybotHQ/texuli
cd texuli
corepack enable && pnpm install
```

Then:

```bash
pnpm check     # lint, typecheck, unit and component tests, layer guard
pnpm dev       # the texuli.com website → http://localhost:4321
```

The website is the whole product surface: the docs, a live demo of every
component, 200+ themes to explore, and the live builder that composes
interfaces from the catalog.

## Small pieces, all the way down

Every layer is a package with one job, and every dependency points down only
([ARCHITECTURE](docs/ARCHITECTURE.md)).

| Layer | Package | The small pieces |
| --- | --- | --- |
| L0 | [`@texuli/core`](packages/core/README.md) | **Texels**: framework-free behavior and policy — the overlay engine, roving focus, positioning, ids, the two-tier URL policy |
| L1 | [`@texuli/primitives`](packages/primitives/README.md) | 41 owned headless primitives, one subpath each, held to the APG patterns |
| L2 | [`@texuli/tokens`](packages/tokens/README.md) | The OKLCH theme engine, the `--tx-*` token contract, 200+ themes, compiled CSS |
| L3 | [`texuli`](packages/texuli/README.md) | Styled components, icons, layouts and app shells |
| L4 | [`@texuli/data`](packages/data/README.md) · [`@texuli/charts`](packages/charts/README.md) · [`@texuli/media`](packages/media/README.md) · [`@texuli/chat`](packages/chat/README.md) | Domain packages: data views, every chart family, media, chat |
| L5 | [`@texuli/blocks`](packages/blocks/README.md) | Content blocks for pages, documents and slides |
| L6 | [`@texuli/catalog`](packages/catalog/README.md) | The agent catalog and its sink-free renderer |
| L7 | [`@texuli/tools`](packages/tools/README.md) | The copy-in CLI, LLM docs, the A2UI adapter, custom elements, the MCP server |

The layer graph is enforced, not aspirational: `pnpm check:layers` fails any
import that points up.

## What you can build

| Family | What you get |
| --- | --- |
| **Components** | Buttons, fields, choices, overlays, navigation, tables of content — styled components and layouts that theme through the `--tx-*` contract |
| **Data** | Grid, tree, board, calendar, timeline, map and files: dense product surfaces with keyboard access |
| **Charts** | Every chart family on Texuli's own chart math — one subpath each, no third-party chart code |
| **Media** | Images, galleries, video, audio and editors, with compositions that keep their layout while media resolves |
| **Chat** | Threads, messages and composers for conversational products |
| **Documents & decks** | Content blocks that compose into pages, long documents and slide decks with a full keyboard map |

Every example in [`@texuli/examples`](packages/examples/README.md) is a
registered fixture: it runs in unit tests, visual baselines, accessibility
sweeps and the website.

## Built for agents

Texuli is designed to be built *by* agents as much as by people.

| Surface | What it gives an agent | Read |
| --- | --- | --- |
| **Agent skill** | A distributable skill pack (`skills/texuli/`) that installs into Claude Code, Codex, Cursor and other hosts — pinned, checksum-verified, checked by `pnpm check:skill` | [Skill](skills/texuli/SKILL.md) |
| **Agent catalog** | A declarative catalog of components and props. An agent emits catalog nodes; the renderer turns them into real components | [Catalog](packages/catalog/README.md) |
| **No HTML sinks** | Never `{@html}`, `innerHTML`, `eval` or `new Function` on props, content or agent output. Structure is trusted; markup never is | [Security](docs/SECURITY.md) |
| **Two-tier URL policy** | Every link and media source passes `safeHref` / `safeMediaSrc`: `developer` for app-authored props, `untrusted` for agent and user content | [URL policy](docs/SECURITY.md) |
| **MCP server** | A local stdio MCP server over the tools package — no hosted endpoint | [Tools](packages/tools/README.md) |
| **LLM docs & A2UI** | Docs generated for LLM consumption and an A2UI adapter for agent-to-UI flows | [Tools](packages/tools/README.md) |

Inside the repository, [AGENTS.md](AGENTS.md) is the single entry point for
every coding agent (CLAUDE.md links to it): the rules, the doc index, and
every verified command.

## Measured quality

- **4,610 unit and component tests** at the first-release sweep, plus a
  behavior suite per primitive on Chromium, WebKit and a Pixel 7 viewport
  ([TESTING_GUIDE](docs/TESTING_GUIDE.md)).
- **axe with zero exclusions** in light, dark and forced colors, with
  keyboard walks, RTL layouts and reduced motion on every example
  ([ACCESSIBILITY](docs/ACCESSIBILITY.md)).
- **A gzip budget for every export subpath** (`pnpm size`), and visual
  baselines in light/dark on desktop and mobile ([PERFORMANCE](docs/PERFORMANCE.md)).
- **Strict, erasable TypeScript** and Biome across the workspace; packages
  export their TS source.
- **A threat model that is tested, not just written** — hostile inputs ship
  as fixtures in the suites ([SECURITY](docs/SECURITY.md)).

## Honest boundaries

- **Not released yet.** The workspace packages are `private: true`; the npm
  names are reserved as `0.1.0-next.0` (dist-tag `next`) and installing from
  npm is not supported until the release waves run
  ([RELEASE](docs/RELEASE.md)).
- **texuli.com is not deployed.** Run it locally with `pnpm dev`.
- **Web first.** A Kotlin Multiplatform / Compose port of the theme system
  and text primitives lives in [`native/`](native/README.md); it is early —
  media paints a placeholder until a source resolves under the untrusted
  policy.
- **Verified where it counts, not everywhere.** See what the gates do and do
  not cover in [TESTING_GUIDE](docs/TESTING_GUIDE.md).

## Commands

```bash
pnpm install | dev | build | lint | typecheck | test | check
pnpm test:e2e | visual | size | verify:packages | check:skill | test:perf
```

Every root and package script, with scoped variants, is in
[DEVELOPMENT_COMMANDS](docs/DEVELOPMENT_COMMANDS.md). Browser checks need
Playwright browsers once (`pnpm test:e2e:install`).

## Documentation

| Understand | Build | Verify | Ship |
| --- | --- | --- | --- |
| [Product spec](docs/PRODUCT_SPEC.md) | [Architecture](docs/ARCHITECTURE.md) | [Testing guide](docs/TESTING_GUIDE.md) | [Release](docs/RELEASE.md) |
| [Decisions](docs/DECISIONS.md) | [Standards](docs/STANDARDS.md) | [Accessibility](docs/ACCESSIBILITY.md) | [Security](docs/SECURITY.md) |
| [Agent onboarding](docs/AI_AGENT_ONBOARDING.md) | [Development commands](docs/DEVELOPMENT_COMMANDS.md) | [Performance](docs/PERFORMANCE.md) | [Quality reports](docs/README.md#quality-reports-docsquality) |

The full index is [docs/README.md](docs/README.md). Every package also has
its own `README.md` describing every subpath.

## Contributing

Read [AGENTS.md](AGENTS.md) first — it holds the rules every contributor
(human or agent) works under: English only, Conventional Commits with exact
paths, owned primitives, no HTML sinks, and validation that follows the
touched surface. Before a pull request:

```bash
pnpm check                              # lint + typecheck + unit and component tests
pnpm test:e2e                           # browser checks on the touched specs
```

The source-to-test map for choosing the right gates is in
[TESTING_GUIDE](docs/TESTING_GUIDE.md).

## License

[MIT](LICENSE) © Dailybot, Inc.
