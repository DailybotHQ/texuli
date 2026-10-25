import { getTabbableElements, isFocusable } from '../tabbable/index.ts';

/** A focusable element in the document that owns a focus scope. */
export type FocusTarget = HTMLElement;

/** Event offered before a scope restores focus to the element that opened it. */
export interface FocusRestoreEvent {
  /** The active element captured when the scope was activated. */
  readonly target: FocusTarget | null;
  /** True after a callback has prevented the default focus restoration. */
  readonly defaultPrevented: boolean;
  /** Keep focus where it is instead of restoring it to `target`. */
  preventDefault(): void;
}

/** Options for {@link createFocusScope}. */
export interface FocusScopeOptions {
  /**
   * Preferred initial target. It must be focusable and inside the container.
   * A function is evaluated each time the scope activates.
   */
  initialFocus?: FocusTarget | (() => FocusTarget | null);
  /** Always choose the next in-scope Tab stop when native tab order is unreliable. */
  cycleTabNavigation?: boolean;
  /** Called before focus returns to the opener; call `preventDefault()` to cancel. */
  onBeforeRestoreFocus?: (event: FocusRestoreEvent) => void;
}

/** An activated, framework-free keyboard focus scope. */
export interface FocusScope {
  /** Install the Tab trap and move focus according to the initial-focus order. */
  activate(): void;
  /** Remove the trap and offer ordered, preventable focus restoration. */
  deactivate(): void;
  /** Re-run the initial-focus selection while this scope is active. */
  focusInitial(): void;
  /** Whether the scope is currently registered for its document. */
  isActive(): boolean;
}

const scopesByDocument = new WeakMap<Document, FocusScope[]>();

function scopeStack(document: Document): FocusScope[] {
  let scopes = scopesByDocument.get(document);
  if (!scopes) {
    scopes = [];
    scopesByDocument.set(document, scopes);
  }
  return scopes;
}

function isTopScope(scope: FocusScope, document: Document): boolean {
  const stack = scopesByDocument.get(document);
  return stack?.[stack.length - 1] === scope;
}

function focus(element: FocusTarget, temporarilyFocusable = false): void {
  const addTabIndex = temporarilyFocusable && !element.hasAttribute('tabindex');
  if (addTabIndex) element.setAttribute('tabindex', '-1');
  element.focus({ preventScroll: true });
  if (addTabIndex) element.removeAttribute('tabindex');
}

function resolveInitialTarget(container: HTMLElement, options: FocusScopeOptions): FocusTarget {
  const explicit =
    typeof options.initialFocus === 'function' ? options.initialFocus() : options.initialFocus;
  if (explicit && container.contains(explicit) && isFocusable(explicit)) return explicit;

  for (const candidate of container.querySelectorAll<HTMLElement>('[autofocus]')) {
    if (isFocusable(candidate)) return candidate;
  }

  return getTabbableElements(container)[0] ?? container;
}

/**
 * Create a focus scope around `container`. Creation is inert; call `activate`
 * when the container is ready. Scopes are stacked per owner document, so only
 * the innermost active scope handles Tab while nested scopes are open.
 */
export function createFocusScope(
  container: HTMLElement,
  options: FocusScopeOptions = {}
): FocusScope {
  const document = container.ownerDocument;
  let active = false;
  let opener: FocusTarget | null = null;

  const focusInitial = () => {
    if (!active) return;
    focus(resolveInitialTarget(container, options), true);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (!active || !isTopScope(scope, document) || event.key !== 'Tab') return;

    const tabbable = getTabbableElements(container);
    const current = document.activeElement;
    const index = tabbable.indexOf(current as HTMLElement);
    const cycle = options.cycleTabNavigation === true;

    if (!cycle && !(event.shiftKey ? index <= 0 : index < 0 || index === tabbable.length - 1)) {
      return;
    }

    if (tabbable.length === 0) {
      event.preventDefault();
      focus(container, true);
    } else {
      event.preventDefault();
      const nextIndex = event.shiftKey
        ? index <= 0
          ? tabbable.length - 1
          : index - 1
        : index < 0 || index === tabbable.length - 1
          ? 0
          : index + 1;
      const target = tabbable[nextIndex];
      if (target) focus(target);
    }
  };

  const scope: FocusScope = {
    activate() {
      if (active) return;
      active = true;
      const activeElement = document.activeElement;
      opener =
        activeElement && typeof (activeElement as HTMLElement).focus === 'function'
          ? (activeElement as FocusTarget)
          : null;
      scopeStack(document).push(scope);
      document.addEventListener('keydown', onKeyDown, true);
      focusInitial();
    },

    deactivate() {
      if (!active) return;
      active = false;
      document.removeEventListener('keydown', onKeyDown, true);
      const stack = scopeStack(document);
      const wasTop = stack[stack.length - 1] === scope;
      const index = stack.indexOf(scope);
      if (index >= 0) stack.splice(index, 1);

      if (!wasTop) {
        opener = null;
        return;
      }

      let prevented = false;
      const restoreEvent: FocusRestoreEvent = {
        target: opener,
        get defaultPrevented() {
          return prevented;
        },
        preventDefault() {
          prevented = true;
        },
      };
      options.onBeforeRestoreFocus?.(restoreEvent);
      if (!restoreEvent.defaultPrevented && opener?.isConnected) focus(opener);
      opener = null;
    },

    focusInitial,

    isActive() {
      return active;
    },
  };

  return scope;
}
