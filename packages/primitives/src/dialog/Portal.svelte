<script lang="ts">
import type { PortalTarget } from '@texuli/core/portal';
import { createPortal } from '@texuli/core/portal';
import { type Snippet, setContext } from 'svelte';
import type { DialogPortalContext } from './context.ts';
import { DIALOG_PORTAL_CONTEXT, getDialogContext } from './context.ts';

interface Props {
  to?: PortalTarget;
  children?: Snippet;
}
let { to, children }: Props = $props();
const context = getDialogContext();
let placed = $state(false);
const portalContext: DialogPortalContext = {
  get target() {
    return context.mode === 'contained' ? context.container : (to ?? null);
  },
  get placed() {
    return placed;
  },
};
setContext(DIALOG_PORTAL_CONTEXT, portalContext);

/**
 * Move the wrapper, then mark it placed. Content waits for `placed` before it
 * opens and takes focus: children attach before their parent, and moving a
 * focused node blurs it in browsers, so a dialog mounted already open used to
 * lose its initial focus.
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

<div data-dialog-portal {@attach attachPortal}>
{@render children?.()}
</div>
