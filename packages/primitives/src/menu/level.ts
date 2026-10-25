import type { OverlayController } from '@texuli/core/overlay-core';
import type { MenuFocusIntent, MenuLevel } from './context.ts';

export interface MenuLevelInput {
  id: string;
  parent: MenuLevel | null;
  getOpen(): boolean;
  setOpenValue(next: boolean): void;
  loop(): boolean;
  /** Consumer ids claimed by the level's parts (pass a `$state` object so reads stay reactive). */
  claims: { trigger?: string; content?: string };
}

/**
 * The state of one menu level, shared by Root and Sub. Opening records where
 * focus should land; closing a level closes its open submenus first.
 */
export function createMenuLevel(input: MenuLevelInput): MenuLevel {
  let triggerElement: HTMLElement | undefined;
  let contentElement: HTMLElement | undefined;
  const children = new Set<MenuLevel>();

  const level: MenuLevel = {
    get open() {
      return input.getOpen();
    },
    isSub: input.parent !== null,
    parent: input.parent,
    get root() {
      return input.parent ? input.parent.root : level;
    },
    get triggerId() {
      return input.claims.trigger || `${input.id}-trigger`;
    },
    get contentId() {
      return input.claims.content || `${input.id}-content`;
    },
    claimId(part, id) {
      input.claims[part] = id || undefined;
    },
    get loop() {
      return input.loop();
    },
    get triggerElement() {
      return triggerElement;
    },
    get contentElement() {
      return contentElement;
    },
    focusIntent: null as MenuFocusIntent,
    grace: null,
    setOpen(next, intent = null) {
      if (next) level.focusIntent = intent;
      else for (const child of children) if (child.open) child.setOpen(false);
      if (input.getOpen() !== next) input.setOpenValue(next);
    },
    close(restore) {
      level.setOpen(false);
      level.grace = null;
      if (restore) triggerElement?.focus({ preventScroll: true });
    },
    closeAll(restore) {
      level.root.close(restore);
    },
    registerTrigger(element) {
      triggerElement = element;
    },
    registerContent(element, controller?: OverlayController) {
      contentElement = element;
      if (element && triggerElement) controller?.setAnchor(triggerElement);
    },
    childContents() {
      return [...children].flatMap((child) =>
        child.open && child.contentElement ? [child.contentElement, ...child.childContents()] : []
      );
    },
    closeChildrenExcept(item) {
      for (const child of children) {
        if (child.open && child.triggerElement !== item) child.close(false);
      }
    },
    addChild(child) {
      children.add(child);
      return () => children.delete(child);
    },
  };
  return level;
}
