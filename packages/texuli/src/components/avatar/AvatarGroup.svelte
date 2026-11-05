<script lang="ts">
import type { HrefTrust } from '@texuli/core/url-policy';
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue } from '../../internal/cx.ts';
import Avatar from './Avatar.svelte';
import { avatarInitials } from './initials.ts';
import type { AvatarGroupItem } from './types.ts';
import {
  type AvatarGroupLayout,
  type AvatarSize,
  type AvatarStatus,
  avatarGroupClass,
} from './variants.ts';
import './avatar.css';
import { designDefaults } from '../../internal/design-defaults.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
  /** People to show (fictional names only in demos). */
  items: readonly AvatarGroupItem[];
  /** How many faces to show before a +N overflow chip. Default: all. Ignored by `grid`. */
  max?: number;
  /**
   * `stack` (default): overlapping faces in a row. `grid`: up to four faces
   * in one avatar-sized circle (halves for 2, a half and two quarters for 3,
   * quarters for 4+, the fourth cell showing +N when there are more), as a
   * group conversation shows them. The grid is one image named by `label`,
   * or by the member names.
   */
  layout?: AvatarGroupLayout;
  size?: AvatarSize;
  /** Accessible name for the group (e.g. "Team"). With `grid`, defaults to the member names. */
  label?: string;
  /** Format string for overflow; `{n}` is replaced with the hidden count. */
  overflowLabel?: string;
  class?: ClassValue;
};

const txDefaults = designDefaults('avatar');
let {
  items,
  max,
  layout = 'stack',
  size = txDefaults().size ?? 'md',
  label,
  overflowLabel = '+{n}',
  class: className,
  ref = $bindable(null),
  ...rest
}: Props = $props();

const grid = $derived(layout === 'grid');
/** Four cells at most: with more members, three faces and a +N cell. */
const gridFaces = $derived(items.length > 4 ? items.slice(0, 3) : items);
const limit = $derived(
  grid ? gridFaces.length : max !== undefined && max > 0 ? Math.floor(max) : items.length
);
const visible = $derived(items.slice(0, Math.max(0, limit)));
const hiddenCount = $derived(Math.max(0, items.length - visible.length));
const overflowText = $derived(overflowLabel.replace('{n}', String(hiddenCount)));
const classes = $derived(
  avatarGroupClass({
    size,
    layout,
    class: className,
  })
);
const cells = $derived(visible.length + (hiddenCount > 0 ? 1 : 0));
/** One name for the grid image: the label, else every member's name. */
const gridName = $derived(label ?? items.map((item) => item.name).join(', '));
/** A quarter cell has room for one letter. */
function quarter(index: number): boolean {
  return cells === 4 || (cells === 3 && index > 0);
}
</script>

{#if grid}
  <div
    bind:this={ref}
    class={classes}
    role="img"
    aria-label={gridName || undefined}
    data-tx-avatar-group
    data-size={size}
    data-layout="grid"
    data-count={cells}
    {...rest}
  >
    {#each visible as item, index (item.name + String(index))}
      <Avatar
        name={item.name}
        src={item.src}
        srcTrust={item.srcTrust}
        srcset={item.srcset}
        sizes={item.sizes}
        initials={quarter(index) ? avatarInitials(item.name).slice(0, 1) : undefined}
        decorative
        {size}
      />
    {/each}
    {#if hiddenCount > 0}
      <span class="tx-avatar-group__overflow" data-tx-avatar-group-overflow aria-hidden="true"
        >{overflowText}</span
      >
    {/if}
  </div>
{:else}
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
{/if}
