<script lang="ts">
import { checkTextBlock } from './check.ts';
import type { TextBlockViewProps } from './family.ts';
import { resolveTextBlockLabels } from './labels.ts';
import RichText from './RichText.svelte';

/**
 * The text family renderer: heading, text (paragraphs and rich text), list,
 * quote and callout. It takes untrusted data and renders only what
 * `checkTextBlock` accepts; anything else becomes an inert notice.
 */
let { block, labels, oninvalid }: TextBlockViewProps = $props();

const check = $derived(checkTextBlock(block));
const text = $derived(resolveTextBlockLabels(labels));

$effect(() => {
  if (!check.ok) oninvalid?.(check.issues);
});
</script>

{#if !check.ok}
  <p class="tx-block tx-block-invalid" role="note" data-tx-block="invalid">{text.invalid}</p>
{:else}
  {@const b = check.block}
  {#if b.type === 'heading'}
    <hgroup class="tx-block tx-heading" data-tx-block="heading" data-tone={b.tone}>
      {#if b.eyebrow}<p class="tx-heading-eyebrow">{b.eyebrow}</p>{/if}
      <svelte:element this={`h${b.level}`} class="tx-heading-title" id={b.id}>{b.text}</svelte:element>
      {#if b.subtitle}<p class="tx-heading-subtitle">{b.subtitle}</p>{/if}
    </hgroup>
  {:else if b.type === 'text'}
    <div class="tx-block tx-text" data-tx-block="text" data-tone={b.tone}>
      <RichText source={b.markdown} labels={text} />
    </div>
  {:else if b.type === 'list'}
    <svelte:element
      this={b.ordered ? 'ol' : 'ul'}
      class="tx-block tx-list"
      data-tx-block="list"
      data-tone={b.tone}
    >
      {#each b.items as item, i (i)}
        <li><RichText source={item.text} compact labels={text} /></li>
      {/each}
    </svelte:element>
  {:else if b.type === 'quote'}
    <figure class="tx-block tx-quote" data-tx-block="quote" data-tone={b.tone}>
      <blockquote class="tx-quote-body"><RichText source={b.quote} labels={text} /></blockquote>
      {#if b.cite}<figcaption class="tx-quote-cite"><cite>{b.cite}</cite></figcaption>{/if}
    </figure>
  {:else}
    {@const tone = b.tone ?? 'neutral'}
    <div class="tx-block tx-callout" role="note" data-tx-block="callout" data-tone={tone}>
      {#if text.tones[tone] || b.title}
        <p class="tx-callout-head">
          {#if text.tones[tone]}<span class="tx-callout-tone">{text.tones[tone]}</span>{/if}
          {#if b.title}<strong class="tx-callout-title">{b.title}</strong>{/if}
        </p>
      {/if}
      <div class="tx-callout-body"><RichText source={b.body} labels={text} /></div>
    </div>
  {/if}
{/if}

<style>
  .tx-block {
    --tx-block-tone: var(--tx-border-strong, currentColor);
    margin: 0;
    overflow-wrap: anywhere;
  }
  /*
   * Tone colors mark borders and tints only (non-text, 3:1 against both light
   * and dark surfaces); tone text inherits the page color, so a callout reads
   * at the host's contrast in any scheme. Tokens use the contract names the
   * token engine emits (`--tx-<role>`); the hex fallbacks only paint for a
   * host that loads no theme and reach 3:1 on white and #121212 (pinned by
   * text.test.ts).
   */
  [data-tone='accent'] {
    --tx-block-tone: var(--tx-accent, #7c3aed);
  }
  [data-tone='info'] {
    --tx-block-tone: var(--tx-info, #2563eb);
  }
  [data-tone='success'] {
    --tx-block-tone: var(--tx-success, #16a34a);
  }
  [data-tone='warning'] {
    --tx-block-tone: var(--tx-warning, #d97706);
  }
  [data-tone='danger'] {
    --tx-block-tone: var(--tx-destructive, #dc2626);
  }

  .tx-heading-eyebrow {
    margin: 0 0 0.25em;
    font-size: 0.8125rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .tx-heading-title {
    margin: 0;
    font-weight: 650;
    line-height: 1.2;
    text-wrap: balance;
  }
  .tx-heading-subtitle {
    margin: 0.5em 0 0;
    font-size: 1.125rem;
  }

  .tx-text {
    line-height: 1.6;
  }

  .tx-list {
    padding-inline-start: 1.5em;
    line-height: 1.6;
  }
  .tx-list > li + li {
    margin-block-start: 0.375em;
  }

  .tx-quote {
    padding-inline-start: 1em;
    border-inline-start: 3px solid var(--tx-block-tone);
  }
  .tx-quote-body {
    margin: 0;
    font-size: 1.125em;
    font-style: italic;
  }
  .tx-quote-cite {
    margin-block-start: 0.5em;
  }
  .tx-quote-cite cite {
    font-style: normal;
    font-weight: 600;
  }

  .tx-callout {
    padding-block: 0.75em;
    padding-inline: 1em;
    border: 1px solid color-mix(in srgb, var(--tx-block-tone) 45%, transparent);
    border-inline-start: 4px solid var(--tx-block-tone);
    border-radius: var(--tx-radius, 0.5em);
    background: color-mix(in srgb, var(--tx-block-tone) 8%, transparent);
  }
  .tx-callout-head {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5em;
    align-items: baseline;
    margin: 0 0 0.375em;
  }
  .tx-callout-tone {
    font-size: 0.8125em;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .tx-block-invalid {
    padding: 0.5em 0.75em;
    border: 1px dashed currentColor;
    border-radius: var(--tx-radius, 0.375em);
    font-size: 0.875em;
  }

  @media (forced-colors: active) {
    .tx-block {
      --tx-block-tone: CanvasText;
    }
    .tx-callout {
      border-color: CanvasText;
    }
  }
</style>
