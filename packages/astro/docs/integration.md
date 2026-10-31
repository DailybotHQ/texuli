# Astro integration

`@texuli/astro` exposes `texuli(options)` and `themeBootstrapScript(options)`
from both `@texuli/astro` and `@texuli/astro/integration`. The integration
places an inline appearance bootstrap in Astro's `head-inline` stage by
default. The script is self-contained: it reads the namespaced Texuli cache
before styles paint, applies the cached theme and mode, and follows matching
appearance changes from another same-origin tab through the browser `storage`
event. When no appearance is cached it keeps the server-rendered
`data-tx-theme` on `<html>` — the static theme `ContentLayout` renders from
its `theme` prop — and clearing the cache restores it. It does not fetch data
or install Svelte event handlers.

## Setup and namespace

Add the integration and the Astro Svelte integration to the site config when
the site uses Svelte components:

```ts
import svelte from '@astrojs/svelte';
import { defineConfig } from 'astro/config';
import { texuli } from '@texuli/astro';

export default defineConfig({
  integrations: [svelte(), texuli({ namespace: 'docs' })],
});
```

Load `@texuli/astro/styles.css` in a site-owned stylesheet. Match `namespace`
to the value used by the code that writes Texuli appearance preferences, such
as the [appearance switcher](appearance.md). The
default namespace is `site`; invalid namespaces are rejected during config
setup. Namespaces keep separate applications on the same origin from sharing
an appearance cache.

## Options

| Option | Default | Behavior |
| --- | --- | --- |
| `namespace` | `site` | Selects the appearance cache key. Use the same namespace when reading or writing appearance state. |
| `fallbackMode` | `system` | Mode used when no usable cache exists. Accepts `system`, `light`, `dark`, or `high-contrast`. `system` follows color-scheme and increased-contrast preferences. |
| `bootstrap` | `injected` | `injected` registers the script in `head-inline`; `manual` skips registration so the host can place the returned body. |
| `density` | unset | Optionally overrides the cached density scale with `compact`, `comfortable`, or `spacious`. |
| `radius` | unset | Optionally overrides the cached radius scale with `compact`, `comfortable`, or `rounded`. |
| `designSystem` | unset | Unreleased (`0.10.0`): `{ compiled, selector?, modes? }`. Inlines the compiled design system's `designSystemStyle` in every page's `<head>`; see [Design-system style](#design-system-style). |

The selected density and radius are applied on the document root before the
theme stylesheet paints. When either option is unset, the cached theme's
corresponding value is retained. The stylesheet also supports the matching
`data-tx-density` and `data-tx-radius` root attributes; see
[stylesheet contents](styles.md).

## Inline bootstrap and CSP hashes

With the default `bootstrap: 'injected'`, Astro receives a deterministic inline
script body through the `head-inline` injection hook. The package does not
write CSP headers or add a hash to a policy. A host using hash-based CSP must
allow the SHA-256 hash of the exact inline body emitted in its HTML under
`script-src`. Hashes change when the namespace, fallback mode, density, or
radius changes.

For a static build, inspect the emitted document and compute the hash from the
exact script body that the browser receives. For a request-time build, compute
or register the corresponding hash as part of the host's response-policy
configuration. A small Node example for a known option set is:

```ts
import { createHash } from 'node:crypto';
import { themeBootstrapScript } from '@texuli/astro';

const body = themeBootstrapScript({ namespace: 'docs', fallbackMode: 'system' });
const digest = createHash('sha256').update(body).digest('base64');
const source = `'sha256-${digest}'`;
```

Confirm that this digest matches the actual inline script body after Astro has
generated the page before relying on it in a production policy. Astro or host
transformations that alter the body also alter the hash. This hash authorizes
only that script body; it does not require a nonce or `'unsafe-inline'` for
event handlers.

## Design-system style

> **Status:** in development for `0.10.0`, not on npm.

`designSystem: { compiled }` puts a compiled design system
([design-system-runtime.md](../../tokens/docs/design-system-runtime.md))
on the server-rendered page, so the first paint already has its variables:

```ts
import { texuli } from '@texuli/astro';
import compiled from './design-system/acme.compiled.json';

export default defineConfig({
  integrations: [svelte(), texuli({ designSystem: { compiled } })],
});
```

- **What is inlined:** `designSystemStyle(compiled, { selector, modes })`,
  by default `[data-tx-ds="<id>"]{…}` plus the
  `[data-tx-mode="dark"]` rule, in a `<style data-tx-ds-style>` before
  `</head>`. Give the scope element the attribute (`DesignSystemProvider`
  from `texuli/design-system` renders it), or pass `selector: ':root'` for a
  page-wide design system. The style is escaped by construction: the
  runtime filter drops any value that could leave its declaration, and the
  selector is refused if it could leave the rule.
- **How:** in `astro:config:setup`, and only with the option, the
  integration loads `@texuli/astro/design-system` lazily, writes a
  self-contained middleware (no imports) to Astro's codegen directory and
  registers it with `addMiddleware({ order: 'pre' })`. The middleware
  inserts the style once into `text/html` responses (prerendered pages at
  build time, on-demand pages per request) and drops `Content-Length`;
  other responses pass through.
- **CSP:** the hash is the SHA-256 of the exact style body, the way the
  site's CSP build already hashes inline styles. With Astro's
  `security.csp` on, the integration adds it to
  `security.csp.styleDirective.hashes`. A host that writes its own policy
  takes it from `designSystemInlineStyle`:

```ts
import { designSystemInlineStyle } from '@texuli/astro/design-system';

const { css, hash } = await designSystemInlineStyle({ compiled });
const source = `'${hash}'`; // for style-src
```

The client then keeps the same values: `applyDesignSystem` (or the
provider) writes byte-identical variables
([proof](../../tokens/docs/design-system-runtime.md#ssr-no-flash-and-the-client-are-identical)).
Tests: `packages/astro/tests/design-system.test.ts`.

## Manual placement with a nonce

Set `bootstrap: 'manual'` to disable automatic insertion. Then render the body
from `themeBootstrapScript()` in a host-owned inline script with the request's
nonce:

```astro
---
import { themeBootstrapScript } from '@texuli/astro';

const body = themeBootstrapScript({
  namespace: 'docs',
  bootstrap: 'manual',
  fallbackMode: 'system',
});
const nonce = Astro.locals.cspNonce;
---

<script is:inline nonce={nonce}>{body}</script>
```

The host must send the same unpredictable per-response nonce in its CSP
`script-src` directive. A nonce has to be created by the site's server or
adapter for each response; a nonce cannot be safely baked into a static HTML
file. The helper returns the body only, without a `<script>` wrapper or nonce.

## Tests

`packages/astro/tests/astro.test.ts` checks head injection, deterministic
script output, cached appearance application, storage updates, system
preference changes, manual placement, option validation, and stylesheet
variants. The packed `astro-plain` fixture also checks that the injected
appearance reaches the built HTML. See the [package README](../README.md) for
all package checks.
