import { createPrimitiveContext } from '../internal/context.ts';

/** What a drawer's content shares with its handle. */
export interface DrawerContext {
  readonly snapPoints: readonly number[];
  readonly activeSnapPoint: number;
  setSnapPoint(snap: number): void;
}

export const drawerContext = createPrimitiveContext<DrawerContext>('Drawer.Content');
