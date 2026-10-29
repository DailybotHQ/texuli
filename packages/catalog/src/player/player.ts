import type { BlueprintNodeMotion } from '@texuli/spec/motion';
import { blueprintDigest } from '../edit/digest.ts';
import { resolveTier } from '../render/renderer/tier.ts';
import type { RenderCatalog, RenderNode, RenderTier } from '../render/renderer/types.ts';
import {
  type DraftValidation,
  type ValidateDraftOptions,
  validateDraft,
} from '../validate/draft.ts';
import { checkIntent, MAX_PENDING_INTENTS_PER_NODE, type PlayerIntent } from './intents.ts';
import { type PaintUrlIssue, paintProps } from './paint-props.ts';

/** Host-owned status. `invalid` is the player's own verdict on a failed draft. */
export type PlayerStatus = 'invalid' | 'draft' | 'active' | 'superseded';
/** Why the player shows a notice instead of the tree (player design §7). */
export type PlayerErrorCode = 'parse' | 'over-limits' | 'catalog-mismatch' | 'invalid';
/** Loads one component, lazily. Its value is opaque to the core. */
export type PlayerLoader = () => Promise<unknown>;

export interface PlayerOptions
  extends Pick<
    ValidateDraftOptions,
    | 'checkBlock'
    | 'checkDocument'
    | 'checkCanvas'
    | 'checkForm'
    | 'formValidators'
    | 'limits'
    | 'frameRoots'
    | 'roles'
    | 'conditions'
    | 'conditionInputs'
  > {
  /** A tree or an envelope, as text or data. Always re-validated. */
  blueprint: unknown;
  catalog: RenderCatalog;
  /** The catalog build hash the host pinned; envelopes for another catalog fail. */
  catalogHash?: string;
  /** Chosen by the host, never by the blueprint. Default `untrusted`. */
  tier?: RenderTier;
  /** Host-owned lifecycle status, never read from the blueprint. Default `draft`. */
  status?: Exclude<PlayerStatus, 'invalid'>;
  /** `refuse` (default) paints a notice for an invalid draft; `preview` paints it with placeholders. */
  invalidPolicy?: 'refuse' | 'preview';
  /** Catalog id → lazy component loader. */
  loaders?: Readonly<Record<string, PlayerLoader>>;
}

/** One node of the paint plan: a component to mount, or a visible placeholder. */
export type PaintNode =
  | {
      kind: 'component';
      path: string;
      id: string;
      /** Props after the paint-time URL policy. */
      props: Readonly<Record<string, unknown>>;
      children: readonly PaintNode[];
      /** The parent's named slot, when not the default one (audit G04). */
      slot?: string;
      /** The node's checked motion (spec 0.6.0); the host decides whether it plays. */
      motion?: Readonly<BlueprintNodeMotion>;
    }
  | {
      kind: 'placeholder';
      path: string;
      id: string;
      label: string;
      reason: 'unknown-id' | 'tier-denied' | 'no-loader' | 'node-error';
      /** The parent's named slot, when not the default one (audit G04). */
      slot?: string;
    };

export interface PlayerState {
  status: PlayerStatus;
  /** `notice` when an invalid draft is refused: paint the diagnostics, never the tree. */
  surface: 'tree' | 'notice';
  error?: PlayerErrorCode;
  plan: readonly PaintNode[];
  validation: DraftValidation;
  /** URLs the paint-time policy removed. */
  paintIssues: readonly PaintUrlIssue[];
}

/** What was validated, against which catalog: the host shows and stores this. */
export interface ValidationReceipt {
  catalogHash: string | null;
  envelopeId: string | null;
  tier: RenderTier;
  ok: boolean;
  validationStatus: DraftValidation['status'];
  checks: DraftValidation['checks'];
  errors: number;
  warnings: number;
}

/**
 * How a host turns the plan into output (DOM nodes, Svelte mounts, strings).
 * `slot` names the parent's named slot a node fills (audit G04); a host
 * routes it to that snippet, and its absence means the default slot.
 * `motion` is the node's checked spec 0.6.0 motion, which a host may play.
 */
export interface PaintAdapter<T> {
  component(
    node: {
      id: string;
      path: string;
      props: Readonly<Record<string, unknown>>;
      slot?: string;
      motion?: Readonly<BlueprintNodeMotion>;
    },
    component: unknown,
    children: readonly T[]
  ): T;
  placeholder(node: { id: string; path: string; label: string; reason: string; slot?: string }): T;
  /** Shown by `paintNow` while a node's component is still loading. */
  skeleton(node: { id: string; path: string; slot?: string }): T;
}

export type ProposeResult = { ok: true; intent: PlayerIntent } | { ok: false; reason: string };

/**
 * The player's handle. There is deliberately no activate method: activation
 * is the host's own control, which compares `digest()` with what the owner
 * reviewed.
 */
export interface PlayerHandle {
  readonly state: PlayerState;
  /**
   * New `conditionInputs` re-evaluate every `when`, as a new blueprint would.
   * A new `invalidPolicy` applies to the same handle, so loaded components are
   * kept (a streamed draft is previewed, then judged with the host's policy).
   */
  update(
    next: Partial<
      Pick<
        PlayerOptions,
        'blueprint' | 'status' | 'catalogHash' | 'conditionInputs' | 'invalidPolicy'
      >
    >
  ): void;
  receipt(): ValidationReceipt;
  /** SHA-256 of the validated tree's canonical JSON, or `null` for an invalid draft. */
  digest(): Promise<string | null>;
  /** Paint with every component loaded. A node that fails becomes a placeholder. */
  paint<T>(adapter: PaintAdapter<T>): Promise<T[]>;
  /** Paint now: loaded nodes mount, the rest show skeletons; `subscribe` fires as loads settle. */
  paintNow<T>(adapter: PaintAdapter<T>): T[];
  /** A node proposes an intent from the closed set; the host confirms or rejects it. */
  propose(path: string, intent: unknown): ProposeResult;
  confirm(intentId: string): boolean;
  reject(intentId: string): boolean;
  intents(): readonly PlayerIntent[];
  subscribe(listener: (state: PlayerState) => void): () => void;
  dispose(): void;
}

type Loaded =
  | { status: 'loading'; promise: Promise<unknown> }
  | { status: 'ready'; value: unknown }
  | { status: 'error' };

/**
 * The framework-free document player core (player design §3–6): validates
 * the blueprint with `validateDraft`, builds a paint plan with the URL
 * policy applied again at paint, loads components lazily per id, and turns
 * any node that fails to load or mount into a visible placeholder so a bad
 * subtree never takes the page down. Edge-safe: no DOM, no Node APIs.
 */
/** The `slot` field of a render node, copied only when it names one. */
function slotOf(node: RenderNode): { slot?: string } {
  return node.slot === undefined ? {} : { slot: node.slot };
}

export function createPlayer(options: PlayerOptions): PlayerHandle {
  const tier = resolveTier(options.tier);
  const loaders = options.loaders;
  const loaded = new Map<string, Loaded>();
  const listeners = new Set<(state: PlayerState) => void>();
  let config = {
    blueprint: options.blueprint,
    status: options.status ?? 'draft',
    catalogHash: options.catalogHash,
    conditionInputs: options.conditionInputs,
    invalidPolicy: options.invalidPolicy,
  };
  let intents: PlayerIntent[] = [];
  let sequence = 0;
  let disposed = false;
  let state = compute();

  function compute(): PlayerState {
    const validation = validateDraft(config.blueprint, {
      catalog: options.catalog,
      tier,
      catalogHash: config.catalogHash,
      checkBlock: options.checkBlock,
      checkDocument: options.checkDocument,
      checkCanvas: options.checkCanvas,
      checkForm: options.checkForm,
      formValidators: options.formValidators,
      limits: options.limits,
      frameRoots: options.frameRoots,
      roles: options.roles,
      conditions: options.conditions,
      conditionInputs: config.conditionInputs,
    });
    const paintIssues: PaintUrlIssue[] = [];
    const error: PlayerErrorCode | undefined = validation.ok
      ? undefined
      : validation.status === 'parse' || validation.status === 'over-limits'
        ? validation.status
        : validation.diagnostics.some((d) => d.code === 'catalog-mismatch')
          ? 'catalog-mismatch'
          : 'invalid';
    const refuse = !validation.ok && (config.invalidPolicy ?? 'refuse') === 'refuse';
    return {
      status: validation.ok ? config.status : 'invalid',
      surface: refuse ? 'notice' : 'tree',
      ...(error ? { error } : {}),
      plan: refuse
        ? []
        : validation.roots.map((node, index) => plan(node, String(index), paintIssues)),
      validation,
      paintIssues,
    };
  }

  function plan(node: RenderNode, path: string, issues: PaintUrlIssue[]): PaintNode {
    if (node.kind === 'placeholder') {
      return {
        kind: 'placeholder',
        path,
        id: node.id,
        label: node.label,
        reason: node.reason,
        ...slotOf(node),
      };
    }
    if (loaders && !Object.hasOwn(loaders, node.id)) {
      return {
        kind: 'placeholder',
        path,
        id: node.id,
        label: `No painter for “${node.id}”`,
        reason: 'no-loader',
        ...slotOf(node),
      };
    }
    return {
      kind: 'component',
      path,
      id: node.id,
      props: paintProps(node.props, issues, `${path}.props`),
      children: node.children.map((child, index) =>
        plan(child, `${path}.children.${index}`, issues)
      ),
      ...slotOf(node),
      ...(node.motion ? { motion: node.motion } : {}),
    };
  }

  function load(id: string): Promise<unknown> {
    const loader = loaders?.[id];
    const current = loaded.get(id);
    if (current?.status === 'ready') return Promise.resolve(current.value);
    // Concurrent nodes with the same id share one in-flight load.
    if (current?.status === 'loading') return current.promise;
    if (!loader || current?.status === 'error') return Promise.reject(new Error(id));
    const promise = loader().then(
      (value) => {
        loaded.set(id, { status: 'ready', value });
        return value;
      },
      (cause: unknown) => {
        loaded.set(id, { status: 'error' });
        throw cause;
      }
    );
    loaded.set(id, { status: 'loading', promise });
    return promise;
  }

  const failed = (node: { id: string; path: string }) => ({
    id: node.id,
    path: node.path,
    label: `“${node.id}” could not be shown`,
    reason: 'node-error',
  });

  async function paintNode<T>(node: PaintNode, adapter: PaintAdapter<T>): Promise<T> {
    if (node.kind === 'placeholder') return adapter.placeholder(node);
    try {
      const component = await load(node.id);
      const children = await Promise.all(node.children.map((child) => paintNode(child, adapter)));
      return adapter.component(node, component, children);
    } catch {
      return adapter.placeholder(failed(node));
    }
  }

  function paintNodeNow<T>(node: PaintNode, adapter: PaintAdapter<T>): T {
    if (node.kind === 'placeholder') return adapter.placeholder(node);
    const current = loaded.get(node.id);
    if (current?.status === 'error') return adapter.placeholder(failed(node));
    if (current?.status !== 'ready') {
      if (current === undefined) {
        load(node.id).then(notify, notify);
      }
      return adapter.skeleton(node);
    }
    try {
      const children = node.children.map((child) => paintNodeNow(child, adapter));
      return adapter.component(node, current.value, children);
    } catch {
      return adapter.placeholder(failed(node));
    }
  }

  function findComponent(nodes: readonly PaintNode[], path: string): PaintNode | undefined {
    for (const node of nodes) {
      if (node.path === path) return node;
      if (node.kind === 'component' && path.startsWith(`${node.path}.`)) {
        return findComponent(node.children, path);
      }
    }
    return undefined;
  }

  function notify(): void {
    if (disposed) return;
    for (const listener of listeners) listener(state);
  }

  function settle(intentId: string, status: 'confirmed' | 'rejected'): boolean {
    const intent = intents.find((item) => item.id === intentId);
    if (intent?.status !== 'pending' || disposed) return false;
    intents = intents.map((item) => (item === intent ? { ...item, status } : item));
    return true;
  }

  return {
    get state() {
      return state;
    },
    update(next) {
      if (disposed) return;
      config = { ...config, ...next };
      state = compute();
      // Intents belong to the tree they were proposed on.
      intents = [];
      notify();
    },
    receipt() {
      const { validation } = state;
      return {
        catalogHash: config.catalogHash ?? validation.envelope?.catalog ?? null,
        envelopeId: validation.envelope?.id ?? null,
        tier,
        ok: validation.ok,
        validationStatus: validation.status,
        checks: validation.checks,
        errors: validation.diagnostics.filter((d) => d.severity === 'error').length,
        warnings: validation.diagnostics.filter((d) => d.severity === 'warning').length,
      };
    },
    async digest() {
      const { validation } = state;
      if (!validation.ok || validation.draft === null || Array.isArray(validation.draft)) {
        return null;
      }
      return blueprintDigest(validation.draft as Parameters<typeof blueprintDigest>[0]);
    },
    paint(adapter) {
      if (disposed) return Promise.resolve([]);
      return Promise.all(state.plan.map((node) => paintNode(node, adapter)));
    },
    paintNow(adapter) {
      if (disposed) return [];
      return state.plan.map((node) => paintNodeNow(node, adapter));
    },
    propose(path, value) {
      if (disposed) return { ok: false, reason: 'The player was disposed.' };
      if (state.status === 'invalid') {
        return { ok: false, reason: 'An invalid draft proposes nothing.' };
      }
      const node = findComponent(state.plan, path);
      if (node?.kind !== 'component') {
        return { ok: false, reason: `No painted component at "${path}".` };
      }
      const checked = checkIntent(value);
      if (!checked.ok) return checked;
      const pending = intents.filter((i) => i.path === path && i.status === 'pending').length;
      if (pending >= MAX_PENDING_INTENTS_PER_NODE) {
        return {
          ok: false,
          reason: `A node may have at most ${MAX_PENDING_INTENTS_PER_NODE} pending intents.`,
        };
      }
      sequence += 1;
      const intent: PlayerIntent = {
        id: `intent-${sequence}`,
        path,
        componentId: node.id,
        payload: checked.payload,
        status: 'pending',
      };
      intents = [...intents, intent];
      return { ok: true, intent };
    },
    confirm: (id) => settle(id, 'confirmed'),
    reject: (id) => settle(id, 'rejected'),
    intents: () => intents,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose() {
      disposed = true;
      listeners.clear();
      intents = [];
    },
  };
}
