import { manifestData } from '../../manifest/data.ts';
import type { CatalogManifest } from '../../manifest/types.ts';
import {
  analyticsGridPropNames,
  authSplitLayoutPropNames,
  blogLayoutPropNames,
  cardLayoutPropNames,
  contentLayoutPropNames,
  dashboardGridLayoutPropNames,
  deckLayoutPropNames,
  deckSlidePropNames,
  docLayoutPropNames,
  docsLayoutPropNames,
  dualSidebarLayoutPropNames,
  editorialLayoutPropNames,
  gridLayoutPropNames,
  landingLayoutPropNames,
  layoutChromePropNames,
  layoutDrawerPropNames,
  layoutHostPropNames,
  marketingLayoutPropNames,
  navIconPropNames,
  pageLayoutPropNames,
  pricingLayoutPropNames,
  screenOutletPropNames,
  settingsLayoutPropNames,
  sidebarLayoutPropNames,
  splitViewPropNames,
  topNavLayoutPropNames,
  wizardLayoutPropNames,
} from './prop-names.ts';

const PKG = 'texuli';

/* @__NO_SIDE_EFFECTS__ */
function propsFrom(
  names: readonly string[],
  detail: Record<
    string,
    {
      kind: CatalogManifest['props'][number]['kind'];
      required?: boolean;
      description?: string;
      enumValues?: readonly string[];
      default?: unknown;
      trust?: 'developer' | 'untrusted';
    }
  >
): CatalogManifest['props'] {
  return names.map((name) => {
    const meta = detail[name];
    if (!meta) throw new Error(`Missing prop detail for "${name}"`);
    return {
      name,
      kind: meta.kind,
      ...(meta.required ? { required: true } : {}),
      ...(meta.description ? { description: meta.description } : {}),
      ...(meta.enumValues ? { enumValues: meta.enumValues } : {}),
      ...(meta.default !== undefined ? { default: meta.default } : {}),
      ...(meta.trust ? { trust: meta.trust } : {}),
    };
  });
}

const hostLayoutDetail = {
  mountScreen: {
    kind: 'event' as const,
    required: true,
    description: 'Host callback that mounts the stable routed screen node',
  },
  nav: { kind: 'object' as const, description: 'NavModel for chrome links' },
  path: { kind: 'string' as const, description: 'Current hash path' },
  options: { kind: 'object' as const, description: 'Flat data-only layout knobs' },
  storageKey: { kind: 'string' as const, description: 'Scope for persisted UI flags' },
  aside: { kind: 'slot' as const, description: 'Optional context panel' },
  class: { kind: 'string' as const },
};

const layoutIds = [
  'sidebar',
  'rail',
  'top-nav',
  'dual-sidebar',
  'master-detail',
  'dashboard-grid',
  'docs',
  'blog',
  'editorial',
  'marketing',
  'mobile-tabs',
  'mobile-drawer',
  'wizard',
  'auth-split',
  'custom',
] as const;

export const layoutHostManifest = /* @__PURE__ */ manifestData({
  id: 'layout-host',
  package: PKG,
  label: 'LayoutHost',
  summary: 'Resolves a layout id, applies width fallbacks, and keeps one stable screen outlet.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Apps that switch between shared layouts without remounting the screen'],
  dontUseWhen: ['A single fixed page frame with no layout catalog'],
  a11y: [
    'Loading state is named for assistive tech',
    'Screen outlet stays stable across layout switches',
  ],
  props: propsFrom(layoutHostPropNames, {
    layout: {
      kind: 'enum',
      required: true,
      enumValues: [...layoutIds],
      description: 'Layout catalog id',
    },
    children: { kind: 'slot', required: true, description: 'Screen content' },
    nav: hostLayoutDetail.nav,
    path: hostLayoutDetail.path,
    options: hostLayoutDetail.options,
    storageKey: hostLayoutDetail.storageKey,
    aside: hostLayoutDetail.aside,
    dir: { kind: 'enum', enumValues: ['ltr', 'rtl'], description: 'Document direction' },
    loadingLabel: { kind: 'string', default: 'Loading layout' },
    class: { kind: 'string' },
  }),
  examples: [{ id: 'sidebar', title: 'Sidebar host', props: { layout: 'sidebar' } }],
  related: ['layout-sidebar', 'layout-chrome'],
});

export const layoutChromeManifest = /* @__PURE__ */ manifestData({
  id: 'layout-chrome',
  package: PKG,
  label: 'LayoutChrome',
  summary: 'Shared brand, actions, user and skip-link chrome for desktop layouts.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Layout frames that share brand and user chrome'],
  dontUseWhen: ['Standalone navigation without a layout host'],
  a11y: ['Skip link targets the main region', 'Every href passes the URL policy'],
  props: propsFrom(layoutChromePropNames, {
    part: {
      kind: 'enum',
      required: true,
      enumValues: ['skip', 'brand', 'actions', 'user'],
    },
    nav: hostLayoutDetail.nav,
    mainId: { kind: 'string', description: 'Main region id for the skip link' },
    compact: { kind: 'boolean', default: false },
    hrefTrust: {
      kind: 'enum',
      enumValues: ['developer', 'untrusted'],
      default: 'developer',
      trust: 'developer',
    },
    skipLabel: { kind: 'string', default: 'Skip to content' },
    class: { kind: 'string' },
  }),
  examples: [{ id: 'brand', title: 'Brand chrome', props: { part: 'brand' } }],
  related: ['layout-host', 'nav-icon'],
});

export const layoutDrawerManifest = /* @__PURE__ */ manifestData({
  id: 'layout-drawer',
  package: PKG,
  label: 'LayoutDrawer',
  summary: 'Mobile navigation drawer built on the dialog primitive.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Narrow layouts that hide primary nav behind a menu'],
  dontUseWhen: ['Desktop-only sidebars'],
  a11y: ['Drawer is a labelled dialog', 'Close control is named'],
  props: propsFrom(layoutDrawerPropNames, {
    open: { kind: 'boolean', default: false },
    label: { kind: 'string', required: true, description: 'Accessible drawer name' },
    closeLabel: { kind: 'string', default: 'Close navigation' },
    children: { kind: 'slot' },
  }),
  examples: [{ id: 'open', title: 'Open drawer', props: { open: true, label: 'Navigation' } }],
  related: ['layout-sidebar', 'dialog'],
});

export const screenOutletManifest = /* @__PURE__ */ manifestData({
  id: 'screen-outlet',
  package: PKG,
  label: 'ScreenOutlet',
  summary: 'Stable screen mount point that survives layout switches.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['LayoutHost needs a durable screen node'],
  dontUseWhen: ['Static pages without layout switching'],
  a11y: 'Outlet is a plain region; screen content supplies its own landmarks.',
  props: propsFrom(screenOutletPropNames, {
    children: { kind: 'slot', required: true },
    onready: { kind: 'event', description: 'Fires with the outlet element' },
  }),
  examples: [{ id: 'basic', title: 'Outlet', props: {} }],
  related: ['layout-host'],
});

export const navIconManifest = /* @__PURE__ */ manifestData({
  id: 'nav-icon',
  package: PKG,
  label: 'NavIcon',
  summary: 'Renders a nav model icon by name or component.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Layout chrome needs a consistent nav icon'],
  dontUseWhen: ['Arbitrary illustration outside nav'],
  a11y: 'Decorative by default; pass label when the icon is the only name.',
  props: propsFrom(navIconPropNames, {
    icon: {
      kind: 'string',
      required: true,
      description: 'Icon name (hosts may also pass a component in code)',
    },
    class: { kind: 'string' },
    label: { kind: 'string' },
  }),
  examples: [{ id: 'home', title: 'Home icon', props: { icon: 'home' } }],
  related: ['layout-chrome'],
});

/* @__NO_SIDE_EFFECTS__ */
function hostLayoutManifest(
  id: string,
  label: string,
  summary: string,
  useWhen: readonly string[],
  dontUseWhen: readonly string[],
  propNames: readonly string[],
  extra: Record<string, Parameters<typeof propsFrom>[1][string]> = {},
  exampleProps: Record<string, unknown> = {}
): CatalogManifest {
  const detail: Parameters<typeof propsFrom>[1] = { ...hostLayoutDetail, ...extra };
  return /* @__PURE__ */ manifestData({
    id,
    package: PKG,
    label,
    summary,
    tier: 'app',
    agentEmittable: false,
    useWhen: [...useWhen],
    dontUseWhen: [...dontUseWhen],
    a11y: [
      'Skip link targets main when chrome is present',
      'Primary navigation is a labelled landmark',
    ],
    props: propsFrom(propNames, detail),
    examples: [{ id: 'default', title: label, props: exampleProps }],
    related: ['layout-host', 'layout-chrome'],
  });
}

export const layoutSidebarManifest = /* @__PURE__ */ hostLayoutManifest(
  'layout-sidebar',
  'Sidebar layout',
  'App sidebar column with responsive drawer fallback.',
  ['Desktop apps with persistent primary navigation'],
  ['Marketing landing pages'],
  sidebarLayoutPropNames,
  {
    skipLabel: { kind: 'string' },
    menuLabel: { kind: 'string' },
    closeLabel: { kind: 'string' },
  }
);

export const layoutTopNavManifest = /* @__PURE__ */ hostLayoutManifest(
  'layout-top-nav',
  'Top navigation layout',
  'Horizontal top navigation with optional mobile menu.',
  ['Product shells with a top bar'],
  ['Dense multi-section sidebars'],
  topNavLayoutPropNames,
  {
    skipLabel: { kind: 'string' },
    menuLabel: { kind: 'string' },
    closeLabel: { kind: 'string' },
  }
);

export const layoutDualSidebarManifest = /* @__PURE__ */ hostLayoutManifest(
  'layout-dual-sidebar',
  'Dual sidebar layout',
  'Primary nav plus optional context aside.',
  ['Tools that need nav and a context rail'],
  ['Single-column reading layouts'],
  dualSidebarLayoutPropNames,
  {
    skipLabel: { kind: 'string' },
    menuLabel: { kind: 'string' },
    closeLabel: { kind: 'string' },
  }
);

export const splitViewManifest = /* @__PURE__ */ manifestData({
  id: 'split-view',
  package: PKG,
  label: 'SplitView',
  summary: 'Master-detail split with list and detail panes.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['List/detail workflows on wide screens'],
  dontUseWhen: ['Single-stream feeds'],
  a11y: ['List and detail regions are labelled', 'Narrow containers show one pane at a time'],
  props: propsFrom(splitViewPropNames, {
    list: { kind: 'slot', required: true },
    detail: { kind: 'slot' },
    empty: { kind: 'slot' },
    listLabel: { kind: 'string', default: 'List' },
    detailLabel: { kind: 'string', default: 'Details' },
    detailActive: { kind: 'boolean', default: false },
    class: { kind: 'string' },
  }),
  examples: [{ id: 'basic', title: 'Split', props: { listLabel: 'Inbox' } }],
  related: ['layout-dual-sidebar'],
});

export const layoutDashboardGridManifest = /* @__PURE__ */ hostLayoutManifest(
  'layout-dashboard-grid',
  'Dashboard grid layout',
  'Top chrome plus container-query widget grid.',
  ['Analytics and operations dashboards'],
  ['Long-form reading'],
  dashboardGridLayoutPropNames,
  {
    hrefTrust: {
      kind: 'enum',
      enumValues: ['developer', 'untrusted'],
      default: 'developer',
      trust: 'developer',
    },
  },
  { options: { title: 'Overview', dense: false } }
);

export const analyticsGridManifest = /* @__PURE__ */ manifestData({
  id: 'analytics-grid',
  package: PKG,
  label: 'AnalyticsGrid',
  summary: 'Auto-fit KPI and widget grid for dashboard screens.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['KPI tiles and chart cards inside a dashboard'],
  dontUseWhen: ['Single full-bleed chart'],
  a11y: 'Optional region label names the metrics group.',
  props: propsFrom(analyticsGridPropNames, {
    columns: { kind: 'number', default: 3, description: 'Preferred column count (1–4)' },
    minItem: { kind: 'number', default: 280 },
    gap: { kind: 'string', default: '1rem' },
    dense: { kind: 'boolean', default: false },
    label: { kind: 'string' },
    children: { kind: 'slot', required: true },
    class: { kind: 'string' },
  }),
  examples: [{ id: 'kpis', title: 'Three columns', props: { columns: 3, label: 'Key metrics' } }],
  related: ['layout-dashboard-grid'],
});

export const contentLayoutManifest = /* @__PURE__ */ manifestData({
  id: 'content-layout',
  package: PKG,
  label: 'ContentLayout',
  summary: 'Shared docs/blog/editorial reading frame with optional TOC.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Long-form content with a table of contents'],
  dontUseWhen: ['App chrome shells'],
  a11y: ['Main landmark holds the article', 'TOC links are in-page anchors'],
  props: propsFrom(contentLayoutPropNames, {
    kind: {
      kind: 'enum',
      required: true,
      enumValues: ['docs', 'blog', 'editorial'],
    },
    ...hostLayoutDetail,
  }),
  examples: [{ id: 'docs', title: 'Docs', props: { kind: 'docs', options: { title: 'Guides' } } }],
  related: ['layout-docs', 'layout-blog'],
});

export const layoutDocsManifest = /* @__PURE__ */ hostLayoutManifest(
  'layout-docs',
  'Docs layout',
  'Documentation reading layout (content-layout kind docs).',
  ['Product docs and guides'],
  ['App dashboards'],
  docsLayoutPropNames,
  {},
  { options: { title: 'Guides' } }
);

export const layoutBlogManifest = /* @__PURE__ */ hostLayoutManifest(
  'layout-blog',
  'Blog layout',
  'Blog/post reading layout (content-layout kind blog).',
  ['Blog posts and field notes'],
  ['Settings shells'],
  blogLayoutPropNames,
  {},
  { options: { title: 'Field notes', author: 'Ada Example' } }
);

export const layoutEditorialManifest = /* @__PURE__ */ hostLayoutManifest(
  'layout-editorial',
  'Editorial layout',
  'Long-read editorial layout (content-layout kind editorial).',
  ['Magazine-style long reads'],
  ['Dense data grids'],
  editorialLayoutPropNames,
  {},
  { options: { title: 'The long read' } }
);

export const layoutMarketingManifest = /* @__PURE__ */ manifestData({
  id: 'layout-marketing',
  package: PKG,
  label: 'Marketing layout',
  summary: 'Marketing page frame with hero, sections and footer slots.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Landing and product marketing pages'],
  dontUseWhen: ['Authenticated app chrome'],
  a11y: ['Hero and content regions can be labelled', 'Navigation is a landmark'],
  props: propsFrom(marketingLayoutPropNames, {
    mountScreen: { kind: 'event', description: 'Optional LayoutHost screen mount' },
    nav: hostLayoutDetail.nav,
    path: hostLayoutDetail.path,
    options: hostLayoutDetail.options,
    storageKey: hostLayoutDetail.storageKey,
    aside: hostLayoutDetail.aside,
    brand: { kind: 'slot' },
    navigation: { kind: 'slot' },
    actions: { kind: 'slot' },
    hero: { kind: 'slot' },
    sections: { kind: 'slot' },
    footer: { kind: 'slot' },
    navigationLabel: { kind: 'string' },
    heroLabel: { kind: 'string' },
    contentLabel: { kind: 'string' },
    class: { kind: 'string' },
  }),
  examples: [{ id: 'landing', title: 'Marketing', props: {} }],
  related: ['layout-landing', 'layout-pricing'],
});

export const layoutLandingManifest = /* @__PURE__ */ manifestData({
  id: 'layout-landing',
  package: PKG,
  label: 'Landing layout',
  summary: 'Standalone marketing landing composition.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Static landing pages without LayoutHost'],
  dontUseWhen: ['Routed app shells'],
  a11y: 'Author-provided landmarks; no default product copy.',
  props: propsFrom(landingLayoutPropNames, {
    brand: { kind: 'slot' },
    navigation: { kind: 'slot' },
    actions: { kind: 'slot' },
    hero: { kind: 'slot' },
    sections: { kind: 'slot' },
    footer: { kind: 'slot' },
    class: { kind: 'string' },
  }),
  examples: [{ id: 'basic', title: 'Landing', props: {} }],
  related: ['layout-marketing'],
});

export const layoutPricingManifest = /* @__PURE__ */ manifestData({
  id: 'layout-pricing',
  package: PKG,
  label: 'Pricing layout',
  summary: 'Pricing plans grid with title and footnote.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Pricing tables on marketing pages'],
  dontUseWhen: ['In-app billing settings (use settings layout)'],
  a11y: 'Plans are a list of cards; title names the section.',
  props: propsFrom(pricingLayoutPropNames, {
    title: { kind: 'string' },
    description: { kind: 'string' },
    plans: { kind: 'array', description: 'Plan cards data' },
    footnote: { kind: 'string' },
    class: { kind: 'string' },
    children: { kind: 'slot' },
  }),
  examples: [
    {
      id: 'plans',
      title: 'Three plans',
      props: { title: 'Plans', plans: [{ id: 'free', name: 'Free' }] },
    },
  ],
  related: ['layout-marketing'],
});

export const layoutAuthSplitManifest = /* @__PURE__ */ manifestData({
  id: 'layout-auth-split',
  package: PKG,
  label: 'Auth split layout',
  summary: 'Sign-in form column plus brand panel.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Sign-in and account entry pages'],
  dontUseWhen: ['Post-auth app chrome'],
  a11y: ['Form and brand panels are labelled', 'Brand copy is author-provided'],
  props: propsFrom(authSplitLayoutPropNames, {
    form: { kind: 'slot' },
    mountScreen: { kind: 'event' },
    brand: { kind: 'slot' },
    panel: { kind: 'slot' },
    brandTitle: { kind: 'string' },
    brandDescription: { kind: 'string' },
    brandEyebrow: { kind: 'string' },
    formLabel: { kind: 'string' },
    panelLabel: { kind: 'string' },
    class: { kind: 'string' },
  }),
  examples: [
    {
      id: 'sign-in',
      title: 'Sign in',
      props: { brandTitle: 'Harbor', formLabel: 'Sign in' },
    },
  ],
  related: ['layout-wizard'],
});

export const layoutWizardManifest = /* @__PURE__ */ manifestData({
  id: 'layout-wizard',
  package: PKG,
  label: 'Wizard layout',
  summary: 'Centered onboarding wizard frame with steps.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Multi-step setup and onboarding'],
  dontUseWhen: ['Single-page forms'],
  a11y: ['Steps expose current position', 'Back and next controls are named'],
  props: propsFrom(wizardLayoutPropNames, {
    steps: { kind: 'array' },
    content: { kind: 'slot' },
    mountScreen: { kind: 'event' },
    current: { kind: 'number', default: 0 },
    title: { kind: 'string' },
    description: { kind: 'string' },
    canAdvance: { kind: 'event' },
    validate: { kind: 'event' },
    onFinish: { kind: 'event' },
    onStepChange: { kind: 'event' },
    backLabel: { kind: 'string' },
    nextLabel: { kind: 'string' },
    finishLabel: { kind: 'string' },
    secondaryActions: { kind: 'slot' },
    brand: { kind: 'slot' },
    class: { kind: 'string' },
  }),
  examples: [
    {
      id: 'onboarding',
      title: 'Onboarding',
      props: {
        title: 'Welcome',
        steps: [{ id: 'profile', label: 'Profile' }],
        current: 0,
      },
    },
  ],
  related: ['layout-auth-split', 'layout-settings'],
});

export const layoutSettingsManifest = /* @__PURE__ */ manifestData({
  id: 'layout-settings',
  package: PKG,
  label: 'Settings layout',
  summary: 'Settings section list plus detail pane.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Account and workspace settings'],
  dontUseWhen: ['Primary app navigation'],
  a11y: ['Section list is labelled', 'Phone back control is named'],
  props: propsFrom(settingsLayoutPropNames, {
    title: { kind: 'string', default: 'Settings' },
    description: { kind: 'string' },
    sections: { kind: 'array', required: true },
    active: { kind: 'string' },
    onSelect: { kind: 'event' },
    startWithList: { kind: 'boolean' },
    children: { kind: 'slot' },
    mountScreen: { kind: 'event' },
    navLabel: { kind: 'string' },
    backLabel: { kind: 'string' },
    class: { kind: 'string' },
  }),
  examples: [
    {
      id: 'account',
      title: 'Account settings',
      props: {
        sections: [{ id: 'profile', label: 'Profile' }],
        active: 'profile',
      },
    },
  ],
  related: ['layout-wizard'],
});

/** Content composition layouts — Tier U when agent-emittable (CONTENT_LAYOUT_IDS). */
/* @__NO_SIDE_EFFECTS__ */
function contentComposition(
  id: 'layout-card' | 'layout-page' | 'layout-doc' | 'layout-deck' | 'layout-grid' | 'deck-slide',
  label: string,
  summary: string,
  names: readonly string[],
  detail: Parameters<typeof propsFrom>[1],
  exampleProps: Record<string, unknown>
): CatalogManifest {
  return /* @__PURE__ */ manifestData({
    id,
    package: PKG,
    label,
    summary,
    tier: 'content',
    agentEmittable: true,
    useWhen: [`Compose ${label.toLowerCase()} structure in agent-authored trees`],
    dontUseWhen: ['App chrome shells (sidebar, top-nav, dialogs)'],
    a11y: [
      'Structure is semantic regions the host maps to real layout components',
      'No HTML strings; children are nested catalog nodes',
    ],
    props: propsFrom(names, detail),
    examples: [{ id: 'basic', title: label, props: exampleProps }],
    related: ['layout-page', 'layout-doc', 'layout-grid'].filter((relatedId) => relatedId !== id),
  });
}

export const cardLayoutManifest = /* @__PURE__ */ contentComposition(
  'layout-card',
  'Card layout',
  'Content card frame for grouped agent-authored blocks.',
  cardLayoutPropNames,
  {
    title: { kind: 'string', trust: 'untrusted' },
    children: { kind: 'slot' },
    class: { kind: 'string' },
  },
  { title: 'Summary' }
);

export const pageLayoutManifest = /* @__PURE__ */ contentComposition(
  'layout-page',
  'Page layout',
  'Full page content frame for agent-authored documents.',
  pageLayoutPropNames,
  {
    title: { kind: 'string', trust: 'untrusted' },
    description: { kind: 'string', trust: 'untrusted' },
    children: { kind: 'slot' },
    class: { kind: 'string' },
  },
  { title: 'Overview', description: 'Quarterly update' }
);

export const docLayoutManifest = /* @__PURE__ */ contentComposition(
  'layout-doc',
  'Doc layout',
  'Document frame with optional table of contents.',
  docLayoutPropNames,
  {
    title: { kind: 'string', trust: 'untrusted' },
    toc: { kind: 'boolean', default: true },
    children: { kind: 'slot' },
    class: { kind: 'string' },
  },
  { title: 'Guide', toc: true }
);

export const deckLayoutManifest = /* @__PURE__ */ contentComposition(
  'layout-deck',
  'Deck layout',
  'Slide deck frame for sequenced content.',
  deckLayoutPropNames,
  {
    title: { kind: 'string', trust: 'untrusted' },
    description: { kind: 'string', trust: 'untrusted' },
    locale: { kind: 'string', description: 'Language tag such as en or en-GB' },
    aspect: { kind: 'enum', enumValues: ['16:9', '4:3', '1:1'], default: '16:9' },
    themeRef: {
      kind: 'unknown',
      description: 'Catalog theme id, or a catalog or embedded theme reference object',
    },
    masters: { kind: 'array', description: 'Built-in slide master ids the slides may use' },
    settings: {
      kind: 'object',
      description: 'startIndex, loop, showProgress and defaultTransition',
    },
    slides: {
      kind: 'array',
      description: 'Structured slide objects (@texuli/slides grammar); prefer deck-slide children',
    },
    children: { kind: 'slot' },
    class: { kind: 'string' },
  },
  { title: 'Pitch', aspect: '16:9' }
);

/**
 * One slide in a `layout-deck`. Children are the slide's content blocks; the
 * stage shows one slide at a time, and the title is the slide's heading.
 */
export const deckSlideManifest = /* @__PURE__ */ contentComposition(
  'deck-slide',
  'Deck slide',
  'One slide in a deck: a title, content blocks and speaker notes.',
  deckSlidePropNames,
  {
    slideId: {
      kind: 'string',
      required: true,
      description: 'Stable slide id (lowercase letters, digits and hyphens)',
    },
    title: { kind: 'string', trust: 'untrusted' },
    notes: { kind: 'string', trust: 'untrusted', description: 'Plain-text speaker notes' },
    master: {
      kind: 'enum',
      enumValues: [
        'title',
        'section',
        'content',
        'two-column',
        'media-left',
        'media-right',
        'quote',
        'closing',
      ],
    },
    transition: { kind: 'enum', enumValues: ['none', 'fade', 'fade-up'] },
    themeRef: { kind: 'unknown', description: 'Overrides the deck theme for this slide' },
    children: { kind: 'slot' },
    class: { kind: 'string' },
  },
  { slideId: 'opening', title: 'Opening' }
);

export const gridLayoutManifest = /* @__PURE__ */ contentComposition(
  'layout-grid',
  'Grid layout',
  'Responsive content grid for agent-authored tiles.',
  gridLayoutPropNames,
  {
    columns: { kind: 'number', default: 2 },
    gap: { kind: 'string', default: '1rem' },
    children: { kind: 'slot' },
    class: { kind: 'string' },
  },
  { columns: 2, gap: '1rem' }
);

/** Every layouts/shells manifest in stable id order. */
export const LAYOUTS_MANIFESTS: readonly CatalogManifest[] = /* @__PURE__ */ Object.freeze(
  /* @__PURE__ */ [
    analyticsGridManifest,
    cardLayoutManifest,
    contentLayoutManifest,
    deckLayoutManifest,
    deckSlideManifest,
    docLayoutManifest,
    gridLayoutManifest,
    layoutAuthSplitManifest,
    layoutBlogManifest,
    layoutChromeManifest,
    layoutDashboardGridManifest,
    layoutDocsManifest,
    layoutDrawerManifest,
    layoutDualSidebarManifest,
    layoutEditorialManifest,
    layoutHostManifest,
    layoutLandingManifest,
    layoutMarketingManifest,
    layoutPricingManifest,
    layoutSettingsManifest,
    layoutSidebarManifest,
    layoutTopNavManifest,
    layoutWizardManifest,
    navIconManifest,
    pageLayoutManifest,
    screenOutletManifest,
    splitViewManifest,
  ].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
);

/** Map of component id → expected prop names for type/schema parity tests. */
export { LAYOUTS_PROP_NAMES as LAYOUTS_PROP_NAME_MAP } from './prop-names.ts';

export const layoutsManifestsById = /* @__PURE__ */ Object.freeze(
  /* @__PURE__ */ Object.fromEntries(
    /* @__PURE__ */ LAYOUTS_MANIFESTS.map((manifest) => [manifest.id, manifest])
  ) as Record<string, CatalogManifest>
);
