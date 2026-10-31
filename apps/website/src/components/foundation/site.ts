/**
 * The site's fixed facts: one theme, one appearance namespace and the
 * navigation. Pages read these instead of repeating literals.
 */
export const SITE_NAME = 'Texuli';
export const SITE_THEME = 'enterprise-neutral';
/** The no-flash cache namespace (`texuli.<namespace>.appearance` in localStorage). */
export const APPEARANCE_NAMESPACE = 'texuli-site';

export interface NavLink {
  /** Target page; a link without `href` is a family heading in the sidebar. */
  href?: string;
  label: string;
  /** One nested level under this link (sidebar renders it indented). */
  children?: readonly NavLink[];
}

export interface NavGroup {
  id: string;
  label: string;
  links: readonly NavLink[];
  /**
   * Added at build time: every catalog component (`/component-pages/<id>/`)
   * or every primitive (`/primitives-page/<id>/`), alphabetically; or every
   * guide, in reading order.
   */
  expand?: 'components' | 'primitives' | 'guides';
  /** Where the generated links go among `links` (default: after all of them). */
  expandAt?: number;
}

/** Where the landing's Docs link and the docs' first page point. */
export const DOCS_HOME = '/guides/';
/** The landing's Get started call to action. */
export const GET_STARTED = '/guides/getting-started/';
/** The public source repository: the header's GitHub door and the footer's project row. */
export const REPOSITORY_URL = 'https://github.com/DailybotHQ/texuli';

/**
 * The site navigation, grouped for the docs sidebar. This is the single
 * source: the sidebar, the phone drawer and the pager derive from it
 * (`nav-data.ts` expands the guide, component and primitive lists at build
 * time). The home page is a landing outside this list; the logo links to it.
 * Paths are relative to the site base.
 */
export const NAV_GROUPS: readonly NavGroup[] = [
  {
    id: 'get-started',
    label: 'Get started',
    links: [
      { href: DOCS_HOME, label: 'Introduction' },
      // The all-features hub: every package and capability of 0.6.0 to 0.10.0.
      { href: '/whats-new/', label: 'What’s new' },
      { href: '/skill/', label: 'Skill' },
    ],
    expand: 'guides',
    expandAt: 1,
  },
  {
    id: 'platform',
    label: 'Platform',
    links: [
      { href: '/web-and-native/', label: 'Web + native' },
      { href: '/native/', label: 'Native (Kotlin)' },
    ],
  },
  {
    id: 'components',
    label: 'Components',
    links: [
      { href: '/component-pages/', label: 'Overview' },
      { href: '/gallery-components/', label: 'Gallery' },
      { href: '/examples/', label: 'Examples' },
      { href: '/slides-page/', label: 'Slides' },
      { href: '/editor-page/', label: 'Editor' },
      { href: '/drag-page/', label: 'Drag and drop' },
      { href: '/motion-page/', label: 'Motion' },
      { href: '/documents-page/', label: 'Documents' },
      // The 0.8.0 feature pages (new in 0.8.0; the new packages are in development).
      { href: '/forms-page/', label: 'Forms' },
      { href: '/canvas-page/', label: 'Canvas' },
      { href: '/sheets-page/', label: 'Sheets' },
      { href: '/dashboards-page/', label: 'Dashboards' },
      { href: '/output-page/', label: 'Email, PDF and i18n' },
      { href: '/workflows-page/', label: 'Workflow editor' },
      { href: '/workflows-page/json/', label: 'JSON live preview' },
    ],
    expand: 'components',
  },
  {
    id: 'primitives',
    label: 'Primitives',
    links: [{ href: '/primitives-page/', label: 'Primitives overview' }],
    expand: 'primitives',
  },
  {
    id: 'themes',
    label: 'Themes',
    links: [
      // PLAN_011 T-site-0100: the design systems hub (released in 0.10.0).
      { href: '/design-systems/', label: 'Design systems' },
      { href: '/gallery-themes/', label: 'Theme gallery' },
      { href: '/theme-switcher/', label: 'Switcher' },
      { href: '/theme-studio/', label: 'Studio' },
      { href: '/color-explorer/', label: 'Colors' },
      // PLAN_011 T-site-090: the token contract v2 reference, generated from the registries.
      { href: '/tokens/', label: 'Design tokens' },
      { href: '/tokens/components/', label: 'Component tokens' },
    ],
  },
  {
    id: 'agents',
    label: 'Agents',
    links: [
      { href: '/agents-page/', label: 'Agents' },
      { href: '/playground/', label: 'Playground' },
      { href: '/live-generation/', label: 'Live generation' },
      { href: '/builder/', label: 'Builder' },
      { href: '/agent-chat/', label: 'Agent chat' },
      // PLAN_011 T-ar-api: the JSON API, MCP, CLI, limits and versioning.
      { href: '/developers/', label: 'Developers' },
      // PLAN_011 T-site-090: the MCP server (the route is /mcp-server/: functions/mcp.ts owns /mcp).
      { href: '/mcp-server/', label: 'Texuli MCP' },
    ],
  },
  {
    id: 'project',
    label: 'Project',
    links: [
      { href: '/brand/', label: 'Brand' },
      { href: '/foundation/', label: 'Foundation' },
      { href: '/showcase/', label: 'Showcase' },
      { href: '/evidence/', label: 'Evidence' },
      { href: '/perf/', label: 'Performance' },
      { href: '/changelog/', label: 'Changelog' },
    ],
  },
];

/** Normalizes a path for comparison: one leading and one trailing slash. */
export function normalizePath(path: string): string {
  const trimmed = path.replace(/\/index\.html$/, '/').replace(/\/+$/, '');
  return `${trimmed.startsWith('/') ? '' : '/'}${trimmed}/`.replace(/\/{2,}/g, '/');
}

/** Whether `href` is the current page (exact) or a section the page is in. */
export function navState(href: string, current: string): 'page' | 'section' | undefined {
  const link = normalizePath(href);
  const here = normalizePath(current);
  if (link === here) return 'page';
  return link !== '/' && here.startsWith(link) ? 'section' : undefined;
}

/** Joins the configured base (`import.meta.env.BASE_URL`) with a site path. */
export function withBase(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}
