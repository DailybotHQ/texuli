<script lang="ts">
import { sanitizeIdPart } from '@texuli/core/ids';
import { onMount } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { EmojiArtResolver } from './art.ts';
import Emoji from './Emoji.svelte';
import { EMOJI_PICKER_MESSAGES_EN, type EmojiPickerMessages } from './messages.ts';
import './emoji.css';

type Category =
  | 'all'
  | 'recent'
  | 'smileys-emotion'
  | 'people-body'
  | 'animals-nature'
  | 'food-drink'
  | 'travel-places'
  | 'activities'
  | 'objects'
  | 'symbols'
  | 'flags';
type EmojiRecord = {
  id: string;
  name: string;
  unicode: string;
  shortcode: string;
  aliases: readonly string[];
  keywords: readonly string[];
  category: Exclude<Category, 'all' | 'recent'>;
  sortOrder: number;
  variantOf?: string;
  variants?: readonly string[];
  tone?: string;
};
type Props = HTMLAttributes<HTMLElement> & {
  id: string;
  label?: string;
  recentIds?: readonly string[];
  onRecentIdsChange?: (ids: readonly string[]) => void;
  onSelect?: (emoji: { id: string; unicode: string; shortcode: string }) => void;
  artResolver?: EmojiArtResolver;
  pageSize?: number;
  messages?: Partial<EmojiPickerMessages>;
  ref?: HTMLElement | null;
};
const TONES = ['default', 'light', 'medium-light', 'medium', 'medium-dark', 'dark'] as const;
type Tone = (typeof TONES)[number];

let {
  id,
  label,
  recentIds = [],
  onRecentIdsChange,
  onSelect,
  artResolver,
  pageSize = 40,
  messages,
  ref = $bindable(null),
  class: className,
  ...rest
}: Props = $props();
const instanceId = $derived(sanitizeIdPart(id) || 'emoji-picker');
const gridId = $derived(`tx-${instanceId}-grid`);
const copy = $derived({
  ...EMOJI_PICKER_MESSAGES_EN,
  ...messages,
  categories: { ...EMOJI_PICKER_MESSAGES_EN.categories, ...messages?.categories },
  tones: { ...EMOJI_PICKER_MESSAGES_EN.tones, ...messages?.tones },
});
let records = $state<readonly EmojiRecord[]>([]);
let loading = $state(true);
let query = $state('');
let category = $state<Category>('all');
let tone = $state<Tone>('default');
let active = $state(0);
let grid = $state<HTMLDivElement | null>(null);
let typeBuffer = '';
let typeTimer: ReturnType<typeof setTimeout> | undefined;
const categoryOrder: readonly Category[] = [
  'all',
  'recent',
  'smileys-emotion',
  'people-body',
  'animals-nature',
  'food-drink',
  'travel-places',
  'activities',
  'objects',
  'symbols',
  'flags',
];

onMount(async () => {
  try {
    const catalog = await import('@texuli/emojis/catalog');
    records = catalog.listEmojis({ includeVariants: true }) as readonly EmojiRecord[];
  } finally {
    loading = false;
  }
});

const filtered = $derived.by(() => {
  const needle = query.trim().toLocaleLowerCase('en');
  let pool = records;
  if (category === 'recent') {
    const byId = new Map(records.map((record) => [record.id, record]));
    pool = recentIds.flatMap((id) => {
      const record = byId.get(id);
      return record ? [record] : [];
    });
  } else if (category !== 'all') {
    pool = records.filter((record) => record.category === category);
  }
  if (needle) {
    pool = pool
      .map((record) => {
        const fields = [record.name, record.shortcode, ...record.aliases, ...record.keywords];
        const rank = fields.reduce((score, field) => {
          const value = field.toLocaleLowerCase('en');
          return Math.max(
            score,
            value === needle ? 3 : value.startsWith(needle) ? 2 : value.includes(needle) ? 1 : 0
          );
        }, 0);
        return { record, rank };
      })
      .filter((item) => item.rank > 0)
      .sort((a, b) => b.rank - a.rank || a.record.sortOrder - b.record.sortOrder)
      .map((item) => item.record);
  }
  if (tone !== 'default') {
    pool = pool
      .filter((record) => !record.variantOf)
      .map((record) => {
        const variant = record.variants
          ?.map((id) => records.find((item) => item.id === id))
          .find((item) => item?.tone === tone);
        return variant ?? record;
      });
  }
  const limit = Number.isFinite(pageSize) ? Math.max(1, Math.min(200, Math.floor(pageSize))) : 40;
  return pool.slice(0, limit);
});
const activeEmoji = $derived(filtered[active]);

function selectEmoji(record: EmojiRecord): void {
  onSelect?.({ id: record.id, unicode: record.unicode, shortcode: record.shortcode });
  onRecentIdsChange?.([record.id, ...recentIds.filter((id) => id !== record.id)].slice(0, 20));
}

function setActive(index: number): void {
  if (!filtered.length) return;
  active = Math.max(0, Math.min(filtered.length - 1, index));
}

function handleGridKeydown(event: KeyboardEvent): void {
  const columns = 8;
  let next = active;
  const rtl = grid && getComputedStyle(grid).direction === 'rtl';
  if (event.key === 'ArrowRight') next += rtl ? -1 : 1;
  else if (event.key === 'ArrowLeft') next += rtl ? 1 : -1;
  else if (event.key === 'ArrowDown') next += columns;
  else if (event.key === 'ArrowUp') next -= columns;
  else if (event.key === 'Home') next = event.ctrlKey ? 0 : Math.floor(active / columns) * columns;
  else if (event.key === 'End')
    next = event.ctrlKey
      ? filtered.length - 1
      : Math.min(filtered.length - 1, Math.floor(active / columns) * columns + columns - 1);
  else if (event.key === 'PageDown') next += columns * 5;
  else if (event.key === 'PageUp') next -= columns * 5;
  else if ((event.key === 'Enter' || event.key === ' ') && activeEmoji) {
    event.preventDefault();
    selectEmoji(activeEmoji);
    return;
  } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
    typeBuffer += event.key;
    if (typeTimer) clearTimeout(typeTimer);
    typeTimer = setTimeout(() => (typeBuffer = ''), 700);
    query = typeBuffer;
    category = 'all';
    setActive(0);
    event.preventDefault();
    return;
  } else return;
  event.preventDefault();
  setActive(next);
}

function handleCategoryKeydown(event: KeyboardEvent, index: number): void {
  let next = index;
  const rtl = getComputedStyle(event.currentTarget as HTMLElement).direction === 'rtl';
  if (event.key === 'ArrowRight')
    next = (index + (rtl ? categoryOrder.length - 1 : 1)) % categoryOrder.length;
  else if (event.key === 'ArrowLeft')
    next = (index + (rtl ? 1 : categoryOrder.length - 1)) % categoryOrder.length;
  else if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = categoryOrder.length - 1;
  else return;
  event.preventDefault();
  category = categoryOrder[next] ?? 'all';
  active = 0;
  document.getElementById(`tx-emoji-tab-${category}`)?.focus();
}
</script>

<section
  bind:this={ref}
  {id}
  class={['tx-emoji-picker', className]}
  aria-label={label ?? copy.picker}
  data-tx-emoji-picker
  {...rest as HTMLAttributes<HTMLElement>}
>
  <label class="tx-emoji-picker__search-label">
    <span>{copy.search}</span>
    <input
      class="tx-emoji-picker__search"
      type="search"
      role="combobox"
      aria-label={copy.search}
      aria-autocomplete="list"
      aria-haspopup="grid"
      aria-expanded="true"
      aria-controls={gridId}
      bind:value={query}
      oninput={() => setActive(0)}
      onkeydown={(event) => {
        if (event.key === 'Escape' && query) {
          query = '';
          setActive(0);
        }
      }}
    />
  </label>
  <div class="tx-emoji-picker__categories" role="listbox" aria-label={copy.categoriesLabel}>
    {#each categoryOrder as item (item)}
      <button
        type="button"
        role="option"
        id={`tx-emoji-tab-${item}`}
        aria-selected={category === item}
        aria-controls={gridId}
        tabindex={category === item ? 0 : -1}
        onclick={() => { category = item; active = 0; }}
        onkeydown={(event) => handleCategoryKeydown(event, categoryOrder.indexOf(item))}
      >{copy.categories[item]}</button>
    {/each}
  </div>
  <fieldset class="tx-emoji-picker__tones">
    <legend>{copy.skinTone}</legend>
    {#each TONES as value (value)}
      <label>
        <input type="radio" name="tx-emoji-tone" {value} bind:group={tone} />
        <span>{copy.tones[value]}</span>
      </label>
    {/each}
  </fieldset>
  <div
    bind:this={grid}
    id={gridId}
    class="tx-emoji-picker__grid"
    role="grid"
    aria-label={copy.categories[category]}
    aria-busy={loading}
    aria-activedescendant={activeEmoji ? `tx-emoji-option-${instanceId}-${activeEmoji.id}` : undefined}
    tabindex="0"
    onkeydown={handleGridKeydown}
    onfocus={() => { if (filtered.length) setActive(active); }}
    onclick={(event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-emoji-index]');
      const index = target ? Number(target.dataset.emojiIndex) : -1;
      const item = filtered[index];
      if (item) setActive(index);
      if (item) selectEmoji(item);
    }}
  >
    {#if loading}
      <p role="status">{copy.loading}</p>
    {:else if filtered.length}
      {#each Array.from({ length: Math.ceil(filtered.length / 8) }, (_, row) => row) as row (row)}
        <div role="row">
          {#each filtered.slice(row * 8, row * 8 + 8) as emoji, column (emoji.id)}
            {@const index = row * 8 + column}
            <div
              id={`tx-emoji-option-${instanceId}-${emoji.id}`}
              role="gridcell"
              aria-selected={active === index}
              aria-label={emoji.name}
              data-emoji-index={index}
            >
              <Emoji id={emoji.id} decorative {artResolver} />
            </div>
          {/each}
        </div>
      {/each}
    {:else}
      <p class="tx-emoji-picker__empty" role="status">{copy.noResults}</p>
    {/if}
  </div>
</section>
