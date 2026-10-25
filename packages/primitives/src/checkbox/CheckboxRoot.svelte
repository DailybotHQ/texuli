<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLButtonAttributes } from 'svelte/elements';
import { type ChildSnippet, composeChildProps } from '../internal/child.ts';
import { stateAttributes } from '../internal/state.ts';
import { getCheckboxGroupContext } from './context.ts';
import { type CheckboxFormBridge, createCheckboxFormBridge } from './form.ts';

type Props = Omit<HTMLButtonAttributes, 'type' | 'children' | 'value' | 'disabled'> & {
  checked?: boolean;
  defaultChecked?: boolean;
  indeterminate?: boolean;
  defaultIndeterminate?: boolean;
  name?: string;
  value?: string;
  disabled?: boolean;
  required?: boolean;
  form?: string;
  onCheckedChange?: (checked: boolean) => void;
  onIndeterminateChange?: (indeterminate: boolean) => void;
  child?: ChildSnippet<Record<string, unknown>>;
  children?: Snippet<[{ checked: boolean; indeterminate: boolean }]>;
};

let {
  checked = $bindable(),
  defaultChecked = false,
  indeterminate = $bindable(),
  defaultIndeterminate = false,
  name,
  value = 'on',
  disabled = false,
  required = false,
  form,
  id,
  onCheckedChange,
  onIndeterminateChange,
  child,
  children,
  class: className,
  onclick,
  onkeydown,
  ...rest
}: Props = $props();

const group = getCheckboxGroupContext();

// Controlled when the parent passes `checked` (including bind:checked).
const checkedControlled = checked !== undefined;
const indeterminateControlled = indeterminate !== undefined;

// svelte-ignore state_referenced_locally
let localChecked = $state(defaultChecked);
// svelte-ignore state_referenced_locally
let localIndeterminate = $state(defaultIndeterminate);

const isChecked = $derived(
  group && value !== undefined
    ? group.isChecked(String(value))
    : checkedControlled
      ? Boolean(checked)
      : localChecked
);
const isIndeterminate = $derived(
  group ? false : indeterminateControlled ? Boolean(indeterminate) : localIndeterminate
);

const isDisabled = $derived(Boolean(disabled || group?.disabled));
const isRequired = $derived(Boolean(required || group?.required));
const formName = $derived(name ?? group?.name);

function setChecked(next: boolean): void {
  if (group && value !== undefined) {
    const currently = group.isChecked(String(value));
    if (currently === next) return;
    group.toggle(String(value));
    onCheckedChange?.(group.isChecked(String(value)));
    return;
  }
  if (checkedControlled) {
    checked = next;
  } else {
    localChecked = next;
  }
  onCheckedChange?.(next);
}

function setIndeterminate(next: boolean): void {
  if (group) return;
  if (indeterminateControlled) {
    indeterminate = next;
  } else {
    localIndeterminate = next;
  }
  onIndeterminateChange?.(next);
}

function toggle(): void {
  if (isDisabled) return;
  if (isIndeterminate) {
    setIndeterminate(false);
    setChecked(true);
    return;
  }
  setChecked(!isChecked);
}

let rootEl = $state<HTMLButtonElement | null>(null);
let bridge: CheckboxFormBridge | null = null;

$effect(() => {
  const el = rootEl;
  const nm = formName;
  // Group members rely on a single group-level bridge (future); for now each
  // named root owns a bridge. Skip when nested in a group with shared name
  // to avoid duplicate fields — group Root will handle submission later.
  if (!el || !nm || group) {
    bridge?.dispose();
    bridge = null;
    return;
  }
  const next = createCheckboxFormBridge(el.ownerDocument, {
    name: nm,
    value: String(value),
    checked: false,
    required: false,
    disabled: false,
    form,
    focusTarget: el,
    onNativeChange: (nativeChecked) => {
      setIndeterminate(false);
      setChecked(nativeChecked);
    },
  });
  el.insertAdjacentElement('afterend', next.input);
  bridge?.dispose();
  bridge = next;
  return () => {
    next.dispose();
    if (bridge === next) bridge = null;
  };
});

$effect(() => {
  if (!bridge) return;
  bridge.setChecked(isChecked && !isIndeterminate);
  bridge.setDisabled(isDisabled);
  bridge.setRequired(isRequired);
});

function onClick(event: MouseEvent): void {
  if (typeof onclick === 'function') {
    // @ts-expect-error button handler
    onclick(event);
  }
  if (event.defaultPrevented || isDisabled) return;
  toggle();
}

function onKeyDown(event: KeyboardEvent): void {
  if (typeof onkeydown === 'function') {
    // @ts-expect-error button handler
    onkeydown(event);
  }
  if (event.defaultPrevented || isDisabled) return;
  if (event.key === ' ' || event.key === 'Enter') {
    // Checkbox APG: Space toggles. Enter is not required; still prevent scroll on Space.
    if (event.key === ' ') event.preventDefault();
    if (event.key === ' ') toggle();
  }
}

const triggerProps = $derived({
  ...rest,
  id,
  type: 'button' as const,
  role: 'checkbox' as const,
  'aria-checked': (isIndeterminate ? 'mixed' : isChecked ? 'true' : 'false') as
    | 'true'
    | 'false'
    | 'mixed',
  'aria-required': isRequired ? true : undefined,
  disabled: isDisabled ? true : undefined,
  ...stateAttributes(
    isIndeterminate ? 'indeterminate' : isChecked ? 'checked' : 'unchecked',
    isDisabled
  ),
  class: className,
  onclick: onClick,
  onkeydown: onKeyDown,
});
</script>

{#if child}
  {@render child({ props: composeChildProps(triggerProps, {}) })}
{:else}
  <button bind:this={rootEl} {...triggerProps}>
    {#if children}
      {@render children({ checked: isChecked, indeterminate: isIndeterminate })}
    {/if}
  </button>
{/if}
