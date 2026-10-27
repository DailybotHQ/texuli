# Component pages generator

**App:** `apps/website`  
**Paths:** `/component-pages/`, `/component-pages/<id>/`  
**Surface:** `src/components/component-pages/`, `src/pages/component-pages/`  
**E2E:** `tests/e2e/site-component-pages.spec.ts`  
**Unit:** `scripts/tests/site-loaders.test.ts`, `apps/website/tests/component-pages.test.ts` (sections, controls, family notes)

## Goal

One **static** page per catalog component, generated at build time from its
manifest:

- live example stage (SSR for a closed set of simple ids; JSON props preview otherwise)
- code sample (escaped JSON props)
- props table
- keyboard table (derived from a11y notes when no structured keyboard field)
- accessibility notes
- useWhen / dontUseWhen
- related links + previous/next pager

No runtime network. Manifest strings are plain text (no HTML sinks).

## Data source

`load-manifests.ts` imports every catalog group via relative monorepo paths:

`content`, `display`, `forms`, `layouts`, `overlays`

Same closed ids as `@texuli/catalog` manifest packages. New groups require an
import line here (or a future shared discovery helper in the website package).
`apps/website/tsconfig.json` includes the catalog `manifest` / `manifests`
trees so Astro check can type them without linking `@texuli/catalog` at the
workspace root.

## Live islands

SSR live stage covers `badge`, `button`, `card`, `kbd`, `tag`, `alert` and
`callout`. Tone fills use the theme engine soft/solid AA pairs
(`*Soft` / `*SoftForeground` and solid `*Foreground`) — no clamps. Authored
props always appear in the code sample; other ids use a static props card.

## Validate

```bash
pnpm build
pnpm vitest run scripts/tests/site-loaders.test.ts
TEXULI_E2E_PORT=4920 pnpm exec playwright test tests/e2e/site-component-pages.spec.ts
```

The spec (one test) drives the badge props panel into the live code sample,
toggles the dropdown menu stage, and runs axe under forced colors on one page
per family; every page's required sections are unit-tested, and axe in light
and dark runs on a sample in the page sweep (`a11y-site-<n>.spec.ts`).

## Limits

- Not every component id has a dedicated live island (keeps the site free of
  dynamic `import()` of arbitrary packages).
- Keyboard rows are best-effort from a11y prose.
- Catalog is imported by relative path until the lead links `@texuli/catalog`
  at the workspace root (optional hygiene).
