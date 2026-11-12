<script lang="ts">
import { safeImageSrc } from '@texuli/core/url-policy';
import { onMount } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { EmojiArtResolver } from './art.ts';
import { isSanitizedEmojiSvg } from './art.ts';
import './emoji.css';

type Props = HTMLAttributes<HTMLElement> & {
  id: string;
  label?: string;
  decorative?: boolean;
  artResolver?: EmojiArtResolver;
  ref?: HTMLElement | null;
};

let {
  id,
  label,
  decorative = false,
  artResolver,
  ref = $bindable(null),
  class: className,
  ...rest
}: Props = $props();
let record = $state<{ id: string; name: string; unicode: string } | undefined>();
onMount(async () => {
  if (decorative || label) return;
  const catalog = await import('@texuli/emojis/catalog');
  record = catalog.getEmoji(id);
});
const accessibleName = $derived(label ?? record?.name ?? id);
const art = $derived(artResolver?.(record?.id ?? id));
const imageSrc = $derived(art?.kind === 'image' ? safeImageSrc(art.src, 'developer') : undefined);
const svg = $derived(art?.kind === 'svg' && isSanitizedEmojiSvg(art.svg) ? art.svg : undefined);

function unicodeFromId(value: string): string {
  if (!/^[\da-f]+(?:-[\da-f]+)*$/i.test(value)) return value;
  const points = value.split('-').map((point) => Number.parseInt(point, 16));
  if (points.some((point) => point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff)))
    return value;
  try {
    return String.fromCodePoint(...points);
  } catch {
    return value;
  }
}
</script>

<span
  bind:this={ref}
  class={['tx-emoji', className]}
  role={decorative ? undefined : 'img'}
  aria-label={decorative ? undefined : accessibleName}
  aria-hidden={decorative ? 'true' : undefined}
  data-tx-emoji
  {...rest as HTMLAttributes<HTMLElement>}
>
  {#if imageSrc}
    <img class="tx-emoji__art" src={imageSrc} alt="" decoding="async" />
  {:else if svg}
    <svg class="tx-emoji__art" viewBox={svg.viewBox} aria-hidden="true" focusable="false">
      {#each svg.paths as path, index (`${index}-${path.d}`)}
        <path d={path.d} fill={path.fill} />
      {/each}
    </svg>
  {:else}
    <span aria-hidden="true">{record?.unicode ?? unicodeFromId(id)}</span>
  {/if}
</span>
