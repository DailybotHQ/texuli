<script lang="ts">
import { createControllableState } from '@texuli/core/controllable';
import { getOwnerDocument } from '@texuli/core/env';
import { createFormBridge, type FormBridge } from '@texuli/core/form-bridge';
import type { HTMLButtonAttributes } from 'svelte/elements';
import { type ChildSnippet, composeChildProps } from '../internal/child.ts';
import type { RefProp } from '../internal/ref.ts';
import { stateAttributes } from '../internal/state.ts';
import { switchContext } from './context.ts';

type Props = Omit<HTMLButtonAttributes, 'type' | 'role' | 'aria-checked' | 'children'> & {
  /** Controlled checked state (`bind:checked`). */
  checked?: boolean;
  /** Uncontrolled initial checked state. */
  defaultChecked?: boolean;
  /** Called when checked changes. */
  onCheckedChange?: (checked: boolean) => void;
  /** Form field name; bridges to a native input when set. */
  name?: string;
  /** Submitted value when checked. Default `"on"`. */
  value?: string;
  /** Associate the form bridge with a form by id. */
  form?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  /** Composition snippet; receives switch trigger props. */
  child?: ChildSnippet<Record<string, unknown>>;
  children?: import('svelte').Snippet;
} & RefProp;

let {
  checked = $bindable(undefined),
  defaultChecked = false,
  onCheckedChange,
  name,
  value = 'on',
  form,
  disabled = false,
  required = false,
  id,
  class: className,
  child,
  children,
  onclick,
  onkeydown,
  ref = $bindable(null),
  ...rest
}: Props = $props();

const isControlled = checked !== undefined;
// svelte-ignore state_referenced_locally
const uncontrolledDefault = defaultChecked === true;
// The helper is framework-free (its local value is not a rune), so the
// uncontrolled value lives in this component's own state to stay reactive.
let localChecked = $state(uncontrolledDefault);
const checkedState = createControllableState({
  value: () => (isControlled ? (checked as boolean) : localChecked),
  defaultValue: uncontrolledDefault,
  onChange: (next) => {
    if (isControlled) checked = next;
    else localChecked = next;
    onCheckedChange?.(next);
  },
});

let rootEl: HTMLButtonElement | null = $state(null);
// `ref` follows the element the part binds for its own behavior.
$effect(() => {
  ref = rootEl ?? null;
});
let bridge: FormBridge | null = null;

const isChecked = $derived(checkedState.value);
const dataState = $derived(isChecked ? 'checked' : 'unchecked');

switchContext.set({
  get checked() {
    return checkedState.value;
  },
  get disabled() {
    return Boolean(disabled);
  },
  get id() {
    return id;
  },
});

function syncBridge(): void {
  if (!bridge) return;
  const on = checkedState.value;
  bridge.input.disabled = Boolean(disabled) || !on;
  bridge.setValue(on ? value : '');
  bridge.input.required = Boolean(required) && on;
}

$effect(() => {
  // Track reactive inputs for the bridge.
  void checkedState.value;
  void disabled;
  void required;
  void value;
  void name;
  syncBridge();
});

$effect(() => {
  const node = rootEl;
  const fieldName = name;
  if (!node || !fieldName) {
    bridge?.dispose();
    bridge = null;
    return;
  }
  const doc = getOwnerDocument(node);
  if (!doc) return;
  bridge?.dispose();
  bridge = createFormBridge(doc, {
    name: fieldName,
    value: checkedState.value ? value : '',
    defaultValue: uncontrolledDefault ? value : '',
    required: Boolean(required),
    disabled: Boolean(disabled) || !checkedState.value,
    focusTarget: node,
    ...(form ? { form } : {}),
    onReset: (resetValue) => {
      checkedState.setValue(resetValue === value);
    },
  });
  node.insertAdjacentElement('afterend', bridge.input);
  syncBridge();
  return () => {
    bridge?.dispose();
    bridge = null;
  };
});

function toggle(): void {
  if (disabled) return;
  checkedState.setValue(!checkedState.value);
  checkedState.complete();
}

function handleClick(event: MouseEvent): void {
  onclick?.(event as never);
  if (event.defaultPrevented || disabled) return;
  toggle();
}

function handleKeydown(event: KeyboardEvent): void {
  onkeydown?.(event as never);
  if (event.defaultPrevented || disabled) return;
  if (event.key === ' ' || event.key === 'Enter') {
    event.preventDefault();
    toggle();
  }
}

const attrs = $derived({
  ...rest,
  id,
  type: 'button' as const,
  role: 'switch' as const,
  'aria-checked': isChecked,
  disabled: Boolean(disabled) || undefined,
  class: typeof className === 'string' ? className : undefined,
  ...stateAttributes(dataState === 'checked' ? 'checked' : 'unchecked', Boolean(disabled)),
  onclick: handleClick,
  onkeydown: handleKeydown,
});
</script>

{#if child}
  {@render child({ props: composeChildProps(attrs, {}) })}
{:else}
  <button bind:this={rootEl} {...attrs} data-tx-switch-root>
    {@render children?.()}
  </button>
{/if}
