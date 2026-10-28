/**
 * `parseDeckMarkdown`: a deck Markdown document → the same validated v2
 * `Deck` that JSON produces. The dialect's own diagnostics carry a source
 * line and column; the model's diagnostics (JSON paths) are mapped back to
 * the Markdown through a source map built while reading.
 */
import { DECK_SOLID_TOKENS, isDeckBackgroundPreset } from '../model/backgrounds/schema.ts';
import { DECK_FORMAT_VERSION } from '../model/deck.ts';
import { type DeckParseResult, type ParseDeckOptions, parseDeck } from '../model/parse.ts';
import {
  type DeckDiagnostic,
  type DiagnosticSource,
  type PathSegment,
  toJsonPath,
} from '../schema/index.ts';
import { readSlide } from './blocks.ts';
import { frontmatterPath, readFrontmatter } from './frontmatter.ts';
import { IssueSink } from './issues.ts';
import { DECK_MARKDOWN_LIMITS } from './limits.ts';
import { normalizeLines, scanDocument } from './scan.ts';
import { type BuildContext, type BuiltSlide, buildSlide, idCandidate } from './slides.ts';
import { slugify } from './text.ts';

type Bag = Record<string, unknown>;

export interface ParseDeckMarkdownOptions extends ParseDeckOptions {}

export interface DeckMarkdownResult extends DeckParseResult {
  /** The deck object read from the Markdown, before model validation (for editors). */
  draft?: Bag;
  /** JSON path (`$.slides[2].props.title`) → where it was written. */
  sourceMap: Map<string, DiagnosticSource>;
}

/** The draft deck and everything known about where it came from. */
export interface DeckDraft {
  draft: Bag | null;
  sink: IssueSink;
  map: Map<string, DiagnosticSource>;
}

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function expandHex(value: string): string {
  return value.length === 7 ? value : `#${[...value.slice(1)].map((c) => c + c).join('')}`;
}

/** Derive a slide id from its title, unique among the ids before it. */
export function deriveSlideId(slide: Bag, index: number, used: ReadonlySet<string>): string {
  const stem = slugify(idCandidate(slide)) || `slide-${index + 1}`;
  if (!used.has(stem)) return stem;
  for (let n = 2; ; n++) {
    const candidate = `${stem}-${n}`;
    if (!used.has(candidate)) return candidate;
  }
}

/** The id of a vertical stack's section when the author names none. */
export function stackSectionId(firstSlideId: string): string {
  return `stack-${firstSlideId}`.slice(0, 64).replace(/-+$/, '');
}

/** Read the Markdown into a draft deck (not validated) with its issues and source map. */
export function readDeckDraft(text: string): DeckDraft {
  const sink = new IssueSink();
  const map = new Map<string, DiagnosticSource>();
  const lines = normalizeLines(String(text), sink);
  if (lines === null) return { draft: null, sink, map };
  const scanned = scanDocument(lines, sink);
  const front = readFrontmatter(scanned.frontmatter ?? [], sink);

  // Slides: empty ones (only blank lines) are dropped.
  const ctx: BuildContext = { sink, map, jsonBudget: { nodes: DECK_MARKDOWN_LIMITS.jsonNodes } };
  const built: (BuiltSlide & { vertical: boolean })[] = [];
  for (const raw of scanned.slides) {
    if (raw.lines.every((line) => line.text.trim() === '')) continue;
    if (built.length >= DECK_MARKDOWN_LIMITS.slides) {
      sink.report(
        'md-too-many-slides',
        `A deck has at most ${DECK_MARKDOWN_LIMITS.slides} slides; the rest were not read.`,
        { line: raw.line, column: 1 },
        ['slides'],
        'Split the deck.'
      );
      break;
    }
    const source = readSlide(raw.lines, sink);
    const first = raw.lines.find((line) => line.text.trim() !== '');
    const src = { line: first?.n ?? raw.line, column: 1 };
    let vertical = raw.vertical;
    if (vertical && built.length === 0) {
      sink.report(
        'md-stack-start',
        'A `--` vertical slide needs a horizontal slide before it.',
        src
      );
      vertical = false;
    }
    built.push({ ...buildSlide(source, built.length, src, ctx), vertical });
  }

  // Ids
  const used = new Set<string>();
  const slides: Bag[] = built.map((entry, index) => {
    const own = entry.slide.id;
    const id =
      typeof own === 'string' ? own : (entry.attrs.id ?? deriveSlideId(entry.slide, index, used));
    used.add(id);
    const attr = entry.attrs.at.get('id');
    map.set(
      toJsonPath(['slides', index, 'id']),
      attr ? { line: attr.line, column: attr.column } : entry.src
    );
    return { id, ...entry.slide };
  });

  // Outline: vertical stacks and named sections, in document order.
  const sections: Bag[] = [];
  let named: { slideIds: string[] } | null = null;
  for (let i = 0; i < built.length; ) {
    let end = i + 1;
    while (end < built.length && built[end]?.vertical) end++;
    const entry = built[i] as BuiltSlide;
    const ids = slides.slice(i, end).map((slide) => slide.id as string);
    if (end - i > 1) {
      named = null;
      const section: Bag = {
        id: entry.attrs.section ?? stackSectionId(ids[0] ?? ''),
        slideIds: ids,
        stack: true,
      };
      if (entry.attrs.sectionTitle !== undefined) section.title = entry.attrs.sectionTitle;
      map.set(toJsonPath(['outline', 'sections', sections.length]), entry.src);
      sections.push(section);
    } else {
      if (entry.attrs.sectionEnd) named = null;
      if (entry.attrs.section !== undefined) {
        const section: Bag = { id: entry.attrs.section, slideIds: ids };
        if (entry.attrs.sectionTitle !== undefined) section.title = entry.attrs.sectionTitle;
        const attr = entry.attrs.at.get('section');
        map.set(
          toJsonPath(['outline', 'sections', sections.length]),
          attr ? { line: attr.line, column: attr.column } : entry.src
        );
        sections.push(section);
        named = section as { slideIds: string[] };
      } else if (named) named.slideIds.push(...ids);
      else if (entry.attrs.sectionTitle !== undefined) {
        sink.report('md-attr-conflict', '`section-title` needs `section`.', entry.src, [
          'slides',
          i,
        ]);
      }
    }
    i = end;
  }

  // Frontmatter → meta, style, navigation, outline title
  const value = (key: string) => front.values.get(key);
  const deck: Bag = { formatVersion: DECK_FORMAT_VERSION };
  const meta: Bag = {};
  const style: Bag = {};
  const navigation: Bag = {};
  for (const key of front.values.keys()) {
    const line = front.lines.get(key) ?? 1;
    map.set(frontmatterPath(key), { line, column: 1 });
  }
  for (const key of ['title', 'description', 'author', 'date', 'locale', 'dir']) {
    const v = value(key);
    if (v !== undefined) meta[key] = v;
  }
  if (meta.title === undefined) {
    const first = slides[0] ? idCandidate(slides[0]) : '';
    meta.title = first.trim() || 'Untitled deck';
    sink.report(
      'md-title-missing',
      'The frontmatter has no `title`; one was derived.',
      { line: 1, column: 1 },
      ['meta', 'title'],
      'Add `title: …` to the frontmatter.'
    );
  }
  const theme = value('theme');
  const themeMode = value('themeMode');
  const themeSeed = value('themeSeed');
  if (themeSeed !== undefined) {
    style.theme =
      themeMode === undefined
        ? { kind: 'seed', seed: themeSeed }
        : { kind: 'seed', seed: themeSeed, mode: themeMode };
    if (theme !== undefined) {
      sink.report('md-frontmatter-key', '`theme` and `themeSeed` exclude each other.', {
        line: front.lines.get('theme') ?? 1,
        column: 1,
      });
    }
  } else if (themeMode !== undefined) {
    if (theme === undefined) {
      sink.report('md-frontmatter-key', '`themeMode` needs `theme` (or `themeSeed`).', {
        line: front.lines.get('themeMode') ?? 1,
        column: 1,
      });
    } else style.theme = { kind: 'catalog', id: theme, mode: themeMode };
  } else if (theme !== undefined) style.theme = theme;
  for (const key of [
    'fontPair',
    'aspect',
    'density',
    'radius',
    'motion',
    'transition',
    'logo',
    'footer',
    'slideNumbers',
    'progress',
    'codeTheme',
    'math',
  ]) {
    const v = value(key);
    if (v !== undefined) style[key] = v;
  }
  const background = value('background');
  if (typeof background === 'string') {
    if (isDeckBackgroundPreset(background)) style.background = background;
    else if (HEX.test(background))
      style.background = { kind: 'solid', color: expandHex(background) };
    else if ((DECK_SOLID_TOKENS as readonly string[]).includes(background)) {
      style.background = { kind: 'solid', token: background };
    } else style.background = background;
  }
  const start = value('start');
  if (start !== undefined) navigation.start = start;
  const loop = value('loop');
  if (loop !== undefined) navigation.loop = loop;
  const autoSlide = value('autoSlide');
  if (autoSlide !== undefined) navigation.autoSlideMs = autoSlide;
  const outlineTitle = value('outlineTitle');

  deck.meta = meta;
  if (Object.keys(style).length > 0) deck.style = style;
  if (Object.keys(navigation).length > 0) deck.navigation = navigation;
  if (sections.length > 0) {
    deck.outline = outlineTitle === undefined ? { sections } : { title: outlineTitle, sections };
  } else if (outlineTitle !== undefined) {
    sink.report(
      'md-frontmatter-value',
      '`outlineTitle` needs at least one section (`section=` or a `--` stack).',
      { line: front.lines.get('outlineTitle') ?? 1, column: 1 }
    );
  }
  deck.slides = slides;
  return { draft: deck, sink, map };
}

/** The source of the longest prefix of `path` that was recorded. */
function locate(
  map: Map<string, DiagnosticSource>,
  path: readonly PathSegment[]
): DiagnosticSource | undefined {
  for (let n = path.length; n >= 0; n--) {
    const found = map.get(toJsonPath(path.slice(0, n)));
    if (found) return found;
  }
  return undefined;
}

/**
 * Parse a deck Markdown document into a validated v2 deck. Every dialect and
 * model issue is reported (capped at 200) with a source line and column;
 * `ok` is true only when there is no error. Never throws.
 */
export function parseDeckMarkdown(
  text: string,
  options: ParseDeckMarkdownOptions = {}
): DeckMarkdownResult {
  let read: DeckDraft;
  try {
    read = readDeckDraft(text);
  } catch {
    const sink = new IssueSink();
    sink.report('md-too-large', 'The document could not be read.', { line: 1, column: 1 });
    return { ok: false, issues: sink.issues, steps: [], truncated: false, sourceMap: new Map() };
  }
  const { draft, sink, map } = read;
  if (draft === null) {
    return { ok: false, issues: sink.issues, steps: [], truncated: sink.truncated, sourceMap: map };
  }
  const model = parseDeck(draft, options);
  const issues: DeckDiagnostic[] = [...sink.issues];
  const max =
    options.maxIssues !== undefined && options.maxIssues > 0
      ? options.maxIssues
      : DECK_MARKDOWN_LIMITS.issues;
  let truncated = sink.truncated || model.truncated;
  for (const issue of model.issues) {
    if (issues.length >= max) {
      truncated = true;
      break;
    }
    if (issue.source === undefined) {
      const source = locate(map, issue.path);
      if (source) issue.source = { ...source };
    }
    issues.push(issue);
  }
  if (issues.length > max) {
    issues.length = max;
    truncated = true;
  }
  const ok = model.ok && sink.errors === 0;
  const result: DeckMarkdownResult = {
    ok,
    issues,
    steps: model.steps,
    truncated,
    draft,
    sourceMap: map,
  };
  if (ok && model.deck) result.deck = model.deck;
  return result;
}
