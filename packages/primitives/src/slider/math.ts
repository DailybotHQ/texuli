/**
 * Pure slider math: snapping, neighbor bounds, positions and keys. Every
 * function takes numbers in and returns numbers out, so the rules are tested
 * without a DOM.
 */

export interface SliderScale {
  min: number;
  max: number;
  step: number;
}

/** Digits after the decimal point, so 0.1 + 0.2 snaps to 0.3, not 0.30000000000000004. */
function decimals(value: number): number {
  const text = String(value);
  const exponent = /e-(\d+)$/.exec(text);
  if (exponent) return Number(exponent[1]);
  const dot = text.indexOf('.');
  return dot < 0 ? 0 : text.length - dot - 1;
}

export function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/** The nearest step from `min`, inside `[min, max]`. */
export function snapToStep(value: number, { min, max, step }: SliderScale): number {
  const safeStep = step > 0 ? step : 1;
  const steps = Math.round((value - min) / safeStep);
  const snapped = Number(
    (min + steps * safeStep).toFixed(Math.max(decimals(safeStep), decimals(min)))
  );
  return clamp(snapped, min, max);
}

/**
 * The range a thumb may move in: its neighbors (plus the minimum gap) or the
 * ends of the scale. Thumbs never cross.
 */
export function thumbBounds(
  values: readonly number[],
  index: number,
  scale: SliderScale,
  minSteps = 0
): [number, number] {
  const gap = Math.max(0, minSteps) * scale.step;
  const previous = values[index - 1];
  const next = values[index + 1];
  const low = previous === undefined ? scale.min : Math.min(scale.max, previous + gap);
  const high = next === undefined ? scale.max : Math.max(scale.min, next - gap);
  return [low, Math.max(low, high)];
}

/** Where `value` sits on the scale, from 0 to 100. */
export function percentOf(value: number, min: number, max: number): number {
  return max === min ? 0 : clamp(((value - min) / (max - min)) * 100, 0, 100);
}

/**
 * The thumb a pointer at `value` should move: the nearest one. On a tie (two
 * thumbs at the same value) the pointer side decides, so a thumb pressed
 * against its neighbor can still be pulled away.
 */
export function closestThumb(values: readonly number[], value: number): number {
  let best = 0;
  values.forEach((current, index) => {
    const distance = Math.abs(current - value);
    const bestDistance = Math.abs((values[best] as number) - value);
    if (distance < bestDistance || (distance === bestDistance && value > current)) best = index;
  });
  return best;
}

/** The scale value under a pointer, given the track rectangle. */
export function valueFromPointer(
  point: { x: number; y: number },
  rect: { left: number; top: number; width: number; height: number },
  scale: SliderScale,
  orientation: 'horizontal' | 'vertical',
  rtl: boolean
): number {
  const fraction =
    orientation === 'vertical'
      ? rect.height > 0
        ? (rect.top + rect.height - point.y) / rect.height
        : 0
      : rect.width > 0
        ? rtl
          ? (rect.left + rect.width - point.x) / rect.width
          : (point.x - rect.left) / rect.width
        : 0;
  return scale.min + clamp(fraction, 0, 1) * (scale.max - scale.min);
}

export type SliderKeyAction = { by: number } | { to: 'low' | 'high' };

/**
 * The change a key asks for (APG slider). Up and Right increase, Down and
 * Left decrease; in RTL horizontal sliders Left and Right swap. Page keys move
 * `largeStep`, Home and End go to the ends. Modified keys are left alone.
 */
export function sliderKeyAction(
  event: Pick<KeyboardEvent, 'key' | 'altKey' | 'ctrlKey' | 'metaKey'>,
  options: { step: number; largeStep: number; orientation: 'horizontal' | 'vertical'; rtl: boolean }
): SliderKeyAction | null {
  if (event.altKey || event.ctrlKey || event.metaKey) return null;
  const flip = options.orientation === 'horizontal' && options.rtl ? -1 : 1;
  switch (event.key) {
    case 'ArrowUp':
      return { by: options.step };
    case 'ArrowDown':
      return { by: -options.step };
    case 'ArrowRight':
      return { by: options.step * flip };
    case 'ArrowLeft':
      return { by: -options.step * flip };
    case 'PageUp':
      return { by: options.largeStep };
    case 'PageDown':
      return { by: -options.largeStep };
    case 'Home':
      return { to: 'low' };
    case 'End':
      return { to: 'high' };
    default:
      return null;
  }
}
