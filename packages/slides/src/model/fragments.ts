import type { Block, BlockReveal } from '@texuli/blocks/core';
import { walkBlocks } from '@texuli/blocks/core';

/**
 * Reveal steps (fragments) on a slide. Steps come from the closed fields
 * every block already carries: `step` (an integer from 0 to 32) and `reveal`
 * (a `BLOCK_REVEALS` token). A slide starts at step 0 and advances one step
 * at a time up to its {@link slideStepCount}. Only top-level blocks reveal;
 * `parseDeck` refuses `step` and `reveal` on nested blocks.
 */
export const DECK_FRAGMENT_KINDS = ['enter', 'items', 'highlights', 'emphasis'] as const;
export type DeckFragmentKind = (typeof DECK_FRAGMENT_KINDS)[number];

/** Reveal tokens that animate a block in; the others emphasize it in place. */
export const DECK_ENTRANCE_REVEALS = ['fade', 'fade-up', 'grow'] as const;
export type DeckEntranceReveal = (typeof DECK_ENTRANCE_REVEALS)[number];

/** Highest step a slide may reach, matching the block `step` bound. */
export const DECK_MAX_SLIDE_STEPS = 32;

/**
 * How one top-level block takes part in its slide's steps:
 *
 * - `enter`: hidden until `step`, then shown;
 * - `items`: a list with a `step`; item `i` appears at step `step + i`;
 * - `highlights`: a code block with `highlights`; it is always shown and step
 *   `step + i` shows `highlights[i]` (the block family's `hostStep`);
 * - `emphasis`: a `highlight` or `strike` reveal; always shown, emphasized
 *   from `step` on.
 */
export interface DeckFragment {
  kind: DeckFragmentKind;
  /** First step the fragment acts on. */
  step: number;
  /** Last step it acts on: `step`, or later for items and highlights. */
  lastStep: number;
  reveal?: BlockReveal;
}

export function isEntranceReveal(value: unknown): value is DeckEntranceReveal {
  return (DECK_ENTRANCE_REVEALS as readonly unknown[]).includes(value);
}

/** The fragment a top-level block declares, or `null` when it is static. */
export function blockFragment(block: Block): DeckFragment | null {
  const step = block.step;
  const reveal = block.reveal;
  const withReveal = reveal === undefined ? {} : { reveal };
  if (reveal === 'highlight' || reveal === 'strike') {
    const at = step ?? 0;
    return { kind: 'emphasis', step: at, lastStep: at, reveal };
  }
  if (block.type === 'code' && block.highlights && block.highlights.length > 0) {
    const at = step ?? 0;
    return {
      kind: 'highlights',
      step: at,
      lastStep: at + block.highlights.length - 1,
      ...withReveal,
    };
  }
  if (step === undefined) return null;
  if (block.type === 'list') {
    return {
      kind: 'items',
      step,
      lastStep: step + Math.max(0, block.items.length - 1),
      ...withReveal,
    };
  }
  if (step === 0) return null;
  return { kind: 'enter', step, lastStep: step, ...withReveal };
}

/** The last step of a slide: 0 when nothing on it reveals. */
export function slideStepCount(slide: { blocks: readonly Block[] }): number {
  let count = 0;
  for (const block of slide.blocks) {
    const fragment = blockFragment(block);
    if (fragment && fragment.lastStep > count) count = fragment.lastStep;
  }
  return count;
}

/** What a fragment shows at one step. */
export interface DeckFragmentView {
  /** Hidden blocks keep their space and leave the accessibility tree. */
  hidden: boolean;
  /** List items shown (`items` only). */
  visibleItems?: number;
  /** The step's code highlight (`highlights` only). */
  hostStep?: number;
  /** Emphasis is on (`emphasis` only). */
  emphasized?: boolean;
  /** This step is the one that revealed it (or its newest item). */
  current: boolean;
}

/** Resolve a fragment at `step`; a `null` fragment is always shown. */
export function fragmentView(fragment: DeckFragment | null, step: number): DeckFragmentView {
  if (!fragment) return { hidden: false, current: false };
  switch (fragment.kind) {
    case 'enter':
      return { hidden: step < fragment.step, current: step === fragment.step };
    case 'items': {
      const total = fragment.lastStep - fragment.step + 1;
      const visibleItems = Math.max(0, Math.min(total, step - fragment.step + 1));
      return {
        hidden: visibleItems === 0,
        visibleItems,
        current: step >= fragment.step && step <= fragment.lastStep,
      };
    }
    case 'highlights':
      return {
        hidden: false,
        hostStep: step,
        current: step > fragment.step && step <= fragment.lastStep,
      };
    case 'emphasis':
      return {
        hidden: false,
        emphasized: step >= fragment.step,
        current: fragment.step > 0 && step === fragment.step,
      };
  }
}

/** A reveal-step problem `parseDeck` reports, relative to a slide's blocks. */
export interface DeckFragmentIssue {
  /** Dotted path below the slide's `blocks`, such as `0.columns.1.0.step`. */
  path: string;
  message: string;
}

/**
 * Deck rules for reveal steps the block schema cannot see: steps and reveals
 * apply to top-level blocks only, and a slide reaches at most
 * {@link DECK_MAX_SLIDE_STEPS} steps.
 */
export function checkSlideFragments(blocks: readonly Block[]): DeckFragmentIssue | null {
  for (const { block, path } of walkBlocks(blocks)) {
    if (path.length === 1) continue;
    const field = block.step !== undefined ? 'step' : block.reveal !== undefined ? 'reveal' : null;
    if (field) {
      return {
        path: `${path.join('.')}.${field}`,
        message: 'Reveal steps apply only to top-level slide blocks.',
      };
    }
  }
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    const fragment = block ? blockFragment(block) : null;
    if (fragment && fragment.lastStep > DECK_MAX_SLIDE_STEPS) {
      return {
        path: `${index}.step`,
        message: `A slide reaches at most ${DECK_MAX_SLIDE_STEPS} reveal steps; this block ends at step ${fragment.lastStep}.`,
      };
    }
  }
  return null;
}
