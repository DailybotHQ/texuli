<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { useMessages } from '../../i18n/use-messages.ts';
import { type ClassValue, cx } from '../../internal/cx.ts';
import { Button } from '../button/index.ts';
import ToneIcon from './ToneIcon.svelte';
import { type AlertLayout, type AlertTone, alertRole, alertSurfaceClass } from './tones.ts';
import './alert.css';

type Props = HTMLAttributes<HTMLDivElement> & {
  layout?: AlertLayout;
  tone?: AlertTone;
  title?: string;
  text?: string;
  /** Hide the default tone glyph. */
  hideIcon?: boolean;
  /** Custom icon snippet (replaces the default glyph). */
  icon?: Snippet;
  actionLabel?: string;
  /** Filtered through Button's URL policy (developer trust by default). */
  actionHref?: string | null;
  /** May return a promise; Button shows pending until it settles. */
  onAction?: () => unknown | Promise<unknown>;
  dismissible?: boolean;
  /** Accessible name for the dismiss control. */
  dismissLabel?: string;
  onDismiss?: () => void;
  children?: Snippet;
  class?: ClassValue;
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
};

let {
  layout = 'alert',
  tone = 'info',
  title,
  text,
  hideIcon = false,
  icon,
  actionLabel,
  actionHref,
  onAction,
  dismissible = false,
  dismissLabel: dismissLabelProp,
  onDismiss,
  children,
  class: className,
  ref = $bindable(null),
  ...rest
}: Props = $props();
const msg = useMessages();
const dismissLabel = $derived(
  dismissLabelProp ?? msg('texuli.alert-surface.dismiss-label', 'Dismiss')
);

const role = $derived(alertRole(tone));
const classes = $derived(
  alertSurfaceClass({
    layout,
    tone,
    class: className,
  })
);
const showAction = $derived(Boolean(actionLabel && (onAction || actionHref)));
</script>

<div
  bind:this={ref}
  {role}
  class={cx(classes)}
  data-tx-alert=""
  data-tx-layout={layout}
  data-tx-tone={tone}
  {...rest}
>
  <div class="tx-alert__row">
    {#if !hideIcon}
      <span class="tx-alert__icon">
        {#if icon}
          {@render icon()}
        {:else}
          <ToneIcon {tone} />
        {/if}
      </span>
    {/if}
    <div class="tx-alert__body">
      {#if title}
        <p class="tx-alert__title">{title}</p>
      {/if}
      {#if text}
        <p class="tx-alert__text">{text}</p>
      {/if}
      {#if children}
        <div class="tx-alert__content">{@render children()}</div>
      {/if}
    </div>
    {#if dismissible}
      <button type="button" class="tx-alert__dismiss" aria-label={dismissLabel} onclick={() => onDismiss?.()}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" stroke-linecap="round" />
        </svg>
      </button>
    {/if}
  </div>
  {#if showAction}
    <div class="tx-alert__actions">
      <Button
        variant="link"
        size="sm"
        href={actionHref}
        onclick={onAction ? () => onAction() : undefined}
      >
        {actionLabel}
      </Button>
    </div>
  {/if}
</div>
