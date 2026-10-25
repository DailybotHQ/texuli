import type { OverlayController } from '@texuli/core/overlay-core';
import { createPrimitiveContext } from '../internal/context.ts';

/** Where focus goes when a menu opens: an item, the menu itself, or nowhere. */
export type MenuFocusIntent = 'first' | 'last' | 'content' | null;

/** One level of a menu: the root menu or a submenu. */
export interface MenuLevel {
  readonly open: boolean;
  readonly isSub: boolean;
  readonly parent: MenuLevel | null;
  readonly root: MenuLevel;
  readonly triggerId: string;
  readonly contentId: string;
  /** A part records its consumer `id` (or clears it), so references use the effective id. */
  claimId(part: 'trigger' | 'content', id: string | null | undefined): void;
  readonly loop: boolean;
  readonly triggerElement: HTMLElement | undefined;
  readonly contentElement: HTMLElement | undefined;
  /** Focus requested for the next open. */
  focusIntent: MenuFocusIntent;
  setOpen(next: boolean, intent?: MenuFocusIntent): void;
  /** Close this level; `restore` moves focus back to its trigger. */
  close(restore: boolean): void;
  /** Close the whole menu from any level; `restore` focuses the root trigger. */
  closeAll(restore: boolean): void;
  registerTrigger(element: HTMLElement | undefined): void;
  registerContent(element: HTMLElement | undefined, controller?: OverlayController): void;
  /** Open submenus' content elements, so outside clicks inside them do not dismiss this level. */
  childContents(): HTMLElement[];
  addChild(child: MenuLevel): () => void;
  /** Close open submenus except the one `item` opens (the highlight moved). */
  closeChildrenExcept(item: Element | null): void;
  /** The pointer grace polygon while moving toward an open submenu. */
  grace: { polygon: { x: number; y: number }[]; until: number } | null;
}

export const menuLevelContext = createPrimitiveContext<MenuLevel>('Menu.Root or Menu.Sub');

/** A group's heading id, so the group is named by it. */
export interface MenuGroupContext {
  setHeadingId(id: string | undefined): void;
}
export const menuGroupContext = createPrimitiveContext<MenuGroupContext>('Menu.Group');

/** The radio group an item belongs to. */
export interface MenuRadioContext {
  readonly value: string | undefined;
  select(value: string): void;
}
export const menuRadioContext = createPrimitiveContext<MenuRadioContext>('Menu.RadioGroup');

/** Optional context read: `undefined` outside the provider. */
export function tryContext<Value>(read: () => Value): Value | undefined {
  try {
    return read();
  } catch {
    return undefined;
  }
}

/** The menu items of `content`, in order, excluding items of nested submenus. */
export function menuItems(content: HTMLElement | undefined): HTMLElement[] {
  if (!content) return [];
  return Array.from(
    content.querySelectorAll<HTMLElement>(
      '[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]'
    )
  ).filter((item) => item.closest('[role="menu"]') === content);
}
