/**
 * The Texuli MCP resources. Every body is computed from data the package
 * already ships (the static manifest list, the theme library, the deck and
 * document schemas), so the provider is edge-safe: no file system, no
 * network. The package guides (`packages/<pkg>/docs/*.md`) are not bundled;
 * `texuli://docs/{slug}` serves the per-component Markdown the site
 * publishes under `/llms/components/` (see `docs/mcp.md`).
 */
import type { CatalogEntry } from '@texuli/catalog/build';
import {
  getFullThemeMeta,
  listFullThemeLibrary,
  loadFullLibraryTheme,
} from '@texuli/tokens/library-expand';
import { runDeckCommand } from '../deck/index.ts';
import { runDocumentCommand } from '../document/index.ts';
import { buildLlmsBundle } from '../llms/bundle.ts';
import { loadOpsCatalog } from '../ops/catalog.ts';
import { themeCss } from '../ops/themes.ts';
import type { McpResource, McpResourceContents, McpResourceProvider } from './protocol.ts';

const JSON_TYPE = 'application/json';
const MARKDOWN_TYPE = 'text/markdown';

/** The schemas `texuli://schema/{name}` serves. */
export const MCP_SCHEMA_NAMES = ['deck', 'document'] as const;
type SchemaName = (typeof MCP_SCHEMA_NAMES)[number];

const SCHEMA_DESCRIPTIONS: Record<SchemaName, string> = {
  deck: 'The JSON Schema of a Texuli deck (formatVersion 2): slides, layouts, notes and theme. Write decks against it, then check them with the deck.run lint command.',
  document:
    'The JSON Schema of a Texuli document (format texuli-document, formatVersion 1): blocks, marks and metadata. Check documents with the document.run validate command.',
};

const ID = '([a-z0-9][a-z0-9-]{0,127})';
const COMPONENT_URI = new RegExp(`^texuli://component/${ID}$`, 'u');
const DOCS_URI = new RegExp(`^texuli://docs/${ID}$`, 'u');
const THEME_URI = /^texuli:\/\/theme\/([a-z0-9][a-z0-9-]{0,63})$/u;
const SCHEMA_URI = /^texuli:\/\/schema\/([a-z]+)$/u;

let bundle: Promise<{ full: string; docs: Map<string, string> }> | undefined;

/** The llms bundle the site publishes, built once from the same catalog. */
function llms(): Promise<{ full: string; docs: Map<string, string> }> {
  bundle ??= loadOpsCatalog().then((built) => {
    const result = buildLlmsBundle({ catalog: built.catalog });
    const docs = new Map<string, string>();
    for (const file of result.components) {
      const id = file.path.replace(/^components\//u, '').replace(/\.md$/u, '');
      docs.set(id, file.body);
    }
    return { full: result.llmsFullTxt, docs };
  });
  return bundle;
}

async function entries(): Promise<Map<string, CatalogEntry>> {
  const built = await loadOpsCatalog();
  return new Map(built.catalog.entries.map((entry) => [entry.id, entry]));
}

const one = (uri: string, mimeType: string, text: string): McpResourceContents[] => [
  { uri, mimeType, text },
];

/** The Texuli resource provider: catalog, components, docs, llms, themes and schemas. */
export const texuliResources: McpResourceProvider = {
  async list() {
    const built = await loadOpsCatalog();
    const themes = await listFullThemeLibrary();
    const resources: McpResource[] = [
      {
        uri: 'texuli://catalog',
        name: 'catalog',
        title: 'Component catalog',
        description: `The content-addressed Texuli component catalog (catalog-${built.hash.slice(0, 12)}…, ${built.catalog.entries.length} components): every manifest with props, examples, useWhen, dontUseWhen and emit tiers. The exact bytes hash to the catalog id.`,
        mimeType: JSON_TYPE,
      },
      {
        uri: 'texuli://llms/full',
        name: 'llms-full',
        title: 'Full agent docs',
        description:
          'Every component page in one Markdown file, identical to texuli.com/llms/llms-full.txt. Read it when you need the whole catalog as prose; texuli://docs/{slug} has one page.',
        mimeType: MARKDOWN_TYPE,
      },
      ...MCP_SCHEMA_NAMES.map((name) => ({
        uri: `texuli://schema/${name}`,
        name: `schema-${name}`,
        title: `${name[0]?.toUpperCase()}${name.slice(1)} JSON Schema`,
        description: SCHEMA_DESCRIPTIONS[name],
        mimeType: JSON_TYPE,
      })),
    ];
    for (const entry of built.catalog.entries)
      resources.push({
        uri: `texuli://component/${entry.id}`,
        name: `component-${entry.id}`,
        title: entry.label,
        description: `${entry.summary} The manifest as JSON (group ${entry.group}, emit: ${entry.emit.join(', ') || 'none'}).`,
        mimeType: JSON_TYPE,
      });
    for (const entry of built.catalog.entries)
      resources.push({
        uri: `texuli://docs/${entry.id}`,
        name: `docs-${entry.id}`,
        title: `${entry.label} (Markdown)`,
        description: `The agent Markdown page for ${entry.id}: use when, do not use when, props table and examples.`,
        mimeType: MARKDOWN_TYPE,
      });
    for (const theme of themes)
      resources.push({
        uri: `texuli://theme/${theme.id}`,
        name: `theme-${theme.id}`,
        title: theme.name,
        description: `${theme.description} The full light and dark token definition as JSON, then its compiled CSS.`,
        mimeType: JSON_TYPE,
      });
    return resources;
  },
  templates: [
    {
      uriTemplate: 'texuli://component/{id}',
      name: 'component',
      title: 'Component manifest',
      description:
        'One component manifest as JSON: props with kinds and schemas, events, examples, useWhen and dontUseWhen, accessibility notes and emit tiers. Complete {id}, or find ids with catalog.search.',
      mimeType: JSON_TYPE,
    },
    {
      uriTemplate: 'texuli://docs/{slug}',
      name: 'docs',
      title: 'Component docs',
      description:
        'The agent Markdown page of one component ({slug} is its id), identical to texuli.com/llms/components/{slug}.md. Package guides are not served here yet.',
      mimeType: MARKDOWN_TYPE,
    },
    {
      uriTemplate: 'texuli://theme/{id}',
      name: 'theme',
      title: 'Library theme',
      description:
        'One library theme: the full light and dark token definition as JSON, then the compiled CSS ready for a stylesheet. Complete {id}, or search with theme.search.',
      mimeType: JSON_TYPE,
    },
    {
      uriTemplate: 'texuli://schema/{name}',
      name: 'schema',
      title: 'Format JSON Schema',
      description: `The JSON Schema of a Texuli data format. {name} is one of ${MCP_SCHEMA_NAMES.join(', ')}; the blueprint schema is not served yet.`,
      mimeType: JSON_TYPE,
    },
  ],
  async read(uri) {
    if (uri === 'texuli://catalog') return one(uri, JSON_TYPE, (await loadOpsCatalog()).json);
    if (uri === 'texuli://llms/full') return one(uri, MARKDOWN_TYPE, (await llms()).full);
    const component = COMPONENT_URI.exec(uri)?.[1];
    if (component !== undefined) {
      const entry = (await entries()).get(component);
      return entry ? one(uri, JSON_TYPE, JSON.stringify(entry)) : undefined;
    }
    const slug = DOCS_URI.exec(uri)?.[1];
    if (slug !== undefined) {
      const body = (await llms()).docs.get(slug);
      return body === undefined ? undefined : one(uri, MARKDOWN_TYPE, body);
    }
    const theme = THEME_URI.exec(uri)?.[1];
    if (theme !== undefined) {
      if (!(await getFullThemeMeta(theme))) return undefined;
      return [
        { uri, mimeType: JSON_TYPE, text: JSON.stringify(await loadFullLibraryTheme(theme)) },
        { uri, mimeType: 'text/css', text: await themeCss(theme) },
      ];
    }
    const schema = SCHEMA_URI.exec(uri)?.[1];
    if (schema === 'deck') return one(uri, JSON_TYPE, JSON.stringify(runDeckCommand('schema')));
    if (schema === 'document')
      return one(uri, JSON_TYPE, JSON.stringify(await runDocumentCommand('schema')));
    return undefined;
  },
  async complete(uriTemplate, variable) {
    if (
      (uriTemplate === 'texuli://component/{id}' && variable === 'id') ||
      (uriTemplate === 'texuli://docs/{slug}' && variable === 'slug')
    )
      return [...(await entries()).keys()];
    if (uriTemplate === 'texuli://theme/{id}' && variable === 'id') return themeIds();
    if (uriTemplate === 'texuli://schema/{name}' && variable === 'name') return MCP_SCHEMA_NAMES;
    return undefined;
  },
};

/** Every library theme id, in library order. */
export async function themeIds(): Promise<readonly string[]> {
  return (await listFullThemeLibrary()).map((theme) => theme.id);
}

/** Every catalog component id, sorted. */
export async function componentIds(): Promise<readonly string[]> {
  return [...(await entries()).keys()];
}
