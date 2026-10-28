import { getContext, type Snippet, setContext } from 'svelte';
import type { ActionStatus } from './actions.ts';
import { DEFAULT_PLAYER_LABELS, type PlayerLabels } from './labels.ts';
import type { EventDetail } from './state/reducers.ts';
import type { ListItem, StateDeclaration, StateValue } from './state/schema.ts';

const LABELS = Symbol('tx-player-labels');
const STATE = Symbol('tx-player-state');
const REGIONS = Symbol('tx-player-host-regions');

const FLOW = Symbol('tx-player-flow');
const ACTIONS = Symbol('tx-player-actions');
const LANDMARKS = Symbol('tx-player-landmarks');

/** Share the resolved chrome labels with every node under one player. */
export function setPlayerLabels(get: () => PlayerLabels): void {
  setContext(LABELS, get);
}

/** The labels of the enclosing player, or the defaults outside one. */
export function getPlayerLabels(): () => PlayerLabels {
  return getContext<(() => PlayerLabels) | undefined>(LABELS) ?? (() => DEFAULT_PLAYER_LABELS);
}

/** What a state-only control may do: read and write declared local state, nothing else. */
export interface PlayerStateAccess {
  read(name: string): StateValue | undefined;
  /** Goes through the player's `setState`: coerced, validated, and reported to `onStateChange`. */
  write(name: string, value: unknown): boolean;
  declaration(name: string): StateDeclaration | undefined;
}

export function setPlayerStateAccess(access: PlayerStateAccess): void {
  setContext(STATE, access);
}

/** The enclosing player's state access, or `null` outside a player (controls then do nothing). */
export function getPlayerStateAccess(): PlayerStateAccess | null {
  return getContext<PlayerStateAccess | undefined>(STATE) ?? null;
}

/**
 * Host-owned regions (R21): the host's snippet for a region name, and a
 * claim so only the first `host-region` node with a name mounts it (a host
 * payment form must never mount twice).
 */
export interface PlayerHostRegions {
  /** The host's snippet for `name`, if it provides one. */
  get(name: string): Snippet | undefined;
  /** Claim `name` for `owner`; false when another node already holds it. */
  claim(name: string, owner: object): boolean;
  release(name: string, owner: object): void;
}

export function setPlayerHostRegions(regions: PlayerHostRegions): void {
  setContext(REGIONS, regions);
}

/** The enclosing player's host regions, or `null` outside a player (regions then show their label). */
export function getPlayerHostRegions(): PlayerHostRegions | null {
  return getContext<PlayerHostRegions | undefined>(REGIONS) ?? null;
}

/** What flow nodes may do: read the current view and fire declared events. */
export interface PlayerFlowAccess {
  /** The current view, or `null` without a declared flow. */
  view(): string | null;
  /** Whether `event` leads somewhere from the current view (guards included). */
  can(event: string): boolean;
  /** Fire `event`; `false` when no transition applies. */
  dispatch(event: string): boolean;
}

export function setPlayerFlowAccess(access: PlayerFlowAccess): void {
  setContext(FLOW, access);
}

/** The enclosing player's flow access, or `null` outside a player. */
export function getPlayerFlowAccess(): PlayerFlowAccess | null {
  return getContext<PlayerFlowAccess | undefined>(FLOW) ?? null;
}

/** What an action form may do: propose its action to the host and get the receipt. */
export interface PlayerActionAccess {
  propose(
    action: string,
    values: Readonly<Record<string, string | number | boolean>>
  ): Promise<Exclude<ActionStatus, 'pending'>>;
  /** Whether a host handler exists (without one, actions are unavailable). */
  available(): boolean;
}

export function setPlayerActionAccess(access: PlayerActionAccess): void {
  setContext(ACTIONS, access);
}

/** The enclosing player's action access, or `null` outside a player. */
export function getPlayerActionAccess(): PlayerActionAccess | null {
  return getContext<PlayerActionAccess | undefined>(ACTIONS) ?? null;
}

/** Whether layout painters may emit document landmarks; `false` for a player a host embeds inline inside its own landmark. */
export function setPlayerLandmarks(landmarks: () => boolean): void {
  setContext(LANDMARKS, landmarks);
}

/** Whether the enclosing player paints document landmarks (`main`); `true` outside one. */
export function getPlayerLandmarks(): () => boolean {
  return getContext<(() => boolean) | undefined>(LANDMARKS) ?? (() => true);
}

const INTERACTION = Symbol('tx-player-interaction');

/** A reorder container's bound list and its options (spec 0.3.0 `reorder`). */
export interface PlayerReorder {
  list: readonly ListItem[];
  axis: 'vertical' | 'horizontal' | 'grid';
  group?: string;
  /** Groups whose items this container takes, besides its own. */
  accepts: readonly string[];
  /** What leaving this container does to an item. */
  pull: 'move' | 'clone' | 'none';
  /** The bound list's declared `maxItems`. */
  maxItems?: number;
  disabled: boolean;
  locked: readonly string[];
}

/**
 * Spec 0.3.0 interaction for the player's own painters, keyed by node path:
 * run a node's `on` actions, write a bound prop back to its variable, and
 * move items between reorder containers. Everything goes through the closed
 * reducers; a painter never touches state directly.
 */
export interface PlayerInteraction {
  /** Run the node's actions for `event`; `false` when refused (nothing changed). */
  dispatch(
    path: string,
    event: string,
    detail?: EventDetail,
    form?: { submit(): void } | null
  ): boolean;
  /** Whether `prop` of the node is two-way bound. */
  bound(path: string, prop: string): boolean;
  /** Write a bound prop back to its variable; `false` when it is not bound or does not fit. */
  write(path: string, prop: string, value: unknown): boolean;
  /** The node's reorder list and options, or `null` when it has none. */
  reorder(path: string): PlayerReorder | null;
  /** Whether `move` would accept this move (the same rules, nothing changes). */
  canMove(fromPath: string, item: string, toPath: string, index: number): boolean;
  /** Move an item from one reorder container to another (or within one), then run `on.move`. */
  move(fromPath: string, item: string, toPath: string, index: number): boolean;
}

const REORDER_SCOPE = Symbol('tx-player-reorder-scope');

/** One reorder container as the shared drag scope sees it. */
export interface ReorderScopeContainer {
  /** The node path of the container (its `txPath`). */
  path: string;
  label: string;
  info: PlayerReorder;
}

/**
 * The player's shared drag scope: every `sortable-list` under one player
 * registers its container here, so one drag session spans them and a drag
 * between lists of one group runs the same `interaction.move` as the
 * keyboard. Item keys are namespaced per container (`path/id`), so equal
 * item ids in two lists never collide.
 */
export interface ReorderScope {
  /** Register a container (read reactively; `null` while it has no list); returns the unregister function. */
  register(container: () => ReorderScopeContainer | null): () => void;
  /** The primitive's list id for a container path. */
  listId(path: string): string;
  /** The primitive's item key for an item of a container. */
  itemKey(path: string, item: string): string;
}

export function setReorderScope(scope: ReorderScope): void {
  setContext(REORDER_SCOPE, scope);
}

/** The enclosing player's drag scope, or `null` when none is mounted. */
export function getReorderScope(): ReorderScope | null {
  return getContext<ReorderScope | undefined>(REORDER_SCOPE) ?? null;
}

export function setPlayerInteraction(access: PlayerInteraction): void {
  setContext(INTERACTION, access);
}

/** The enclosing player's interaction access, or `null` outside a player. */
export function getPlayerInteraction(): PlayerInteraction | null {
  return getContext<PlayerInteraction | undefined>(INTERACTION) ?? null;
}
