<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLButtonAttributes } from 'svelte/elements';
import { type ChildSnippet, composeChildProps } from '../internal/child.ts';
import type { RefProp } from '../internal/ref.ts';
import { numberFieldContext } from './context.ts';
import { createPressRepeat } from './press-repeat.ts';

/**
 * A stepper button (shared by Increment and Decrement). Out of the Tab order
 * (the spinbutton's arrow keys do the same), labeled, `aria-controls` the
 * input, disabled at its bound. Pointer and touch press-and-hold repeats;
 * the press keeps focus where it was (mouse focuses the input, touch does
 * not pop the keyboard). Assistive-technology activation (a click with no
 * pointer press) steps once.
 */
type StepperProps = HTMLButtonAttributes & {
  direction: 1 | -1;
  child?: ChildSnippet<Record<string, unknown>>;
  children?: Snippet;
};

let {
  direction,
  child,
  children,
  ref = $bindable(null),
  ...rest
}: StepperProps & RefProp = $props();
const field = numberFieldContext.get();

const enabled = $derived(direction > 0 ? field.canIncrement : field.canDecrement);
let pressed = $state(false);
const repeat = createPressRepeat({
  step: () => {
    const can = direction > 0 ? field.canIncrement : field.canDecrement;
    if (!can) return false;
    field.stepBy(direction);
    return direction > 0 ? field.canIncrement : field.canDecrement;
  },
});

function release() {
  repeat.stop();
  pressed = false;
}

$effect(() => release);

const baseProps = $derived({
  type: 'button' as const,
  tabindex: -1,
  'aria-label': direction > 0 ? field.incrementLabel : field.decrementLabel,
  'aria-controls': field.inputId,
  disabled: !enabled,
  'data-disabled': enabled ? undefined : '',
  'data-pressed': pressed ? '' : undefined,
  onpointerdown: (event: PointerEvent) => {
    if (!enabled || (event.pointerType === 'mouse' && event.button !== 0)) return;
    // Keep focus and selection where they are; no emulated mouse after touch.
    event.preventDefault();
    if (event.pointerType !== 'touch') field.focusInput();
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    pressed = true;
    repeat.start();
  },
  onpointerup: release,
  onpointercancel: release,
  onlostpointercapture: release,
  onclick: (event: MouseEvent) => {
    // A click with no pointer press: keyboard or assistive technology.
    if (event.detail === 0 && enabled) field.stepBy(direction);
  },
});
const buttonProps = $derived(composeChildProps(baseProps, rest as Partial<typeof baseProps>));
</script>

{#if child}
  {@render child({ props: buttonProps })}
{:else}
  <button bind:this={ref} {...buttonProps} style:touch-action="manipulation">
    {#if children}{@render children()}{:else}<span aria-hidden="true">{direction > 0 ? '+' : '\u2212'}</span>{/if}
  </button>
{/if}
