/**
 * The toolbar's tooltip: one instance per toolbar, moved between its buttons.
 * It explains a control to a first-time viewer (its label, the registry's
 * one-sentence description and its shortcut). It opens on hover after
 * 300 ms, at once on keyboard focus, and on a 500 ms long press for touch
 * (the click that ends the press is swallowed); Escape closes only the
 * tooltip. While it shows, its button is `aria-describedby` the tooltip.
 *
 * Plain DOM and pure functions: `ChromeTooltip.svelte` draws it, and every
 * rule here is testable with fake timers.
 */

/** Hover delay before a tooltip opens. */
export const TOOLTIP_HOVER_DELAY_MS = 300;
/** A touch held this long shows the tooltip instead of pressing the button. */
export const TOOLTIP_LONG_PRESS_MS = 500;
/** After a long press ends, the tooltip stays this long so it can be read. */
export const TOOLTIP_LINGER_MS = 1500;
const GAP = 8;
const MARGIN = 8;

export interface DeckTooltipContent {
  title: string;
  description: string;
  /** "Keys: F", or `null` for a button-only control. */
  shortcut: string | null;
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Where the tooltip goes (viewport coordinates): centered below its button,
 * flipped above when the bottom has less room (as under a toolbar below the
 * slide, the default), and slid sideways to stay inside the viewport.
 */
export function placeDeckTooltip(
  anchor: Box,
  tip: { width: number; height: number },
  viewport: { width: number; height: number }
): { x: number; y: number } {
  const below = anchor.y + anchor.height + GAP;
  const roomBelow = viewport.height - below - MARGIN;
  const roomAbove = anchor.y - GAP - MARGIN;
  const down = roomBelow >= tip.height || roomBelow >= roomAbove;
  const centered = anchor.x + anchor.width / 2 - tip.width / 2;
  const maxX = Math.max(MARGIN, viewport.width - MARGIN - tip.width);
  return {
    x: Math.min(Math.max(centered, MARGIN), maxX),
    y: down ? below : Math.max(MARGIN, anchor.y - GAP - tip.height),
  };
}

type OpenedBy = 'hover' | 'focus' | 'press';

export interface TooltipMachine<A> {
  readonly current: A | null;
  hoverStart(anchor: A): void;
  hoverEnd(anchor: A): void;
  focus(anchor: A): void;
  blur(anchor: A): void;
  pressStart(anchor: A): void;
  pressEnd(anchor: A): void;
  /** True once after a long press showed the tooltip: the click that follows must not press the button. */
  consumeClick(anchor: A): boolean;
  /** Escape: closes the tooltip; true when it was open. */
  escape(): boolean;
  hide(): void;
  destroy(): void;
}

/** The tooltip's state machine, independent of the DOM. */
export function createTooltipMachine<A>(options: {
  /** True while tooltips must not show (laser, blackout). */
  suppressed?: () => boolean;
  onChange: (anchor: A | null) => void;
}): TooltipMachine<A> {
  let current: A | null = null;
  let openedBy: OpenedBy | null = null;
  let pending: ReturnType<typeof setTimeout> | null = null;
  let pressed: A | null = null;
  let swallow: A | null = null;
  // Right after a hover tooltip closed, the next button's opens at once.
  let warm = false;
  let warmTimer: ReturnType<typeof setTimeout> | null = null;

  const cool = () => {
    if (warmTimer !== null) clearTimeout(warmTimer);
    warmTimer = null;
    warm = false;
  };
  const cancel = () => {
    if (pending !== null) clearTimeout(pending);
    pending = null;
  };
  const show = (anchor: A, by: OpenedBy) => {
    cancel();
    if (options.suppressed?.()) return;
    const changed = current !== anchor;
    current = anchor;
    openedBy = by;
    if (changed) options.onChange(anchor);
  };
  const hide = () => {
    cancel();
    pressed = null;
    if (current === null) return;
    current = null;
    openedBy = null;
    options.onChange(null);
  };
  const later = (run: () => void, ms: number) => {
    cancel();
    pending = setTimeout(() => {
      pending = null;
      run();
    }, ms);
  };

  return {
    get current() {
      return current;
    },
    hoverStart(anchor) {
      if (current === anchor) return;
      if (warm || (current !== null && openedBy === 'hover')) {
        cool();
        show(anchor, 'hover');
        return;
      }
      later(() => show(anchor, 'hover'), TOOLTIP_HOVER_DELAY_MS);
    },
    hoverEnd(anchor) {
      if (current === null) {
        cancel();
        return;
      }
      if (current !== anchor || openedBy !== 'hover') return;
      hide();
      cool();
      warm = true;
      warmTimer = setTimeout(cool, TOOLTIP_HOVER_DELAY_MS);
    },
    focus(anchor) {
      show(anchor, 'focus');
    },
    blur(anchor) {
      if (current === anchor && openedBy !== 'hover') hide();
    },
    pressStart(anchor) {
      pressed = anchor;
      later(() => {
        if (pressed !== anchor) return;
        swallow = anchor;
        show(anchor, 'press');
      }, TOOLTIP_LONG_PRESS_MS);
    },
    pressEnd(anchor) {
      if (pressed !== anchor) return;
      pressed = null;
      if (current === anchor && openedBy === 'press') later(hide, TOOLTIP_LINGER_MS);
      else cancel();
    },
    consumeClick(anchor) {
      if (swallow !== anchor) return false;
      swallow = null;
      return true;
    },
    escape() {
      if (current === null) return false;
      hide();
      return true;
    },
    hide,
    destroy() {
      hide();
      cool();
      swallow = null;
    },
  };
}

export interface DeckTooltipView {
  anchor: HTMLElement;
  content: DeckTooltipContent;
}

export interface DeckTooltip {
  /** The tooltip element id (buttons point `aria-describedby` at it while it shows). */
  readonly id: string;
  /** A Svelte attachment for one button: `{@attach tooltip.anchor(() => content)}`. */
  anchor(content: () => DeckTooltipContent): (node: HTMLElement) => () => void;
  subscribe(listener: (view: DeckTooltipView | null) => void): () => void;
  hide(): void;
  destroy(): void;
}

let sequence = 0;

function keyboardFocus(node: HTMLElement): boolean {
  try {
    return node.matches(':focus-visible');
  } catch {
    return true;
  }
}

/**
 * The one tooltip of a toolbar. Each button attaches with `anchor()`; while
 * the tooltip shows it listens for Escape in the capture phase, before the
 * deck sees the key, so Escape never also leaves full screen.
 */
export function createDeckTooltip(options: { suppressed?: () => boolean } = {}): DeckTooltip {
  sequence += 1;
  const id = `tx-deck-tooltip-${sequence}`;
  const contents = new Map<HTMLElement, () => DeckTooltipContent>();
  const listeners = new Set<(view: DeckTooltipView | null) => void>();
  let view: DeckTooltipView | null = null;
  let described: HTMLElement | null = null;

  const onKeydown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !machine.escape()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  const machine: TooltipMachine<HTMLElement> = createTooltipMachine<HTMLElement>({
    ...(options.suppressed ? { suppressed: options.suppressed } : {}),
    onChange: (anchor) => {
      described?.removeAttribute('aria-describedby');
      described = null;
      const read = anchor ? contents.get(anchor) : undefined;
      view = anchor && read ? { anchor, content: read() } : null;
      if (view) {
        view.anchor.setAttribute('aria-describedby', id);
        described = view.anchor;
        globalThis.addEventListener?.('keydown', onKeydown as EventListener, true);
      } else {
        globalThis.removeEventListener?.('keydown', onKeydown as EventListener, true);
      }
      for (const listener of listeners) listener(view);
    },
  });

  return {
    id,
    anchor(content) {
      return (node) => {
        contents.set(node, content);
        const enter = (event: PointerEvent) => {
          if (event.pointerType !== 'touch') machine.hoverStart(node);
        };
        const leave = (event: PointerEvent) => {
          if (event.pointerType !== 'touch') machine.hoverEnd(node);
        };
        const down = (event: PointerEvent) => {
          if (event.pointerType === 'touch') machine.pressStart(node);
        };
        const up = (event: PointerEvent) => {
          if (event.pointerType === 'touch') machine.pressEnd(node);
        };
        const focus = () => {
          if (keyboardFocus(node)) machine.focus(node);
        };
        const blur = () => machine.blur(node);
        const click = (event: MouseEvent) => {
          if (!machine.consumeClick(node)) {
            // A pressed control's tooltip has done its job; left open it would take the next Escape.
            machine.hide();
            return;
          }
          event.preventDefault();
          event.stopImmediatePropagation();
        };
        const menu = (event: Event) => {
          if (machine.current === node) event.preventDefault();
        };
        const events: [string, EventListener, boolean?][] = [
          ['pointerenter', enter as EventListener],
          ['pointerleave', leave as EventListener],
          ['pointerdown', down as EventListener],
          ['pointerup', up as EventListener],
          ['pointercancel', up as EventListener],
          ['focus', focus],
          ['blur', blur],
          ['click', click as EventListener, true],
          ['contextmenu', menu],
        ];
        for (const [type, listener, capture] of events) {
          node.addEventListener(type, listener, capture === true);
        }
        return () => {
          if (machine.current === node) machine.hide();
          contents.delete(node);
          for (const [type, listener, capture] of events) {
            node.removeEventListener(type, listener, capture === true);
          }
        };
      };
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(view);
      return () => {
        listeners.delete(listener);
      };
    },
    hide() {
      machine.hide();
    },
    destroy() {
      machine.destroy();
      listeners.clear();
      contents.clear();
    },
  };
}
