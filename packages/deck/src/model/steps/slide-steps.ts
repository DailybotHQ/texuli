/**
 * Steps and fragments of one slide (model-v2 §3.7, ported from Protoyard's
 * `motion/steps.ts` and extended with v1's list `items` kind).
 *
 * A slide starts at step 0 (its initial state) and advances one step per
 * "next". Authors give fragments an authored step number (0 to
 * `MAX_AUTHORED_STEP`); the engine sorts the distinct non-zero numbers and
 * renumbers them 1, 2, 3…, so gaps ("step": 2 then 5) never cost an empty
 * click. A fragment at authored step 0 belongs to the initial state.
 *
 * Sources, in document order:
 * - a block or component item with `step` (nested blocks may step too);
 * - a `list` block with `step`: item *i* enters at `step + i`;
 * - a `code` block's `highlights` (or a props `{ source, highlights }` code
 *   object): highlight *i* at `step + i`, `step` defaulting to 0;
 * - props markers `{ step, fragment | reveal, tone }` anywhere in `props`
 *   (a marker off the layout's steppable paths still counts, with a
 *   `step-unrevealed` warning, as in Protoyard); a props object with
 *   `fragment` or `reveal` but no `step` reveals nothing and is reported as
 *   the warning `step-missing`;
 * - `slide.steps` labels, which name steps 1… and may extend the count.
 * A `custom` slide's props belong to its host component: labels only.
 *
 * The input is structural (plain objects, validated or not): anything that is
 * not a valid step, effect or tone is ignored rather than thrown on.
 */
import {
  createDiagnostic,
  type DeckDiagnostic,
  type PathSegment,
  toJsonPath,
} from '../../schema/index.ts';
import {
  BLOCK_REVEALS,
  type BlockReveal,
  FRAGMENT_EFFECTS,
  FRAGMENT_TONES,
  type FragmentEffect,
  type FragmentTone,
  MAX_AUTHORED_STEP,
  MAX_SLIDE_STEPS,
} from '../shared.ts';

/** The legacy block `reveal` vocabulary in fragment terms (`fade` is a plain `in`). */
export const REVEAL_EFFECT: Readonly<Record<BlockReveal, FragmentEffect>> = Object.freeze({
  fade: 'in',
  'fade-up': 'fade-up',
  grow: 'grow',
  highlight: 'highlight',
  strike: 'strike',
});

/** The step codes this pass reports (model-v2 §3.9 cross-field and lint groups). */
export const STEP_CODES = Object.freeze({
  fragmentConflict: 'fragment-conflict',
  tooManySteps: 'too-many-steps',
  stepUnrevealed: 'step-unrevealed',
  stepMissing: 'step-missing',
} as const);
export type StepCode = (typeof STEP_CODES)[keyof typeof STEP_CODES];
export type StepDiagnostic = DeckDiagnostic<StepCode>;

/** The step fields any block, component item or props marker may carry. */
export interface StepMarkerFields {
  step?: unknown;
  fragment?: unknown;
  reveal?: unknown;
  tone?: unknown;
}

/** A block-like item: a block, a component item or anything with a `type`. */
export interface StepSourceBlock extends StepMarkerFields {
  type?: unknown;
  id?: unknown;
  /** List items (`type: 'list'`): item *i* enters at `step + i`. */
  items?: unknown;
  /** Code highlights (`type: 'code'`): highlight *i* at `step + i`. */
  highlights?: unknown;
  /** Nested blocks. */
  blocks?: unknown;
  children?: unknown;
  /** `@texuli/blocks` containers: `columns` (arrays of blocks) and `tabs` panels. */
  columns?: unknown;
  panels?: unknown;
  [key: string]: unknown;
}

/** The minimal slide shape the steps pass reads. */
export interface StepSource {
  id?: unknown;
  /** `custom` slides step through their labels only. */
  layout?: unknown;
  /** Layout props: any JSON; step markers are found anywhere inside. */
  props?: unknown;
  /** Free-slide items (blocks and component items). */
  blocks?: readonly unknown[] | unknown;
  /** Step labels: `steps[i]` names step `i + 1`. */
  steps?: readonly unknown[] | unknown;
}

export interface SlideStepsOptions {
  /**
   * Where the slide's layout reveals a props marker, relative to `props`:
   * `''` is the props object, `cta` a nested object, `cards.*` each list
   * item. Supplied by the layout catalog; omit it to skip the
   * `step-unrevealed` check.
   */
  steppablePaths?: readonly string[];
  /** Prefix for diagnostic paths (`['slides', 3]`); fragment paths stay slide-relative. */
  path?: readonly PathSegment[];
}

export type FragmentKind = 'block' | 'item' | 'highlight' | 'prop';

export interface SlideFragment {
  kind: FragmentKind;
  /** Path relative to the slide (`['blocks', 0, 'items', 2]`, `['props', 'cards', 1]`). */
  path: PathSegment[];
  /** `toJsonPath(path)`: `$.blocks[0].items[2]`. */
  jsonPath: string;
  effect: FragmentEffect;
  tone?: FragmentTone;
  /** The dense step (0 = initial state, 1…count). */
  step: number;
  /** The authored step before renumbering. */
  authored: number;
  /** The id of the block the fragment belongs to, when it has one. */
  blockId?: string;
  /** The list item index (`item`). */
  item?: number;
  /** The highlighted line range (`highlight`), such as `'1-2'`. */
  lines?: string;
}

export interface SlideStep {
  /** `steps[i].index === i`; 0 is the initial state. */
  index: number;
  /** The author's label from `slide.steps[index - 1]`. */
  label?: string;
  fragments: SlideFragment[];
}

export interface SlideSteps {
  /** "Next" presses on this slide before the deck moves on (≤ `MAX_SLIDE_STEPS`). */
  count: number;
  /** The initial step: always 0. */
  initial: 0;
  /** `count + 1` entries: the initial state, then one per step. */
  steps: SlideStep[];
  issues: StepDiagnostic[];
}

interface Raw {
  kind: FragmentKind;
  path: PathSegment[];
  authored: number;
  effect: FragmentEffect;
  tone?: FragmentTone;
  blockId?: string;
  item?: number;
  lines?: string;
  /** Discovery order, so fragments of one step stay in document order. */
  order: number;
}

/** Nesting guards: well above the model's limits, low enough to stay cheap. */
const MAX_BLOCK_DEPTH = 32;
const MAX_PROP_DEPTH = 16;

type Bag = Record<string, unknown>;

function isRecord(value: unknown): value is Bag {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validStep(value: unknown): value is number {
  return (
    typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_AUTHORED_STEP
  );
}

function isEffect(value: unknown): value is FragmentEffect {
  return typeof value === 'string' && (FRAGMENT_EFFECTS as readonly string[]).includes(value);
}

function isReveal(value: unknown): value is BlockReveal {
  return typeof value === 'string' && (BLOCK_REVEALS as readonly string[]).includes(value);
}

function isTone(value: unknown): value is FragmentTone {
  return typeof value === 'string' && (FRAGMENT_TONES as readonly string[]).includes(value);
}

/** `['cards', 2]` → `cards.*`; the props object itself is `''`. */
export function steppablePattern(path: readonly PathSegment[]): string {
  return path.map((part) => (typeof part === 'number' ? '*' : part)).join('.');
}

class Collector {
  readonly raw: Raw[] = [];
  readonly issues: StepDiagnostic[] = [];
  readonly base: readonly PathSegment[];
  readonly slideId: string | undefined;
  constructor(base: readonly PathSegment[], slideId: string | undefined) {
    this.base = base;
    this.slideId = slideId;
  }

  issue(code: StepCode, message: string, path: readonly PathSegment[], fix: string, warn = false) {
    this.issues.push(
      createDiagnostic(code, message, [...this.base, ...path], {
        severity: warn ? 'warning' : 'error',
        fix,
        ...(this.slideId === undefined ? {} : { slideId: this.slideId }),
      })
    );
  }

  /** The effect and tone a marker asks for, reporting `fragment` + `reveal` together. */
  effectOf(fields: StepMarkerFields, path: readonly PathSegment[]): FragmentEffect {
    if (fields.fragment !== undefined && fields.reveal !== undefined) {
      this.issue(
        STEP_CODES.fragmentConflict,
        'A step marker sets both "fragment" and "reveal"; "fragment" wins.',
        [...path, 'reveal'],
        'Keep one: "fragment" (the v2 effects) or "reveal" (the legacy block effects).'
      );
    }
    if (isEffect(fields.fragment)) return fields.fragment;
    if (isReveal(fields.reveal)) return REVEAL_EFFECT[fields.reveal];
    return 'in';
  }

  push(entry: Omit<Raw, 'order'>): void {
    this.raw.push({ ...entry, order: this.raw.length });
  }
}

function toneOf(fields: StepMarkerFields): { tone?: FragmentTone } {
  return isTone(fields.tone) ? { tone: fields.tone } : {};
}

function fromBlocks(list: unknown, path: PathSegment[], depth: number, out: Collector): void {
  if (!Array.isArray(list) || depth > MAX_BLOCK_DEPTH) return;
  list.forEach((value, i) => {
    if (isRecord(value)) fromBlock(value as StepSourceBlock, [...path, i], depth, out);
  });
}

function fromBlock(block: StepSourceBlock, path: PathSegment[], depth: number, out: Collector) {
  const blockId = typeof block.id === 'string' ? { blockId: block.id } : {};
  const tone = toneOf(block);
  const stepped = validStep(block.step);
  const effect = out.effectOf(block, path);
  const base = stepped ? (block.step as number) : 0;

  if (stepped) out.push({ kind: 'block', path, authored: base, effect, ...tone, ...blockId });

  if (block.type === 'list' && stepped && Array.isArray(block.items)) {
    block.items.forEach((_, i) => {
      out.push({
        kind: 'item',
        path: [...path, 'items', i],
        authored: base + i,
        effect,
        ...tone,
        ...blockId,
        item: i,
      });
    });
  }

  if (block.type === 'code') fromHighlights(block.highlights, base, path, tone, blockId, out);

  // Nested blocks may step (Protoyard); a component item's props are its own.
  if (block.type === 'component') return;
  fromBlocks(block.blocks, [...path, 'blocks'], depth + 1, out);
  fromBlocks(block.children, [...path, 'children'], depth + 1, out);
  if (Array.isArray(block.columns)) {
    block.columns.forEach((column, c) => {
      fromBlocks(column, [...path, 'columns', c], depth + 1, out);
    });
  }
  if (Array.isArray(block.panels)) {
    block.panels.forEach((panel, p) => {
      if (isRecord(panel))
        fromBlocks(panel.blocks, [...path, 'panels', p, 'blocks'], depth + 1, out);
    });
  }
}

function fromHighlights(
  highlights: unknown,
  base: number,
  path: PathSegment[],
  tone: { tone?: FragmentTone },
  blockId: { blockId?: string },
  out: Collector
): void {
  if (!Array.isArray(highlights)) return;
  highlights.forEach((lines, i) => {
    if (typeof lines !== 'string') return;
    out.push({
      kind: 'highlight',
      path: [...path, 'highlights', i],
      authored: base + i,
      effect: 'highlight',
      ...tone,
      ...blockId,
      lines,
    });
  });
}

interface PropsWalk {
  steppable: ReadonlySet<string> | null;
  out: Collector;
}

function fromProps(value: unknown, path: PathSegment[], depth: number, walk: PropsWalk): void {
  if (depth > MAX_PROP_DEPTH || value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, i) => {
      fromProps(item, [...path, i], depth + 1, walk);
    });
    return;
  }
  const record = value as Bag & StepMarkerFields;
  const stepped = validStep(record.step);
  const base = stepped ? (record.step as number) : 0;
  // A props code object (`{ source, highlights }`, as in code-with-callout).
  if (typeof record.source === 'string' && Array.isArray(record.highlights)) {
    fromHighlights(record.highlights, base, path, toneOf(record), {}, walk.out);
  }
  if (record.step === undefined && (record.fragment !== undefined || record.reveal !== undefined)) {
    const field = record.fragment !== undefined ? 'fragment' : 'reveal';
    walk.out.issue(
      STEP_CODES.stepMissing,
      `This marker sets "${field}" but no "step", so it is ignored and never reveals.`,
      path,
      `Add "step": 1 (or the step it should enter on), or remove "${field}".`,
      true
    );
  }
  if (stepped) {
    const effect = walk.out.effectOf(record, path);
    walk.out.push({ kind: 'prop', path, authored: base, effect, ...toneOf(record) });
    const relative = path.slice(1);
    if (walk.steppable && !walk.steppable.has(steppablePattern(relative))) {
      const allowed = [...walk.steppable].map((p) => (p === '' ? '(props)' : p)).join(', ');
      walk.out.issue(
        STEP_CODES.stepUnrevealed,
        'This step marker counts as a step, but the layout reveals nothing at this path.',
        path,
        allowed
          ? `Move the marker to a steppable path: ${allowed}.`
          : 'This layout has no steppable props; remove the marker.',
        true
      );
    }
  }
  for (const key of Object.keys(record)) {
    if (key === 'step' || key === 'fragment' || key === 'reveal' || key === 'tone') continue;
    fromProps(record[key], [...path, key], depth + 1, walk);
  }
}

/** Derives the ordered, densely numbered steps of a slide. Never throws. */
export function slideSteps(slide: StepSource, options: SlideStepsOptions = {}): SlideSteps {
  const slideId = typeof slide?.id === 'string' ? slide.id : undefined;
  const out = new Collector(options.path ?? [], slideId);
  if (isRecord(slide)) {
    if (Array.isArray(slide.blocks)) fromBlocks(slide.blocks, ['blocks'], 0, out);
    if (slide.layout !== 'custom' && slide.props !== undefined) {
      const steppable = options.steppablePaths ? new Set(options.steppablePaths) : null;
      fromProps(slide.props, ['props'], 0, { steppable, out });
    }
  }

  const ordered = [...out.raw].sort((a, b) => a.authored - b.authored || a.order - b.order);
  const distinct = [...new Set(ordered.map((r) => r.authored).filter((n) => n > 0))];
  if (distinct.length > MAX_SLIDE_STEPS) {
    const first = ordered.find((r) => r.authored === distinct[MAX_SLIDE_STEPS]);
    out.issue(
      STEP_CODES.tooManySteps,
      `The slide has ${distinct.length} distinct steps; at most ${MAX_SLIDE_STEPS} are allowed (the rest play on step ${MAX_SLIDE_STEPS}).`,
      first ? first.path : [],
      'Group fragments onto shared steps, or split the slide.'
    );
  }
  const dense = new Map(distinct.map((n, i) => [n, Math.min(i + 1, MAX_SLIDE_STEPS)]));

  const labels = Array.isArray(slide?.steps) ? (slide.steps as readonly unknown[]) : [];
  const count = Math.min(
    MAX_SLIDE_STEPS,
    Math.max(Math.min(distinct.length, MAX_SLIDE_STEPS), labels.length)
  );
  const steps: SlideStep[] = Array.from({ length: count + 1 }, (_, index) => {
    const label = index > 0 ? labels[index - 1] : undefined;
    return { index, ...(typeof label === 'string' ? { label } : {}), fragments: [] };
  });
  for (const r of ordered) {
    const step = r.authored === 0 ? 0 : (dense.get(r.authored) as number);
    const fragment: SlideFragment = {
      kind: r.kind,
      path: r.path,
      jsonPath: toJsonPath(r.path),
      effect: r.effect,
      step,
      authored: r.authored,
    };
    if (r.tone !== undefined) fragment.tone = r.tone;
    if (r.blockId !== undefined) fragment.blockId = r.blockId;
    if (r.item !== undefined) fragment.item = r.item;
    if (r.lines !== undefined) fragment.lines = r.lines;
    (steps[step] as SlideStep).fragments.push(fragment);
  }
  return { count, initial: 0, steps, issues: out.issues };
}

/** How many "next" presses a slide takes before the deck moves on. */
export function slideStepCount(slide: StepSource, options: SlideStepsOptions = {}): number {
  return slideSteps(slide, options).count;
}

/** Every fragment of a slide, initial state first, in step order. */
export function slideFragments(steps: Pick<SlideSteps, 'steps'>): SlideFragment[] {
  return steps.steps.flatMap((step) => step.fragments);
}
