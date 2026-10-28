<script lang="ts">
import { composeChildProps } from '../internal/child.ts';
import { composeHandlers } from '../internal/handlers.ts';
import { toggleGroupContext } from './context.ts';
import type { ToggleGroupItemAttrs, ToggleGroupItemProps } from './types.ts';

let {
  value,
  disabled = false,
  child,
  class: className,
  children,
  id,
  'aria-label': ariaLabel,
  onclick: consumerClick,
  onkeydown: consumerKeydown,
  onkeyup: consumerKeyup,
  ...rest
}: ToggleGroupItemProps & Record<string, unknown> = $props();

const group = toggleGroupContext.get();
const isDisabled = $derived(Boolean(disabled) || group.disabled);
const isPressed = $derived(group.isPressed(value));

let node = $state<HTMLElement | null>(null);

$effect(() => {
  group.register(value, isDisabled ? null : node);
  return () => group.register(value, null);
});

function onClick(event: MouseEvent): void {
  if (isDisabled) return;
  if (event.defaultPrevented) return;
  group.toggle(value);
}

function onKeydown(event: KeyboardEvent): void {
  if (isDisabled) return;
  if (event.key === ' ') {
    event.preventDefault();
    return;
  }
  if (event.key !== 'Enter') return;
  event.preventDefault();
  group.toggle(value);
}

function onKeyup(event: KeyboardEvent): void {
  if (isDisabled) return;
  if (event.key !== ' ') return;
  event.preventDefault();
  group.toggle(value);
}

const attrs = $derived.by((): ToggleGroupItemAttrs => {
  const state = isPressed ? 'on' : 'off';
  return {
    type: 'button',
    role: 'button',
    value,
    'aria-pressed': isPressed,
    'data-state': state,
    ...(isDisabled ? { 'data-disabled': '' as const } : {}),
    ...(group.rovingFocus && !isDisabled ? { 'data-roving-item': '' as const } : {}),
    disabled: isDisabled || undefined,
    tabindex: isDisabled ? -1 : group.rovingFocus ? -1 : 0,
    onclick: onClick,
    onkeydown: onKeydown,
    onkeyup: onKeyup,
    ...(typeof className === 'string' ? { class: className } : {}),
  };
});

const childProps = $derived(child ? composeChildProps(attrs, {}) : attrs);

function bindNode(el: HTMLElement | null): void {
  node = el;
}
</script>

{#if child}
  {@render child({ props: childProps })}
{:else}
  <button
    {id}
    type="button"
    value={attrs.value}
    aria-pressed={attrs['aria-pressed']}
    aria-label={ariaLabel}
    data-state={attrs['data-state']}
    data-disabled={attrs['data-disabled']}
    data-roving-item={attrs['data-roving-item']}
    disabled={attrs.disabled}
    tabindex={attrs.tabindex}
    class={attrs.class}
    {@attach (el) => {
      bindNode(el);
      return () => bindNode(null);
    }}
    {...rest}
    onclick={composeHandlers(consumerClick, attrs.onclick)}
    onkeydown={composeHandlers(consumerKeydown, attrs.onkeydown)}
    onkeyup={composeHandlers(consumerKeyup, attrs.onkeyup)}
  >
    {@render children?.()}
  </button>
{/if}
