# Design system studio (texuli.com)

**App:** `apps/website`
**Path:** `/theme-studio/` (Themes group, "Studio"; the theme studio's URL, kept so every link works)
**Packages:** `@texuli/tokens/design-system/*` (compile, diff, import, emit, report),
`texuli/design-system` (`DesignSystemProvider`), `@texuli/tools/email` (the sample email export);
design-system documents are **in development for 0.10.0, not on npm**
**Tests:** `apps/website/tests/ds-studio.test.ts`, `apps/website/tests/studios.test.ts`,
`tests/e2e/site-ds-studio.spec.ts`, `tests/e2e/site-theme-studio.spec.ts`

## Goal

Author a design-system document ([the spec](../../../packages/spec/docs/design-system.md))
entirely in the browser (PLAN_011 T-ds-studio, architecture §B.8):

1. **Start** from a preset seed or any brand color, a library theme
   (`extends: "texuli:<id>"`), a logo (pixels read through a canvas,
   `importLogoPixels`), mood words (the theme generator, then `fromTheme`),
   a brand one-liner (`importBrand`), or a JSON file: DTCG, Tokens Studio, a
   flat role palette or a design-system document (detected from its shape).
   Each start compiles first and replaces the design system only when it
   compiles; a refused start shows its codes and keeps what was on screen.
2. **Edit** every section: identity, color (seeds, brand pins, status,
   modes, chart series, and role pins for the 50 roles per mode),
   typography (stacks, scale, the 7 type roles), space and density, shape,
   elevation and surface, motion, layout and icons, components (each
   component's defaults and tokens, from the `@texuli/tokens/components`
   registry, loaded when the section opens), accessibility targets, voice,
   assets, variants (named partial documents as JSON), and the whole
   document as JSON. Fields are real Texuli controls (`Input`, `Textarea`,
   `Switch`) or labelled native selects; each shows the spec's issues at its
   path: a plain-language sentence, the code and the JSON path.
3. **Preview** five surfaces in one `DesignSystemProvider` scope (light or
   dark, any variant): a component sheet, a dashboard, a deck slide, a
   document page and an email.
4. **Report** every contrast pair per mode, the solver's adjustments and
   warnings, and the diff from the starting point (`diffDesignSystems`).
5. **Export** as Blob downloads: the document, compiled JSON, scoped CSS,
   a Tailwind preset, DTCG, Tokens Studio, the report HTML, and a sample
   email rendered by `@texuli/tools/email` with the design system.
6. **Share** the document in the URL fragment (below).

Every document from outside the page (a file, a link, pasted JSON) is
compiled at the `untrusted` tier: remote URLs and `data:` URLs are refused.

## Layout

| Piece | Role |
| --- | --- |
| `pages/theme-studio/index.astro` | The page; one `client:load` island |
| `pages/theme-studio/default-design-system.json.ts` | The starting document and its compiled form, built at build time |
| `DesignSystemStudio.svelte` | The island: start, edit, preview, export, share, live regions, shortcuts |
| `StudioField.svelte` | One labelled field with its issues |
| `ComponentsEditor.svelte` | The components section (registry loads on open) |
| `StudioPreviews.svelte` | The five preview surfaces (loaded after mount) |
| `StudioReport.svelte` | Contrast report and diff (loaded after mount) |
| `ds-studio.ts` | Pure: field table, paths, values, code explanations, export formats, import detection |
| `ds-share.ts` | Pure: the share-link codec and its caps |
| `ds-engine.ts` | Lazy: compiler, diff, importers, emitters, report, email |
| `presets.ts` | Preset seeds and featured library themes |
| `studio.ts` | The theme studio's helpers, kept to open old `#theme=` links |

## Share links

```text
/theme-studio/#ds=1.<base64url(deflate-raw(UTF-8 JSON))>
```

- The fragment never reaches a server; nothing is stored anywhere but the link.
- Caps: 16,384 characters after `#ds=`, checked before decoding; 262,144
  bytes inflated, checked while the stream inflates (a small link cannot
  expand into a large document).
- Refusals, each with a code shown next to a plain sentence: `share-format`,
  `share-version`, `share-too-long`, `share-encoding`, `share-too-large`,
  `share-json`, `share-unsupported`; then the spec's and compiler's codes
  (`url-refused`, `format-version`, `unknown-key`, `aa-text` …).
- Old theme studio links (`#theme=…`) still open: the recipe or library
  theme is rebuilt with `studio.ts` and carried over with `fromTheme`. Image
  recipes never traveled in links and are still refused.

## Why the email preview is not the renderer's HTML in a frame

The site's CSP requires Trusted Types, so `iframe.srcdoc` is an HTML sink
(and AGENTS.md rule 7 forbids writing generated HTML into one); a `srcdoc`
frame would also inherit the page's hash-only `style-src`, which blocks the
email's inline styles, and `frame-src 'self'` excludes `blob:` frames. The
studio shows a static email built from components in the same scope, and the
real `renderEmail` output is the "Sample email HTML" download. (The output
page's build-time sandboxed frame does not fit: its email cannot follow a
design system the visitor is editing.)

## Performance

The first paint needs no compiler: the island fetches the build-time
`default-design-system.json` (5.2 KB gzip). The compiler and diff load on
the first focus or pointer press inside the studio (or at once for a shared
link); importers, emitters, the report and the email renderer load on use.
Measured 2026-10-30, fully loaded: 180.7 KB page, 126.8 KB JS gzip (the
theme studio before: 129.3 KB, 91.5 KB). The route budget is in
`src/components/perf/budgets.ts` with its reason. Every dynamic import
destructures what it uses: a namespace import (`await import('@texuli/tokens')`)
keeps every export of the modules the site shell shares with it, which once
added 0.7 KB of JavaScript to every page.

## Accessibility

- Every field has a visible `<label for>`; issues are linked with
  `aria-describedby` and the control gets `aria-invalid`.
- Live regions: the status line (starts, edits, refusals), the issue count
  and a contrast summary after each compile; a refused start is an alert.
- Sections are `<details>` and render their fields only when open, so the
  tab order stays short; shortcuts (`D` mode, `S` share link, `?` the key
  list) fire only with the focus inside the studio and never in a field.
- Under `prefers-reduced-motion` the preview drops its transitions.

## Validation

```bash
pnpm vitest run apps/website/tests/ds-studio.test.ts apps/website/tests/studios.test.ts
pnpm build
TEXULI_E2E_PORT=4880 pnpm exec playwright test tests/e2e/site-ds-studio.spec.ts tests/e2e/site-theme-studio.spec.ts --project chromium
```

## Planned

- The MCP `ds.*` operations and `texuli ds` export commands the studio could
  hand off to are later PLAN_011 tasks.
- Font files and logo assets: the studio edits their relative paths but
  cannot host files, so a document with fonts previews in fallback fonts.
- Resolving `extends: "id@x.y.z"` (another design system): the page has no
  resolver, so only library bases (`texuli:<id>`) extend.
