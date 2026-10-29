/**
 * The `@texuli/editor` controller of one text row. It edits the row like any
 * editor document, but hands what belongs to the page to the page editor:
 * undo and redo replay the document op log, `/` in an empty paragraph opens
 * the slash menu, Backspace at the start and Delete at the end join rows,
 * and Enter in a single-line field (a toggle summary) leaves it.
 */
import type { EditorInputIntent } from '@texuli/core/editor-keymap';
import { isCollapsed } from '@texuli/core/editor-model';
import { EditorController, type EditorControllerOptions } from '@texuli/editor/controller';

export interface RowControllerHooks {
  undo: () => boolean;
  redo: () => boolean;
  /** `/` typed: return true when the menu opened instead of inserting it. */
  slash?: () => boolean;
  /** Backspace at the very start of the row's text. */
  joinBackward?: () => boolean;
  /** Delete at the very end of the row's text. */
  joinForward?: () => boolean;
  /** Enter in a single-line row. */
  enter?: () => boolean;
}

export class RowController extends EditorController {
  readonly hooks: RowControllerHooks;

  constructor(options: EditorControllerOptions, hooks: RowControllerHooks) {
    super(options);
    this.hooks = hooks;
  }

  override undo(): boolean {
    return this.hooks.undo();
  }

  override redo(): boolean {
    return this.hooks.redo();
  }

  /** True when the row is one empty paragraph. */
  get isEmptyParagraph(): boolean {
    const blocks = this.doc.blocks;
    const first = blocks[0];
    return blocks.length === 1 && first?.type === 'paragraph' && first.content.length === 0;
  }

  /** The caret is collapsed at offset 0 of the first text block, or at the end of the last. */
  caretAt(edge: 'start' | 'end'): boolean {
    const selection = this.state.selection;
    if (selection.kind !== 'text' || !isCollapsed(selection)) return false;
    const blocks = this.doc.blocks;
    const block = edge === 'start' ? blocks[0] : blocks.at(-1);
    if (!block || selection.focus.block !== block.id) return false;
    if (edge === 'start') return selection.focus.offset === 0;
    if (block.type === 'code') return selection.focus.offset === block.text.length;
    if (block.type !== 'paragraph' && block.type !== 'heading') return false;
    let length = 0;
    for (const part of block.content) length += part.type === 'break' ? 1 : part.text.length;
    return selection.focus.offset === length;
  }

  override insertText(text: string): boolean {
    if (text === '/' && this.isEmptyParagraph && this.hooks.slash?.()) return true;
    return super.insertText(text);
  }

  override runInput(intent: EditorInputIntent, data: string | null = null): boolean {
    if (!this.composing) {
      if (intent === 'split-block' && this.hooks.enter) return this.hooks.enter();
      if (intent === 'delete-backward' && this.caretAt('start') && this.hooks.joinBackward?.())
        return true;
      if (intent === 'delete-forward' && this.caretAt('end') && this.hooks.joinForward?.())
        return true;
    }
    return super.runInput(intent, data);
  }
}
