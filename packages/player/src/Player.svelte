<script lang="ts">
import {
  createPlayer,
  type PaintAdapter,
  type PlayerHandle,
  type PlayerState,
  type PlayerStatus,
} from '@texuli/catalog/player';
import { formulaConditions } from '@texuli/catalog/render/conditions';
import type { RenderCatalog, RenderTier } from '@texuli/catalog/render/renderer';
import { type Component, type Snippet, tick, untrack } from 'svelte';
import './player.css';
import { createActionAccess } from './action-access.ts';
import { type ActionHandler, checkActionNodes } from './actions.ts';
import {
  createAnnouncer,
  formatAnnouncement,
  paintAnnouncement,
  selectionAnnouncement,
} from './announcements.ts';
import { checkFamilyBlock } from './block-check.ts';
import { createPlayerCatalog } from './catalog.ts';
import { sameConditionInputs, stateConditionInputs } from './conditions.ts';
import {
  setPlayerActionAccess,
  setPlayerFlowAccess,
  setPlayerHostRegions,
  setPlayerInteraction,
  setPlayerLabels,
  setPlayerLandmarks,
  setPlayerStateAccess,
} from './context.ts';
import { type DeckPlayerHost, isLayoutDeckTree } from './deck-host.ts';
import type { PlayerDiagnosticsEvent, PlayerSize } from './embed/types.ts';
import type { PlayerNodeError, PlayerNodeErrorPhase } from './errors.ts';
import { withoutHostChrome, withoutHostChromeLoaders } from './host-chrome.ts';
import { applyHostData, checkHostBoundWriters, type DataSources } from './host-data.ts';
import { handleSurfaceKeydown, normalizeTabOrder } from './keyboard.ts';
import { type PlayerLabelOverrides, resolvePlayerLabels, safeLang } from './labels.ts';
import { PLAYER_GRAMMAR_ROLES } from './layout-manifests.ts';
import { planFrames } from './layouts/outline.ts';
import {
  carryFlowView,
  carryStateSnapshot,
  keepSameNodes,
  planIdentities,
  sameSnapshot,
} from './live-update.ts';
import { PLAYER_LOADERS } from './loaders.ts';
import { applyMediaPolicy } from './media-policy.ts';
import PlayerNode from './PlayerNode.svelte';
import { withNodePath } from './painters/interactive.ts';
import { isHostRegionName } from './region-manifests.ts';
import {
  applySelection,
  clickedFrame,
  EMPTY_SELECTION,
  framePath,
  modeFor,
  paintSelection,
  pruneSelection,
  type SelectionState,
  selectablePaths,
  siblingPaths,
} from './selection.ts';
import { DEFAULT_LOAD_TIMEOUT_MS, skeletonFamily, withLoadTimeout } from './skeletons.ts';
import {
  type NodeInteraction,
  type ResolveOptions,
  resolveStateBindings,
  splitStatefulBlueprint,
} from './state/bind.ts';
import { checkControlBindings } from './state/controls.ts';
import { checkFlowNodes, nextFlowView } from './state/flow.ts';
import { type EventDetail, moveListItem, runActions } from './state/reducers.ts';
import {
  coerceStateValue,
  initialSnapshot,
  type ListItem,
  type StateIssue,
  type StateSnapshot,
  type StateValue,
} from './state/schema.ts';
import type { PlayerPaintNode } from './types.ts';

type Props = {
  blueprint: unknown;
  catalog?: RenderCatalog;
  catalogHash?: string;
  tier?: RenderTier;
  status?: Exclude<PlayerStatus, 'invalid'>;
  invalidPolicy?: 'refuse' | 'preview';
  label?: string;
  loaders?: Readonly<Record<string, () => Promise<unknown>>>;
  /** A loader slower than this paints a `node-error` placeholder. `0` disables the limit. */
  loadTimeoutMs?: number;
  /** Called once per failing node (load, render or a non-component loader result). Never rendered. */
  onNodeError?: (error: PlayerNodeError) => void;
  /** Text direction of the player root. Default: inherited from the host. */
  dir?: 'ltr' | 'rtl' | 'auto';
  /** Language of the player's content and chrome; ignored unless BCP 47-shaped. */
  lang?: string;
  /** Host-localized chrome copy; merged per key onto the English defaults. */
  labels?: PlayerLabelOverrides;
  /** `compact` tightens chrome and spacing for chat surfaces. */
  density?: 'comfortable' | 'compact';
  /** Called after every validation (mount and each blueprint, status or catalog change). */
  onDiagnostics?: (event: PlayerDiagnosticsEvent) => void;
  /** Called with the player's border-box size whenever it changes (iframe auto-height). */
  onResize?: (size: PlayerSize) => void;
  /**
   * Host-owned composer chrome, painted under the surface and outside the
   * validated tree. A blueprint can never supply a composer.
   */
  composer?: Snippet;
  /**
   * Host-owned regions (R21), by name: a `host-region` node with that name
   * mounts the snippet, called with no arguments, so the blueprint never
   * reaches it. Names the host leaves out paint the node's label instead.
   */
  hostRegions?: Readonly<Record<string, Snippet>>;
  /** Host overrides for declared state; values that do not fit their declaration are ignored. */
  initialState?: Readonly<Record<string, unknown>>;
  /** Called with the full snapshot after every accepted state change. The only way state leaves. */
  onStateChange?: (snapshot: StateSnapshot) => void;
  /**
   * `false` marks this player as a non-active frame (a background tab, an
   * off-stage slide): the painted surface becomes `inert`, so focus and
   * pointer input cannot reach it. Default `true`.
   */
  active?: boolean;
  /**
   * Host-facing selection of painted frames (a builder preview). Off by
   * default; selection is state only and never changes the blueprint.
   */
  selectable?: boolean;
  /** Selected frame paths the host sets (`0.children.1`); unknown paths are dropped. */
  selection?: readonly string[];
  /** Called with the selected paths after every user change. */
  onSelectionChange?: (paths: readonly string[]) => void;
  /**
   * Motion policy. `reduce` stops motion inside the player whatever the user
   * setting; `auto` (default) follows `prefers-reduced-motion`. Either way
   * the root carries the tokens' `data-tx-motion="reduce"` contract.
   */
  motion?: 'auto' | 'reduce';
  /**
   * The current flow view (G09), when the host mirrors it (for example from
   * its URL). Ignored unless it names a declared view; default the flow's
   * `initial`.
   */
  view?: string;
  /** Called after a flow action moves the view. The player never touches `location`. */
  onFlowChange?: (change: { from: string; to: string; event: string }) => void;
  /**
   * The host's answer to an action intent (G17): `confirmed` or `rejected`,
   * possibly async. Without it, actions are unavailable; the player never
   * sends anything itself.
   */
  onAction?: ActionHandler;
  /**
   * Host data for host-bound state variables (host G01): source name → plain
   * scalar. Coerced to each variable's declaration; an update changes it in
   * place. The player never fetches.
   */
  dataSources?: DataSources;
  /**
   * Whether layout painters may emit document landmarks (`<main>`). A host
   * embedding the player inline inside its own landmark passes `false`, and
   * the page layout paints a plain section instead (no duplicate `main`).
   */
  landmarks?: boolean;
  /**
   * When `false`, the player paints no frame chrome: no label heading, skip
   * link or end anchor. Use this when the host already frames the content
   * (for example a deck slide embedding a catalog component).
   * Default `true`.
   */
  chrome?: boolean;
  /**
   * Optional host seam for `layout-deck` roots. When set and the validated
   * tree is a deck, the player calls the host instead of painting the deck
   * as a document. The player (L7) cannot import `@texuli/slides` (L8); the
   * slides stage supplies the adapter. Document paint remains the default.
   */
  deckHost?: DeckPlayerHost | null;
};

let {
  blueprint,
  catalog = createPlayerCatalog(),
  catalogHash,
  tier = 'untrusted',
  status = 'draft',
  invalidPolicy = 'refuse',
  label = 'Blueprint preview',
  loaders = PLAYER_LOADERS,
  loadTimeoutMs = DEFAULT_LOAD_TIMEOUT_MS,
  onNodeError,
  dir,
  lang,
  labels,
  density = 'comfortable',
  onDiagnostics,
  onResize,
  composer,
  hostRegions,
  initialState,
  onStateChange,
  active = true,
  selectable = false,
  selection,
  onSelectionChange,
  motion = 'auto',
  view,
  onFlowChange,
  onAction,
  dataSources,
  landmarks = true,
  chrome = true,
  deckHost = null,
}: Props = $props();

// The user's reduced-motion preference, followed live.
let prefersReducedMotion = $state(false);
$effect(() => {
  const media =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;
  if (!media) return;
  const update = () => {
    prefersReducedMotion = media.matches;
  };
  update();
  media.addEventListener?.('change', update);
  return () => media.removeEventListener?.('change', update);
});
let reducedMotion = $derived(motion === 'reduce' || prefersReducedMotion);

const skipTargetId = $props.id();
let surface = $state<HTMLElement | null>(null);
let labelElement = $state<HTMLElement | null>(null);
let lastFocused: HTMLElement | null = null;

function skipPast(event: MouseEvent): void {
  event.preventDefault();
  root?.querySelector<HTMLElement>(`[id="${skipTargetId}"]`)?.focus();
}

let selectionState = $state<SelectionState>(EMPTY_SELECTION);

// The host's selection seeds and overrides the player's; it is not echoed back.
$effect(() => {
  const paths = selection ? [...selection] : [];
  untrack(() => {
    selectionState = { selected: paths, anchor: paths[paths.length - 1] ?? null };
  });
});

function commitSelection(next: SelectionState, byUser = true): void {
  const changed =
    next.selected.length !== selectionState.selected.length ||
    next.selected.some((path, index) => path !== selectionState.selected[index]);
  selectionState = next;
  if (!changed) return;
  onSelectionChange?.([...next.selected]);
  if (byUser) announceSelection(next.selected);
}

// ── Announcements: one polite region; refusals interrupt through the notice ──
const announcer = createAnnouncer();
let politeText = $state('');

function announcePolite(text: string): void {
  const out = announcer.announce({ politeness: 'polite', text });
  if (out !== null) politeText = out;
}

function frameName(path: string): string {
  const frame = surface?.querySelector<HTMLElement>(`[data-tx-player-path="${path}"]`);
  const labelledBy = frame?.getAttribute('aria-labelledby');
  const name = labelledBy
    ? frame?.ownerDocument.getElementById(labelledBy)?.textContent
    : frame?.getAttribute('aria-label');
  return name?.trim() || path;
}

function announceSelection(paths: readonly string[]): void {
  if (paths.length === 0) {
    // Nothing to say; let the next selection be spoken even if it repeats.
    announcer.reset('polite');
    return;
  }
  announcePolite(selectionAnnouncement(paths.map(frameName), resolvedLabels));
}

function selectFrame(frame: HTMLElement, mode: ReturnType<typeof modeFor>): void {
  const path = framePath(frame);
  if (!surface || !path) return;
  commitSelection(applySelection(selectionState, path, mode, siblingPaths(frame, surface)));
}

function onSurfaceClick(event: MouseEvent): void {
  if (!selectable || !active || !surface) return;
  const frame = clickedFrame(event.target, surface);
  if (frame) selectFrame(frame, modeFor(event));
}

/** Selection keys on a focused frame; returns `true` when handled. */
function onSelectionKey(event: KeyboardEvent): boolean {
  const target = event.target;
  if (!selectable || !surface || event.defaultPrevented || event.altKey) return false;
  if (!(target instanceof HTMLElement) || !target.hasAttribute('data-tx-player-frame'))
    return false;
  if (event.key === ' ') {
    selectFrame(target, modeFor(event));
    return true;
  }
  if (event.key === 'Escape' && selectionState.selected.length > 0) {
    commitSelection(EMPTY_SELECTION);
    return true;
  }
  if (event.shiftKey && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
    const siblings = siblingPaths(target, surface);
    const path = framePath(target);
    const next = siblings[siblings.indexOf(path ?? '') + (event.key === 'ArrowDown' ? 1 : -1)];
    if (!path || next === undefined) return false;
    const anchored =
      selectionState.anchor === null ? { selected: [path], anchor: path } : selectionState;
    commitSelection(applySelection(anchored, next, 'range', siblings));
    surface.querySelector<HTMLElement>(`[data-tx-player-path="${next}"]`)?.focus();
    return true;
  }
  return false;
}

function onSurfaceKeydown(event: KeyboardEvent): void {
  if (onSelectionKey(event)) {
    event.preventDefault();
    return;
  }
  if (surface) handleSurfaceKeydown(event, { surface, outer: labelElement });
}

// A live update (R20) keeps a selected frame only while the same node sits at
// its path: a path that now holds another catalog id is deselected.
let lastIdentities: ReadonlyMap<string, string> | null = null;
$effect(() => {
  const identities = planIdentities(playerState?.plan ?? []);
  const before = lastIdentities;
  lastIdentities = identities;
  if (!before) return;
  const current = untrack(() => selectionState);
  const kept = keepSameNodes(current.selected, before, identities);
  if (kept.length === current.selected.length) return;
  const anchor = current.anchor !== null && kept.includes(current.anchor) ? current.anchor : null;
  commitSelection({ selected: kept, anchor: anchor ?? kept[kept.length - 1] ?? null }, false);
});

// Show the selection on the frames, and drop paths that stopped being frames
// once nothing is still loading.
$effect(() => {
  void paintNodes;
  const element = surface;
  const selected = selectionState.selected;
  if (!element) return;
  paintSelection(element, selectable ? selected : []);
  if (!selectable || element.querySelector('[data-tx-player-skeleton]')) return;
  const pruned = pruneSelection(
    untrack(() => selectionState),
    selectablePaths(element)
  );
  if (pruned !== untrack(() => selectionState)) commitSelection(pruned, false);
});

/** The frames around the focused node, innermost first: rescue targets if it disappears. */
let focusedFrames: HTMLElement[] = [];

function onFocusIn(event: FocusEvent): void {
  lastFocused = event.target instanceof HTMLElement ? event.target : null;
  focusedFrames = [];
  let frame = lastFocused?.closest<HTMLElement>('[data-tx-player-frame]') ?? null;
  while (frame) {
    focusedFrames.push(frame);
    frame = frame.parentElement?.closest<HTMLElement>('[data-tx-player-frame]') ?? null;
  }
}

const NO_STATE: StateSnapshot = Object.freeze({});

// Local state (G01): declared by the blueprint, held in this player only.
let split = $derived(splitStatefulBlueprint(blueprint));
// The values the reader holds now. A new blueprint (a live update, R20)
// keeps each one its declarations still accept; the rest start over.
let liveState: StateSnapshot = NO_STATE;
let stateValues = $derived(
  split.kind === 'stateful'
    ? // Host-bound variables (host G01) take the host's data over any carried value.
      applyHostData(
        split.declarations,
        carryStateSnapshot(
          split.declarations,
          untrack(() => liveState),
          untrack(() => initialState)
        ),
        dataSources
      )
    : NO_STATE
);
$effect.pre(() => {
  const next = stateValues;
  const before = untrack(() => liveState);
  liveState = next;
  // An update that changed the snapshot (a variable added, dropped or reset) is reported.
  if (before !== NO_STATE && next !== before && !sameSnapshot(before, next)) {
    untrack(() => onStateChange?.(next));
  }
});
const NO_INTERACTIONS: ReadonlyMap<string, NodeInteraction> = new Map();
// What bind, on and reorder name, read by the resolver: bindable props come from the catalog.
let resolveOptions = $derived<ResolveOptions>({
  ...(dataSources ? { dataSources } : {}),
  bindable: (id) => catalog.get(id)?.bindable,
  writable: (name) =>
    split.kind === 'stateful' &&
    Object.hasOwn(split.declarations, name) &&
    split.declarations[name]?.source === undefined,
});
let resolved = $derived.by(
  (): {
    blueprint: unknown;
    issues: readonly StateIssue[];
    interactions: ReadonlyMap<string, NodeInteraction>;
  } => {
    if (split.kind === 'invalid') {
      return { blueprint: null, issues: split.issues, interactions: NO_INTERACTIONS };
    }
    // State-only controls must each name a declared variable of the type they write.
    // Flow nodes must name declared views and events (G09).
    if (split.kind === 'plain') {
      // A plain tree still reads host data and may run actions that need no state.
      const plain = resolveStateBindings(split.blueprint, NO_STATE, resolveOptions);
      return {
        blueprint: plain.blueprint,
        interactions: plain.interactions,
        issues: [
          ...plain.issues,
          ...checkControlBindings(split.blueprint, null),
          ...checkFlowNodes(split.blueprint, null),
          ...checkActionNodes(split.blueprint, null),
        ],
      };
    }
    const bound = resolveStateBindings(split.blueprint, stateValues, resolveOptions);
    const controls = [
      ...checkControlBindings(split.blueprint, split.declarations),
      ...checkFlowNodes(split.blueprint, split.flow),
      ...checkActionNodes(split.blueprint, split.declarations),
      ...checkHostBoundWriters(split.blueprint, split.declarations),
    ];
    return controls.length > 0
      ? {
          blueprint: bound.blueprint,
          issues: [...bound.issues, ...controls],
          interactions: bound.interactions,
        }
      : bound;
  }
);
let interactions = $derived(resolved.interactions);
let stateIssues = $derived(resolved.issues);
let conditionInputs = $derived(stateConditionInputs(stateValues));
// The inputs the current player handle last evaluated with.
let appliedInputs = untrack(() => conditionInputs);
// A boolean, so a state change that stays valid never recreates the handle.
let stateRefused = $derived(stateIssues.length > 0);

/** Set one declared variable. Returns `false` (and changes nothing) when the value does not fit. */
export function setState(name: string, value: unknown): boolean {
  if (split.kind !== 'stateful' || !Object.hasOwn(split.declarations, name)) return false;
  const declaration = split.declarations[name];
  // A host-bound variable is the host's: only `dataSources` changes it.
  if (declaration?.source !== undefined) return false;
  const next = declaration ? coerceStateValue(declaration, value) : undefined;
  if (next === undefined) return false;
  if (stateValues[name] === next) return true;
  stateValues = Object.freeze({ ...stateValues, [name]: next });
  liveState = stateValues;
  onStateChange?.(stateValues);
  return true;
}

/** The current state snapshot (empty for a blueprint without state). */
export function getState(): StateSnapshot {
  return stateValues;
}

// Views and flows (G09): the current view is local, like state.
let flow = $derived(split.kind === 'stateful' ? split.flow : null);
// The view the reader is on; a live update (R20) keeps it while the new flow
// declares it. The host's `view` applies when the host changes it, not again
// on every update (mountPlayer passes every prop each time).
let liveView: string | null = null;
let appliedHostView: string | undefined;
let flowView = $derived(
  flow
    ? carryFlowView(
        flow,
        untrack(() => liveView),
        view !== untrack(() => appliedHostView) ? view : undefined
      )
    : null
);
$effect.pre(() => {
  // Read the view first: it is computed against the host view applied so far.
  liveView = flowView;
  appliedHostView = view;
});

/** Fire a declared flow event. Returns `false` (and changes nothing) when no transition applies. */
export function dispatchFlow(event: string): boolean {
  if (!flow || flowView === null) return false;
  const to = nextFlowView(flow, flowView, event, conditionInputs);
  if (to === null) return false;
  const from = flowView;
  flowView = to;
  liveView = to;
  onFlowChange?.({ from, to, event });
  // Move focus into the new view and say which view is showing.
  void tick().then(() => {
    const target = surface?.querySelector<HTMLElement>(`[data-tx-player-flow-view="${to}"]`);
    target?.focus();
    announcePolite(
      formatAnnouncement(resolvedLabels.flowChanged, {
        view: target?.getAttribute('aria-label') ?? to,
      })
    );
  });
  return true;
}

/** The current flow view, or `null` without a declared flow. */
export function getView(): string | null {
  return flowView;
}

/** Return every variable to its declared initial value (ignoring `initialState`). */
export function resetState(): void {
  if (split.kind !== 'stateful') return;
  stateValues = initialSnapshot(split.declarations);
  liveState = stateValues;
  onStateChange?.(stateValues);
}

let resolvedLabels = $derived(resolvePlayerLabels(labels));
let rootLang = $derived(safeLang(lang));
let root = $state<HTMLElement | null>(null);
setPlayerLabels(() => resolvedLabels);
setPlayerLandmarks(() => landmarks);
// State-only controls (G06/D14) read and write declared state through this, and nothing else.
setPlayerStateAccess({
  read: (name) => (Object.hasOwn(stateValues, name) ? stateValues[name] : undefined),
  write: (name, value) => setState(name, value),
  declaration: (name) =>
    split.kind === 'stateful' && Object.hasOwn(split.declarations, name)
      ? split.declarations[name]
      : undefined,
});

// Host regions (R21): only the first node with a name mounts the host's snippet.
const regionOwners = new Map<string, object>();
setPlayerHostRegions({
  get: (name) =>
    isHostRegionName(name) && hostRegions && Object.hasOwn(hostRegions, name)
      ? hostRegions[name]
      : undefined,
  claim: (name, owner) => {
    const held = regionOwners.get(name);
    if (held && held !== owner) return false;
    regionOwners.set(name, owner);
    return true;
  },
  release: (name, owner) => {
    if (regionOwners.get(name) === owner) regionOwners.delete(name);
  },
});

/** Whether `target` sits inside a host region the host mounted (R21). */
function insideHostRegion(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('[data-tx-player-host-region]') !== null;
}

// Action forms (G17) propose intents to the host through this and get receipts.
setPlayerActionAccess(
  createActionAccess({
    handler: () => onAction,
    labels: () => resolvedLabels,
    announce: (text) => announcePolite(text),
  })
);

// Flow nodes read the view and fire declared events through this.
setPlayerFlowAccess({
  view: () => flowView,
  can: (event) =>
    flow !== null &&
    flowView !== null &&
    nextFlowView(flow, flowView, event, conditionInputs) !== null,
  dispatch: (event) => dispatchFlow(event),
});

// Spec 0.3.0 interaction: on, bind and reorder, through the closed reducers only.
function commitSnapshot(next: StateSnapshot): void {
  stateValues = next;
  liveState = next;
  onStateChange?.(next);
}

let actionSequence = 0;

/** Run `actions` for `event`; refused lists change nothing and are announced. */
function runNodeActions(
  actions: readonly unknown[],
  event: string,
  detail: EventDetail | undefined,
  form: { submit(): void } | null | undefined
): boolean {
  const declarations = split.kind === 'stateful' ? split.declarations : {};
  const result = runActions(actions, {
    snapshot: stateValues,
    declarations,
    event,
    ...(detail ? { detail } : {}),
    inForm: form !== null && form !== undefined,
  });
  if (!result.ok) {
    announcePolite(resolvedLabels.actionRefused);
    return false;
  }
  if (result.changed.length > 0) commitSnapshot(result.snapshot);
  for (const effect of result.effects) {
    if (effect.kind === 'flow') dispatchFlow(effect.event);
    else if (effect.kind === 'submit') form?.submit();
    else {
      actionSequence += 1;
      const intent = Object.freeze({
        id: `emit-${actionSequence}`,
        action: effect.intent,
        values: effect.values,
      });
      void Promise.resolve(onAction ? onAction(intent) : 'unavailable').catch(() => undefined);
    }
  }
  return true;
}

function reorderOf(path: string) {
  const node = interactions.get(path);
  const reorder = node?.reorder;
  if (!reorder) return null;
  const list = stateValues[reorder.list];
  if (!Array.isArray(list)) return null;
  return { node, reorder, list: list as readonly ListItem[] };
}

const stringList = (value: unknown): readonly string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

const pullOf = (value: unknown): 'move' | 'clone' | 'none' =>
  value === 'clone' || value === 'none' ? value : 'move';

/**
 * The one reorder rule set (spec 0.3.0): both containers enabled, the target
 * accepting the source's group across containers, and the closed `moveItem`
 * reducer (locked, pull, maxItems). `null` when the move is refused. The UI
 * drag asks it before a drop (`canMove`) and the move commits its result, so
 * what a drag offers is exactly what `move` does.
 */
function planMove(fromPath: string, item: string, toPath: string, index: number) {
  const source = reorderOf(fromPath);
  const target = reorderOf(toPath);
  if (!source || !target || source.reorder.disabled === true || target.reorder.disabled === true)
    return null;
  if (fromPath !== toPath) {
    // Containers exchange items only when the target accepts the source's group.
    const group = typeof source.reorder.group === 'string' ? source.reorder.group : undefined;
    if (
      group === undefined ||
      !stringList(target.reorder.accepts)
        .concat(typeof target.reorder.group === 'string' ? [target.reorder.group] : [])
        .includes(group)
    ) {
      return null;
    }
  }
  const declarations = split.kind === 'stateful' ? split.declarations : {};
  const maxItems: Record<string, number> = {};
  for (const name of [source.reorder.list, target.reorder.list]) {
    const declaration = declarations[name];
    if (declaration?.type === 'list') maxItems[name] = declaration.maxItems;
  }
  const moved = moveListItem(
    { [source.reorder.list]: source.list, [target.reorder.list]: target.list },
    maxItems,
    { from: source.reorder.list, item, to: target.reorder.list, index },
    { locked: stringList(source.reorder.locked), pull: pullOf(source.reorder.pull) }
  );
  return moved.ok ? { source, lists: moved.lists } : null;
}

setPlayerInteraction({
  dispatch(path, event, detail, form) {
    const actions = interactions.get(path)?.on?.[event];
    return actions ? runNodeActions(actions, event, detail, form) : true;
  },
  bound: (path, prop) => interactions.get(path)?.bind?.[prop] !== undefined,
  write(path, prop, value) {
    const name = interactions.get(path)?.bind?.[prop];
    return name !== undefined && setState(name, value);
  },
  reorder(path) {
    const found = reorderOf(path);
    if (!found) return null;
    const { reorder, list } = found;
    const axis =
      reorder.axis === 'horizontal' || reorder.axis === 'grid' ? reorder.axis : 'vertical';
    const declaration = split.kind === 'stateful' ? split.declarations[reorder.list] : undefined;
    return {
      list,
      axis,
      ...(typeof reorder.group === 'string' ? { group: reorder.group } : {}),
      accepts: stringList(reorder.accepts),
      pull: pullOf(reorder.pull),
      ...(declaration?.type === 'list' ? { maxItems: declaration.maxItems } : {}),
      disabled: reorder.disabled === true,
      locked: stringList(reorder.locked),
    };
  },
  canMove: (fromPath, item, toPath, index) => planMove(fromPath, item, toPath, index) !== null,
  move(fromPath, item, toPath, index) {
    const planned = planMove(fromPath, item, toPath, index);
    if (!planned) {
      announcePolite(resolvedLabels.actionRefused);
      return false;
    }
    const next: Record<string, StateValue> = { ...stateValues };
    for (const [name, list] of Object.entries(planned.lists)) next[name] = list;
    commitSnapshot(Object.freeze(next));
    const actions = planned.source.node?.on?.move;
    if (actions) runNodeActions(actions, 'move', undefined, null);
    return true;
  },
});

// Nothing painted may submit (D14): a submit from a host form wrapper or a
// painted component is cancelled at the surface. A form the host mounted in
// one of its own regions is host chrome, so its submit goes through.
function onSurfaceSubmit(event: SubmitEvent): void {
  if (insideHostRegion(event.target)) return;
  event.preventDefault();
  event.stopPropagation();
}

// Repaints call the adapter again; report each failing node once per player.
let reported = new Set<string>();

function report(id: string, path: string, phase: PlayerNodeErrorPhase): void {
  const key = `${path}\u0000${id}\u0000${phase}`;
  if (reported.has(key)) return;
  reported.add(key);
  onNodeError?.({ code: 'node-error', id, path, phase });
}

function nodeError(id: string, path: string): PlayerPaintNode {
  return {
    kind: 'placeholder',
    id,
    path,
    label: `“${id}” could not be shown`,
    reason: 'node-error',
  };
}

const adapter: PaintAdapter<PlayerPaintNode> = {
  component: (node, component, children) => {
    // A loader that resolves to something other than a component (a wrong
    // export name, a module object) is a contained node error, not a throw.
    if (typeof component !== 'function') {
      report(node.id, node.path, 'invalid-component');
      return nodeError(node.id, node.path);
    }
    return {
      kind: 'component',
      id: node.id,
      path: node.path,
      // Media policy after the URL policy: trust pinned, no autoplay, controls on.
      props: withNodePath(
        node.id,
        node.path,
        applyMediaPolicy(node.id, node.props, resolvedLabels)
      ),
      component: component as Component<Record<string, unknown>>,
      children,
      ...(frames.has(node.path) ? { frame: frames.get(node.path) } : {}),
      ...(node.slot !== undefined ? { slot: node.slot } : {}),
    };
  },
  placeholder: (node) => {
    // The core only produces `node-error` placeholders when a load failed.
    if (node.reason === 'node-error') report(node.id, node.path, 'load');
    return {
      kind: 'placeholder',
      id: node.id,
      path: node.path,
      label: node.label,
      reason: node.reason as Extract<PlayerPaintNode, { kind: 'placeholder' }>['reason'],
      ...(node.slot !== undefined ? { slot: node.slot } : {}),
    };
  },
  skeleton: (node) => ({
    kind: 'skeleton',
    id: node.id,
    path: node.path,
    label: catalog.get(node.id)?.label ?? node.id,
    family: skeletonFamily(node.id),
    ...(node.slot !== undefined ? { slot: node.slot } : {}),
  }),
};

let player = $state<PlayerHandle | null>(null);
let playerState = $state<PlayerState | null>(null);
// Heading ranks, frame ids and contents for content layouts, from the plan.
let frames = $derived(planFrames(playerState?.plan ?? [], skipTargetId));

let shownStatus = $derived<PlayerStatus>(
  stateRefused ? 'invalid' : (playerState?.status ?? status)
);
let loadRevision = $state(0);
let paintNodes = $derived.by(() => {
  playerState;
  loadRevision;
  return player?.paintNow(adapter) ?? [];
});

// The shared drag scope (spec 0.3.0 reorder), loaded only when a node reorders.
let hasReorder = $derived([...interactions.values()].some((node) => node.reorder !== undefined));
let ReorderScope = $state.raw<Component<{ children: Snippet }> | null>(null);
$effect(() => {
  if (!hasReorder || ReorderScope !== null) return;
  void import('./painters/ReorderScope.svelte').then((module) => {
    ReorderScope = module.default;
  });
});

function countKind(nodes: readonly PlayerPaintNode[], kind: PlayerPaintNode['kind']): number {
  let total = 0;
  for (const node of nodes) {
    if (node.kind === kind) total += 1;
    if (node.kind === 'component') total += countKind(node.children, kind);
  }
  return total;
}

// Paint lifecycle: speak once the paint settles (no skeletons), and again only
// when what was painted changes. A refusal is the notice's (assertive) to say.
$effect(() => {
  const nodes = paintNodes;
  const refused = stateRefused || playerState?.surface === 'notice';
  if (refused || !playerState) {
    untrack(() => {
      announcer.reset('polite');
      politeText = '';
    });
    return;
  }
  if (countKind(nodes, 'skeleton') > 0) return;
  const layoutFrames = [...frames.values()].filter((frame) => !frame.anchor).length;
  const text = paintAnnouncement(
    {
      frames: layoutFrames,
      placeholders: countKind(nodes, 'placeholder'),
      preview: !playerState.validation.ok,
      // Draft is the default, and an invalid draft is already said by the preview warning.
      status:
        shownStatus === 'draft' || shownStatus === 'invalid'
          ? null
          : resolvedLabels.status[shownStatus],
    },
    resolvedLabels
  );
  untrack(() => announcePolite(text));
});

function reportDiagnostics(handle: PlayerHandle): void {
  untrack(() =>
    onDiagnostics?.({
      status: handle.state.status,
      surface: handle.state.surface,
      ...(handle.state.error ? { error: handle.state.error } : {}),
      diagnostics: handle.state.validation.diagnostics,
      receipt: handle.receipt(),
      stateIssues: [],
    })
  );
}

// The blueprint the current handle validated; a state change re-validates
// the newly resolved tree on the same handle (loaded painters are kept).
let validatedBlueprint: unknown;

// What the handle is built from. A live update (R20) keeps the handle, and
// with it the loaded painters, unless one of these really changed: hosts
// such as mountPlayer pass every prop again on each update.
let handleKey: readonly unknown[] = [];
const handleInputs = $derived.by(() => {
  const next = [catalog, catalogHash, tier, status, invalidPolicy, loaders, loadTimeoutMs];
  if (next.length === handleKey.length && next.every((value, i) => value === handleKey[i])) {
    return handleKey;
  }
  handleKey = next;
  return next;
});

$effect(() => {
  if (stateRefused) {
    player = null;
    playerState = null;
    const issues = untrack(() => stateIssues);
    untrack(() =>
      onDiagnostics?.({
        status: 'invalid',
        surface: 'notice',
        error: 'invalid',
        diagnostics: [],
        receipt: null,
        stateIssues: issues,
      })
    );
    return;
  }
  void handleInputs;
  const initial = untrack(() => resolved.blueprint);
  const handle = createPlayer(
    untrack(() => ({
      blueprint: initial,
      catalog: withoutHostChrome(catalog),
      catalogHash,
      tier,
      status,
      invalidPolicy,
      checkBlock: checkFamilyBlock,
      // `when` conditions (G07) read the local state, mapped to numbers.
      conditions: formulaConditions,
      conditionInputs: untrack(() => {
        appliedInputs = conditionInputs;
        return conditionInputs;
      }),
      // The default roles plus the G20 layouts: validation ranks what planFrames paints.
      roles: PLAYER_GRAMMAR_ROLES,
      loaders: withLoadTimeout(withoutHostChromeLoaders(loaders), loadTimeoutMs),
    }))
  );
  validatedBlueprint = initial;
  player = handle;
  reported = new Set();
  playerState = handle.state;
  reportDiagnostics(handle);
  const unsubscribe = handle.subscribe((next) => {
    playerState = next;
    loadRevision += 1;
  });
  return () => {
    unsubscribe();
    handle.dispose();
  };
});

$effect(() => {
  const next = resolved.blueprint;
  const handle = untrack(() => player);
  if (!handle || next === validatedBlueprint) return;
  validatedBlueprint = next;
  reported = new Set();
  handle.update({ blueprint: next });
  reportDiagnostics(handle);
});

// A state change re-evaluates every `when` condition (G07).
$effect(() => {
  const inputs = conditionInputs;
  const handle = untrack(() => player);
  if (!handle || sameConditionInputs(inputs, appliedInputs)) return;
  appliedInputs = inputs;
  reported = new Set();
  handle.update({ conditionInputs: inputs });
  reportDiagnostics(handle);
});

// Painted content cannot pull focus out of reading order (positive tabindex).
$effect(() => {
  const element = surface;
  if (!element) return;
  normalizeTabOrder(element);
  if (typeof MutationObserver === 'undefined') return;
  const observer = new MutationObserver(() => normalizeTabOrder(element));
  observer.observe(element, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['tabindex'],
  });
  return () => observer.disconnect();
});

// A repaint that removes the focused node (a refused update, a failed node)
// would drop focus to the page; keep it in the player instead.
$effect(() => {
  void paintNodes;
  void shownStatus;
  void playerState?.surface;
  const element = root;
  if (!element || !lastFocused || lastFocused.isConnected) return;
  const focused = element.ownerDocument.activeElement;
  if (focused && focused !== element.ownerDocument.body && focused.isConnected) return;
  lastFocused = null;
  // Nearest surviving frame around the lost node first, then the notice, then the label.
  const frame = focusedFrames.find(
    (candidate) =>
      candidate.isConnected && element.contains(candidate) && !candidate.closest('[inert]')
  );
  focusedFrames = [];
  (frame ?? element.querySelector<HTMLElement>('.tx-player__notice') ?? labelElement)?.focus();
});

$effect(() => {
  const element = root;
  if (!element || typeof ResizeObserver === 'undefined') return;
  const observer = new ResizeObserver((entries) => {
    const entry = entries[entries.length - 1];
    if (!entry) return;
    const box = entry.borderBoxSize?.[0];
    onResize?.({
      blockSize: Math.ceil(box ? box.blockSize : entry.contentRect.height),
      inlineSize: Math.ceil(box ? box.inlineSize : entry.contentRect.width),
    });
  });
  observer.observe(element);
  return () => observer.disconnect();
});

// Deck host seam: when the host can present a layout-deck on a stage, hand
// the validated tree over and skip document paint for that root.
let deckHostActive = $derived(
  Boolean(
    deckHost &&
      playerState?.surface === 'tree' &&
      !stateRefused &&
      isLayoutDeckTree(playerState.validation.draft ?? playerState.validation.roots[0])
  )
);
$effect(() => {
  if (!deckHost || !deckHostActive || !playerState) return;
  const tree = (playerState.validation.draft ?? playerState.validation.roots[0]) as never;
  const cleanup = deckHost.present({
    tree,
    tier,
    label,
    active,
    root,
  });
  if (typeof cleanup === 'function') return cleanup;
});
</script>


{#snippet painted()}
  {#each paintNodes as node (node.path)}
    <PlayerNode {node} {onNodeError} />
  {/each}
{/snippet}

<section
  bind:this={root}
  class="tx-player"
  data-tx-player
  data-tx-player-chrome={chrome ? undefined : 'off'}
  data-tx-player-deck-host={deckHostActive ? 'pending' : undefined}
  data-status={shownStatus}
  data-density={density}
  data-tx-motion={reducedMotion ? 'reduce' : undefined}
  {dir}
  lang={rootLang}
  data-active={active}
  aria-label={label}
  onfocusin={onFocusIn}
>
  {#if chrome && playerState?.surface === 'tree' && !stateRefused}
    <a class="tx-player__skip" href={`#${skipTargetId}`} onclick={skipPast}>
      {resolvedLabels.skip} {label}
    </a>
  {/if}
  {#if chrome}
    <header class="tx-player__chrome">
      <h2 class="tx-player__label" tabindex="-1" bind:this={labelElement}>{label}</h2>
      <span class="tx-player__badges">
        {#if tier === 'untrusted'}
          <!-- Always visible at the untrusted tier; the host can reword it, not remove it. -->
          <span class="tx-player__trust" data-tx-player-trust={tier}>{resolvedLabels.trustBadge}</span>
        {/if}
        <span class="tx-player__badge" data-status={shownStatus}>
          {resolvedLabels.status[shownStatus]}
        </span>
      </span>
    </header>
  {/if}

  {#if stateRefused}
    <div class="tx-player__notice" role="alert" tabindex="-1" data-tx-player-state-notice>
      <h3>{resolvedLabels.invalidNotice}</h3>
      <ul>
        {#each stateIssues.slice(0, 3) as issue, index (`${issue.path}-${index}`)}
          <li>{issue.message}</li>
        {/each}
      </ul>
    </div>
  {:else if playerState?.surface === 'notice'}
    <div class="tx-player__notice" role="alert" tabindex="-1">
      <h3>{resolvedLabels.invalidNotice}</h3>
      {#if playerState.validation.diagnostics.length > 0}
        <ul>
          {#each playerState.validation.diagnostics.slice(0, 3) as diagnostic, index (`${diagnostic.path}-${index}`)}
            <li>{diagnostic.message}</li>
          {/each}
        </ul>
      {/if}
    </div>
  {:else if playerState}
    <!-- Keys bubble from painted content; the handler acts only on frame-level keys. -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="tx-player__surface"
      data-tx-player-surface
      bind:this={surface}
      inert={!active}
      data-selectable={selectable || undefined}
      onkeydown={onSurfaceKeydown}
      onclick={onSurfaceClick}
      onsubmit={onSurfaceSubmit}
    >
      {#if deckHostActive}
        <!-- Host seam: the slides stage (or a mock) owns the paint. -->
        <div class="tx-player__deck-host" data-tx-player-deck-host-surface role="presentation"></div>
      {:else if !hasReorder}
        {@render painted()}
      {:else if ReorderScope}
        <!-- One drag scope for every reorder container (lists of a group exchange items). -->
        <ReorderScope children={painted} />
      {/if}
    </div>
    {#if !playerState.validation.ok}
      <p class="tx-player__preview-warning">
        {resolvedLabels.previewWarning}
      </p>
    {/if}
  {/if}

  {#if composer}
    <footer class="tx-player__host-chrome" data-tx-player-host-chrome="composer">
      {@render composer()}
    </footer>
  {/if}
  <!-- The one polite live region (announcements model); present from mount so updates are spoken. -->
  <span class="tx-player__visually-hidden" aria-live="polite" aria-atomic="true" data-tx-player-announcer>
    {politeText}
  </span>
  {#if chrome && playerState?.surface === 'tree' && !stateRefused}
    <span class="tx-player__end" id={skipTargetId} tabindex="-1">
      <span class="tx-player__visually-hidden">{label}</span>
    </span>
  {/if}
</section>
