<script lang="ts">
import { createFormBridge, type FormBridge } from '@texuli/core/form-bridge';
import { type Snippet, untrack } from 'svelte';
import type {
  ComboboxContext,
  ComboboxItemData,
  ComboboxLoadStatus,
  ComboboxSelection,
} from './context.ts';
import { setComboboxContext } from './context.ts';
import { type ComboboxFilter, defaultComboboxFilter } from './filter.ts';
import type { ComboboxRootProps } from './props.ts';

let {
  value = $bindable(),
  defaultValue,
  inputValue = $bindable(),
  defaultInputValue = '',
  items = [],
  loadOptions,
  multiple = false,
  disabled = false,
  filter,
  name,
  required = false,
  requiredMessage,
  form,
  open = $bindable(false),
  onValueChange,
  onInputValueChange,
  onOpenChange,
  children,
}: ComboboxRootProps = $props();

const id = $props.id();
/** Consumer ids claimed by parts; they win over the generated ones. */
let claimedIds = $state<{ input?: string; list?: string }>({});
const controlledValue = untrack(() => value !== undefined);
const controlledInput = untrack(() => inputValue !== undefined);
const initialValue = untrack(() => value ?? defaultValue ?? (multiple ? [] : ''));
const initialInput = untrack(() => inputValue ?? defaultInputValue);
let localValue = $state<ComboboxSelection>(initialValue);
let localInput = $state(initialInput);
let loadedItems = $state<readonly ComboboxItemData[]>([]);
let loading = $state(false);
let failed = $state(false);
let errorMessage = $state<string | undefined>(undefined);
let activeValue = $state<string>();
let requestController: AbortController | undefined;
let requestVersion = 0;
let inputElement = $state.raw<HTMLInputElement | undefined>();
let overlayController: import('@texuli/core/overlay').OverlayController | undefined;
/** Last query sent to `loadOptions` (for retry). */
let lastLoadQuery = $state<string | undefined>(undefined);

const currentValue = $derived(value ?? localValue);
const query = $derived(inputValue ?? localInput);
const selected = $derived.by(() => {
  const current = currentValue;
  return Array.isArray(current) ? current : current ? [current] : [];
});
const filteredItems = $derived.by(() => {
  if (loadOptions) return loadedItems;
  const trimmed = query.trim();
  if (!trimmed) return items;
  // A consumer filter replaces the default; it is never combined with it.
  const matches = filter ?? defaultComboboxFilter;
  return items.filter((item) => matches(item, trimmed));
});

const status = $derived.by((): ComboboxLoadStatus => {
  if (loading) return 'loading';
  if (failed) return 'error';
  if (filteredItems.length === 0) {
    // Async: empty once a load has settled with no results (opening does not
    // load, so an unloaded list stays idle).
    if (loadOptions) return lastLoadQuery !== undefined ? 'empty' : 'idle';
    // Local items: an open list with nothing to show is empty, typed or not.
    return query.trim() || open ? 'empty' : 'idle';
  }
  return 'ready';
});

function syncOpen(next: boolean): void {
  if (disabled && next) return;
  if (open === next) return;
  open = next;
  onOpenChange?.(next);
}

function messageFromRejection(reason: unknown): string {
  if (reason instanceof Error && reason.message.trim()) return reason.message;
  if (typeof reason === 'string' && reason.trim()) return reason;
  return 'Failed to load options';
}

function runLoad(next: string): void {
  if (!loadOptions) return;
  requestController?.abort();
  loadedItems = [];
  failed = false;
  errorMessage = undefined;
  const controller = new AbortController();
  requestController = controller;
  const version = ++requestVersion;
  lastLoadQuery = next;
  loading = true;
  void loadOptions(next, controller.signal).then(
    (result) => {
      if (controller.signal.aborted || version !== requestVersion) return;
      loadedItems = result;
      loading = false;
      failed = false;
      errorMessage = undefined;
    },
    (reason: unknown) => {
      if (controller.signal.aborted || version !== requestVersion) return;
      loadedItems = [];
      loading = false;
      failed = true;
      errorMessage = messageFromRejection(reason);
    }
  );
}

function setQuery(next: string): void {
  if (controlledInput) inputValue = next;
  else localInput = next;
  onInputValueChange?.(next);
  activeValue = undefined;
  syncOpen(true);
  if (!loadOptions) return;
  runLoad(next);
}

function retry(): void {
  if (!loadOptions || disabled) return;
  const target = lastLoadQuery ?? query;
  syncOpen(true);
  runLoad(target);
}

function setActive(next: string | undefined): void {
  activeValue = next;
}

function select(next: string): void {
  if (disabled) return;
  const option = filteredItems.find((item) => item.value === next);
  if (!option || option.disabled) return;
  const nextValue: ComboboxSelection = multiple
    ? selected.includes(next)
      ? selected.filter((item) => item !== next)
      : [...selected, next]
    : next;
  if (controlledValue) value = nextValue;
  else localValue = nextValue;
  onValueChange?.(nextValue);
  if (!multiple) {
    if (controlledInput) inputValue = option.label;
    else localInput = option.label;
    onInputValueChange?.(option.label);
    syncOpen(false);
    queueMicrotask(() => inputElement?.focus({ preventScroll: true }));
  } else {
    if (controlledInput) inputValue = '';
    else localInput = '';
    onInputValueChange?.('');
    activeValue = undefined;
  }
}

function remove(next: string): void {
  if (!multiple || disabled || !selected.includes(next)) return;
  const nextValue = selected.filter((item) => item !== next);
  if (controlledValue) value = nextValue;
  else localValue = nextValue;
  onValueChange?.(nextValue);
  queueMicrotask(() => inputElement?.focus({ preventScroll: true }));
}

/** Restores the starting value and text (a form reset). */
function resetToDefault(): void {
  const nextValue: ComboboxSelection = Array.isArray(initialValue)
    ? [...initialValue]
    : initialValue;
  const nextInput =
    multiple || typeof nextValue !== 'string' || !nextValue ? initialInput : labelFor(nextValue);
  if (controlledValue) value = nextValue;
  else localValue = nextValue;
  onValueChange?.(nextValue);
  if (controlledInput) inputValue = nextInput;
  else localInput = nextInput;
  onInputValueChange?.(nextInput);
  activeValue = undefined;
  syncOpen(false);
}

/**
 * Form participation goes through `@texuli/core/form-bridge`: an unnamed
 * constraint field after the input carries `required`, `disabled` and
 * `form`, focuses the input when the browser rejects the form, and restores
 * the starting value on reset. The values themselves submit through the
 * hidden fields rendered below (one per value). The field exists while the
 * combobox has a `name` or is `required`, and follows those props and `form`
 * after mount without a remount.
 */
let formBridge = $state.raw<FormBridge | null>(null);
const needsFormBridge = $derived(Boolean(name) || required);

$effect(() => {
  const element = inputElement;
  if (!element || !needsFormBridge) return;
  const bridge = untrack(() =>
    createFormBridge(element.ownerDocument, {
      name: '',
      value: selected.length > 0 ? 'filled' : '',
      required,
      disabled,
      ...(form ? { form } : {}),
      focusTarget: element,
      onReset: resetToDefault,
    })
  );
  bridge.input.removeAttribute('name');
  element.after(bridge.input);
  formBridge = bridge;
  return () => {
    bridge.dispose();
    if (untrack(() => formBridge) === bridge) formBridge = null;
  };
});

function itemId(value: string): string {
  return `${id}-option-${encodeURIComponent(value)}`;
}

function labelFor(value: string): string {
  return (
    items.find((item) => item.value === value)?.label ??
    loadedItems.find((item) => item.value === value)?.label ??
    value
  );
}

const context: ComboboxContext = {
  get id() {
    return id;
  },
  get inputId() {
    return claimedIds.input || `${id}-input`;
  },
  get listId() {
    return claimedIds.list || `${id}-listbox`;
  },
  claimId(part, claimed) {
    claimedIds[part] = claimed || undefined;
  },
  get open() {
    return open;
  },
  get disabled() {
    return disabled;
  },
  get multiple() {
    return multiple;
  },
  get loading() {
    return loading;
  },
  get failed() {
    return failed;
  },
  get errorMessage() {
    return errorMessage;
  },
  get status() {
    return status;
  },
  get query() {
    return query;
  },
  get value() {
    return currentValue;
  },
  get items() {
    return filteredItems;
  },
  get activeValue() {
    return activeValue;
  },
  get selected() {
    return selected;
  },
  setOpen: syncOpen,
  setQuery,
  setActive,
  select,
  remove,
  retry,
  itemId,
  labelFor,
  registerInput(element) {
    inputElement = element;
  },
  registerOverlay(controller) {
    overlayController = controller;
  },
};

setComboboxContext(context);

$effect(() => {
  if (!controlledValue || multiple || open) return;
  const selectedValue = typeof currentValue === 'string' ? currentValue : '';
  const label = items.find((item) => item.value === selectedValue)?.label;
  if (label !== undefined && query !== label) {
    if (controlledInput) inputValue = label;
    else localInput = label;
  }
});

$effect(() => {
  const bridge = formBridge;
  const filled = selected.length > 0;
  if (!bridge) return;
  bridge.setValue(filled ? 'filled' : '');
  bridge.input.required = required;
  bridge.input.disabled = disabled;
  if (form) bridge.input.setAttribute('form', form);
  else bridge.input.removeAttribute('form');
  bridge.setValidity(required && !filled && requiredMessage ? requiredMessage : '');
});

$effect(() => () => {
  requestVersion += 1;
  requestController?.abort();
  overlayController?.destroy();
});
</script>

{@render children?.()}
{#if name}
  {#if multiple}
    {#each selected as entry (entry)}<input type="hidden" {name} {form} value={entry} {disabled} />{/each}
  {:else}
    <input type="hidden" {name} {form} value={selected[0] ?? ''} {disabled} />
  {/if}
{/if}
