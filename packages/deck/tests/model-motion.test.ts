// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  effectiveMotion,
  MAX_MOTION_MS,
  MOTION_LEVELS,
  type MotionLevel,
  REDUCED_FADE_MS,
  resolveDeckTransitions,
  resolveFragmentMotion,
  resolveSlideTransition,
  TRANSITION_MS,
} from '../src/model/motion/index.ts';
import { DECK_TRANSITIONS, type DeckTransition, FRAGMENT_EFFECTS } from '../src/model/shared.ts';

describe('resolveSlideTransition: precedence', () => {
  it('takes the slide override, then the deck default, then fade; invalid values fall through', () => {
    const cases: [unknown, unknown, DeckTransition, string][] = [
      ['slide', 'zoom', 'slide', 'slide-override'],
      [undefined, 'zoom', 'zoom', 'deck-default'],
      [undefined, undefined, 'fade', 'engine-default'],
      ['spin', 'morph', 'morph', 'deck-default'],
      ['spin', 'spin', 'fade', 'engine-default'],
      ['none', 'zoom', 'none', 'slide-override'],
    ];
    for (const [own, deckDefault, name, reason] of cases) {
      const resolved = resolveSlideTransition({
        slide: { transition: own },
        deck: { style: { transition: deckDefault } },
      });
      expect([resolved.name, resolved.requested, resolved.reason], `${own} ${deckDefault}`).toEqual(
        [name, name, reason]
      );
    }
    expect(resolveSlideTransition()).toMatchObject({
      name: 'fade',
      durationMs: 300,
      motion: 'full',
    });
    expect(resolveSlideTransition({ slide: null, deck: { style: null } }).name).toBe('fade');
  });
});

describe('resolveSlideTransition: every motion and reduced-motion combination', () => {
  /** Expected `[name, durationMs, reason]` per motion level, without reduced motion. */
  const expected: Record<MotionLevel, Record<DeckTransition, [DeckTransition, number, string]>> = {
    full: {
      none: ['none', 0, 'slide-override'],
      fade: ['fade', 300, 'slide-override'],
      'fade-up': ['fade-up', 300, 'slide-override'],
      slide: ['slide', 400, 'slide-override'],
      zoom: ['zoom', 350, 'slide-override'],
      morph: ['morph', 400, 'slide-override'],
    },
    subtle: {
      none: ['none', 0, 'slide-override'],
      fade: ['fade', 180, 'subtle'],
      'fade-up': ['fade-up', 180, 'subtle'],
      slide: ['slide', 240, 'subtle'],
      zoom: ['fade', 180, 'subtle'],
      morph: ['morph', 240, 'subtle'],
    },
    none: Object.fromEntries(
      DECK_TRANSITIONS.map((t) => [t, ['none', 0, 'motion-none']])
    ) as Record<DeckTransition, [DeckTransition, number, string]>,
  };

  it('resolves each transition under each level, with and without reduced motion', () => {
    for (const motion of MOTION_LEVELS) {
      for (const transition of DECK_TRANSITIONS) {
        for (const reducedMotion of [false, true]) {
          const resolved = resolveSlideTransition({ slide: { transition }, motion, reducedMotion });
          const label = `${motion} ${transition} reduced=${reducedMotion}`;
          const want: [DeckTransition, number, string] =
            reducedMotion && motion !== 'none' && transition !== 'none'
              ? ['fade', REDUCED_FADE_MS, 'reduced-motion']
              : expected[motion][transition];
          expect([resolved.name, resolved.durationMs, resolved.reason], label).toEqual(want);
          expect(resolved.requested, label).toBe(transition);
          expect(resolved.durationMs, label).toBeLessThanOrEqual(MAX_MOTION_MS);
          expect(resolved.motion, label).toBe(
            motion === 'none' ? 'none' : reducedMotion ? 'subtle' : motion
          );
        }
      }
    }
    expect(Math.max(...Object.values(TRANSITION_MS))).toBe(MAX_MOTION_MS);
  });

  it('reads the level from deck.style.motion unless the option overrides it; reduced motion never raises', () => {
    const deck = { style: { motion: 'none', transition: 'slide' } };
    expect(resolveSlideTransition({ deck }).reason).toBe('motion-none');
    expect(resolveSlideTransition({ deck, reducedMotion: true }).durationMs).toBe(0);
    expect(resolveSlideTransition({ deck, motion: 'full' })).toMatchObject({
      name: 'slide',
      durationMs: 400,
    });
    expect(resolveSlideTransition({ deck: { style: { motion: 'subtle' } } }).durationMs).toBe(180);
    expect(resolveSlideTransition({ deck: { style: { motion: 'wild' } } }).motion).toBe('full');
    expect(effectiveMotion()).toBe('full');
    expect(effectiveMotion({ motion: 'none', reducedMotion: true })).toBe('none');
    expect(effectiveMotion({ motion: 'full', reducedMotion: true })).toBe('subtle');
  });
});

describe('resolveDeckTransitions', () => {
  it('resolves every slide in order with its id', () => {
    const deck = {
      style: { transition: 'slide' },
      slides: [{ id: 'a' }, { id: 'b', transition: 'zoom' }, { transition: 'none' }],
    };
    expect(resolveDeckTransitions(deck)).toEqual([
      {
        index: 0,
        slideId: 'a',
        transition: {
          name: 'slide',
          durationMs: 400,
          requested: 'slide',
          motion: 'full',
          reason: 'deck-default',
        },
      },
      {
        index: 1,
        slideId: 'b',
        transition: {
          name: 'zoom',
          durationMs: 350,
          requested: 'zoom',
          motion: 'full',
          reason: 'slide-override',
        },
      },
      {
        index: 2,
        transition: {
          name: 'none',
          durationMs: 0,
          requested: 'none',
          motion: 'full',
          reason: 'slide-override',
        },
      },
    ]);
    expect(
      resolveDeckTransitions(deck, { reducedMotion: true }).map((s) => s.transition.durationMs)
    ).toEqual([REDUCED_FADE_MS, REDUCED_FADE_MS, 0]);
    expect(resolveDeckTransitions({})).toEqual([]);
  });
});

describe('resolveFragmentMotion', () => {
  it('resolves every effect under every level, with and without reduced motion', () => {
    const moving = new Set(['fade-up', 'grow', 'shrink']);
    for (const effect of FRAGMENT_EFFECTS) {
      for (const motion of MOTION_LEVELS) {
        for (const reducedMotion of [false, true]) {
          const resolved = resolveFragmentMotion(effect, { motion, reducedMotion });
          const label = `${effect} ${motion} reduced=${reducedMotion}`;
          const still = moving.has(effect) ? 'in' : effect;
          const want =
            motion === 'none'
              ? [still, 0, 'motion-none']
              : reducedMotion
                ? [still, REDUCED_FADE_MS, 'reduced-motion']
                : motion === 'subtle'
                  ? [effect, 180, 'subtle']
                  : [effect, 300, 'full'];
          expect([resolved.effect, resolved.durationMs, resolved.reason], label).toEqual(want);
          expect(resolved.durationMs).toBeLessThanOrEqual(MAX_MOTION_MS);
        }
      }
    }
    expect(resolveFragmentMotion('grow', { deck: { style: { motion: 'none' } } }).durationMs).toBe(
      0
    );
  });
});
