<script lang="ts">
import type { HrefTrust } from '@texuli/core/url-policy';
import { type Snippet, setContext } from 'svelte';
import type { HTMLOlAttributes } from 'svelte/elements';
import TimelineItem from './TimelineItem.svelte';
import {
  DEFAULT_TIMELINE_MESSAGES,
  TIMELINE_CONTEXT,
  type TimelineContext,
  type TimelineItemData,
  type TimelineMessages,
} from './types.ts';
import { type TimelineOrientation, timelineClass } from './variants.ts';
import './timeline.css';

type Props = Omit<HTMLOlAttributes, 'children'> & {
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
  /** Data-driven items. Or compose `<TimelineItem>` children instead. */
  items?: readonly TimelineItemData[];
  orientation?: TimelineOrientation;
  /** The list's accessible name (default: `messages.label`, "Timeline"). */
  label?: string;
  /** Translations for the label and the spoken status words. */
  messages?: Partial<TimelineMessages>;
  /** URL policy tier for item links: `developer` (app-authored) or `untrusted` (agent or user content). */
  hrefTrust?: HrefTrust;
  /** Extra content inside each data-driven item, under its description. */
  item?: Snippet<[TimelineItemData, number]>;
  children?: Snippet;
};

let {
  items,
  orientation = 'vertical',
  label,
  messages: overrides,
  hrefTrust = 'developer',
  item,
  children,
  class: className,
  ref = $bindable(null),
  ...rest
}: Props = $props();

const context: TimelineContext = $state({
  messages: { ...DEFAULT_TIMELINE_MESSAGES },
  hrefTrust: 'developer',
});
$effect.pre(() => {
  context.messages = { ...DEFAULT_TIMELINE_MESSAGES, ...stringsOnly(overrides) };
  context.hrefTrust = hrefTrust;
});
setContext(TIMELINE_CONTEXT, context);

function stringsOnly(input: Partial<TimelineMessages> | undefined): Partial<TimelineMessages> {
  const out: Partial<TimelineMessages> = {};
  for (const key of Object.keys(DEFAULT_TIMELINE_MESSAGES) as (keyof TimelineMessages)[]) {
    const value = input?.[key];
    if (typeof value === 'string' && value.trim()) out[key] = value;
  }
  return out;
}

const horizontal = $derived(orientation === 'horizontal');
</script>

<!-- A horizontal timeline scrolls sideways: it takes focus so the keyboard can scroll it. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<ol
  bind:this={ref}
  class={timelineClass({ orientation, class: className })}
  data-tx-timeline
  data-orientation={orientation}
  aria-label={label ?? context.messages.label}
  tabindex={horizontal ? 0 : undefined}
  {...rest}
>
  {#if items}
    {#each items as entry, index (entry.id ?? index)}
      <TimelineItem
        title={entry.title}
        time={entry.time}
        datetime={entry.datetime}
        description={entry.description}
        href={entry.href}
        tone={entry.tone}
        status={entry.status}
      >
        {#if item}{@render item(entry, index)}{/if}
      </TimelineItem>
    {/each}
  {/if}
  {@render children?.()}
</ol>
