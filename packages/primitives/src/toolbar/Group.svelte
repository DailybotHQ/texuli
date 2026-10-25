<script lang="ts">
import { type Snippet, untrack } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { type ToolbarGroupType, toolbarGroupContext } from './context.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'role' | 'children'> & {
  /** `single`: one choice (a radio group). `multiple`: independent toggles. */
  type?: ToolbarGroupType;
  /** The pressed value (`single`) or values (`multiple`). Bindable. */
  value?: string | string[];
  onValueChange?: (value: string | string[]) => void;
  disabled?: boolean;
  children?: Snippet;
};

let {
  type = 'single',
  value = $bindable(),
  onValueChange,
  disabled = false,
  children,
  ...rest
}: Props = $props();

let local = $state<string | string[]>(untrack(() => value ?? (type === 'multiple' ? [] : '')));
const current = $derived(value ?? local);
const list = (input: string | string[]) => (Array.isArray(input) ? input : input ? [input] : []);

toolbarGroupContext.set({
  get type() {
    return type;
  },
  get disabled() {
    return disabled;
  },
  isPressed: (item) => list(current).includes(item),
  toggle(item) {
    if (disabled) return;
    const pressed = list(current).includes(item);
    const next =
      type === 'multiple'
        ? pressed
          ? list(current).filter((entry) => entry !== item)
          : [...list(current), item]
        : pressed
          ? ''
          : item;
    local = next;
    value = next;
    onValueChange?.(next);
  },
});
</script>

<div {...rest} role={type === 'single' ? 'radiogroup' : 'group'} data-toolbar-group="" data-type={type}>
  {@render children?.()}
</div>
