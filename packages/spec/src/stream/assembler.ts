import {
  createJsonTokenizer,
  type JsonScalar,
  type JsonStreamEvent,
  type JsonTokenizerOptions,
  type StreamError,
} from './tokenizer.ts';

/**
 * The partial-blueprint assembler (ADR-014): builds the value the tokenizer
 * reads and reports, for every catalog node, when its **shell** is final.
 * Streamed nodes put `children` last (`key`, `id`, `slot`, `props`, `when`,
 * `bind`, `on`, `children`), so a node's shell (every member but `children`)
 * is final once `children` starts, or once the node closes without it.
 * Envelopes put `state` and `flow` before the tree, so the envelope header
 * is final once `tree` starts. A member after `children` (or after `tree`)
 * is a `stream-order` issue: the node it lands in is held until the final
 * verdict. The assembler judges no rule itself; the catalog checks each
 * shell and `validateDraft` judges the whole value.
 */

/** Members a streamed node may have, in the canonical order (`children` last). */
export const STREAM_NODE_ORDER: readonly string[] = Object.freeze([
  'key',
  'id',
  'slot',
  'props',
  'when',
  'bind',
  'on',
  'motion',
  'children',
]);

/** A node's members except `children`. Values are the assembled ones (not copies). */
export type StreamNodeShell = Readonly<Record<string, unknown>>;

export type BlueprintStreamEvent =
  /** An envelope's members before its tree (`final` once the tree starts; again for a late member). */
  | { type: 'header'; header: Readonly<Record<string, unknown>>; offset: number }
  /** A node object opened. Its shell is not final yet. */
  | {
      type: 'node-start';
      path: string;
      parent: string | null;
      index: number;
      /** `true` for an element of an array (children, or an array of roots). */
      inArray: boolean;
      offset: number;
    }
  /** A node's `id` member closed (for a skeleton of the right family). */
  | { type: 'node-id'; path: string; id: unknown; offset: number }
  /** A node's shell is final: every member but `children` arrived. */
  | {
      type: 'node';
      path: string;
      /** The node's stable stream id: its `key` when it has a string one, else its path. */
      streamId: string;
      parent: string | null;
      index: number;
      shell: StreamNodeShell;
      /** `children` started (more nodes follow under this one). */
      hasChildren: boolean;
      /** `true` for an element of an array (children, or an array of roots). */
      inArray: boolean;
      offset: number;
    }
  /** A node object closed: all its children arrived. */
  | { type: 'node-end'; path: string; offset: number }
  /** A member after `children` (node) or after the tree (envelope, path `$`). */
  | { type: 'stream-order'; path: string; key: string; offset: number }
  /** The whole value arrived and the stream ended cleanly. */
  | { type: 'complete'; value: unknown; offset: number }
  /** The stream stopped: nothing more is reported. */
  | { type: 'error'; error: StreamError };

export interface BlueprintAssemblerOptions extends JsonTokenizerOptions {
  /**
   * Root members that hold the tree. Default `['tree']` (the blueprint
   * envelope). A host that also streams another wrapper (the player's
   * local-state wrapper uses `blueprint`) adds its member here.
   */
  treeMembers?: readonly string[];
}

export interface BlueprintAssembler {
  /** Feed a chunk; returns what it completed. */
  write(chunk: string): BlueprintStreamEvent[];
  /** No more input. Returns `complete` or the `truncated` error. */
  end(): BlueprintStreamEvent[];
  /** Stop with an `aborted` or `connection` error (a dropped stream). */
  abort(code?: 'aborted' | 'connection', message?: string): BlueprintStreamEvent[];
  readonly bytes: number;
  readonly error: StreamError | null;
  /** The value assembled so far (containers still open are partial). */
  readonly value: unknown;
}

type Role =
  /** The top-level object: an envelope, a wrapper or a single root node, not known yet. */
  | 'root'
  | 'node'
  /** A node's `children` array, or the tree array (parent `null`). */
  | 'children'
  | 'value';

interface Frame {
  role: Role;
  container: Record<string, unknown> | unknown[];
  /** The member being read (objects). */
  key: string | null;
  /** Node path for `node`; the parent node path for `children` (`null` for tree roots). */
  path: string | null;
  /** Node: `children` started. Root: the tree member started. */
  final: boolean;
  /** Node: an element of an array (children or roots). */
  inArray: boolean;
}

/** Node path of child `index` under `parent` (`null` for a root). */
function childPath(parent: string | null, index: number): string {
  return parent === null ? String(index) : `${parent}.children.${index}`;
}

export function createBlueprintAssembler(
  options: BlueprintAssemblerOptions = {}
): BlueprintAssembler {
  const tokenizer = createJsonTokenizer(options);
  const treeMembers = new Set(options.treeMembers ?? ['tree']);
  const stack: Frame[] = [];
  let root: unknown;
  let rootSet = false;
  let error: StreamError | null = null;
  let finished = false;
  // `true` when the root object turned out to be an envelope or wrapper.
  let rootIsEnvelope = false;

  const header = (frame: Frame): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(frame.container as Record<string, unknown>)) {
      if (!treeMembers.has(key)) out[key] = value;
    }
    return out;
  };

  const shellOf = (frame: Frame): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(frame.container as Record<string, unknown>)) {
      if (key !== 'children') out[key] = value;
    }
    return out;
  };

  const nodeEvent = (
    frame: Frame,
    parent: string | null,
    index: number,
    hasChildren: boolean,
    offset: number
  ): BlueprintStreamEvent => {
    const shell = shellOf(frame);
    const key = shell.key;
    return {
      type: 'node',
      path: frame.path as string,
      streamId: typeof key === 'string' && key !== '' ? key : (frame.path as string),
      parent,
      index,
      shell,
      hasChildren,
      inArray: frame.inArray,
      offset,
    };
  };

  /** Where a node sits: its parent path and index, from its path. */
  const position = (path: string): { parent: string | null; index: number } => {
    const at = path.lastIndexOf('.children.');
    if (at === -1) return { parent: null, index: Number(path) };
    return { parent: path.slice(0, at), index: Number(path.slice(at + '.children.'.length)) };
  };

  /** Attach a closed value to the container on top of the stack (or make it the root). */
  function attach(value: unknown, out: BlueprintStreamEvent[], offset: number): void {
    const top = stack[stack.length - 1];
    if (!top) {
      root = value;
      rootSet = true;
      return;
    }
    if (Array.isArray(top.container)) {
      top.container.push(value);
      return;
    }
    const key = top.key as string;
    top.container[key] = value;
    top.key = null;
    if (top.role === 'node' && key === 'id' && !top.final) {
      out.push({ type: 'node-id', path: top.path as string, id: value, offset });
    } else if (top.role === 'root' && rootIsEnvelope && top.final && !treeMembers.has(key)) {
      // A late envelope member (after the tree) changes the header the shells were checked with.
      out.push({ type: 'header', header: header(top), offset });
    }
  }

  /** The role and path a new container gets from where it opens. */
  function open(kind: 'object' | 'array', out: BlueprintStreamEvent[], offset: number): void {
    const container: Frame['container'] = kind === 'object' ? {} : [];
    const top = stack[stack.length - 1];
    const frame: Frame = {
      role: 'value',
      container,
      key: null,
      path: null,
      final: false,
      inArray: false,
    };
    if (!top) {
      // The top level: an object is an envelope, a wrapper or a root node; an array holds roots.
      if (kind === 'object') {
        frame.role = 'root';
        frame.path = '0';
      } else {
        frame.role = 'children';
        frame.path = null;
      }
    } else if (top.role === 'children' && kind === 'object') {
      const index = (top.container as unknown[]).length;
      frame.role = 'node';
      frame.path = childPath(top.path, index);
      frame.inArray = true;
      out.push({
        type: 'node-start',
        path: frame.path,
        parent: top.path,
        index,
        inArray: true,
        offset,
      });
    } else if (top.role === 'node' && top.key === 'children' && kind === 'array') {
      frame.role = 'children';
      frame.path = top.path;
    } else if (top.role === 'root' && top.key !== null && treeMembers.has(top.key)) {
      // The envelope's tree: one root node at `0`, or an array of roots.
      if (kind === 'object') {
        frame.role = 'node';
        frame.path = '0';
        out.push({ type: 'node-start', path: '0', parent: null, index: 0, inArray: false, offset });
      } else {
        frame.role = 'children';
        frame.path = null;
      }
    } else if (
      top.role === 'root' &&
      top.key === 'children' &&
      !rootIsEnvelope &&
      kind === 'array'
    ) {
      frame.role = 'children';
      frame.path = '0';
    }
    stack.push(frame);
  }

  function onKey(key: string, out: BlueprintStreamEvent[], offset: number): void {
    const top = stack[stack.length - 1] as Frame;
    top.key = key;
    if (top.role === 'root') {
      if (top.final) {
        out.push({ type: 'stream-order', path: rootIsEnvelope ? '$' : '0', key, offset });
        return;
      }
      if (treeMembers.has(key)) {
        top.final = true;
        rootIsEnvelope = true;
        top.path = null;
        out.push({ type: 'header', header: header(top), offset });
        return;
      }
      if (key === 'children') {
        // The root is a node: say so (late) and report its shell.
        top.final = true;
        out.push({ type: 'node-start', path: '0', parent: null, index: 0, inArray: false, offset });
        out.push(nodeEvent(top, null, 0, true, offset));
      }
      return;
    }
    if (top.role !== 'node') return;
    if (top.final) {
      out.push({ type: 'stream-order', path: top.path as string, key, offset });
      return;
    }
    if (key === 'children') {
      top.final = true;
      const { parent, index } = position(top.path as string);
      out.push(nodeEvent(top, parent, index, true, offset));
    }
  }

  function onClose(out: BlueprintStreamEvent[], offset: number): void {
    const frame = stack.pop() as Frame;
    if (frame.role === 'node' || (frame.role === 'root' && !rootIsEnvelope)) {
      const path = frame.path as string;
      if (!frame.final) {
        if (frame.role === 'root') {
          const record = frame.container as Record<string, unknown>;
          // A childless top-level object is a node unless it reads as an envelope.
          if (typeof record.format !== 'string') {
            out.push({ type: 'node-start', path, parent: null, index: 0, inArray: false, offset });
            out.push(nodeEvent(frame, null, 0, false, offset));
            out.push({ type: 'node-end', path, offset });
          }
        } else {
          const { parent, index } = position(path);
          out.push(nodeEvent(frame, parent, index, false, offset));
          out.push({ type: 'node-end', path, offset });
        }
      } else {
        out.push({ type: 'node-end', path, offset });
      }
    }
    attach(frame.container, out, offset);
  }

  function apply(events: readonly JsonStreamEvent[], out: BlueprintStreamEvent[]): void {
    for (const event of events) {
      if (event.type === 'open') open(event.kind, out, event.offset);
      else if (event.type === 'key') onKey(event.key, out, event.offset);
      else if (event.type === 'value') attach(event.value as JsonScalar, out, event.offset);
      else onClose(out, event.offset);
    }
  }

  function settle(out: BlueprintStreamEvent[]): BlueprintStreamEvent[] {
    if (error === null && tokenizer.error !== null) {
      error = tokenizer.error;
      out.push({ type: 'error', error });
    }
    return out;
  }

  return {
    write(chunk) {
      if (error !== null || finished) return [];
      const out: BlueprintStreamEvent[] = [];
      apply(tokenizer.write(chunk), out);
      return settle(out);
    },
    end() {
      if (error !== null || finished) return [];
      const out: BlueprintStreamEvent[] = [];
      apply(tokenizer.end(), out);
      settle(out);
      if (error === null && tokenizer.done && rootSet) {
        finished = true;
        out.push({ type: 'complete', value: root, offset: tokenizer.bytes });
      }
      return out;
    },
    abort(code = 'aborted', message) {
      if (error !== null || finished) return [];
      error = {
        code,
        offset: tokenizer.bytes,
        message:
          message ??
          (code === 'aborted' ? 'The stream was aborted.' : 'The stream connection dropped.'),
      };
      return [{ type: 'error', error }];
    },
    get bytes() {
      return tokenizer.bytes;
    },
    get error() {
      return error;
    },
    get value() {
      return rootSet ? root : stack[0]?.container;
    },
  };
}
