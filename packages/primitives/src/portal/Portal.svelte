<script lang="ts">
import { createPortal, type PortalTarget } from '@texuli/core/portal';
import { mount, type Snippet, unmount } from 'svelte';
import PortalHost from './PortalHost.svelte';

type Props = {
  /**
   * Element that receives the portaled content. When omitted or `null`/`undefined`,
   * content is appended to the owner document's `body`.
   */
  to?: PortalTarget;
  /**
   * When true, content stays in place (no portal). Useful for SSR-safe trees and tests.
   */
  disabled?: boolean;
  children?: Snippet;
};

let { to = undefined, disabled = false, children }: Props = $props();

/**
 * Mount children into a fresh host, then move that host with `createPortal`.
 * A fresh host (never mid-tree) keeps WebKit sequential focus order intact;
 * `createPortal` still owns target validation, retargeting and teardown.
 */
$effect(() => {
  if (disabled || typeof document === 'undefined' || !children) return;

  const host = document.createElement('div');
  host.setAttribute('data-tx-portal', '');
  // Attach under body first so createPortal has an owner document and origin.
  document.body.append(host);

  const portal = createPortal(host, { target: to });
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
{/if}
