# @texuli/website

The future **texuli.com**: documentation, the component catalog and live
examples. Astro 7 with the `@astrojs/svelte` integration, static output.
Private workspace package. **Not deployed**; `site` in `astro.config.mjs`
is set to `https://texuli.com` for canonical URLs only.

## What exists today

A multi-page static site: 52 `.astro` pages under `src/pages/` — the landing,
guides, foundation, component pages, the primitives, charts, media, blocks
and agents pages, component and theme galleries, live examples, the
playground, the theme studio and switcher, the color explorer, search, an
agent-chat demo, the builder, showcase, brand, skill and changelog pages,
and the evidence and perf reports. Each area has a design doc in
[`docs/`](docs/) (`site-*.md`).

| File | What it is |
| --- | --- |
| `src/pages/index.astro` | The landing: site header, hero with live widget islands (`HeroMoments`), feature cards, an agents strip with a playground island, and the footer |
| `src/layouts/BaseLayout.astro` | The layout behind content pages: the docs shell with the left sidebar (`SiteSidebar`), the utility header and the phone drawer; `variant="landing"` drives the home |
| `src/components/component-pages/load-manifests.ts` | Component pages resolve against the workspace packages' real exports, so a broken component breaks the build |
| `src/components/TexelsDiagram.astro` | The texels → Texuli → interfaces diagram (decorative grids marked `aria-hidden`) |
| `astro.config.mjs` | `site: 'https://texuli.com'`, `integrations: [svelte(), copyPageIntegration(), seoIntegration(), cspIntegration()]` |
| `src/components/security/csp.ts` | The build-time CSP integration: per-route hash policies written to `dist/_headers` and `dist/csp-manifest.json` |
| `tests/csp-coverage.mts` | The generation-side proof: every built page's inline scripts, styles and style attributes are covered by its policy in both artifacts (`pnpm --filter @texuli/website check:csp`) |
| `tsconfig.json` | Extends `astro/tsconfigs/strict` |

Pages are static by default; pages with interactive examples hydrate Svelte
islands (`client:load`, `client:visible`, …).

## Planned

Deploying texuli.com. The site builds and is gated locally; no public URL
serves it.

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

There are no unit tests for the website (Vitest collects `packages/*/tests`
and `scripts/tests` only). The gates are `pnpm build`, which runs
`astro check` and `astro build`, and the per-area Playwright specs in
`tests/e2e/site-*.spec.ts`. To add a page, follow
[`.agents/skills/add-website-page/SKILL.md`](../../.agents/skills/add-website-page/SKILL.md).
