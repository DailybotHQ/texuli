<script lang="ts">
import { untrack } from 'svelte';
import { composeChildProps } from '../internal/child.ts';
import { composeHandlers } from '../internal/handlers.ts';
import type { ToggleRootAttrs, ToggleRootProps } from './types.ts';

let {
  pressed = $bindable<boolean | undefined>(undefined),
  defaultPressed = false,
  onPressedChange,
  disabled = false,
  child,
  class: className,
  children,
  id,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  'aria-describedby': ariaDescribedby,
  onclick: consumerClick,
  onkeydown: consumerKeydown,
  onkeyup: consumerKeyup,
  ...rest
}: ToggleRootProps & { pressed?: boolean } & Record<string, unknown> = $props();

// defaultPressed seeds uncontrolled state once.
let localPressed = $state(untrack(() => defaultPressed));
const isControlled = $derived(pressed !== undefined);
const isPressed = $derived(isControlled ? (pressed as boolean) : localPressed);
const isDisabled = $derived(Boolean(disabled));

function setPressed(next: boolean): void {
  if (isDisabled) return;
  if (Object.is(isPressed, next)) return;
  if (isControlled) pressed = next;
  else localPressed = next;
  onPressedChange?.(next);
}

let suppressClickUntil = 0;

function toggle(event?: Event): void {
  if (isDisabled) return;
  if (event && 'defaultPrevented' in event && event.defaultPrevented) return;
  setPressed(!isPressed);
}

function onClick(event: MouseEvent): void {
  if (performance.now() < suppressClickUntil) {
    event.preventDefault();
    return;
  }
  toggle(event);
}

/** Space activates on keyup (APG); Enter on keydown. Suppress the follow-up click. */
function onKeydown(event: KeyboardEvent): void {
  if (event.key === ' ') {
    event.preventDefault();
    return;
  }
  if (event.key !== 'Enter') return;
  event.preventDefault();
  suppressClickUntil = performance.now() + 400;
  toggle(event);
}

function onKeyup(event: KeyboardEvent): void {
  if (event.key !== ' ') return;
  event.preventDefault();
  suppressClickUntil = performance.now() + 400;
  toggle(event);
}

const attrs = $derived.by(
  (): ToggleRootAttrs => ({
    type: 'button',
    role: 'button',
    'aria-pressed': isPressed,
    'data-state': isPressed ? 'on' : 'off',
    ...(isDisabled ? { 'data-disabled': '' as const } : {}),
    disabled: isDisabled || undefined,
    tabindex: isDisabled ? -1 : 0,
    onclick: onClick,
    onkeydown: onKeydown,
    onkeyup: onKeyup,
    ...(typeof className === 'string' ? { class: className } : {}),
  })
);

const childProps = $derived(child ? composeChildProps(attrs, {}) : attrs);
</script>

{#if child}
  {@render child({ props: childProps })}
{:else}
  <button
    {id}
    type="button"
    aria-pressed={isPressed}
    aria-label={ariaLabel}
    aria-labelledby={ariaLabelledby}
    aria-describedby={ariaDescribedby}
    data-state={isPressed ? 'on' : 'off'}
    data-disabled={isDisabled ? '' : undefined}
    disabled={isDisabled || undefined}
    tabindex={isDisabled ? -1 : 0}
    class={typeof className === 'string' ? className : undefined}
    {...rest}
    onclick={composeHandlers(consumerClick, onClick)}
    onkeydown={composeHandlers(consumerKeydown, onKeydown)}
    onkeyup={composeHandlers(consumerKeyup, onKeyup)}
  >
    {@render children?.()}
  </button>
{/if}
