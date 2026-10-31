/**
 * The projection: a replica's state as a document that always validates.
 *
 * Concurrent edits can merge into structures a single editor never makes
 * (a list item whose first block is a heading after a concurrent move, a
 * columns block left with one column, more blocks than the cap). The
 * projection is a pure function of the replica state, so every replica
 * that integrated the same operations projects the same document, and it
 * repairs deterministically: nodes a parent cannot hold, characters a text
 * field refuses and nodes past the caps are left out, and every node the
 * validator still refuses is left out until the document validates (ADR-010:
 * a merge can never produce a document that fails the schema). Nothing is
 * deleted from the replica: an undo or a later edit brings it back.
 *
 * Text views map each projected unit to its CRDT item and to UTF-16
 * offsets, which is how comments, suggestions and cursors anchored to item
 * ids become ranges in the document.
 */
import { type EditorMark, normalizeInline, sortMarks } from '@texuli/core/editor-model';
import type { HrefTrust } from '@texuli/core/url-policy';
import { DOCUMENT_FORMAT, DOCUMENT_FORMAT_VERSION, DOCUMENT_LIMITS as L } from '../model/limits.ts';
import type { DocumentInline, DocumentNode, TexuliDocument } from '../model/types.ts';
import { validateDocument } from '../schema/validate.ts';
import { type ItemId, type Replica, ROOT, type SyncJson, type SyncTextRun } from '../sync/index.ts';
import {
  acceptsChild,
  attrsOf,
  childKeyOf,
  codeRefuses,
  DOCUMENT_MARK_KEYS,
  decodeValue,
  META_FIELDS,
  markFromSync,
  PAGE_FIELD,
  richRefuses,
  SUGGEST_DELETE,
  SUGGEST_INSERT,
  textFieldOf,
} from './vocabulary.ts';

/** One text field as the projection shows it. */
export interface FieldView {
  node: string;
  field: string;
  rich: boolean;
  /** Projected code points (`\n` is a break in rich text). */
  chars: string[];
  /** The item id of each projected unit. */
  ids: ItemId[];
  /** Document marks of each projected unit (canonical order). */
  marks: (readonly EditorMark[])[];
  /** Suggested-insertion id of each projected unit, or `null`. */
  inserted: (string | null)[];
  /** Suggested-deletion id of each projected unit, or `null`. */
  deleted: (string | null)[];
  /** Visible replica index of each projected unit (refused characters are skipped). */
  raw: number[];
  /** Visible replica units, refused characters included. */
  rawLength: number;
  /** UTF-16 offset where each projected unit starts, plus the end. */
  offsets: number[];
}

const NO_MARKS: readonly EditorMark[] = Object.freeze([]);

function suggestionOf(marks: { [key: string]: SyncJson }, key: string): string | null {
  const value = marks[key];
  return typeof value === 'string' && value.length > 0 && value.length <= 64 ? value : null;
}

/** Read a field of a replica node as a view. Linear in the field's text. */
export function readView(
  replica: Replica,
  node: string,
  field: string,
  rich: boolean,
  tier: HrefTrust = 'untrusted'
): FieldView {
  const view: FieldView = {
    node,
    field,
    rich,
    chars: [],
    ids: [],
    marks: [],
    inserted: [],
    deleted: [],
    raw: [],
    rawLength: 0,
    offsets: [0],
  };
  const refuses = rich ? richRefuses : codeRefuses;
  let raw = 0;
  let offset = 0;
  const runs: SyncTextRun[] = replica.textRuns(node, field);
  for (const run of runs) {
    let marks = NO_MARKS;
    if (rich) {
      const list: EditorMark[] = [];
      for (const key of DOCUMENT_MARK_KEYS) {
        const value = run.marks[key];
        if (value === undefined) continue;
        const mark = markFromSync(key, value, tier);
        if (mark) list.push(mark);
      }
      marks = list.length > 0 ? sortMarks(list) : NO_MARKS;
    }
    const inserted = suggestionOf(run.marks, SUGGEST_INSERT);
    const deleted = suggestionOf(run.marks, SUGGEST_DELETE);
    for (const char of run.text) {
      const index = raw;
      raw += 1;
      if (refuses(char)) continue;
      view.chars.push(char);
      view.ids.push(replica.itemAt(node, field, index) as ItemId);
      view.marks.push(char === '\n' && rich ? NO_MARKS : marks);
      view.inserted.push(inserted);
      view.deleted.push(deleted);
      view.raw.push(index);
      offset += char.length;
      view.offsets.push(offset);
    }
  }
  view.rawLength = raw;
  return view;
}

/** The inline content of a rich view (a `\n` unit is a break). */
export function viewInline(view: FieldView): DocumentInline[] {
  const out: DocumentInline[] = [];
  let text = '';
  let marks: readonly EditorMark[] = NO_MARKS;
  const flush = () => {
    if (text) out.push({ type: 'text', text, marks: [...marks] });
    text = '';
  };
  for (let i = 0; i < view.chars.length; i += 1) {
    const char = view.chars[i] as string;
    if (char === '\n') {
      flush();
      out.push({ type: 'break' });
      continue;
    }
    const unitMarks = view.marks[i] as readonly EditorMark[];
    if (unitMarks !== marks) {
      flush();
      marks = unitMarks;
    }
    text += char;
  }
  flush();
  return normalizeInline(out) as DocumentInline[];
}

/** The UTF-16 offset of a visible replica index in a view (the start of the next projected unit). */
export function offsetOfRaw(view: FieldView, raw: number): number {
  let low = 0;
  let high = view.raw.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if ((view.raw[mid] as number) < raw) low = mid + 1;
    else high = mid;
  }
  return view.offsets[low] as number;
}

/** The projected unit that starts at a UTF-16 offset (offsets inside a pair round down). */
export function unitAtOffset(view: FieldView, offset: number): number {
  let low = 0;
  let high = view.chars.length;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if ((view.offsets[mid] as number) <= offset) low = mid;
    else high = mid - 1;
  }
  return low;
}

interface Shell {
  kind: string;
  data: Record<string, unknown>;
  /** Characters the validator counts for the node itself. */
  chars: number;
  view: FieldView | null;
}

/** UTF-16 text length of inline content (a break counts 1). */
function inlineLength(content: readonly DocumentInline[]): number {
  let length = 0;
  for (const part of content) length += part.type === 'break' ? 1 : part.text.length;
  return length;
}

const titleLength = (value: unknown) => (typeof value === 'string' ? value.length : 0);

/** The result of a projection. */
export interface Projection {
  /** The document (valid at the projector's tier; treat as read-only). */
  document: TexuliDocument;
  /** The view of a projected text node, or `null`. */
  view(id: string): FieldView | null;
  /** Projected node ids. */
  has(id: string): boolean;
  /** Replica nodes the repair left out on this projection (0 when the merge was clean). */
  repaired: number;
}

export interface ProjectorOptions {
  /** URL tier the projection validates at (`untrusted` by default). Every replica must use the same. */
  tier?: HrefTrust;
}

/** Bounded repair rounds before the projection falls back to an empty document. */
const MAX_ROUNDS = 16;

/**
 * Projects a replica, caching node shells between projections: only nodes
 * marked dirty (by the operations that touched them) are read again.
 */
export class Projector {
  readonly replica: Replica;
  readonly tier: HrefTrust;
  readonly #shells = new Map<string, Shell>();

  constructor(replica: Replica, options: ProjectorOptions = {}) {
    this.replica = replica;
    this.tier = options.tier ?? 'untrusted';
  }

  /** Forget a node's cached shell (its type, attributes or text changed). */
  dirty(id: string): void {
    this.#shells.delete(id);
  }

  #shell(id: string): Shell {
    const cached = this.#shells.get(id);
    if (cached) return cached;
    const info = this.replica.node(id) as NonNullable<ReturnType<Replica['node']>>;
    const kind = info.type;
    const data: Record<string, unknown> = { id };
    if (kind !== 'item') data.type = kind;
    for (const attr of attrsOf(kind)) {
      const value = decodeValue(info.props[attr]);
      if (value !== null && value !== undefined) data[attr] = value;
    }
    let chars = 0;
    let view: FieldView | null = null;
    const text = textFieldOf(kind);
    if (text) {
      view = readView(this.replica, id, text.field, text.rich, this.tier);
      if (text.rich) {
        const content = viewInline(view);
        data[text.field] = content;
        chars = inlineLength(content);
      } else {
        data[text.field] = view.chars.join('');
        chars = (data[text.field] as string).length;
      }
    }
    if (kind === 'callout' || kind === 'page-link' || kind === 'embed')
      chars += titleLength(data.title);
    if (kind === 'media') chars += titleLength(data.alt);
    const shell = { kind, data, chars, view };
    this.#shells.set(id, shell);
    return shell;
  }

  /** Project the replica. Linear in the attached tree plus the dirty nodes' text. */
  project(): Projection {
    const replica = this.replica;
    const rootProps = (replica.node(ROOT) as NonNullable<ReturnType<Replica['node']>>).props;
    const meta: Record<string, unknown> = { title: '' };
    for (const field of META_FIELDS) {
      const value = decodeValue(rootProps[field]);
      if (value !== null && value !== undefined) meta[field] = value;
    }
    if (typeof meta.title !== 'string' || meta.title.length > 500) meta.title = '';
    const doc: Record<string, unknown> = {
      format: DOCUMENT_FORMAT,
      formatVersion: DOCUMENT_FORMAT_VERSION,
      meta,
    };
    const page = decodeValue(rootProps[PAGE_FIELD]);
    if (page !== null && typeof page === 'object' && !Array.isArray(page)) doc.page = page;
    const blocks: Record<string, unknown>[] = [];
    doc.blocks = blocks;
    const views = new Map<string, FieldView>();
    let count = 0;
    let chars = (meta.title as string).length;
    let left = 0;
    type Frame = { id: string; kind: string; out: Record<string, unknown>[]; depth: number };
    const stack: Frame[] = [{ id: ROOT, kind: 'root', out: blocks, depth: 0 }];
    while (stack.length > 0) {
      const frame = stack.pop() as Frame;
      const containers: Frame[] = [];
      for (const child of replica.children(frame.id)) {
        const shell = this.#shell(child);
        if (
          !acceptsChild(frame.kind, shell.kind) ||
          count >= L.blocks ||
          chars + shell.chars > L.chars
        ) {
          left += 1;
          continue;
        }
        count += 1;
        chars += shell.chars;
        const json: Record<string, unknown> = { ...shell.data };
        if (shell.view) views.set(child, shell.view);
        const key = childKeyOf(shell.kind);
        if (key) {
          const list: Record<string, unknown>[] = [];
          json[key] = list;
          if (frame.depth < L.depth)
            containers.push({ id: child, kind: shell.kind, out: list, depth: frame.depth + 1 });
        }
        frame.out.push(json);
      }
      for (let i = containers.length - 1; i >= 0; i -= 1) stack.push(containers[i] as Frame);
    }
    const repaired = repair(doc, this.tier);
    const projected = repaired.document;
    const ids = new Set<string>();
    walkIds(projected, ids);
    for (const id of views.keys()) if (!ids.has(id)) views.delete(id);
    return {
      document: projected,
      view: (id) => views.get(id) ?? null,
      has: (id) => ids.has(id),
      repaired: left + repaired.dropped,
    };
  }
}

function walkIds(doc: TexuliDocument, ids: Set<string>): void {
  const stack: DocumentNode[] = [...doc.blocks];
  while (stack.length > 0) {
    const node = stack.pop() as DocumentNode;
    ids.add(node.id);
    const key = childKeyOf('type' in node ? node.type : 'item');
    if (key) stack.push(...((node as unknown as Record<string, DocumentNode[]>)[key] ?? []));
  }
}

/** Validate; leave out every node an error points into, until the document validates. */
function repair(
  doc: Record<string, unknown>,
  tier: HrefTrust
): { document: TexuliDocument; dropped: number } {
  let dropped = 0;
  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const result = validateDocument(doc, { trust: tier });
    if (result.ok) return { document: doc as unknown as TexuliDocument, dropped };
    const drop = new Set<object>();
    let fixedRoot = false;
    for (const issue of result.issues) {
      if (issue.severity !== 'error') continue;
      const path = issue.path;
      if (path[0] === 'meta' && typeof path[1] === 'string') {
        const meta = doc.meta as Record<string, unknown>;
        if (path[1] === 'title') meta.title = '';
        else delete meta[path[1]];
        fixedRoot = true;
        continue;
      }
      if (path[0] === 'page') {
        delete doc.page;
        fixedRoot = true;
        continue;
      }
      const node = nodeAt(doc, path);
      if (node) drop.add(node);
    }
    if (drop.size === 0 && !fixedRoot) break;
    dropped += drop.size;
    if (drop.size > 0) prune(doc.blocks as Record<string, unknown>[], drop);
  }
  const fallback = {
    format: DOCUMENT_FORMAT,
    formatVersion: DOCUMENT_FORMAT_VERSION,
    meta: { title: '' },
    blocks: [],
  } as TexuliDocument;
  return { document: fallback, dropped: dropped + 1 };
}

/**
 * The deepest document node an issue path points into: only child lists
 * (`blocks`, `items`, `columns`) lead to a node, so an object inside a
 * value (a slide of an inline deck, the catalog node of an inline
 * component, an item of wrapped block props) is never taken for one. The
 * repair then leaves out the node that holds the value, which `prune`
 * can remove, instead of a value it cannot (which used to exhaust the
 * rounds and empty the whole document).
 */
function nodeAt(doc: Record<string, unknown>, path: readonly (string | number)[]): object | null {
  let at: unknown = doc;
  let node: object | null = null;
  for (let i = 0; i + 1 < path.length; i += 2) {
    const key = path[i];
    const index = path[i + 1];
    if (key !== 'blocks' && key !== 'items' && key !== 'columns') break;
    if (typeof index !== 'number') break;
    const list = (at as Record<string, unknown>)[key];
    if (!Array.isArray(list)) break;
    const next: unknown = list[index];
    if (next === null || typeof next !== 'object' || Array.isArray(next)) break;
    at = next;
    node = next;
  }
  return node;
}

/** Remove the dropped nodes from every child list (iterative). */
function prune(blocks: Record<string, unknown>[], drop: Set<object>): void {
  const stack: Record<string, unknown>[][] = [blocks];
  while (stack.length > 0) {
    const list = stack.pop() as Record<string, unknown>[];
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const node = list[i] as Record<string, unknown>;
      if (drop.has(node)) {
        list.splice(i, 1);
        continue;
      }
      for (const key of ['blocks', 'items', 'columns'])
        if (Array.isArray(node[key])) stack.push(node[key] as Record<string, unknown>[]);
    }
  }
}
