<script lang="ts">
import {
  createInfiniteLoader,
  createVirtualList,
  nextVirtualListIndex,
} from '@texuli/data/virtual-list';

interface Row {
  id: number;
  title: string;
  detail: string;
}

const PAGE_SIZE = 12;
const MAX_ROWS = 60;
const list = createVirtualList({ count: PAGE_SIZE, estimateSize: 72, overscan: 4 });
let rows = $state(createRows(0, PAGE_SIZE));
let scrollTop = $state(0);
let viewportSize = $state(320);
let revision = $state(0);
let activeIndex = $state(0);
let status = $state<'idle' | 'loading' | 'error' | 'exhausted'>('idle');
let viewport: HTMLDivElement;

const loader = createInfiniteLoader({
  getItemCount: () => rows.length,
  hasMore: () => rows.length < MAX_ROWS,
  threshold: 4,
  loadMore: async () => {
    const start = rows.length;
    rows = [...rows, ...createRows(start, Math.min(start + PAGE_SIZE, MAX_ROWS))];
    list.resize(rows.length);
  },
});

function createRows(start: number, end: number): Row[] {
  return Array.from({ length: Math.max(0, end - start) }, (_, offset) => {
    const id = start + offset + 1;
    return {
      id,
      title: `Record ${id}`,
      detail:
        id % 4 === 0
          ? 'This entry has a longer description, so its height differs from nearby rows.'
          : `Updated today · item ${id}`,
    };
  });
}

const visible = $derived.by(() => {
  revision;
  return list.window(scrollTop, viewportSize);
});

async function checkMore(): Promise<void> {
  await loader.check(visible.end);
  status = loader.status;
  revision += 1;
}

function onScroll(event: Event): void {
  const element = event.currentTarget;
  if (!(element instanceof HTMLElement)) return;
  scrollTop = element.scrollTop;
  viewportSize = element.clientHeight;
  revision += 1;
  void checkMore();
}

function onKeydown(event: KeyboardEvent): void {
  const next = nextVirtualListIndex(activeIndex, event.key, {
    count: rows.length,
    orientation: 'vertical',
    direction: 'rtl',
    pageSize: 5,
  });
  if (next === null) return;
  event.preventDefault();
  activeIndex = next;
  const top = list.offsetOf(next);
  const bottom = top + list.sizeOf(next);
  if (top < viewport.scrollTop) viewport.scrollTop = top;
  else if (bottom > viewport.scrollTop + viewport.clientHeight)
    viewport.scrollTop = bottom - viewport.clientHeight;
  scrollTop = viewport.scrollTop;
  revision += 1;
}

function measureRow(node: HTMLElement, index: number): { destroy: () => void } {
  const ResizeObserver = node.ownerDocument.defaultView?.ResizeObserver;
  if (!ResizeObserver) return { destroy() {} };
  const observer = new ResizeObserver((entries) => {
    const entry = entries[0];
    const size = entry?.borderBoxSize[0]?.blockSize ?? entry?.contentRect.height;
    if (size && list.measure(index, size)) revision += 1;
  });
  observer.observe(node);
  return { destroy: () => observer.disconnect() };
}

async function retry(): Promise<void> {
  loader.resetError();
  status = 'idle';
  await checkMore();
}
</script>

<section class="demo" aria-labelledby="virtual-list-title" dir="rtl">
  <h2 id="virtual-list-title">Variable-height virtual list</h2>
  <p>Use the arrow keys, Home, End and Page Up/Down to move through the list.</p>
  <div
    bind:this={viewport}
    class="viewport"
    role="listbox"
    aria-label="Fictional records"
    aria-activedescendant="record-{rows[activeIndex]?.id ?? 0}"
    tabindex="0"
    onscroll={onScroll}
    onkeydown={onKeydown}
  >
    <div class="canvas" style:block-size="{visible.totalSize}px">
      {#each visible.items as item (rows[item.index]?.id)}
        {@const row = rows[item.index]}
        {#if row}
          <div
            class="row"
            id="record-{row.id}"
            role="option"
            tabindex="-1"
            aria-posinset={item.index + 1}
            aria-setsize={rows.length}
            aria-selected={activeIndex === item.index}
            use:measureRow={item.index}
            style:inset-block-start="{item.start}px"
            style:block-size="{item.size}px"
          >
            <strong>{row.title}</strong>
            <span>{row.detail}</span>
          </div>
        {/if}
      {/each}
    </div>
  </div>
  <p class="status" aria-live="polite">
    {#if status === 'loading'}Loading more records…
    {:else if status === 'error'}Could not load more records.
    {:else if status === 'exhausted'}All {rows.length} records loaded.
    {:else}{rows.length} fictional records loaded.{/if}
  </p>
  {#if status === 'error'}
    <button type="button" onclick={retry}>Retry loading records</button>
  {/if}
</section>

<style>
  .demo {
    color: var(--tx-foreground, var(--tx-color-text, CanvasText));
    inline-size: min(100%, 34rem);
  }

  .viewport {
    block-size: 20rem;
    border: 1px solid var(--tx-color-border, #9ba6b8);
    border-radius: 0.5rem;
    overflow: auto;
    overscroll-behavior: contain;
  }

  .viewport:focus-visible {
    outline: 2px solid var(--tx-color-focus, #075ea8);
    outline-offset: 2px;
  }

  .canvas {
    position: relative;
  }

  .row {
    position: absolute;
    inset-inline: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 0.25rem;
    box-sizing: border-box;
    border-block-end: 1px solid var(--tx-color-border, #d6dbe4);
    padding-inline: 0.75rem;
    padding-block: 0.5rem;
    overflow: hidden;
  }

  .row span {
    color: var(--tx-foreground, CanvasText);
  }

  .status {
    min-block-size: 1.5em;
  }

  @media (forced-colors: active) {
    .viewport,
    .row {
      border-color: CanvasText;
    }
  }
</style>
