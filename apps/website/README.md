# @texuli/website

**texuli.com**: documentation, the component catalog and live examples.
Astro 7 with the `@astrojs/svelte` integration, static output. Private
workspace package. Cloudflare Pages deploys it from `main` (see
[`docs/CI.md`](../../docs/CI.md)); `site` in `astro.config.mjs` is
`https://texuli.com`. Root `functions/` holds the Pages Functions
middleware and the analytics proxy.

## What exists today

A multi-page static site: 74 `.astro` files under `src/pages/` — the landing,
the native landing and the architecture page,
guides, foundation, component pages, the primitives, charts, media, blocks
and agents pages, the slides, editor, drag, motion, documents, workflows,
forms, canvas, sheets, dashboards and multi-target output showcases, the What’s new hub, live generation, component and theme galleries, live examples, the
playground, the design systems hub, the design system studio and the theme switcher, the color explorer, search, an
agent-chat demo, the builder, showcase, brand, skill and changelog pages,
and the evidence and perf reports. Each area has a design doc in
[`docs/`](docs/) (`site-*.md`); the index is below.

| File | What it is |
| --- | --- |
| `src/pages/index.astro` | The illustrated landing (PLAN_012): ten static `sections/home/*` bands (hero, pitch, five story bands, proof, quickstart, final call to action) between the landing header and the footer ([site-landing.md](docs/site-landing.md)) |
| `src/layouts/BaseLayout.astro` | The layout behind content pages: the docs shell with the left sidebar (`SiteSidebar`), the utility header and the phone drawer; `variant="landing"` drives the home |
| `src/components/component-pages/load-manifests.ts` | Component pages resolve against the workspace packages' real exports, so a broken component breaks the build |
| `src/components/TexelsDiagram.astro` | The texels → Texuli → interfaces diagram (decorative grids marked `aria-hidden`) |
| `astro.config.mjs` | `site: 'https://texuli.com'`, `integrations: [svelte(), copyPageIntegration(), skillPackIntegration(), seoIntegration(), cspIntegration()]` |
| `src/components/security/csp.ts` | The build-time CSP integration: per-route hash policies written to `dist/_headers` (plus `Vary: Accept` on negotiable docs pages) and `dist/csp-manifest.json` |
| `tests/csp-coverage.mts` | The generation-side proof: every built page's inline scripts, styles and style attributes are covered by its policy in both artifacts (`pnpm --filter @texuli/website check:csp`) |
| `tsconfig.json` | Extends `astro/tsconfigs/strict` |

Pages are static by default; pages with interactive examples hydrate Svelte
islands (`client:load`, `client:visible`, …).

## Design notes (`docs/`)

| Area | Note |
| --- | --- |
| Landing system (`/`, section pattern) | [site-landing.md](docs/site-landing.md) |
| Illustrations: the texel style, slots, sizes, dropping in a file | [ILLUSTRATIONS.md](docs/ILLUSTRATIONS.md) |
| Native landing (`/native/`) | [site-native.md](docs/site-native.md) |
| Architecture page (`/web-and-native/`) | [site-architecture.md](docs/site-architecture.md) |
| Sub-site IA: routes, doors, breadcrumbs, per-route metadata | [site-subsite.md](docs/site-subsite.md) |
| Information architecture: landing vs docs shell | [site-ia.md](docs/site-ia.md) |
| Sidebar navigation and docs layout | [site-sidebar-nav.md](docs/site-sidebar-nav.md) |
| Docs shell demo | [site-docs-shell.md](docs/site-docs-shell.md) |
| Foundation, brand, visual polish | [site-foundation.md](docs/site-foundation.md) · [site-brand.md](docs/site-brand.md) · [site-visual.md](docs/site-visual.md) |
| Analytics (Umami, default-off, owner checkpoint) | [site-analytics.md](docs/site-analytics.md) |
| Agent surfaces (llms.txt, Markdown twins, `.well-known`, middleware) | [site-aeo.md](docs/site-aeo.md) |
| Public JSON API, `/openapi.json`, rate limits, the `/developers/` portal | [site-api.md](docs/site-api.md) |
| The `/mcp-server/` page (Texuli MCP, generated from the registry) | [site-mcp-server.md](docs/site-mcp-server.md) |
| The `/tokens/` and `/tokens/components/` token contract v2 reference | [site-tokens.md](docs/site-tokens.md) |
| SEO, structured data, social images, sitemap, robots | [site-seo.md](docs/site-seo.md) |
| Content Security Policy | [site-csp.md](docs/site-csp.md) |
| Performance budgets | [site-perf.md](docs/site-perf.md) |
| Search | [site-search.md](docs/site-search.md) |
| Guides | [site-guides.md](docs/site-guides.md) |
| Component and primitive pages | [site-component-pages.md](docs/site-component-pages.md) · [site-live-components.md](docs/site-live-components.md) · [site-primitives-page.md](docs/site-primitives-page.md) · [site-live-primitives.md](docs/site-live-primitives.md) · [site-evidence.md](docs/site-evidence.md) |
| Area pages | [site-blocks-page.md](docs/site-blocks-page.md) · [site-charts-page.md](docs/site-charts-page.md) · [site-media-page.md](docs/site-media-page.md) · [site-slides-page.md](docs/site-slides-page.md) · [site-editor.md](docs/site-editor.md) · [site-motion.md](docs/site-motion.md) · [site-documents.md](docs/site-documents.md) · [site-forms.md](docs/site-forms.md) · [site-canvas.md](docs/site-canvas.md) · [site-sheets.md](docs/site-sheets.md) · [site-dashboards.md](docs/site-dashboards.md) · [site-output.md](docs/site-output.md) · [site-whats-new.md](docs/site-whats-new.md) |
| Galleries, examples, showcase | [site-gallery-components.md](docs/site-gallery-components.md) · [site-gallery-themes.md](docs/site-gallery-themes.md) · [site-examples.md](docs/site-examples.md) · [site-showcase.md](docs/site-showcase.md) |
| Design systems (`/design-systems/`) | [site-design-systems.md](docs/site-design-systems.md) |
| Themes | [site-theme-switcher.md](docs/site-theme-switcher.md) · [site-theme-studio.md](docs/site-theme-studio.md) · [site-theme-swatches.md](docs/site-theme-swatches.md) · [site-color-explorer.md](docs/site-color-explorer.md) |
| Theme sweep tooling | [site-theme-sweep.md](docs/site-theme-sweep.md) |
| Agents, playground, builder, skill | [site-agents-page.md](docs/site-agents-page.md) · [site-agent-chat.md](docs/site-agent-chat.md) · [site-playground.md](docs/site-playground.md) · [site-builder.md](docs/site-builder.md) · [site-skill.md](docs/site-skill.md) |

## Planned

- **Analytics are not provisioned.** `PUBLIC_UMAMI_WEBSITE_ID` is not set,
  so the deployed site sends nothing; turning it on is the owner's
  checkpoint ([site-analytics.md](docs/site-analytics.md)).
- **No recorded edge run.** The Pages middleware is unit-tested only;
  whether Functions run for the texuli.com project is an open owner
  question ([site-aeo.md](docs/site-aeo.md)).

## Commands

```bash
pnpm dev                                  # astro dev at http://localhost:4321
pnpm build                                # astro check && astro build → apps/website/dist
pnpm --filter @texuli/website check:csp   # prove the built CSP covers every page (after build)
pnpm preview                              # serve the last build
pnpm --filter @texuli/website typecheck   # astro check only (about 3 s)
npx biome check apps/website              # lint + format
```

From a non-interactive shell (an agent), `pnpm dev` and `pnpm preview`
return immediately and leave the server running in the background; stop it
with `pnpm --filter @texuli/website exec astro dev stop` (or `preview stop`).

## Rules

- Static by default: a page ships JavaScript only when it has an interactive
  example.
- Colors come from the custom properties on `:root`, with a
  `prefers-color-scheme: dark` variant.
- Logical CSS properties (`max-inline-size`, `margin-inline`,
  `margin-block-start`).
- No `set:html` or `{@html}` on content; links rendered from data pass
  `safeHref` from `@texuli/core`.

## Testing

Unit tests live in `apps/website/tests/*.test.ts` and run under the root
Vitest config (`pnpm vitest run apps/website`): content modules, the
analytics and edge logic, polish and honesty guards. The other gates are
`pnpm build`, which runs `astro check` and `astro build`, and the per-area
Playwright specs in `tests/e2e/site-*.spec.ts` (plus `site-aeo`,
`analytics` and `analytics-fixture`). To add a page, follow
[`.agents/skills/add-website-page/SKILL.md`](../../.agents/skills/add-website-page/SKILL.md).

---

Powered by [Dailybot](https://www.dailybot.com?utm_source=dailybotopensource&utm_medium=texuli-website).
