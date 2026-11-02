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
    id: 'page-developers',
    title: 'Developers',
    description: 'The JSON API, OpenAPI, the MCP server, the CLI, limits and versioning.',
    href: '/developers/',
    kind: 'page',
    keywords: ['api', 'openapi', 'mcp', 'cli', 'rate limit', 'developers', 'json'],
  },
  {
    id: 'page-mcp-server',
    title: 'Texuli MCP',
    description:
      'The MCP server: remote and npx, setup for every host, tools, resources, prompts and limits.',
    href: '/mcp-server/',
    kind: 'page',
    keywords: ['mcp', 'model context protocol', 'claude', 'cursor', 'codex', 'tools', 'webmcp'],
  },
  {
    id: 'page-tokens',
    title: 'Design tokens',
    description:
      'Token contract v2: system families, the scope model, hooks and setDesignDefaults.',
    href: '/tokens/',
    kind: 'page',
    keywords: ['tokens', 'design tokens', 'design system', 'scope', 'defaults', 'css variables'],
  },
  {
    id: 'page-component-tokens',
    title: 'Component tokens',
    description: 'Every component token with the fallback its read carries.',
    href: '/tokens/components/',
    kind: 'page',
    keywords: ['component tokens', 'tokens', 'fallback', 'design system'],
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
    id: 'page-motion',
    title: 'Motion',
    description:
      'Presence, FLIP layout, shared elements, timelines and springs on one runtime; motion levels, reduced motion, tokens and motion as blueprint data (in development).',
    href: '/motion-page/',
    kind: 'page',
    keywords: ['motion', 'animation', 'transition', 'spring', 'reduced motion', 'flip', 'stagger'],
  },
  {
    id: 'page-documents',
    title: 'Documents',
    description:
      'A block editor with a slash menu, drag, nested pages, columns and live embeds; reader, paged view, Markdown, DOCX and PDF export, collaboration, and documents as agent data (in development, on npm from 0.7.0).',
    href: '/documents-page/',
    kind: 'page',
    keywords: [
      'document',
      'editor',
      'pages',
      'export',
      'pdf',
      'docx',
      'markdown',
      'collaboration',
      'comments',
    ],
  },
  {
    id: 'page-forms',
    title: 'Forms',
    description:
      'Schema-driven forms: every field type, named formats, validation with announced errors, multi-step flows, conditional logic, drafts and autosave, data-source fields and agent-generated forms (in development, on npm from 0.8.0).',
    href: '/forms-page/',
    kind: 'page',
    keywords: [
      'forms',
      'schema form',
      'validation',
      'steps',
      'wizard',
      'conditional',
      'drafts',
      'autosave',
      'data source',
    ],
  },
  {
    id: 'page-canvas',
    title: 'Canvas',
    description:
      'An infinite canvas: shapes, text, sticky notes, frames, connectors, snapping, zoom and pan, a full keyboard model, collaboration, SVG and PNG export (in development, on npm from 0.8.0).',
    href: '/canvas-page/',
    kind: 'page',
    keywords: [
      'canvas',
      'whiteboard',
      'diagram',
      'shapes',
      'connectors',
      'sticky notes',
      'collaboration',
    ],
  },
  {
    id: 'page-sheets',
    title: 'Sheets',
    description:
      'Spreadsheets: an owned formula engine with 54 functions, incremental recalculation, cycle and limit errors, CSV that neutralizes formula injection, and agent spreadsheets (in development, on npm from 0.8.0).',
    href: '/sheets-page/',
    kind: 'page',
    keywords: ['sheets', 'spreadsheet', 'formula', 'functions', 'csv', 'recalculation', 'workbook'],
  },
  {
    id: 'page-dashboards',
    title: 'Dashboards',
    description:
      'Dashboards: widgets moved and resized by pointer or keyboard with announcements, breakpoints, persisted layouts, host data sources and agent dashboards (since 0.8.0).',
    href: '/dashboards-page/',
    kind: 'page',
    keywords: ['dashboard', 'widgets', 'grid', 'layout', 'drag', 'resize', 'persistence'],
  },
  {
    id: 'page-output',
    title: 'Email, PDF and i18n',
    description:
      'Multi-target output: email-safe HTML from a blueprint, print mode and PDF, and every component label from one message catalog with lazy locales (since 0.8.0).',
    href: '/output-page/',
    kind: 'page',
    keywords: ['email', 'pdf', 'print', 'i18n', 'translation', 'locale', 'message catalog'],
  },
  {
    id: 'page-whats-new',
    title: 'What’s new',
    description:
      'Every new package and capability of 0.6.0 to 0.12.0, with a demo or preview each and honest release status.',
    href: '/whats-new/',
    kind: 'page',
    keywords: [
      'new',
      'release',
      'features',
      'changelog',
      '0.12.0',
      '0.11.0',
      '0.10.0',
      '0.9.0',
      'design systems',
      'roadmap',
    ],
  },
  {
    id: 'page-live-generation',
    title: 'Live generation',
    description:
      'A recorded agent draft streamed chunk by chunk into the player: skeletons, validated nodes, a held node, a dropped connection and Try again.',
    href: '/live-generation/',
    kind: 'page',
    keywords: ['stream', 'streaming', 'agent', 'generation', 'skeleton', 'player', 'progressive'],
  },
  {
    id: 'page-api-contract',
    title: 'Component API contract',
    description:
      'Rest attributes and ref, composed handlers, callback naming, the Field rule and the motion prop.',
    href: '/motion-page/#api-contract',
    kind: 'page',
    keywords: ['ref', 'rest props', 'handlers', 'field', 'contract', 'api'],
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
    id: 'page-slides',
    title: 'Slides',
    description:
      'Generate decks from JSON or Markdown: 21 layouts, contrast-safe backgrounds, any component on a slide, presenter, print and PPTX.',
    href: '/slides-page/',
    kind: 'page',
    keywords: ['slides', 'deck', 'presentation', 'markdown', 'json', 'presenter', 'pptx'],
  },
  {
    id: 'page-design-systems',
    title: 'Design systems',
    description:
      'One JSON document per brand: three example brands on a dashboard, slide, document and email, their conformance report, the studio, texuli ds and the MCP.',
    href: '/design-systems/',
    kind: 'page',
    keywords: [
      'design system',
      'brand',
      'tokens',
      'conformance',
      'contrast',
      'texuli ds',
      'ds check',
      'quillmark',
      'ledgerline',
      'tumbletown',
    ],
  },
  {
    id: 'page-theme-studio',
    title: 'Design system studio',
    description:
      'Build a design system from a seed, logo, library theme or DTCG file; edit every section; check contrast; export and share.',
    href: '/theme-studio/',
    kind: 'page',
    keywords: [
      'design system',
      'theme',
      'studio',
      'generator',
      'seed',
      'logo',
      'dtcg',
      'tokens studio',
      'tailwind',
      'export',
      'contrast',
      'aa',
    ],
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
