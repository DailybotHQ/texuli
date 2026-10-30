/**
 * The one theme implementation: the `theme.*` operations and the helpers
 * the CLI (`texuli-init theme list|preview|apply`, `init`) uses. The full
 * Texuli theme library ships inside `@texuli/tokens`; nothing is fetched.
 */
import { compileThemeCss, themeVariables } from '@texuli/tokens';
import { runAaGateOnTheme } from '@texuli/tokens/aa-gate';
import { THEME_COLLECTIONS, THEME_MOODS } from '@texuli/tokens/library';
import {
  getFullThemeMeta,
  listFullThemeLibrary,
  loadFullLibraryTheme,
  searchFullThemeLibrary,
} from '@texuli/tokens/library-expand';
import { defineOperation } from './registry.ts';
import type { JsonSchema } from './schema.ts';
import { type Operation, OperationError } from './types.ts';

export interface ThemeSummary {
  id: string;
  name: string;
  collection: string;
  contrastLevel: string;
  darkFirst: boolean;
  description: string;
}

export interface ThemePreview extends ThemeSummary {
  mode: 'light' | 'dark';
  /** Key tokens for the mode, by custom property name. */
  tokens: Record<string, string>;
  /** WCAG 2.x AA gate (both modes). */
  aa: { pass: boolean; issues: number; modes: { mode: string; pass: boolean; issues: number }[] };
}

/** The filters `theme.search` (and `texuli theme list --search`) accept. */
export interface ThemeFilters {
  /** Words that must all match (id, name, tags, mood, category, collection, description), ranked. */
  query?: string;
  category?: string;
  collection?: string;
  mood?: string;
  tag?: string;
}

/** The tokens a preview shows. */
export const PREVIEW_TOKENS = [
  '--tx-background',
  '--tx-foreground',
  '--tx-primary',
  '--tx-primary-foreground',
  '--tx-secondary',
  '--tx-accent',
  '--tx-muted',
  '--tx-muted-foreground',
  '--tx-border',
  '--tx-ring',
  '--tx-destructive',
  '--tx-success',
  '--tx-warning',
  '--tx-radius',
  '--tx-font-sans',
] as const;

/** The largest `theme.search` page: more than the whole library, so one call lists it. */
export const THEME_SEARCH_MAX = 500;
const THEME_SEARCH_DEFAULT = 50;

type Meta = Awaited<ReturnType<typeof listFullThemeLibrary>>[number];

export function themeSummary(meta: ThemeSummary): ThemeSummary {
  return {
    id: meta.id,
    name: meta.name,
    collection: meta.collection,
    contrastLevel: meta.contrastLevel,
    darkFirst: meta.darkFirst,
    description: meta.description,
  };
}

/** Theme metadata matching every filter; with a query, ranked by relevance. */
export async function searchThemes(filters: ThemeFilters = {}): Promise<readonly Meta[]> {
  const query = filters.query?.trim();
  const base = query ? await searchFullThemeLibrary(query) : await listFullThemeLibrary();
  return base.filter((meta) => {
    if (filters.category && meta.category !== filters.category) return false;
    if (filters.collection && meta.collection !== filters.collection) return false;
    if (filters.mood && !meta.mood.includes(filters.mood as Meta['mood'][number])) return false;
    if (filters.tag && !meta.tags.includes(filters.tag)) return false;
    return true;
  });
}

export async function themeExists(id: string): Promise<boolean> {
  return (await getFullThemeMeta(id)) !== undefined;
}

/** Compiled CSS for a theme (light and dark rules). */
export async function themeCss(id: string): Promise<string> {
  return compileThemeCss(await loadFullLibraryTheme(id));
}

/** Key tokens and the AA report for one theme in one mode, or `null` for an unknown id. */
export async function buildThemePreview(
  id: string,
  mode: 'light' | 'dark'
): Promise<ThemePreview | null> {
  const meta = await getFullThemeMeta(id);
  if (!meta) return null;
  const theme = await loadFullLibraryTheme(id);
  const vars = themeVariables({ theme, mode });
  const tokens: Record<string, string> = {};
  for (const name of PREVIEW_TOKENS) if (vars[name] !== undefined) tokens[name] = vars[name];
  const report = runAaGateOnTheme({
    id,
    name: meta.name,
    contrastLevel: meta.contrastLevel === 'AAA' ? 'AAA' : 'AA',
    light: theme.light,
    dark: theme.dark,
  });
  return {
    ...themeSummary(meta),
    mode,
    tokens,
    aa: {
      pass: report.pass,
      issues: report.issueCount,
      modes: report.modes.map((entry) => ({
        mode: entry.mode,
        pass: entry.pass,
        issues: entry.issueCount,
      })),
    },
  };
}

const READ_ONLY = {
  readOnly: true,
  destructive: false,
  idempotent: true,
  openWorld: false,
} as const;

const themeId: JsonSchema = {
  type: 'string',
  minLength: 1,
  maxLength: 64,
  pattern: '^[a-z0-9][a-z0-9-]*$',
  description: 'A theme id from theme.search, e.g. "violet" or "enterprise-neutral".',
};
const shortText = (description: string): JsonSchema => ({
  type: 'string',
  maxLength: 200,
  description,
});
const summaryProperties = {
  id: { type: 'string' },
  name: { type: 'string' },
  collection: { type: 'string' },
  contrastLevel: { type: 'string' },
  darkFirst: { type: 'boolean' },
  description: { type: 'string' },
} as const;

/** The input of `theme.search`, also the legacy `theme` tool's filters. */
export const THEME_SEARCH_PROPERTIES: Readonly<Record<string, JsonSchema>> = {
  query: shortText(
    'Words that must all match the id, name, tags, mood, category, collection or description; results are ranked.'
  ),
  category: shortText('An exact category, e.g. "Technology".'),
  collection: {
    type: 'string',
    enum: [...THEME_COLLECTIONS],
    description: 'One theme collection.',
  },
  mood: { type: 'string', enum: [...THEME_MOODS], description: 'One mood the theme must have.' },
  tag: shortText('An exact tag.'),
  limit: {
    type: 'integer',
    minimum: 1,
    maximum: THEME_SEARCH_MAX,
    default: THEME_SEARCH_DEFAULT,
    description: `How many themes to return (1 to ${THEME_SEARCH_MAX}, default ${THEME_SEARCH_DEFAULT}).`,
  },
};

export const themeSearch: Operation = defineOperation({
  name: 'theme.search',
  title: 'Search the theme library',
  summary:
    'Search the Texuli theme library (200+ offline themes) by words, category, collection, mood or tag. Returns the match count and each theme’s metadata: id, name, description, category, collection, mood, tags, contrast level and whether it is dark-first.',
  input: { type: 'object', properties: THEME_SEARCH_PROPERTIES, additionalProperties: false },
  output: {
    type: 'object',
    properties: {
      total: { type: 'integer', minimum: 0 },
      limit: { type: 'integer' },
      themes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            ...summaryProperties,
            category: { type: 'string' },
            mood: { type: 'array', items: { type: 'string' } },
            tags: { type: 'array', items: { type: 'string' } },
          },
          required: ['id', 'name', 'description', 'category', 'collection', 'mood', 'tags'],
        },
      },
    },
    required: ['total', 'themes', 'limit'],
  },
  annotations: READ_ONLY,
  runtime: 'edge',
  limits: { inputBytes: 4096, items: THEME_SEARCH_MAX, timeMs: 5000 },
  examples: [
    { title: 'Violet themes', input: { query: 'violet', limit: 5 } },
    { title: 'Calm high-contrast themes', input: { collection: 'high-contrast', mood: 'calm' } },
  ],
  async handler(input) {
    const limit = (input.limit as number | undefined) ?? THEME_SEARCH_DEFAULT;
    const matches = await searchThemes(input as ThemeFilters);
    return { total: matches.length, themes: matches.slice(0, limit), limit };
  },
});

export const themeGet: Operation = defineOperation({
  name: 'theme.get',
  title: 'Read a full theme',
  summary:
    'Read the full token definition of one library theme by id. Returns { theme }: its id, name, description and every light and dark color, radius, font and chart token, ready to compile or apply.',
  input: {
    type: 'object',
    properties: { id: themeId },
    required: ['id'],
    additionalProperties: false,
  },
  output: {
    type: 'object',
    properties: {
      theme: {
        type: 'object',
        properties: { id: { type: 'string' }, light: { type: 'object' }, dark: { type: 'object' } },
        required: ['id', 'light', 'dark'],
      },
    },
    required: ['theme'],
  },
  annotations: READ_ONLY,
  runtime: 'edge',
  limits: { inputBytes: 1024, timeMs: 5000 },
  examples: [{ title: 'The violet theme', input: { id: 'violet' } }],
  async handler(input) {
    const id = input.id as string;
    if (!(await themeExists(id)))
      throw new OperationError('not-found', `Unknown theme "${id}". Find ids with theme.search.`);
    return { theme: await loadFullLibraryTheme(id) };
  },
});

export const themePreview: Operation = defineOperation({
  name: 'theme.preview',
  title: 'Preview a theme',
  summary:
    'Preview one library theme in light or dark mode. Returns its summary, the key tokens of that mode (background, foreground, primary, border, radius, font …) and the WCAG 2.x AA contrast report for both modes (aa.pass and issue counts).',
  input: {
    type: 'object',
    properties: {
      id: themeId,
      mode: {
        type: 'string',
        enum: ['light', 'dark'],
        default: 'light',
        description: 'The mode whose tokens to show (default light); the AA report covers both.',
      },
    },
    required: ['id'],
    additionalProperties: false,
  },
  output: {
    type: 'object',
    properties: {
      ...summaryProperties,
      mode: { type: 'string', enum: ['light', 'dark'] },
      tokens: { type: 'object', additionalProperties: { type: 'string' } },
      aa: {
        type: 'object',
        properties: {
          pass: { type: 'boolean' },
          issues: { type: 'integer', minimum: 0 },
          modes: { type: 'array' },
        },
        required: ['pass', 'issues', 'modes'],
      },
    },
    required: ['id', 'name', 'mode', 'tokens', 'aa'],
  },
  annotations: READ_ONLY,
  runtime: 'edge',
  limits: { inputBytes: 1024, timeMs: 5000 },
  examples: [{ title: 'Ocean in dark mode', input: { id: 'ocean', mode: 'dark' } }],
  async handler(input) {
    const id = input.id as string;
    const preview = await buildThemePreview(id, input.mode === 'dark' ? 'dark' : 'light');
    if (!preview)
      throw new OperationError('not-found', `Unknown theme "${id}". Find ids with theme.search.`);
    return preview;
  },
});
