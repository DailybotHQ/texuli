<script lang="ts">
import {
  createScopedPortal,
  findPortalScope,
  type PortalScope,
  type PortalTarget,
} from '@texuli/core/portal';
import { mount, type Snippet, unmount } from 'svelte';
import PortalHost from './PortalHost.svelte';

type Props = {
  /**
   * Element that receives the portaled content. When omitted or `null`/`undefined`,
   * content goes to the portal root of its token scope, or the owner document's `body`.
   */
  to?: PortalTarget;
  /**
   * The token scope the content keeps when `to` is omitted (ADR-023):
   * `'auto'` (default) follows the nearest `[data-tx-scope]` or
   * `[data-tx-theme]` around the Portal; an element names one; `null` always
   * uses `body`.
   */
  scope?: PortalScope;
  /**
   * When true, content stays in place (no portal). Useful for SSR-safe trees and tests.
   */
  disabled?: boolean;
  children?: Snippet;
};

let { to = undefined, scope = 'auto', disabled = false, children }: Props = $props();
/** Marks where the Portal sits, so `'auto'` can find its scope (a template renders nothing). */
let anchor: HTMLTemplateElement | null = $state(null);

/**
 * Mount children into a fresh host, then move that host with `createPortal`.
 * A fresh host (never mid-tree) keeps WebKit sequential focus order intact;
 * `createScopedPortal` still owns target validation, retargeting and teardown.
 */
$effect(() => {
  if (disabled || typeof document === 'undefined' || !children) return;

  const host = document.createElement('div');
  host.setAttribute('data-tx-portal', '');
  // Attach under body first so createPortal has an owner document and origin.
  document.body.append(host);

  const target = to;
  const anchorNode = anchor;
  const portal = createScopedPortal(host, {
    target,
    scope: scope === 'auto' ? () => findPortalScope(anchorNode?.parentElement) : scope,
  });
  // An ancestor's effect may apply its theme after this one ran: place the
  // host again once the current flush is done (a no-op when nothing changed).
  queueMicrotask(() => portal.setTarget(target));
  if (portal.isPortaled || host.parentElement === document.body) {
    host.setAttribute('data-portaled', '');
  }

  const instance = mount(PortalHost, {
    target: host,
    props: {
      get children() {
        return children;
      },
    },
  });

  return () => {
    unmount(instance);
    portal.destroy();
    host.remove();
  };
});
</script>

{#if disabled}
  <div data-tx-portal="">
    {@render children?.()}
  </div>
{:else}
  <template data-tx-portal-anchor bind:this={anchor}></template>
{/if}
