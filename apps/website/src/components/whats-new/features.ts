/**
 * The features /whats-new/ showcases, grouped by the release that carries
 * them, each with its honest status, its packages, the page that shows it
 * in full and the kind of demo or preview the hub paints. Plain data, so
 * the page and its tests share one source. Releases: 0.6.0 to 0.12.0 are
 * published on npm, and 0.12.0 is `latest` (the release line in
 * docs/RELEASE.md).
 */

export type ReleaseId = '0.6.0' | '0.7.0' | '0.8.0' | '0.9.0' | '0.10.0' | '0.11.0' | '0.12.0';

export interface Release {
  readonly id: ReleaseId;
  readonly title: string;
  readonly status: string;
  readonly published: boolean;
  readonly summary: string;
}

export const RELEASES: readonly Release[] = [
  {
    id: '0.12.0',
    title: '0.12.0: pages core entries without the deck model',
    status: 'Published on npm as 0.12.0, the current release (pre-1.0).',
    published: true,
    summary:
      'Protoyard G136 finished: the @texuli/pages core entries (PageEditorCore, CollabEditorCore, PagesEditor and createDocumentPlayerHostCore) validate documents without @texuli/deck/model, so @texuli/pages/editor-core and host-core are much smaller. Breaking for those core entries only: they take validateDeck with no default and refuse inline decks without it, a one-line migration (validateDeck: checkDeckPayload from @texuli/document/schema); PageEditor, CollabEditor and createDocumentPlayerHost behave as before. Blueprint spec stays 0.10.0.',
  },
  {
    id: '0.11.0',
    title: '0.11.0: lighter design-system hosts',
    status:
      'Published on npm as 0.11.0; its patches 0.11.1 to 0.11.5 added fixes and additive Protoyard gaps (G128–G136), and everything in the 0.11 line is also in 0.12.0.',
    published: true,
    summary:
      'The Protoyard gaps G125 to G127: the library theme ids without the library (@texuli/tokens/library-ids), complete expand theme descriptions, and core entries that compile and paint design systems with no theme library in any chunk (@texuli/tokens/design-system/compile-core, @texuli/player/design-system-core). The slides and pages core entries no longer load the theme library unless the host passes a loader, a one-line migration. Design systems with one mode never throw, and DesignSystemProvider reports a failed apply through onapplyerror. Blueprint spec stays 0.10.0.',
  },
  {
    id: '0.10.0',
    title: '0.10.0: design systems',
    status: 'Published on npm as 0.10.0; everything in it is also in 0.11.0 and 0.12.0.',
    published: true,
    summary:
      'Design systems: one JSON document per brand, compiled with contrast, focus and target size enforced and followed by every surface; the Design System Studio; ds tools on the MCP and the CLI; texuli ds check; the Protoyard gaps G100 to G124; and the removal of the names deprecated in 0.9.0. Blueprint spec 0.10.0 adds the design-system document, a stamp-only migration from 0.9.0.',
  },
  {
    id: '0.9.0',
    title: '0.9.0: MCP, an agent-ready site and design tokens',
    status: 'Published on npm as 0.9.0; everything in it is also in 0.10.0 to 0.12.0.',
    published: true,
    summary:
      'An MCP server for agents (remote and local), texuli.com readable by agents end to end, token contract v2 with a component tier, overlays that keep their scope, and the fixes Protoyard asked for. @texuli/mcp is a new package, first published in 0.9.0, and still in development.',
  },
  {
    id: '0.8.0',
    title: '0.8.0: forms, canvas, sheets and output',
    status: 'Published on npm as 0.8.0; everything in it is also in 0.9.0 to 0.12.0.',
    published: true,
    summary:
      'Forms, data sources, the canvas, spreadsheets, dashboards, email and PDF output, and one message catalog for every label, with blueprint spec 0.8.0. @texuli/forms, @texuli/canvas and @texuli/sheets were published for the first time; all three are still in development.',
  },
  {
    id: '0.7.0',
    title: '0.7.0: documents',
    status: 'Published on npm as 0.7.0; everything in it is also in 0.8.0 to 0.12.0.',
    published: true,
    summary:
      'A block document engine with collaboration, the Notion-like page editor, and documents as agent data in blueprint spec 0.7.0. @texuli/document and @texuli/pages were published for the first time; both are still in development.',
  },
  {
    id: '0.6.0',
    title: '0.6.0: motion and live generation',
    status: 'Published on npm as 0.6.0; everything in it is also in 0.7.0 to 0.12.0.',
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
  | 'i18n'
  | 'mcp'
  | 'agent-ready'
  | 'tokens'
  | 'portals'
  | 'protoyard'
  | 'design-systems'
  | 'ds-studio'
  | 'ds-tools'
  | 'ds-conformance'
  | 'protoyard-0100'
  | 'removals';

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
  {
    id: 'mcp',
    release: '0.9.0',
    title: 'Texuli MCP',
    packages: ['@texuli/mcp', '@texuli/tools/mcp'],
    summary:
      'One operations registry served as MCP tools, resources and prompts: remotely at texuli.com/mcp, or locally with npx -y @texuli/mcp, with setup for every major host.',
    href: '/mcp-server/',
    linkLabel: 'Connect your agent',
    demo: 'preview',
    note: 'The remote server is live at texuli.com/mcp; @texuli/mcp is in development.',
  },
  {
    id: 'agent-ready',
    release: '0.9.0',
    title: 'An agent-ready site',
    packages: ['apps/website', 'functions'],
    summary:
      'A read-only JSON API with an OpenAPI description, Markdown twins of every page, discovery files, site tools on the MCP and a WebMCP bridge for browser agents.',
    href: '/developers/',
    linkLabel: 'The developer portal',
    demo: 'preview',
  },
  {
    id: 'tokens',
    release: '0.9.0',
    title: 'Design tokens v2',
    packages: ['@texuli/tokens/system', '@texuli/tokens/components', 'texuli/defaults'],
    summary:
      'System families for space, size, type, elevation, shape, layers and more, plus a component tier every styled component reads, and default variants and sizes for design systems and agents.',
    href: '/tokens/',
    linkLabel: 'The token reference',
    demo: 'preview',
  },
  {
    id: 'portals',
    release: '0.9.0',
    title: 'Scoped portals',
    packages: ['@texuli/core', '@texuli/primitives', 'texuli'],
    summary:
      'Every token is element-scoped with data-tx-scope, and overlays (dialogs, menus, popovers, tooltips, toasts) keep the theme and tokens of the scope that opened them.',
    href: '/tokens/#scope',
    linkLabel: 'The scope model',
    demo: 'preview',
  },
  {
    id: 'protoyard',
    release: '0.9.0',
    title: 'Fixes from Protoyard',
    packages: ['texuli', '@texuli/data', '@texuli/charts', '@texuli/chat', '@texuli/primitives'],
    summary:
      'Gaps a production adopter reported: dialog and command palette callbacks, date control hooks and invalid state, keyboard rows in table grids, ref and rest on every layout, a time x-axis for charts and contained toasts without a forced layout.',
    href: '/changelog/',
    linkLabel: 'The changelog',
    demo: 'preview',
  },
  {
    id: 'design-systems',
    release: '0.10.0',
    title: 'Design systems',
    packages: [
      '@texuli/spec/design-system',
      '@texuli/tokens/design-system',
      'texuli/design-system',
    ],
    summary:
      'One JSON document per brand, followed by components, blueprints, decks, documents, email, PDF, DOCX, PPTX, canvas exports and Kotlin tokens, with contrast, focus and target size enforced by the compiler.',
    href: '/design-systems/',
    linkLabel: 'Three brands, four surfaces',
    demo: 'preview',
  },
  {
    id: 'ds-studio',
    release: '0.10.0',
    title: 'Design system studio',
    packages: ['apps/website', '@texuli/tokens/design-system'],
    summary:
      'Start from a seed, a logo, a library theme or a token file, edit every section, preview five surfaces, read the contrast report and the diff, export every format and share by link, all in the browser.',
    href: '/theme-studio/',
    linkLabel: 'Open the studio',
    demo: 'preview',
  },
  {
    id: 'ds-tools',
    release: '0.10.0',
    title: 'Design system tools for agents',
    packages: ['@texuli/tools', '@texuli/mcp'],
    summary:
      'ds.validate, ds.compile, ds.contrast, ds.suggest, ds.import, ds.diff, ds.preview and ds.save on the MCP and as texuli ds commands, plus the create-design-system prompt and texuli://design-system/{id}.',
    href: '/design-systems/#start',
    linkLabel: 'Every way to start',
    demo: 'preview',
  },
  {
    id: 'ds-conformance',
    release: '0.10.0',
    title: 'Conformance',
    packages: ['@texuli/tools/ds-check'],
    summary:
      'texuli ds check holds a document to its guarantees with stable codes and JSON paths; --render paints the catalog under it in Chromium for axe, painted contrast and literal colors.',
    href: '/design-systems/#conformance',
    linkLabel: 'The example brands’ report',
    demo: 'preview',
  },
  {
    id: 'protoyard-0100',
    release: '0.10.0',
    title: 'More fixes from Protoyard',
    packages: ['texuli', '@texuli/data', '@texuli/editor', '@texuli/forms', '@texuli/pages'],
    summary:
      'Gaps G100 to G124 a production adopter reported, among them: Markdown backslash escapes, filter builder issues and labelled options, keyboard board moves that keep focus, host-painted form fields and new field types (G113 to G121), lighter core entries for deck printing and pages (G105, G123), system token defaults without the reset (G110), dashboard nudges past wider widgets (G122) and the stateless MCP revision 2026-07-28 in part (G124).',
    href: '/changelog/',
    linkLabel: 'The changelog',
    demo: 'preview',
  },
  {
    id: 'removals',
    release: '0.10.0',
    title: 'Removed after one minor',
    packages: ['@texuli/tools', '@texuli/blocks'],
    summary:
      'The seven 0.8 MCP tool names and the tree block’s style key, deprecated in 0.9.0, are gone; a call or a block that still uses one is refused with the name to send instead.',
    href: '/mcp-server/#versions',
    linkLabel: 'Removed names and replacements',
    demo: 'preview',
  },
];
