<script lang="ts">
/**
 * Up to four faces collaged in one avatar-sized circle, as a group
 * conversation shows them (D-G-024): halves for 2, a half and two quarters
 * for 3, quarters for 4, and three faces plus a +N cell past four. The grid
 * is one image named by `label`, or by the member names. Ships from
 * `texuli/avatar` only, so the root barrel stays within its size ceiling.
 */
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue, cx } from '../../internal/cx.ts';
import { designDefaults } from '../../internal/design-defaults.ts';
import Avatar from './Avatar.svelte';
import { avatarInitials } from './initials.ts';
import type { AvatarGroupItem } from './types.ts';
import { type AvatarSize, avatarGroupClass } from './variants.ts';
import './avatar.css';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
  /** People to show (fictional names only in demos). */
  items: readonly AvatarGroupItem[];
  size?: AvatarSize;
  /** Accessible name for the image (e.g. "Launch crew"). Default: the member names. */
  label?: string;
  /** Format string for the +N cell; `{n}` is replaced with the hidden count. */
  overflowLabel?: string;
  class?: ClassValue;
};

const txDefaults = designDefaults('avatar');
let {
  items,
  size = txDefaults().size ?? 'md',
  label,
  overflowLabel = '+{n}',
  class: className,
  ref = $bindable(null),
  ...rest
}: Props = $props();

/** Four cells at most: with more members, three faces and a +N cell. */
const visible = $derived(items.slice(0, items.length > 4 ? 3 : 4));
const hiddenCount = $derived(items.length - visible.length);
const cells = $derived(visible.length + (hiddenCount > 0 ? 1 : 0));
const name = $derived(label ?? items.map((item) => item.name).join(', '));
/** A quarter cell has room for one letter. */
function quarter(index: number): boolean {
  return cells === 4 || (cells === 3 && index > 0);
}
</script>

<div
  bind:this={ref}
  class={cx(avatarGroupClass({ size }), 'tx-avatar-group--grid', className)}
  role="img"
  aria-label={name || undefined}
  data-tx-avatar-group
  data-size={size}
  data-layout="grid"
  data-count={cells}
  {...rest}
 data-tx-component="avatar-group-grid" data-tx-size={size}>
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
      >{overflowLabel.replace('{n}', String(hiddenCount))}</span
    >
  {/if}
</div>
