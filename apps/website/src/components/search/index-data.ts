/**
 * Static search corpus for texuli.com. Built as plain data at compile time —
 * no fetch, no runtime network. Keep entries fictional / docs-only.
 */

import { THEME_LIBRARY_META } from '@texuli/tokens/library';
import { EXPAND_THEME_LIBRARY_META } from '@texuli/tokens/library-expand';
import { DOCS_SECTIONS, flattenDocsNav } from '../docs-shell/nav.ts';
import type { SearchEntry } from './types.ts';

const SITE_PAGES: readonly SearchEntry[] = [
  {
    id: 'page-home',
    title: 'Home',
    description: 'Texuli tagline and product overview.',
    href: '/',
    kind: 'page',
    keywords: ['texuli', 'landing'],
  },
  {
    id: 'page-brand',
    title: 'Brand',
    description: 'Brand story, live demos, and why Texuli.',
    href: '/brand/',
    kind: 'page',
    keywords: ['story', 'demos'],
  },
  {
    id: 'page-foundation',
    title: 'Foundation',
    description: 'How texuli.com is built: static Astro on Texuli.',
    href: '/foundation/',
    kind: 'page',
    keywords: ['static', 'theme', 'layout'],
  },
  {
    id: 'page-showcase',
    title: 'Showcase',
    description: 'Gallery of interfaces and layouts.',
    href: '/showcase/',
    kind: 'page',
    keywords: ['gallery', 'examples'],
  },
  {
    id: 'page-theme-switcher',
    title: 'Theme switcher',
    description: 'Appearance and theme controls for the site.',
    href: '/theme-switcher/',
    kind: 'page',
    keywords: ['dark', 'light', 'system'],
  },
  {
    id: 'page-search',
    title: 'Search',
    description: 'Search docs, components, themes and examples.',
    href: '/search/',
    kind: 'page',
    keywords: ['command', 'palette', 'find'],
  },
  {
    id: 'page-playground',
    title: 'Agent playground',
    description: 'Paste catalog tree JSON, run the sink-free renderer, try hostile presets.',
    href: '/playground/',
    kind: 'page',
    keywords: ['agent', 'catalog', 'renderer', 'hostile', 'json'],
  },
  {
    id: 'page-charts',
    title: 'Charts gallery',
    description: 'Every chart family with interactive examples and data contracts.',
    href: '/charts-page/',
    kind: 'page',
    keywords: ['charts', 'line', 'pie', 'heatmap', 'canvas', 'gallery'],
  },
  {
    id: 'page-drag',
    title: 'Drag and drop',
    description:
      'One general-purpose drag engine for sortable lists, boards, trees, canvases and graphs; keyboard and screen-reader ready.',
    href: '/drag-page/',
    kind: 'page',
    keywords: ['drag', 'drop', 'sortable', 'board', 'tree', 'canvas', 'reorder'],
  },
  {
    id: 'page-workflows',
    title: 'Workflow editor',
    description:
      'An accessible workflow graph editor and viewer: typed ports, auto-layout, outline and minimap.',
    href: '/workflows-page/',
    kind: 'page',
    keywords: ['workflow', 'graph', 'nodes', 'editor', 'pipeline', 'automation'],
  },
  {
    id: 'page-json-preview',
    title: 'JSON live preview',
    description:
      'Edit a blueprint, see validator diagnostics with paths, and render it at the untrusted tier.',
    href: '/workflows-page/json/',
    kind: 'page',
    keywords: ['json', 'blueprint', 'player', 'validate', 'state', 'actions'],
  },
  {
    id: 'page-theme-studio',
    title: 'Theme studio',
    description: 'Generate a theme from color, words or image; tune roles; export CSS and JSON.',
    href: '/theme-studio/',
    kind: 'page',
    keywords: ['theme', 'generator', 'seed', 'mood', 'export', 'aa'],
  },
];

const COMPONENTS: readonly SearchEntry[] = [
  ['button', 'Button', 'Actions and links with variants'],
  ['badge', 'Badge', 'Status chips and labels'],
  ['card', 'Card', 'Content containers and grids'],
  ['command', 'Command palette', '⌘K search and actions'],
  ['dialog', 'Dialog', 'Modal dialogs'],
  ['sidebar', 'Sidebar', 'App navigation rail'],
  ['toggle', 'Toggle', 'Pressed toggles and groups'],
  ['input', 'Input', 'Text fields'],
  ['select', 'Select', 'Single and multi select'],
  ['tabs', 'Tabs', 'Tabbed panels'],
  ['table', 'Table', 'Data tables'],
  ['avatar', 'Avatar', 'User portraits'],
].map(([id, title, description]) => ({
  id: `component-${id}`,
  title,
  description,
  href: `/search/?q=${encodeURIComponent(title)}`,
  kind: 'component' as const,
  keywords: [id, 'texuli', 'ui'],
}));

const EXAMPLES: readonly SearchEntry[] = [
  ['ui-button', 'Button examples', 'Default, outline, ghost and sizes'],
  ['ui-badge', 'Badge examples', 'Status and neutral badges'],
  ['ui-command', 'Command examples', 'Palette, variants and states'],
  ['ui-card', 'Card examples', 'Layouts and media'],
  ['media-video', 'Video player', 'Captions and chapters'],
  ['charts-cartesian', 'Cartesian charts', 'Line and bar charts'],
  ['data-grid-core', 'Data grid', 'Tabular data view'],
].map(([id, title, description]) => ({
  id: `example-${id}`,
  title,
  description,
  href: `/search/?q=${encodeURIComponent(id)}`,
  kind: 'example' as const,
  keywords: [id, 'demo', 'fixture'],
}));

function docsEntries(): SearchEntry[] {
  return flattenDocsNav(DOCS_SECTIONS).map((item) => ({
    id: `docs-${item.href}`,
    title: item.label,
    description: item.summary ?? 'Documentation page',
    href: item.href,
    kind: 'docs' as const,
    keywords: ['docs', 'documentation', item.label.toLowerCase()],
  }));
}

function themeEntries(): SearchEntry[] {
  const seen = new Set<string>();
  const out: SearchEntry[] = [];
  for (const meta of [...THEME_LIBRARY_META, ...EXPAND_THEME_LIBRARY_META]) {
    if (seen.has(meta.id)) continue;
    seen.add(meta.id);
    out.push({
      id: `theme-${meta.id}`,
      title: meta.name,
      description: meta.description,
      href: `/search/?q=${encodeURIComponent(meta.id)}`,
      kind: 'theme',
      keywords: [meta.id, meta.category, ...meta.tags, ...meta.mood],
    });
  }
  return out;
}

/** Full static index (frozen at module load). */
export const SEARCH_INDEX: readonly SearchEntry[] = Object.freeze([
  ...SITE_PAGES,
  ...docsEntries(),
  ...COMPONENTS,
  ...themeEntries(),
  ...EXAMPLES,
]);

export const SEARCH_KIND_LABEL: Record<SearchEntry['kind'], string> = {
  page: 'Pages',
  docs: 'Docs',
  component: 'Components',
  theme: 'Themes',
  example: 'Examples',
};
