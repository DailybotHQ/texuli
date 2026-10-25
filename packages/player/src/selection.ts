import { FRAME_ATTRIBUTE, navigableFrames, parentFrame } from './keyboard.ts';

/**
 * Host-facing selection of painted frames (the builder preview: "preview
 * click selects the matching node", builder design §5). Opt-in with
 * `selectable`. Selection is state only: it changes no player state, runs no
 * validation and proposes no intent; the host hears `onSelectionChange` and
 * decides what it means.
 *
 * - The unit is a layout frame, the player's own focus stop.
 * - A range never crosses levels: it runs between sibling frames.
 * - Frames inside an `inert` subtree are never selected (containment).
 */

/** Attribute the player sets on a selected frame (styled by `player.css`). */
export const SELECTED_ATTRIBUTE = 'data-tx-player-selected';
const PATH_ATTRIBUTE = 'data-tx-player-path';

export type SelectionMode = 'replace' | 'toggle' | 'range';

export interface SelectionState {
  selected: readonly string[];
  /** Where a range starts: the last frame selected by replace or toggle. */
  anchor: string | null;
}

export const EMPTY_SELECTION: SelectionState = Object.freeze({ selected: [], anchor: null });

/**
 * The next selection after acting on `path`. `siblings` are the paths of
 * the frames that share `path`'s parent, in reading order: a range runs
 * between the anchor and `path` only when both are among them, otherwise it
 * starts fresh at `path`.
 */
export function applySelection(
  state: SelectionState,
  path: string,
  mode: SelectionMode,
  siblings: readonly string[]
): SelectionState {
  if (mode === 'toggle') {
    const has = state.selected.includes(path);
    return {
      selected: has ? state.selected.filter((item) => item !== path) : [...state.selected, path],
      anchor: path,
    };
  }
  if (mode === 'range' && state.anchor !== null) {
    const from = siblings.indexOf(state.anchor);
    const to = siblings.indexOf(path);
    if (from >= 0 && to >= 0) {
      const [start, end] = from <= to ? [from, to] : [to, from];
      return { selected: siblings.slice(start, end + 1), anchor: state.anchor };
    }
  }
  return { selected: [path], anchor: path };
}

/** Keep only paths that are still selectable frames; the anchor follows. */
export function pruneSelection(
  state: SelectionState,
  available: ReadonlySet<string>
): SelectionState {
  const selected = state.selected.filter((path) => available.has(path));
  const anchor = state.anchor !== null && available.has(state.anchor) ? state.anchor : null;
  return selected.length === state.selected.length && anchor === state.anchor
    ? state
    : { selected, anchor };
}

export function framePath(frame: Element): string | null {
  return frame.getAttribute(PATH_ATTRIBUTE);
}

/** Paths of the frames that can be selected under `surface` (not inert). */
export function selectablePaths(surface: ParentNode): Set<string> {
  const paths = new Set<string>();
  for (const frame of navigableFrames(surface)) {
    const path = framePath(frame);
    if (path) paths.add(path);
  }
  return paths;
}

/** Sibling frame paths of `frame`, in reading order, skipping inert frames. */
export function siblingPaths(frame: HTMLElement, surface: HTMLElement): string[] {
  const parent = parentFrame(frame, surface);
  return navigableFrames(surface)
    .filter((candidate) => parentFrame(candidate, surface) === parent)
    .map(framePath)
    .filter((path): path is string => path !== null);
}

/** Mark exactly the selected frames under `surface`. */
export function paintSelection(surface: ParentNode, selected: readonly string[]): void {
  const set = new Set(selected);
  for (const frame of surface.querySelectorAll<HTMLElement>(`[${FRAME_ATTRIBUTE}]`)) {
    const path = framePath(frame);
    if (path && set.has(path)) frame.setAttribute(SELECTED_ATTRIBUTE, '');
    else frame.removeAttribute(SELECTED_ATTRIBUTE);
  }
}

const CONTROLS =
  'a[href], button, input, select, textarea, summary, [role="application"], [role="button"], [role="link"], [role="checkbox"], [role="slider"], [role="tab"], [contenteditable=""], [contenteditable="true"]';

/**
 * The frame a click selects, or `null` when the click belongs to a control
 * inside a painted component (the preview never hijacks component input).
 */
export function clickedFrame(target: EventTarget | null, surface: HTMLElement): HTMLElement | null {
  if (!(target instanceof Element) || !surface.contains(target)) return null;
  const frame = target.closest<HTMLElement>(`[${FRAME_ATTRIBUTE}]`);
  if (!frame || frame.closest('[inert]')) return null;
  const control = target.closest(CONTROLS);
  if (control && frame.contains(control)) return null;
  return frame;
}

/** The selection mode for a click or Space press, from its modifiers. */
export function modeFor(event: MouseEvent | KeyboardEvent): SelectionMode {
  if (event.shiftKey) return 'range';
  if (event.ctrlKey || event.metaKey) return 'toggle';
  return 'replace';
}
