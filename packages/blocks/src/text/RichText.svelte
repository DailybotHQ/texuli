<script lang="ts">
import { safeHref } from '@texuli/core';
import { DEFAULT_TEXT_BLOCK_LABELS, type TextBlockLabels } from './labels.ts';
import { headingLevels, type MdBlock, type MdInline, parseMarkdown } from './markdown.ts';

/**
 * Renders block Markdown through the owned closed subset (`markdown.ts`).
 * Text interpolation only: no HTML sink, and every href passes `safeHref`
 * again here. Markdown headings are relative: the top level in the source
 * maps to `headingBase` (h3 by default) and deeper levels follow without
 * gaps, so author text cannot outrank heading blocks or skip levels.
 */
let {
  source,
  compact = false,
  headingBase = 3,
  labels = DEFAULT_TEXT_BLOCK_LABELS,
}: {
  source: string;
  /** Unwraps a lone paragraph so list items and captions stay inline. */
  compact?: boolean;
  /** Heading level the source's top Markdown heading renders as (1–6). */
  headingBase?: number;
  labels?: TextBlockLabels;
} = $props();

const tree = $derived(parseMarkdown(source));
const lone = $derived(
  compact && tree.blocks.length === 1 && tree.blocks[0]?.type === 'paragraph'
    ? tree.blocks[0].children
    : null
);
const levels = $derived(headingLevels(tree.blocks));
const headingTag = (level: number) => {
  const base = Math.min(6, Math.max(1, Math.trunc(headingBase) || 3));
  return `h${Math.min(6, base + levels.indexOf(level))}`;
};
const absolute = (href: string) => /^(?:https?:|mailto:)/i.test(href);
const emphasisTag = (type: 'strong' | 'em' | 'del') => type;
</script>

{#snippet inline(nodes: MdInline[])}
  {#each nodes as node, i (i)}
    {#if node.type === 'text'}{node.text}{:else if node.type === 'break'}<br />{:else if node.type === 'code'}<code class="tx-md-code">{node.text}</code>{:else if node.type === 'link'}{@const href = safeHref(node.href)}{#if href}<a
          {href}
          class="tx-md-link"
          rel={absolute(href) ? 'noopener noreferrer nofollow' : undefined}>{@render inline(node.children)}</a
        >{:else}{@render inline(node.children)}{/if}{:else}<svelte:element this={emphasisTag(node.type)}>{@render inline(node.children)}</svelte:element>{/if}
  {/each}
{/snippet}

{#snippet blocks(items: MdBlock[])}
  {#each items as item, i (i)}
    {#if item.type === 'paragraph'}
      <p>{@render inline(item.children)}</p>
    {:else if item.type === 'heading'}
      <svelte:element this={headingTag(item.level)} class="tx-md-heading">{@render inline(item.children)}</svelte:element>
    {:else if item.type === 'code'}
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -- a scrollable fence needs keyboard access. -->
      <pre class="tx-md-pre" tabindex="0" aria-label={labels.codeBlock} data-lang={item.lang}><code>{item.text}</code></pre>
    {:else if item.type === 'list'}
      <svelte:element
        this={item.ordered ? 'ol' : 'ul'}
        class="tx-md-list"
        start={item.ordered && item.start !== 1 ? item.start : undefined}
      >
        {#each item.items as entry, j (j)}
          <li class:tx-md-task={entry.checked !== null}>
            {#if entry.checked !== null}<input
                type="checkbox"
                class="tx-md-check"
                checked={entry.checked}
                disabled
                aria-label={entry.checked ? labels.taskDone : labels.taskOpen}
              />{/if}
            {#if entry.children.length === 1 && entry.children[0]?.type === 'paragraph'}{@render inline(
                entry.children[0].children
              )}{:else}{@render blocks(entry.children)}{/if}
          </li>
        {/each}
      </svelte:element>
    {:else if item.type === 'quote'}
      <blockquote class="tx-md-quote">{@render blocks(item.children)}</blockquote>
    {:else}
      <hr class="tx-md-rule" />
    {/if}
  {/each}
{/snippet}

{#if lone}{@render inline(lone)}{:else}<div class="tx-md">{@render blocks(tree.blocks)}</div>{/if}

<style>
  .tx-md {
    overflow-wrap: anywhere;
  }
  .tx-md > :global(* + *),
  .tx-md :global(li > * + *),
  .tx-md :global(blockquote > * + *) {
    margin-block-start: 0.75em;
  }
  .tx-md :global(p),
  .tx-md :global(.tx-md-heading),
  .tx-md :global(.tx-md-list),
  .tx-md :global(.tx-md-quote),
  .tx-md :global(.tx-md-pre) {
    margin-block-end: 0;
  }
  .tx-md > :global(:first-child) {
    margin-block-start: 0;
  }
  .tx-md-heading {
    font-weight: 600;
    line-height: 1.3;
  }
  .tx-md-list {
    padding-inline-start: 1.5em;
  }
  .tx-md-task {
    list-style: none;
    margin-inline-start: -1.5em;
  }
  .tx-md-check {
    margin-inline-end: 0.5em;
    vertical-align: middle;
  }
  .tx-md-quote {
    margin-inline: 0;
    padding-inline-start: 1em;
    border-inline-start: 3px solid var(--tx-border-strong, currentColor);
  }
  .tx-md-code,
  .tx-md-pre {
    font-family: var(--tx-font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
    font-size: 0.9em;
  }
  .tx-md-code {
    padding-inline: 0.25em;
    border-radius: var(--tx-radius, 0.25em);
    background: var(--tx-muted, color-mix(in srgb, currentColor 10%, transparent));
  }
  .tx-md-pre {
    overflow-x: auto;
    padding: 0.75em 1em;
    border: 1px solid var(--tx-border, color-mix(in srgb, currentColor 30%, transparent));
    border-radius: var(--tx-radius, 0.375em);
    white-space: pre;
  }
  .tx-md-pre:focus-visible,
  .tx-md-link:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  /* Link color stays the host's (or the UA's); the underline marks links in every scheme. */
  .tx-md-link {
    text-decoration: underline;
    text-underline-offset: 0.2em;
  }
  .tx-md-rule {
    border: 0;
    border-block-start: 1px solid var(--tx-border, color-mix(in srgb, currentColor 40%, transparent));
  }
  @media (forced-colors: active) {
    .tx-md-quote,
    .tx-md-pre,
    .tx-md-rule {
      border-color: CanvasText;
    }
  }
</style>
