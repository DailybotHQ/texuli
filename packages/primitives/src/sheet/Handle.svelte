<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';
import { drawerContext } from './context.ts';

type Props = Omit<HTMLAttributes<HTMLElement>, 'children'> & {
  /** The button's name when the drawer has several snap points. */
  label?: string;
};
let { label = 'Resize', ...rest }: Props = $props();
const drawer = drawerContext.get();

// With several snap points the handle is a button that steps through them
// (the keyboard path); otherwise it is a decorative grip to drag.
function onclick(event: MouseEvent & { currentTarget: EventTarget & HTMLElement }) {
  rest.onclick?.(event);
  if (event.defaultPrevented) return;
  const { snapPoints, activeSnapPoint } = drawer;
  const next = snapPoints[(snapPoints.indexOf(activeSnapPoint) + 1) % snapPoints.length];
  if (next !== undefined) drawer.setSnapPoint(next);
}
</script>

{#if drawer.snapPoints.length > 1}
  <button
    {...rest}
    type="button"
    aria-label={label}
    data-drawer-handle=""
    data-snap-point={drawer.activeSnapPoint}
    style:touch-action="none"
    {onclick}
  ></button>
{:else}
  <div {...rest} aria-hidden="true" data-drawer-handle="" style:touch-action="none"></div>
{/if}
