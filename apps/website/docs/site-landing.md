# texuli.com landing system

**App:** `apps/website`  
**Pages:** `/` (unified landing, Home 2.2), `/native/` (native landing), with the
architecture reading page `/web-and-native/` as their deep link  
**Components:** `src/components/sections/home/` (the landing),
`src/components/sections/web/WebCorrelation.astro` (on `/web-and-native/`),
`src/components/sections/native/`, `src/components/sections/architecture/`  
**Tasks:** PLAN_015 (Home 2.2); earlier PLAN_012 (the illustrated landing) and
PLAN_006 T-15, T-40..T-52, T-79 and T-84

## Purpose

The landing tells the whole ecosystem in pictures, not paragraphs: what Texuli is,
that it builds interfaces for the web today and brings the same contracts to native,
that it ships complete Solutions as well as components, that people and agents share
its contracts, and that real products are built with it. It follows the band pattern
(a hero, illustrated bands, a final call to action) in the 3D texel style of the social
image ([ILLUSTRATIONS.md](ILLUSTRATIONS.md)). Every band keeps its body to about 40
words, the page carries no code block, and every claim links to the page that proves
it. Counts are computed, never typed.

## Layout and the static-home rule

The home page does **not** use the docs sidebar. It uses `BaseLayout` with `landing`
and the shared `SiteHeader`. **The home stays static (ADR-030): no client island inside
the landing.** The header's search and theme controls are the only islands on `/`, as on
every page. One small module script rides inside the hero and is not an island: the
install-command copy button (`CopyCommand.astro` on `web-copy-command.ts`, which sends
`code_copy` only after a successful clipboard write). It is the only copy command on
the page. The opt-in scroll reveal is CSS only, gated on reduced motion and
scroll-timeline support, never on the hero. Live demos belong to the Solution landings
(one island each), not to the home. The route, door and shell decisions are in
[site-subsite.md](site-subsite.md).

## Bands (top to bottom)

The order has one source, `HOME_BANDS` in `sections/home/home-content.ts`. Nine bands
carry the ten storyboard messages: "same contracts, platform-native experiences" rides
with Web & Native.

| # | Band | Component and copy | Art slot |
| --- | --- | --- | --- |
| 1 | Hero: eyebrow and "What's new" link, "Build any **interface.**", subhead, Web / Native status line, Explore solutions · Explore native · Get started, install line, computed proof row | `hero-22/HomeHero22.astro`, `hero-22/hero-content.ts` | `home-hero` (eager) |
| 2 | Small pieces: "Small pieces. Infinite possibilities.", texels → primitives → components → Solutions | `HomePitch.astro`, `HOME_PITCH` | `home-pieces` |
| 3 | Web & Native, in the first half: "Your interfaces shouldn't stop at the browser.", three platform cards (web, Compose Desktop, Android and iOS) with statuses and counts from the generated compatibility data, CTA to `/native/` | `web-native/HomeWebNative.astro`, `web-native-content.ts` | `home-web-native` |
| 4 | Complete Solutions: one card per registry Solution with Web and Native tags; a card links its landing when the page exists | `solutions/HomeSolutions.astro`, `solutions-content.ts` | `home-universe` |
| 5 | Built for humans and agents: catalog, MCP (remote and local), skill and validation, each with its status | `agents-22/HomeAgents22.astro`, `agents-content.ts` | `home-agents` |
| 6 | Design systems: "Your brand in one JSON file." with six library theme swatches (a kept story) | `HomeStories.astro` → `LandingStory.astro`, `HOME_STORIES` | `home-design-systems` |
| 7 | Built with Texuli: listed products (Protoyard), offerings split into Today and Roadmap | `built-with/HomeBuiltWith.astro`, `built-with-content.ts` | `home-built-with` |
| 8 | Accessible and owned, with the computed proof row (published packages, blueprint catalog, agent-emittable components) inside the story | `LandingStory.astro` with `HOME_OWN`, rendered in `index.astro` | `home-accessible` |
| 9 | Close: "Build your next interface.", two paths: integrate a Solution, prototype with Protoyard | `final-22/HomeFinal22.astro`, `final-content.ts` | `home-final` (band) |

The two kept stories alternate their art (end, start) and carry a texel mark that grows
one cube per story. No longer rendered on `/`: the first hero, the separate proof band,
the quickstart band and the old final band (`HomeHero.astro`, `HomeProof.astro`,
`HomeQuickstart.astro`, `HomeFinal.astro` remain in the tree). Landing tokens (the
brand violet, the lavender-to-peach ground, dark and high-contrast overrides), the shared
call-to-action styles and the merged proof row live in `sections/home/home.css`.

## Structure: components + content modules

Each Home 2.2 band keeps its copy in a content module beside its component. The bands
kept from the first landing read `sections/home/home-content.ts`. Build-time data lives
in `home-data.ts` (library themes, theme count, catalog, primitives and examples counts,
published packages), in the Solutions registry (`src/data/solutions/`), the products
data (`src/data/products/`) and the native compatibility data
(`src/data/native/compatibility.ts`, from `native/docs/parity.json`). Links to Solution
landings and product pages appear only when the page exists (`siteRouteExists`). Tests
import these modules directly, so copy budgets and targets are checked without a browser.

| Section | Component | Content |
| --- | --- | --- |
| Landing bands | `sections/home/*.astro` and `sections/home/<band>/` | `home-content.ts`, `home-data.ts`, each band's content module |
| Correlation (on `/web-and-native/`) | `sections/web/WebCorrelation.astro` | `web-correlation-content.ts` |
| Native hero + status | `sections/native/NativeHeroStatus.astro` | `native-hero-content.ts` |
| Why KMP | `sections/native/WhyKmp.astro` | `why-kmp-content.ts` |
| Native evidence + roadmap | `sections/native/NativeEvidenceRoadmap.astro` | `native-evidence-data.ts` |
| Architecture diagrams, portability, parity | `sections/architecture/*.astro` | `layers-data.ts`, `portability-content.ts`, `parity-data.ts` |

Page composition lives in `src/pages/index.astro`, `src/pages/native/index.astro`
and `src/pages/web-and-native/index.astro`. Native and architecture details:
[site-native.md](site-native.md), [site-architecture.md](site-architecture.md). The
Solutions system is in [site-solutions.md](site-solutions.md).

## Illustrations

Each band's art is a `SiteIllustration` slot from `src/data/illustrations.json`, filled
by its WebP in `src/assets/illustrations/`. Every home slot has its file except
`home-built-with`, which is registered but has no WebP yet, so it paints the texel
mosaic. Across the site, 15 of the 43 slots are still waiting for their files (the
Solution heroes, the Built-with and Solutions page art, and the new native slots). A
slot whose file is missing paints a texel mosaic in the illustration palette with the
same aspect ratio, so the layout never shifts. The style, sizes and drop-in steps are in
[ILLUSTRATIONS.md](ILLUSTRATIONS.md); the generated prompts are in
[illustration-prompts.md](illustration-prompts.md).

## Budget of `/` (measured 2026-11-08, on the built site)

| Measure | Value | Budget (`components/perf/budgets.ts`) |
| --- | --- | --- |
| Page weight (`site-perf.spec.ts`, chromium) | 437.8 KB | 512 KB |
| JavaScript | 44.2 KB | 116 KB |
| HTML gzip | 15.8 KB | 24 KB (default) |
| Islands inside the landing | 0 | 0 (`maxIslands`) |

## Spec map

| Behavior | Pinned by |
| --- | --- |
| Section content, targets and honesty per section | `apps/website/tests/section-contracts.test.ts`, `analytics-client.test.ts`, `apps/website/tests/solutions/home-*.test.ts` |
| Native sections | `apps/website/tests/section-contracts.test.ts` |
| Architecture sections | `apps/website/tests/section-contracts.test.ts` |
| Band order (`HOME_BANDS`), the ten messages, static rendering, copy budgets and routes of the kept bands, computed counts, home title band, motion rules, footer release truth | `apps/website/tests/landing.test.ts` |
| Illustration slots and prompts | `apps/website/tests/illustrations.test.ts` |
| Banned claims the repository contradicts (size, native targets, parity) | `apps/website/tests/copy-honesty.test.ts` |
| Nine bands in order with Web & Native in the first half, the two stories' art sides and texel marks, the proof row in the accessible story, one h1, the hero status line and CTAs, no islands or code blocks inside `[data-tx-landing]`, the announced install copy, the art below the copy on a phone, reveal under reduced motion | `tests/e2e/site-landing.spec.ts` |
| The hero "What's new" link to the release hub | `tests/e2e/site-whats-new.spec.ts` |
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

- **Change copy or a link:** edit the band's content module, not the component;
  the section tests check every target is a real route.
- **A new band:** add the component + content module pair under
  `sections/home/<band>/`, add it to `HOME_BANDS` with the storyboard message it carries,
  mount it in `index.astro`, give it a unit test, and update the order assertion in
  `site-landing.spec.ts`. Keep it static: the home takes no island (ADR-030).
- **A new claim:** cite where the repository proves it. If the claim is
  planned, say so in the copy; add any phrase the repository contradicts
  to `copy-honesty.test.ts`.

## Deviations and limits

- **Static by design.** The interactive hero widgets and the agents
  playground were replaced by static, link-led sections; the live demos
  live on the Solution landings, the docs and the gallery pages.
- **`/` budget:** the limits in `components/perf/budgets.ts` are the old floors
  (512 KB page, 116 KB JS); Home 2.2 measures well inside them (table above).
  `/web-and-native/` has its own HTML budget there; `/native/` has its own page budget.
- **Rendered theme checks:** the highlighted `mark` in `WebCorrelation`
  and the landing bands use `color-mix()`; the static theme sweep
  does not measure them ([site-theme-sweep.md](site-theme-sweep.md)).

## Gates

- `pnpm build` (website)
- `tests/e2e/site-landing.spec.ts`
- `a11y-site` and `site-perf` (route budget for `/` with reason)
