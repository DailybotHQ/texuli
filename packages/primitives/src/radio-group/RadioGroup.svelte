<script lang="ts">
import { createRovingFocus, indexOfSelected } from '@texuli/core/roving';
import type { Attachment } from 'svelte/attachments';
import type { HTMLAttributes } from 'svelte/elements';
import { chainHandlers } from '../internal/handlers.ts';
import type { RefProp } from '../internal/ref.ts';
import { type RadioGroupOrientation, radioGroupContext } from './context.ts';

type Props = HTMLAttributes<HTMLDivElement> & {
  value?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  orientation?: RadioGroupOrientation;
  loop?: boolean;
  class?: string;
  children?: import('svelte').Snippet;
} & RefProp;

let {
  value = $bindable(''),
  onValueChange,
  name,
  required = false,
  disabled = false,
  readonly = false,
  orientation = 'vertical',
  loop = true,
  class: className,
  children,
  onfocusin,
  ref = $bindable(null),
  ...rest
}: Props = $props();

type ItemReg = { value: string; element: HTMLElement; disabled: boolean };
const items: ItemReg[] = [];

function registerItem(item: ItemReg): () => void {
  items.push(item);
  return () => {
    const index = items.indexOf(item);
    if (index >= 0) items.splice(index, 1);
  };
}

function select(next: string): void {
  if (disabled || readonly) return;
  const target = items.find((item) => item.value === next);
  if (!target || target.disabled) return;
  if (value === next) return;
  value = next;
  onValueChange?.(next);
}

radioGroupContext.set({
  value: () => value,
  select,
  disabled: () => disabled,
  readonly: () => readonly,
  orientation: () => orientation,
  loop: () => loop,
  registerItem,
  name: () => name,
  required: () => required,
});

let rootEl = $state<HTMLDivElement | null>(null);
// `ref` follows the element the part binds for its own behavior.
$effect(() => {
  ref = rootEl ?? null;
});
let proxyInput: HTMLInputElement | undefined;
const resetValue = value;

function installProxy(el: HTMLDivElement, field: string): HTMLInputElement {
  const input = el.ownerDocument.createElement('input');
  input.type = 'text';
  input.name = field;
  input.defaultValue = resetValue;
  input.value = value;
  input.required = required;
  input.disabled = disabled;
  input.tabIndex = -1;
  input.setAttribute('aria-hidden', 'true');
  input.setAttribute('data-tx-form-bridge', '');
  input.setAttribute('autocomplete', 'off');
  input.style.cssText =
    'position:absolute;inline-size:1px;block-size:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0';
  const onInvalid = () => {
    queueMicrotask(() => el.focus());
  };
  input.addEventListener('invalid', onInvalid);
  const onReset = (event: Event) => {
    if (event.target !== input.form) return;
    queueMicrotask(() => {
      if (!event.defaultPrevented) {
        value = input.defaultValue;
        onValueChange?.(input.defaultValue);
      }
    });
  };
  el.ownerDocument.addEventListener('reset', onReset, true);
  el.append(input);
  (input as HTMLInputElement & { __txDispose?: () => void }).__txDispose = () => {
    input.removeEventListener('invalid', onInvalid);
    el.ownerDocument.removeEventListener('reset', onReset, true);
    input.remove();
  };
  return input;
}

$effect(() => {
  const el = rootEl;
  const field = name;
  if (!el || field === undefined || field === '') {
    (proxyInput as (HTMLInputElement & { __txDispose?: () => void }) | undefined)?.__txDispose?.();
    proxyInput = undefined;
    return;
  }
  const input = installProxy(el, field);
  proxyInput = input;
  return () => {
    (input as HTMLInputElement & { __txDispose?: () => void }).__txDispose?.();
    if (proxyInput === input) proxyInput = undefined;
  };
});

$effect(() => {
  if (proxyInput) proxyInput.value = value;
});

function attachRadioRoving(): Attachment<HTMLElement> {
  return (root) => {
    const getItems = () =>
      Array.from(
        root.querySelectorAll<HTMLElement>(
          '[data-tx-radio-item]:not([disabled]):not([data-disabled])'
        )
      );
    const roving = createRovingFocus({
      items: getItems,
      orientation,
      wrap: loop,
      // Read per key press, so horizontal arrows mirror in right-to-left text.
      direction: root,
      // The checked radio is the tab stop (APG), not the first radio.
      selected: () => indexOfSelected(getItems()),
    });
    roving.sync();
    const onKeydown = (event: KeyboardEvent) => roving.handleKeydown(event);
    const onFocus = (event: FocusEvent) => roving.handleFocusIn(event);
    root.addEventListener('keydown', onKeydown);
    root.addEventListener('focusin', onFocus);
    const MutationObserverCtor = root.ownerDocument.defaultView?.MutationObserver;
    const observer = MutationObserverCtor
      ? new MutationObserverCtor(() => roving.sync())
      : undefined;
    observer?.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['disabled', 'data-disabled', 'aria-checked'],
    });
    return () => {
      observer?.disconnect();
      root.removeEventListener('keydown', onKeydown);
      root.removeEventListener('focusin', onFocus);
    };
  };
}

const roving = $derived(attachRadioRoving());

function onFocusIn(event: FocusEvent): void {
  if (disabled || readonly) return;
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (!target.hasAttribute('data-tx-radio-item')) return;
  if (target.hasAttribute('disabled') || target.hasAttribute('data-disabled')) return;
  const next = target.getAttribute('data-value');
  if (next) select(next);
}
</script>

<div
  bind:this={rootEl}
  role="radiogroup"
  class={className}
  data-orientation={orientation}
  data-disabled={disabled ? '' : undefined}
  aria-disabled={disabled ? 'true' : undefined}
  aria-orientation={orientation}
  {@attach roving}
  {...rest}
  onfocusin={chainHandlers(onfocusin, onFocusIn)}
>
  {@render children?.()}
</div>
