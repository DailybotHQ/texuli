# Site model

The `@texuli/astro/site` subpath is the validated site contract that a
Protoyard static-site export fills in: a multi-page, content-driven site with
SEO metadata and a sitemap. It is data only — the model validates what a
`site` export produced and hands the layouts, navigation and sitemap helpers
normative values. It never renders blocks or HTML.

> Protoyard's `site` prototype kind and its "go to production" export are
> planned work in the Protoyard repository. This subpath is the Texuli-side
> target they will produce; nothing consumes it in a pipeline today.

## Define a site

`defineSite(input)` validates the whole definition and returns a frozen,
normalized model. It throws a `TypeError` naming the offending field when
anything in the closed schema fails:

- `kind`, when present, must be `texuli.site/v1` (`SITE_KIND`).
- `name` is a non-empty string of at most 120 characters.
- `url` is the deployed origin plus optional base path. It must pass the
  URL policy's developer tier, use `https` or `http`, and carry no query
  string, fragment or trailing slash.
- `lang` defaults to `en` and must be a base language tag with optional
  subtags.
- `pages` is a non-empty array. Every slug is unique lowercase kebab-case;
  exactly one page sets `home: true` and maps to the root path.
- Per page: `title` (at most 200 characters), optional `description` (300),
  `updated` (an ISO calendar date used as the sitemap `lastmod`), and `nav`
  (a navigation label of at most 120 characters; pages with one join
  `site.navigation` in declared order).
- Per page `blocks`, when present, must pass the closed Texuli block schema
  from `@texuli/blocks/core`. Failures name the page and the issue paths.
  Blocks are validated here but never painted; rendering stays with the
  host's sink-free renderer.

```ts
import { defineSite, sitePageMeta, siteSitemap } from '@texuli/astro/site';

const site = defineSite({
  kind: 'texuli.site/v1',
  name: 'Stories',
  url: 'https://stories.example.com',
  pages: [
    { slug: 'home', title: 'Home', home: true, nav: 'Start' },
    { slug: 'about', title: 'About', nav: 'About', updated: '2026-10-24' },
  ],
});
```

The returned model is deeply frozen: `site.pages` carry `path` and absolute
same-origin `href` values, and `site.navigation` lists `{ slug, label, href }`
entries in declared order.

## Wire pages to the layout

`sitePage(site, slug)` looks a page up, and `sitePageMeta(site, slug)`
returns ContentLayout props: the home page titles as the site name, other
pages as `page title — site name`, with the canonical set to the page's
absolute URL.

```astro
---
import ContentLayout from '@texuli/astro/layouts/ContentLayout';
import { defineSite, sitePageMeta } from '@texuli/astro/site';

const site = defineSite(siteExport);
const meta = sitePageMeta(site, 'about');
---

<ContentLayout title={meta.title} description={meta.description} canonical={meta.canonical} lang={meta.lang}>
  <p>Page body.</p>
</ContentLayout>
```

## Sitemap

`siteSitemap(site)` returns deterministic `sitemap.xml` text: one entry per
page in declared order, with `<lastmod>` only for pages that declare
`updated`. Locations are XML-escaped. Write it from a static endpoint, for
example `src/pages/sitemap.xml.ts`, that returns the string as
`text/xml`; the helper is data generation, not an HTML renderer.

## Trust tier

Site definitions are developer-authored (an export pipeline's output), so
every derived link uses the developer tier of the URL policy. Validate at
this boundary before the model reaches a page; if the source of a definition
is untrusted, treat it as such before calling `defineSite`.

## Tests

`packages/astro/tests/astro.test.ts` covers normalization and freezing, the
kind discriminator, slug/home/base-URL/date/language validation, block-schema
failures, `sitePage`/`sitePageMeta`, and the deterministic sitemap including
XML escaping.
