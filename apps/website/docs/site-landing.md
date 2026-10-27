# texuli.com landing system

**App:** `apps/website`  
**Pages:** `/` (unified landing), `/native/` (native landing), with the
architecture reading page `/web-and-native/` as their deep link  
**Components:** `src/components/sections/web/`, `src/components/sections/native/`,
`src/components/sections/architecture/`  
**Tasks:** PLAN_006 T-15 (narrative), T-40..T-44 (web sections and
assembly), T-45..T-48 (native), T-49..T-52 (architecture), T-79 and T-84
(polish and copy)

## Purpose

The landing sells a platform, not only a library: one owned component
catalog, shipped for the web in Svelte 5 today, with the same catalog
contract driving a Kotlin Multiplatform renderer in development. The
recorded hero choice keeps "Interfaces from texels." as the `h1` and lets
the eyebrow and sub-message carry the platform story; an audience split
("Build for web / Build native") was rejected because it reads as two
products. Every claim states shipped, in-development and planned work as
such.

## Layout

The home page does **not** use the docs sidebar. It uses `BaseLayout` with
`landing` and the shared `SiteHeader` (slim header; docs shell lives on guide
routes). Its four content sections are static Astro output; the shared header's
search and theme controls are the only two client islands on the page.
The route, door and shell decisions are in [site-subsite.md](site-subsite.md).

## Sections (top to bottom)

1. `WebHero`: “Interfaces from texels.”, platform claim, proof strip and calls to action
2. `WebWhySvelte`: why Texuli uses Svelte for the web
3. `WebCorrelation`: one contract, two projections, linked to the architecture page
4. `WebAgentsCta`: agent-safe renderer story and closing call to action
5. Shared footer: llms.txt, skill, changelog and MIT (Dailybot, Inc.)

No page-body island is needed: the previous interactive widget and playground
islands were removed in favor of static, link-led sections. `SiteSearch` and
`ThemeSwitch` remain `client:load` because the header exposes them immediately.
Two small module scripts ride inside the sections and are not islands: the
install-command copy button (`web-copy-command.ts`, which sends `code_copy`
only after a successful clipboard write) and the opt-in scroll reveal
(reduced-motion and support gated, never on the hero).

## Structure: component + content module

Every section is a pair: an Astro component that owns markup and styles,
and a plain TypeScript content module that owns the words, links and
counts. Tests import the content module directly, so copy and targets are
checked without a browser.

| Section | Component | Content |
| --- | --- | --- |
| Hero | `sections/web/WebHero.astro` | `web-hero-content.ts` (proof-strip counts come from the same sources the linked pages render; the theme moment is build-time token data) |
| Why Svelte | `sections/web/WebWhySvelte.astro` | `web-why-svelte-content.ts` |
| Correlation | `sections/web/WebCorrelation.astro` (also mounted on `/web-and-native/`) | `web-correlation-content.ts` |
| Agents + close | `sections/web/WebAgentsCta.astro` | `web-agents-content.ts`, `web-copy-command.ts` |
| Native hero + status | `sections/native/NativeHeroStatus.astro` | `native-hero-content.ts` |
| Why KMP | `sections/native/WhyKmp.astro` | `why-kmp-content.ts` |
| Native evidence + roadmap | `sections/native/NativeEvidenceRoadmap.astro` | `native-evidence-data.ts` |
| Architecture diagrams, portability, parity | `sections/architecture/*.astro` | `layers-data.ts`, `portability-content.ts`, `parity-data.ts` |

Page composition lives in `src/pages/index.astro`, `src/pages/native/index.astro`
and `src/pages/web-and-native/index.astro`. Native and architecture details:
[site-native.md](site-native.md), [site-architecture.md](site-architecture.md).

## Illustrations

`src/components/landing/SiteIllustration.astro` + `src/data/illustrations.json`.
Files optional under `public/illustrations/<file>.webp`. Missing files
render a token gradient fallback (width/height, lazy, async decode, alt
required). The current home sections do not use it; `PageBanner` does
(for example on `/changelog/`).

## Spec map

| Behavior | Pinned by |
| --- | --- |
| Section content, targets and honesty per section | `apps/website/tests/section-contracts.test.ts`, `analytics-client.test.ts` |
| Native sections | `apps/website/tests/section-contracts.test.ts` |
| Architecture sections | `apps/website/tests/section-contracts.test.ts` |
| Proof-strip sources, home title band, motion rules, footer release truth | `apps/website/tests/landing.test.ts` |
| Banned claims the repository contradicts (size, native targets, parity) | `apps/website/tests/copy-honesty.test.ts` |
| Four sections in blueprint order, no islands inside `[data-tx-landing]`, CTAs, the announced install copy, reveal under reduced motion | `tests/e2e/site-landing.spec.ts` |
| Landing header on desktop and phone | `tests/e2e/site-ia.spec.ts` |
| axe in light and dark | the page sweep, `tests/e2e/a11y-site.spec.ts` |
| Phone width (360 and 768 px, right to left too) | `tests/e2e/site-responsive.spec.ts` |
| Page weight against the `/` budget | `tests/e2e/site-perf.spec.ts` |

```bash
pnpm vitest run apps/website/tests/section-contracts.test.ts apps/website/tests/copy-honesty.test.ts
pnpm build
TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/e2e/site-landing.spec.ts tests/e2e/site-ia.spec.ts --project=chromium
```

## How to extend

- **Change copy or a link:** edit the content module, not the component;
  the section test checks every target is a real route.
- **A new section:** add the component + content module pair under
  `sections/<area>/`, mount it in the page, give it a unit test and update
  the section-order assertion in `site-landing.spec.ts`. Keep it static; an island on the landing needs a
  reason and a budget check.
- **A new claim:** cite where the repository proves it. If the claim is
  planned, say so in the copy; add any phrase the repository contradicts
  to `copy-honesty.test.ts`.

## Deviations and limits

- **Static by design.** The interactive hero widgets and the agents
  playground were replaced by static, link-led sections; the live demos
  live on the docs and gallery pages.
- **The `/` budget is no longer a tracked red:** the local T-92 run
  measured 83.8 KB against the 152 KB `/` limit in
  `components/perf/budgets.ts` (see [site-ia.md](site-ia.md)).
  `/web-and-native/` has its own HTML budget there (26 KB gzip);
  `/native/` fits the default and has none.
- **Rendered theme checks:** the highlighted `mark` in `WebCorrelation`
  and the `WebAgentsCta` band use `color-mix()`; the static theme sweep
  does not measure them ([site-theme-sweep.md](site-theme-sweep.md)).

## Gates

- `pnpm build` (website)
- `tests/e2e/site-landing.spec.ts`
- `a11y-site` and `site-perf` (route budget for `/` with reason)
