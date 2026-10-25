<script lang="ts">
import type { ComponentProps, Snippet } from 'svelte';
import ComboboxRoot from './ComboboxRoot.svelte';

type Props = Omit<ComponentProps<typeof ComboboxRoot>, 'multiple'> & {
  children?: Snippet;
};

let {
  children,
  open = $bindable(false),
  value = $bindable<string[] | readonly string[] | undefined>(undefined),
  inputValue = $bindable(),
  class: className,
  ...rest
}: Props = $props();
</script>

<!-- MultiSelect is Combobox with multiple selection and chip chrome. -->
<ComboboxRoot
  bind:open
  bind:value
  bind:inputValue
  multiple={true}
  class={['tx-multiselect-root', className]
    .filter(Boolean)
    .join(' ')}
  {...rest}
>
  {@render children?.()}
</ComboboxRoot>
