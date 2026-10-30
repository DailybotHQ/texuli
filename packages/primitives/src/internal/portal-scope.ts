import type { OverlayController } from '@texuli/core/overlay-core';

/** What a dialog Portal shares so its content can re-place it (ADR-023). */
export type PortalRefresh = { refresh(): void };

/**
 * Re-place the portal right before the overlay opens, so a token scope
 * applied after mount (an ancestor's effect, an async theme load) is followed.
 * It runs before the engine moves focus in: moving a focused node blurs it.
 */
export function placeBeforeOpen(
  controller: OverlayController,
  portal: PortalRefresh | undefined
): OverlayController {
  if (!portal) return controller;
  return {
    ...controller,
    open(event) {
      if (!controller.isOpen()) portal.refresh();
      controller.open(event);
    },
    toggle(event) {
      if (!controller.isOpen()) portal.refresh();
      controller.toggle(event);
    },
  };
}
