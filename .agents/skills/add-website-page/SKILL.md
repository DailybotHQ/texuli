---
name: add-website-page
description: Add a static page to the Texuli website (apps/website, Astro 7) that reuses the site tokens, stays accessible and honest, and passes astro check and the build.
version: "1.0.0"
user-invocable: true
allowed-tools: Bash, Read, Grep, Glob, Edit, Write
# === Documentation (ignored by harnesses, useful for humans) ===
tier: standard
intent: create
max-files: 4
---

# Skill: Add a website page

## Goal

A new route in `apps/website` that builds with `pnpm build`, ships no client
JavaScript unless it has an interactive example, and describes only what
exists (planned work labeled as planned).

## When to use

- Documentation, a texel or component page, or a project page for
  texuli.com.

## Inputs

- The route (for example `/docs/url-policy`), its audience and content.

## Steps

1. **Read the model:** `apps/website/src/pages/index.astro` (document
   skeleton, `:root` color tokens with a dark variant, logical CSS) and
   `apps/website/src/components/TexelsDiagram.astro` (scoped styles,
   `aria-hidden` decoration).
2. **Create the page** at `apps/website/src/pages/<route>.astro` (or
   `<route>/index.astro`). File-based routing maps the path to the URL.
   Keep `<html lang="en">`, the charset and viewport metas, a unique
   `<title>` and `<meta name="description">`.
3. **Shared markup** goes in `apps/website/src/components/<Name>.astro`
   (PascalCase). There is no shared layout component yet; if a second page
   needs the same head and tokens, extract one into
   `src/layouts/` and use it from both pages in the same change.
4. **Styles:** use the custom properties (`--bg`, `--surface`, `--text`,
   `--muted`, `--line`, `--accent`, `--accent-soft`); logical properties
   (`max-inline-size`, `margin-inline`, `padding-block`); no hard-coded
   colors when a token exists.
5. **Accessibility:** one `h1`, ordered headings, descriptive link text,
   `aria-hidden="true"` on decorative graphics, visible focus.
6. **Interactivity (only if needed):** a Svelte 5 component in
   `src/components/` mounted with `client:visible`, written with runes. Note
   in the PR or handoff that the page now ships JavaScript.
7. **Content safety:** no `set:html` or `{@html}`; any link built from data
   uses `safeHref` from `@texuli/core` (adding that dependency to the website
   `package.json` goes through the lockfile owner).
8. **Honesty:** no "released", "available on npm" or live-URL claims; the
   site is not deployed.

## Validation

```bash
npx biome check apps/website
pnpm --filter @texuli/website typecheck   # astro check, 0 errors
pnpm build                                # the build log lists the new route
```

Optionally `pnpm preview` and open the route locally. From a non-interactive
shell the preview server keeps running in the background; stop it with
`pnpm --filter @texuli/website exec astro preview stop`.

## Notes

- The website has no unit tests; the build is its gate.
- Measure any new client JavaScript as in `docs/PERFORMANCE.md`.
