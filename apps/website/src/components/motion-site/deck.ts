/**
 * The deck of the /motion-page/ deck demo: one slide per slide transition
 * (`DECK_TRANSITIONS` from `@texuli/deck/model`) and three card slides that
 * reveal one card per step with every fragment effect (`FRAGMENT_EFFECTS`),
 * under a deck-wide motion level (`style.motion`: full, subtle, none).
 * Also the resolved transition table for every transition, level and the
 * reduced-motion preference (`resolveSlideTransition`), computed from the
 * package so the page cannot drift from it. Fictional copy only. Checked
 * by apps/website/tests/site-motion.test.ts.
 */
import {
  DECK_TRANSITIONS,
  type DeckTransition,
  FRAGMENT_EFFECTS,
  type FragmentEffect,
  MOTION_LEVELS,
  resolveSlideTransition,
} from '@texuli/deck/model';

export type DeckMotionLevel = (typeof MOTION_LEVELS)[number];

const TRANSITION_NOTES: Readonly<Record<DeckTransition, string>> = {
  none: 'A cut: the next slide is there at once.',
  fade: 'The default: a cross-fade.',
  'fade-up': 'Fades in while rising a little.',
  slide: 'Slides in from the reading direction.',
  zoom: 'Scales in; subtle motion plays it as a fade.',
  morph: 'Matching elements travel between slides.',
};

/** Fragment effects, three per card slide. */
function fragmentSlides(): Record<string, unknown>[] {
  const groups: FragmentEffect[][] = [];
  for (let index = 0; index < FRAGMENT_EFFECTS.length; index += 3) {
    groups.push(FRAGMENT_EFFECTS.slice(index, index + 3));
  }
  return groups.map((effects, group) => {
    const cards = [...effects];
    while (cards.length < 3) cards.push('in');
    return {
      id: `fragments-${group + 1}`,
      title: `Fragments ${group + 1}`,
      layout: 'three-column-cards',
      transition: 'fade',
      props: {
        title: `Fragment effects, part ${group + 1}`,
        cards: cards.map((effect, index) => ({
          heading: effect,
          body: `Step ${index + 1}: press the right arrow to play “${effect}”.`,
          step: index + 1,
          fragment: effect,
          ...(effect === 'highlight' ? { tone: 'accent' } : {}),
        })),
      },
    };
  });
}

/** The demo deck at one motion level. */
export function motionDeck(level: DeckMotionLevel): Record<string, unknown> {
  return {
    formatVersion: 2,
    meta: { title: 'Every deck motion', locale: 'en' },
    style: { motion: level },
    slides: [
      ...DECK_TRANSITIONS.map((transition) => ({
        id: `transition-${transition}`,
        title: `Transition: ${transition}`,
        layout: 'section-divider',
        transition,
        props: {
          eyebrow: 'Slide transition',
          title: `${transition}: ${TRANSITION_NOTES[transition]}`,
        },
      })),
      ...fragmentSlides(),
    ],
  };
}

export interface TransitionRow {
  readonly transition: DeckTransition;
  readonly note: string;
  readonly cells: readonly { readonly label: string; readonly name: string; readonly ms: number }[];
}

/** What each transition becomes at each level, and under reduced motion. */
export const TRANSITION_TABLE: readonly TransitionRow[] = DECK_TRANSITIONS.map((transition) => ({
  transition,
  note: TRANSITION_NOTES[transition],
  cells: [
    ...MOTION_LEVELS.map((motion) => ({ label: motion, motion, reducedMotion: false })),
    { label: 'reduced motion', motion: 'full' as const, reducedMotion: true },
  ].map(({ label, motion, reducedMotion }) => {
    const resolved = resolveSlideTransition({ slide: { transition }, motion, reducedMotion });
    return { label, name: resolved.name, ms: resolved.durationMs };
  }),
}));

export const DECK_LEVEL_COLUMNS: readonly string[] = [...MOTION_LEVELS, 'reduced motion'];
