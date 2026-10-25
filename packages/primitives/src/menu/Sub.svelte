<script lang="ts">
import type { Snippet } from 'svelte';
import { menuLevelContext } from './context.ts';
import { createMenuLevel } from './level.ts';

interface Props {
  /** Whether the submenu is open (`bind:open`). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: Snippet;
}

let { open = $bindable(false), onOpenChange, children }: Props = $props();

const parent = menuLevelContext.get();
const uid = $props.id();
/** Consumer ids claimed by the trigger and content; they win over the generated ones. */
const claims = $state<{ trigger?: string; content?: string }>({});
const level = createMenuLevel({
  claims,
  id: uid,
  parent,
  getOpen: () => open,
  setOpenValue(next) {
    open = next;
    onOpenChange?.(next);
  },
  loop: () => parent.loop,
});
menuLevelContext.set(level);

$effect(() => parent.addChild(level));
</script>

{@render children?.()}
