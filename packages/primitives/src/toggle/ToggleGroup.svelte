<script lang="ts">
import { indexOfSelected } from '@texuli/core/roving';
import { untrack } from 'svelte';
import { attachRovingFocus } from '../internal/attachments.ts';
import type { ToggleGroupContext } from './context.ts';
import { toggleGroupContext } from './context.ts';
import type { ToggleGroupOrientation, ToggleGroupRootProps, ToggleGroupType } from './types.ts';

let {
  type = 'single' as ToggleGroupType,
  value = $bindable<string | string[] | undefined>(undefined),
  defaultValue,
  onValueChange,
  disabled = false,
  loop = true,
  orientation = 'horizontal' as ToggleGroupOrientation,
  rovingFocus = true,
  class: className,
  children,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  name,
  form,
  ...rest
}: ToggleGroupRootProps & { value?: string | string[] } & Record<string, unknown> = $props();

// type / defaultValue seed uncontrolled state once.
let localValue = $state<string | string[]>(
  untrack(() =>
    defaultValue !== undefined ? defaultValue : type === 'multiple' ? ([] as string[]) : ''
  )
);
const isControlled = $derived(value !== undefined);
const current = $derived(isControlled ? (value as string | string[]) : localValue);
const isDisabled = $derived(Boolean(disabled));

function normalize(v: string | string[]): string[] {
  return Array.isArray(v) ? v : v ? [v] : [];
}

function setValue(next: string | string[]): void {
  if (Object.is(current, next)) return;
  if (isControlled) value = next;
  else localValue = next;
  onValueChange?.(next);
}

function isPressed(itemValue: string): boolean {
  if (type === 'multiple') return normalize(current).includes(itemValue);
  return current === itemValue;
}

function toggle(itemValue: string): void {
  if (isDisabled) return;
  if (type === 'multiple') {
    const list = normalize(current);
    const next = list.includes(itemValue)
      ? list.filter((v) => v !== itemValue)
      : [...list, itemValue];
    setValue(next);
    return;
  }
  setValue(current === itemValue ? '' : itemValue);
}

function register(_itemValue: string, _el: HTMLElement | null): void {}

const ctx: ToggleGroupContext = {
  get type() {
    return type;
  },
  get orientation() {
    return orientation;
  },
  get loop() {
    return loop;
  },
  get rovingFocus() {
    return rovingFocus;
  },
  get disabled() {
    return isDisabled;
  },
  isPressed,
  toggle,
  register,
};

toggleGroupContext.set(ctx);

const rovingAttachment = attachRovingFocus({
  orientation: untrack(() => orientation),
  wrap: untrack(() => loop),
  items: (root) =>
    Array.from(
      root.querySelectorAll<HTMLElement>('[data-roving-item]:not([disabled]):not([data-disabled])')
    ),
  // The first pressed item is the tab stop (fallback: the first enabled item),
  // for single (APG radio-like group) and multiple selection alike.
  selected: indexOfSelected,
});
</script>

{#snippet fields()}
  {#if name}
    <!-- Deduped: a repeated value submits once (and a keyed each never sees a duplicate key). -->
    {#each [...new Set(normalize(current))] as pressed (pressed)}
      <input type="hidden" {name} {form} value={pressed} disabled={isDisabled || undefined} />
    {/each}
  {/if}
{/snippet}

{#if rovingFocus}
  <div
    role="group"
    class={typeof className === 'string' ? className : undefined}
    data-orientation={orientation}
    data-disabled={disabled ? '' : undefined}
    aria-label={ariaLabel}
    aria-labelledby={ariaLabelledby}
    {@attach rovingAttachment}
    {...rest}
  >
    {@render children?.()}
    {@render fields()}
  </div>
{:else}
  <div
    role="group"
    class={typeof className === 'string' ? className : undefined}
    data-orientation={orientation}
    data-disabled={disabled ? '' : undefined}
    aria-label={ariaLabel}
    aria-labelledby={ariaLabelledby}
    {...rest}
  >
    {@render children?.()}
    {@render fields()}
  </div>
{/if}
