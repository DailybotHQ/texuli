<script lang="ts">
import { getNavigationIntent, isActivationKey } from '@texuli/core/keyboard';
import { onDestroy, type Snippet, untrack } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { useMessages } from '../i18n/use-messages.ts';
import type { RefProp } from '../internal/ref.ts';
import { type CommandContextValue, type CommandItemRecord, commandContext } from './context.ts';
import type { CommandSearch } from './types.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  children?: Snippet;
  debounceMs?: number;
  label?: string;
  loop?: boolean;
  onSearch?: CommandSearch;
  onSearchError?: (error: unknown) => void;
  onSelect?: (value: string) => void;
  shouldFilter?: boolean;
} & RefProp;

let {
  children,
  debounceMs = 0,
  label: labelProp,
  loop = true,
  onSearch,
  onSearchError,
  onSelect,
  shouldFilter = true,
  ref = $bindable(null),
  ...rest
}: Props = $props();
const msg = useMessages();
const label = $derived(labelProp ?? msg('primitives.command.label', 'Commands'));

const id = $props.id();
/** Consumer ids claimed by the list and items (`item:<value>`); they win over the generated ones. */
let claimedIds = $state<Record<string, string | undefined>>({});
let query = $state('');
let items = $state.raw<CommandItemRecord[]>([]);
let loading = $state(false);
let error = $state<string>();
let activeValue = $state<string>();
let requestVersion = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

const visibleItems = $derived.by(() => {
  if (!shouldFilter || !query.trim()) return items;
  const needle = query.trim().toLocaleLowerCase();
  return items
    .map((item) => ({ item, score: scoreItem(item, needle) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .map(({ item }) => item);
});

function scoreText(text: string, needle: string): number {
  const candidate = text.toLocaleLowerCase();
  if (candidate === needle) return 3;
  if (candidate.startsWith(needle)) return 2;
  if (candidate.includes(needle)) return 1;
  return 0;
}

function scoreItem(item: CommandItemRecord, needle: string): number {
  return Math.max(
    scoreText(item.label, needle),
    ...item.keywords.map((keyword) => scoreText(keyword, needle)),
    0
  );
}

function updateQuery(value: string): void {
  query = value;
  activeValue = undefined;
  error = undefined;
  requestVersion += 1;
  const version = requestVersion;
  if (timer !== undefined) clearTimeout(timer);
  timer = undefined;

  if (!value.trim() || !onSearch) {
    loading = false;
    activeValue = visibleItems.find((item) => !item.disabled && !item.groupDisabled)?.value;
    return;
  }

  activeValue = visibleItems.find((item) => !item.disabled && !item.groupDisabled)?.value;
  loading = true;
  timer = setTimeout(
    () => {
      timer = undefined;
      void Promise.resolve()
        .then(() => onSearch?.(value.trim()))
        .catch((cause: unknown) => {
          if (version !== requestVersion) return;
          error = cause instanceof Error ? cause.message : 'Search failed';
          onSearchError?.(cause);
        })
        .finally(() => {
          if (version === requestVersion) loading = false;
        });
    },
    Math.max(0, debounceMs)
  );
}

function register(token: object, input: Omit<CommandItemRecord, 'token'>): () => void {
  const record = { ...input, token };
  items = [...untrack(() => items.filter((item) => item.token !== token)), record];
  untrack(reconcileActive);
  return () => {
    items = untrack(() => items.filter((item) => item.token !== token));
    untrack(reconcileActive);
  };
}

function isVisible(token: object): boolean {
  return visibleItems.some((item) => item.token === token);
}

function isGroupVisible(group: string): boolean {
  return visibleItems.some((item) => item.group === group);
}

function reconcileActive(): void {
  const enabled = visibleItems.filter((item) => !item.disabled && !item.groupDisabled);
  if (activeValue !== undefined && enabled.some((item) => item.value === activeValue)) return;
  activeValue = enabled[0]?.value;
}

function moveActive(step: 1 | -1 | 'first' | 'last'): void {
  const options = visibleItems.filter((item) => !item.disabled && !item.groupDisabled);
  if (options.length === 0) {
    activeValue = undefined;
    return;
  }
  const current = options.findIndex((item) => item.value === activeValue);
  if (step === 'first') activeValue = options[0]?.value;
  else if (step === 'last') activeValue = options.at(-1)?.value;
  else {
    let next = current < 0 ? (step === 1 ? 0 : options.length - 1) : current + step;
    if (loop) next = (next + options.length) % options.length;
    else next = Math.max(0, Math.min(options.length - 1, next));
    activeValue = options[next]?.value;
  }
}

function select(value: string): void {
  const item = visibleItems.find((candidate) => candidate.value === value);
  if (!item || item.disabled || item.groupDisabled) return;
  activeValue = value;
  item.onSelect?.();
  onSelect?.(value);
}

function handleInputKeydown(event: KeyboardEvent): void {
  const intent = getNavigationIntent(event, { orientation: 'vertical', homeEnd: false });
  if (intent === 'next') {
    event.preventDefault();
    moveActive(1);
  } else if (intent === 'previous') {
    event.preventDefault();
    moveActive(-1);
  } else if (!event.isComposing && event.key === 'Home' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    moveActive('first');
  } else if (!event.isComposing && event.key === 'End' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    moveActive('last');
  } else if (
    isActivationKey(event, 'Enter') &&
    (activeValue ?? visibleItems[0]?.value) !== undefined
  ) {
    event.preventDefault();
    select(activeValue ?? visibleItems[0]?.value ?? '');
  }
}

const context: CommandContextValue = {
  get id() {
    return id;
  },
  get label() {
    return label;
  },
  get query() {
    return query;
  },
  get loading() {
    return loading;
  },
  get error() {
    return error;
  },
  get items() {
    return items;
  },
  get activeValue() {
    return activeValue ?? visibleItems[0]?.value;
  },
  get visibleItems() {
    return visibleItems;
  },
  get shouldFilter() {
    return shouldFilter;
  },
  get listId() {
    return claimedIds.list || `${id}-list`;
  },
  itemId(value) {
    return claimedIds[`item:${value}`] || `${id}-item-${encodeURIComponent(value)}`;
  },
  claimId(part, claimed) {
    claimedIds[part] = claimed || undefined;
  },
  register,
  updateQuery,
  isVisible,
  isGroupVisible,
  isActive(value) {
    return this.activeValue === value;
  },
  setActive(value) {
    activeValue = value;
  },
  moveActive,
  select,
  handleInputKeydown,
};

commandContext.set(context);
untrack(() => moveActive('first'));
onDestroy(() => {
  requestVersion += 1;
  if (timer !== undefined) clearTimeout(timer);
});
</script>

<div bind:this={ref} {...rest} data-command-root="">
  {@render children?.()}
</div>
