import { createPrimitiveContext } from '../internal/context.ts';
import type { MenuFocusIntent, MenuLevel } from '../menu/context.ts';

export interface MenubarRootContext {
  /** The open menu's value, or `''`. */
  readonly value: string;
  setValue(value: string): void;
  /** The trigger in the Tab order (roving tabindex). */
  readonly tabStop: string | undefined;
  setTabStop(value: string): void;
  /** Menus in mount order, so the first enabled one starts as the Tab stop. */
  register(value: string, entry: MenubarMenuEntry): () => void;
  /** The value of the menu `steps` away from `from` (wrapping per `loop`), skipping disabled ones. */
  neighbor(from: string, steps: 1 | -1 | 'first' | 'last'): string | undefined;
  /** Focus a menu's trigger and, when `open`, open it with `intent`. */
  move(to: string, open: boolean, intent: MenuFocusIntent): void;
  isRtl(node: Element): boolean;
}

export interface MenubarMenuEntry {
  level: MenuLevel;
  trigger: () => HTMLElement | undefined;
  disabled: () => boolean;
}

export const menubarContext = createPrimitiveContext<MenubarRootContext>('Menubar.Root');

/** The menu a trigger or content belongs to. */
export interface MenubarMenuContext {
  readonly value: string;
}

export const menubarMenuContext = createPrimitiveContext<MenubarMenuContext>('Menubar.Menu');
