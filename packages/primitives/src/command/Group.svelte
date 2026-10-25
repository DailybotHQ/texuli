<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { commandContext, commandGroupContext } from './context.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  children?: Snippet;
  disabled?: boolean;
  value: string;
};
let { children, disabled = false, value, id, ...rest }: Props = $props();
const command = commandContext.get();
const generatedId = $props.id();
const headingId = $derived(`${id ?? generatedId}-heading`);
commandGroupContext.set({
  get value() {
    return value;
  },
  get disabled() {
    return disabled;
  },
  get headingId() {
    return headingId;
  },
});
</script>

<div
  {...rest}
  id={id}
  role="group"
  aria-label={value}
  hidden={!command.isGroupVisible(value)}
  data-state={disabled ? 'disabled' : 'enabled'}
  data-disabled={disabled ? '' : undefined}
  data-command-group=""
>
  {@render children?.()}
</div>
