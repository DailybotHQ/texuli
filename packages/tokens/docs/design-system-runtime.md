# The design-system runtime (`@texuli/tokens/design-system/apply`)

> **Status: in development for `0.10.0`, not on npm.** The subpath exists on
> the `release/0.10.0` branch and ships only with `@texuli/tokens@0.10.0`.

The runtime puts a compiled design system
([design-system-compiler.md](design-system-compiler.md)) on the page
([ADR-023](../../../docs/DECISIONS.md#adr-023-design-system-runtime-and-scoping)).
It is a lazy entry that imports only the attribute allowlist: never the
compiler, the validator or the color engine. Apps that never import it pay
nothing (the `@texuli/tokens` root does not reach it; a test walks the
import graph, and the root measures the same as before it existed).

```ts
import { applyDesignSystem, designSystemStyle } from '@texuli/tokens/design-system/apply';

// Client: one element is the scope. Calling it again switches in one pass.
const dispose = applyDesignSystem(previewEl, compiled, { mode: 'dark' });
applyDesignSystem(previewEl, otherCompiled, { mode: 'light' }); // switch: one style write
dispose(); // a superseded dispose does nothing; the latest one restores the element

// Server: the same declarations as CSS, for <head>.
const css = designSystemStyle(compiled); // [data-tx-ds="acme"]{…}\n…[data-tx-mode="dark"]…{…}
```

## API

| Export | What it does |
| --- | --- |
| `applyDesignSystem(el, compiled, { mode, variant?, fonts?, base?, defaults? })` | Writes `compiled.vars[mode]` on `el` in **one** `style.cssText` write (CSSOM, so a strict `style-src` without `'unsafe-inline'` allows it), keeping the element's own declarations. Sets the allowlisted attributes (`DESIGN_SYSTEM_ATTRIBUTES`), `data-tx-mode` and `data-tx-scope` (a host-named scope is kept). Registers `fontFaces` (see below), passes `compiled.defaults` to `defaults` (`setDesignDefaults`, or the provider below). Returns a dispose that restores every variable and attribute it changed, in one write, and calls `defaults({})` |
| `designSystemStyle(compiled, { selector?, modes? })` | The same declarations as a CSS string: the first mode (light when compiled) on `selector`, dark on `:is(selector)[data-tx-mode="dark"]` and `[data-tx-mode="dark"] :is(selector):not([data-tx-mode="light"])`. The default selector is `[data-tx-ds="<id>"]` (plus `[data-tx-ds-variant]` when compiled for a variant). Throws a `TypeError` for a selector (or id) with braces, `;`, `<`, `>`, `@`, `\`, `!`, comments, control or bidi characters |
| `designSystemAppearance(compiled, { mode })` | The same map as a no-flash cache entry: `cacheAppearance(namespace, designSystemAppearance(compiled, { mode }))`, then `noFlashScript(namespace)` replays it on `<html>` before first paint ([tokens-no-flash.md](tokens-no-flash.md)) |
| `designSystemDeclarations(vars)` | The safe `[name, value]` pairs of one map, sorted by name: what all three write |
| `isSafeDesignSystemValue(value)` | The value filter |
| `ApplicableDesignSystem` | The fields the runtime reads (`id`, `variant`, `vars`, `attrs`, `fontFaces`, `defaults`): a cached JSON copy of a `CompiledDesignSystem` works |

`variant` defaults to `compiled.variant` and must equal it when both are
set (a variant is chosen at compile time). Fonts stay registered after a
dispose: other scopes may use them.

## Escaped by construction

`apply`, `designSystemStyle` and `designSystemAppearance` share one filter.
A name must match `--tx-[a-z0-9-]+`; a value must be at most 2,048
characters, with balanced quotes and parentheses, and no `;`, `{`, `}`,
`<`, `>`, `\`, `!`, `@`, `/*`, control or bidi characters, `url(`,
`var(`, `expression(` or `javascript:`. A pair that fails is dropped, never
escaped into place, so a tampered cache or compiled file can add neither a
declaration, a rule, a priority nor a URL. The filter is stricter than the
no-flash replay's, so everything `apply` writes, the replay writes too.
Attribute values are written with `setAttribute` (never markup) and only
for allowlisted names. The compiler never emits a value the filter drops
(the acme and minimal fixtures keep all of theirs, a test checks it).

## SSR, no flash and the client are identical

`packages/tokens/tests/design-system-apply.test.ts` renders acme and
minimal, light and dark, three ways and compares the computed variables:
the `designSystemStyle` string in `<head>` with a `[data-tx-ds]` element,
`applyDesignSystem` on an element, and the real `noFlashScript` body
replaying `designSystemAppearance` from a cache. The three maps are
byte-identical, and equal to the compiled map. The perf test below repeats
the comparison in headless chromium (every value non-empty, no mismatch).

## Fonts

`fontFaces` are registered as `FontFace` objects on the element's document
the first time a design system is applied there (never at import), added
unloaded: the browser fetches a file only when text uses the family. Each
face is registered once per document. Only two sources are accepted, the
same rule as the spec's validator: a relative path (`fonts/acme.woff2`,
`/fonts/acme.woff2`; no `..`, no query) that resolves to the same origin as
`base` (default: the document's base URI), and a base64 `data:font/…` URL.
Remote hosts, protocol-relative and `javascript:` sources are skipped. The
family is passed as a plain string and the source is JSON-quoted, so no CSS
text is built from them; a weight that is not `400` or `100 900` is
skipped. Pass `fonts: false` to manage fonts yourself (preload hints are on
`fontFaces[].preload`).

## Hosts

- **Svelte:** `DesignSystemProvider` in `texuli/design-system` (scope
  element plus the defaults context;
  [design-system.md](../../texuli/docs/design-system.md#designsystemprovider)).
- **Astro:** `texuli({ designSystem: { compiled } })` inlines
  `designSystemStyle` in every page's `<head>` with its CSP hash
  ([integration.md](../../astro/docs/integration.md#design-system-style)).
- **Anything else:** call `applyDesignSystem` on any element, and put
  `designSystemStyle` in a hashed or nonced `<style>` for server HTML.

## Size and speed

Measured with `pnpm size --filter tokens` (gzip, 2026-10-30):
`design-system/apply` 1,966 B (budget 2,048 B, the ADR-023 target of
2 KB). The `@texuli/tokens` root measured 40,820 B before and after.

`tests/perf/design-system-switch.test.ts` (`pnpm test:perf`) launches
headless chromium with 1,000 elements under one scope, each painted from
design-system variables, and switches between acme and minimal (alternating
light and dark): `applyDesignSystem` plus a forced style recalculation and
layout per sample. The bound is the median of 40 switches under 16 ms (one
60 Hz frame). Four local runs on an Apple silicon laptop (2026-10-30)
measured a median of 2.9 to 3.0 ms and a slowest switch of 6.3 to 7.3 ms
(`TEXULI_PERF_REPORT=1` prints them). Paint is not included in the sample.
