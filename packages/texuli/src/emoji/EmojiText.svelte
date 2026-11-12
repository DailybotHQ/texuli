<script lang="ts">
import { parseEmojiTokens } from '@texuli/emojis';
import type { HTMLAttributes } from 'svelte/elements';
import type { EmojiArtResolver } from './art.ts';
import Emoji from './Emoji.svelte';
import './emoji.css';

type Props = HTMLAttributes<HTMLElement> & {
  text: string;
  decorative?: boolean;
  artResolver?: EmojiArtResolver;
  ref?: HTMLElement | null;
};
let {
  text,
  decorative = false,
  artResolver,
  ref = $bindable(null),
  class: className,
  ...rest
}: Props = $props();
const tokens = $derived(parseEmojiTokens(text));
</script>

<span bind:this={ref} class={['tx-emoji-text', className]} data-tx-emoji-text {...rest as HTMLAttributes<HTMLElement>}>
  {#each tokens as token, index (`${token.start}-${token.end}-${index}`)}
    {#if token.type === 'text'}
      {token.text}
    {:else}
      {#if artResolver}
        <Emoji id={token.id} label={token.unicode} {decorative} {artResolver} />
      {:else}
        <span aria-hidden={decorative ? 'true' : undefined}>{token.unicode}</span>
      {/if}
    {/if}
  {/each}
</span>
