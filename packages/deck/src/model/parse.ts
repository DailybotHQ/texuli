/**
 * `parseDeck`: validate a v2 deck and collect every issue (model-v2 §3.4).
 *
 * 1. The structural pass (the schema kit): every field, limit and union.
 * 2. The cross-field passes, which run even when the structural pass failed
 *    (on a bounded plain copy of the input), so authors see all problems at
 *    once: unique slide, section and block ids, outline references, stacks,
 *    `navigation.start`, hidden slides, and the steps of every slide.
 * 3. The host phase: the optional `validateBlock`, `validateComponent` and
 *    `knownComponents` options check block bodies and component props, which
 *    this L0 package cannot know.
 *
 * Issues are capped (default 200, `truncated: true` past it). Never throws.
 */
import {
  createDiagnostic,
  type DeckDiagnostic,
  type DiagnosticExtra,
  MAX_DIAGNOSTICS,
  type PathSegment,
  toJsonPath,
  validate,
} from '../schema/index.ts';
import {
  DECK_MODEL_LIMITS,
  type Deck,
  deckSchema,
  forEachNested,
  type JsonObject,
  type SlideBlock,
  STEP_FIELD_KEYS,
} from './deck.ts';
import { layoutSteppablePaths } from './layouts/catalog.ts';
import { copyPlainData } from './plain.ts';
import { type SlideSteps, slideSteps } from './steps/slide-steps.ts';

/** A whole-slide component or an inline component item, as the host validator sees it. */
export interface DeckComponentInput {
  component: string;
  props: JsonObject;
}

/** What a host hook returns: issues with absolute paths (or nothing when valid). */
export type DeckHookResult = readonly DeckDiagnostic[] | undefined;

export interface ParseDeckOptions {
  /**
   * Validate one top-level block of a free slide (its step fields removed),
   * e.g. with `@texuli/blocks` `safeParseBlock`. `path` is absolute
   * (`['slides', 2, 'blocks', 0]`); return issues with absolute paths.
   */
  validateBlock?(block: SlideBlock, path: PathSegment[]): DeckHookResult;
  /** Validate a component's props with the host registry (inline items and component slides). */
  validateComponent?(component: DeckComponentInput, path: PathSegment[]): DeckHookResult;
  /** Component ids the host can paint; any other id is `unknown-component`. */
  knownComponents?: readonly string[];
  /** Issues kept before `truncated` (default 200). */
  maxIssues?: number;
}

export interface DeckParseResult {
  /** True when no error was found (warnings may remain in `issues`). */
  ok: boolean;
  /** The validated, trimmed copy; only when `ok`. */
  deck?: Deck;
  issues: DeckDiagnostic[];
  /** The steps of each slide, in order (computed on partial input too). */
  steps: SlideSteps[];
  /** More issues existed than `maxIssues`. */
  truncated: boolean;
}

type Bag = Record<string, unknown>;

function isBag(value: unknown): value is Bag {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** The issue list with its cap; errors are counted even past the cap. */
class Sink {
  readonly issues: DeckDiagnostic[] = [];
  errors = 0;
  truncated = false;
  readonly max: number;
  constructor(max: number) {
    this.max = max;
  }
  add(issue: DeckDiagnostic): void {
    if (issue.severity === 'error') this.errors++;
    if (this.issues.length >= this.max) {
      this.truncated = true;
      return;
    }
    this.issues.push(issue);
  }
  report(code: string, message: string, path: readonly PathSegment[], extra?: DiagnosticExtra) {
    this.add(createDiagnostic(code, message, path, extra));
  }
}

/**
 * A copy of a block without the deck's step fields (at every nesting level,
 * including chart `series` entries, which the chart block parser refuses
 * with step fields).
 */
export function stripStepFields<T>(block: T): T {
  if (!isBag(block)) return block;
  const out: Bag = {};
  for (const key of Object.keys(block)) {
    if ((STEP_FIELD_KEYS as readonly string[]).includes(key)) continue;
    out[key] = block[key];
  }
  for (const key of ['blocks', 'children', 'series'] as const) {
    if (Array.isArray(out[key])) out[key] = (out[key] as unknown[]).map(stripStepFields);
  }
  if (Array.isArray(out.columns)) {
    out.columns = (out.columns as unknown[]).map((column) =>
      Array.isArray(column) ? column.map(stripStepFields) : column
    );
  }
  if (Array.isArray(out.panels)) {
    out.panels = (out.panels as unknown[]).map((panel) =>
      isBag(panel) && Array.isArray(panel.blocks)
        ? { ...panel, blocks: panel.blocks.map(stripStepFields) }
        : panel
    );
  }
  return out as T;
}

function runHook(
  sink: Sink,
  code: 'block-props' | 'component-props',
  path: PathSegment[],
  call: () => DeckHookResult
): void {
  let result: DeckHookResult;
  try {
    result = call();
  } catch {
    sink.report(code, 'The host validator failed on this value.', path, {
      fix: 'Check the value against the host registry.',
    });
    return;
  }
  if (!Array.isArray(result)) return;
  for (const issue of result) {
    if (isBag(issue) && typeof issue.code === 'string' && typeof issue.message === 'string') {
      sink.add(issue as unknown as DeckDiagnostic);
    }
  }
}

function checkComponent(
  sink: Sink,
  options: ParseDeckOptions,
  value: Bag,
  path: PathSegment[]
): void {
  const id = value.component;
  if (typeof id !== 'string') return;
  if (options.knownComponents !== undefined && !options.knownComponents.includes(id)) {
    sink.report(
      'unknown-component',
      `The host has no component "${id.slice(0, 64)}".`,
      [...path, 'component'],
      {
        fix: 'Use a component id from the host catalog, or a block.',
      }
    );
    return;
  }
  if (options.validateComponent && isBag(value.props)) {
    const input: DeckComponentInput = { component: id, props: value.props as JsonObject };
    runHook(sink, 'component-props', path, () => options.validateComponent?.(input, [...path]));
  }
}

interface Pass {
  readonly sink: Sink;
  readonly options: ParseDeckOptions;
  readonly blockIds: Map<string, string>;
}

/** Block ids (deck-wide), nested component items and the host block hook. */
function walkItem(pass: Pass, item: unknown, path: PathSegment[], top: boolean, depth: number) {
  if (!isBag(item) || depth > 16) return;
  const id = item.id;
  if (typeof id === 'string') {
    const first = pass.blockIds.get(id);
    if (first !== undefined) {
      pass.sink.report(
        'duplicate-block-id',
        `The block id "${id}" is already used at ${first}.`,
        [...path, 'id'],
        { fix: 'Give every block a unique id (they key interactive state and deep links).' }
      );
    } else pass.blockIds.set(id, toJsonPath(path));
  }
  if (item.type === 'component') {
    checkComponent(pass.sink, pass.options, item, path);
    return;
  }
  if (top && typeof item.type === 'string' && pass.options.validateBlock) {
    const block = stripStepFields(item) as SlideBlock;
    runHook(pass.sink, 'block-props', path, () => pass.options.validateBlock?.(block, [...path]));
  }
  forEachNested(item, path, (child, childPath) => {
    walkItem(pass, child, childPath, false, depth + 1);
  });
}

function crossField(tree: unknown, options: ParseDeckOptions, sink: Sink): SlideSteps[] {
  const deck = isBag(tree) ? tree : {};
  const slides = Array.isArray(deck.slides)
    ? (deck.slides as unknown[]).slice(0, DECK_MODEL_LIMITS.slides)
    : [];

  // Slide ids
  const slideIndex = new Map<string, number>();
  const hidden = new Set<string>();
  let visible = 0;
  slides.forEach((slide, i) => {
    if (!isBag(slide)) return;
    if (slide.hidden !== true) visible++;
    const id = slide.id;
    if (typeof id !== 'string') return;
    const first = slideIndex.get(id);
    if (first !== undefined) {
      sink.report(
        'duplicate-id',
        `The slide id "${id}" is already used by slides[${first}].`,
        ['slides', i, 'id'],
        { fix: 'Give every slide a unique id.' }
      );
    } else {
      slideIndex.set(id, i);
      if (slide.hidden === true) hidden.add(id);
    }
  });
  if (slides.length > 0 && visible === 0) {
    sink.report('all-hidden', 'Every slide is hidden, so the deck presents nothing.', ['slides'], {
      fix: 'Show at least one slide (remove `hidden: true`).',
    });
  }

  // Navigation start
  const navigation = isBag(deck.navigation) ? deck.navigation : undefined;
  const start = navigation?.start;
  if (typeof start === 'string') {
    if (!slideIndex.has(start)) {
      sink.report('unknown-slide', `No slide has the id "${start}".`, ['navigation', 'start'], {
        fix: 'Use the id of a slide in `slides`.',
      });
    } else if (hidden.has(start)) {
      sink.report(
        'start-hidden',
        `The start slide "${start}" is hidden.`,
        ['navigation', 'start'],
        {
          fix: 'Start on a visible slide, or show this one.',
        }
      );
    }
  }

  // Outline
  const outline = isBag(deck.outline) ? deck.outline : undefined;
  const sections = Array.isArray(outline?.sections)
    ? (outline.sections as unknown[]).slice(0, DECK_MODEL_LIMITS.sections)
    : [];
  const sectionIds = new Map<string, number>();
  const owner = new Map<string, string>();
  sections.forEach((section, s) => {
    if (!isBag(section)) return;
    const base: PathSegment[] = ['outline', 'sections', s];
    const sectionId = typeof section.id === 'string' ? section.id : `#${s}`;
    if (typeof section.id === 'string') {
      const first = sectionIds.get(section.id);
      if (first !== undefined) {
        sink.report(
          'duplicate-id',
          `The section id "${section.id}" is already used by sections[${first}].`,
          [...base, 'id'],
          { fix: 'Give every section a unique id.' }
        );
      } else sectionIds.set(section.id, s);
    }
    const ids = Array.isArray(section.slideIds)
      ? (section.slideIds as unknown[]).slice(0, DECK_MODEL_LIMITS.sectionSlides)
      : [];
    const seen = new Set<string>();
    const indexes: number[] = [];
    ids.forEach((id, k) => {
      if (typeof id !== 'string') return;
      const path = [...base, 'slideIds', k];
      if (seen.has(id)) {
        sink.report('duplicate-id', `"${id}" is listed twice in this section.`, path, {
          fix: 'List each slide once.',
        });
        return;
      }
      seen.add(id);
      const index = slideIndex.get(id);
      if (index === undefined) {
        sink.report('unknown-slide', `No slide has the id "${id}".`, path, {
          fix: 'Use the id of a slide in `slides`, or remove it from the section.',
        });
        return;
      }
      indexes.push(index);
      const other = owner.get(id);
      if (other !== undefined) {
        sink.report(
          'section-overlap',
          `The slide "${id}" is already in section "${other}"; a slide belongs to one section.`,
          path,
          { fix: 'Remove the slide from one of the sections.' }
        );
      } else owner.set(id, sectionId);
    });
    if (section.stack === true && indexes.length > 1) {
      const lowest = Math.min(...indexes);
      const highest = Math.max(...indexes);
      if (highest - lowest + 1 !== indexes.length) {
        sink.report(
          'stack-not-contiguous',
          'A vertical stack lists slides that are not adjacent in `slides`.',
          [...base, 'slideIds'],
          { fix: 'Move the stacked slides next to each other, or drop `stack`.' }
        );
      }
    }
  });

  // Blocks, components and steps, per slide
  const pass: Pass = { sink, options, blockIds: new Map() };
  const steps: SlideSteps[] = [];
  slides.forEach((slide, i) => {
    const path: PathSegment[] = ['slides', i];
    if (isBag(slide)) {
      if (slide.layout === 'free' && Array.isArray(slide.blocks)) {
        (slide.blocks as unknown[]).slice(0, DECK_MODEL_LIMITS.freeBlocks).forEach((item, b) => {
          walkItem(pass, item, [...path, 'blocks', b], true, 0);
        });
      } else if (slide.layout === 'component' && isBag(slide.component)) {
        checkComponent(sink, options, slide.component, [...path, 'component']);
      }
    }
    const result = slideSteps(isBag(slide) ? slide : {}, {
      steppablePaths: isBag(slide) ? layoutSteppablePaths(slide.layout) : [],
      path,
    });
    for (const issue of result.issues) sink.add(issue);
    steps.push(result);
  });
  return steps;
}

/** Fill `slideId` on issues under `slides[n]` (for editors and agent feedback). */
function tagSlides(issues: DeckDiagnostic[], tree: unknown): void {
  const slides = isBag(tree) && Array.isArray(tree.slides) ? (tree.slides as unknown[]) : [];
  for (const issue of issues) {
    if (issue.slideId !== undefined || issue.path[0] !== 'slides') continue;
    const index = issue.path[1];
    if (typeof index !== 'number') continue;
    const slide = slides[index];
    if (isBag(slide) && typeof slide.id === 'string') issue.slideId = slide.id;
  }
}

/** Validate a v2 deck: every structural, cross-field and host issue. Never throws. */
export function parseDeck(input: unknown, options: ParseDeckOptions = {}): DeckParseResult {
  const max =
    options.maxIssues !== undefined && options.maxIssues > 0
      ? Math.floor(options.maxIssues)
      : MAX_DIAGNOSTICS;
  const sink = new Sink(max);
  const structural = validate(deckSchema, input, { maxIssues: max });
  for (const issue of structural.issues) sink.add(issue);
  if (structural.truncated) sink.truncated = true;
  if (!structural.ok) sink.errors = Math.max(sink.errors, 1);

  // Partial input still gets the cross-field passes, on a bounded plain copy.
  const tree = structural.ok
    ? structural.value
    : copyPlainData(input, { maxDepth: 64, maxBytes: 16 * 1024 * 1024, maxIssues: 0 }).value;
  let steps: SlideSteps[] = [];
  try {
    steps = crossField(tree, options, sink);
  } catch {
    sink.report('invalid-input', 'The deck could not be checked as plain data.', []);
  }
  tagSlides(sink.issues, tree);

  const ok = structural.ok && sink.errors === 0;
  const result: DeckParseResult = { ok, issues: sink.issues, steps, truncated: sink.truncated };
  if (ok) result.deck = structural.value as Deck;
  return result;
}
