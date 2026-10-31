# Design systems hub (texuli.com)

**App:** `apps/website`
**Path:** `/design-systems/` (Themes group, first link), plus the build-time
stylesheet `/design-systems/brands.css`
**Packages:** `texuli/design-system` (`DesignSystemProvider`),
`@texuli/tokens/design-system/apply` (`designSystemStyle`),
`@texuli/tools/ds-check` (`checkDesignSystem`); design systems are **in
development for 0.10.0**, and installs name the 0.9 line
**Tests:** `apps/website/tests/site-design-systems.test.ts`,
`tests/e2e/site-design-systems.spec.ts`, `tests/e2e/site-perf.spec.ts`

## Goal

One page that explains what a design system is and shows it working
(PLAN_011 T-site-0100), for adopters deciding whether to describe their
brand as one JSON document ([docs/DESIGN_SYSTEMS.md](../../../docs/DESIGN_SYSTEMS.md)):

1. **What a design system is:** the closed document, the smallest valid one,
   and validate → compile → apply or emit.
2. **Three brands, four surfaces:** the fictional example brands of
   `examples/design-systems/` (`quillmark`, `ledgerline`, `tumbletown`)
   applied to the same dashboard, deck slide, document page and email, side
   by side.
3. **Conformance:** per brand and run (Ledgerline's `high-contrast` variant
   is checked too), the contrast target, the pairs passing per mode, the
   tightest text pair, the control heights held to the target size, the
   solver moves and the result, then the `texuli ds check` command.
4. **Start one:** the studio (`/theme-studio/`), the `texuli ds` commands,
   the MCP (the `ds.*` tools and `blueprint.theme`, the
   `create-design-system` prompt and `texuli://design-system/{id}`, read from
   the generated `mcp-server-data.ts`) and the guide.

The status line (`DS_STATUS` in `src/components/design-systems/page.ts`) is
the one place the release status lives; the release task changes it when
`0.10.0` is published.

## How it renders (no client JavaScript)

| Piece | Role |
| --- | --- |
| `pages/design-systems/index.astro` | The page; no island and no client script |
| `pages/design-systems/brands.css.ts` | `designSystemStyle(compiled, { modes: ['light'] })` for each brand, one `[data-tx-ds="<id>"]` rule each, written at build time |
| `components/design-systems/brands.ts` | Reads the three documents as the MCP serves them (`texuliResources`, `texuli://design-system/<id>`; the website may not import files outside its package, and `@texuli/tools` tests that copy against `examples/design-systems/`) and runs `checkDesignSystem` once per build (the static half of `texuli ds check`: validation, `extends`, the base and variant compiles, the guarantees re-checked) |
| `components/design-systems/conformance.ts` | Pure: the table's numbers from the report (pairs per mode and kind, the tightest text pair, targets, moves) |
| `components/design-systems/BrandSurface.svelte` | One surface under one brand: a server-rendered `DesignSystemProvider` (scope attributes in markup, the brand's component defaults through context) around real Texuli components |
| `components/design-systems/page.ts` | The status line and the four surfaces |

Decisions:

- **A linked stylesheet, not an inline style.** The brands' variables are a
  same-origin file, so the page needs no `set:html`, adds no style hash to
  its CSP and the browser can cache the variables. Each brand's light rule is
  about 1.6 KB gzip.
- **Light previews.** `DesignSystemProvider` pins `data-tx-mode="light"` on
  its scope, so the dark rules would never match and are not emitted; the
  conformance table reports both modes.
- **Compositions for the slide, the document and the email**, as the
  studio does (`site-theme-studio.md`): the real email HTML is
  `@texuli/tools/email`'s, and putting it in a frame needs `srcdoc`, an HTML
  sink under this site's Trusted Types policy.
- **Fonts are named, not loaded:** the example documents declare no font
  files, so each preview falls back along its stack (the page says so).

## Performance

Measured 2026-10-31 on the static build (Chromium, gzip level 9, every
same-origin file loaded on open): 108.7 KB page, of which 62.8 KB is the
site shell's JavaScript (the page adds none), 26.9 KB CSS (the Texuli
components the previews render, and `brands.css` at 4.7 KB) and 17.9 KB of
HTML. That is over the 96 KB default, so `src/components/perf/budgets.ts`
sets the route to 113.1 KB (measured + 4%) with its reason; the HTML stays
inside the default 24 KB.

## Accessibility

- One `h1`; `h2` per section, `h3` per brand, surface and way to start.
- Each preview is a `figure` with a caption naming the surface and the brand;
  the bar chart is `role="img"` with a text alternative.
- The conformance table has a caption, column and row headers, and scrolls
  in a focusable, labelled region on narrow screens.
- Every preview's colors come from its brand's compiled variables, which the
  compiler holds to AA (Ledgerline's variant to AAA); the slide grows with
  its content so no text is clipped. Forced colors draw the chart bars and
  the slide and email edges in `CanvasText`.

## Validation

```bash
pnpm vitest run apps/website/tests/site-design-systems.test.ts
pnpm build
TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/e2e/site-design-systems.spec.ts tests/e2e/site-perf.spec.ts --project chromium
```
