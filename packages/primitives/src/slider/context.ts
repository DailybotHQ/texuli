import { createPrimitiveContext } from '../internal/context.ts';
import type { SliderOrientation } from './types.ts';

export interface SliderContext {
  readonly values: readonly number[];
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly orientation: SliderOrientation;
  readonly disabled: boolean;
  readonly name: string | undefined;
  readonly form: string | undefined;
  readonly required: boolean;
  /** The thumb being dragged, or -1. */
  readonly active: number;
  bounds(index: number): [number, number];
  valueText(index: number): string | undefined;
  /** Keyboard input on a thumb. Returns whether the key was handled. */
  keydown(index: number, event: KeyboardEvent): boolean;
  /** The values a form reset restores. */
  readonly defaults: readonly number[];
  reset(index: number, value: number): void;
}

export const sliderContext = createPrimitiveContext<SliderContext>('Slider.Root');

/**
 * Positions a part on the track through CSSOM (`style.setProperty`), which a
 * strict CSP allows where a `style` attribute would not. As an attachment it
 * re-runs, and so moves, whenever the values it reads change.
 */
export function positionAttachment(
  read: () => Record<string, string | undefined>
): (node: HTMLElement) => () => void {
  return (node) => {
    const styles = read();
    for (const [property, value] of Object.entries(styles)) {
      if (value !== undefined) node.style.setProperty(property, value);
    }
    return () => {
      for (const property of Object.keys(styles)) node.style.removeProperty(property);
    };
  };
}
