# texuli.com sub-sites: routes, doors and breadcrumbs

**App:** `apps/website`
**Routes:** `/` (unified landing), `/native/` (native landing),
`/web-and-native/` (architecture reading page)
**Tasks:** PLAN_006 T-12 (routes), T-17 (nav, shell and metadata
contract), T-19 (BreadcrumbList), T-31..T-33 (scaffold, nav, specs)
**Specs:** `tests/e2e/site-ia.spec.ts`, `tests/e2e/site-native.spec.ts`,
`tests/e2e/site-architecture.spec.ts`, `tests/e2e/site-seo.spec.ts`

## Purpose

The developer asked for a web-focused and a native-focused front door.
texuli.com is one static Astro site on Cloudflare Pages, so the honest
scope is **in-site sub-sites**: distinct landings and nav emphasis under
one shell system, one domain, one theme, one CSP, one sitemap. `/native/`
is a landing about the native runtime, not a fenced site with its own
base path or theme. The two shells themselves are described in
[site-ia.md](site-ia.md) and [site-sidebar-nav.md](site-sidebar-nav.md);
this note records how the three platform routes sit in them.

## Structure

### Route decisions (T-12)

| Route | Shell | Why |
| --- | --- | --- |
| `/` | Landing | The product's difference is one catalog with two runtimes; splitting the first screen into two technologies would read as two products. The web experience is the docs, catalog and galleries, which need no separate landing |
| `/native/` | Landing | A marketing landing for the Kotlin Multiplatform story. The slug names the user-visible concept; `/kotlin/` would age with the technology and `/mobile/` would exclude desktop |
| `/web-and-native/` | Docs | A reading page (TOC, pager, Copy page), so it joins `DOC_SHELL_ROUTES`. `/architecture/` was rejected as over-promising |

No existing route moved, so no redirects were needed. A later rename is
one directory plus a `public/_redirects` entry in Cloudflare format.
`/guides/why-svelte-kotlin/` keeps its URL as the technical deep-dive.

### Doors

All doors are generated from the nav source, never hand-maintained
lists:

- **Sidebar:** the `platform` group in `NAV_GROUPS`, second after
  Get started: "Web + native" (`/web-and-native/`) and "Native (Kotlin)"
  (`/native/`). Flat, no expansion.
- **Landing header** (`SiteHeader` `variant="landing"`): Docs, Web +
  native, Native and GitHub beside search, the theme switch and Get
  started. GitHub and Get started hide up to 64rem and the platform doors
  up to 48rem (T-89); the hero and footer carry the paths.
- **Footer product row** (`SiteFooter`): Components, Primitives, Themes,
  Native, Agents, resolved from `NAV_GROUPS`; the platform group's door is
  the native landing.

**Cross-link rule** (asserted, not hoped): `/` links both routes;
`/native/` links `/web-and-native/`; `/web-and-native/` links `/native/`
and the guide.

### Breadcrumbs

`breadcrumbTrail` (`src/components/seo/breadcrumbs.ts`) walks the same
`SITE_NAV_GROUPS` the sidebar renders; there is no second hierarchy.
`BaseLayout` emits the trail twice from one value: a BreadcrumbList
JSON-LD block in the head and, on docs-layout pages, a visible
`nav[aria-label="Breadcrumb"]` above the content with `aria-current` on
the last entry. Rules: `/` and pages outside the nav get no trail; a
group's middle entry is the group label pointing at its first page,
skipped when the page is that first page; family entries appear only
when the family heading has an href (Blocks, Charts, Media).

### Metadata (T-17)

| Route | Title | JSON-LD |
| --- | --- | --- |
| `/` | the landing title (see [site-seo.md](site-seo.md)) | Organization, WebSite with SearchAction, SoftwareApplication (`libraryJsonLd`) |
| `/native/` | `Texuli native — the same catalog, rendered by Compose` | Organization only: nothing native is installable yet |
| `/web-and-native/` | `Web and native, one contract — Texuli's architecture` | TechArticle (`techArticleJsonLd`) plus the BreadcrumbList |

Titles are claims the page body proves. All three routes are in the
sitemap through the SEO integration, whose equality gate fails a route
without a real title and description.

## Ownership

| Concern | Files |
| --- | --- |
| Nav groups, docs entry points | `src/components/foundation/site.ts` |
| Docs-shell membership (`DOC_SHELL_ROUTES`, `isDocsPath`) | `src/components/foundation/nav-data.ts` |
| Header doors | `src/components/foundation/SiteHeader.astro` |
| Footer product row | `src/components/foundation/SiteFooter.astro` |
| Breadcrumb trail, JSON-LD | `src/components/seo/breadcrumbs.ts`, `src/lib/schema.ts`, `src/layouts/BaseLayout.astro` |
| Page content | [site-landing.md](site-landing.md), [site-native.md](site-native.md), [site-architecture.md](site-architecture.md) |

## Spec map

| Behavior | Pinned by |
| --- | --- |
| `/` and `/native/` use the landing shell; every other built page has the docs shell | `tests/e2e/site-ia.spec.ts` |
| The platform group holds both routes; every nav target resolves; the native landing is one interaction from the home header | `tests/e2e/site-ia.spec.ts` |
| Header and footer share the repository constant through `safeHref` | `apps/website/tests/landing.test.ts` |
| `/native/` metadata, status honesty, section order | `tests/e2e/site-native.spec.ts` |
| `/web-and-native/` metadata, docs shell, cross links, TechArticle | `tests/e2e/site-architecture.spec.ts` |
| BreadcrumbList on nested pages, none on `/` | `tests/e2e/site-seo.spec.ts` |
| Visible breadcrumbs share the BreadcrumbList trail | `apps/website/tests/docs-reading.test.ts` |

## How to extend

- **Another platform page:** add the link to the `platform` group in
  `site.ts`. If it is a reading page, add it to `DOC_SHELL_ROUTES`; if it
  is a landing, add it to the spec's `landingRoutes()` list in
  `site-ia.spec.ts` and give it the `landing` layout. Ship it with a real
  title and description, and extend the cross-link assertions.
- **A new nav group** gets breadcrumbs, the sidebar entry and (if listed
  in `PRODUCT_GROUP_IDS`) a footer door from the same data.

## Deviations and limits

- **Not true multi-site.** One base path, theme, CSP and analytics
  configuration serve all three routes. A separate site would be the
  `TEXULI_SITE_BASE` mechanism's job and is out of scope.
- **Per-route budgets for `/native/` and `/web-and-native/`** are
  proposed for the owner-held `texuli.budgets.json`, not yet registered.
- **OG art:** `ogAreaFor` maps both routes to their own badge; see
  [site-seo.md](site-seo.md).
