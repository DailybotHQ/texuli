import { getContext, type Snippet, setContext } from 'svelte';
import type { ActionStatus } from './actions.ts';
import { DEFAULT_PLAYER_LABELS, type PlayerLabels } from './labels.ts';
import type { StateDeclaration, StateValue } from './state/schema.ts';

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
