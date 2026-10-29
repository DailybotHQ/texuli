<script lang="ts">
import { safeImageSrc } from '@texuli/core/url-policy';
import BlockIcon from '../icons/BlockIcon.svelte';
import { resolveBlockMediaSrc } from '../media/resolve.ts';
import { checkTextBlock } from './check.ts';
import type { TextBlockViewProps } from './family.ts';
import { resolveTextBlockLabels } from './labels.ts';
import RichText from './RichText.svelte';

/**
 * The text family renderer: heading, text (paragraphs and rich text), list,
 * quote and callout. It takes untrusted data and renders only what
 * `checkTextBlock` accepts; anything else becomes an inert notice.
 */
let { block, labels, resolveAvatar, resolveIcon, oninvalid }: TextBlockViewProps = $props();

const check = $derived(checkTextBlock(block));
const text = $derived(resolveTextBlockLabels(labels));

$effect(() => {
  if (!check.ok) oninvalid?.(check.issues);
});

/**
 * A quote portrait: the block media policy already refused remote URLs at
 * parse time; the resolved source (the host's avatar URL, a data image or a
 * relative path) passes the image URL policy again before it paints.
 */
const avatarSrc = (source: string | undefined) => {
  if (source === undefined) return undefined;
  const resolved = resolveBlockMediaSrc(source, 'image', resolveAvatar);
  return resolved === undefined ? undefined : safeImageSrc(resolved, 'developer');
};
</script>

{#if !check.ok}
  <p class="tx-block tx-block-invalid" role="note" data-tx-block="invalid">{text.invalid}</p>
{:else}
  {@const b = check.block}
  {#if b.type === 'heading'}
    <hgroup class="tx-block tx-heading" data-tx-block="heading" data-tone={b.tone} data-align={b.align}>
      {#if b.eyebrow}<p class="tx-heading-eyebrow">{b.eyebrow}</p>{/if}
      <svelte:element this={`h${b.level}`} class="tx-heading-title" id={b.id}>{b.text}</svelte:element>
      {#if b.subtitle}<p class="tx-heading-subtitle">{b.subtitle}</p>{/if}
    </hgroup>
  {:else if b.type === 'text'}
    <div
      class="tx-block tx-text"
      data-tx-block="text"
      data-tone={b.tone}
      data-size={b.size}
      data-align={b.align}
    >
      <RichText source={b.markdown} labels={text} />
    </div>
  {:else if b.type === 'list'}
    {@const marker = b.style ?? (b.ordered ? 'number' : 'bullet')}
    <svelte:element
      this={marker === 'number' ? 'ol' : 'ul'}
      class="tx-block tx-list"
      data-tx-block="list"
      data-tone={b.tone}
      data-style={marker}
    >
      {#each b.items as item, i (i)}
        <li data-done={marker === 'check' ? String(item.done === true) : undefined}>
          {#if marker === 'check'}<input
              type="checkbox"
              class="tx-list-check"
              checked={item.done === true}
              disabled
              aria-label={item.done ? text.taskDone : text.taskOpen}
            />{:else if marker === 'icon'}<BlockIcon name={item.icon} {resolveIcon} class="tx-list-icon" />{/if}
          <RichText source={item.text} compact labels={text} />
        </li>
      {/each}
    </svelte:element>
  {:else if b.type === 'quote'}
    {@const portrait = avatarSrc(b.avatar)}
    <figure class="tx-block tx-quote" data-tx-block="quote" data-tone={b.tone}>
      <blockquote class="tx-quote-body"><RichText source={b.quote} labels={text} /></blockquote>
      {#if b.cite || b.role || portrait}
        <figcaption class="tx-quote-cite">
          {#if portrait}<img
              class="tx-quote-avatar"
              src={portrait}
              alt=""
              width="40"
              height="40"
              loading="lazy"
              decoding="async"
              referrerpolicy="no-referrer"
            />{/if}
          <span class="tx-quote-attribution"
            >{#if b.cite}<cite>{b.cite}</cite>{/if}{#if b.role}<span class="tx-quote-role"
                >{b.cite ? ', ' : ''}{b.role}</span
              >{/if}</span
          >
        </figcaption>
      {/if}
    </figure>
  {:else}
    {@const tone = b.tone ?? 'neutral'}
    <div class="tx-block tx-callout" role="note" data-tx-block="callout" data-tone={tone}>
      {#if text.tones[tone] || b.title || b.icon}
        <p class="tx-callout-head">
          <BlockIcon name={b.icon} {resolveIcon} class="tx-callout-icon" />
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
   * Tone colors mark borders and rules only (non-text, 3:1 against both light
   * and dark surfaces); a callout fills with the role's soft surface and reads
   * in its paired soft foreground. The accent tone draws with `--tx-primary`:
   * `--tx-accent` is itself a soft fill and vanishes as a border. Tokens use the contract names the
   * token engine emits (`--tx-<role>`); the hex fallbacks only paint for a
   * host that loads no theme and reach 3:1 on white and #121212 (pinned by
   * text.test.ts).
   */
  [data-tone='accent'] {
    --tx-block-tone: var(--tx-primary, #7c3aed);
    --tx-block-soft: var(--tx-primary-soft, color-mix(in srgb, #7c3aed 12%, Canvas));
    --tx-block-soft-foreground: var(--tx-primary-soft-foreground, var(--tx-foreground, CanvasText));
  }
  [data-tone='info'] {
    --tx-block-tone: var(--tx-info, #2563eb);
    --tx-block-soft: var(--tx-info-soft, color-mix(in srgb, #2563eb 12%, Canvas));
    --tx-block-soft-foreground: var(--tx-info-soft-foreground, var(--tx-foreground, CanvasText));
  }
  [data-tone='success'] {
    --tx-block-tone: var(--tx-success, #16a34a);
    --tx-block-soft: var(--tx-success-soft, color-mix(in srgb, #16a34a 12%, Canvas));
    --tx-block-soft-foreground: var(--tx-success-soft-foreground, var(--tx-foreground, CanvasText));
  }
  [data-tone='warning'] {
    --tx-block-tone: var(--tx-warning, #d97706);
    --tx-block-soft: var(--tx-warning-soft, color-mix(in srgb, #d97706 12%, Canvas));
    --tx-block-soft-foreground: var(--tx-warning-soft-foreground, var(--tx-foreground, CanvasText));
  }
  [data-tone='danger'] {
    --tx-block-tone: var(--tx-destructive, #dc2626);
    --tx-block-soft: var(--tx-destructive-soft, color-mix(in srgb, #dc2626 12%, Canvas));
    --tx-block-soft-foreground: var(--tx-destructive-soft-foreground, var(--tx-foreground, CanvasText));
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
  .tx-text[data-size='sm'] {
    font-size: 0.875em;
  }
  .tx-text[data-size='lg'] {
    font-size: 1.1875em;
  }
  .tx-heading[data-align='center'],
  .tx-text[data-align='center'] {
    text-align: center;
  }

  .tx-list {
    padding-inline-start: 1.5em;
    line-height: 1.6;
  }
  .tx-list > li + li {
    margin-block-start: 0.375em;
  }
  .tx-list[data-style='check'],
  .tx-list[data-style='icon'] {
    padding-inline-start: 0;
    list-style: none;
  }
  .tx-list[data-style='check'] > li,
  .tx-list[data-style='icon'] > li {
    display: flex;
    gap: 0.5em;
    align-items: baseline;
  }
  .tx-list-check {
    flex: none;
    margin: 0;
    accent-color: var(--tx-block-tone);
  }
  .tx-list :global(.tx-list-icon) {
    flex: none;
    align-self: center;
    color: var(--tx-block-tone);
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
  .tx-quote-cite {
    display: flex;
    gap: 0.625em;
    align-items: center;
  }
  .tx-quote-cite cite {
    font-style: normal;
    font-weight: 600;
  }
  .tx-quote-role {
    color: var(--tx-muted-foreground, inherit);
  }
  .tx-quote-avatar {
    flex: none;
    inline-size: 2.5em;
    block-size: 2.5em;
    border-radius: 50%;
    object-fit: cover;
  }

  .tx-callout {
    padding-block: 0.75em;
    padding-inline: 1em;
    border: 1px solid var(--tx-block-tone);
    border-inline-start: 4px solid var(--tx-block-tone);
    border-radius: var(--tx-radius, 0.5em);
    background: var(--tx-block-soft, transparent);
    color: var(--tx-block-soft-foreground, inherit);
  }
  .tx-callout-head {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5em;
    align-items: baseline;
    margin: 0 0 0.375em;
  }
  .tx-callout-head :global(.tx-callout-icon) {
    align-self: center;
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
      background: Canvas;
      color: CanvasText;
    }
  }
</style>
