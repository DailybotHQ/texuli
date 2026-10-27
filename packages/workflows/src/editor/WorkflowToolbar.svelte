<script lang="ts">
import type { WorkflowController } from './controller.svelte.ts';
import { formatLabel, type WorkflowLabel } from './labels.ts';

/** The editor's commands as a WAI-ARIA toolbar: one tab stop, arrow keys between buttons. */
let { controller }: { controller: WorkflowController } = $props();

interface Tool {
  id: string;
  label: WorkflowLabel;
  glyph: string;
  run: () => void;
  disabled: boolean;
}

const tools: Tool[] = $derived([
  {
    id: 'undo',
    label: controller.labels.undo,
    glyph: '↶',
    run: () => controller.undo(),
    disabled: !controller.canUndo || controller.readonly,
  },
  {
    id: 'redo',
    label: controller.labels.redo,
    glyph: '↷',
    run: () => controller.redo(),
    disabled: !controller.canRedo || controller.readonly,
  },
  {
    id: 'zoom-out',
    label: controller.labels.zoomOut,
    glyph: '−',
    run: () => controller.zoomOut(),
    disabled: false,
  },
  {
    id: 'zoom-in',
    label: controller.labels.zoomIn,
    glyph: '+',
    run: () => controller.zoomIn(),
    disabled: false,
  },
  {
    id: 'fit',
    label: controller.labels.fit,
    glyph: '⤢',
    run: () => controller.fit(),
    disabled: false,
  },
  {
    id: 'layout',
    label: controller.labels.autoLayout,
    glyph: '⇶',
    run: () => controller.autoLayout(),
    disabled: controller.readonly,
  },
  {
    id: 'group',
    label: controller.labels.group,
    glyph: '▣',
    run: () => controller.group(),
    disabled: controller.readonly || controller.targets().length === 0,
  },
  {
    id: 'remove',
    label: controller.labels.remove,
    glyph: '✕',
    run: () => controller.removeSelection(),
    disabled:
      controller.readonly ||
      (controller.targets().length === 0 && controller.selectedEdge === null),
  },
]);

let active = $state(0);

function onKeydown(event: KeyboardEvent): void {
  const last = tools.length - 1;
  const forward = controller.dir === 'rtl' ? -1 : 1;
  let next = active;
  if (event.key === 'ArrowRight') next = active + forward;
  else if (event.key === 'ArrowLeft') next = active - forward;
  else if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = last;
  else return;
  event.preventDefault();
  active = (next + tools.length) % tools.length;
  (event.currentTarget as HTMLElement)
    .querySelectorAll<HTMLButtonElement>('button')
    [active]?.focus();
}
</script>

<div class="tx-workflow-toolbar" role="toolbar" aria-label={formatLabel(controller.labels.toolbar)} tabindex="-1" onkeydown={onKeydown}>
  {#each tools as tool, index (tool.id)}
    <button
      type="button"
      class="tx-workflow-toolbar__button"
      tabindex={index === active ? 0 : -1}
      aria-label={formatLabel(tool.label)}
      title={formatLabel(tool.label)}
      aria-disabled={tool.disabled || undefined}
      onfocus={() => (active = index)}
      onclick={() => {
        if (!tool.disabled) tool.run();
      }}><span aria-hidden="true">{tool.glyph}</span></button
    >
  {/each}
</div>

<style>
  @layer tx.components {
    .tx-workflow-toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem;
    }

    .tx-workflow-toolbar__button {
      min-inline-size: 2rem;
      min-block-size: 2rem;
      padding: 0.25rem 0.5rem;
      font: inherit;
      color: inherit;
      background: var(--tx-surface, ButtonFace);
      border: 1px solid var(--tx-border, ButtonText);
      border-radius: var(--tx-radius-md, 0.5rem);
      cursor: pointer;
    }

    .tx-workflow-toolbar__button[aria-disabled='true'] {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .tx-workflow-toolbar__button:focus-visible {
      outline: 3px solid var(--tx-ring, Highlight);
      outline-offset: 2px;
    }

    @media (forced-colors: active) {
      .tx-workflow-toolbar__button[aria-disabled='true'] {
        color: GrayText;
        opacity: 1;
      }
    }
  }
</style>
