<script lang="ts">
import {
  type ChildSnippet,
  composeChildProps,
  type PrimitiveState,
  stateAttributes,
} from '../internal/index.ts';
import { avatarContext } from './context.ts';
import type { AvatarFallbackProps } from './types.ts';

/**
 * Fallback content while the image is loading, delayed, or failed.
 * Hidden once the root status is `loaded`.
 */
let {
  child,
  children,
  ref = $bindable(null),
  class: className,
  ...rest
}: AvatarFallbackProps = $props();

const avatar = avatarContext.get();
const status = $derived(avatar.status());
const show = $derived(status !== 'loaded');

const fallbackProps = $derived({
  ...stateAttributes(status as PrimitiveState),
  'data-tx-avatar-fallback': '',
  class: typeof className === 'string' ? className : undefined,
  ...rest,
});
</script>

{#if show}
  {#if child}
    {@const props = composeChildProps(fallbackProps, {})}
    {@render child({ props })}
  {:else}
    <span bind:this={ref} {...fallbackProps}>
      {@render children?.()}
    </span>
  {/if}
{/if}
