import { createFocusScope } from '../focus-scope/index.ts';
import { getInertRegistry } from '../inert/index.ts';
import { createPortal } from '../portal/index.ts';
import { positionFloating } from '../position-dom/index.ts';
import { lockScroll } from '../scroll-lock/scroll-lock.ts';
import { createOverlayCore } from './core.ts';
import type { OverlayController, OverlayFeatures, OverlayOptions } from './types.ts';

export { OVERLAY_MODE_ATTR, OVERLAY_Z_BASE } from './core.ts';

/** Every overlay feature: positioning, focus scope, inert, scroll lock and portal. */
export const ALL_OVERLAY_FEATURES: Readonly<Required<OverlayFeatures>> =
  /* @__PURE__ */ Object.freeze({
    position: positionFloating,
    focusScope: createFocusScope,
    inert: getInertRegistry,
    scrollLock: lockScroll,
    portal: createPortal,
  });

/**
 * Composes every texel into one overlay: layer registration, Escape and
 * outside dismissal (topmost only), focus scope, inert outside with
 * exemptions, scroll lock, portal, presence and positioning. Convenient, but
 * it bundles all of them: primitives use {@link createOverlayCore} from
 * `@texuli/core/overlay-core` with only the features they need.
 */
export function createOverlay(options: OverlayOptions): OverlayController {
  return createOverlayCore(options, ALL_OVERLAY_FEATURES);
}
