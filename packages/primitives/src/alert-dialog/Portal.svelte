<script lang="ts">
import type { PortalTarget } from '@texuli/core/portal';
import { createPortal } from '@texuli/core/portal';
import { type Snippet, setContext } from 'svelte';
import type { AlertDialogPortalContext } from './context.ts';
import { ALERT_DIALOG_PORTAL_CONTEXT, getAlertDialogContext } from './context.ts';

interface Props {
  to?: PortalTarget;
  children?: Snippet;
}
let { to, children }: Props = $props();
const context = getAlertDialogContext();
let placed = $state(false);
const portalContext: AlertDialogPortalContext = {
  get target() {
    return context.mode === 'contained' ? context.container : (to ?? null);
  },
  get placed() {
    return placed;
  },
};
setContext(ALERT_DIALOG_PORTAL_CONTEXT, portalContext);

/**
 * Move the wrapper, then mark it placed. Content waits for `placed` before it
 * opens and takes focus: moving a focused node blurs it in browsers.
 */
function attachPortal(node: HTMLDivElement): () => void {
  const target = portalContext.target;
  const portal = context.mode === 'contained' && !target ? null : createPortal(node, { target });
  placed = true;
  return () => {
    placed = false;
    portal?.destroy();
  };
}
</script>

<div data-alert-dialog-portal {@attach attachPortal}>
  {@render children?.()}
</div>
