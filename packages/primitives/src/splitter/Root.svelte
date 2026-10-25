<script lang="ts">
import { type Snippet, untrack } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { type SplitterPaneEntry, splitterContext } from './context.ts';
import { initialLayout, type SplitterDirection } from './model.ts';
import { loadLayout, type SplitterStorage, saveLayout } from './storage.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** `horizontal`: panes side by side. `vertical`: stacked. */
  direction?: SplitterDirection;
  /** Pane sizes in percent (bindable). Set it to restore a layout. */
  layout?: number[];
  /** Called with the new layout after every change. */
  onLayoutChange?: (layout: number[]) => void;
  /** With `storage`, the key the layout is saved under and restored from. */
  autoSaveId?: string;
  /** Where to save the layout, e.g. `localStorage`. */
  storage?: SplitterStorage;
  /** Percent per arrow key press. Default 10. */
  keyboardStep?: number;
  disabled?: boolean;
  ref?: HTMLElement | null;
  children?: Snippet;
};

let {
  direction = 'horizontal',
  layout = $bindable(),
  onLayoutChange,
  autoSaveId,
  storage,
  keyboardStep = 10,
  disabled = false,
  ref = $bindable(null),
  children,
  ...rest
}: Props = $props();

let panes: SplitterPaneEntry[] = $state([]);
let sizes: number[] = $state([]);

function order(entries: readonly SplitterPaneEntry[]): SplitterPaneEntry[] {
  return [...entries].sort((a, b) => {
    if (!a.node || !b.node) return 0;
    return a.node.compareDocumentPosition(b.node) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
  });
}

const ordered = $derived(order(panes));

// A pane added or removed starts a fresh layout: the bound one, a saved one, or the defaults.
$effect(() => {
  const constraints = ordered.map((pane) => pane.constraints);
  if (sizes.length === constraints.length) return;
  const restored = layout?.length === constraints.length ? layout : loadLayout(storage, autoSaveId);
  sizes = initialLayout(constraints, restored);
  layout = sizes;
});

// A layout bound from outside wins.
$effect(() => {
  if (
    layout &&
    layout.length === sizes.length &&
    layout.some((size, index) => size !== sizes[index])
  ) {
    sizes = initialLayout(
      ordered.map((pane) => pane.constraints),
      layout
    );
  }
});

const context = {
  get direction() {
    return direction;
  },
  get layout() {
    return sizes;
  },
  get panes() {
    return ordered;
  },
  get keyboardStep() {
    return keyboardStep;
  },
  get disabled() {
    return disabled;
  },
  registerPane(entry: SplitterPaneEntry) {
    // Untracked: a pane registers from its own effect, which must not depend on the list.
    untrack(() => {
      panes = [...panes, entry];
    });
    return () => {
      untrack(() => {
        panes = panes.filter((pane) => pane !== entry);
      });
    };
  },
  handleIndex(node: HTMLElement) {
    return (
      ordered.filter(
        (pane) =>
          pane.node && pane.node.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING
      ).length - 1
    );
  },
  isRtl() {
    return ref ? getComputedStyle(ref).direction === 'rtl' : false;
  },
  groupSize() {
    const box = ref?.getBoundingClientRect();
    return (direction === 'horizontal' ? box?.width : box?.height) ?? 0;
  },
  setLayout(next: number[], commit: boolean) {
    if (next.every((size, index) => size === sizes[index])) {
      if (commit) saveLayout(storage, autoSaveId, sizes);
      return;
    }
    sizes = next;
    layout = next;
    onLayoutChange?.(next);
    if (commit) saveLayout(storage, autoSaveId, next);
  },
};
splitterContext.set(context);

const attrs = $derived({
  ...rest,
  'data-splitter-group': '',
  'data-direction': direction,
  'data-disabled': disabled ? '' : undefined,
});
</script>

<div
  bind:this={ref}
  {...attrs}
  style:display="flex"
  style:flex-direction={direction === 'horizontal' ? 'row' : 'column'}
>
  {@render children?.()}
</div>
