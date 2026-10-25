import { type Placement, type PositionOffset } from '../position-math/index.ts';
import type { DomPositionOptions } from './position.ts';

/**
 * Whether the browser implements CSS anchor positioning (`anchor-name`,
 * `position-anchor` and `anchor()` in insets). Checked only when called.
 */
export function supportsCssAnchorPositioning(ownerWindow: Window | undefined): boolean {
  const css = (ownerWindow as (Window & { CSS?: typeof CSS }) | undefined)?.CSS;
  if (typeof css?.supports !== 'function') return false;
  return css.supports('anchor-name', '--texuli-probe') && css.supports('top', 'anchor(bottom)');
}

/**
 * CSS can place exactly what `computePosition` places only without the steps
 * that need measurement: no flip, shift, size, sameWidth or arrow. With any of
 * those the script path runs, so the result never depends on which path the
 * browser took.
 */
export function canUseCssAnchor(options: DomPositionOptions): boolean {
  return !options.flip && !options.shift && !options.size && !options.sameWidth && !options.arrow;
}

const px = (value: number) => `${value}px`;
const at = (edge: string, delta: number) =>
  delta === 0
    ? `anchor(${edge})`
    : `calc(anchor(${edge}) ${delta < 0 ? '-' : '+'} ${px(Math.abs(delta))})`;

/**
 * The floating element's declarations for one physical placement, matching
 * `place()` pixel for pixel: the main side sits `mainAxis` away from the
 * anchor edge; `-start`/`-end` align the matching edges plus `crossAxis`; a
 * centered placement starts at the anchor's center and translates back by half
 * its own size. Physical insets are geometry: the placement is already
 * resolved for right-to-left.
 */
export function cssAnchorDeclarations(
  anchorName: string,
  placement: Placement,
  offset: number | PositionOffset = 0
): Record<string, string> {
  const main = typeof offset === 'number' ? offset : (offset.mainAxis ?? 0);
  const cross = typeof offset === 'number' ? 0 : (offset.crossAxis ?? 0);
  const [side, align = 'center'] = placement.split('-') as [string, string?];
  const vertical = side === 'top' || side === 'bottom';
  const declarations: Record<string, string> = {
    position: 'fixed',
    'position-anchor': anchorName,
  };
  const opposite: Record<string, string> = {
    top: 'bottom',
    bottom: 'top',
    left: 'right',
    right: 'left',
  };
  // Main axis: the inset on the far side reaches the anchor's near edge.
  declarations[opposite[side] as string] = at(side, main);
  // Cross axis.
  const [start, end] = vertical ? ['left', 'right'] : ['top', 'bottom'];
  if (align === 'start') declarations[start] = at(start, cross);
  else if (align === 'end') declarations[end] = at(end, -cross);
  else {
    declarations[start] = at('center', cross);
    declarations.translate = vertical ? '-50% 0' : '0 -50%';
  }
  return declarations;
}

let sequence = 0;
/** A fresh dashed ident for one reference and floating pair. */
export function nextAnchorName(): string {
  sequence += 1;
  return `--texuli-anchor-${sequence}`;
}
