<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { Button } from 'texuli/button';
import { type ClassValue, cx } from 'texuli/cx';
import {
  type ChatAttachmentCheck,
  type ChatAttachmentLabels,
  DEFAULT_CHAT_ATTACHMENT_LABELS,
  runAttachmentCheck,
} from './labels.ts';

interface OwnProps {
  /** The attached artifact as received (untrusted): a blueprint, for example. */
  artifact: unknown;
  /** Visible title; `labels.attachment` when absent. */
  title?: string;
  /**
   * Validates the artifact (for example with `validateDraft` from
   * `@texuli/catalog/validate`): a value to paint, or the reasons it is refused.
   */
  check: (artifact: unknown) => ChatAttachmentCheck;
  /** Paints a validated value (for example with `Player` from `@texuli/player`). Never called for a refused one. */
  preview: Snippet<[unknown]>;
  /** Whether the preview is shown (bindable). */
  open?: boolean;
  labels?: Partial<ChatAttachmentLabels>;
  class?: ClassValue;
}
type Props = OwnProps & Omit<HTMLAttributes<HTMLElement>, keyof OwnProps | 'children'>;

const id = $props.id();
let {
  artifact,
  title,
  check,
  preview,
  open = $bindable(false),
  labels: labelOverrides = {},
  class: className,
  ...rest
}: Props = $props();

const labels = $derived({ ...DEFAULT_CHAT_ATTACHMENT_LABELS, ...labelOverrides });
const result = $derived(runAttachmentCheck(check, artifact, labels));
const titleId = `chat-attachment-${id}-title`;
const regionId = `chat-attachment-${id}-preview`;
</script>

<!-- A figure named by its caption; the preview is a disclosure, and a refused artifact is never painted. -->
<figure
  {...rest}
  class={cx('tx-chat-attachment', className)}
  aria-labelledby={titleId}
  data-tx-chat-attachment
  data-state={result.ok ? 'ready' : 'refused'}
>
  <figcaption class="tx-chat-attachment__caption">
    <span id={titleId} class="tx-chat-attachment__title">{title || labels.attachment}</span>
    {#if result.ok && result.summary}<span class="tx-chat-attachment__summary">{result.summary}</span>{/if}
  </figcaption>
  {#if result.ok}
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-expanded={open}
      aria-controls={regionId}
      onclick={() => (open = !open)}
      data-tx-chat-attachment-toggle
    >
      {open ? labels.hide : labels.show}
    </Button>
    <div id={regionId} class="tx-chat-attachment__preview" hidden={!open}>
      {#if open}{@render preview(result.value)}{/if}
    </div>
  {:else}
    <div class="tx-chat-attachment__refused" data-tx-chat-attachment-refused>
      <p class="tx-chat-attachment__refused-title">{labels.refused}</p>
      <p class="tx-chat-attachment__refused-lead">{labels.reasons}</p>
      <ul>
        {#each result.reasons as reason, index (index)}
          <li>{reason}</li>
        {/each}
      </ul>
    </div>
  {/if}
</figure>

<style>
  @layer tx.components {
    .tx-chat-attachment {
      display: grid;
      gap: var(--tx-space-2);
      margin: 0;
      border: var(--tx-border-width-thin) solid var(--tx-border, CanvasText);
      border-radius: var(--tx-shape-radius-md);
      background: var(--tx-surface, Canvas);
      color: var(--tx-foreground, CanvasText);
      padding: var(--tx-space-3);
      justify-items: start;
    }

    .tx-chat-attachment__caption {
      display: grid;
      gap: var(--tx-space-1);
    }

    .tx-chat-attachment__title {
      font-weight: 600;
    }

    .tx-chat-attachment__summary,
    .tx-chat-attachment__refused-lead {
      margin: 0;
      color: var(--tx-muted-foreground, GrayText);
      font-size: var(--tx-type-label-size);
    }

    .tx-chat-attachment__preview {
      justify-self: stretch;
      min-inline-size: 0;
      overflow: auto;
    }

    .tx-chat-attachment__refused {
      display: grid;
      gap: var(--tx-space-1);
      border-inline-start: var(--tx-border-width-thick, 3px) solid var(--tx-destructive, Mark);
      padding-inline-start: var(--tx-space-3);
    }

    .tx-chat-attachment__refused-title {
      margin: 0;
      font-weight: 600;
    }

    .tx-chat-attachment__refused ul {
      margin: 0;
      padding-inline-start: var(--tx-space-4);
    }
  }
</style>
