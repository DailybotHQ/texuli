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
      'The landing hydrates the hero live widgets (slider, tabs, date picker, lazy chart) on load: 144.5 KB page, 109.2 KB JS.',
    budget: { pageGzipKb: 152, jsGzipKb: 116, lcpMs: 3000 },
  },
  {
    route: '/component-pages/button/',
    reason:
      'The first live Button demo mounts on open: its frame with real controls, then only the Button stage family (the props panel and other demos mount on scroll): 104.8 KB page, 67.6 KB JS. CLS room for the eager island mount.',
    budget: { pageGzipKb: 112, jsGzipKb: 72, cls: 0.15 },
  },
  {
    route: '/component-pages/charts-pie/',
    reason:
      'The first live demo is a chart: the chart stage family and the part-whole chart chunk load on open: 113.9 KB page, 77.5 KB JS (104.4 KB JS before per-family stages).',
    budget: { pageGzipKb: 120, jsGzipKb: 80, cls: 0.15 },
  },
  {
    route: '/charts-page/',
    reason:
      'Every chart family renders its SVG demo (37.7 KB) and accessible data table (28.4 KB) statically: 174.5 KB raw, 25.1 KB gzip of HTML.',
    budget: { htmlGzipKb: 28 },
  },
  {
    route: '/gallery-themes/',
    reason:
      'The first 24 cards are in the HTML (18.8 KB gzip); the full 210-card list is fetched as /theme-gallery.json (17.9 KB) and each shown card loads its theme CSS: 129.8 KB page.',
    budget: { pageGzipKb: 132 },
  },
  {
    route: '/theme-switcher/',
    reason:
      'The first themes are in the HTML (15.5 KB gzip); the full catalog is fetched as /theme-catalog.json (9.1 KB): 97.4 KB page.',
    budget: { pageGzipKb: 100 },
  },
  {
    route: '/color-explorer/',
    reason:
      'The theme list and one theme payload are inline (291.5 KB raw, 30.8 KB gzip); other payloads load as /theme-data/<id>.json on selection: 108 KB page. The docs sidebar (every component and primitive linked) added 5.9 KB raw / 1.3 KB gzip: measured 297.4 / 32.1.',
    budget: { htmlRawKb: 304, htmlGzipKb: 34, pageGzipKb: 112 },
  },
  {
    route: '/gallery-components/',
    reason:
      'The living gallery: 125 server-rendered cards, each with its preview frame, light/dark and RTL controls, props toggle and tag filters (845.8 KB raw, 46.4 KB gzip of HTML). Previews load in isolated iframes only as cards scroll near and the props panel on first open: 176.2 KB page, 84.6 KB JS.',
    budget: { htmlRawKb: 880, htmlGzipKb: 48, pageGzipKb: 184, jsGzipKb: 88 },
  },
  {
    route: '/examples/',
    reason:
      'Every registered example as a card with its source (725.2 KB raw, 60.1 KB gzip of HTML); live demos mount as cards scroll into view: 196.3 KB page, 100 KB JS.',
    budget: { htmlRawKb: 736, htmlGzipKb: 64, pageGzipKb: 200, jsGzipKb: 104 },
  },
  {
    route: '/search/',
    reason: 'The results island ships the static search index: 64.7 KB JS.',
    budget: { jsGzipKb: 68 },
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
