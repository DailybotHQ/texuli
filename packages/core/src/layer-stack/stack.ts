/**
 * Page-wide dismissable-layer stack (L0 texel).
 *
 * One ordered registry for the whole page. Islands share it through a
 * versioned `globalThis` key so nested dialogs, menus and popovers from
 * separate mount roots still form one Escape / outside-interaction stack.
 *
 * Escape and outside interaction reach **only the topmost** layer. The stack
 * itself does not listen to the document: callers pass events in, or bind a
 * document explicitly with {@link bindLayerStackDocument}. No `window` or
 * `document` is touched at import time.
 */

/** Versioned key on `globalThis` / a test fake. Bump only on a breaking shape. */
export const LAYER_STACK_GLOBAL_KEY = '__TEXULI_LAYER_STACK_V1__' as const;

/** Stable id of one registered layer. */
export type LayerId = string;

/** One entry on the stack, bottom → top in {@link LayerStack.list}. */
export interface LayerEntry {
  readonly id: LayerId;
  /** Layer root element used for containment and outside checks. */
  readonly element: Element;
  /** Optional debug label (dialog, menu, …). */
  readonly label?: string;
}

export interface RegisterLayerInput {
  /** Existing id re-registers and moves the layer to the top. */
  id?: LayerId;
  /** Layer root; must be an Element. */
  element: Element;
  label?: string;
}

export interface LayerRegistration {
  readonly id: LayerId;
  /** Remove this layer from the stack (idempotent). */
  unregister: () => void;
  /** True while this id is the topmost entry. */
  isTop: () => boolean;
  /** 0-based index from the bottom, or `-1` if unregistered. */
  order: () => number;
}

/**
 * Ordered registry of dismissable layers. Create an isolated instance with
 * {@link createLayerStack}, or share one page-wide with {@link getLayerStack}.
 */
export interface LayerStack {
  /**
   * Push a layer on top (or move an existing id to the top). Returns a handle
   * whose `unregister` is safe to call more than once.
   */
  register(input: RegisterLayerInput): LayerRegistration;
  /** Remove by id. No-op when the id is unknown. */
  unregister(id: LayerId): void;
  /** Entries from bottom (oldest) to top (newest). */
  list(): readonly LayerEntry[];
  /** Topmost entry, or `null` when the stack is empty. */
  top(): LayerEntry | null;
  /** Whether `id` is currently the topmost layer. */
  isTop(id: LayerId): boolean;
  /** 0-based index from the bottom, or `-1` when missing. */
  orderOf(id: LayerId): number;
  /** Number of registered layers. */
  size(): number;
  /** Drop every layer (tests and full teardown). */
  clear(): void;
}

type MutableEntry = {
  id: LayerId;
  element: Element;
  label?: string;
};

function isElement(value: unknown): value is Element {
  return typeof Element !== 'undefined' && value instanceof Element;
}

function newLayerId(next: () => number): LayerId {
  return `tx-layer-${next()}`;
}

/**
 * Create an isolated stack. Prefer {@link getLayerStack} in the browser so
 * every island shares one registry.
 */
export function createLayerStack(): LayerStack {
  const entries: MutableEntry[] = [];
  let seq = 0;
  const nextId = () => {
    seq += 1;
    return seq;
  };

  const findIndex = (id: LayerId): number => entries.findIndex((entry) => entry.id === id);

  const stack: LayerStack = {
    register(input) {
      if (!isElement(input.element)) {
        throw new TypeError('LayerStack.register: element must be a DOM Element');
      }
      const id = input.id ?? newLayerId(nextId);
      const existing = findIndex(id);
      if (existing >= 0) entries.splice(existing, 1);
      const entry: MutableEntry = { id, element: input.element };
      if (input.label !== undefined) entry.label = input.label;
      entries.push(entry);

      return {
        id,
        unregister: () => {
          stack.unregister(id);
        },
        isTop: () => stack.isTop(id),
        order: () => stack.orderOf(id),
      };
    },

    unregister(id) {
      const index = findIndex(id);
      if (index < 0) return;
      entries.splice(index, 1);
    },

    list() {
      return entries.map((entry) => {
        const out: LayerEntry = { id: entry.id, element: entry.element };
        if (entry.label !== undefined) {
          return { ...out, label: entry.label };
        }
        return out;
      });
    },

    top() {
      const last = entries[entries.length - 1];
      if (!last) return null;
      const out: LayerEntry = { id: last.id, element: last.element };
      if (last.label !== undefined) return { ...out, label: last.label };
      return out;
    },

    isTop(id) {
      const last = entries[entries.length - 1];
      return last !== undefined && last.id === id;
    },

    orderOf(id) {
      return findIndex(id);
    },

    size() {
      return entries.length;
    },

    clear() {
      entries.length = 0;
    },
  };

  return stack;
}

/** Minimal shape of a global object that can hold the shared stack. */
export type LayerStackGlobal = {
  [LAYER_STACK_GLOBAL_KEY]?: LayerStack;
};

/**
 * Return the page-wide stack stored on `globalObject` (default: `globalThis`),
 * creating it once. Separate Svelte islands and multiple package copies that
 * agree on {@link LAYER_STACK_GLOBAL_KEY} share one ordered registry.
 *
 * Pass a plain object in tests to avoid touching the real `globalThis`.
 */
export function getLayerStack(
  globalObject: LayerStackGlobal = globalThis as LayerStackGlobal
): LayerStack {
  const existing = globalObject[LAYER_STACK_GLOBAL_KEY];
  if (existing) return existing;
  const created = createLayerStack();
  globalObject[LAYER_STACK_GLOBAL_KEY] = created;
  return created;
}

/**
 * Remove the shared stack from `globalObject` (tests). Does not clear an
 * isolated stack created with {@link createLayerStack}.
 */
export function resetLayerStack(
  globalObject: LayerStackGlobal = globalThis as LayerStackGlobal
): void {
  const existing = globalObject[LAYER_STACK_GLOBAL_KEY];
  if (existing) existing.clear();
  delete globalObject[LAYER_STACK_GLOBAL_KEY];
}

/** True when Escape should be offered to this layer (it is topmost). */
export function layerReceivesEscape(stack: LayerStack, layerId: LayerId): boolean {
  return stack.isTop(layerId);
}

/**
 * Decide which layer (if any) should handle an Escape key event. Returns the
 * top layer id only for an unprevented Escape / Esc key; otherwise `null`.
 * Pure: the caller still calls `preventDefault` and dismisses.
 */
export function decideEscape(
  stack: LayerStack,
  event: { key: string; defaultPrevented?: boolean }
): { layerId: LayerId } | null {
  if (event.defaultPrevented) return null;
  const key = event.key;
  if (key !== 'Escape' && key !== 'Esc') return null;
  const top = stack.top();
  if (!top) return null;
  return { layerId: top.id };
}

/**
 * Whether `target` lies outside the topmost layer's element.
 *
 * Prefer `composedPath` when the event crosses shadow roots; otherwise
 * `element.contains` on the top layer is used. An empty stack is treated as
 * "outside" (`true`) so callers can no-op. A missing target is outside.
 */
export function isPointerOutsideTopLayer(
  stack: LayerStack,
  target: EventTarget | null | undefined,
  options?: { composedPath?: readonly EventTarget[] }
): boolean {
  const top = stack.top();
  if (!top) return true;
  const path = options?.composedPath;
  if (path && path.length > 0) {
    return !path.includes(top.element);
  }
  if (!target || !(target instanceof Node)) return true;
  return !top.element.contains(target);
}

/**
 * Whether outside interaction should reach the topmost layer for this event
 * target. Equivalent to "there is a top layer and the target is outside it".
 */
export function layerReceivesOutsideInteraction(
  stack: LayerStack,
  target: EventTarget | null | undefined,
  options?: { composedPath?: readonly EventTarget[] }
): { layerId: LayerId } | null {
  const top = stack.top();
  if (!top) return null;
  if (!isPointerOutsideTopLayer(stack, target, options)) return null;
  return { layerId: top.id };
}

export interface BindLayerStackDocumentOptions {
  /**
   * Invoked when Escape targets the top layer. Return `true` (or call
   * `event.preventDefault()`) when the layer dismissed so lower layers skip.
   */
  onEscape?: (layer: LayerEntry, event: KeyboardEvent) => boolean | undefined;
  /**
   * Invoked on pointerdown outside the top layer. Focus-outside is a separate
   * texel (`T-core-dismiss`); this bind only covers pointer.
   */
  onPointerOutside?: (layer: LayerEntry, event: PointerEvent) => boolean | undefined;
  /** Capture phase (default true) so the stack sees the event before content. */
  capture?: boolean;
}

export interface LayerStackDocumentBinding {
  /** Remove the listeners this bind installed. */
  disconnect: () => void;
}

/**
 * Attach document-level Escape and pointerdown routing for a stack. The
 * document is passed in explicitly (no import-time DOM access). Only the
 * topmost layer is offered each event.
 */
export function bindLayerStackDocument(
  documentRef: Document,
  stack: LayerStack,
  options: BindLayerStackDocumentOptions = {}
): LayerStackDocumentBinding {
  const capture = options.capture !== false;

  const onKeyDown = (event: Event) => {
    if (!(event instanceof KeyboardEvent)) return;
    const decision = decideEscape(stack, event);
    if (!decision) return;
    const top = stack.top();
    if (!top || top.id !== decision.layerId) return;
    const handled = options.onEscape?.(top, event);
    if (handled === true && !event.defaultPrevented) event.preventDefault();
  };

  const onPointerDown = (event: Event) => {
    if (!(event instanceof PointerEvent)) return;
    const path = typeof event.composedPath === 'function' ? event.composedPath() : undefined;
    const decision = layerReceivesOutsideInteraction(stack, event.target, {
      composedPath: path,
    });
    if (!decision) return;
    const top = stack.top();
    if (!top || top.id !== decision.layerId) return;
    const handled = options.onPointerOutside?.(top, event);
    if (handled === true && !event.defaultPrevented) event.preventDefault();
  };

  documentRef.addEventListener('keydown', onKeyDown, capture);
  documentRef.addEventListener('pointerdown', onPointerDown, capture);

  return {
    disconnect() {
      documentRef.removeEventListener('keydown', onKeyDown, capture);
      documentRef.removeEventListener('pointerdown', onPointerDown, capture);
    },
  };
}
