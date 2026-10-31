/**
 * `migrateDeck`: convert an earlier deck to model v2 (model-v2 §3.10). The
 * input shape is detected, not read from a version number:
 *
 * - **v2** (`formatVersion` present): returned unchanged.
 * - **Texuli v1** (`meta` + `slides[].blocks`, optional `masters` and
 *   `settings`): every slide becomes a lossless free slide with its master;
 *   `settings` moves to `style` and `navigation`, `startIndex` to a start id.
 * - **Texuli grammar tree** (`layout-deck` with `deck-slide` or legacy
 *   `layout-card` children, or a `slides[]` grammar): block nodes become
 *   blocks, `charts-*` nodes chart blocks, other catalog nodes component items.
 * - **Protoyard** (`style` + `slides` with `layout`, no `meta`): a title is
 *   derived, `paletteSeed` becomes a seed theme, ChartSpec becomes a chart
 *   block body, unknown background slugs become `solid-color`.
 *
 * The result is not validated (run `parseDeck`); every conversion that is a
 * judgement call is reported as a `migrated` warning. Idempotent, pure, and
 * it never throws. Lifting a master to a catalog layout is a lint
 * suggestion, never done here.
 */
import { createDiagnostic, type DeckDiagnostic, type PathSegment } from '../schema/index.ts';
import { isDeckBackgroundPreset } from './backgrounds/schema.ts';
import { DECK_MODEL_LIMITS } from './deck.ts';
import { MEDIA_SRC_PATTERN } from './shared.ts';
import { slideSteps } from './steps/slide-steps.ts';

export const DECK_SOURCES = ['v2', 'texuli-v1', 'texuli-grammar', 'protoyard', 'unknown'] as const;
export type DeckSource = (typeof DECK_SOURCES)[number];

export interface DeckMigration {
  /** The v2 document (unvalidated: pass it to `parseDeck`); the input itself for `v2` and `unknown`. */
  deck: unknown;
  from: DeckSource;
  /** `migrated` warnings, plus `invalid-deck` when the shape is unknown. */
  issues: DeckDiagnostic[];
}

type Bag = Record<string, unknown>;

function isBag(value: unknown): value is Bag {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

const MEDIA_SRC = new RegExp(MEDIA_SRC_PATTERN, 'u');
/** The chart kinds with inline `series`/`cells`/`points` in the Texuli chart block. */
const INLINE_CHART_KINDS = [
  'line',
  'area',
  'bar',
  'stacked-bar',
  'combo',
  'heatmap',
  'scatter',
  'bubble',
] as const;
const GRAMMAR_ROOT = 'layout-deck';
const GRAMMAR_SLIDE = 'deck-slide';
const GRAMMAR_CARD = 'layout-card';
const DEFAULT_TITLE = 'Untitled deck';

/** Which earlier shape `input` has (see the module comment). */
export function detectDeckShape(input: unknown): DeckSource {
  if (!isBag(input)) return 'unknown';
  if (Object.hasOwn(input, 'formatVersion')) return 'v2';
  if (input.id === GRAMMAR_ROOT) return 'texuli-grammar';
  if (!Array.isArray(input.slides)) return 'unknown';
  if (isBag(input.meta)) return 'texuli-v1';
  const slides = input.slides as unknown[];
  if (
    isBag(input.style) ||
    slides.some((slide) => isBag(slide) && typeof slide.layout === 'string')
  ) {
    return 'protoyard';
  }
  return 'unknown';
}

class Notes {
  readonly issues: DeckDiagnostic[] = [];
  warn(message: string, path: readonly PathSegment[] = [], fix?: string): void {
    if (this.issues.length >= 200) return;
    this.issues.push(
      createDiagnostic('migrated', message, path, {
        severity: 'warning',
        ...(fix === undefined ? {} : { fix }),
      })
    );
  }
}

function clip(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  const points = Array.from(trimmed);
  return points.length > max ? points.slice(0, max).join('') : trimmed;
}

function assign(target: Bag, key: string, value: unknown): void {
  if (value !== undefined) target[key] = value;
}

// ---------------------------------------------------------------------------
// Texuli v1

/**
 * A catalog theme without a mode becomes the string shorthand, so every
 * authoring form (JSON, Markdown `theme:`) round-trips it unchanged.
 */
function shorthandTheme(theme: unknown): unknown {
  if (theme === null || typeof theme !== 'object' || Array.isArray(theme)) return theme;
  const ref = theme as Record<string, unknown>;
  const keys = Object.keys(ref);
  if (
    ref.kind === 'catalog' &&
    typeof ref.id === 'string' &&
    keys.every((key) => key === 'kind' || key === 'id')
  ) {
    return ref.id;
  }
  return theme;
}

const V1_SLIDE_KEYS = ['id', 'title', 'notes', 'master', 'themeRef', 'transition', 'blocks'];

function fromTexuliV1(input: Bag, notes: Notes): Bag {
  const meta = isBag(input.meta) ? input.meta : {};
  const settings = isBag(input.settings) ? input.settings : {};
  const slidesIn = Array.isArray(input.slides) ? (input.slides as unknown[]) : [];

  const outMeta: Bag = {};
  assign(outMeta, 'title', meta.title);
  assign(outMeta, 'description', meta.description);
  assign(outMeta, 'locale', meta.locale);

  const style: Bag = {};
  assign(style, 'aspect', meta.aspect);
  assign(style, 'theme', shorthandTheme(meta.themeRef));
  if (settings.showProgress === false) style.progress = 'none';
  if (settings.defaultTransition !== undefined && settings.defaultTransition !== 'fade') {
    style.transition = settings.defaultTransition;
  }

  const navigation: Bag = {};
  const startIndex = settings.startIndex;
  if (typeof startIndex === 'number' && Number.isInteger(startIndex) && startIndex > 0) {
    const target = slidesIn[startIndex];
    if (isBag(target) && typeof target.id === 'string') navigation.start = target.id;
    else
      notes.warn(
        `settings.startIndex ${startIndex} names no slide; the deck starts at the first.`,
        ['navigation']
      );
  }
  if (settings.loop === true) navigation.loop = true;

  const slides = slidesIn.map((slide, i) => {
    if (!isBag(slide)) return slide;
    const path: PathSegment[] = ['slides', i];
    const out: Bag = {};
    assign(out, 'id', slide.id);
    assign(out, 'title', slide.title);
    assign(out, 'notes', slide.notes);
    assign(out, 'theme', shorthandTheme(slide.themeRef));
    assign(out, 'transition', slide.transition);
    out.layout = 'free';
    assign(out, 'master', slide.master);
    // An empty v1 slide stays empty: v2 free slides may have no blocks, and
    // the stage already shows the slide title.
    const blocks = Array.isArray(slide.blocks) ? (slide.blocks as unknown[]) : [];
    out.blocks = blocks;
    const dropped = Object.keys(slide).filter((key) => !V1_SLIDE_KEYS.includes(key));
    if (dropped.length > 0) {
      notes.warn(`Dropped keys v1 ignored: ${dropped.slice(0, 8).join(', ')}.`, path);
    }
    const steps = slideSteps(out);
    const renumbered = steps.steps.some((step) =>
      step.fragments.some((fragment) => fragment.authored > 0 && fragment.authored !== step.index)
    );
    if (renumbered) {
      notes.warn(
        'Steps are renumbered densely in v2: gaps between authored steps no longer cost an empty click.',
        path
      );
    }
    return out;
  });

  const out: Bag = { formatVersion: 2, meta: outMeta };
  if (Object.keys(style).length > 0) out.style = style;
  if (Object.keys(navigation).length > 0) out.navigation = navigation;
  out.slides = slides;
  if (Array.isArray(input.masters) && input.masters.length > 0) {
    notes.warn('The `masters` declaration is dropped; each free slide keeps its own `master`.', [
      'slides',
    ]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Texuli grammar trees

function chartFromNode(id: string, props: Bag): Bag {
  const kind = id === 'charts-cartesian' ? props.kind : id.slice('charts-'.length);
  const titleKey = props.title === undefined ? 'label' : 'title';
  const { [titleKey]: title, description, kind: _kind, ...rest } = props;
  const block: Bag = { type: 'chart', kind, title, description };
  if ((INLINE_CHART_KINDS as readonly unknown[]).includes(kind)) {
    for (const key of ['series', 'cells', 'points']) assign(block, key, props[key]);
  } else block.props = rest;
  return block;
}

function itemFromNode(node: unknown, path: PathSegment[], notes: Notes): unknown {
  if (!isBag(node)) return node;
  const id = typeof node.id === 'string' ? node.id : '';
  const props = isBag(node.props) ? node.props : {};
  if (Object.hasOwn(props, 'block')) return props.block;
  if (id.startsWith('charts-')) return chartFromNode(id, props);
  notes.warn(`The catalog node "${id.slice(0, 64)}" became a component item.`, path);
  return { type: 'component', component: id, props };
}

function slideFromGrammar(
  props: Bag,
  children: unknown,
  id: unknown,
  path: PathSegment[],
  notes: Notes
): Bag {
  const out: Bag = {};
  assign(out, 'id', id);
  assign(out, 'title', props.title);
  assign(out, 'notes', props.notes);
  assign(out, 'master', props.master);
  assign(out, 'themeRef', props.themeRef);
  assign(out, 'transition', props.transition);
  const nodes = Array.isArray(children) ? (children as unknown[]) : [];
  out.blocks = nodes.map((node, b) => itemFromNode(node, [...path, 'blocks', b], notes));
  return out;
}

function fromGrammar(input: Bag, notes: Notes): Bag {
  const props = isBag(input.props) ? input.props : {};
  const slides: unknown[] = [];
  if (Array.isArray(props.slides)) {
    (props.slides as unknown[]).forEach((slide, i) => {
      const value = isBag(slide) ? slide : {};
      slides.push(slideFromGrammar(value, value.children, value.id, ['slides', i], notes));
    });
  } else if (Array.isArray(input.children)) {
    (input.children as unknown[]).forEach((node, i) => {
      const value = isBag(node) ? node : {};
      const nodeProps = isBag(value.props) ? value.props : {};
      const path: PathSegment[] = ['slides', i];
      if (value.id === GRAMMAR_CARD) {
        const card = slideFromGrammar(
          { title: nodeProps.title },
          value.children,
          `slide-${i + 1}`,
          path,
          notes
        );
        slides.push(card);
      } else {
        if (value.id !== GRAMMAR_SLIDE) {
          notes.warn(`Expected a ${GRAMMAR_SLIDE} node; read it as one.`, path);
        }
        slides.push(slideFromGrammar(nodeProps, value.children, nodeProps.slideId, path, notes));
      }
    });
  }
  const v1: Bag = {
    meta: {
      title: props.title,
      ...(props.description === undefined ? {} : { description: props.description }),
      ...(props.locale === undefined ? {} : { locale: props.locale }),
      ...(props.aspect === undefined ? {} : { aspect: props.aspect }),
      ...(props.themeRef === undefined ? {} : { themeRef: props.themeRef }),
    },
    slides,
  };
  assign(v1, 'masters', props.masters);
  assign(v1, 'settings', props.settings);
  return fromTexuliV1(v1, notes);
}

// ---------------------------------------------------------------------------
// Protoyard

const PART_WHOLE = ['pie', 'donut'];
const STEP_KEYS = ['step', 'fragment', 'reveal', 'tone'] as const;

/** Protoyard's ChartSpec (`kind`, `labels`, `series[{label, values}]`) as a chart block body. */
function chartBody(spec: Bag, path: PathSegment[], notes: Notes): Bag {
  const labels = Array.isArray(spec.labels) ? (spec.labels as unknown[]) : [];
  const series = Array.isArray(spec.series) ? (spec.series as unknown[]) : [];
  const out: Bag = { kind: spec.kind, title: spec.title };
  if (typeof spec.description === 'string' && spec.description.trim() !== '') {
    out.description = spec.description;
  } else {
    out.description = spec.title;
    notes.warn('The chart had no description; its title is used (write a real one).', [
      ...path,
      'description',
    ]);
  }
  const values = (entry: unknown): unknown[] =>
    isBag(entry) && Array.isArray(entry.values) ? (entry.values as unknown[]) : [];
  /** A series entry's step marker (`step`, `fragment`, `reveal`, `tone`), kept as authored. */
  const marker = (entry: unknown): Bag => {
    const out: Bag = {};
    if (isBag(entry)) for (const key of STEP_KEYS) assign(out, key, entry[key]);
    return out;
  };
  if (PART_WHOLE.includes(spec.kind as string) || spec.kind === 'funnel') {
    const first = values(series[0]);
    const data = labels.map((label, j) => ({
      id: `item-${j + 1}`,
      label,
      value: typeof first[j] === 'number' ? first[j] : 0,
    }));
    out.props = spec.kind === 'funnel' ? { steps: data } : { data };
    // One data list: a marker on the first series moves to the chart itself.
    const firstMarker = marker(series[0]);
    if (Object.keys(firstMarker).length > 0) {
      if (spec.step === undefined) Object.assign(out, firstMarker);
      else
        notes.warn('The first series step marker was dropped; the chart has its own.', [
          ...path,
          'series',
          0,
        ]);
    }
  } else {
    out.series = series.map((entry, s) => ({
      id: `series-${s + 1}`,
      label: isBag(entry) ? entry.label : undefined,
      points: labels.map((x, j) => {
        const y = values(entry)[j];
        return { x, y: typeof y === 'number' ? y : null };
      }),
      ...marker(entry),
    }));
  }
  if ((spec.unit !== undefined && spec.unit !== 'number') || spec.currency !== undefined) {
    notes.warn('The chart `unit`/`currency` was dropped; set a chart format in props.', path);
  }
  for (const key of STEP_KEYS) assign(out, key, spec[key]);
  notes.warn('The Protoyard ChartSpec became a Texuli chart block body.', path);
  return out;
}

function isChartSpec(value: unknown): value is Bag {
  return (
    isBag(value) &&
    Array.isArray(value.labels) &&
    Array.isArray(value.series) &&
    (value.series as unknown[]).every((entry) => isBag(entry) && Array.isArray(entry.values))
  );
}

function background(value: unknown, path: PathSegment[], notes: Notes): unknown {
  if (typeof value !== 'string' || isDeckBackgroundPreset(value)) return value;
  notes.warn(
    `Unknown background "${value.slice(0, 64)}" became "solid-color".`,
    path,
    'Pick one of the 13 background presets or a spec.'
  );
  return 'solid-color';
}

function deriveTitle(input: Bag, slides: unknown[]): { title: string; derived: string } {
  const outline = isBag(input.outline) ? input.outline : {};
  const fromOutline = clip(outline.title, DECK_MODEL_LIMITS.titleLength);
  if (fromOutline) return { title: fromOutline, derived: 'outline.title' };
  for (const slide of slides) {
    if (isBag(slide) && slide.layout === 'title-hero' && isBag(slide.props)) {
      const title = clip(slide.props.title, DECK_MODEL_LIMITS.titleLength);
      if (title) return { title, derived: 'the title-hero slide' };
    }
  }
  for (const slide of slides) {
    const title = isBag(slide) ? clip(slide.title, DECK_MODEL_LIMITS.titleLength) : undefined;
    if (title) return { title, derived: 'the first slide title' };
  }
  return { title: DEFAULT_TITLE, derived: 'a placeholder' };
}

function fromProtoyard(input: Bag, notes: Notes): Bag {
  const slidesIn = Array.isArray(input.slides) ? (input.slides as unknown[]) : [];
  const { title, derived } = deriveTitle(input, slidesIn);
  notes.warn(`meta.title was derived from ${derived}.`, ['meta', 'title']);

  const styleIn = isBag(input.style) ? input.style : {};
  const style: Bag = {};
  for (const [key, value] of Object.entries(styleIn)) {
    if (key === 'paletteSeed') continue;
    if (key === 'background') style.background = background(value, ['style', 'background'], notes);
    else if (key === 'logo') {
      if (typeof value === 'string' && value.length <= 512 && MEDIA_SRC.test(value))
        style.logo = value;
      else
        notes.warn('The logo is not a supported media source and was dropped.', ['style', 'logo']);
    } else style[key] = value;
  }
  if (styleIn.paletteSeed !== undefined) {
    if (style.theme === undefined) style.theme = { kind: 'seed', seed: styleIn.paletteSeed };
    else notes.warn('`paletteSeed` was dropped: the named theme wins.', ['style', 'theme']);
  }

  const slides = slidesIn.map((slide, i) => {
    if (!isBag(slide)) return slide;
    const path: PathSegment[] = ['slides', i];
    const out: Bag = { ...slide };
    if (slide.background !== undefined) {
      out.background = background(slide.background, [...path, 'background'], notes);
    }
    if (slide.layout === 'chart' && isBag(slide.props) && isChartSpec(slide.props.spec)) {
      out.props = {
        ...slide.props,
        spec: chartBody(slide.props.spec, [...path, 'props', 'spec'], notes),
      };
    }
    return out;
  });

  const out: Bag = { formatVersion: 2, meta: { title } };
  if (Object.keys(style).length > 0) out.style = style;
  for (const [key, value] of Object.entries(input)) {
    if (key !== 'style' && key !== 'slides') out[key] = value;
  }
  out.slides = slides;
  return out;
}

// ---------------------------------------------------------------------------

const LABELS: Readonly<Record<DeckSource, string>> = Object.freeze({
  v2: 'a v2 deck',
  'texuli-v1': 'a Texuli v1 deck',
  'texuli-grammar': 'a Texuli grammar tree',
  protoyard: 'a Protoyard deck',
  unknown: 'an unknown shape',
});

/** Convert `input` to model v2; see the module comment. Never throws. */
export function migrateDeck(input: unknown): DeckMigration {
  const notes = new Notes();
  let from: DeckSource = 'unknown';
  try {
    from = detectDeckShape(input);
    if (from === 'v2') return { deck: input, from, issues: [] };
    if (from === 'unknown') {
      return {
        deck: input,
        from,
        issues: [
          createDiagnostic(
            'invalid-deck',
            'Not a recognized deck: expected a v2 deck, a Texuli v1 deck, a layout-deck tree or a Protoyard deck.',
            [],
            { fix: 'Start from {"formatVersion": 2, "meta": {"title": "…"}, "slides": […]}.' }
          ),
        ],
      };
    }
    const source = input as Bag;
    const deck =
      from === 'texuli-v1'
        ? fromTexuliV1(source, notes)
        : from === 'texuli-grammar'
          ? fromGrammar(source, notes)
          : fromProtoyard(source, notes);
    // A design system (ADR-024) set on an earlier shape carries over as is;
    // parseDeck checks it.
    if (source.designSystem !== undefined) (deck as Bag).designSystem = source.designSystem;
    notes.issues.unshift(
      createDiagnostic('migrated', `Converted from ${LABELS[from]} to model v2.`, [], {
        severity: 'warning',
        fix: 'Save the converted deck so it loads without migration.',
      })
    );
    return { deck, from, issues: notes.issues };
  } catch {
    return {
      deck: input,
      from,
      issues: [
        createDiagnostic('invalid-input', 'The deck could not be read as plain data.', [], {
          fix: 'Pass JSON data (loadUntrustedDeck makes a safe copy).',
        }),
      ],
    };
  }
}
