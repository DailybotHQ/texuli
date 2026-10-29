<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { RefProp } from '../internal/ref.ts';
import { setCheckboxGroupContext } from './context.ts';

type Props = HTMLAttributes<HTMLDivElement> & {
  /** Controlled list of checked item values. */
  value?: string[];
  defaultValue?: string[];
  name?: string;
  disabled?: boolean;
  required?: boolean;
  onValueChange?: (value: string[]) => void;
  children?: Snippet;
} & RefProp;

let {
  value = $bindable(),
  defaultValue = [],
  name,
  disabled = false,
  required = false,
  onValueChange,
  children,
  class: className,
  ref = $bindable(null),
  ...rest
}: Props = $props();

const controlled = value !== undefined;
// svelte-ignore state_referenced_locally
let local = $state<string[]>([...defaultValue]);

const current = $derived(controlled ? (value as string[]) : local);

function setValue(next: string[]): void {
  if (controlled) value = next;
  else local = next;
  onValueChange?.(next);
}

setCheckboxGroupContext({
  get name() {
    return name;
  },
  get disabled() {
    return Boolean(disabled);
  },
  get required() {
    return Boolean(required);
  },
  isChecked: (item) => current.includes(item),
  toggle: (item) => {
    if (disabled) return;
    const next = current.includes(item)
      ? current.filter((entry) => entry !== item)
      : [...current, item];
    setValue(next);
  },
});
</script>

<div bind:this={ref}
  class={className}
  role="group"
  data-tx-checkbox-group=""
  data-disabled={disabled ? '' : undefined}
  {...rest}
>
  {@render children?.()}
</div>
