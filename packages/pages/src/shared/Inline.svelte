<script lang="ts">
// Inline text with marks, rendered sink-free: text interpolation only, links
// through `safeHref` at the untrusted tier with `rel` set and no `target`.
import { safeHref } from '@texuli/core/url-policy';
import type { DocumentInline, DocumentMark } from '@texuli/document/model';

let { content }: { content: readonly DocumentInline[] } = $props();
</script>

{#snippet wrap(text: string, marks: readonly DocumentMark[], index: number)}
  {@const mark = marks[index]}
  {#if !mark}{text}{:else if mark.type === 'link'}
    {@const href = safeHref(mark.href, 'untrusted')}
    {#if href}<a class="tx-pages-link" {href} rel="noopener noreferrer nofollow">{@render wrap(text, marks, index + 1)}</a>{:else}{@render wrap(text, marks, index + 1)}{/if}
  {:else if mark.type === 'strong'}<strong>{@render wrap(text, marks, index + 1)}</strong>
  {:else if mark.type === 'em'}<em>{@render wrap(text, marks, index + 1)}</em>
  {:else if mark.type === 'strike'}<s>{@render wrap(text, marks, index + 1)}</s>
  {:else if mark.type === 'code'}<code class="tx-pages-code-inline">{@render wrap(text, marks, index + 1)}</code>
  {:else}{@render wrap(text, marks, index + 1)}{/if}
{/snippet}

{#each content as part, index (index)}{#if part.type === 'break'}<br />{:else}{@render wrap(part.text, part.marks, 0)}{/if}{/each}
