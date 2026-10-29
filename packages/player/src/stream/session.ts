import {
  checkStreamTotals,
  type DraftDiagnostic,
  streamNodeChain,
  type ValidateDraftOptions,
  validateStreamChain,
} from '@texuli/catalog/validate';
import {
  type BlueprintStreamEvent,
  createBlueprintAssembler,
  type StreamError,
} from '@texuli/spec/stream';
import { type StatefulSplit, splitStatefulBlueprint } from '../state/bind.ts';
import { playerResolveOptions, resolveSplitBlueprint } from '../state/resolve.ts';
import { initialSnapshot, type StateSnapshot } from '../state/schema.ts';
import {
  type BlueprintStreamSource,
  type PlayerStreamProgress,
  STREAM_PAINT_INTERVAL_MS,
  STREAM_PENDING_ID,
  type StreamNodeState,
} from './marker.ts';

export { STREAM_PENDING_ID, type StreamNodeState } from './marker.ts';

/**
 * The player's streaming session (ADR-014), framework-free: it reads a
 * blueprint stream through `@texuli/spec/stream`, admits each node whose
 * shell is final and passes every node-level rule (the catalog's
 * `validateStreamChain` on the node's chain, after the player's own state
 * pipeline, plus the player's state rules on the partial tree), and builds
 * the partial blueprint the player previews: admitted nodes, and a pending
 * marker where a node is still arriving or is held. The complete value is
 * handed over as is; the player judges it with the full `validateDraft`.
 */

/** Root members that hold a tree: the envelope's `tree` and the local-state wrapper's `blueprint`. */
export const STREAM_TREE_MEMBERS: readonly string[] = Object.freeze(['tree', 'blueprint']);

export type StreamPhase = 'streaming' | 'complete' | 'interrupted';

export interface StreamPendingNode {
  /** The node's catalog id once it arrived (for a skeleton of its family). */
  id: string | null;
  state: StreamNodeState;
}

/** A node the checks refused, or a member out of the canonical order. */
export interface StreamNodeIssue {
  path: string;
  code: string;
  message: string;
}

export interface StreamSnapshot {
  phase: StreamPhase;
  /**
   * What to paint: while streaming (and after an interruption), the
   * partial blueprint of admitted nodes and pending markers; once complete,
   * the whole value, for the final `validateDraft`.
   */
  blueprint: unknown;
  /** Marker paths in `blueprint` and what they stand for. */
  pending: ReadonlyMap<string, StreamPendingNode>;
  /** Nodes painted now (admitted, with every ancestor admitted). */
  painted: number;
  /** Nodes held by a check or the canonical order. */
  held: number;
  bytes: number;
  error: StreamError | null;
  issues: readonly StreamNodeIssue[];
  /** Changes on every snapshot that changed what is painted. */
  revision: number;
}

export interface StreamSessionOptions {
  /** Exactly the options the player validates with (catalog, tier, checkBlock, conditions, roles…). */
  validate: ValidateDraftOptions;
  /** Bindable props by catalog id, as the player resolves `bind`. */
  bindable: (id: string) => readonly string[] | undefined;
  dataSources?: Readonly<Record<string, unknown>>;
  /** Byte budget of the stream. Default the validator's text cap. */
  maxBytes?: number;
  maxDepth?: number;
}

export interface StreamSession {
  write(chunk: string): void;
  end(): void;
  /** Stop: `aborted` by the host, or `connection` when the source failed. */
  abort(code?: 'aborted' | 'connection', message?: string): void;
  snapshot(): StreamSnapshot;
  readonly phase: StreamPhase;
}

interface NodeRecord {
  path: string;
  parent: NodeRecord | null;
  index: number;
  inArray: boolean;
  id: string | null;
  shell: Record<string, unknown> | null;
  status: 'pending' | 'ready' | 'held';
  /** A member arrived after `children`: held until the final verdict. */
  ordered: boolean;
  hasChildren: boolean;
  children: NodeRecord[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const NO_STATE: StateSnapshot = Object.freeze({});

export function createStreamSession(options: StreamSessionOptions): StreamSession {
  const limits = options.validate.limits;
  const assembler = createBlueprintAssembler({
    treeMembers: STREAM_TREE_MEMBERS,
    maxBytes:
      options.maxBytes ??
      options.validate.maxTextBytes ??
      (limits?.maxBytes ?? 256 * 1024) + 8 * 1024,
    ...(options.maxDepth ? { maxDepth: options.maxDepth } : {}),
  });
  const records = new Map<string, NodeRecord>();
  const roots: NodeRecord[] = [];
  let header: Record<string, unknown> | null = null;
  let treeMember = 'tree';
  let phase: StreamPhase = 'streaming';
  let finalValue: unknown;
  let error: StreamError | null = null;
  let admitted = 0;
  let revision = 0;
  const issues: StreamNodeIssue[] = [];

  const chainOf = (record: NodeRecord): Record<string, unknown>[] => {
    const shells: Record<string, unknown>[] = [];
    for (let node = record.parent; node; node = node.parent) {
      shells.unshift(node.shell as Record<string, unknown>);
    }
    return shells;
  };

  const markerFor = (record: NodeRecord): Record<string, unknown> => {
    const slot = record.shell?.slot;
    return typeof slot === 'string' ? { id: STREAM_PENDING_ID, slot } : { id: STREAM_PENDING_ID };
  };

  const treeIsArray = () => roots[0]?.inArray === true;

  /** The partial tree: admitted nodes, a marker for every other node (its subtree hidden). */
  function partial(
    extra: NodeRecord | null,
    pending: Map<string, StreamPendingNode> | null,
    interrupted: boolean
  ): unknown {
    const build = (record: NodeRecord): Record<string, unknown> => {
      const ready = record.status === 'ready' || record === extra;
      if (!ready) {
        pending?.set(record.path, {
          id: record.id,
          state: record.status === 'held' ? 'held' : interrupted ? 'incomplete' : 'pending',
        });
        return markerFor(record);
      }
      const node: Record<string, unknown> = { ...(record.shell as Record<string, unknown>) };
      if (record.hasChildren) node.children = record.children.map(build);
      return node;
    };
    let tree: unknown;
    if (roots.length === 0) {
      pending?.set('0', { id: null, state: interrupted ? 'incomplete' : 'pending' });
      tree = { id: STREAM_PENDING_ID };
    } else tree = treeIsArray() ? roots.map(build) : build(roots[0] as NodeRecord);
    // The header joins once a node was checked under it (or is being checked).
    return header !== null && (admitted > 0 || extra !== null)
      ? { ...header, [treeMember]: tree }
      : tree;
  }

  function issue(path: string, code: string, message: string): void {
    // One entry per node and code: a re-check does not repeat it.
    if (issues.some((i) => i.path === path && i.code === code)) return;
    issues.push({ path, code, message });
  }

  /** The player's state pipeline on a draft: its issues, and the blueprint the core validates. */
  function resolveDraft(draft: unknown): {
    blueprint: unknown;
    issues: readonly { message: string }[];
  } {
    const split: StatefulSplit = splitStatefulBlueprint(draft);
    const values = split.kind === 'stateful' ? initialSnapshot(split.declarations) : NO_STATE;
    const resolved = resolveSplitBlueprint(
      split,
      values,
      playerResolveOptions(split, options.bindable, options.dataSources)
    );
    return { blueprint: resolved.blueprint, issues: resolved.issues };
  }

  /** Every node-level rule, for one node whose shell is final. */
  function check(record: NodeRecord): boolean {
    if (record.ordered) return false;
    if (record.parent && record.parent.status !== 'ready') return false;
    if (!isRecord(record.shell)) {
      issue(record.path, 'not-a-node', 'A streamed node must be an object.');
      return false;
    }
    const ancestors = chainOf(record);
    const totals = checkStreamTotals(
      { index: record.index, root: record.parent === null && record.inArray, admitted, ancestors },
      limits
    );
    if (totals) {
      issue(record.path, totals.code, totals.message);
      return false;
    }
    const chain = streamNodeChain({
      header,
      treeMember,
      ancestors,
      shell: record.shell,
      index: record.index,
      admitted,
    });
    const resolved = resolveDraft(chain);
    if (resolved.issues.length > 0) {
      issue(record.path, 'state', resolved.issues[0]?.message ?? 'A state rule refused the node.');
      return false;
    }
    const verdict = validateStreamChain(resolved.blueprint, options.validate);
    if (!verdict.ok) {
      const first: DraftDiagnostic | undefined = verdict.diagnostics[0];
      issue(record.path, first?.code ?? 'invalid', first?.message ?? 'The node did not validate.');
      return false;
    }
    // Spec 0.7.0: a key is unique in the tree, so a key already painted refuses this node.
    const key = record.shell.key;
    if (typeof key === 'string') {
      for (const other of records.values()) {
        if (other !== record && other.status === 'ready' && other.shell?.key === key) {
          issue(record.path, 'duplicate-key', `The key "${key}" is already used in this tree.`);
          return false;
        }
      }
    }
    // Rules between siblings (one field name per form, …): the partial tree with this node.
    const siblings = resolveDraft(partial(record, null, false));
    if (siblings.issues.length > 0) {
      issue(record.path, 'state', siblings.issues[0]?.message ?? 'A state rule refused the node.');
      return false;
    }
    return true;
  }

  function admit(record: NodeRecord): void {
    const ok = check(record);
    const before = record.status;
    record.status = ok ? 'ready' : 'held';
    if (ok && before !== 'ready') admitted += 1;
    if (!ok && before === 'ready') admitted -= 1;
    if (before !== record.status) revision += 1;
  }

  /** The header changed (a late member): check every node again, in document order. */
  function recheckAll(): void {
    const visit = (record: NodeRecord) => {
      if (record.shell !== null) admit(record);
      for (const child of record.children) visit(child);
    };
    for (const root of roots) visit(root);
  }

  function apply(events: readonly BlueprintStreamEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case 'header':
          header = { ...event.header };
          treeMember =
            typeof header.format === 'string' && header.format === 'texuli-local-state'
              ? 'blueprint'
              : 'tree';
          if (records.size > 0) recheckAll();
          break;
        case 'node-start': {
          const parent = event.parent === null ? null : (records.get(event.parent) ?? null);
          const record: NodeRecord = {
            path: event.path,
            parent,
            index: event.index,
            inArray: event.inArray,
            id: null,
            shell: null,
            status: 'pending',
            ordered: false,
            hasChildren: false,
            children: [],
          };
          records.set(event.path, record);
          if (parent) parent.children.push(record);
          else roots.push(record);
          revision += 1;
          break;
        }
        case 'node-id': {
          const record = records.get(event.path);
          if (record && typeof event.id === 'string') record.id = event.id;
          break;
        }
        case 'node': {
          const record = records.get(event.path);
          if (!record) break;
          record.shell = { ...event.shell };
          record.hasChildren = event.hasChildren;
          if (typeof event.shell.id === 'string') record.id = event.shell.id;
          admit(record);
          break;
        }
        case 'stream-order': {
          issue(
            event.path,
            'stream-order',
            `"${event.key}" arrived after ${event.path === '$' ? 'the tree' : '"children"'}.`
          );
          const record = records.get(event.path);
          if (record) {
            record.ordered = true;
            admit(record);
          }
          break;
        }
        case 'complete':
          phase = 'complete';
          finalValue = event.value;
          revision += 1;
          break;
        case 'error':
          phase = 'interrupted';
          error = event.error;
          revision += 1;
          break;
        default:
          break;
      }
    }
  }

  function visible(): { painted: number; held: number } {
    let painted = 0;
    let held = 0;
    const visit = (record: NodeRecord) => {
      if (record.status === 'held') held += 1;
      if (record.status !== 'ready') return;
      painted += 1;
      for (const child of record.children) visit(child);
    };
    for (const root of roots) visit(root);
    return { painted, held };
  }

  return {
    write(chunk) {
      if (phase !== 'streaming') return;
      apply(assembler.write(chunk));
    },
    end() {
      if (phase !== 'streaming') return;
      apply(assembler.end());
    },
    abort(code = 'aborted', message) {
      if (phase !== 'streaming') return;
      apply(assembler.abort(code, message));
    },
    snapshot() {
      const pending = new Map<string, StreamPendingNode>();
      const counts = visible();
      const blueprint =
        phase === 'complete' ? finalValue : partial(null, pending, phase === 'interrupted');
      return Object.freeze({
        phase,
        blueprint,
        pending,
        painted: counts.painted,
        held: counts.held,
        bytes: assembler.bytes,
        error,
        issues: Object.freeze([...issues]),
        revision,
      });
    },
    get phase() {
      return phase;
    },
  };
}

/**
 * Read `source` into `session`, calling `onChange` after every chunk and
 * once the stream ends or fails. Bytes are decoded as UTF-8 across chunk
 * boundaries. A source that throws stops the session as `aborted` (an
 * `AbortError`, as `createBlueprintStream().abort()` throws) or
 * `connection`. Returns a function that stops reading.
 */
export function pumpStream(
  source: BlueprintStreamSource,
  session: StreamSession,
  onChange: () => void
): () => void {
  let cancelled = false;
  let iterator: AsyncIterator<string | Uint8Array> | null = null;
  const decoder = new TextDecoder();
  const release = () => {
    const current = iterator;
    iterator = null;
    void Promise.resolve(current?.return?.()).catch(() => undefined);
  };
  void (async () => {
    try {
      iterator = source[Symbol.asyncIterator]();
      while (!cancelled && session.phase === 'streaming') {
        const step = await (iterator as AsyncIterator<string | Uint8Array>).next();
        if (cancelled) return;
        if (step.done) {
          iterator = null;
          const tail = decoder.decode();
          if (tail !== '') session.write(tail);
          session.end();
          onChange();
          return;
        }
        const value = step.value;
        session.write(
          typeof value === 'string'
            ? value
            : value instanceof Uint8Array
              ? decoder.decode(value, { stream: true })
              : ''
        );
        onChange();
      }
      // The session stopped on its own (a refused byte): stop the source too.
      if (!cancelled) release();
    } catch (cause) {
      if (cancelled) return;
      iterator = null;
      const aborted = cause instanceof Error && cause.name === 'AbortError';
      session.abort(
        aborted ? 'aborted' : 'connection',
        aborted && cause.message !== '' ? cause.message : undefined
      );
      onChange();
    }
  })();
  return () => {
    cancelled = true;
    release();
  };
}

export interface StreamPaintOptions extends StreamSessionOptions {
  /** What the player shows now: a retry keeps it until the new stream paints a node. */
  previous: StreamSnapshot | null;
  /** Called with each snapshot to paint, and the progress to report. */
  onSnapshot: (snapshot: StreamSnapshot, progress: PlayerStreamProgress) => void;
}

/**
 * Read `source` for `<Player stream>`: snapshots are handed over at most
 * every {@link STREAM_PAINT_INTERVAL_MS}, and at once when the stream
 * completes or stops. A retry (a `previous` paint with nodes) keeps that
 * paint, marked as streaming again, until the new stream paints a node.
 * Returns a function that stops reading.
 */
export function startStreamPaint(
  source: BlueprintStreamSource,
  options: StreamPaintOptions
): () => void {
  const session = createStreamSession(options);
  const { previous, onSnapshot } = options;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let keepPrevious = previous !== null && previous.painted > 0;
  let lastRevision = -1;
  const hand = (snapshot: StreamSnapshot) =>
    onSnapshot(snapshot, {
      phase: snapshot.phase,
      painted: snapshot.painted,
      held: snapshot.held,
      bytes: snapshot.bytes,
      error: snapshot.error,
    });
  if (previous && keepPrevious) {
    const pending = new Map<string, StreamPendingNode>();
    for (const [path, node] of previous.pending) {
      pending.set(path, node.state === 'incomplete' ? { ...node, state: 'pending' } : node);
    }
    hand(Object.freeze({ ...previous, phase: 'streaming', error: null, pending }));
  }
  const publish = () => {
    timer = null;
    if (stopped) return;
    const next = session.snapshot();
    if (keepPrevious && next.phase === 'streaming' && next.painted === 0) return;
    keepPrevious = false;
    if (next.revision === lastRevision) return;
    lastRevision = next.revision;
    hand(next);
  };
  if (!keepPrevious) publish();
  const stop = pumpStream(source, session, () => {
    if (session.phase !== 'streaming') {
      if (timer !== null) clearTimeout(timer);
      publish();
    } else if (timer === null) {
      timer = setTimeout(publish, STREAM_PAINT_INTERVAL_MS);
    }
  });
  return () => {
    stopped = true;
    stop();
    if (timer !== null) clearTimeout(timer);
  };
}
