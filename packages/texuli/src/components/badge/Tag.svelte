<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';
import { useMessages } from '../../i18n/use-messages.ts';
import { type BadgeVariant, tagClass } from './variants.ts';
import './badge.css';

type Props = HTMLAttributes<HTMLSpanElement> & {
  /** Visible label (required word; never color alone). */
  label: string;
  variant?: BadgeVariant;
  /**
   * Accessible name of the remove button, which always names the tag.
   * A string is a template: `{label}` is replaced by the tag's label, and a
   * string without it gets the label appended (`'Remove'` → "Remove Design")
   * unless it already contains the label.
   * A function receives the label and returns the whole name, for
   * translations that place the label elsewhere. Default: "Remove {label}".
   */
  removeLabel?: string | ((label: string) => string);
  /** When set, shows a remove button that calls this (may return a promise). */
  onRemove?: () => unknown | Promise<unknown>;
  disabled?: boolean;
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
};

let {
  ref = $bindable(null),
  label,
  variant = 'secondary',
  removeLabel: removeLabelProp,
  onRemove,
  disabled = false,
  class: className,
  ...rest
}: Props = $props();
const msg = useMessages();
const removeLabel = $derived(removeLabelProp ?? msg('texuli.tag.remove-label', 'Remove {label}'));

let pending = $state(false);

const removeName = $derived(tagRemoveName(removeLabel, label));

function tagRemoveName(template: string | ((label: string) => string), tag: string): string {
  if (typeof template === 'function') return template(tag);
  if (template.includes('{label}')) return template.replaceAll('{label}', tag);
  // A name that already names the tag is used as is.
  if (tag !== '' && template.includes(tag)) return template;
  return `${template} ${tag}`.trim();
}

async function remove(): Promise<void> {
  if (!onRemove || disabled || pending) return;
  pending = true;
  try {
    await Promise.resolve(onRemove());
  } finally {
    pending = false;
  }
}
</script>

<span bind:this={ref}
  class={tagClass({ variant, class: className })}
  data-tx-tag
  data-variant={variant}
  {...rest}
>
  <span class="tx-tag__label">{label}</span>
  {#if onRemove}
    <button
      type="button"
      class="tx-tag__remove"
      aria-label={removeName}
      disabled={disabled || pending}
      aria-busy={pending ? 'true' : undefined}
      onclick={() => void remove()}
      data-tx-tag-remove
    >
      <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
        <path
          d="M3 3l6 6M9 3L3 9"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        />
      </svg>
    </button>
  {/if}
</span>
