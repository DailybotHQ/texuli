import {
  type StreamNodeValidation,
  type ValidateDraftOptions,
  validateStreamNode,
} from '@texuli/catalog/validate';
import { type BlueprintStreamEvent, createBlueprintAssembler } from '@texuli/spec/stream';

/**
 * The service side of streaming generation (ADR-014). A provider streams
 * the `emit_blueprint` input (`{"tree": …}`) as JSON text. The draft
 * streamer reads that text with `@texuli/spec/stream` and, chunk by chunk:
 *
 * - **re-frames it** as a draft envelope stream for clients: the
 *   service's own envelope header, then the model's tree text exactly as
 *   written, then `}`. Concatenated, the `draft-chunk` texts are one
 *   blueprint envelope a `<Player stream>` reads as it arrives; text the
 *   model wrote around the tree is never forwarded;
 * - **checks each node** whose shell is final with the catalog's
 *   `validateStreamNode`, under that header and with the service's own
 *   validation options, and reports it `node-ready` or `refused`. A
 *   refused node holds its whole subtree, as the player does.
 *
 * It decides nothing final: the service runs the full `validateDraft` on
 * the complete input, which stays the only path to a valid draft.
 */

export type DraftStreamEvent =
  /** Envelope text to forward to clients (concatenated: one envelope). */
  | { type: 'chunk'; text: string }
  /** A node's shell is final and passed every node-level check. */
  | { type: 'node-ready'; path: string; streamId: string; id: string }
  /**
   * A node (and its subtree) is held until the final verdict: a node check
   * refused it (`node`), an ancestor is held (`held`), a member arrived
   * after its `children` (`stream-order`), or the stream itself stopped
   * (`stream-error`, path `$`).
   */
  | {
      type: 'refused';
      path: string;
      reason: 'node' | 'held' | 'stream-order' | 'stream-error';
      codes: readonly string[];
    };

export interface DraftStreamEnd {
  events: DraftStreamEvent[];
  /** The complete tool input, when the JSON closed cleanly. */
  input: unknown;
  /** Why the JSON did not complete (`stream-<code>`), or `null`. */
  issue: { code: string; message: string } | null;
}

export interface DraftStreamerOptions {
  /** The envelope members the service puts before the tree (no `tree`). */
  header: Readonly<Record<string, unknown>>;
  /** The options of the service's gate; nodes are checked with exactly these. */
  validation: ValidateDraftOptions;
  /** Check nodes and re-frame chunks. When false, only parse (the non-streaming mode). */
  check?: boolean;
  /** UTF-8 byte budget for the tool JSON (default: the tokenizer's). */
  maxBytes?: number;
}

export interface DraftStreamer {
  write(text: string): DraftStreamEvent[];
  end(): DraftStreamEnd;
  /** Nodes admitted so far. */
  readonly admitted: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Every ancestor path of a node path, root first (`0.children.1` → `0`). */
function ancestorPaths(path: string): string[] {
  const out: string[] = [];
  let at = path.indexOf('.children.');
  while (at !== -1) {
    out.push(path.slice(0, at));
    at = path.indexOf('.children.', at + 1);
  }
  return out;
}

/** Whether `path` is `held` or inside it. */
function within(path: string, held: string): boolean {
  return path === held || path.startsWith(`${held}.children.`);
}

export function createDraftStreamer(options: DraftStreamerOptions): DraftStreamer {
  const check = options.check ?? true;
  const assembler = createBlueprintAssembler({
    treeMembers: ['tree'],
    ...(options.maxBytes !== undefined ? { maxBytes: options.maxBytes } : {}),
  });
  const prefix = `${JSON.stringify(options.header).slice(0, -1)},"tree":`;
  const shells = new Map<string, Readonly<Record<string, unknown>>>();
  const held: string[] = [];
  let admitted = 0;
  // Where the forwarded tree text stands: before it, inside it, or past it.
  let phase: 'before' | 'tree' | 'after' = 'before';
  let prefixSent = false;
  let stopped = false;
  // UTF-8 byte position and surrogate state of the text read so far (the tokenizer's counting).
  let position = 0;
  let pendingHigh = false;

  const isHeld = (path: string) => held.some((h) => within(path, h));

  /** The code-unit index in `text` where byte `target` starts, counting from `position`. */
  const indexAt = (text: string, start: { bytes: number; high: boolean }, target: number) => {
    let bytes = start.bytes;
    let high = start.high;
    let i = 0;
    while (i < text.length && bytes < target) {
      const code = text.charCodeAt(i);
      if (code < 0x80) {
        bytes += 1;
        high = false;
      } else if (code < 0x800) {
        bytes += 2;
        high = false;
      } else if (code >= 0xd800 && code <= 0xdbff) {
        bytes += 3;
        high = true;
      } else if (code >= 0xdc00 && code <= 0xdfff && high) {
        bytes += 1;
        high = false;
      } else {
        bytes += 3;
        high = false;
      }
      i += 1;
    }
    return { index: i, bytes, high };
  };

  const judge = (event: Extract<BlueprintStreamEvent, { type: 'node' }>): DraftStreamEvent => {
    const { path } = event;
    if (isHeld(path)) {
      return { type: 'refused', path, reason: 'held', codes: ['ancestor-held'] };
    }
    const ancestors: Readonly<Record<string, unknown>>[] = [];
    for (const ancestor of ancestorPaths(path)) {
      const shell = shells.get(ancestor);
      if (!shell) {
        held.push(path);
        return { type: 'refused', path, reason: 'held', codes: ['ancestor-held'] };
      }
      ancestors.push(shell);
    }
    const verdict: StreamNodeValidation = validateStreamNode(
      {
        header: options.header,
        ancestors,
        shell: event.shell,
        index: event.index,
        root: event.inArray && event.parent === null,
        admitted,
      },
      options.validation
    );
    if (!verdict.ok) {
      held.push(path);
      const codes = [...new Set(verdict.diagnostics.map((d) => d.code))].slice(0, 10);
      return { type: 'refused', path, reason: 'node', codes };
    }
    shells.set(path, event.shell);
    admitted += 1;
    const id = isRecord(event.shell) && typeof event.shell.id === 'string' ? event.shell.id : '';
    return { type: 'node-ready', path, streamId: event.streamId, id };
  };

  const react = (events: readonly BlueprintStreamEvent[], out: DraftStreamEvent[]) => {
    for (const event of events) {
      if (event.type === 'error') {
        stopped = true;
        if (check) {
          out.push({
            type: 'refused',
            path: '$',
            reason: 'stream-error',
            codes: [`stream-${event.error.code}`],
          });
        }
      } else if (!check) {
        // Parse only.
      } else if (event.type === 'node') {
        out.push(judge(event));
      } else if (event.type === 'stream-order' && event.path !== '$') {
        // A member after `children` changed a shell that was already judged.
        if (!isHeld(event.path)) held.push(event.path);
        out.push({
          type: 'refused',
          path: event.path,
          reason: 'stream-order',
          codes: ['stream-order'],
        });
      }
    }
  };

  return {
    get admitted() {
      return admitted;
    },
    write(text) {
      if (stopped || text === '') return [];
      const start = { bytes: position, high: pendingHigh };
      const events = assembler.write(text);
      let from = phase === 'tree' ? 0 : -1;
      let to = text.length;
      if (check) {
        for (const event of events) {
          if (
            phase === 'before' &&
            event.type === 'node-start' &&
            event.path === '0' &&
            event.parent === null &&
            !event.inArray
          ) {
            phase = 'tree';
            from = indexAt(text, start, event.offset).index;
          } else if (phase === 'tree' && event.type === 'node-end' && event.path === '0') {
            phase = 'after';
            // The offset is the closing brace's: forward it too.
            to = indexAt(text, start, event.offset).index + 1;
          }
        }
      }
      const end = indexAt(text, start, Number.POSITIVE_INFINITY);
      position = end.bytes;
      pendingHigh = end.high;
      const out: DraftStreamEvent[] = [];
      // A chunk the tokenizer refused is never forwarded: clients get `refused` at `$`.
      const refusedChunk = events.some((e) => e.type === 'error');
      if (check && from !== -1 && !refusedChunk) {
        let forwarded = text.slice(from, to);
        if (!prefixSent) {
          forwarded = prefix + forwarded;
          prefixSent = true;
        }
        if (phase === 'after') forwarded += '}';
        if (forwarded !== '') out.push({ type: 'chunk', text: forwarded });
      }
      react(events, out);
      return out;
    },
    end() {
      const out: DraftStreamEvent[] = [];
      if (stopped) {
        const error = assembler.error;
        return {
          events: out,
          input: undefined,
          issue: error
            ? { code: `stream-${error.code}`, message: error.message }
            : { code: 'stream-aborted', message: 'The tool input stopped.' },
        };
      }
      const events = assembler.end();
      react(events, out);
      const complete = events.find((e) => e.type === 'complete');
      if (complete && complete.type === 'complete') {
        return { events: out, input: complete.value, issue: null };
      }
      const error = assembler.error;
      return {
        events: out,
        input: undefined,
        issue: {
          code: `stream-${error?.code ?? 'truncated'}`,
          message: error?.message ?? 'The tool input did not complete.',
        },
      };
    },
  };
}
