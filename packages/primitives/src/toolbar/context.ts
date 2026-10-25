import { createPrimitiveContext } from '../internal/index.ts';

export type ToolbarOrientation = 'horizontal' | 'vertical';
export type ToolbarGroupType = 'single' | 'multiple';

/** What a toolbar shares with its parts. */
export interface ToolbarContext {
  readonly orientation: ToolbarOrientation;
}

/** What a toolbar group shares with its items. */
export interface ToolbarGroupContext {
  readonly type: ToolbarGroupType;
  readonly disabled: boolean;
  isPressed(value: string): boolean;
  toggle(value: string): void;
}

export const toolbarContext = createPrimitiveContext<ToolbarContext>('Toolbar.Root');
export const toolbarGroupContext = createPrimitiveContext<ToolbarGroupContext>('Toolbar.Group');

/** Marks the toolbar's focusable items, in DOM order (the roving set). */
export const TOOLBAR_ITEM = 'data-toolbar-item';

/** Attributes for a disabled-but-focusable item (APG: disabled toolbar items may keep focus). */
export function disabledAttributes(disabled: boolean) {
  return disabled ? { 'aria-disabled': 'true' as const, 'data-disabled': '' as const } : {};
}
