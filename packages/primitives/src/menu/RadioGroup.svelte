<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { RefProp } from '../internal/ref.ts';
import { menuGroupContext, menuRadioContext } from './context.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** `bind:value`: the checked item's value. */
  value?: string;
  onValueChange?: (value: string) => void;
  children?: Snippet;
} & RefProp;

let {
  value = $bindable(),
  onValueChange,
  children,
  ref = $bindable(null),
  ...rest
}: Props = $props();
let headingId = $state<string | undefined>();

menuGroupContext.set({
  setHeadingId(id) {
    headingId = id;
  },
});
menuRadioContext.set({
  get value() {
    return value;
  },
  select(next) {
    if (value === next) return;
    value = next;
    onValueChange?.(next);
  },
});
</script>

<div bind:this={ref} {...rest} role="group" aria-labelledby={headingId}>{@render children?.()}</div>
