<script lang="ts">
import { safeHref } from '@texuli/core/url-policy';
import { getContext, type Snippet } from 'svelte';
import type { HTMLLiAttributes } from 'svelte/elements';
import { DEFAULT_TIMELINE_MESSAGES, TIMELINE_CONTEXT, type TimelineContext } from './types.ts';
import { type TimelineStatus, type TimelineTone, timelineItemClass } from './variants.ts';
import './timeline.css';

type Props = Omit<HTMLLiAttributes, 'title'> & {
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
  title: string;
  /** Visible time label, e.g. "Mar 4". */
  time?: string;
  /** Machine-readable value for `<time datetime>`. */
  datetime?: string;
  description?: string;
  /** Makes the title a link after the URL policy (the timeline's `hrefTrust`). */
  href?: string;
  tone?: TimelineTone;
  status?: TimelineStatus;
  /** Replaces the marker's dot or check with your icon (decorative). */
  icon?: Snippet;
  /** Extra content under the description. */
  children?: Snippet;
};

let {
  title,
  time,
  datetime,
  description,
  href,
  tone = 'default',
  status,
  icon,
  children,
  class: className,
  ref = $bindable(null),
  ...rest
}: Props = $props();

const context = getContext<TimelineContext | undefined>(TIMELINE_CONTEXT);
const messages = $derived(context?.messages ?? DEFAULT_TIMELINE_MESSAGES);
const link = $derived(href ? safeHref(href, context?.hrefTrust ?? 'developer') : undefined);
</script>

<li
  bind:this={ref}
  class={timelineItemClass({ tone, class: className })}
  data-tx-timeline-item
  data-tone={tone}
  data-status={status}
  aria-current={status === 'current' ? 'step' : undefined}
  {...rest}
>
  <span class="tx-timeline__marker" aria-hidden="true">
    {#if icon}
      {@render icon()}
    {:else if status === 'complete'}
      <svg viewBox="0 0 12 12" width="10" height="10" focusable="false">
        <path
          d="M2.5 6.5l2.2 2.2L9.5 3.8"
          fill="none"
          stroke="currentColor"
          stroke-width="1.75"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    {/if}
  </span>
  <div class="tx-timeline__content">
    {#if time}
      <time class="tx-timeline__time" {datetime}>{time}</time>
    {/if}
    <p class="tx-timeline__title">
      {#if link}<a class="tx-timeline__link" href={link}>{title}</a>{:else}{title}{/if}{#if status}<span
          class="tx-timeline__sr-only">, {messages[status]}</span
        >{/if}
    </p>
    {#if description}
      <p class="tx-timeline__description">{description}</p>
    {/if}
    {@render children?.()}
  </div>
</li>
