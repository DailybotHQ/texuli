<script lang="ts">
/**
 * Block-type menu (PLAN_023 row 12): an APG menu button whose items are menu item radios
 * (paragraph, headings 1–4, bulleted, numbered and checklist, quote, code block). The checked
 * item is the kind at the caret; choosing one is one undoable step (`setBlockKind`). Inside an
 * `EditorToolbar` the trigger is a toolbar item (roving focus); standalone it is a button.
 */
import type { EditorBlockKindChoice } from '@texuli/core/editor-transforms';
import { Trigger as MenuTrigger } from '@texuli/primitives/menu';
import { Toolbar as ToolbarPrimitive } from '@texuli/primitives/toolbar';
import { DropdownMenu } from 'texuli/menus';
import { toolbarButtonClass } from 'texuli/toolbar';
import type { EditorController } from '../controller/controller.svelte.ts';
import { blockKindLabel } from '../controller/labels.ts';
import '../editor/editor.css';
import './block-menu.css';

type Props = {
  controller: EditorController;
  /** Called after a choice, so the host can return focus to the text. */
  onCommand?: () => void;
  disabled?: boolean;
  /** Render the trigger as a toolbar item (inside `EditorToolbar` or another toolbar). Default true. */
  toolbarItem?: boolean;
  class?: string;
};

let {
  controller,
  onCommand,
  disabled = false,
  toolbarItem = true,
  class: className,
}: Props = $props();

/** Menu order; the glyph is decoration next to the visible name. */
const KINDS: readonly { kind: EditorBlockKindChoice; glyph: string }[] = [
  { kind: 'paragraph', glyph: '¶' },
  { kind: 'heading-1', glyph: 'H1' },
  { kind: 'heading-2', glyph: 'H2' },
  { kind: 'heading-3', glyph: 'H3' },
  { kind: 'heading-4', glyph: 'H4' },
  { kind: 'bullet', glyph: '•' },
  { kind: 'ordered', glyph: '1.' },
  { kind: 'todo', glyph: '☑' },
  { kind: 'quote', glyph: '❝' },
  { kind: 'code', glyph: '{ }' },
];

const labels = $derived(controller.labels);
const current = $derived(controller.blockKind);
const currentName = $derived(current ? blockKindLabel(labels, current) : labels.paragraph);
const buttonClass = toolbarButtonClass({ size: 'sm' });
let open = $state(false);

function choose(kind: string) {
  if (kind === current) return;
  controller.setBlockKind(kind as EditorBlockKindChoice);
  // After the menu has closed and returned focus to its button, hand focus back to the text.
  setTimeout(() => onCommand?.(), 0);
}
</script>

<DropdownMenu.Root bind:open>
  {#if toolbarItem}
    <MenuTrigger disabled={disabled || current === null}>
      {#snippet child({ props })}
        <ToolbarPrimitive.Button
          {...props}
          class={[buttonClass, 'tx-editor-block-menu', className]}
          disabled={disabled || current === null}
          aria-label={labels.blockMenu(currentName)}
          data-command="block-menu"
        >
          <span class="tx-editor-block-menu__name">{currentName}</span>
          <span class="tx-editor-block-menu__chevron" aria-hidden="true">▾</span>
        </ToolbarPrimitive.Button>
      {/snippet}
    </MenuTrigger>
  {:else}
    <DropdownMenu.Trigger
      class={['tx-editor-block-menu', className]}
      size="sm"
      disabled={disabled || current === null}
      aria-label={labels.blockMenu(currentName)}
      data-command="block-menu"
    >
      <span class="tx-editor-block-menu__name">{currentName}</span>
      <span class="tx-editor-block-menu__chevron" aria-hidden="true">▾</span>
    </DropdownMenu.Trigger>
  {/if}
  <DropdownMenu.Portal>
    <DropdownMenu.Content data-editor-block-menu>
      <DropdownMenu.RadioGroup value={current ?? ''} onValueChange={choose}>
        {#each KINDS as item (item.kind)}
          <DropdownMenu.RadioItem value={item.kind} data-block-kind={item.kind}>
            {#snippet icon()}<span class="tx-editor-glyph">{item.glyph}</span>{/snippet}
            {blockKindLabel(labels, item.kind)}
          </DropdownMenu.RadioItem>
        {/each}
      </DropdownMenu.RadioGroup>
    </DropdownMenu.Content>
  </DropdownMenu.Portal>
</DropdownMenu.Root>
