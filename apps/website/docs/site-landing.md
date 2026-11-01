# texuli.com landing system

**App:** `apps/website`  
**Pages:** `/` (unified landing), `/native/` (native landing), with the
architecture reading page `/web-and-native/` as their deep link  
**Components:** `src/components/sections/home/` (the landing),
`src/components/sections/web/WebCorrelation.astro` (on `/web-and-native/`),
`src/components/sections/native/`, `src/components/sections/architecture/`  
**Tasks:** PLAN_012 (the illustrated landing); earlier PLAN_006 T-15, T-40..T-52,
T-79 and T-84

## Purpose

The landing sells a platform in pictures, not paragraphs: one owned Svelte 5
component library for building any interface, with a Kotlin Multiplatform
renderer in development and agent safety built in. It follows
deepworkplan.com's band pattern (a hero, alternating illustrated story
bands, a proof band, a quickstart, a final call to action) in the 3D texel
style of the social image ([ILLUSTRATIONS.md](ILLUSTRATIONS.md)). Every band
keeps its body to about 40 words, the page carries no code block, and every
claim links to the page that proves it. Counts are computed, never typed.

## Layout

The home page does **not** use the docs sidebar. It uses `BaseLayout` with
`landing` and the shared `SiteHeader`. All bands are static Astro output; the
header's search and theme controls are the only client islands. One small
module script rides inside the bands and is not an island: the install-command
copy button (`CopyCommand.astro` on `web-copy-command.ts`, which sends
`code_copy` only after a successful clipboard write). The opt-in scroll reveal
is CSS only, gated on reduced motion and scroll-timeline support, never on the
hero. The route, door and shell decisions are in [site-subsite.md](site-subsite.md).

## Bands (top to bottom)

| # | Band | Component | Art slot |
| --- | --- | --- | --- |
| 1 | Hero: badge, "Build any **interface.**", sub, three calls to action, install line, computed proof row | `HomeHero.astro` | `home-hero` (eager) |
| 2 | Pitch: "Small pieces. Infinite possibilities.", texels → primitives → components → apps | `HomePitch.astro` | `home-pieces` |
| 3–7 | Stories: Universal, Web + native, Your brand, For agents, Accessible. Each has a topic kicker with a texel mark that grows one cube per band (no numbered acts), and the art alternates end/start | `HomeStories.astro` → `LandingStory.astro`, `TexelMark.astro` | `home-universe`, `home-web-native`, `home-design-systems`, `home-agents`, `home-accessible` |
| 8 | Proof: published packages, blueprint catalog, agent-emittable components | `HomeProof.astro` | none |
| 9 | Quickstart: install, pick a theme, compose | `HomeQuickstart.astro` | `home-quickstart` |
| 10 | Final call to action: "Start with one texel." | `HomeFinal.astro` | `home-final` (band) |

Landing tokens (the brand violet, the lavender-to-peach ground, dark and high-contrast overrides) and the shared call-to-action styles live in `sections/home/home.css`.

## Structure: components + one content module

Words, links and counts live in `sections/home/home-content.ts`. Build-time data lives in `home-data.ts`: the library themes, the theme count, catalog, primitives and examples counts, and published packages. The native slice is parsed from `NativeRegistry` against the spec catalog. Tests import these modules directly, so copy budgets and targets are checked without a browser.

| Section | Component | Content |
| --- | --- | --- |
| Landing bands | `sections/home/*.astro` | `home-content.ts`, `home-data.ts` |
| Correlation (on `/web-and-native/`) | `sections/web/WebCorrelation.astro` | `web-correlation-content.ts` |
| Native hero + status | `sections/native/NativeHeroStatus.astro` | `native-hero-content.ts` |
| Why KMP | `sections/native/WhyKmp.astro` | `why-kmp-content.ts` |
| Native evidence + roadmap | `sections/native/NativeEvidenceRoadmap.astro` | `native-evidence-data.ts` |
| Architecture diagrams, portability, parity | `sections/architecture/*.astro` | `layers-data.ts`, `portability-content.ts`, `parity-data.ts` |

Page composition lives in `src/pages/index.astro`, `src/pages/native/index.astro`
and `src/pages/web-and-native/index.astro`. Native and architecture details:
[site-native.md](site-native.md), [site-architecture.md](site-architecture.md).

## Illustrations

Each band's art is a `SiteIllustration` slot from `src/data/illustrations.json`. Until its WebP file lands in `public/illustrations/`, the slot paints a texel mosaic in the illustration palette with the same aspect ratio, so the layout never shifts. The style, sizes and drop-in steps are in [ILLUSTRATIONS.md](ILLUSTRATIONS.md); the generated prompts are in [illustration-prompts.md](illustration-prompts.md).

## Spec map

| Behavior | Pinned by |
| --- | --- |
| Section content, targets and honesty per section | `apps/website/tests/section-contracts.test.ts`, `analytics-client.test.ts` |
| Native sections | `apps/website/tests/section-contracts.test.ts` |
| Architecture sections | `apps/website/tests/section-contracts.test.ts` |
| Band copy budgets and routes, computed counts (proof, native slice), band order, home title band, motion rules, footer release truth | `apps/website/tests/landing.test.ts` |
| Illustration slots and prompts | `apps/website/tests/illustrations.test.ts` |
| Banned claims the repository contradicts (size, native targets, parity) | `apps/website/tests/copy-honesty.test.ts` |
| Ten bands in order, alternating art and growing texel marks, no islands or code blocks inside `[data-tx-landing]`, CTAs, the announced install copy, the art below the copy on a phone, reveal under reduced motion | `tests/e2e/site-landing.spec.ts` |
| Landing header on desktop and phone | `tests/e2e/site-ia.spec.ts` |
| axe in light and dark | the page sweep, `tests/e2e/a11y-site-<n>.spec.ts` |
| Phone width (360 and 768 px, right to left too) | `tests/e2e/site-responsive.spec.ts` |
| Page weight against the `/` budget | `tests/e2e/site-perf.spec.ts` |

```bash
pnpm vitest run apps/website/tests/landing.test.ts apps/website/tests/illustrations.test.ts apps/website/tests/section-contracts.test.ts apps/website/tests/copy-honesty.test.ts
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
  and the landing bands use `color-mix()`; the static theme sweep
  does not measure them ([site-theme-sweep.md](site-theme-sweep.md)).

## Gates

- `pnpm build` (website)
- `tests/e2e/site-landing.spec.ts`
- `a11y-site` and `site-perf` (route budget for `/` with reason)
