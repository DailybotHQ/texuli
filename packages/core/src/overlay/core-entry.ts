// `@texuli/core/overlay-core`: the overlay engine with opt-in features (no texel bundled).
export { createOverlayCore, OVERLAY_MODE_ATTR, OVERLAY_Z_BASE } from './core.ts';
export type {
  OverlayController,
  OverlayDismissEvent,
  OverlayDismissReason,
  OverlayFeatures,
  OverlayMode,
  OverlayOptions,
  OverlayPhase,
} from './types.ts';
