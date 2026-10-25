import { getTabbableElements } from '@texuli/core/tabbable';
import type { NavigationMenuContextValue } from './context.ts';

/**
 * Pointer and Tab handling shared by inline and viewport content: entering
 * keeps the item open, Tab moves through the links, and Tab past either end
 * returns to the list.
 */
export function contentBehavior(context: NavigationMenuContextValue, value: string) {
  return (node: HTMLElement) => {
    const onEnter = (event: PointerEvent) => {
      if (event.pointerType === 'mouse') context.pointerEnterContent();
    };
    // Tab is moved explicitly: the content may render away from its trigger
    // (in the viewport), and some engines skip links on Tab (macOS WebKit).
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey) return;
      const tabbable = getTabbableElements(node);
      const doc = node.ownerDocument;
      const index = tabbable.indexOf(doc.activeElement as HTMLElement);
      if (index < 0) return;
      const trigger = doc.getElementById(context.triggerId(value));
      let target: HTMLElement | null | undefined;
      if (event.shiftKey) {
        target = index === 0 ? trigger : tabbable[index - 1];
      } else if (index < tabbable.length - 1) {
        target = tabbable[index + 1];
      } else if (trigger) {
        // Past the last link: whatever follows the trigger in the navigation.
        const order = getTabbableElements(context.root ?? doc.body).filter(
          (element) => !node.contains(element)
        );
        target = order[order.indexOf(trigger) + 1];
      }
      if (!target) return;
      event.preventDefault();
      target.focus();
    };
    node.addEventListener('pointerenter', onEnter);
    node.addEventListener('keydown', onKeydown);
    return () => {
      node.removeEventListener('pointerenter', onEnter);
      node.removeEventListener('keydown', onKeydown);
    };
  };
}
