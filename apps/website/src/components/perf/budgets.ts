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
  // PLAN_011 Final Review (2026-10-30): the header's search trigger imported
  // the `Command` namespace object, which pulled the whole command palette
  // and its dialog stack into every page; importing `CommandTrigger` alone
  // cut the shared shell by about 22.5 KB gzip of JavaScript on every route
  // (a shell-only page: 95.4 -> 72.8 KB page, 63.1 -> 40.5 KB JS). The
  // measurements quoted below predate that; the limits are unchanged.
  {
    route: '/',
    reason:
      'The unified landing (PLAN_006 T-44) ships zero islands; its module scripts wire the install copy command and the ready signal. The generous page and JS limits below are the old hero-widget floors, kept until T-93 right-sizes them. PLAN_012 illustrations (2026-11-01): the generated WebP illustrations (6 of them load on open: the eager hero and the lazy plates within the browser’s load-ahead distance) add 936.1 KB; measured 1008.2 KB page, limit 1049 (+4% headroom).',
    budget: { pageGzipKb: 1049, jsGzipKb: 116, lcpMs: 3000 },
  },
  {
    route: '/component-pages/button/',
    reason:
      'The first live Button demo mounts on open: its frame with real controls, then only the Button stage family (the props panel and other demos mount on scroll): 104.8 KB page, 67.6 KB JS at first; 72.5 KB JS measured 2026-10-27, so the owner raised the JS cap to 76 (measured + 4%, PLAN_006 follow-up). PLAN_007 grew the shared shell (nav, search and footer credit): 112.9 KB page measured 2026-10-27, cap 118 (measured + 4%). CLS room for the eager island mount. PLAN_010 (motion and the API contract in the shared components): measured 77.2 KB JS, limit 81 (+4% headroom). PLAN_010 (motion and the API contract in the shared components): measured 118.1 KB page, limit 123 (+4% headroom). PLAN_010 T-site-080 (measured 2026-10-29 on f9809246 with this task’s pages; none of its islands loads on this route, and swapping its one texuli root import left the number unchanged): the shared component code of the 0.8.0 wave (the texuli and primitives labels moved to the i18n message catalog, and the SSR-safe Select.Value): measured 81.3 KB JS and 122.2 KB page, limits 85 and 128 (+4% headroom).',
    budget: { pageGzipKb: 128, jsGzipKb: 85, cls: 0.15 },
  },
  {
    route: '/slides-page/',
    reason:
      'PLAN_008: four lazy deck islands (the flagship deck, the live JSON and Markdown editors, the galleries). JS at the ready signal equals the island-free baseline; the page total is Astro hoisting the CSS of the lazily imported stage, layout and player chunks into <head>. Measured 160.1 KB page, 55.1 KB JS and 25.4 KB gzip of HTML (+4% headroom). Follow-up: ship the deck and player CSS as one lazily loaded stylesheet.',
    budget: { pageGzipKb: 168, jsGzipKb: 60, htmlGzipKb: 27 },
  },
  {
    route: '/drag-page/',
    reason:
      'PLAN_007: the first screen is the drag workbench, three sortable surfaces (list, board, tree) on one @texuli/drag engine; the other demos load on scroll. Measured 108.5 KB page, 71.9 KB JS at the ready signal (+4% headroom).',
    budget: { pageGzipKb: 112, jsGzipKb: 76 },
  },
  {
    route: '/motion-page/',
    reason:
      'PLAN_010 T-site-060: nine lazy motion islands (client:visible); only the settings panel is near the first screen, so JS at the ready signal is 57.3 KB, inside the default. The page total is Astro hoisting into <head> the CSS of every chunk the islands can import lazily (the player loaders, the Board, the overlays): 72 stylesheets. The HTML carries the server-rendered spring plot, the tokens tables, the blueprint JSON and the API contract. Measured 2026-10-29: 154.8 KB page, 26.3 KB gzip of HTML (+4% headroom). Follow-up shared with /slides-page/: ship the player CSS as one lazily loaded stylesheet. PLAN_010 T-site-features (every animation): four more lazy islands (every preset, every moving component, the spring lab, the deck on the slides stage) and the build-time inventory (every export, custom property, adopter and slide transition) in the HTML; the slides stage CSS joins the hoisted stylesheets. Measured 2026-10-29: 188.9 KB page, 59.2 KB JS at the ready signal, 230.1 KB raw and 35.6 KB gzip of HTML (+4% headroom; a proposal for the owner). PLAN_011 T-adopt-core (2026-10-30): components read their design tokens (ADR-020, second amendment); measured 195.8 KB page (+4% headroom).',
    budget: { pageGzipKb: 204, htmlGzipKb: 38, htmlRawKb: 240 },
  },
  {
    route: '/documents-page/',
    reason:
      'PLAN_010 T-site-070: three lazy document islands (client:visible) that import the editor, the reader, the paged view, the collaboration layer, the writers and the player only after they hydrate, so JS at the ready signal is 57.6 KB, inside the default. The page total is Astro hoisting into <head> the CSS of every chunk those islands can import lazily (pages, editor, player loaders, charts): 69.5 KB of CSS, the same follow-up as /motion-page/ and /slides-page/. Measured 2026-10-29: 147.5 KB page (+4% headroom). PLAN_011 T-ar-discovery (2026-10-30): already at 154.2 KB on release/0.9.0 before this change, and every page now carries <link rel="ai-catalog"> (about 0.1 KB): measured 154.3 KB, limit 161 (+4% headroom). PLAN_011 (token-driven components and design-system wiring through 0.10.0): measured 161.2 KB page on 2026-10-31 (+4% headroom). PLAN_012 illustrations (2026-11-01): the generated WebP banner adds 104.7 KB; measured 243.4 KB page, limit 254 (+4% headroom).',
    budget: { pageGzipKb: 254 },
  },
  {
    route: '/forms-page/',
    reason:
      'PLAN_010 T-site-features: seven lazy form islands (client:visible); the player loads only in the agent demo, after hydration, so JS at the ready signal is 59.2 KB, inside the default. The page total is Astro hoisting into <head> the CSS of every chunk the islands can import (SchemaForm and every texuli control it paints, the player loaders), the same follow-up as /motion-page/. The HTML carries the field-type, rule and keyboard tables and the agent blueprint JSON. Measured 2026-10-29: 161.4 KB page, 27 KB gzip of HTML (+4% headroom; a proposal for the owner). PLAN_010 T-site-080: the field gallery and the flow server-render again (the Select.Value SSR fix in 0232cda5 removed the paint-after-mount workaround), and the nav gained four links: measured 30.4 KB gzip of HTML, limit 32 (+4% headroom). CI on Linux: the field gallery sits at the 720 px fold (system fonts), so it hydrates on open there: 267.5 KB page, 162 KB JS measured 2026-10-30 (+4% headroom). PLAN_011 T-gaps-113-121 (the gallery shows all 20 field types, including password, otp, color and datetime, with each lazy control loaded once visible): CI on Linux measured 293.4 KB page on 2026-10-31 (+4% headroom). JS measured 177.2 KB on CI Linux the same day (+4% headroom).',
    budget: { pageGzipKb: 306, jsGzipKb: 185, htmlGzipKb: 32 },
  },
  {
    route: '/canvas-page/',
    reason:
      'PLAN_010 T-site-features: three lazy canvas islands (client:visible) that import the editor, the sync layer and the player only after they hydrate, so JS at the ready signal is 59.2 KB, inside the default. The page total is Astro hoisting into <head> the CSS of every chunk those islands can import (the canvas editor, the player loaders), the same follow-up as /motion-page/. Measured 2026-10-29: 147.1 KB page, 20.7 KB gzip of HTML (+4% headroom; a proposal for the owner). PLAN_011 T-adopt-core (2026-10-30): components read their design tokens (ADR-020, second amendment); measured 152.4 KB page (+4% headroom). PLAN_012 illustrations (2026-11-01): the generated WebP banner adds 105.2 KB; measured 238.9 KB page, limit 249 (+4% headroom).',
    budget: { pageGzipKb: 249 },
  },
  {
    route: '/sheets-page/',
    reason:
      'PLAN_010 T-site-080: four lazy sheet islands (client:visible); the player and the sheet host load only in the agent demo, after hydration, so JS at the ready signal is 61.3 KB, inside the default. The page total is Astro hoisting into <head> the CSS of every chunk the islands can import (SheetView over the editable data grid, the player loaders), the same follow-up as /motion-page/. The HTML carries all 54 functions with their build-time results, the dependency graph, the safety cases and the agent blueprint. Measured 2026-10-29: 157.3 KB page, 226.8 KB raw and 29.3 KB gzip of HTML (+4% headroom; a proposal for the owner). PLAN_011 T-gaps-100-104 (FilterBuilder issues and grid styling on token v2): CI on Linux measured 164.2 KB page on 2026-10-30 (+4% headroom). PLAN_012 illustrations (2026-11-01): the generated WebP banner adds 129.9 KB; measured 271.7 KB page, limit 283 (+4% headroom).',
    budget: { pageGzipKb: 283, htmlRawKb: 236, htmlGzipKb: 31 },
  },
  {
    route: '/showcase/dashboard/',
    reason:
      'PLAN_011 T-adopt-core (ADR-020, second amendment): components read their design tokens so a design system can restyle every component; base.css carries the system token defaults once (+1.1 KB) and component CSS the token reads (+1.5 KB). Every route grew 2.3–5.1 KB; this showcase, at 94.8 KB before, crosses the 96 KB default. Measured 97.6 KB page on 2026-10-30 (+4% headroom). Trimming is a Final Review follow-up.',
    budget: { pageGzipKb: 102 },
  },
  {
    route: '/foundation/',
    reason:
      'PLAN_011 T-adopt-core (ADR-020, second amendment): components read their design tokens so a design system can restyle every component (base.css system defaults plus one-fallback reads), which takes this route, under the 96 KB default before, to its edge. Measured 94.7 KB page on 2026-10-30 (+4% headroom). Trimming is a Final Review follow-up.',
    budget: { pageGzipKb: 99 },
  },
  {
    route: '/showcase/',
    reason:
      'PLAN_011 T-adopt-core (ADR-020, second amendment): components read their design tokens so a design system can restyle every component (base.css system defaults plus one-fallback reads), which takes this route, under the 96 KB default before, to its edge. Measured 94.5 KB page on 2026-10-30 (+4% headroom). Trimming is a Final Review follow-up. PLAN_012 illustrations (2026-11-01): the generated WebP banner adds 264.3 KB; measured 337.0 KB page, limit 351 (+4% headroom).',
    budget: { pageGzipKb: 351 },
  },
  {
    route: '/agents-page/',
    reason:
      'PLAN_011 T-adopt-core (2026-10-30): components read their design tokens (ADR-020, second amendment); measured 96.5 KB page (+4% headroom). Under the 96 KB default before. Trimming is a Final Review follow-up. PLAN_012 illustrations (2026-11-01): the generated WebP banner adds 183.4 KB; measured 258.1 KB page, limit 269 (+4% headroom).',
    budget: { pageGzipKb: 269 },
  },
  {
    route: '/perf/',
    reason:
      'PLAN_011 T-adopt-core (2026-10-30): components read their design tokens (ADR-020, second amendment); measured 98.1 KB page (+4% headroom). Under the 96 KB default before. Trimming is a Final Review follow-up.',
    budget: { pageGzipKb: 103 },
  },
  {
    route: '/dashboards-page/',
    reason:
      'PLAN_010 T-site-080: three lazy dashboard islands (client:visible); the player loads only in the agent demo, after hydration, so JS at the ready signal is 61.3 KB, inside the default. The page total is Astro hoisting into <head> the CSS of every chunk the islands can import (the dashboard, the player loaders and the painters its blueprint uses), the same follow-up as /motion-page/. Measured 2026-10-29: 148.3 KB page (+4% headroom; a proposal for the owner). CI on Linux: the dashboard workbench sits at the 720 px fold (system fonts), so it hydrates on open there: 176.9 KB page, 90.1 KB JS measured 2026-10-30 (+4% headroom). PLAN_011 (token adoption, scoped portals): CI on Linux measured 184.3 KB page on 2026-10-30 (+4% headroom). PLAN_012 illustrations (2026-11-01): the generated WebP banner adds 91.8 KB; measured 224.5 KB page, limit 234 (+4% headroom).',
    budget: { pageGzipKb: 234, jsGzipKb: 94 },
  },
  {
    route: '/output-page/',
    reason:
      'PLAN_010 T-site-080: five lazy islands (client:visible); the email renderer loads when the visitor asks for a render, the PDF writer on the first download and the player after hydration. The email frame and the email lab sit in the first section, so their small islands hydrate at once: 66 KB JS at the ready signal. The page total is Astro hoisting into <head> the CSS of every chunk the islands can import (the player and its painters, the texuli controls of the i18n demo). Measured 2026-10-29: 194.7 KB page, 66 KB JS (+4% headroom; a proposal for the owner). PLAN_011 (player and blocks styled from tokens, T-ds-conformance findings): CI on Linux measured 203.5 KB page on 2026-10-30 (+4% headroom).',
    budget: { pageGzipKb: 212, jsGzipKb: 69 },
  },
  {
    route: '/whats-new/',
    reason:
      'PLAN_010 T-site-080 (Amendment 8): the hub of every 0.6.0 to 0.8.0 feature with six lazy islands (client:visible); the first row of cards is static previews, so JS at the ready signal is 61.3 KB, inside the default. The page total is Astro hoisting into <head> the CSS of every chunk the five live demos can import (the form, the dashboard, the rating, the motion runtime). Measured 2026-10-29: 160.6 KB page (+4% headroom; a proposal for the owner). PLAN_011 T-site-090 (2026-10-30): the 0.9.0 section (five static cards, the MCP doors snippet and the token counts; no new island) on top of token adoption: measured 167.8 KB page, 0.2 KB under the old cap, limit 175 (+4% headroom). PLAN_011 T-site-0100 (2026-10-31): the 0.10.0 section (six static cards, two code samples and the pair counts of the example brands, read at build time; no new island) puts the HTML at 24.2 KB gzip, 0.2 KB over the default: limit 25.2 (measured + 4%).',
    budget: { pageGzipKb: 175, htmlGzipKb: 25.2 },
  },
  {
    route: '/live-generation/',
    reason:
      'PLAN_010 T-site-070: one island near the top hydrates at once (the replay controls and the recorded drafts); the player loads on the first Start, not before. Measured 2026-10-29: 96.1 KB page and 63.0 KB JS at the ready signal (+4% headroom). PLAN_010 T-site-080 (measured 2026-10-29 on f9809246 with this task’s pages; none of its islands loads on this route, and swapping its one texuli root import left the number unchanged): the shared component code of the 0.8.0 wave (the texuli and primitives labels moved to the i18n message catalog, and the SSR-safe Select.Value): measured 66.4 KB JS, limit 70 (+4% headroom). PLAN_011 T-adopt-core (2026-10-30): components read their design tokens (ADR-020, second amendment); measured 101.9 KB page (+4% headroom).',
    budget: { pageGzipKb: 106, jsGzipKb: 70 },
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
      'The first live demo is a chart: the chart stage family and the part-whole chart chunk load on open: 113.9 KB page, 77.5 KB JS (104.4 KB JS before per-family stages); 124 KB page, 85.8 KB JS measured 2026-10-27, so the owner raised the caps to 132 and 92 (measured + 4%, rounded up to 4 KB; PLAN_006 follow-up). PLAN_009 (formatValue on the compact charts, handler composition and ref props in the shared components): 132.3 KB page in CI on Linux, so the page cap is 140 (measured + 4%, rounded up to 4 KB). PLAN_010 (motion and the API contract in the shared components): measured 95.1 KB JS, limit 99 (+4% headroom).',
    budget: { pageGzipKb: 140, jsGzipKb: 99, cls: 0.15 },
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
      'The blocks families render their demos statically; the PLAN_006 blocks audit (T-72/T-73) enriched the text, code, media and data demos: measured 97.1 KB page, limit 100. PLAN_010 (the G21 block fields, linear-time Markdown parsing and the API contract on the components the demos use): measured 100.5 KB page, limit 105 (+4% headroom). PLAN_011 T-adopt-core (2026-10-30): components read their design tokens (base.css system defaults plus one-fallback reads); measured 107.4 KB page and 64.1 KB JS (+4% headroom).',
    budget: { pageGzipKb: 112, jsGzipKb: 67 },
  },
  {
    route: '/builder/',
    reason:
      'The builder page mounts the BuilderApp studio island (structure tree, props and theme controls) on open: measured 31.7 KB gzip of HTML after the PLAN_006 builder polish (T-82). PLAN_007: the palette now lists the data, chat, workflows and state groups of the 158-id catalog inline, measured 234.9 KB raw (+4% headroom). PLAN_008: the deck root and slide manifests now carry the v2 deck props (layout, background, steps, motion, navigation, outline), measured 35.8 KB gzip of HTML (+4% headroom). PLAN_009: four new catalog manifests (cohort table, notification inbox, filter builder, time field) and the G21 block fields in the palette, measured 251 KB raw (+4% headroom).',
    budget: { htmlGzipKb: 38, htmlRawKb: 262 },
  },
  {
    route: '/component-pages/',
    reason:
      'The catalog index lists every component with its summary and authoring guidance; the PLAN_006 catalog audit (T-81) added per-component guidance: measured 24.3 KB gzip, limit 26. PLAN_010 (motion and the API contract in the shared components): measured 98.1 KB page, limit 103 (+4% headroom). PLAN_011 T-adopt-core (2026-10-30): components read their design tokens (ADR-020, second amendment); measured 104.5 KB page (+4% headroom). PLAN_012 (the page banner now renders: its texel fallback and the illustration styles): CI on Linux measured 226.1 KB raw HTML before the fallback was slimmed, limit 236 (+4% headroom). PLAN_012 illustrations (2026-11-01): the generated WebP banner adds 106.5 KB; measured 189.3 KB page, limit 197 (+4% headroom).',
    budget: { pageGzipKb: 197, htmlGzipKb: 26, htmlRawKb: 236 },
  },
  {
    route: '/web-and-native/',
    reason:
      'The architecture page mounts five sections — the layer diagrams, the correlation demo, the portability walk and the parity table (PLAN_006 T-52): measured 24.8 KB gzip, limit 26. PLAN_007: the layer diagrams gained @texuli/drag and @texuli/workflows and the nav three links, measured 96.4 KB page (+4% headroom). PLAN_010: the layer diagrams gained @texuli/document and @texuli/pages and the nav the motion link, measured 100.9 KB page, limit 105 (+4% headroom). PLAN_010 wave 6 (@texuli/sheets in the layer diagrams, the canvas and forms nav links): measured 26.4 KB HTML gzip, limit 27.5 (+4% headroom). PLAN_010 T-site-080 (the catalog and tools rows follow the f9809246 architecture table; the nav gained the sheets, dashboards, output and What’s new links): measured 106.4 KB page, limit 111 (+4% headroom). PLAN_011 T-adopt-core (2026-10-30): components read their design tokens (base.css system defaults plus one-fallback reads); CI measured 27.6 KB HTML gzip; 109.6 KB page (+4% headroom). PLAN_013 T-ship (2026-11-01): the parity table gained the Data views row and the native rows their chart and data counts; CI on Linux measured 29 KB HTML gzip, limit 30.2 (+4% headroom). PLAN_012 illustrations (2026-11-01): the generated WebP banner adds 127.1 KB; measured 215.5 KB page, limit 225 (+4% headroom).',
    budget: { htmlGzipKb: 30.2, pageGzipKb: 225 },
  },
  {
    route: '/gallery-themes/',
    reason:
      'The first 24 cards are in the HTML (18.8 KB gzip at FIX-site-perf-routes); the full 210-card list is fetched as /theme-gallery.json (17.9 KB) and each shown card loads its theme CSS. The PLAN_006 gallery audit (T-83) enriched the cards: 228.6 KB raw, 64.9 KB JS, limits 232 / 68. PLAN_009 (handler composition and ref props in the shared components) measured 24.1 KB gzip of HTML, limit 26 (+4% headroom). PLAN_010 (motion and the API contract in the shared components): measured 133.2 KB page, limit 139 (+4% headroom). PLAN_010 (motion and the API contract in the shared components): measured 69.4 KB JS, limit 73 (+4% headroom). PLAN_010 T-site-080 (measured 2026-10-29 on f9809246 with this task’s pages; none of its islands loads on this route, and swapping its one texuli root import left the number unchanged): the shared component code of the 0.8.0 wave (the texuli and primitives labels moved to the i18n message catalog, and the SSR-safe Select.Value): measured 73.3 KB JS and 137.2 KB page, limits 77 and 143 (+4% headroom). PLAN_012 (the page banner now renders): CI on Linux measured 234 KB raw HTML before the fallback was slimmed, limit 244 (+4% headroom). PLAN_012 illustrations (2026-11-01): the generated WebP banner adds 101.4 KB; measured 219.3 KB page, limit 229 (+4% headroom).',
    budget: { htmlRawKb: 244, htmlGzipKb: 26, pageGzipKb: 229, jsGzipKb: 77 },
  },
  {
    route: '/theme-switcher/',
    reason:
      'The first themes are in the HTML; the full catalog is fetched as /theme-catalog.json. The PLAN_006 gallery audit (T-83) enriched the cards: measured 103.2 KB page, limit 108. PLAN_010 (motion and the API contract in the shared components): measured 64.8 KB JS, limit 68 (+4% headroom). PLAN_010 wave 6 (component labels through the i18n message catalog): measured 109.4 KB page, limit 114 (+4% headroom). PLAN_010 T-site-080 (measured 2026-10-29 on f9809246 with this task’s pages; none of its islands loads on this route, and swapping its one texuli root import left the number unchanged): the shared component code of the 0.8.0 wave (the texuli and primitives labels moved to the i18n message catalog, and the SSR-safe Select.Value): measured 68.6 KB JS and 111.6 KB page, limits 72 and 117 (+4% headroom).',
    budget: { jsGzipKb: 72, pageGzipKb: 117 },
  },
  {
    route: '/playground/',
    reason:
      'The playground stage mounts on open; the PLAN_006 studio polish (T-82) extended the presets: measured 100.6 KB page / 69.6 KB JS, limits 104 / 72. PLAN_009 (handler composition and ref props in the shared components) measured 104.1 KB page in CI on Linux, limit 109 (+4% headroom). PLAN_010 (motion and the API contract in the shared components): measured 74.4 KB JS, limit 78 (+4% headroom). PLAN_010 wave 6 (component labels through the i18n message catalog): measured 109.3 KB page, limit 114 (+4% headroom). PLAN_010 T-site-080 (measured 2026-10-29 on f9809246 with this task’s pages; none of its islands loads on this route, and swapping its one texuli root import left the number unchanged): the shared component code of the 0.8.0 wave (the texuli and primitives labels moved to the i18n message catalog, and the SSR-safe Select.Value): measured 117.7 KB page and 84.8 KB JS, limits 123 and 89 (+4% headroom).',
    budget: { pageGzipKb: 123, jsGzipKb: 89 },
  },
  {
    route: '/search/',
    reason:
      'The results island ships the static search index; it grew with the site content (PLAN_006 T-80/T-83): measured 104.4 KB page / 75.1 KB JS, limits 108 / 80. PLAN_009 (new package docs pages in the index) measured 108.1 KB page, limit 113 (+4% headroom). PLAN_010 (motion and the API contract in the shared components): measured 113.1 KB page, limit 118 (+4% headroom). PLAN_010 (motion and the API contract in the shared components): measured 84.1 KB JS, limit 88 (+4% headroom).',
    budget: { jsGzipKb: 88, pageGzipKb: 118 },
  },
  {
    route: '/theme-studio/',
    reason:
      'PLAN_011 T-ds-studio: the Design System Studio (one client:load island) edits every section of a design-system document with Texuli controls and previews it on five surfaces (component sheet, dashboard, slide, document, email). Before, the theme studio measured 129.3 KB page and 91.5 KB JS (2026-10-30, not budgeted: the route was not in the browser list). The compiler, diff, importers, emitters and email renderer load only on interaction; the starting design system is a 5.2 KB build-time JSON instead of the compiler. The preview surfaces and the report load right after mount, so the total depends on whether they finish before the ready signal (153 to 175 KB measured); the limits are the fully loaded measurement, 180.7 KB page and 126.8 KB JS on 2026-10-30 (+4% headroom). Every dynamic import destructures its exports, so the shared @texuli/tokens chunks stay tree-shaken and no other route grows. Follow-up: trim the component chunks the previews pull in.',
    budget: { pageGzipKb: 188, jsGzipKb: 132 },
  },
  {
    route: '/color-explorer/',
    reason:
      'The theme list and one theme payload are inline; other payloads load as /theme-data/<id>.json on selection. Measured 291.5 KB raw / 30.8 KB gzip before the docs sidebar; the PLAN_006 studio polish (T-82) enriched the controls: 311.2 KB raw / 34.1 KB gzip of HTML, 114.8 KB page / 64.8 KB JS, limits 316 / 36 / 120 / 68. PLAN_010 (motion and the API contract in the shared components): measured 69.4 KB JS, limit 73 (+4% headroom). PLAN_010 wave 6 (component labels through the i18n message catalog): measured 120.9 KB page, limit 126 (+4% headroom). PLAN_010 T-site-080 (measured 2026-10-29 on f9809246 with this task’s pages; none of its islands loads on this route, and swapping its one texuli root import left the number unchanged): the shared component code of the 0.8.0 wave (the texuli and primitives labels moved to the i18n message catalog, and the SSR-safe Select.Value): measured 73.3 KB JS and 123.1 KB page, limits 77 and 129 (+4% headroom).',
    budget: { htmlRawKb: 316, htmlGzipKb: 36, pageGzipKb: 129, jsGzipKb: 77 },
  },
  {
    route: '/gallery-components/',
    reason:
      'The living gallery: server-rendered cards, each with its preview frame, light/dark and RTL controls, props toggle and tag filters. Measured 845.8 KB raw / 46.4 KB gzip at FIX-site-perf-routes; the PLAN_006 gallery audit (T-83) added card content: 888.2 KB raw / 48.5 KB gzip of HTML and 90.1 KB JS, limits 892 / 50 / 92. PLAN_007 (owned sortable and drag engine in the shared component code) brought JS to 92.0 KB locally and 92.1 KB in CI at the ready signal; the JS cap is now 96 (measured + 4%). T-93 still owns slimming the raw size. PLAN_009 (ref, rest props and handler composition on the shared components, sheet parts and new examples) measured 905.2 KB raw, limit 942 (+4% headroom). PLAN_010 (motion and the API contract in the shared components): measured 103.5 KB JS, limit 108 (+4% headroom). PLAN_010 T-site-080 (measured 2026-10-29 on f9809246 with this task’s pages; none of its islands loads on this route, and swapping its one texuli root import left the number unchanged): the shared component code of the 0.8.0 wave (the texuli and primitives labels moved to the i18n message catalog, and the SSR-safe Select.Value): measured 108.2 KB JS and 184.6 KB page, limits 113 and 192 (+4% headroom).',
    budget: { htmlRawKb: 942, htmlGzipKb: 50, pageGzipKb: 192, jsGzipKb: 113 },
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
  {
    route: '/mcp-server/',
    reason:
      'PLAN_011 T-site-090: a static page (no island) whose tables are generated from the operations registry (every tool with its summary, arguments, doors and limits; resources, prompts, WebMCP tools) plus setup snippets for six hosts: 21.2 KB gzip of HTML, inside the HTML budget. The shared docs shell (header, sidebar, search and the token-adopted base CSS) was about 78 KB of the total. Measured 2026-10-30: 100.3 KB page (+4% headroom); 78.7 KB after the shell trim of the same day. PLAN_012 (the MCP banner slot: its texel fallback, alt text and the illustration styles): CI on Linux measured 26.3 KB gzip of HTML before the fallback was slimmed, 25.7 KB locally after, limit 27.4 (+4% headroom). PLAN_012 illustrations (2026-11-01): the generated WebP banner adds 144.3 KB; measured 226.4 KB page, limit 236 (+4% headroom).',
    budget: { pageGzipKb: 236, htmlGzipKb: 27.4 },
  },
  {
    route: '/tokens/',
    reason:
      'PLAN_011 T-site-090: the token contract v2 reference, static (no island), generated from the registries: all 151 system tokens with defaults, the hooks and the defaults vocabulary, 21.3 KB gzip of HTML, inside the HTML budget; the component tier is split to /tokens/components/ to keep each document inside it. Measured 2026-10-30: 100.5 KB page (+4% headroom).',
    budget: { pageGzipKb: 105 },
  },
  {
    route: '/tokens/components/',
    reason:
      'PLAN_011 T-site-090: every component token (364 for 57 components) with its fallback, static (no island), compact tables with page-wide styles so no per-cell scope attribute is written: 23.2 KB gzip of HTML, inside the HTML budget. Measured 2026-10-30: 102.8 KB page (+4% headroom).',
    budget: { pageGzipKb: 107 },
  },
  {
    route: '/design-systems/',
    reason:
      "PLAN_011 T-site-0100: the design systems hub, static (no island, only the site shell's JavaScript, 62.8 KB): twelve server-rendered brand scopes (three example brands on four surfaces) built from real Texuli components, so the page carries their CSS (26.9 KB gzip of CSS with the 4.7 KB build-time brands.css) and 17.9 KB gzip of HTML. Measured 2026-10-31: 108.7 KB page, limit 113.1 (measured + 4%). PLAN_012 illustrations (2026-11-01): the generated WebP banner adds 203.2 KB; measured 289.1 KB page, limit 301 (+4% headroom).",
    budget: { pageGzipKb: 301 },
  },
  {
    route: '/native/',
    reason:
      'PLAN_012 illustrations (2026-11-01): the generated WebP banner adds 188.6 KB; measured 259.9 KB page, limit 271 (+4% headroom).',
    budget: { pageGzipKb: 271 },
  },
  {
    route: '/guides/',
    reason:
      'PLAN_012 illustrations (2026-11-01): the generated WebP banner adds 77.4 KB; measured 149.5 KB page, limit 156 (+4% headroom).',
    budget: { pageGzipKb: 156 },
  },
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
