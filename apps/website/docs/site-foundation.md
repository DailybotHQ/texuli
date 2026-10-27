# texuli.com: site foundation

**App:** `apps/website` (`@texuli/website`, Astro 7 + Svelte 5)

The site is static and built with Texuli itself. Every page uses one base
layout; the build output is plain files that any static host can serve; a
page makes no request to another origin.

```bash
pnpm build                       # astro check && astro build → apps/website/dist/
pnpm preview                     # serve the build locally
TEXULI_SITE_BASE=/preview/ pnpm build   # build for a sub-path
```

## Configuration (`astro.config.mjs`)

- `output: 'static'`, `build.format: 'directory'` (`/foundation/` →
  `foundation/index.html`), `trailingSlash: 'ignore'`.
- `site: 'https://texuli.com'` (canonical URLs); `base` from
  `TEXULI_SITE_BASE` (default `/`).
- `vite.ssr.noExternal: ['texuli', /^@texuli\//]`: the workspace packages ship
  TypeScript and Svelte sources, so they are compiled into the build. They
  resolve through the repository root's links; the site declares no extra
  dependency.

## Base layout (`src/layouts/BaseLayout.astro`)

Props: `title`, `description`, `lang` (default `en`), `dir` (default `ltr`).

| Part | What it does |
| --- | --- |
| `<html data-tx-theme="enterprise-neutral">` | The site theme (`SITE_THEME`) |
| No-flash script | `noFlashScript('texuli-site', 'system')` from `@texuli/tokens/no-flash`, inline and first in `<head>`. It sets `data-tx-mode` from the remembered choice or the system scheme before anything paints |
| Theme CSS | `compileThemeCss(loadLibraryTheme('enterprise-neutral'))`, inlined at build time (light and dark rules) |
| `@texuli/tokens/base.css` | The reset, focus, motion and surface rules (`@layer tx.base`) |
| Metadata | `<title>` (`<page> · Texuli`), description, canonical, Open Graph title and description |
| Skip link, header, `<main id="main">`, footer | Landmarks; the skip link moves focus to `main` |

The script body and the theme CSS are inlined with `set:html`. Both are
generated at build time by `@texuli/tokens` (JSON-escaped constants,
validated theme values), never from page data.

## Foundation components (`src/components/foundation/`)

- `site.ts`: `SITE_NAME`, `SITE_THEME`, `APPEARANCE_NAMESPACE`, the `NAV`
  list, and `navState(href, current)`. A link is the current page
  (`aria-current="page"`) or the section the page is in (`"true"`).
  `withBase(base, path)`.
- `SiteHeader.astro`: brand, the primary navigation and the appearance switch.
- `ThemeSwitch.svelte`: Light, Dark and System, built from Texuli's
  `ToggleGroup`. It is the only client island (`client:load`).
  - Light or Dark is cached with `cacheAppearance`, so the no-flash script
    replays it on the next load.
  - System clears the cache and follows the operating system live.
- `SiteFooter.astro`.

## Pages

- `/` (`src/pages/index.astro`): the home page on the base layout. The
  texels diagram's colors map onto the theme tokens.
- `/foundation/` (`src/pages/foundation/index.astro`): what the site stands
  on, rendered with Texuli's `Card`, `CardGrid` and `Badge` at build time.

## Tests

```bash
bash -c 'pnpm build && TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/e2e/site-foundation.spec.ts'
```

The spec (one test on Chromium since the 2026-10-27 trim) serves
`apps/website/dist` from its own static file server and checks:
- routing and `aria-current` in the sidebar;
- the skip link moving focus to `main`;
- no request to any other origin;
- the theme following the system scheme in light and dark (background
  luminance);
- the switch persisting Dark across a reload with `data-tx-mode` already set
  before any script runs, and System clearing it.

axe on every page group in light and dark is the page sweep
(`a11y-site.spec.ts`); an unknown path's 404 is `site-seo.spec.ts`.

## Limits

- **High contrast:** the theme compiles light and dark only. When the system
  asks for more contrast, the no-flash script resolves
  `data-tx-mode="high-contrast"`, which has no theme rules yet, so the page
  falls back to `base.css` defaults.
- **No 404 page** of the site's own; static hosts show theirs.
- **The site theme is fixed** (enterprise-neutral). The theme gallery is a
  later task.
