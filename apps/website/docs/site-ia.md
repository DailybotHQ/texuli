# Site information architecture

**App:** `@texuli/website` (`apps/website`)  
**Task:** T-site-ia (absorbs FIX-site-sidebar-nav)  
**E2E:** `tests/e2e/site-ia.spec.ts`, `tests/e2e/site-docs-nav.spec.ts` and
`tests/e2e/a11y-site.spec.ts`

texuli.com has two kinds of page: a minimal landing on `/` (and `/native/`),
and one docs shell everywhere else. The platform routes (`/`, `/native/`,
`/web-and-native/`), their header, sidebar and footer doors, the breadcrumb
trail and the per-route metadata are in [site-subsite.md](site-subsite.md);
the landing sections are in [site-landing.md](site-landing.md).

## Landing (`/`)

`BaseLayout` with `landing`:

- **Header** (`SiteHeader` `variant="landing"`): the Texuli logo (`BrandLogo`),
  a Docs link (`/guides/`), the platform doors (Web + native, Native), a
  GitHub door, search with the ⌘/Ctrl+K hint, the light/dark/system switch
  and a Get started button (`/guides/getting-started/`). GitHub and Get
  started hide up to 64rem and the platform doors up to 48rem (T-89): the hero carries `/native/` and Get
  started, the web-and-native section carries `/web-and-native/`, and the
  footer carries GitHub. `site-ia.spec.ts` pins 6 header links on desktop
  and 2 on phones.
- **Sections** (`sections/web/*`, PLAN_006 T-44): `WebHero` (platform hero,
  proof strip, theme swatches as data), `WebWhySvelte`, `WebCorrelation`
  (one contract, two projections; links the badge page and
  `/web-and-native/`) and `WebAgentsCta` (agents strip and closing call to
  action). The page body is static Astro. The shared header still hydrates
  `SiteSearch` and `ThemeSwitch` (`client:load`), so the full home document has
  two islands; neither landing section needs a page-specific island.
- **Footer:** the site footer.

There is no sidebar and no page links in the header beyond the platform
doors and GitHub. `/native/` uses the same landing shell.

## Docs shell (every other page)

`BaseLayout` without `landing`. See [site-sidebar-nav.md](site-sidebar-nav.md)
for the details.

- **Utility header** (`SiteHeader`, `variant="docs"`): the menu button on
  phones, the logo, search and the theme switch. It has no page links.
- **Left sidebar:** all navigation, in groups:
  - **Get started:** Introduction (`/guides/`), every guide in reading order,
    Skill.
  - **Platform:** Web + native (`/web-and-native/`), Native (Kotlin)
    (`/native/`).
  - **Components:** Overview, Gallery, Examples, Blocks, Charts, Media, then
    every catalog component, alphabetically.
  - **Primitives:** the overview, then every primitive, alphabetically.
  - **Themes, Agents, Project** (Project ends with the Changelog).

  Search lives in the header, so the `/search/` page has no sidebar link.
  `/docs-shell/` is the earlier docs-shell demo; it stays unlinked.
- **Content column, "On this page" and pager:** "On this page" uses
  scroll-spy and shows from 80rem up. Previous/next follows sidebar order.
  "Copy page" copies Markdown.
- **Phones:** the menu button opens the same navigation in a lazy drawer.

**Guides:** they use the shell like every docs page. `GuidesShell` is now only
the article header and body. Its own sidebar, phone menu, contents list and
pager are gone, because the shell supplies them.

## Where things live

| Concern | File |
| --- | --- |
| Groups and fixed links, docs entry points | `components/foundation/site.ts` (`NAV_GROUPS`, `DOCS_HOME`, `GET_STARTED`) |
| Generated lists, pager, docs-page test | `components/foundation/nav-data.ts` |
| Header variants | `components/foundation/SiteHeader.astro` |
| Landing or shell | `layouts/BaseLayout.astro` (`landing`) |
| Home composition | `pages/index.astro` |
| Breadcrumb trail (visible and JSON-LD) | `components/seo/breadcrumbs.ts`, rendered by `layouts/BaseLayout.astro` |

## Validate

```bash
pnpm build
TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/e2e/site-ia.spec.ts tests/e2e/a11y-site.spec.ts
```

`site-ia.spec.ts` checks:
- **Landing header:** logo, Docs, the platform doors, GitHub, search, theme
  and Get started, and nothing else. There is no sidebar, menu or Copy page
  on the home.
- **Landing sections:** exactly four sections in blueprint order plus the
  footer, the build-time theme moment painted in the HTML, no
  `astro-island` inside the landing content, and no horizontal scroll on
  phones. `/native/` is checked as the second landing-shell route.
- **Every other page has the shell:** each built page (more than 150) has the
  sidebar and the docs header, with no `nav` in the header.
- **Sidebar groups:** they are in order, with the guides in reading order;
  the platform group holds the architecture page and the native landing;
  every nav target resolves in the built site.
- **Guides:** a guide shows one navigation with its group open, "On this page",
  the shared pager and Copy page.
- **Phones:** the drawer opens the same navigation from any docs page.

## Limits

- **The home body is static.** The T-44 landing replaced the hero widget
  islands (`HeroMoments` and `AgentsPlayground`)
  with four static sections; only the shared search and theme controls hydrate.
  Its page weight is tracked against the `/` budget
  in `components/perf/budgets.ts`: 83.8 KB against 152 KB in the local
  T-92 run (2026-10-26), so it is no longer a tracked red in `docs/CI.md`.
- **Landing cleanup (T-site-theme-swatches):** `AnnouncementBanner`, `ThemesStripHost`,
  `ThemesStrip` and `theme-swatch.ts` were removed (nothing imported them after T-site-ia).
