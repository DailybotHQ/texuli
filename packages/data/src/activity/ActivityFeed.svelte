<script lang="ts" generics="T extends ActivityItem">
import type { Snippet } from 'svelte';
import { tick } from 'svelte';
import { Avatar } from 'texuli/avatar';
import { type ClassValue, cx } from 'texuli/cx';
import { type DayGroup, groupByDay, whenLabel } from '../engines/activity/days.ts';
import {
  type ActivitySegment,
  type MentionLookups,
  plainText,
  tokenize,
} from '../engines/activity/mentions.ts';
import {
  ACTIVITY_KINDS,
  type ActivityFilter,
  type ActivityItem,
  type ActivityKind,
  filterActivity,
  sortActivity,
} from '../engines/activity/summary.ts';
import { toggleReaction } from '../engines/activity/threads.ts';
import {
  createInfiniteLoader,
  type InfiniteLoaderStatus,
} from '../virtual-list/infinite-loader.ts';
import {
  DEFAULT_PAGE_SIZE,
  DEFAULT_REACTION_EMOJIS,
  kindVerb,
  pageItems,
  reactionChips,
} from './model.ts';
import type { ActivityFeedLabels } from './types.ts';

interface ActivityFeedProps<T extends ActivityItem> {
  items: readonly T[];
  /** Runtime clock instant (tests/stories pass a fixed value). */
  now: string | number | Date;
  timeZone?: string;
  locale?: string;
  /** Resolve actor display name (defaults to actorId). */
  getActorName?: (item: T) => string;
  /** Optional avatar image URL (URL policy inside Avatar). */
  getActorSrc?: (item: T) => string | undefined | null;
  /** Current persona for reaction toggling. */
  personaId?: string;
  /** Reactions keyed by activity id. */
  reactions?:
    | ReadonlyMap<string, Record<string, readonly string[]>>
    | Record<string, Record<string, readonly string[]>>;
  onReactionToggle?: (
    item: T,
    emoji: string,
    next: Record<string, string[]>
  ) => void | Promise<void>;
  reactionEmojis?: readonly string[];
  /** Mention / record lookups for comment bodies. */
  mentions?: MentionLookups;
  filter?: ActivityFilter;
  onFilterChange?: (filter: ActivityFilter) => void;
  /** Show kind filter chips. */
  filterable?: boolean;
  pageSize?: number;
  /** Host-driven infinite load (appends into `items`). */
  onLoadMore?: () => Promise<void>;
  hasMore?: boolean | (() => boolean);
  /** Activate an item (Enter). */
  onOpen?: (item: T) => void;
  item?: Snippet<[T, { when: string; segments: ActivitySegment[] }]>;
  labels?: Partial<ActivityFeedLabels>;
  density?: 'comfortable' | 'compact';
  dir?: 'ltr' | 'rtl' | 'auto';
  class?: ClassValue;
}

const DEFAULT_LABELS: ActivityFeedLabels = {
  feed: 'Activity',
  empty: 'No activity yet',
  loadMore: 'Load more',
  loading: 'Loading',
  loadError: 'Could not load more activity',
  retry: 'Retry',
  exhausted: 'You are all caught up',
  reactions: 'Reactions',
  react: (emoji) => `React with ${emoji}`,
  kind: (kind) => kindVerb(kind),
  actorFallback: 'Someone',
  filterGroup: 'Activity kinds',
  filterAll: 'All',
  announcement: (message) => message,
};

let {
  items,
  now,
  timeZone = 'UTC',
  locale = 'en-US',
  getActorName = (item: T) => item.actorId,
  getActorSrc,
  personaId,
  reactions,
  onReactionToggle,
  reactionEmojis = DEFAULT_REACTION_EMOJIS,
  mentions = {},
  filter = $bindable<ActivityFilter>({}),
  onFilterChange,
  filterable = false,
  pageSize = DEFAULT_PAGE_SIZE,
  onLoadMore,
  hasMore = false,
  onOpen,
  item: itemSnippet,
  labels: labelOverrides,
  density = 'comfortable',
  dir,
  class: className,
}: ActivityFeedProps<T> = $props();

const uid = $props.id();
const titleId = `activity-${uid}-title`;
const labels = $derived({ ...DEFAULT_LABELS, ...labelOverrides });

// svelte-ignore state_referenced_locally -- seed the window from the initial pageSize prop
let visibleCount = $state(Math.max(1, pageSize));
let focusId = $state<string | undefined>();
let announcement = $state('');
let loaderStatus = $state<InfiniteLoaderStatus>('idle');

const sorted = $derived(sortActivity(items));
const filtered = $derived(filterActivity(sorted, filter));
const visible = $derived(pageItems(filtered, visibleCount));
const groups = $derived(
  groupByDay(visible, {
    at: (item) => item.at,
    now,
    timeZone,
    locale,
  })
) as DayGroup<T>[];
const flatVisible = $derived(groups.flatMap((group) => group.items));

const hasMoreFlag = $derived(typeof hasMore === 'function' ? hasMore() : Boolean(hasMore));
const canRevealLocal = $derived(visibleCount < filtered.length);
const canLoadMore = $derived(canRevealLocal || (Boolean(onLoadMore) && hasMoreFlag));

const loader = $derived(
  onLoadMore
    ? createInfiniteLoader({
        getItemCount: () => items.length,
        loadMore: onLoadMore,
        threshold: Math.max(1, Math.floor(pageSize / 2)),
        hasMore: () => (typeof hasMore === 'function' ? hasMore() : Boolean(hasMore)),
      })
    : null
);

$effect(() => {
  // Reset the visible window when the filter set shrinks.
  if (visibleCount > filtered.length && filtered.length > 0 && !hasMoreFlag) {
    visibleCount = Math.max(pageSize, filtered.length);
  }
});

$effect(() => {
  if (flatVisible.length === 0) {
    focusId = undefined;
    return;
  }
  if (focusId && flatVisible.some((item) => item.id === focusId)) return;
  focusId = flatVisible[0]?.id;
});

function announce(message: string): void {
  announcement = labels.announcement(message);
}

function reactionsFor(id: string): Record<string, readonly string[]> | undefined {
  if (!reactions) return undefined;
  if (reactions instanceof Map) return reactions.get(id);
  return (reactions as Record<string, Record<string, readonly string[]>>)[id];
}

function emitFilter(next: ActivityFilter): void {
  filter = next;
  onFilterChange?.(next);
  visibleCount = Math.max(1, pageSize);
  announce('Filter updated.');
}

function setKindFilter(kind: ActivityKind | 'all'): void {
  if (kind === 'all') {
    emitFilter({ ...filter, kinds: undefined });
    return;
  }
  const current = filter.kinds ?? [];
  const has = current.includes(kind);
  const kinds = has ? current.filter((entry) => entry !== kind) : [...current, kind];
  emitFilter({ ...filter, kinds: kinds.length ? kinds : undefined });
}

async function focusItem(id: string): Promise<void> {
  focusId = id;
  await tick();
  document
    .getElementById(`activity-${uid}`)
    ?.querySelector<HTMLElement>(`[data-activity-id="${CSS.escape(id)}"]`)
    ?.focus();
}

function onItemKey(event: KeyboardEvent, item: T, index: number): void {
  if (event.key === 'Enter' && onOpen) {
    event.preventDefault();
    onOpen(item);
    return;
  }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    const next = event.key === 'ArrowDown' ? flatVisible[index + 1] : flatVisible[index - 1];
    if (next) void focusItem(next.id);
    return;
  }
  if (event.key === 'Home') {
    event.preventDefault();
    const first = flatVisible[0];
    if (first) void focusItem(first.id);
    return;
  }
  if (event.key === 'End') {
    event.preventDefault();
    const last = flatVisible[flatVisible.length - 1];
    if (last) void focusItem(last.id);
  }
}

async function handleLoadMore(): Promise<void> {
  if (canRevealLocal) {
    visibleCount = Math.min(filtered.length, visibleCount + pageSize);
    announce(`Showing ${Math.min(visibleCount, filtered.length)} of ${filtered.length}.`);
    return;
  }
  if (!loader || !onLoadMore) return;
  await loader.check(items.length);
  loaderStatus = loader.status;
  if (loader.status === 'error') announce(labels.loadError);
  else if (loader.status === 'exhausted') announce(labels.exhausted);
  else announce(labels.loading);
}

async function handleRetry(): Promise<void> {
  loader?.resetError();
  loaderStatus = loader?.status ?? 'idle';
  await handleLoadMore();
}

async function handleReaction(item: T, emoji: string): Promise<void> {
  if (!onReactionToggle || !personaId) return;
  const current = reactionsFor(item.id);
  const next = toggleReaction(current, emoji, personaId);
  await onReactionToggle(item, emoji, next);
  const mine = next[emoji]?.includes(personaId);
  announce(mine ? `Reacted with ${emoji}.` : `Removed ${emoji} reaction.`);
}

function bodySegments(item: T): ActivitySegment[] {
  if (item.kind === 'comment' && item.body) return tokenize(item.body, mentions);
  return [];
}

function headline(item: T): string {
  const actor = getActorName(item) || labels.actorFallback;
  const verb = labels.kind(item.kind);
  if (item.recordLabel) return `${actor} ${verb} ${item.recordLabel}`;
  if (item.entity) return `${actor} ${verb} a ${item.entity}`;
  return `${actor} ${verb}`;
}
</script>

<section
  id="activity-{uid}"
  class={cx(
    'tx-activity',
    density === 'compact' && 'tx-activity--compact',
    className
  )}
  aria-labelledby={titleId}
  dir={dir}
  data-activity-feed
>
  <h2 id={titleId} class="tx-activity__sr-only">{labels.feed}</h2>

  {#if filterable}
    <div class="tx-activity__filters" role="group" aria-label={labels.filterGroup}>
      <button
        type="button"
        class={cx(
          'tx-activity__filter',
          !(filter.kinds && filter.kinds.length) && 'tx-activity__filter--active'
        )}
        aria-pressed={!(filter.kinds && filter.kinds.length)}
        onclick={() => setKindFilter('all')}
      >
        {labels.filterAll}
      </button>
      {#each ACTIVITY_KINDS as kind (kind)}
        <button
          type="button"
          class={cx(
            'tx-activity__filter',
            filter.kinds?.includes(kind) && 'tx-activity__filter--active'
          )}
          aria-pressed={filter.kinds?.includes(kind) ?? false}
          onclick={() => setKindFilter(kind)}
        >
          {labels.kind(kind)}
        </button>
      {/each}
    </div>
  {/if}

  {#if flatVisible.length === 0}
    <p class="tx-activity__empty">{labels.empty}</p>
  {:else}
    <div class="tx-activity__groups">
      {#each groups as group (group.day)}
        <section class="tx-activity__day" aria-labelledby="activity-{uid}-day-{group.day}">
          <h3 id="activity-{uid}-day-{group.day}" class="tx-activity__day-label">{group.label}</h3>
          <ol class="tx-activity__list">
            {#each group.items as item, _localIndex (item.id)}
              {@const index = flatVisible.findIndex((entry) => entry.id === item.id)}
              {@const when = whenLabel(item.at, { now, timeZone, locale })}
              {@const segments = bodySegments(item)}
              {@const actorName = getActorName(item) || labels.actorFallback}
              {@const actorSrc = getActorSrc?.(item)}
              {@const chips = reactionChips(reactionsFor(item.id), personaId)}
              {@const isFocused = focusId === item.id}
              <li class="tx-activity__item-wrap">
                <!-- Keyboard roving on feed rows (APG feed pattern). -->
                <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
                <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                <article
                  class={cx(
                    'tx-activity__item',
                    isFocused && 'tx-activity__item--focused'
                  )}
                  tabindex={isFocused ? 0 : -1}
                  id="activity-{uid}-item-{item.id}"
                  data-activity-id={item.id}
                  data-kind={item.kind}
                  aria-label={`${headline(item)}. ${when}. ${
                    segments.length ? plainText(segments) : item.lines.join('. ')
                  }`}
                  onfocus={() => (focusId = item.id)}
                  onkeydown={(event) => onItemKey(event, item, index)}
                  onclick={() => onOpen?.(item)}
                >
                  <div class="tx-activity__avatar" aria-hidden="true">
                    <Avatar name={actorName} src={actorSrc ?? null} size="sm" decorative />
                  </div>
                  <div class="tx-activity__body">
                    <header class="tx-activity__header">
                      <p class="tx-activity__headline">
                        <span class="tx-activity__actor">{actorName}</span>
                        <span class="tx-activity__verb">{labels.kind(item.kind)}</span>
                        {#if item.recordLabel}
                          <span class="tx-activity__record">{item.recordLabel}</span>
                        {:else if item.entity}
                          <span class="tx-activity__record">{item.entity}</span>
                        {/if}
                      </p>
                      <time class="tx-activity__when" datetime={item.at}>{when}</time>
                    </header>

                    {#if itemSnippet}
                      {@render itemSnippet(item, { when, segments })}
                    {:else if item.kind === 'comment' && segments.length}
                      <div class="tx-activity__content">
                        {#each segments as segment, segIndex (segIndex)}
                          {#if segment.type === 'text'}
                            <span>{segment.text}</span>
                          {:else if segment.type === 'mention'}
                            <span
                              class={cx(
                                'tx-activity__mention',
                                segment.missing && 'tx-activity__mention--missing'
                              )}
                              data-mention={segment.id}>@{segment.label}</span
                            >
                          {:else}
                            <span
                              class={cx(
                                'tx-activity__reference',
                                segment.missing && 'tx-activity__reference--missing'
                              )}
                              data-reference={segment.id}>#{segment.label}</span
                            >
                          {/if}
                        {/each}
                      </div>
                    {:else if item.lines.length}
                      <ul class="tx-activity__lines">
                        {#each item.lines as line, lineIndex (lineIndex)}
                          <li>{line}</li>
                        {/each}
                      </ul>
                    {/if}

                    {#if onReactionToggle && personaId}
                      <div class="tx-activity__reactions" role="group" aria-label={labels.reactions}>
                        {#each reactionEmojis as emoji (emoji)}
                          {@const chip = chips.find((entry) => entry.emoji === emoji)}
                          <button
                            type="button"
                            class={cx(
                              'tx-activity__react',
                              chip?.mine && 'tx-activity__react--mine'
                            )}
                            aria-pressed={chip?.mine ?? false}
                            aria-label={chip
                              ? `${labels.react(emoji)} (${chip.count})`
                              : labels.react(emoji)}
                            onclick={(event) => {
                              event.stopPropagation();
                              void handleReaction(item, emoji);
                            }}
                          >
                            <span aria-hidden="true">{emoji}</span>
                            {#if chip}
                              <span class="tx-activity__react-count" dir="ltr" aria-hidden="true"
                                ><bdi>{chip.count}</bdi></span
                              >
                            {/if}
                          </button>
                        {/each}
                        {#each chips.filter((chip) => !reactionEmojis.includes(chip.emoji as never)) as chip (chip.emoji)}
                          <button
                            type="button"
                            class={cx(
                              'tx-activity__react',
                              chip.mine && 'tx-activity__react--mine'
                            )}
                            aria-pressed={chip.mine}
                            aria-label={`${labels.react(chip.emoji)} (${chip.count})`}
                            onclick={(event) => {
                              event.stopPropagation();
                              void handleReaction(item, chip.emoji);
                            }}
                          >
                            <span aria-hidden="true">{chip.emoji}</span>
                            <span class="tx-activity__react-count" dir="ltr" aria-hidden="true"
                              ><bdi>{chip.count}</bdi></span
                            >
                          </button>
                        {/each}
                      </div>
                    {:else if chips.length}
                      <ul class="tx-activity__reaction-list" aria-label={labels.reactions}>
                        {#each chips as chip (chip.emoji)}
                          <li>
                            <span aria-hidden="true">{chip.emoji}</span>
                            <span dir="ltr"><bdi>{chip.count}</bdi></span>
                          </li>
                        {/each}
                      </ul>
                    {/if}
                  </div>
                </article>
              </li>
            {/each}
          </ol>
        </section>
      {/each}
    </div>
  {/if}

  {#if canLoadMore || loaderStatus === 'error' || loaderStatus === 'exhausted'}
    <div class="tx-activity__pager">
      {#if loaderStatus === 'error'}
        <p class="tx-activity__error" role="alert">{labels.loadError}</p>
        <button type="button" class="tx-activity__more" onclick={() => void handleRetry()}>
          {labels.retry}
        </button>
      {:else if canLoadMore}
        <button
          type="button"
          class="tx-activity__more"
          aria-busy={loaderStatus === 'loading'}
          disabled={loaderStatus === 'loading'}
          onclick={() => void handleLoadMore()}
        >
          {loaderStatus === 'loading' ? labels.loading : labels.loadMore}
        </button>
      {:else if loaderStatus === 'exhausted' || (!canLoadMore && filtered.length > 0)}
        <p class="tx-activity__caught-up">{labels.exhausted}</p>
      {/if}
    </div>
  {/if}

  <p class="tx-activity__live" role="status" aria-live="polite" aria-atomic="true">
    {announcement}
  </p>
</section>

<style>
  @layer tx.components {
    .tx-activity {
      color: var(--tx-text, CanvasText);
      color-scheme: light dark;
      min-inline-size: 0;
      display: grid;
      gap: var(--tx-space-3);
    }

    .tx-activity__sr-only {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
      border: 0;
    }

    .tx-activity__filters {
      display: flex;
      flex-wrap: wrap;
      gap: calc(var(--tx-space-unit) * 1.4);
    }

    .tx-activity__filter,
    .tx-activity__more,
    .tx-activity__react {
      margin: 0;
      border: var(--tx-border-width-thin) solid var(--tx-border, CanvasText);
      border-radius: var(--tx-shape-radius-lg);
      background: var(--tx-surface, Canvas);
      color: inherit;
      font: inherit;
      cursor: pointer;
    }

    .tx-activity__filter {
      padding: calc(var(--tx-space-unit) * 1.4) calc(var(--tx-space-unit) * 2.6);
      min-block-size: 2.25rem;
      text-transform: capitalize;
    }

    .tx-activity__filter--active,
    .tx-activity__react--mine {
      /* Solid primary pair — color-mix washes failed AA on several library themes. */
      background: var(--tx-primary, Highlight);
      border-color: var(--tx-primary, Highlight);
      color: var(--tx-primary-foreground, Canvas);
    }

    .tx-activity__filter:focus-visible,
    .tx-activity__more:focus-visible,
    .tx-activity__react:focus-visible,
    .tx-activity__item:focus-visible {
      outline: var(--tx-focus-ring-width, 2px) solid var(--tx-ring, Highlight);
      outline-offset: 2px;
    }

    .tx-activity__day-label {
      margin: 0 0 var(--tx-space-2);
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--tx-muted-foreground, GrayText);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .tx-activity__list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: var(--tx-space-2);
    }

    .tx-activity__item {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: var(--tx-space-3);
      margin: 0;
      padding: var(--tx-space-3);
      border: var(--tx-border-width-thin) solid var(--tx-border, CanvasText);
      border-radius: var(--tx-shape-radius-xl);
      background: var(--tx-surface, Canvas);
      cursor: default;
    }

    .tx-activity--compact .tx-activity__item {
      padding: var(--tx-space-2);
      gap: var(--tx-space-2);
    }

    .tx-activity__item--focused {
      border-color: var(--tx-ring, Highlight);
    }

    .tx-activity__avatar {
      padding-block-start: calc(var(--tx-space-unit) * 0.6);
    }

    .tx-activity__header {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      justify-content: space-between;
      gap: calc(var(--tx-space-unit) * 1.4) var(--tx-space-3);
      margin-block-end: calc(var(--tx-space-unit) * 1.4);
    }

    .tx-activity__headline {
      margin: 0;
      display: flex;
      flex-wrap: wrap;
      gap: var(--tx-space-1) calc(var(--tx-space-unit) * 1.6);
      font-size: 0.9375rem;
    }

    .tx-activity__actor {
      font-weight: 600;
    }

    .tx-activity__verb {
      color: var(--tx-muted-foreground, GrayText);
    }

    .tx-activity__record {
      font-weight: 600;
    }

    .tx-activity__when {
      font-size: 0.8125rem;
      color: var(--tx-muted-foreground, GrayText);
      white-space: nowrap;
    }

    .tx-activity__content {
      display: grid;
      gap: calc(var(--tx-space-unit) * 1.4);
      font-size: 0.9375rem;
      overflow-wrap: anywhere;
    }

    .tx-activity__lines {
      margin: 0;
      padding-inline-start: calc(var(--tx-space-unit) * 4.4);
      color: var(--tx-muted-foreground, GrayText);
      font-size: var(--tx-type-label-size);
    }

    .tx-activity__mention,
    .tx-activity__reference {
      font-weight: 600;
      color: var(--tx-primary, Highlight);
    }

    .tx-activity__mention--missing,
    .tx-activity__reference--missing {
      color: var(--tx-muted-foreground, GrayText);
      font-style: italic;
    }

    .tx-activity__reactions,
    .tx-activity__reaction-list {
      display: flex;
      flex-wrap: wrap;
      gap: calc(var(--tx-space-unit) * 1.4);
      margin-block-start: var(--tx-space-2);
      padding: 0;
      list-style: none;
    }

    .tx-activity__react {
      display: inline-flex;
      align-items: center;
      gap: var(--tx-space-1);
      padding: calc(var(--tx-space-unit) * 0.8) calc(var(--tx-space-unit) * 1.8);
      min-block-size: 2rem;
    }

    .tx-activity__react-count,
    .tx-activity__reaction-list span[dir='ltr'] {
      font-size: var(--tx-type-caption-size);
      font-variant-numeric: tabular-nums;
    }

    .tx-activity__empty,
    .tx-activity__caught-up,
    .tx-activity__error {
      margin: 0;
      padding: var(--tx-space-4);
      border: var(--tx-border-width-thin) dashed var(--tx-border, CanvasText);
      border-radius: var(--tx-shape-radius-lg);
      color: var(--tx-muted-foreground, GrayText);
    }

    .tx-activity__error {
      border-style: solid;
      color: var(--tx-danger, CanvasText);
    }

    .tx-activity__pager {
      display: grid;
      gap: var(--tx-space-2);
      justify-items: start;
    }

    .tx-activity__more {
      padding: var(--tx-space-2) calc(var(--tx-space-unit) * 3.6);
      min-block-size: 2.5rem;
    }

    .tx-activity__more:disabled {
      cursor: wait;
      opacity: 0.7;
    }

    .tx-activity__live {
      margin: 0;
      min-block-size: 1.25em;
      font-size: var(--tx-type-label-size);
      color: var(--tx-muted-foreground, GrayText);
    }

    @media (forced-colors: active) {
      .tx-activity__item,
      .tx-activity__filter,
      .tx-activity__more,
      .tx-activity__react {
        border-color: CanvasText;
        background: Canvas;
        color: CanvasText;
      }
      .tx-activity__filter--active,
      .tx-activity__react--mine {
        background: Highlight;
        border-color: Highlight;
        color: HighlightText;
        outline: 2px solid CanvasText;
        outline-offset: 2px;
      }
      .tx-activity__day-label,
      .tx-activity__verb,
      .tx-activity__when,
      .tx-activity__lines,
      .tx-activity__empty,
      .tx-activity__caught-up,
      .tx-activity__live {
        color: CanvasText;
      }
    }
  }
</style>
