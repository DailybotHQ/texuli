<script lang="ts">
import {
  type ChildSnippet,
  composeChildProps,
  type PrimitiveState,
  stateAttributes,
} from '../internal/index.ts';
import { avatarContext } from './context.ts';
import type { AvatarImageLoadingStatus, AvatarRootProps } from './types.ts';

/**
 * Headless avatar root: owns image loading status and delay before the
 * loaded image is shown. Image and Fallback read this context.
 */
let {
  delayMs = 0,
  loadingStatus = $bindable('loading' as AvatarImageLoadingStatus),
  onLoadingStatusChange,
  child,
  children,
  ref = $bindable(null),
  class: className,
  id,
  ...rest
}: AvatarRootProps = $props();

const uid = $props.id();
// Prefer an explicit id when provided; $props.id() is stable for the lifetime.
const rootId = $derived(id ?? `tx-avatar-${uid}`);

function setStatus(next: AvatarImageLoadingStatus): void {
  if (loadingStatus === next) return;
  loadingStatus = next;
  onLoadingStatusChange?.(next);
}

avatarContext.set({
  status: () => loadingStatus,
  setStatus,
  delayMs: () => delayMs,
  get rootId() {
    return rootId;
  },
});

const rootProps = $derived({
  id: rootId,
  ...stateAttributes(loadingStatus as PrimitiveState),
  'data-tx-avatar-root': '',
  class: typeof className === 'string' ? className : undefined,
  ...rest,
});
</script>

{#if child}
  {@const props = composeChildProps(rootProps, {})}
  {@render child({ props })}
{:else}
  <div bind:this={ref} {...rootProps}>
    {@render children?.()}
  </div>
{/if}
