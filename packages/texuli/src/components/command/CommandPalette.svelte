<script lang="ts">
import type { FocusRestoreEvent } from '@texuli/core/focus-scope';
import type { OverlayDismissEvent, OverlayMode } from '@texuli/core/overlay';
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
import { useMessages } from '../../i18n/use-messages.ts';
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
import { designDefaults } from '../../internal/design-defaults.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /**
   * `'top-layer'` (default) or `'contained'`: with a `container`, the palette
   * renders inside it, and inertness, focus containment and the backdrop stay
   * scoped to it. For framed previews.
   */
  mode?: OverlayMode;
  /** The element a `'contained'` palette renders in and is scoped to. */
  container?: Element | null;
  /** Called before Escape or an outside press closes it; `event.preventDefault()` keeps it open. */
  onDismissRequest?: (event: OverlayDismissEvent) => void;
  /**
   * Called before focus returns to the opener on close; `event.preventDefault()`
   * keeps focus where it is (move it yourself to redirect).
   */
  onCloseAutoFocus?: (event: FocusRestoreEvent) => void;
  /** The palette's dialog element (bindable; `null` while closed). */
  ref?: HTMLElement | null;
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

const txDefaults = designDefaults('command');
let {
  open = $bindable(false),
  onOpenChange,
  search,
  onSelect,
  recentItems = [],
  debounceMs = 150,
  placeholder: placeholderProp,
  shortcut = true,
  recentLabel: recentLabelProp,
  title: titleProp,
  description: descriptionProp,
  emptyLabel: emptyLabelProp,
  recentEmptyLabel: recentEmptyLabelProp,
  loadingLabel: loadingLabelProp,
  errorLabel: errorLabelProp,
  size = txDefaults().size ?? 'md',
  variant = txDefaults().variant ?? 'outline',
  class: className,
  mode = 'top-layer',
  container = null,
  onDismissRequest,
  onCloseAutoFocus,
  ref = $bindable(null),
  ...rest
}: Props = $props();
const msg = useMessages();
const placeholder = $derived(
  placeholderProp ?? msg('texuli.command-palette.placeholder', 'Search pages, people, and actions…')
);
const recentLabel = $derived(
  recentLabelProp ?? msg('texuli.command-palette.recent-label', 'Recent')
);
const title = $derived(titleProp ?? msg('texuli.command-palette.title', 'Command palette'));
const description = $derived(
  descriptionProp ??
    msg(
      'texuli.command-palette.description',
      'Search or choose a recent action. Use the arrow keys to move and Enter to select.'
    )
);
const emptyLabel = $derived(
  emptyLabelProp ?? msg('texuli.command-palette.empty-label', 'No results found.')
);
const recentEmptyLabel = $derived(
  recentEmptyLabelProp ?? msg('texuli.command-palette.recent-empty-label', 'No recent items.')
);
const loadingLabel = $derived(
  loadingLabelProp ?? msg('texuli.command-palette.loading-label', 'Searching…')
);
const errorLabel = $derived(
  errorLabelProp ?? msg('texuli.command-palette.error-label', 'Search is unavailable. Try again.')
);

let query = $state('');
let results = $state<CommandItemData[]>([]);
let loading = $state(false);
let searchError = $state<string | null>(null);
let requestVersion = 0;
let returnFocusTo: HTMLElement | null = null;
let wasOpen = false;

// Remember who had focus on every closed -> open transition, also when a
// parent opens the palette through bind:open (a header trigger, a deferred
// first shortcut): closing must give focus back, never drop it (WCAG 2.4.3).
// `$effect.pre` runs before the dialog mounts and moves focus.
$effect.pre(() => {
  if (open && !wasOpen && returnFocusTo === null) {
    const active = document.activeElement;
    returnFocusTo = active instanceof HTMLElement && active !== document.body ? active : null;
  }
  wasOpen = open;
});

const visibleItems = $derived(query.trim() ? results : [...recentItems]);
const groupedItems = $derived.by(() => {
  const groups = new Map<string, CommandItemData[]>();
  for (const item of visibleItems) {
    const group = query.trim()
      ? (item.group ?? msg('texuli.command-palette.results', 'Results'))
      : recentLabel;
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
  {mode}
  {container}
  {...onDismissRequest ? { onDismissRequest } : {}}
  {...onCloseAutoFocus ? { onCloseAutoFocus } : {}}
  onOpenChange={(next) => {
    if (next !== open) setOpen(next);
  }}
>
  <DialogPortal>
    <DialogOverlay class="tx-command-palette__overlay" data-tx-command-palette-overlay />
    <DialogContent
      bind:ref
      class="tx-command-palette__content {paletteClasses}"
      data-tx-command-palette
      data-size={size}
      onCloseAutoFocus={(event) => {
        const target = returnFocusTo;
        returnFocusTo = null;
        // The caller's onCloseAutoFocus (on the root) ran first and kept focus.
        if (event.defaultPrevented) return;
        event.preventDefault();
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
        {loading}
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
