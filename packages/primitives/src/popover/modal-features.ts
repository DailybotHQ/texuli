import { createFocusScope } from '@texuli/core/focus-scope';
import { getInertRegistry } from '@texuli/core/inert';
import { lockScroll } from '@texuli/core/scroll-lock';

/**
 * The overlay features only a modal popover needs. Content imports this
 * module dynamically, so non-modal popovers (and the date picker) never
 * bundle the focus scope, inert or scroll lock.
 */
export const modalFeatures = {
  focusScope: createFocusScope,
  inert: getInertRegistry,
  scrollLock: lockScroll,
};
