/**
 * texuli.com performance budgets (T-site-perf): Lighthouse-style lab limits per
 * route. Sizes are deterministic and always checked; LCP is wall-clock and is
 * checked only with TEXULI_PERF=1 (tests/e2e/site-perf.spec.ts).
 *
 * - `htmlRawKb`, `htmlGzipKb`: the route's HTML document.
 * - `pageGzipKb`: every same-origin file the page loads on open, gzipped
 *   (HTML, CSS, JS, JSON, fonts, images).
 * - `jsGzipKb`: the JavaScript part of that.
 * - `cls`: cumulative layout shift during load (lab).
 * - `lcpMs`: largest contentful paint (lab, opt-in).
 */
import { PRIMITIVES } from '../primitives-page/primitives.ts';
export interface RouteBudget {
  htmlRawKb: number;
  htmlGzipKb: number;
  pageGzipKb: number;
  jsGzipKb: number;
  cls: number;
  lcpMs: number;
}

/**
 * Every page carries the docs sidebar: each component and primitive page is
 * linked (about 190 links, ~40 KB raw and ~3 KB gzip of HTML). The raw limit
 * leaves room for it; the gzip limit, what travels, is unchanged. Routes that
 * need more say why in ROUTE_BUDGET_OVERRIDES, with measured numbers.
 */
export const DEFAULT_BUDGET: Readonly<RouteBudget> = Object.freeze({
  htmlRawKb: 224,
  htmlGzipKb: 24,
  pageGzipKb: 96,
  jsGzipKb: 64,
  cls: 0.1,
  lcpMs: 2500,
});

export interface RouteBudgetOverride {
  route: string;
  /** Why the route needs more than the default. */
  reason: string;
  budget: Partial<RouteBudget>;
}

/**
 * Routes that legitimately carry more. Before T-site-perf they inlined every
 * theme (2.5 MB, 1.7 MB and 12.7 MB of HTML); now each theme is a same-origin
 * file loaded on demand, and these limits keep it that way.
 */
export const ROUTE_BUDGET_OVERRIDES: readonly RouteBudgetOverride[] = Object.freeze([
  // Measured on the static build (FIX-site-perf-routes): Chromium, gzip level 9,
  // every same-origin file loaded until the network is idle. Each limit is the
  // measurement rounded up a little; a route that fits the default has none.
  {
    route: '/',
    reason:
      'The unified landing (PLAN_006 T-44) ships zero islands; its module scripts wire the install copy command and the ready signal. The generous page and JS limits below are the old hero-widget floors, kept until T-93 right-sizes them.',
    budget: { pageGzipKb: 152, jsGzipKb: 116, lcpMs: 3000 },
  },
  {
    route: '/component-pages/button/',
    reason:
      'The first live Button demo mounts on open: its frame with real controls, then only the Button stage family (the props panel and other demos mount on scroll): 104.8 KB page, 67.6 KB JS at first; 72.5 KB JS measured 2026-10-27, so the owner raised the JS cap to 76 (measured + 4%, PLAN_006 follow-up). CLS room for the eager island mount.',
    budget: { pageGzipKb: 112, jsGzipKb: 76, cls: 0.15 },
  },
  {
    route: '/drag-page/',
    reason:
      'PLAN_007: the first screen is the drag workbench, three sortable surfaces (list, board, tree) on one @texuli/drag engine; the other demos load on scroll. Measured 108.5 KB page, 71.9 KB JS at the ready signal (+4% headroom).',
    budget: { pageGzipKb: 112, jsGzipKb: 76 },
  },
  {
    route: '/workflows-page/',
    reason:
      'PLAN_007: the workflow editor is the subject of the page and sits in the first screen (editor plus the workflow model). Measured 126.5 KB page, 92.3 KB JS (+4% headroom).',
    budget: { pageGzipKb: 132, jsGzipKb: 96 },
  },
  {
    route: '/workflows-page/json/',
    reason:
      'PLAN_007: the JSON live preview paints a real player tree on open (player, controls, sortable, workflow graph and the catalog validator). Measured 227.7 KB page, 190.4 KB JS (+4% headroom).',
    budget: { pageGzipKb: 236, jsGzipKb: 200 },
  },
  {
    route: '/component-pages/charts-pie/',
    reason:
      'The first live demo is a chart: the chart stage family and the part-whole chart chunk load on open: 113.9 KB page, 77.5 KB JS (104.4 KB JS before per-family stages); 124 KB page, 85.8 KB JS measured 2026-10-27, so the owner raised the caps to 132 and 92 (measured + 4%, rounded up to 4 KB; PLAN_006 follow-up).',
    budget: { pageGzipKb: 132, jsGzipKb: 92, cls: 0.15 },
  },
  {
    route: '/charts-page/',
    reason:
      'Every chart family renders its SVG demo and accessible data table statically. Measured 25.1 KB gzip at FIX-site-perf-routes; the PLAN_006 design audit (T-64..T-66) enriched the family demos and cards: 29.1 KB gzip, limit 30.',
    budget: { htmlGzipKb: 30 },
  },
  {
    route: '/brand/',
    reason:
      'The brand page tells the identity story with the real marks: the four PNG assets (logo and isotype, light and dark) load on open. Measured 114.9 KB page after T-83, limit 120.',
    budget: { pageGzipKb: 120 },
  },
  {
    route: '/blocks-page/',
    reason:
      'The blocks families render their demos statically; the PLAN_006 blocks audit (T-72/T-73) enriched the text, code, media and data demos: measured 97.1 KB page, limit 100.',
    budget: { pageGzipKb: 100 },
  },
  {
    route: '/builder/',
    reason:
      'The builder page mounts the BuilderApp studio island (structure tree, props and theme controls) on open: measured 31.7 KB gzip of HTML after the PLAN_006 builder polish (T-82). PLAN_007: the palette now lists the data, chat, workflows and state groups of the 158-id catalog inline, measured 234.9 KB raw (+4% headroom).',
    budget: { htmlGzipKb: 34, htmlRawKb: 248 },
  },
  {
    route: '/component-pages/',
    reason:
      'The catalog index lists every component with its summary and authoring guidance; the PLAN_006 catalog audit (T-81) added per-component guidance: measured 24.3 KB gzip, limit 26.',
    budget: { htmlGzipKb: 26 },
  },
  {
    route: '/web-and-native/',
    reason:
      'The architecture page mounts five sections — the layer diagrams, the correlation demo, the portability walk and the parity table (PLAN_006 T-52): measured 24.8 KB gzip, limit 26. PLAN_007: the layer diagrams gained @texuli/drag and @texuli/workflows and the nav three links, measured 96.4 KB page (+4% headroom).',
    budget: { htmlGzipKb: 26, pageGzipKb: 100 },
  },
  {
    route: '/gallery-themes/',
    reason:
      'The first 24 cards are in the HTML (18.8 KB gzip at FIX-site-perf-routes); the full 210-card list is fetched as /theme-gallery.json (17.9 KB) and each shown card loads its theme CSS. The PLAN_006 gallery audit (T-83) enriched the cards: 228.6 KB raw, 64.9 KB JS, limits 232 / 68.',
    budget: { htmlRawKb: 232, pageGzipKb: 132, jsGzipKb: 68 },
  },
  {
    route: '/theme-switcher/',
    reason:
      'The first themes are in the HTML; the full catalog is fetched as /theme-catalog.json. The PLAN_006 gallery audit (T-83) enriched the cards: measured 103.2 KB page, limit 108.',
    budget: { pageGzipKb: 108 },
  },
  {
    route: '/playground/',
    reason:
      'The playground stage mounts on open; the PLAN_006 studio polish (T-82) extended the presets: measured 100.6 KB page / 69.6 KB JS, limits 104 / 72.',
    budget: { pageGzipKb: 104, jsGzipKb: 72 },
  },
  {
    route: '/search/',
    reason:
      'The results island ships the static search index; it grew with the site content (PLAN_006 T-80/T-83): measured 104.4 KB page / 75.1 KB JS, limits 108 / 80.',
    budget: { jsGzipKb: 80, pageGzipKb: 108 },
  },
  {
    route: '/color-explorer/',
    reason:
      'The theme list and one theme payload are inline; other payloads load as /theme-data/<id>.json on selection. Measured 291.5 KB raw / 30.8 KB gzip before the docs sidebar; the PLAN_006 studio polish (T-82) enriched the controls: 311.2 KB raw / 34.1 KB gzip of HTML, 114.8 KB page / 64.8 KB JS, limits 316 / 36 / 120 / 68.',
    budget: { htmlRawKb: 316, htmlGzipKb: 36, pageGzipKb: 120, jsGzipKb: 68 },
  },
  {
    route: '/gallery-components/',
    reason:
      'The living gallery: server-rendered cards, each with its preview frame, light/dark and RTL controls, props toggle and tag filters. Measured 845.8 KB raw / 46.4 KB gzip at FIX-site-perf-routes; the PLAN_006 gallery audit (T-83) added card content: 888.2 KB raw / 48.5 KB gzip of HTML and 90.1 KB JS, limits 892 / 50 / 92. T-93 still owns slimming the raw size.',
    budget: { htmlRawKb: 892, htmlGzipKb: 50, pageGzipKb: 184, jsGzipKb: 92 },
  },
  {
    route: '/examples/',
    reason:
      'Every registered example as a card with its source (725.2 KB raw, 60.1 KB gzip of HTML); live demos mount as cards scroll into view: 196.3 KB page, 100 KB JS.',
    budget: { htmlRawKb: 736, htmlGzipKb: 64, pageGzipKb: 200, jsGzipKb: 104 },
  },
  // T-site-live-primitives: until its live demo scrolls into view a primitive
  // page's JavaScript stays within the default (tests/e2e/site-live-primitives.spec.ts
  // checks that too); these limits apply once the demo has loaded.
  ...PRIMITIVES.map((doc) => ({
    route: `/primitives-page/${doc.id}/`,
    reason:
      'The live demo (frame, props panel, the real primitive and its Texuli styles) loads when it scrolls into view, which is at open on a desktop viewport.',
    budget: { pageGzipKb: 160, jsGzipKb: 108 },
  })),
]);

export interface PrefixBudgetOverride {
  /** Applies to every route under this path, not to the path itself. */
  prefix: string;
  /** How the routes are written in the budgets table. */
  label: string;
  /** Why these routes need more than the default. */
  reason: string;
  budget: Partial<RouteBudget>;
}

/**
 * Families of routes that share one limit (FIX-site-perf-routes). An exact
 * entry in ROUTE_BUDGET_OVERRIDES wins over a prefix.
 */
export const ROUTE_PREFIX_BUDGETS: readonly PrefixBudgetOverride[] = Object.freeze([
  {
    prefix: '/examples/',
    label: '/examples/<id>/',
    reason:
      'Each example page mounts its live demo on open, which is its purpose, with the CSS of demos that share its chunks. Heaviest of 132: 184.2 KB raw and 29.2 KB gzip of HTML; 180.3 KB page, 111.9 KB JS.',
    budget: { htmlGzipKb: 32, pageGzipKb: 184, jsGzipKb: 116 },
  },
]);

/** The budget that applies to a route (normalized with a trailing slash). */
export function budgetFor(route: string): RouteBudget {
  const path = route.endsWith('/') ? route : `${route}/`;
  const override =
    ROUTE_BUDGET_OVERRIDES.find((entry) => entry.route === path) ??
    ROUTE_PREFIX_BUDGETS.find((entry) => path.startsWith(entry.prefix) && path !== entry.prefix);
  return { ...DEFAULT_BUDGET, ...override?.budget };
}

/** Elements that make an island worth hydrating: something a person can operate. */
export const INTERACTIVE_SELECTOR =
  'button, input, select, textarea, a[href], summary, [tabindex], [contenteditable="true"], [role="button"], [role="slider"], [role="switch"], [role="tab"], [role="menuitem"], [role="option"]';

/**
 * Islands that hydrate to show output for another control rather than to be
 * operated themselves, each with its reason. Every other island must contain
 * something a person can operate.
 */
export const OUTPUT_ISLANDS: Readonly<Record<string, string>> = Object.freeze({
  SearchResults: 'Renders the results of the search field; empty until a query is typed.',
});

/** Whether an island's component URL names an allowed output island. */
export function isOutputIsland(componentUrl: string): boolean {
  const file = componentUrl.split('/').pop() ?? '';
  return Object.keys(OUTPUT_ISLANDS).some((name) => file.startsWith(`${name}.`));
}
