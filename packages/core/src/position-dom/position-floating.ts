import { requestFrame } from '../env/index.ts';
import {
  type ComputePositionResult,
  resolvePlacementForDirection,
} from '../position-math/index.ts';
import { type AutoUpdateOptions, autoUpdate } from './auto-update.ts';
import {
  canUseCssAnchor,
  cssAnchorDeclarations,
  nextAnchorName,
  supportsCssAnchorPositioning,
} from './css-anchor.ts';
import { type PositionReference, readDirection, referenceElement } from './measure.ts';
import {
  type ApplyPositionOptions,
  applyPosition,
  applySameWidth,
  clearPosition,
  computeDomPosition,
  type DomPositionOptions,
  positionWindow,
} from './position.ts';

export interface PositionFloatingOptions
  extends DomPositionOptions,
    ApplyPositionOptions,
    AutoUpdateOptions {
  /**
   * `auto` (default): CSS anchor positioning when the browser supports it and
   * it gives the same result (no flip, shift, size or arrow; a real element
   * as reference); otherwise the script path. `never`: always the script path.
   */
  cssAnchor?: 'auto' | 'never';
  /** Called after each script-path position, with the result. */
  onPosition?: (result: ComputePositionResult) => void;
}

export interface FloatingPosition {
  /** Which path places the element. */
  readonly mode: 'css-anchor' | 'script';
  /** Position again now (the script path; a no-op for CSS, which tracks by itself). */
  update(): void;
  /** Stops tracking and removes everything this wrote. Idempotent. */
  destroy(): void;
}

/**
 * Places `floating` next to `reference` and keeps it there until destroyed:
 * with CSS anchor positioning where that is exact, else by measuring and
 * auto-updating on scroll, resize and anchor movement.
 */
export function positionFloating(
  reference: PositionReference,
  floating: HTMLElement,
  options: PositionFloatingOptions
): FloatingPosition {
  const anchor = referenceElement(reference);
  const css =
    options.cssAnchor !== 'never' &&
    anchor === reference &&
    typeof (anchor as HTMLElement).style?.setProperty === 'function' &&
    canUseCssAnchor(options) &&
    supportsCssAnchorPositioning(positionWindow(reference, floating));

  if (css && anchor) {
    const anchorStyle = (anchor as HTMLElement).style;
    const previousAnchorName = anchorStyle.getPropertyValue('anchor-name');
    const name = nextAnchorName();
    anchorStyle.setProperty(
      'anchor-name',
      previousAnchorName ? `${previousAnchorName}, ${name}` : name
    );
    const placement = resolvePlacementForDirection(
      options.placement,
      options.direction ?? readDirection(anchor)
    );
    const declarations = cssAnchorDeclarations(name, placement, options.offset);
    for (const [property, value] of Object.entries(declarations)) {
      floating.style.setProperty(property, value);
    }
    floating.dataset.placement = placement;
    floating.dataset.side = placement.split('-')[0];
    let active = true;
    return {
      mode: 'css-anchor',
      update() {},
      destroy() {
        if (!active) return;
        active = false;
        for (const property of Object.keys(declarations)) floating.style.removeProperty(property);
        if (previousAnchorName) anchorStyle.setProperty('anchor-name', previousAnchorName);
        else anchorStyle.removeProperty('anchor-name');
        delete floating.dataset.placement;
        delete floating.dataset.side;
      },
    };
  }

  let active = true;
  const update = () => {
    if (!active) return;
    // sameWidth runs inside computeDomPosition (before the floating measure)
    // so placement and min-inline-size share one layout frame. autoUpdate's
    // ResizeObserver on the anchor re-runs this when the trigger settles.
    const result = computeDomPosition(reference, floating, options);
    applyPosition(floating, result, options);
    options.onPosition?.(result);
  };
  const stop = autoUpdate(reference, floating, update, options);
  // WebKit often finalizes trigger font/layout one frame after open; a trailing
  // update re-reads the anchor without waiting for a resize event.
  let cancelTrailing: (() => void) | undefined;
  if (options.sameWidth) {
    const ownerWindow = positionWindow(reference, floating);
    cancelTrailing = requestFrame(() => {
      cancelTrailing = undefined;
      if (!active) return;
      applySameWidth(reference, floating);
      update();
    }, ownerWindow);
  }
  return {
    mode: 'script',
    update,
    destroy() {
      if (!active) return;
      active = false;
      cancelTrailing?.();
      cancelTrailing = undefined;
      stop();
      clearPosition(floating);
    },
  };
}
