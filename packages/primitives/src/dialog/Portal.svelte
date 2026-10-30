<script lang="ts">
import type { PortalScope, PortalTarget } from '@texuli/core/portal';
import { createScopedPortal } from '@texuli/core/portal';
import { type Snippet, setContext } from 'svelte';
import type { DialogPortalContext } from './context.ts';
import { DIALOG_PORTAL_CONTEXT, getDialogContext } from './context.ts';

interface Props {
  /** Where the content goes. Omitted: the portal root of its token scope, or `body`. */
  to?: PortalTarget;
  /**
   * The token scope the content keeps when `to` is omitted (ADR-023):
   * `'auto'` (default) follows the nearest `[data-tx-scope]` or
   * `[data-tx-theme]` around the Portal; `null` always uses `body`.
   */
  scope?: PortalScope;
  children?: Snippet;
}
let { to, scope = 'auto', children }: Props = $props();
const context = getDialogContext();
let placed = $state(false);
let portal: ReturnType<typeof createScopedPortal> | null = null;
const portalContext: DialogPortalContext = {
  get target() {
    return context.mode === 'contained' ? context.container : (to ?? null);
  },
  get placed() {
    return placed;
  },
  refresh() {
    portal?.setTarget(portalContext.target);
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
  const created =
    context.mode === 'contained' && !target ? null : createScopedPortal(node, { target, scope });
  portal = created;
  placed = true;
  return () => {
    placed = false;
    created?.destroy();
    if (portal === created) portal = null;
  };
}
</script>

<div data-dialog-portal {@attach attachPortal}>
{@render children?.()}
</div>
