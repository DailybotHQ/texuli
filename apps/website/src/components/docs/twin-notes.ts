/**
 * "For agents" notes for the Markdown twins of interactive pages (PLAN_011
 * T-ar-twins). A twin carries a page's static content; a live demo runs in
 * the browser and cannot be mirrored as text. For those pages the twin says
 * what the demo shows and names the docs, catalog entries and MCP operations
 * an agent uses to do the same thing through the protocol
 * (`https://texuli.com/mcp`, read-only and anonymous).
 *
 * Data only: the operation titles come from the registry the build passes
 * in, and `apps/website/tests/twins.test.ts` checks that every operation
 * named here is one the remote MCP serves and every package README exists.
 */

/** Where an agent reads more. */
export interface NoteLink {
  label: string;
  /** Root-relative site path or an https URL. */
  href: string;
}

/** The note for one page or page family. */
export interface TwinNote {
  /** Matches the page route. */
  route: RegExp;
  /** What the live demo shows, one or two sentences. */
  demo: string;
  /** MCP operation names (`theme.search`) that do the same thing. */
  operations: readonly string[];
  /** Workspace packages whose README documents the feature (`tokens`). */
  packages: readonly string[];
  links?: readonly NoteLink[];
}

const REPO = 'https://github.com/DailybotHQ/texuli/blob/main';

/** The ops reference every note links (the same target as `/llms.txt`). */
export const OPS_DOC = `${REPO}/packages/tools/docs/ops.md#operations`;

const CATALOG_LINKS: readonly NoteLink[] = [
  { label: 'Component docs for agents (llms.txt)', href: '/llms/llms.txt' },
  { label: 'Catalog manifest snapshot (JSON)', href: '/catalog/catalog.json' },
];

const THEME_OPS = ['theme.search', 'theme.get', 'theme.preview'] as const;
const CATALOG_OPS = ['catalog.search', 'component.get', 'example.search'] as const;

/** Every note, first match wins. */
export const TWIN_NOTES: readonly TwinNote[] = Object.freeze([
  {
    route: /^\/$/,
    demo: 'The home page links the live demos of the site. Agents can read every page as Markdown and use the read-only MCP server for the catalog, examples, themes, blueprints, decks and documents.',
    operations: [...CATALOG_OPS, ...THEME_OPS, 'blueprint.validate', 'deck.run', 'document.run'],
    packages: ['texuli', 'catalog', 'tools'],
    links: [
      { label: 'Site guide for agents (llms.txt)', href: '/llms.txt' },
      { label: 'How agents access texuli.com (auth.md)', href: '/auth.md' },
      { label: 'Agentic resource catalog', href: '/.well-known/ai-catalog.json' },
    ],
  },
  {
    route: /^\/component-pages\/[^/]+\/$/,
    demo: 'The live preview, prop editor and copyable code run in the browser. The component manifest holds the same props, events, examples and guidance as data.',
    operations: ['component.get', 'example.search', 'catalog.search'],
    packages: ['texuli', 'catalog'],
    links: CATALOG_LINKS,
  },
  {
    route: /^\/(?:gallery-components\/(?:preview\/)?|component-pages\/)$/,
    demo: 'Live previews of every catalog component, with dark mode, right to left, editable props and copyable code, all in the browser.',
    operations: [...CATALOG_OPS],
    packages: ['texuli', 'catalog'],
    links: CATALOG_LINKS,
  },
  {
    route: /^\/examples\/(?:preview\/)?[^/]+\/$/,
    demo: 'A worked example rendered live in the browser; the isolated preview frame (`/examples/preview/<id>/`) shows the same example without the site shell, and the example page next to it carries its code.',
    operations: ['example.search', 'component.get'],
    packages: ['examples', 'texuli'],
    links: CATALOG_LINKS,
  },
  {
    route: /^\/examples\/$/,
    demo: 'Every worked example, rendered live in the browser with its code.',
    operations: ['example.search', 'catalog.search'],
    packages: ['examples', 'texuli'],
    links: CATALOG_LINKS,
  },
  {
    route: /^\/(?:theme-studio|color-explorer|theme-switcher|gallery-themes)\/$/,
    demo: 'The theme tools run in the browser: search and preview library themes, inspect OKLCH scales and WCAG AA contrast, and export tokens.',
    operations: [...THEME_OPS],
    packages: ['tokens'],
  },
  {
    route: /^\/(?:builder|playground|agent-chat|live-generation|workflows-page\/json)\/$/,
    demo: 'Blueprints are composed, validated and painted live in the browser. The same validation runs through the protocol: an agent drafts a blueprint from catalog components and checks it before anything renders.',
    operations: ['blueprint.validate', 'catalog.search', 'component.get', 'catalog.validate'],
    packages: ['catalog', 'player', 'spec'],
    links: CATALOG_LINKS,
  },
  {
    route: /^\/slides-page\/$/,
    demo: 'Decks built from JSON or Markdown play live in the browser.',
    operations: ['deck.run', 'blueprint.validate'],
    packages: ['slides', 'deck'],
  },
  {
    route: /^\/documents-page\/$/,
    demo: 'The block editor, reader and paged view run live in the browser.',
    operations: ['document.run'],
    packages: ['document', 'pages'],
  },
  {
    route: /^\/editor-page\/$/,
    demo: 'The rich text editor runs live in the browser, with Markdown in and out.',
    operations: ['document.run'],
    packages: ['editor'],
  },
  {
    route: /^\/charts-page\/(?:[^/]+\/)?$/,
    demo: 'Charts render live in the browser from the data shown on the page.',
    operations: ['catalog.search', 'component.get'],
    packages: ['charts'],
    links: CATALOG_LINKS,
  },
  {
    route: /^\/blocks-page\/(?:[^/]+\/)?$/,
    demo: 'Content blocks render live in the browser.',
    operations: ['catalog.search', 'component.get', 'document.run'],
    packages: ['blocks'],
    links: CATALOG_LINKS,
  },
  {
    route: /^\/output-page\/(?:preview\/)?$/,
    demo: 'One blueprint rendered to several targets; the email preview is the HTML the email writer produces at build time.',
    operations: ['blueprint.validate'],
    packages: ['tools', 'player'],
  },
  {
    route: /^\/showcase\/(?:[^/]+\/)?$/,
    demo: 'Complete screens composed only from Texuli components, interactive in the browser.',
    operations: [...CATALOG_OPS, 'blueprint.validate'],
    packages: ['texuli', 'data'],
    links: CATALOG_LINKS,
  },
  {
    route: /^\/dashboards-page\/$/,
    demo: 'Dashboard widgets you move and resize by pointer or keyboard, live in the browser.',
    operations: ['catalog.search', 'component.get'],
    packages: ['data'],
  },
  {
    route: /^\/forms-page\/$/,
    demo: 'Schema-driven forms with validation and steps, live in the browser.',
    operations: ['catalog.search', 'component.get'],
    packages: ['forms'],
  },
  {
    route: /^\/sheets-page\/$/,
    demo: 'A spreadsheet with its formula engine, live in the browser.',
    operations: ['catalog.search'],
    packages: ['sheets'],
  },
  {
    route: /^\/canvas-page\/$/,
    demo: 'The infinite canvas, live in the browser.',
    operations: ['catalog.search'],
    packages: ['canvas'],
  },
  {
    route: /^\/drag-page\/$/,
    demo: 'Sortable lists, boards, trees and free placement on the drag engine, live in the browser.',
    operations: ['catalog.search'],
    packages: ['drag'],
  },
  {
    route: /^\/workflows-page\/$/,
    demo: 'The workflow editor and viewer, live in the browser.',
    operations: ['catalog.search', 'blueprint.validate'],
    packages: ['workflows'],
  },
  {
    route: /^\/motion-page\/$/,
    demo: 'Motion demos (presence, layout, timelines and springs) that play in the browser.',
    operations: ['catalog.search'],
    packages: ['texuli'],
  },
  {
    route: /^\/media-page\/$/,
    demo: 'Image, video and audio components and browser export, live in the browser.',
    operations: ['catalog.search', 'component.get'],
    packages: ['media'],
  },
  {
    route: /^\/search\/$/,
    demo: 'A static search index queried in the browser.',
    operations: ['catalog.search', 'example.search', 'theme.search'],
    packages: ['tools'],
    links: [{ label: 'Site guide for agents (llms.txt)', href: '/llms.txt' }],
  },
  {
    route: /^\/whats-new\/$/,
    demo: 'Each new capability has a live demo or preview in the browser.',
    operations: [...CATALOG_OPS, 'deck.run', 'document.run'],
    packages: ['texuli'],
  },
]);

/** The note that covers `route`, if any. */
export function twinNoteFor(route: string): TwinNote | undefined {
  return TWIN_NOTES.find((note) => note.route.test(route));
}

/** The registry facts a note prints for an operation. */
export interface NoteOperation {
  name: string;
  title: string;
}

/**
 * The "For agents" Markdown section for `route`, or `undefined` when the
 * page has no live demo. `operations` are the ones the remote MCP serves;
 * an unknown name throws (a build bug, caught by the unit test first).
 */
export function agentNoteMarkdown(
  route: string,
  operations: readonly NoteOperation[],
  origin: string
): string | undefined {
  const note = twinNoteFor(route);
  if (!note) return undefined;
  const byName = new Map(operations.map((operation) => [operation.name, operation]));
  const component = /^\/component-pages\/([^/]+)\/$/.exec(route)?.[1];
  const lines = [
    '## For agents',
    '',
    `${note.demo} The live parts run in the browser and are not in this Markdown; the operations below do the same work through the read-only MCP server at ${origin}/mcp (no sign-in; see ${origin}/auth.md).`,
    '',
    `MCP operations ([reference](${OPS_DOC})):`,
    '',
  ];
  for (const name of note.operations) {
    const operation = byName.get(name);
    if (!operation) throw new Error(`twin note for ${route} names unknown operation ${name}`);
    const input = component && name === 'component.get' ? ` with \`{"id":"${component}"}\`` : '';
    lines.push(`- \`${name}\`: ${operation.title}${input}.`);
  }
  lines.push('', 'Docs:', '');
  if (component)
    lines.push(`- [${component} component doc (Markdown)](/llms/components/${component}.md)`);
  const framed = /^\/examples\/preview\/([^/]+)\/$/.exec(route)?.[1];
  if (framed) lines.push(`- [The example page, with its code (Markdown)](/examples/${framed}.md)`);
  for (const link of note.links ?? []) lines.push(`- [${link.label}](${link.href})`);
  for (const name of note.packages)
    lines.push(
      `- [${name === 'texuli' ? 'texuli' : `@texuli/${name}`} README](${REPO}/packages/${name}/README.md)`
    );
  return `${lines.join('\n')}\n`;
}
