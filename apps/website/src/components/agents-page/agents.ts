/**
 * Fixed content for the “Texuli for agents” page.
 * Paths are site-relative (joined with BASE_URL on the page).
 */

export interface AgentTopic {
  id: string;
  title: string;
  badge: string;
  summary: string;
  points: readonly string[];
}

export interface AgentResource {
  id: string;
  title: string;
  href: string;
  description: string;
  /** When true, href is external (still same-origin public files only). */
  download?: boolean;
}

/** Primary topics agents need to build with Texuli. */
export const AGENT_TOPICS: readonly AgentTopic[] = [
  {
    id: 'catalog',
    title: 'Closed catalog',
    badge: 'Manifests',
    summary:
      'Every emittable component is described by an authored manifest: id, props, use-when rules, accessibility notes and examples.',
    points: [
      'Build-time validation — invalid manifests fail the catalog build',
      'Content-addressed catalog file: catalog-<sha256>.json',
      'Groups discover automatically (display, forms, overlays, layouts, …)',
    ],
  },
  {
    id: 'tiers',
    title: 'Emit tiers',
    badge: 'Trust',
    summary:
      'Developer tier may use app chrome. Untrusted model output is limited to Tier U content components and content layouts.',
    points: [
      'Untrusted never gets dialogs, menus, shells or focus traps',
      'isTierU(catalog, id) answers the renderer’s emit check',
      'agentEmittable defaults to false so missing flags stay closed',
    ],
  },
  {
    id: 'renderer',
    title: 'Sink-free renderer',
    badge: 'Security',
    summary:
      'Agent trees become safe render nodes: unknown ids become placeholders, schema failures drop nodes, class/style never pass through.',
    points: [
      'No HTML sinks — no {@html}, innerHTML or string-built scripts',
      'Tree limits (depth, nodes, bytes) before render',
      'Hostile corpus asserts script URLs, bidi tricks and giant trees stay inert',
    ],
  },
  {
    id: 'mcp',
    title: 'MCP server',
    badge: 'Tools',
    summary:
      'A local stdio MCP server exposes catalog lookup so coding agents can search components without inventing props.',
    points: [
      'Read-only tools over the closed catalog',
      'Runs in-process with the monorepo — no remote catalog fetch',
      'Pair with llms.txt for prose context and MCP for structured props',
    ],
  },
  {
    id: 'cli',
    title: 'CLI',
    badge: 'Workflow',
    summary:
      'texuli add copies styled sources with provenance. llms generation writes agent docs. Updates stay on local paths only.',
    points: [
      'Never copies primitives into consumer apps',
      'Path containment refuses .. escapes and symlink writes',
      'All file writers share packages/tools internal path rules',
    ],
  },
  {
    id: 'golden',
    title: 'Golden set',
    badge: 'Quality',
    summary:
      'A curated set of components and flows every release must keep green: behavior checks, visual baselines, axe and the hostile corpus.',
    points: [
      'Playwright behavior checks for every primitive, held to the WAI-ARIA APG patterns',
      'Visual snapshots on real themes in light and dark',
      'WCAG 2.x contrast is the contrast gate (APCA out of scope)',
    ],
  },
] as const;

/** Static resources shipped with the site (no runtime network). */
export const AGENT_RESOURCES: readonly AgentResource[] = [
  {
    id: 'llms-txt',
    title: 'llms.txt',
    href: '/llms/llms.txt',
    description: 'Compact agent index of catalog components (llmstxt.org-style).',
    download: true,
  },
  {
    id: 'llms-full',
    title: 'llms-full.txt',
    href: '/llms/llms-full.txt',
    description: 'Full concatenated component docs generated from manifests.',
    download: true,
  },
  {
    id: 'catalog-json',
    title: 'Catalog JSON',
    href: '/catalog/catalog.json',
    description: 'Closed catalog snapshot (format texuli-catalog) for offline agents and CI.',
    download: true,
  },
  {
    id: 'docs-shell',
    title: 'Docs shell',
    href: '/docs-shell/',
    description: 'Documentation layout used by longer guides on this site.',
  },
] as const;

export const AGENT_SETUP_STEPS: readonly { title: string; body: string }[] = [
  {
    title: 'Install the monorepo skill',
    body: 'Point your coding agent at the Texuli skill pack so it follows AGENTS.md, layers and gates.',
  },
  {
    title: 'Load llms.txt',
    body: 'Fetch /llms/llms.txt from this site build (or regenerate with @texuli/tools/llms) for component orientation.',
  },
  {
    title: 'Attach the catalog',
    body: 'Use catalog-<hash>.json or /catalog/catalog.json so the agent only emits known ids and props.',
  },
  {
    title: 'Run MCP locally',
    body: 'Start the Texuli MCP server from the repo for structured catalog lookup during implementation.',
  },
  {
    title: 'Render untrusted trees safely',
    body: 'Pass model output through @texuli/catalog/render (limits, renderer, frame, hostile checks) before UI.',
  },
] as const;
