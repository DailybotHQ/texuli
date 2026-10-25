import type { ToolbarSize } from './variants.ts';

export const TOOLBAR_STYLE = Symbol('texuli.toolbar-style');

export type ToolbarStyleContext = {
  readonly size: ToolbarSize;
};
