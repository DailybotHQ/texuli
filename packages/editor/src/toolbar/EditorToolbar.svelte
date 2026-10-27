<script lang="ts">
import { createEditorKeymap, type EditorKeyIntent } from '@texuli/core/editor-keymap';
import { detectPlatform } from '@texuli/core/keyboard';
import { Toolbar as ToolbarPrimitive } from '@texuli/primitives/toolbar';
import { Toolbar, ToolbarSeparator, toolbarButtonClass } from 'texuli/toolbar';
import type { EditorController, EditorToggleMark } from '../controller/controller.svelte.ts';
import '../editor/editor.css';

type Props = {
  controller: EditorController;
  /** Called after a command, so the host can return focus to the text. */
  onCommand?: () => void;
  /** The Link button: the host opens its link dialog. */
  onLinkRequest?: () => void;
  disabled?: boolean;
  class?: string;
};

let { controller, onCommand, onLinkRequest, disabled = false, class: className }: Props = $props();

const keymap = createEditorKeymap(
  detectPlatform(typeof navigator === 'undefined' ? null : navigator)
);
const labels = $derived(controller.labels);
const active = $derived(controller.active);
const buttonClass = toolbarButtonClass({ size: 'sm' });

type Item = {
  id: string;
  label: string;
  glyph: string;
  pressed?: boolean;
  intent?: EditorKeyIntent;
  enabled?: boolean;
  run: () => void;
};

const mark = (type: EditorToggleMark, glyph: string, intent: EditorKeyIntent): Item => ({
  id: type,
  label: labels[type],
  glyph,
  pressed: active.marks.has(type),
  intent,
  enabled: active.block?.type !== 'code' && active.block?.type !== 'void',
  run: () => controller.toggleMark(type),
});

const groups = $derived.by((): Item[][] => {
  const heading = (level: 1 | 2 | 3): Item => ({
    id: `heading-${level}`,
    label: labels.heading(level),
    glyph: `H${level}`,
    pressed: active.block?.type === 'heading' && active.block.level === level,
    intent: `heading-${level}`,
    run: () =>
      active.block?.type === 'heading' && active.block.level === level
        ? controller.setBlock('paragraph')
        : controller.setBlock('heading', level),
  });
  return [
    [
      mark('strong', 'B', 'toggle-strong'),
      mark('em', 'I', 'toggle-em'),
      mark('strike', 'S', 'toggle-strike'),
      mark('code', '</>', 'toggle-code'),
      {
        id: 'link',
        label: labels.link,
        glyph: labels.link,
        pressed: active.marks.has('link'),
        intent: 'link',
        enabled: active.block?.type === 'paragraph' || active.block?.type === 'heading',
        run: () => onLinkRequest?.(),
      },
    ],
    [
      heading(1),
      heading(2),
      heading(3),
      {
        id: 'bullet-list',
        label: labels.bulletList,
        glyph: '•',
        pressed: active.list === 'bullet',
        intent: 'bullet-list',
        run: () => controller.toggleList('bullet'),
      },
      {
        id: 'ordered-list',
        label: labels.orderedList,
        glyph: '1.',
        pressed: active.list === 'ordered',
        intent: 'ordered-list',
        run: () => controller.toggleList('ordered'),
      },
      {
        id: 'todo-list',
        label: labels.todoList,
        glyph: '☑',
        pressed: active.list === 'todo',
        intent: 'todo-list',
        run: () => controller.toggleList('todo'),
      },
      {
        id: 'quote',
        label: labels.quote,
        glyph: '❝',
        pressed: active.quote,
        intent: 'quote',
        run: () => controller.toggleQuote(),
      },
      {
        id: 'code-block',
        label: labels.codeBlock,
        glyph: '{ }',
        pressed: active.block?.type === 'code',
        run: () =>
          active.block?.type === 'code'
            ? controller.setBlock('paragraph')
            : controller.setBlock('code'),
      },
      {
        id: 'divider',
        label: labels.divider,
        glyph: '―',
        run: () => controller.insertDivider(),
      },
    ],
    [
      {
        id: 'undo',
        label: labels.undo,
        glyph: '↺',
        intent: 'undo',
        enabled: controller.canUndo,
        run: () => controller.undo(),
      },
      {
        id: 'redo',
        label: labels.redo,
        glyph: '↻',
        intent: 'redo',
        enabled: controller.canRedo,
        run: () => controller.redo(),
      },
    ],
  ];
});

function press(item: Item) {
  item.run();
  if (item.id !== 'link') onCommand?.();
}

// Escape leaves the toolbar back to the text.
function onkeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault();
    onCommand?.();
  }
}

// Keep the text selection while a button is pressed with the pointer.
function onpointerdown(event: PointerEvent) {
  if ((event.target as Element | null)?.closest?.('button')) event.preventDefault();
}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="tx-editor-toolbar-slot" {onpointerdown} {onkeydown}>
  <Toolbar size="sm" variant="outline" class={['tx-editor-toolbar', className]} aria-label={labels.toolbar}>
    {#each groups as group, index (index)}
      {#if index > 0}<ToolbarSeparator />{/if}
      {#each group as item (item.id)}
        <ToolbarPrimitive.Button
          class={buttonClass}
          disabled={disabled || item.enabled === false}
          aria-label={item.label}
          aria-pressed={item.pressed === undefined ? undefined : item.pressed}
          aria-keyshortcuts={item.intent ? keymap.ariaKeyShortcuts(item.intent) || undefined : undefined}
          title={item.intent && keymap.describe(item.intent)[0]
            ? `${item.label} (${keymap.describe(item.intent)[0]})`
            : item.label}
          data-state={item.pressed ? 'on' : undefined}
          data-command={item.id}
          onclick={() => press(item)}
        >
          <span class="tx-editor-glyph" data-glyph={item.id} aria-hidden="true">{item.glyph}</span>
        </ToolbarPrimitive.Button>
      {/each}
    {/each}
  </Toolbar>
</div>
