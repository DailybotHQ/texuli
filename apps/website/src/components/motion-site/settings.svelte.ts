/**
 * The motion settings every /motion-page/ island reads: the level and the
 * reduced-motion override chosen in the settings panel. One module instance
 * per page, so the islands (each a separate Svelte root) share it. Styled
 * components get it through `MotionProvider`; the runtime demos pass it to
 * `@texuli/core/motion` as `level` and `reducedMotion`.
 */
import type { MotionLevel, MotionRun, ReducedMotionInput } from '@texuli/core/motion';
import type { MotionSettings } from 'texuli/motion';

export const MOTION_SETTINGS = $state<{ level: MotionLevel; reduced: boolean }>({
  level: 'full',
  reduced: false,
});

/** The provider's `reducedMotion`: forced on, or follow the reader's system (`undefined`). */
export function providerReduced(): boolean | undefined {
  return MOTION_SETTINGS.reduced ? true : undefined;
}

/**
 * The page settings in the shape `texuli/motion` seams take (`settings`),
 * for a component that animates in the same component that would otherwise
 * render the provider. The getters stay live.
 */
export const pageMotionSettings: MotionSettings = {
  get level() {
    return MOTION_SETTINGS.level;
  },
  get reducedMotion() {
    return providerReduced();
  },
};

/** Timing options for the runtime texels, read at play time. */
export function runtimeTiming(): { level: MotionLevel; reducedMotion: ReducedMotionInput } {
  return { level: MOTION_SETTINGS.level, reducedMotion: providerReduced() };
}

/** What a run did, in words: "Played (finished)" or "Instant: reduced-motion". */
export function describeRun(run: Pick<MotionRun, 'instantReason'>, outcome?: string): string {
  if (run.instantReason !== null) return `Instant: ${run.instantReason}`;
  return outcome ? `Played: ${outcome}` : 'Playing';
}

/** The settings as one line, for each demo's status. */
export function settingsLabel(): string {
  return `Level ${MOTION_SETTINGS.level}, reduced motion ${MOTION_SETTINGS.reduced ? 'on' : 'follows your system'}`;
}
