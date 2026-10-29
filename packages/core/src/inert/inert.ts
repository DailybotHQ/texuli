/**
 * Inert outside a modal layer, with an exemption registry (L0 texel).
 *
 * While a modal layer is open, everything outside it is made `inert`: no
 * focus, no pointer interaction, hidden from the accessibility tree. Some
 * regions must stay reachable anyway: the toast region and the live
 * announcer. They register as **exemptions** and are never made inert, even
 * when they sit outside the modal (R16).
 *
 * Modal scopes nest. Only the topmost scope decides what is inert; closing it
 * re-applies the scope below, and closing the last one restores every
 * attribute this texel touched to the exact value it had before. Attributes an
 * author set (an element that was already `inert`) are never removed.
 *
 * Nothing touches `window` or `document` at import time: a scope takes its
 * layer element (and, optionally, a root) explicitly, and the shared registry
 * lives on a versioned `globalThis` key like the layer stack.
 */

/** Versioned key on `globalThis` / a test fake. Bump only on a breaking shape. */
export const INERT_REGISTRY_GLOBAL_KEY = '__TEXULI_INERT_REGISTRY_V1__' as const;

/** Elements that never render, so making them inert would only churn attributes. */
const SKIPPED_TAGS = new Set([
  'BASE',
  'HEAD',
  'LINK',
  'META',
  'NOSCRIPT',
  'SCRIPT',
  'STYLE',
  'TEMPLATE',
  'TITLE',
]);

// Realm-independent: an element from another window, or one whose timer runs
// after the global Element binding is gone, is still an element.
function isElement(value: unknown): value is Element {
  if (typeof value !== 'object' || value === null) return false;
  const node = value as Partial<Element>;
  return (
    node.nodeType === 1 &&
    typeof node.setAttribute === 'function' &&
    typeof node.contains === 'function'
  );
}

/**
 * The elements to make inert so that only `keep` (and their descendants) stay
 * interactive under `root`. Pure: it reads the tree and writes nothing.
 *
 * Starting at `root`, each child is either kept (it is in `keep`), descended
 * into (it contains something kept), or returned (it contains nothing kept).
 * Ancestors of a kept element are therefore never returned, which is what lets
 * an exemption outside the modal stay reachable. `root` itself is never
 * returned. A kept element outside `root` simply keeps nothing under it.
 */
export function computeInertTargets(root: Element, keep: readonly Element[]): Element[] {
  const kept = new Set(keep.filter((element) => isElement(element)));
  const targets: Element[] = [];
  const visit = (parent: Element) => {
    for (const child of Array.from(parent.children)) {
      if (kept.has(child) || SKIPPED_TAGS.has(child.tagName)) continue;
      let containsKept = false;
      for (const element of kept) {
        if (child.contains(element)) {
          containsKept = true;
          break;
        }
      }
      if (containsKept) visit(child);
      else targets.push(child);
    }
  };
  visit(root);
  return targets;
}

export interface InertExemptionInput {
  /** The region that must stay reachable while a modal is open. */
  element: Element;
  /** Optional debug label (`toast-region`, `announcer`, …). */
  label?: string;
  /**
   * Whether the region stays above overlays opened after it (default `true`):
   * when it is open as a popover, the overlay engine re-shows it in the top
   * layer each time another overlay opens, so the toast region keeps painting
   * on top. Pass `false` for exemptions that belong under later overlays: a
   * dialog backdrop, or a menu or listbox opened inside a modal, which must
   * never cover the overlay opened from it.
   */
  raise?: boolean;
}

export interface InertExemption {
  readonly element: Element;
  readonly label?: string;
  /** `false` when the region must not be re-raised above later overlays (omitted means `true`). */
  readonly raise?: false;
}

export interface InertExemptionHandle {
  /** Stop exempting this element (idempotent). Open scopes recompute. */
  release: () => void;
}

export interface InertScopeOptions {
  /**
   * Subtree whose content becomes inert (default: the layer's
   * `ownerDocument.body`). Pass an app root to leave the rest of the page alone.
   */
  root?: Element;
  /** Also set `aria-hidden="true"` on inert elements, for older assistive tech (default `false`). */
  ariaHidden?: boolean;
  /**
   * Watch `root` for added children (a portal mounted after the modal opened)
   * and make new outside content inert too. Needs `MutationObserver`; without
   * it the scope behaves as if this were `false`. Default `false`: call
   * {@link InertRegistry.refresh} after known DOM changes instead.
   */
  observe?: boolean;
  /** Optional debug label (`dialog`, `sheet`, …). */
  label?: string;
}

export interface InertScope {
  /** Close this scope (idempotent). The scope below, if any, applies again. */
  release: () => void;
  /** True while this scope is the topmost one, so its rules are in effect. */
  isActive: () => boolean;
}

/**
 * Page-wide registry of modal scopes and exemptions. Create an isolated one
 * with {@link createInertRegistry}, or share one with {@link getInertRegistry}.
 */
export interface InertRegistry {
  /** Exempt a region from every current and future scope. */
  exempt(input: InertExemptionInput): InertExemptionHandle;
  /** Whether `element` is a registered exemption. */
  isExempt(element: Element): boolean;
  /** Registered exemptions, oldest first. */
  exemptions(): readonly InertExemption[];
  /** Make everything outside `layer` (and outside the exemptions) inert. */
  inertOutside(layer: Element, options?: InertScopeOptions): InertScope;
  /** Number of open scopes. */
  size(): number;
  /** Elements this registry currently holds inert. */
  inertElements(): readonly Element[];
  /** Recompute the topmost scope (after the DOM under its root changed). */
  refresh(): void;
  /** Close every scope, restore every attribute and drop every exemption. */
  clear(): void;
}

interface ScopeEntry {
  layer: Element;
  root: Element | null;
  ariaHidden: boolean;
  observe: boolean;
  label?: string;
}

/** The attribute values an element had before this texel first touched it. */
interface Original {
  inert: string | null;
  ariaHidden: string | null;
}

function restoreAttribute(element: Element, name: string, value: string | null): void {
  if (value === null) element.removeAttribute(name);
  else element.setAttribute(name, value);
}

/** Create an isolated registry. Prefer {@link getInertRegistry} in the browser. */
export function createInertRegistry(): InertRegistry {
  const exemptions: InertExemption[] = [];
  const scopes: ScopeEntry[] = [];
  const originals = new Map<Element, Original>();
  let observer: MutationObserver | null = null;
  let observedRoot: Element | null = null;

  const disconnectObserver = () => {
    observer?.disconnect();
    observer = null;
    observedRoot = null;
  };

  const syncObserver = (top: ScopeEntry | undefined) => {
    const root = top?.observe ? top.root : null;
    if (root === observedRoot && observer) return;
    disconnectObserver();
    const Observer = root ? root.ownerDocument.defaultView?.MutationObserver : undefined;
    if (!root || !Observer) return;
    observer = new Observer(() => apply());
    observer.observe(root, { childList: true, subtree: true });
    observedRoot = root;
  };

  /** Bring the attributes in line with the topmost scope, touching only what changes. */
  const apply = () => {
    const top = scopes[scopes.length - 1];
    const next = new Set<Element>();
    if (top?.root) {
      const keep = [top.layer, ...exemptions.map((entry) => entry.element)];
      for (const element of computeInertTargets(top.root, keep)) next.add(element);
    }
    for (const [element, original] of originals) {
      if (next.has(element)) continue;
      restoreAttribute(element, 'inert', original.inert);
      restoreAttribute(element, 'aria-hidden', original.ariaHidden);
      originals.delete(element);
    }
    for (const element of next) {
      let original = originals.get(element);
      if (!original) {
        original = {
          inert: element.getAttribute('inert'),
          ariaHidden: element.getAttribute('aria-hidden'),
        };
        originals.set(element, original);
      }
      if (original.inert === null) element.setAttribute('inert', '');
      if (top?.ariaHidden) element.setAttribute('aria-hidden', 'true');
      else restoreAttribute(element, 'aria-hidden', original.ariaHidden);
    }
    syncObserver(top);
  };

  const registry: InertRegistry = {
    exempt(input) {
      if (!isElement(input.element)) {
        throw new TypeError('InertRegistry.exempt: element must be a DOM Element');
      }
      const entry: InertExemption = {
        element: input.element,
        ...(input.label === undefined ? {} : { label: input.label }),
        ...(input.raise === false ? { raise: false as const } : {}),
      };
      exemptions.push(entry);
      apply();
      let released = false;
      return {
        release: () => {
          if (released) return;
          released = true;
          const index = exemptions.indexOf(entry);
          if (index >= 0) exemptions.splice(index, 1);
          apply();
        },
      };
    },

    isExempt(element) {
      return exemptions.some((entry) => entry.element === element);
    },

    exemptions() {
      return exemptions.slice();
    },

    inertOutside(layer, options = {}) {
      if (!isElement(layer)) {
        throw new TypeError('InertRegistry.inertOutside: layer must be a DOM Element');
      }
      if (options.root !== undefined && !isElement(options.root)) {
        throw new TypeError('InertRegistry.inertOutside: root must be a DOM Element');
      }
      const entry: ScopeEntry = {
        layer,
        root: options.root ?? layer.ownerDocument.body ?? null,
        ariaHidden: options.ariaHidden === true,
        observe: options.observe === true,
      };
      if (options.label !== undefined) entry.label = options.label;
      scopes.push(entry);
      apply();
      let released = false;
      return {
        release: () => {
          if (released) return;
          released = true;
          const index = scopes.indexOf(entry);
          if (index < 0) return;
          const wasTop = index === scopes.length - 1;
          scopes.splice(index, 1);
          if (wasTop) apply();
        },
        isActive: () => scopes[scopes.length - 1] === entry,
      };
    },

    size() {
      return scopes.length;
    },

    inertElements() {
      return Array.from(originals.keys());
    },

    refresh() {
      apply();
    },

    clear() {
      scopes.length = 0;
      exemptions.length = 0;
      apply();
    },
  };

  return registry;
}

/** Minimal shape of a global object that can hold the shared registry. */
export type InertRegistryGlobal = {
  [INERT_REGISTRY_GLOBAL_KEY]?: InertRegistry;
};

/**
 * Return the page-wide registry stored on `globalObject` (default:
 * `globalThis`), creating it once, so a toast region registered by one island
 * stays reachable under a dialog opened by another.
 */
export function getInertRegistry(
  globalObject: InertRegistryGlobal = globalThis as InertRegistryGlobal
): InertRegistry {
  const existing = globalObject[INERT_REGISTRY_GLOBAL_KEY];
  if (existing) return existing;
  const created = createInertRegistry();
  globalObject[INERT_REGISTRY_GLOBAL_KEY] = created;
  return created;
}

/** Restore everything and remove the shared registry from `globalObject` (tests). */
export function resetInertRegistry(
  globalObject: InertRegistryGlobal = globalThis as InertRegistryGlobal
): void {
  const existing = globalObject[INERT_REGISTRY_GLOBAL_KEY];
  if (existing) existing.clear();
  delete globalObject[INERT_REGISTRY_GLOBAL_KEY];
}
