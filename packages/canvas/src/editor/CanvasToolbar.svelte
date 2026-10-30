<script lang="ts">
// The tools palette and commands as one WAI-ARIA toolbar: one tab stop,
// arrow keys (Home, End) between buttons, tools as toggle buttons.
import type { CanvasController } from './controller.svelte.ts';
import { CANVAS_TOOLS, type CanvasTool } from './keyboard.ts';

interface Props {
  controller: CanvasController;
  /** Tools to offer (default all; read-only editors offer select and pan). */
  tools?: readonly CanvasTool[];
}

let { controller, tools = CANVAS_TOOLS }: Props = $props();

const GLYPHS: Record<CanvasTool, string> = {
  select: '↖',
  hand: '✋',
  rect: '▭',
  ellipse: '◯',
  diamond: '◇',
  line: '╱',
  arrow: '↗',
  draw: '✎',
  text: 'T',
  sticky: '▤',
  frame: '⬚',
  connector: '⤳',
};

interface Item {
  id: string;
  label: string;
  glyph: string;
  pressed?: boolean;
  disabled: boolean;
  run: () => void;
}

const L = $derived(controller.labels);
const offered = $derived(
  controller.readonly ? tools.filter((t) => t === 'select' || t === 'hand') : tools
);
const items: Item[] = $derived([
  ...offered.map((tool) => ({
    id: `tool-${tool}`,
    label: controller.label(L.tools[tool]),
    glyph: GLYPHS[tool],
    pressed: controller.tool === tool,
    disabled: false,
    run: () => controller.chooseTool(tool),
  })),
  {
    id: 'undo',
    label: controller.label(L.undo),
    glyph: '↶',
    disabled: controller.readonly || !controller.canUndo,
    run: () => controller.undo(),
  },
  {
    id: 'redo',
    label: controller.label(L.redo),
    glyph: '↷',
    disabled: controller.readonly || !controller.canRedo,
    run: () => controller.redo(),
  },
  {
    id: 'zoom-out',
    label: controller.label(L.zoomOut),
    glyph: '−',
    disabled: false,
    run: () => controller.zoomOut(),
  },
  {
    id: 'zoom-in',
    label: controller.label(L.zoomIn),
    glyph: '+',
    disabled: false,
    run: () => controller.zoomIn(),
  },
  {
    id: 'fit',
    label: controller.label(L.fit),
    glyph: '⤢',
    disabled: false,
    run: () => controller.fit(),
  },
  {
    id: 'group',
    label: controller.label(L.group),
    glyph: '▣',
    disabled: controller.readonly || controller.targets().length < 2,
    run: () => controller.group(),
  },
  {
    id: 'remove',
    label: controller.label(L.remove),
    glyph: '✕',
    disabled: controller.readonly || controller.targets().length === 0,
    run: () => controller.removeSelection(),
  },
]);

let active = $state(0);
let buttons: HTMLButtonElement[] = $state([]);

function onKeydown(event: KeyboardEvent): void {
  const last = items.length - 1;
  let next = active;
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown')
    next = active >= last ? 0 : active + 1;
  else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp')
    next = active <= 0 ? last : active - 1;
  else if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = last;
  else return;
  event.preventDefault();
  active = next;
  buttons[next]?.focus();
}
</script>

<div class="tx-canvas-toolbar" role="toolbar" aria-label={controller.label(L.toolbar)} tabindex="-1" onkeydown={onKeydown}>
  {#each items as item, i (item.id)}
    <button
      bind:this={buttons[i]}
      type="button"
      class="tx-canvas-toolbar__button"
      data-tx-canvas-action={item.id}
      tabindex={i === active ? 0 : -1}
      aria-label={item.label}
      aria-pressed={item.pressed === undefined ? undefined : item.pressed}
      aria-disabled={item.disabled || undefined}
      title={item.label}
      onfocus={() => (active = i)}
      onclick={() => {
        if (!item.disabled) item.run();
      }}
    ><span aria-hidden="true">{item.glyph}</span></button>
  {/each}
</div>

<style>
  @layer tx.components {
    .tx-canvas-toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: var(--tx-canvas-toolbar-gap, var(--tx-space-1));
      padding: var(--tx-canvas-toolbar-padding, calc(var(--tx-space-unit) * 1.5));
      border-block-end: var(--tx-border-width-thin) solid var(--tx-border, CanvasText);
      background: var(--tx-surface, Canvas);
    }

    .tx-canvas-toolbar__button {
      display: inline-grid;
      place-items: center;
      min-inline-size: var(--tx-target-size, 2.25rem);
      min-block-size: var(--tx-target-size, 2.25rem);
      padding: 0 var(--tx-space-2);
      border: var(--tx-border-width-thin) solid transparent;
      border-radius: var(--tx-canvas-toolbar-button-radius, var(--tx-shape-radius-md));
      background: transparent;
      color: var(--tx-foreground, CanvasText);
      font: inherit;
      font-size: var(--tx-canvas-toolbar-button-font-size, var(--tx-type-body-size));
      cursor: pointer;
    }

    .tx-canvas-toolbar__button:hover {
      background: var(--tx-muted, Canvas);
    }

    .tx-canvas-toolbar__button[aria-pressed='true'] {
      border-color: var(--tx-primary, Highlight);
      background: color-mix(in oklab, var(--tx-primary, Highlight) 14%, transparent);
    }

    .tx-canvas-toolbar__button[aria-disabled='true'] {
      color: var(--tx-muted-foreground, GrayText);
      cursor: default;
    }

    .tx-canvas-toolbar__button:focus-visible {
      outline: var(--tx-focus-ring-width, 2px) solid var(--tx-ring, Highlight);
      outline-offset: 1px;
    }

    @media (forced-colors: active) {
      .tx-canvas-toolbar__button[aria-pressed='true'] {
        border-color: Highlight;
      }
    }
  }
</style>
