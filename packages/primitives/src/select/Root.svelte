<script lang="ts">
import type { FormBridge } from '@texuli/core/form-bridge';
import { createTypeahead } from '@texuli/core/roving';
import { type Snippet, setContext } from 'svelte';
import { SELECT_CONTEXT, type SelectContext, type SelectItemRecord } from './context.ts';
import { attachSelectFormBridge } from './form.ts';

type SelectItemInput = { value: string; label: string; disabled?: boolean };

interface Props {
  value?: string;
  defaultValue?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  form?: string;
  open?: boolean;
  type?: 'single';
  items?: readonly SelectItemInput[];
  sideOffset?: number;
  positioning?: boolean;
  onValueChange?: (value: string) => void;
  onOpenChange?: (open: boolean) => void;
  children?: Snippet;
}

let {
  value = $bindable(),
  // svelte-ignore state_referenced_locally
  defaultValue = '',
  name,
  disabled = false,
  required = false,
  form,
  open = $bindable(false),
  type = 'single',
  items = [],
  sideOffset = 4,
  positioning = true,
  onValueChange,
  onOpenChange,
  children,
}: Props = $props();

// svelte-ignore state_referenced_locally
if (type !== 'single') {
  throw new Error('Select currently supports type="single" only');
}

const uid = $props.id();
/** Consumer ids claimed by parts; they win over the generated ones. */
let claimedIds = $state<{ trigger?: string; content?: string }>({});
const valueControlled = value !== undefined;

// svelte-ignore state_referenced_locally
let localValue = $state(defaultValue);
const currentValue = $derived(valueControlled ? String(value ?? '') : localValue);

const registered: SelectItemRecord[] = [];
let triggerElement: HTMLElement | undefined;
let highlighted = $state<string | null>(null);
let formBridge: FormBridge | null = null;
let restoreFocus = true;
const typeahead = createTypeahead();

function getCatalogItems(): SelectItemRecord[] {
  // Prefer the Root `items` catalog when provided; otherwise live Item registrations.
  if (items.length > 0) {
    return items.map((item) => {
      const el = registered.find((entry) => entry.value === item.value)?.element;
      return {
        value: item.value,
        label: item.label,
        disabled: Boolean(item.disabled),
        element: el,
      };
    });
  }
  return registered.map((item) => ({
    value: item.value,
    label: item.label,
    disabled: item.disabled,
    element: item.element,
  }));
}

function setValue(next: string): void {
  if (valueControlled) value = next;
  else localValue = next;
  onValueChange?.(next);
  formBridge?.setValue(next);
}

function syncOpen(next: boolean): void {
  if (open === next) return;
  open = next;
  onOpenChange?.(next);
}

function setOpen(next: boolean, event?: Event): void {
  if (disabled && next) return;
  if (next) {
    restoreFocus = true;
    if (event?.currentTarget instanceof HTMLElement) triggerElement = event.currentTarget;
    highlighted = currentValue || getCatalogItems().find((item) => !item.disabled)?.value || null;
  }
  syncOpen(next);
}

function selectValue(next: string): void {
  const item = getCatalogItems().find((entry) => entry.value === next);
  if (!item || item.disabled) return;
  setValue(next);
  restoreFocus = true;
  setOpen(false);
  queueMicrotask(() => triggerElement?.focus({ preventScroll: true }));
}

function enabledIndexes(): number[] {
  return getCatalogItems()
    .map((item, index) => (item.disabled ? -1 : index))
    .filter((index) => index >= 0);
}

function moveHighlight(delta: number): void {
  const enabled = enabledIndexes();
  if (enabled.length === 0) return;
  const currentIndex = getCatalogItems().findIndex((item) => item.value === highlighted);
  let pos = enabled.indexOf(currentIndex);
  if (pos < 0) pos = delta > 0 ? -1 : 0;
  const nextIndex = enabled[(pos + delta + enabled.length * 10) % enabled.length];
  const item = nextIndex === undefined ? undefined : getCatalogItems()[nextIndex];
  if (item) {
    highlighted = item.value;
    item.element?.scrollIntoView({ block: 'nearest' });
  }
}

function handleTypeahead(event: KeyboardEvent): void {
  const labels = getCatalogItems().map((item) => item.label);
  const current = Math.max(
    0,
    getCatalogItems().findIndex((item) => item.value === highlighted)
  );
  const match = typeahead.match(
    event,
    labels,
    current,
    (index) => !getCatalogItems()[index]?.disabled
  );
  if (match < 0) return;
  event.preventDefault();
  const item = getCatalogItems()[match];
  if (!item) return;
  highlighted = item.value;
  item.element?.scrollIntoView({ block: 'nearest' });
}

function handleListKeydown(event: KeyboardEvent): void {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      moveHighlight(1);
      return;
    case 'ArrowUp':
      event.preventDefault();
      moveHighlight(-1);
      return;
    case 'Home': {
      event.preventDefault();
      const first = getCatalogItems().find((item) => !item.disabled);
      if (first) highlighted = first.value;
      return;
    }
    case 'End': {
      event.preventDefault();
      const last = [...getCatalogItems()].reverse().find((item) => !item.disabled);
      if (last) highlighted = last.value;
      return;
    }
    case 'Enter':
    case ' ':
      event.preventDefault();
      if (highlighted) selectValue(highlighted);
      return;
    case 'Escape':
      event.preventDefault();
      restoreFocus = true;
      setOpen(false);
      queueMicrotask(() => triggerElement?.focus({ preventScroll: true }));
      return;
    default:
      handleTypeahead(event);
  }
}

const context: SelectContext = {
  get open() {
    return open;
  },
  get value() {
    return currentValue;
  },
  get name() {
    return name;
  },
  get disabled() {
    return Boolean(disabled);
  },
  get required() {
    return Boolean(required);
  },
  get triggerId() {
    return claimedIds.trigger || `${uid}-trigger`;
  },
  get contentId() {
    return claimedIds.content || `${uid}-content`;
  },
  claimId(part, id) {
    claimedIds[part] = id || undefined;
  },
  get labelId() {
    return undefined;
  },
  get highlighted() {
    return highlighted;
  },
  get sideOffset() {
    return sideOffset;
  },
  get positioning() {
    return positioning;
  },
  get items() {
    return getCatalogItems();
  },
  setOpen,
  toggle(event) {
    setOpen(!open, event);
  },
  selectValue,
  setHighlighted(next) {
    highlighted = next;
  },
  registerTrigger(element) {
    if (!element) {
      triggerElement = undefined;
      formBridge?.dispose();
      formBridge = null;
      return;
    }
    if (element === triggerElement && formBridge) return;
    triggerElement = element;
    if (!name) return;
    formBridge?.dispose();
    formBridge = attachSelectFormBridge(element.ownerDocument, {
      name,
      value: currentValue,
      required,
      disabled,
      form,
      focusTarget: element,
    });
    element.insertAdjacentElement('afterend', formBridge.input);
    formBridge.setValue(currentValue);
  },
  registerContent() {
    // reserved for future focus management inside the listbox
  },
  registerItem(item) {
    const index = registered.findIndex((entry) => entry.value === item.value);
    if (index >= 0) registered[index] = item;
    else registered.push(item);
    return () => {
      const at = registered.findIndex(
        (entry) => entry.value === item.value && entry.element === item.element
      );
      if (at >= 0) registered.splice(at, 1);
    };
  },
  getItemLabel(value) {
    return getCatalogItems().find((item) => item.value === value)?.label;
  },
  onOverlayOpenChange(next) {
    syncOpen(next);
    if (!next) {
      if (restoreFocus) triggerElement?.focus({ preventScroll: true });
      highlighted = null;
      typeahead.reset();
    }
    restoreFocus = true;
  },
  focusTrigger() {
    triggerElement?.focus({ preventScroll: true });
  },
  handleTypeahead,
  handleListKeydown,
};

setContext(SELECT_CONTEXT, context);

$effect(() => {
  formBridge?.setValue(currentValue);
});

$effect(() => () => formBridge?.dispose());
</script>

{@render children?.()}
