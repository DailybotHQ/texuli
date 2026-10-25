# `ContentLayout`

Import the static Astro document shell from
`@texuli/astro/layouts/ContentLayout`:

```astro
---
import ContentLayout from '@texuli/astro/layouts/ContentLayout';
---

<ContentLayout
  title="Release notes"
  description="Product updates."
  lang="en"
  theme="default"
  canonical="https://example.com/releases"
  density="comfortable"
  ogTitle="Release notes"
  ogImage="https://example.com/releases/card.png"
>
  <h1>Release notes</h1>
  <p>New content.</p>
  <Fragment slot="head"><meta name="color-scheme" content="light dark" /></Fragment>
</ContentLayout>
```

## Props

| Prop | Required | Default | Behavior |
| --- | --- | --- | --- |
| `title` | Yes | — | Sets the document `<title>`. |
| `description` | No | — | Adds a description meta element when provided. |
| `lang` | No | `en` | Sets the root document language. Supply the correct language for the page. |
| `theme` | No | `default` | Sets the root `data-tx-theme` attribute. |
| `canonical` | No | — | Adds a canonical link when the value passes the developer URL policy. |
| `density` | No | — | Sets the root `data-tx-density` attribute; accepts `compact`, `comfortable`, or `spacious`, validated against the integration's variants. Pairs with the stylesheet's density rules so pages select a variant without client script. |
| `radius` | No | — | Sets the root `data-tx-radius` attribute; accepts `compact`, `comfortable`, or `rounded`, validated the same way. |
| `ogTitle` / `ogDescription` | No | — | Adds the matching Open Graph meta elements when provided. |
| `ogImage` | No | — | Adds an `og:image` meta when the value passes the developer URL policy; a rejected value renders nothing. |
| `noindex` | No | `false` | Adds a `robots` `noindex` meta for drafts and staging mirrors. |

The component emits the doctype, `<html>`, charset and viewport metadata, head,
and body. Its default slot becomes the body content. The named `head` slot
adds content to the document head. It does not add a theme stylesheet or the
appearance integration automatically; configure those separately. It renders
static HTML and does not require client hydration.

The URL passed to `canonical` is treated as developer-authored and checked
with `safeHref`. A rejected URL does not produce a canonical link.

## Fixture coverage

The packed `astro-plain` consumer imports this layout and checks its title,
canonical metadata, theme attribute, rendered section content, and token CSS.
The source is [`ContentLayout.astro`](../src/layouts/ContentLayout.astro).
