<script lang="ts">
import type { HrefTrust } from '@texuli/core/url-policy';
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue } from '../../internal/cx.ts';
import Avatar from './Avatar.svelte';
import type { AvatarGroupItem } from './types.ts';
import { type AvatarSize, type AvatarStatus, avatarGroupClass } from './variants.ts';
import './avatar.css';
import { designDefaults } from '../../internal/design-defaults.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
  /** People to show (fictional names only in demos). */
  items: readonly AvatarGroupItem[];
  /** How many faces to show before a +N overflow chip. Default: all. */
  max?: number;
  size?: AvatarSize;
  /** Accessible name for the group (e.g. "Team"). */
  label?: string;
  /** Format string for overflow; `{n}` is replaced with the hidden count. */
  overflowLabel?: string;
  class?: ClassValue;
};

const txDefaults = designDefaults('avatar');
let {
  items,
  max,
  size = txDefaults().size ?? 'md',
  label,
  overflowLabel = '+{n}',
  class: className,
  ref = $bindable(null),
  ...rest
}: Props = $props();

const limit = $derived(max !== undefined && max > 0 ? Math.floor(max) : items.length);
const visible = $derived(items.slice(0, Math.max(0, limit)));
const hiddenCount = $derived(Math.max(0, items.length - visible.length));
const overflowText = $derived(overflowLabel.replace('{n}', String(hiddenCount)));
const classes = $derived(
  avatarGroupClass({
    size,
    class: className,
  })
);
</script>

<div
  bind:this={ref}
  class={classes}
  role="group"
  aria-label={label}
  data-tx-avatar-group
  data-size={size}
  {...rest}
>
  {#each visible as item, index (item.name + String(index))}
    <Avatar
      name={item.name}
      src={item.src}
      srcTrust={item.srcTrust}
      srcset={item.srcset}
      sizes={item.sizes}
      status={item.status}
      decorative={item.decorative ?? Boolean(label)}
      {size}
    />
  {/each}
  {#if hiddenCount > 0}
    <span
      class="tx-avatar-group__overflow"
      data-tx-avatar-group-overflow
      title={overflowText}
      aria-label={overflowText}
    >
      {overflowText}
    </span>
  {/if}
</div>
