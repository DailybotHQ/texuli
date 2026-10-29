<script lang="ts">
import { ICON_NAMES, Icon, type IconName } from 'texuli/icons';
import type { BlockIconResolver } from './types.ts';

/**
 * A decorative icon named in block data: the host's `resolveIcon` result, or
 * the Texuli built-in icon of that name, or nothing at all. Always
 * `aria-hidden`; the block's text carries the meaning.
 */
let {
  name,
  resolveIcon,
  class: className = '',
}: {
  name: string | undefined;
  resolveIcon?: BlockIconResolver | undefined;
  class?: string;
} = $props();

const builtIn = (value: unknown): value is IconName =>
  (ICON_NAMES as readonly unknown[]).includes(value);
const icon = $derived.by(() => {
  if (name === undefined) return undefined;
  const resolved = resolveIcon?.(name);
  if (typeof resolved === 'function') return resolved;
  return builtIn(resolved) ? resolved : builtIn(name) ? name : undefined;
});
</script>

{#if icon}
  <span class={`tx-block-icon ${className}`} data-icon={name} aria-hidden="true"><Icon {icon} size="sm" /></span>
{/if}
