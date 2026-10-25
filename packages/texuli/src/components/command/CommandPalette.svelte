<script lang="ts">
import {
  Content as DialogContent,
  Description as DialogDescription,
  Overlay as DialogOverlay,
  Portal as DialogPortal,
  Root as DialogRoot,
  Title as DialogTitle,
} from '@texuli/primitives/dialog';
import { onMount } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue } from '../../internal/cx.ts';
import CommandEmpty from './CommandEmpty.svelte';
import CommandGroup from './CommandGroup.svelte';
import CommandGroupHeading from './CommandGroupHeading.svelte';
import CommandGroupItems from './CommandGroupItems.svelte';
import CommandInput from './CommandInput.svelte';
import CommandItem from './CommandItem.svelte';
import CommandList from './CommandList.svelte';
import CommandLoading from './CommandLoading.svelte';
import CommandRoot from './CommandRoot.svelte';
import type { CommandItemData, CommandPaletteSearch, CommandPaletteSelect } from './types.ts';
import { type CommandSize, type CommandVariant, commandPaletteClass } from './variants.ts';
import './command.css';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Async or sync search when the query is non-empty. */
  search?: CommandPaletteSearch;
  onSelect?: CommandPaletteSelect;
  /** Shown when the query is empty. */
  recentItems?: readonly CommandItemData[];
  debounceMs?: number;
  placeholder?: string;
  /** Listen for ⌘/Ctrl+K to toggle. Default true. */
  shortcut?: boolean;
  /** Group heading for recent items. */
  recentLabel?: string;
  /** Dialog accessible title. */
  title?: string;
  /** Dialog accessible description. */
  description?: string;
  emptyLabel?: string;
  recentEmptyLabel?: string;
  loadingLabel?: string;
  errorLabel?: string;
  size?: CommandSize;
  variant?: CommandVariant;
  class?: ClassValue;
};

let {
  open = $bindable(false),
  onOpenChange,
  search,
  onSelect,
  recentItems = [],
  debounceMs = 150,
  placeholder = 'Search pages, people, and actions…',
  shortcut = true,
  recentLabel = 'Recent',
  title = 'Command palette',
  description = 'Search or choose a recent action. Use the arrow keys to move and Enter to select.',
  emptyLabel = 'No results found.',
  recentEmptyLabel = 'No recent items.',
  loadingLabel = 'Searching…',
  errorLabel = 'Search is unavailable. Try again.',
  size = 'md',
  variant = 'outline',
  class: className,
  ...rest
}: Props = $props();

let query = $state('');
let results = $state<CommandItemData[]>([]);
let loading = $state(false);
let searchError = $state<string | null>(null);
let requestVersion = 0;
let returnFocusTo: HTMLElement | null = null;

const visibleItems = $derived(query.trim() ? results : [...recentItems]);
const groupedItems = $derived.by(() => {
  const groups = new Map<string, CommandItemData[]>();
  for (const item of visibleItems) {
    const group = query.trim() ? (item.group ?? 'Results') : recentLabel;
    const current = groups.get(group) ?? [];
    current.push(item);
    groups.set(group, current);
  }
  return [...groups.entries()].map(([label, items]) => ({ label, items }));
});

const paletteClasses = $derived(
  commandPaletteClass({
    size,
    class: className,
  })
);

function setOpen(next: boolean): void {
  open = next;
  onOpenChange?.(next);
  if (next) {
    query = '';
    results = [];
    searchError = null;
  } else {
    query = '';
    loading = false;
    requestVersion += 1;
    const target = returnFocusTo;
    returnFocusTo = null;
    queueMicrotask(() => {
      if (target?.isConnected) target.focus();
    });
  }
}

function handleShortcut(event: KeyboardEvent): void {
  if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return;
  event.preventDefault();
  if (open) {
    setOpen(false);
    return;
  }
  returnFocusTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  setOpen(true);
}

function selectItem(item: CommandItemData): void {
  try {
    onSelect?.(item);
  } finally {
    setOpen(false);
  }
}

$effect(() => {
  const searchQuery = query.trim();
  if (!open || !searchQuery || !search) {
    loading = false;
    results = [];
    searchError = null;
    return;
  }

  const version = ++requestVersion;
  loading = true;
  results = [];
  searchError = null;
  const timer = setTimeout(
    () => {
      void Promise.resolve()
        .then(() => search(searchQuery))
        .then(
          (items) => {
            if (version !== requestVersion) return;
            results = [...items];
            loading = false;
          },
          () => {
            if (version !== requestVersion) return;
            results = [];
            searchError = errorLabel;
            loading = false;
          }
        );
    },
    Math.max(0, debounceMs)
  );

  return () => clearTimeout(timer);
});

onMount(() => {
  if (!shortcut || typeof window === 'undefined') return;
  window.addEventListener('keydown', handleShortcut);
  return () => window.removeEventListener('keydown', handleShortcut);
});
</script>

<DialogRoot
  bind:open
  onOpenChange={(next) => {
    if (next !== open) setOpen(next);
  }}
>
  <DialogPortal>
    <DialogOverlay class="tx-command-palette__overlay" data-tx-command-palette-overlay />
    <DialogContent
      class="tx-command-palette__content {paletteClasses}"
      data-tx-command-palette
      data-size={size}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        const target = returnFocusTo;
        returnFocusTo = null;
        queueMicrotask(() => {
          if (target?.isConnected) target.focus();
        });
      }}
      {...rest}
    >
      <DialogTitle class="tx-sr-only">{title}</DialogTitle>
      <DialogDescription class="tx-sr-only">{description}</DialogDescription>
      <CommandRoot
        label={title}
        shouldFilter={false}
        loop
        {size}
        {variant}
        onSelect={(value) => {
          const item = visibleItems.find((entry) => entry.id === value);
          if (item) selectItem(item);
        }}
      >
        <CommandInput bind:value={query} {placeholder} />
        <CommandList>
          <CommandLoading>{loadingLabel}</CommandLoading>
          {#if searchError}
            <p class="tx-command__error" role="alert" data-tx-command-error>{searchError}</p>
          {:else if groupedItems.length === 0}
            <CommandEmpty>{query.trim() ? emptyLabel : recentEmptyLabel}</CommandEmpty>
          {:else}
            {#each groupedItems as group (group.label)}
              <CommandGroup value={group.label}>
                <CommandGroupHeading>{group.label}</CommandGroupHeading>
                <CommandGroupItems>
                  {#each group.items as item (item.id)}
                    <CommandItem
                      value={item.id}
                      label={item.label}
                      description={item.description}
                      keywords={item.keywords}
                      disabled={item.disabled}
                      onSelect={() => selectItem(item)}
                    />
                  {/each}
                </CommandGroupItems>
              </CommandGroup>
            {/each}
          {/if}
        </CommandList>
      </CommandRoot>
    </DialogContent>
  </DialogPortal>
</DialogRoot>
