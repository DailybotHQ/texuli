<script lang="ts">
import type { Snippet } from 'svelte';
import MenuRoot from '../menu/Root.svelte';
import { menubarContext, menubarMenuContext } from './context.ts';

/** One menu of the bar: a trigger and its content. Open while the bar's value is this menu's. */
interface Props {
  /** Unique within the bar. Default: generated. */
  value?: string;
  onOpenChange?: (open: boolean) => void;
  children?: Snippet;
}

let { value, onOpenChange, children }: Props = $props();

const bar = menubarContext.get();
const uid = $props.id();
const own = $derived(value ?? uid);
menubarMenuContext.set({
  get value() {
    return own;
  },
});
</script>

<MenuRoot
  bind:open={
    () => bar.value === own,
    (next) => {
      if (next) bar.setValue(own);
      else if (bar.value === own) bar.setValue('');
    }
  }
  {onOpenChange}
>
  {@render children?.()}
</MenuRoot>
