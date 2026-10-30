<script lang="ts">
import { type Snippet, untrack } from 'svelte';
import { getDashboardContext } from './context.ts';

/**
 * One widget of a `Dashboard`. It paints nothing where it is written: it
 * registers its title, placement and content with the enclosing dashboard,
 * which paints every widget in reading order (row, then column), so the DOM
 * and screen-reader order always follow the grid.
 */
interface DashboardWidgetProps {
  /** Stable id (letters, digits, `-` and `_`): the key of this widget in every layout. */
  id: string;
  /** Visible title; it also names the widget's handles. */
  title: string;
  /** Column on the widest grid when the dashboard has no layout for this widget. */
  x?: number;
  /** Row on the widest grid when the dashboard has no layout for this widget. */
  y?: number;
  /** Width in columns (default 4, or the grid's width when narrower). */
  w?: number;
  /** Height in rows (default 3). */
  h?: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  /** A locked widget never moves or resizes, and nothing is pushed through it. */
  locked?: boolean;
  children?: Snippet;
}

let { id, title, x, y, w, h, minW, minH, maxW, maxH, locked, children }: DashboardWidgetProps =
  $props();

const context = getDashboardContext();
// Registered while the dashboard renders (so server rendering paints the
// widget too); `untrack` because this runs inside the dashboard's render.
const unregister = untrack(() =>
  context?.register({
    get id() {
      return id;
    },
    get title() {
      return title;
    },
    get place() {
      return { x, y, w, h, minW, minH, maxW, maxH, locked };
    },
    get content() {
      return children;
    },
  })
);
$effect(() => () => unregister?.());
</script>

{#if !context && children}
  <!-- Outside a Dashboard the widget paints its content in place. -->
  {@render children()}
{/if}
