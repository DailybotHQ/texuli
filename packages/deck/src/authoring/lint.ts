import { DECK_BACKGROUND_PRESET_IDS } from '../model/backgrounds/index.ts';
import {
  DECK_MODEL_LIMITS,
  DECK_SLIDE_LAYOUTS,
  type Deck,
  parseDeck,
  slideSteps,
} from '../model/index.ts';
import { validateLayoutProps } from '../model/layouts/index.ts';
import { createDiagnostic, type DeckDiagnostic, type PathSegment } from '../schema/index.ts';

export const DECK_LINT_RULES = Object.freeze({
  errors: ['unknown-layout', 'layout-props', 'image-alt', 'image-size', 'step-order'],
  warnings: [
    'empty-steps',
    'unknown-background',
    'custom-slide',
    'step-unrevealed',
    'notes-missing',
    'notes-duplicate',
    'notes-boilerplate',
    'layout-repetition',
    'too-many-words',
  ],
  suggestions: ['prefer-layout'],
} as const);
export type DeckLintRule =
  | (typeof DECK_LINT_RULES.errors)[number]
  | (typeof DECK_LINT_RULES.warnings)[number]
  | 'prefer-layout'
  | (string & {});
export interface DeckLintIssue extends DeckDiagnostic {
  rule: DeckLintRule;
}
export interface DeckLintReport {
  ok: boolean;
  /** Every distinct error found, also past the `issues` cap. */
  errors: number;
  /** Every distinct warning found, also past the `issues` cap. */
  warnings: number;
  /** At most `DECK_LINT_MAX_ISSUES`, one per rule and path. */
  issues: DeckLintIssue[];
  /** True when issues past the cap were counted but not listed. */
  truncated: boolean;
}

/** Issues listed in one report (the model's diagnostics cap); the rest are counted. */
export const DECK_LINT_MAX_ISSUES = 200;
/** How deep `wordCount` reads a value (the model refuses deeper values anyway). */
const WORD_DEPTH = 32;

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
/**
 * Keys whose strings are text a viewer reads: titles, bodies, list items,
 * labels and captions. Everything else (chart kinds, ids, URLs, alt text,
 * code, sizes, widths, tones, step fields) is a setting, not words on the
 * slide. A string inside an array counts when the array's key does
 * (`bullets`, comparison `columns` and `values`).
 */
const HUMAN_TEXT_KEYS = new Set([
  'title',
  'subtitle',
  'eyebrow',
  'meta',
  'heading',
  'body',
  'text',
  'markdown',
  'quote',
  'cite',
  'caption',
  'credit',
  'label',
  'description',
  'context',
  'footnote',
  'name',
  'role',
  'number',
  'bullets',
  'items',
  'columns',
  'values',
  'time',
  'summary',
  'content',
]);
const WORD = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;
/** Link destinations in Markdown text: `](https://…)` is not words on the slide. */
const LINK_DESTINATION = /\]\([^)\s]*\)/g;

/**
 * Words of human text in a value (see `HUMAN_TEXT_KEYS`). `all` counts every
 * string below (the cells of a table block's `rows`, keyed by column id).
 */
function wordCount(value: unknown, human = false, all = false, depth = 0): number {
  if (typeof value === 'string') {
    if (!human && !all) return 0;
    return (value.replace(LINK_DESTINATION, ']').match(WORD) ?? []).length;
  }
  if (depth >= WORD_DEPTH) return 0;
  if (Array.isArray(value))
    return value.reduce<number>((sum, item) => sum + wordCount(item, human, all, depth + 1), 0);
  const record = asRecord(value);
  if (!record) return 0;
  let sum = 0;
  for (const [key, child] of Object.entries(record)) {
    const rows = all || (record.type === 'table' && key === 'rows');
    sum += wordCount(child, all || HUMAN_TEXT_KEYS.has(key), rows, depth + 1);
  }
  return sum;
}

/** Boilerplate notes phrases, matched inside normalized notes (lowercase, punctuation as spaces). */
const BOILERPLATE_NOTES = [
  'do not read the slide',
  "don't read the slide",
  'dont read the slide',
  'no leer la diapositiva',
];

/** Notes lowercased with punctuation as single spaces (`’` read as `'`). */
const normalizeNotes = (notes: string) =>
  notes
    .toLowerCase()
    .replace(/’/g, "'")
    .replace(/[^\p{L}\p{N}']+/gu, ' ')
    .trim();

/** How a message names a slide: `slide "pricing"`, or its position when it has no id. */
const slideName = (item: Record<string, unknown>, index: number) =>
  typeof item.id === 'string' && item.id !== ''
    ? `slide ${JSON.stringify(item.id.slice(0, 64))}`
    : `slide ${index + 1}`;
const quoted = (text: string, max = 60) =>
  JSON.stringify(text.length > max ? `${text.slice(0, max - 1)}…` : text);

/**
 * Static quality checks. It accepts untrusted input and never throws. Work is
 * bounded: one issue per rule and path (a set, not a scan), at most
 * `DECK_LINT_MAX_ISSUES` listed, and a deck over the model's structural
 * limits (`too-many`, `too-deep`) reports the model issues without the
 * quality pass.
 */
export function lintDeck(value: unknown): DeckLintReport {
  const parsed = parseDeck(value);
  const issues: DeckLintIssue[] = [];
  const seen = new Set<string>();
  let errors = 0;
  let warnings = 0;
  const add = (
    rule: DeckLintRule,
    severity: 'error' | 'warning',
    message: string,
    path: PathSegment[],
    fix?: string
  ) => {
    const key = JSON.stringify([rule, path]);
    if (seen.has(key)) return;
    seen.add(key);
    if (severity === 'error') errors++;
    else warnings++;
    if (issues.length >= DECK_LINT_MAX_ISSUES) return;
    issues.push({
      ...createDiagnostic(rule, message, path, fix ? { fix } : undefined),
      rule,
      severity,
    });
  };
  const report = (): DeckLintReport => ({
    ok: errors === 0,
    errors,
    warnings,
    issues,
    truncated: errors + warnings > issues.length || parsed.truncated === true,
  });
  const raw = asRecord(value);
  const slides = Array.isArray(raw?.slides) ? raw.slides : [];
  for (const issue of parsed.issues) {
    if (issue.code === 'unknown-background' || issue.code === 'step-unrevealed') continue;
    const path = issue.path;
    const layout = path.at(-1) === 'layout' || path.at(-2) === 'layout';
    const rule: DeckLintRule =
      issue.code === 'unknown-layout' || layout
        ? 'unknown-layout'
        : path.includes('props')
          ? 'layout-props'
          : issue.code;
    add(rule, issue.severity, issue.message, path, issue.fix);
  }
  // Over a structural limit: the model issues say what to fix; a quality pass
  // over 16,000 slides or a 5,000-deep value would only add noise and work.
  if (parsed.issues.some((issue) => issue.code === 'too-many' || issue.code === 'too-deep')) {
    return report();
  }
  const notesSeen = new Map<string, number>();
  let previousLayout = '';
  let run = 0;
  slides.forEach((rawSlide, index) => {
    const item = asRecord(rawSlide);
    if (!item) return;
    const base: PathSegment[] = ['slides', index];
    const layout = item.layout;
    if (
      typeof layout === 'string' &&
      DECK_SLIDE_LAYOUTS.includes(layout as (typeof DECK_SLIDE_LAYOUTS)[number]) &&
      layout !== 'free' &&
      layout !== 'component' &&
      layout !== 'custom' &&
      asRecord(item.props)
    ) {
      const result = validateLayoutProps(layout, item.props, { path: [...base, 'props'] });
      for (const problem of result.issues)
        add('layout-props', 'error', problem.message, problem.path, problem.fix);
    }
    if (layout === 'custom')
      add(
        'custom-slide',
        'warning',
        'Custom slides depend on a host renderer and may not travel with the deck.',
        [...base, 'props', 'component']
      );
    if (
      typeof item.background === 'string' &&
      !DECK_BACKGROUND_PRESET_IDS.includes(
        item.background as (typeof DECK_BACKGROUND_PRESET_IDS)[number]
      )
    ) {
      add('unknown-background', 'warning', `Unknown background "${item.background}".`, [
        ...base,
        'background',
      ]);
    }
    const props = asRecord(item.props);
    const imageCheck = (record: Record<string, unknown>, path: PathSegment[], isImage: boolean) => {
      if (!isImage || !Object.hasOwn(record, 'src')) return;
      if (typeof record.alt !== 'string' || !record.alt.trim())
        add('image-alt', 'error', 'Images need descriptive alt text.', [...path, 'alt']);
      if (typeof record.width !== 'number' || typeof record.height !== 'number')
        add('image-size', 'error', 'Images need intrinsic width and height.', path);
    };
    if (props)
      walk(props, [...base, 'props'], (record, path) =>
        imageCheck(record, path, path.at(-1) === 'image')
      );
    if (Array.isArray(item.blocks))
      walk(item.blocks, [...base, 'blocks'], (record, path) =>
        imageCheck(record, path, record.type === 'image')
      );
    const name = slideName(item, index);
    const labels = Array.isArray(item.steps) ? item.steps : [];
    const stepResult = slideSteps(item as unknown as Parameters<typeof slideSteps>[0]);
    // A custom slide's host component reveals its own steps: its labels are the steps.
    if (layout !== 'custom') {
      labels.forEach((label, i) => {
        const step = stepResult.steps[i + 1];
        if (step && step.fragments.length > 0) return;
        const text = typeof label === 'string' ? ` (${quoted(label)})` : '';
        add(
          'empty-steps',
          'warning',
          `The ${name} labels step ${i + 1}${text} in "steps", but nothing reveals on it.`,
          [...base, 'steps', i],
          `Add a fragment with "step": ${i + 1}, or remove this label.`
        );
      });
    }
    for (const problem of stepResult.issues)
      if (problem.code === 'step-unrevealed')
        add('step-unrevealed', 'warning', problem.message, [...base, ...problem.path], problem.fix);
    let latest = 0;
    const authoredSteps: { value: number; path: PathSegment[] }[] = [];
    const collectSteps = (value: unknown, path: PathSegment[]) =>
      walk(value, path, (record, current) => {
        if (typeof record.step === 'number' && Number.isInteger(record.step) && record.step > 0)
          authoredSteps.push({ value: record.step, path: [...current, 'step'] });
      });
    if (Array.isArray(item.blocks)) collectSteps(item.blocks, [...base, 'blocks']);
    if (props) collectSteps(props, [...base, 'props']);
    for (const fragment of authoredSteps) {
      if (fragment.value < latest)
        add(
          'step-order',
          'error',
          'A later element is revealed before an earlier element.',
          fragment.path
        );
      latest = Math.max(latest, fragment.value);
    }
    const notes = typeof item.notes === 'string' ? item.notes.trim() : '';
    const visible = item.hidden !== true;
    if (visible && notes.length < 40)
      add('notes-missing', 'warning', 'Visible slides should include useful speaker notes.', [
        ...base,
        'notes',
      ]);
    if (visible && notes) {
      const normalized = normalizeNotes(notes);
      const prior = notesSeen.get(normalized);
      if (prior !== undefined)
        add('notes-duplicate', 'warning', `Notes repeat slide ${prior + 1}.`, [...base, 'notes']);
      else notesSeen.set(normalized, index);
      const padded = ` ${normalized} `;
      const phrase = BOILERPLATE_NOTES.find((text) => padded.includes(` ${text} `));
      if (phrase)
        add(
          'notes-boilerplate',
          'warning',
          `The ${name} "notes" contain the boilerplate phrase "${phrase}".`,
          [...base, 'notes'],
          'Replace it with what to say: the point, the evidence and the transition.'
        );
    }
    if (visible) {
      if (typeof layout === 'string' && layout === previousLayout) run++;
      else run = 1;
      if (run > 2)
        add(
          'layout-repetition',
          'warning',
          `Layout "${layout}" repeats more than twice in a row.`,
          [...base, 'layout']
        );
      previousLayout = typeof layout === 'string' ? layout : '';
      const allowed = layout === 'title-hero' || layout === 'big-stat' ? 60 : 55;
      // Words per part: free blocks, layout props by top-level key, or component props.
      const parts: { path: PathSegment[]; field: string; words: number }[] = [];
      if (layout === 'free' && Array.isArray(item.blocks)) {
        item.blocks.forEach((block, b) => {
          const type = asRecord(block)?.type;
          parts.push({
            path: [...base, 'blocks', b],
            field: `blocks[${b}]${typeof type === 'string' ? ` (${type.slice(0, 32)})` : ''}`,
            words: wordCount(block),
          });
        });
      } else if (layout === 'component') {
        const component = asRecord(item.component);
        parts.push({
          path: [...base, 'component', 'props'],
          field: 'component.props',
          words: wordCount(component?.props, false, false, 1),
        });
      } else if (props) {
        for (const [key, child] of Object.entries(props))
          parts.push({
            path: [...base, 'props'],
            field: `props.${key}`,
            words: wordCount({ [key]: child }),
          });
      }
      const textWords = parts.reduce((sum, part) => sum + part.words, 0);
      const most = parts.reduce<(typeof parts)[number] | undefined>(
        (best, part) => (best === undefined || part.words > best.words ? part : best),
        undefined
      );
      if (textWords > allowed && most)
        add(
          'too-many-words',
          'warning',
          `The ${name} has ${textWords} words of text; the suggested limit is ${allowed}. ${most.field} holds the most (${most.words}).`,
          most.path,
          'Cut the text, split the slide, or move the detail into the speaker notes.'
        );
    }
    if (visible && layout === 'free') {
      const types = Array.isArray(item.blocks)
        ? item.blocks.map((block) => asRecord(block)?.type)
        : [];
      const suggestion = types.find(
        (type) =>
          type === 'chart' ||
          type === 'table' ||
          type === 'quote' ||
          type === 'code' ||
          type === 'image'
      );
      if (typeof suggestion === 'string')
        add(
          'prefer-layout',
          'warning',
          `A ${suggestion} block may fit a catalog layout better.`,
          [...base, 'layout'],
          'Choose a matching catalog layout when its props fit the content.'
        );
    }
  });
  return report();
}

function walk(
  value: unknown,
  path: PathSegment[],
  visit: (record: Record<string, unknown>, path: PathSegment[]) => void,
  depth = 0
): void {
  if (depth > 12 || value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      walk(item, [...path, index], visit, depth + 1);
    });
    return;
  }
  const record = value as Record<string, unknown>;
  visit(record, path);
  for (const [key, child] of Object.entries(record)) walk(child, [...path, key], visit, depth + 1);
}

export const DECK_AUTHORING_LIMITS = Object.freeze({ slides: DECK_MODEL_LIMITS.slides });
export type { Deck };
