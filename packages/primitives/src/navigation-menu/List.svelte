<script lang="ts">
import { directionOf } from '@texuli/core/dir-locale';
import { getNavigationIntent } from '@texuli/core/keyboard';
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { navigationMenuContext } from './context.ts';

type ListProps = HTMLAttributes<HTMLUListElement> & { children?: Snippet };

let { children, ...rest }: ListProps = $props();
const context = navigationMenuContext.get();
let list: HTMLUListElement | undefined = $state();

/** The top-level controls: each item's trigger or link (not content inside it). */
function controls(): HTMLElement[] {
  if (!list) return [];
  return Array.from(
    list.querySelectorAll<HTMLElement>(
      ':scope > li > [data-nav-trigger], :scope > li > [data-nav-link]'
    )
  ).filter((element) => !element.hasAttribute('disabled'));
}

// Arrow keys move between top-level controls (each stays a Tab stop too).
function onKeydown(event: KeyboardEvent): void {
  const items = controls();
  const index = items.indexOf(event.target as HTMLElement);
  if (index < 0 || !list) return;
  const intent = getNavigationIntent(event, {
    orientation: context.orientation,
    direction: directionOf(list),
  });
  const target =
    intent === 'next'
      ? items[(index + 1) % items.length]
      : intent === 'previous'
        ? items[(index - 1 + items.length) % items.length]
        : intent === 'first'
          ? items[0]
          : intent === 'last'
            ? items.at(-1)
            : undefined;
  if (!target) return;
  event.preventDefault();
  target.focus();
}
</script>

<ul bind:this={list} data-orientation={context.orientation} {...rest} onkeydown={onKeydown}>
  {@render children?.()}
</ul>
