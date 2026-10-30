/**
 * The features /whats-new/ showcases, grouped by the release that carries
 * them, each with its honest status, its packages, the page that shows it
 * in full and the kind of demo or preview the hub paints. Plain data, so
 * the page and its tests share one source. Releases: 0.6.0, 0.7.0 and 0.8.0
 * are published on npm (0.8.0 is `latest`).
 */

export type ReleaseId = '0.6.0' | '0.7.0' | '0.8.0';

export interface Release {
  readonly id: ReleaseId;
  readonly title: string;
  readonly status: string;
  readonly published: boolean;
  readonly summary: string;
}

export const RELEASES: readonly Release[] = [
  {
    id: '0.8.0',
    title: '0.8.0: forms, canvas, sheets and output',
    status: 'Published on npm as 0.8.0, the current release (pre-1.0).',
    published: true,
    summary:
      'Forms, data sources, the canvas, spreadsheets, dashboards, email and PDF output, and one message catalog for every label, with blueprint spec 0.8.0. @texuli/forms, @texuli/canvas and @texuli/sheets were published for the first time; all three are still in development.',
  },
  {
    id: '0.7.0',
    title: '0.7.0: documents',
    status: 'Published on npm as 0.7.0; everything in it is also in 0.8.0.',
    published: true,
    summary:
      'A block document engine with collaboration, the Notion-like page editor, and documents as agent data in blueprint spec 0.7.0. @texuli/document and @texuli/pages were published for the first time; both are still in development.',
  },
  {
    id: '0.6.0',
    title: '0.6.0: motion and live generation',
    status: 'Published on npm as 0.6.0; everything in it is also in 0.7.0 and 0.8.0.',
    published: true,
    summary:
      'One API contract for every component, a motion system with a closed vocabulary, and blueprints that paint while they stream, with blueprint spec 0.6.0.',
  },
];

export type DemoKind =
  | 'motion'
  | 'contract'
  | 'streaming'
  | 'agent-service'
  | 'documents'
  | 'pages'
  | 'forms'
  | 'sources'
  | 'canvas'
  | 'sheets'
  | 'dashboards'
  | 'output'
  | 'i18n';

export interface Feature {
  readonly id: DemoKind;
  readonly release: ReleaseId;
  readonly title: string;
  readonly packages: readonly string[];
  readonly summary: string;
  readonly href: string;
  readonly linkLabel: string;
  /** `live` paints a small interactive island; `preview` is static, built from the packages. */
  readonly demo: 'live' | 'preview';
  /** Extra status when a feature's own state differs from its release's. */
  readonly note?: string;
}

export const FEATURES: readonly Feature[] = [
  {
    id: 'motion',
    release: '0.6.0',
    title: 'Motion',
    packages: ['texuli/motion', '@texuli/tokens'],
    summary:
      'Enter, exit and layout motion from a closed vocabulary of presets and durations, springs, and levels full, subtle and none; reduced motion is always instant.',
    href: '/motion-page/',
    linkLabel: 'Every animation',
    demo: 'live',
  },
  {
    id: 'contract',
    release: '0.6.0',
    title: 'One API contract',
    packages: ['texuli', '@texuli/primitives'],
    summary:
      'Every exported component forwards rest attributes and ref to its root, composes handlers with yours first, and names callbacks one way.',
    href: '/motion-page/#api-contract',
    linkLabel: 'The contract, point by point',
    demo: 'preview',
  },
  {
    id: 'streaming',
    release: '0.6.0',
    title: 'Live generation',
    packages: ['@texuli/player', '@texuli/catalog'],
    summary:
      'A blueprint paints node by node while it streams: each finished node is validated and painted, and the rest waits as skeletons.',
    href: '/live-generation/',
    linkLabel: 'Stream a recorded draft',
    demo: 'preview',
  },
  {
    id: 'agent-service',
    release: '0.6.0',
    title: 'The agent service',
    packages: ['apps/agent'],
    summary:
      'Prompt in, validated blueprint draft out, streamed. It runs a fake replay provider only.',
    href: '/live-generation/#replay',
    linkLabel: 'What the replay is',
    demo: 'preview',
    note: 'An app in the repository, not a package: it is not deployed.',
  },
  {
    id: 'documents',
    release: '0.7.0',
    title: 'Documents',
    packages: ['@texuli/document'],
    summary:
      'A block document format with typed operations and undo, Markdown in and out, pagination, DOCX and PDF writers, and an owned CRDT for collaboration.',
    href: '/documents-page/',
    linkLabel: 'The documents showcase',
    demo: 'preview',
  },
  {
    id: 'pages',
    release: '0.7.0',
    title: 'The page editor',
    packages: ['@texuli/pages'],
    summary:
      'A Notion-like editor with a slash menu of every block, drag by keyboard too, nested pages, comments, suggestions, versions and remote carets.',
    href: '/documents-page/#workbench',
    linkLabel: 'Edit a page',
    demo: 'preview',
  },
  {
    id: 'canvas',
    release: '0.8.0',
    title: 'Canvas',
    packages: ['@texuli/canvas'],
    summary:
      'An infinite canvas with shapes, connectors, frames, snapping and a full keyboard model, collaboration on the document CRDT, and SVG and PNG export.',
    href: '/canvas-page/',
    linkLabel: 'Draw on the canvas',
    demo: 'preview',
  },
  {
    id: 'sources',
    release: '0.8.0',
    title: 'Data sources',
    packages: ['@texuli/core/data-source', '@texuli/player'],
    summary:
      'Hosts register named sources; components and agent blueprints read them with validated queries, retries and a cache, never a URL.',
    href: '/forms-page/#sources',
    linkLabel: 'Sources in forms',
    demo: 'preview',
  },
  {
    id: 'sheets',
    release: '0.8.0',
    title: 'Spreadsheets',
    packages: ['@texuli/sheets'],
    summary:
      'An owned formula engine with a closed function set, incremental recalculation, cycle and limit errors, and CSV that neutralizes formula injection.',
    href: '/sheets-page/',
    linkLabel: 'The sheets showcase',
    demo: 'live',
  },
  {
    id: 'forms',
    release: '0.8.0',
    title: 'Forms',
    packages: ['@texuli/forms'],
    summary:
      'Schema-driven forms: every field type, named formats, closed validation rules with announced errors, steps, conditions, drafts and autosave.',
    href: '/forms-page/',
    linkLabel: 'All forms support',
    demo: 'live',
  },
  {
    id: 'dashboards',
    release: '0.8.0',
    title: 'Dashboards',
    packages: ['@texuli/data/dashboard'],
    summary:
      'Widgets people move and resize by pointer or keyboard, every step announced, with breakpoints and layouts that persist as untrusted data.',
    href: '/dashboards-page/',
    linkLabel: 'Arrange a dashboard',
    demo: 'live',
  },
  {
    id: 'output',
    release: '0.8.0',
    title: 'Email, print and PDF',
    packages: ['@texuli/tools/email', '@texuli/tools/print', '@texuli/player'],
    summary:
      'The same validated blueprint as an email mail clients render, a print-ready page and a PDF, escaped by construction.',
    href: '/output-page/',
    linkLabel: 'One blueprint, many targets',
    demo: 'preview',
  },
  {
    id: 'i18n',
    release: '0.8.0',
    title: 'One message catalog',
    packages: ['@texuli/core/i18n', 'texuli', '@texuli/primitives'],
    summary:
      'Every component label resolves through one catalog with lazy locales and a pseudo-locale. English ships today; translations beyond English are planned.',
    href: '/output-page/#i18n',
    linkLabel: 'Switch the locale',
    demo: 'live',
  },
];
