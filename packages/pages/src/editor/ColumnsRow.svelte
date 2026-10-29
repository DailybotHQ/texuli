<script lang="ts">
// Columns: each column is a block list; between two columns sits an APG
// window splitter (`role="separator"`, focusable, with a value). Arrow keys
// move one twelfth (flipped in right-to-left text), Home and End go to the
// limits; a pointer drag (the `@texuli/drag` gesture tracker) previews the
// widths live and commits one transaction on release, and Escape or a
// pointer cancel restores them.

import type { ColumnsBlock } from '@texuli/document/model';
import { bindPointerGesture, createPointerTracker } from '@texuli/drag/gesture';
import BlockList from './BlockList.svelte';
import { columnWidths, MIN_COLUMN_WIDTH, pointerSteps, resizeColumns } from './columns.ts';
import { getPagesContext } from './context.ts';

let { block }: { block: ColumnsBlock } = $props();
const context = getPagesContext();
const editor = context.editor;
const labels = $derived(editor.labels);
const uid = $props.id();

const stored = $derived(columnWidths(block.columns));
/** Widths while a pointer drag previews them. */
let preview = $state.raw<number[] | null>(null);
const widths = $derived(preview ?? stored);
let row = $state<HTMLDivElement | null>(null);

function commit(next: readonly number[] | null, index: number): void {
  if (!next) return;
  if (editor.setColumnWidths(block.id, next))
    editor.say(labels.resized(index + 1, next[index] as number));
}

function rtl(): boolean {
  return row ? getComputedStyle(row).direction === 'rtl' : false;
}

function onkeydown(event: KeyboardEvent, index: number): void {
  if (context.readonly()) return;
  const flip = rtl() ? -1 : 1;
  let steps = 0;
  const before = widths[index] ?? 0;
  const after = widths[index + 1] ?? 0;
  if (event.key === 'ArrowRight') steps = flip;
  else if (event.key === 'ArrowLeft') steps = -flip;
  else if (event.key === 'Home') steps = MIN_COLUMN_WIDTH - before;
  else if (event.key === 'End') steps = after - MIN_COLUMN_WIDTH;
  else if (event.key === 'Escape' && preview) {
    preview = null;
    event.preventDefault();
    return;
  } else return;
  event.preventDefault();
  commit(resizeColumns(widths, index, steps), index);
}

function grip(index: number) {
  return (node: HTMLElement) => {
    let start: number[] = [];
    const tracker = createPointerTracker({
      axis: 'x',
      onStart: () => {
        start = [...stored];
        preview = start;
      },
      onMove: (event) => {
        const size = row?.getBoundingClientRect().width ?? 0;
        const steps = pointerSteps(event.delta.x * (rtl() ? -1 : 1), size);
        preview = resizeColumns(start, index, steps) ?? start;
      },
      onEnd: () => {
        const next = preview;
        preview = null;
        if (next?.some((width, i) => width !== start[i])) commit(next, index);
      },
      onCancel: () => {
        preview = null;
      },
    });
    const dispose = bindPointerGesture(node, tracker);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && tracker.phase !== 'idle') tracker.cancel();
    };
    node.ownerDocument.addEventListener('keydown', onKey, true);
    return () => {
      dispose();
      node.ownerDocument.removeEventListener('keydown', onKey, true);
    };
  };
}
</script>

<div
  class="tx-pages-columns"
  bind:this={row}
  style:grid-template-columns={widths
    .map((width, index) => (index < widths.length - 1 ? `${width}fr auto` : `${width}fr`))
    .join(' ')}
  data-resizing={preview ? '' : undefined}
>
  {#each block.columns as column, index (column.id)}
    <div class="tx-pages-column" id={`${uid}-${column.id}`} data-column={column.id}>
      <BlockList parent={column.id} blocks={column.blocks} label={labels.column(index + 1, block.columns.length)} />
    </div>
    {#if index < block.columns.length - 1}
      <!-- A focusable separator is the APG window splitter widget. -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
      <div
        class="tx-pages-columns__separator"
        role="separator"
        aria-orientation="vertical"
        aria-label={labels.columnsResize(index + 1)}
        aria-controls={`${uid}-${column.id}`}
        aria-valuenow={widths[index]}
        aria-valuemin={MIN_COLUMN_WIDTH}
        aria-valuemax={(widths[index] ?? 0) + (widths[index + 1] ?? 0) - MIN_COLUMN_WIDTH}
        aria-valuetext={labels.resized(index + 1, widths[index] ?? 0)}
        tabindex={context.readonly() ? -1 : 0}
        data-index={index}
        onkeydown={(event) => onkeydown(event, index)}
        {@attach grip(index)}
      ></div>
    {/if}
  {/each}
</div>
