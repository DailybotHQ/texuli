<script lang="ts">
import type { Snippet } from 'svelte';
import { menuLevelContext } from './context.ts';
import { createMenuLevel } from './level.ts';

interface Props {
  /** Whether the menu is open (`bind:open`). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Arrow keys wrap from the last item to the first. Default `true`. */
  loop?: boolean;
  children?: Snippet;
}

let { open = $bindable(false), onOpenChange, loop = true, children }: Props = $props();

const uid = $props.id();
/** Consumer ids claimed by the trigger and content; they win over the generated ones. */
const claims = $state<{ trigger?: string; content?: string }>({});
const level = createMenuLevel({
  claims,
  id: uid,
  parent: null,
  getOpen: () => open,
  setOpenValue(next) {
    open = next;
    onOpenChange?.(next);
  },
  loop: () => loop,
});
menuLevelContext.set(level);
</script>

{@render children?.()}
