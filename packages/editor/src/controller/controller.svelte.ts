/**
 * The headless editor: one reactive history over the core texels, the
 * commands every surface binds (keys, `beforeinput` intents, the toolbar,
 * the link dialog, paste) and the composition guard. It holds no DOM; the
 * surface feeds it intents and reads `state` back.
 */

import {
  canRedo,
  canUndo,
  createEditorHistory,
  type EditorEditKind,
  type EditorHistory,
  editorHistoryReducer,
} from '@texuli/core/editor-history';
import type { EditorInputIntent, EditorKeyIntent } from '@texuli/core/editor-keymap';
import type { EditorTransformResult } from '@texuli/core/editor-model';
import {
  caret as caretAt,
  clampSelection,
  type EditorBlockId,
  type EditorDocument,
  type EditorIdSource,
  type EditorIssue,
  type EditorLimits,
  type EditorMark,
  type EditorMarkType,
  type EditorSelection,
  type EditorState,
  editorLeaves,
  emptyEditorDocument,
  hasMark,
  inheritedMarks,
  isCollapsed,
  isTextBlock,
  locateBlock,
  nextEditorId,
  normalizeDocument,
  selectionRange,
  sliceInline,
  startSelection,
} from '@texuli/core/editor-model';
import {
  applyComposition,
  applyInputRules,
  deleteBackward,
  deleteForward,
  deleteSelection,
  type EditorTransformOptions,
  insertBlock,
  insertBreak,
  insertText,
  liftListItem,
  removeLink,
  replaceSelection,
  setBlockType,
  setLink,
  sinkListItem,
  splitBlock,
  toggleList,
  toggleMark,
  toggleQuote,
  toggleTodo,
} from '@texuli/core/editor-transforms';
import { type HrefTrust, resolveTrust } from '@texuli/core/url-policy';
import { type ClipboardLike, type PasteResult, readClipboard } from '../paste/index.ts';
import { DEFAULT_EDITOR_LABELS, type EditorLabels } from './labels.ts';

export interface EditorControllerOptions {
  /** The starting document (validated by the caller: `loadEditorDocument` or `fromMarkdown`). */
  doc?: EditorDocument;
  /**
   * URL policy tier for links typed in the link dialog. Default `untrusted`;
   * pasted and autolinked URLs are always `untrusted`.
   */
  trust?: HrefTrust;
  /** Lower document caps (a blocks `text` field holds 4,000 characters). */
  limits?: Partial<EditorLimits>;
  newId?: EditorIdSource;
  labels?: Partial<EditorLabels>;
  /** Where announcements go (the surface passes the core announcer). */
  announce?: (message: string) => void;
  /** Every accepted change of the document. */
  onChange?: (doc: EditorDocument) => void;
  /** Clock for undo grouping (tests). */
  now?: () => number;
}

export type EditorBlockKind =
  | { type: 'paragraph' }
  | { type: 'heading'; level: number }
  | { type: 'code' }
  | { type: 'void' };

/** What the toolbar shows as active at the selection. */
export interface EditorActiveState {
  marks: ReadonlySet<EditorMarkType>;
  block: EditorBlockKind | null;
  list: 'bullet' | 'ordered' | 'todo' | null;
  quote: boolean;
  link: string | null;
}

/** The marks the toolbar can toggle. */
export type EditorToggleMark = Exclude<EditorMarkType, 'link' | 'extension'>;

const MARK_INTENTS: Partial<Record<EditorKeyIntent | EditorInputIntent, EditorToggleMark>> = {
  'toggle-strong': 'strong',
  'toggle-em': 'em',
  'toggle-code': 'code',
  'toggle-strike': 'strike',
};

export class EditorController {
  history: EditorHistory = $state.raw(null as unknown as EditorHistory);
  /** True between `compositionstart` and `compositionend`: the model is left alone. */
  composing = $state(false);
  /** Bumped per block when the browser wrote into its DOM, so the block re-renders from the model. */
  epochs: ReadonlyMap<EditorBlockId, number> = $state.raw(new Map());
  /** The last refusal, for hosts that show it. */
  errors: readonly EditorIssue[] = $state.raw([]);
  labels: EditorLabels = $state.raw(DEFAULT_EDITOR_LABELS);
  trust: HrefTrust;
  readonly options: EditorControllerOptions;
  /** Set by Escape in the text: the next Tab leaves the editor even inside a list. */
  tabLeaves = false;
  private readonly transform: EditorTransformOptions;
  private readonly now: () => number;

  constructor(options: EditorControllerOptions = {}) {
    this.options = options;
    this.labels = { ...DEFAULT_EDITOR_LABELS, ...options.labels };
    this.trust = resolveTrust(options.trust ?? 'untrusted');
    const newId = options.newId ?? nextEditorId;
    this.transform = { newId, ...(options.limits ? { limits: options.limits } : {}) };
    this.now = options.now ?? (() => Date.now());
    const doc = normalizeDocument(options.doc ?? emptyEditorDocument(newId), newId);
    this.history = createEditorHistory({ doc, selection: startSelection(doc) });
  }

  get state(): EditorState {
    return this.history.present;
  }

  get doc(): EditorDocument {
    return this.history.present.doc;
  }

  get canUndo(): boolean {
    return canUndo(this.history);
  }

  get canRedo(): boolean {
    return canRedo(this.history);
  }

  epoch(id: EditorBlockId): number {
    return this.epochs.get(id) ?? 0;
  }

  private say(message: string): void {
    if (message) this.options.announce?.(message);
  }

  /** Apply a transform result as one history step. Returns whether it was accepted. */
  apply(result: EditorTransformResult, kind: EditorEditKind = 'other', announce?: string): boolean {
    const before = this.history.present.doc;
    this.history = editorHistoryReducer(this.history, {
      type: 'apply',
      result,
      kind,
      at: this.now(),
    });
    if (!result.ok) {
      this.errors = result.errors;
      const code = result.errors[0]?.code;
      if (code && code !== 'nothing-to-do') this.say(this.labels.refused(code));
      return false;
    }
    this.errors = [];
    if (announce) this.say(announce);
    if (this.history.present.doc !== before) this.options.onChange?.(this.history.present.doc);
    return true;
  }

  /** Replace the document from outside (history restarts). */
  replace(doc: EditorDocument): void {
    const normalized = normalizeDocument(doc, this.transform.newId);
    this.history = editorHistoryReducer(this.history, {
      type: 'replace',
      state: { doc: normalized, selection: startSelection(normalized) },
    });
    this.errors = [];
  }

  /** A selection change from the surface (no undo step). */
  select(selection: EditorSelection): void {
    this.history = editorHistoryReducer(this.history, {
      type: 'select',
      selection: clampSelection(this.doc, selection),
    });
  }

  undo(): boolean {
    if (!this.canUndo) return false;
    this.history = editorHistoryReducer(this.history, { type: 'undo' });
    this.say(this.labels.undone);
    this.options.onChange?.(this.doc);
    return true;
  }

  redo(): boolean {
    if (!this.canRedo) return false;
    this.history = editorHistoryReducer(this.history, { type: 'redo' });
    this.say(this.labels.redone);
    this.options.onChange?.(this.doc);
    return true;
  }

  // ── reading the selection ──────────────────────────────────────────────

  /** Marks, block type, list and link at the selection, for the toolbar. */
  get active(): EditorActiveState {
    const { doc, selection, storedMarks } = this.state;
    const empty: EditorActiveState = {
      marks: new Set(),
      block: null,
      list: null,
      quote: false,
      link: null,
    };
    if (selection.kind === 'node') return { ...empty, block: { type: 'void' } };
    const location = locateBlock(doc, selection.focus.block);
    const block = location?.block;
    if (!location || !block || !isTextBlock(block)) return empty;
    const item = location.ancestors.findLast((ancestor) => ancestor.kind === 'item');
    const kind: EditorBlockKind =
      block.type === 'heading'
        ? { type: 'heading', level: block.level }
        : { type: block.type === 'code' ? 'code' : 'paragraph' };
    const base = {
      block: kind,
      list: item?.kind === 'item' ? item.list.kind : null,
      quote: location.ancestors.some((ancestor) => ancestor.kind === 'quote'),
    };
    if (block.type === 'code') return { ...empty, ...base, marks: new Set(['code']) };
    let runs: { marks: readonly EditorMark[] }[];
    if (isCollapsed(selection)) {
      runs = [{ marks: storedMarks ?? inheritedMarks(block.content, selection.focus.offset) }];
    } else {
      const range = selectionRange(doc, selection);
      runs = [];
      if (range) {
        const leaves = editorLeaves(doc).slice(range.from.index, range.to.index + 1);
        leaves.forEach(({ block: leaf }, index) => {
          if (leaf.type !== 'paragraph' && leaf.type !== 'heading') return;
          const from = index === 0 ? range.from.offset : 0;
          const to = index === leaves.length - 1 ? range.to.offset : Number.POSITIVE_INFINITY;
          for (const run of sliceInline(leaf.content, from, to))
            if (run.type === 'text') runs.push(run);
        });
      }
    }
    const marks = new Set<EditorMarkType>();
    for (const type of ['strong', 'em', 'strike', 'code', 'link'] as const)
      if (runs.length > 0 && runs.every((run) => hasMark(run.marks, type))) marks.add(type);
    const first = runs[0]?.marks.find((mark) => mark.type === 'link');
    const link = first?.type === 'link' ? first.href : null;
    return { ...empty, ...base, marks, link: marks.has('link') ? link : null };
  }

  /** Whether the caret is inside a list item (Tab indents instead of moving focus). */
  get inList(): boolean {
    return this.listDepth() > 0;
  }

  private listDepth(): number {
    const { selection, doc } = this.state;
    if (selection.kind !== 'text') return 0;
    return (
      locateBlock(doc, selection.focus.block)?.ancestors.filter((a) => a.kind === 'item').length ??
      0
    );
  }

  // ── commands ─────────────────────────────────────────────────────────

  toggleMark(type: EditorToggleMark): boolean {
    const collapsed = this.state.selection.kind === 'text' && isCollapsed(this.state.selection);
    const was = this.active.marks.has(type);
    const name = this.labels[type];
    return this.apply(
      toggleMark(this.state, type, this.transform),
      'other',
      collapsed ? (was ? this.labels.markOff(name) : this.labels.markOn(name)) : undefined
    );
  }

  setBlock(type: 'paragraph' | 'code'): boolean;
  setBlock(type: 'heading', level: 1 | 2 | 3 | 4): boolean;
  setBlock(type: 'paragraph' | 'heading' | 'code', level: 1 | 2 | 3 | 4 = 1): boolean {
    const name =
      type === 'heading'
        ? this.labels.heading(level)
        : type === 'code'
          ? this.labels.codeBlock
          : this.labels.paragraph;
    return this.apply(setBlockType(this.state, type, level, this.transform), 'other', name);
  }

  toggleList(kind: 'bullet' | 'ordered' | 'todo'): boolean {
    const name = this.labels[`${kind}List`];
    const was = this.active.list === kind;
    return this.apply(
      toggleList(this.state, kind, this.transform),
      'other',
      was ? this.labels.paragraph : name
    );
  }

  toggleQuote(): boolean {
    return this.apply(toggleQuote(this.state, this.transform), 'other', this.labels.quote);
  }

  indent(): boolean {
    const ok = this.apply(sinkListItem(this.state, this.transform));
    if (ok) this.say(this.labels.level(this.listDepth()));
    return ok;
  }

  outdent(): boolean {
    const ok = this.apply(liftListItem(this.state, this.transform));
    if (ok) this.say(this.inList ? this.labels.level(this.listDepth()) : this.labels.paragraph);
    return ok;
  }

  toggleTodo(): boolean {
    return this.apply(toggleTodo(this.state, this.transform));
  }

  /** Check or uncheck one todo item (the checkbox), wherever the caret is. */
  toggleItem(firstBlock: EditorBlockId): boolean {
    const state = { ...this.state, selection: caretAt(firstBlock) };
    return this.apply(toggleTodo(state, this.transform));
  }

  insertDivider(): boolean {
    return this.apply(
      insertBlock(this.state, { type: 'divider' }, this.transform),
      'other',
      this.labels.divider
    );
  }

  /**
   * Link the selection (or insert `text` as a link at a caret). The href must
   * pass the URL policy at the editor's tier; a refusal keeps the document and
   * returns the issues so the dialog can show them.
   */
  setLink(href: string, text?: string): EditorTransformResult {
    const result = setLink(this.state, href, {
      ...this.transform,
      trust: this.trust,
      ...(text ? { text } : {}),
    });
    this.apply(result);
    return result;
  }

  removeLink(): boolean {
    return this.apply(removeLink(this.state, this.transform));
  }

  /** Type text: one typing step, then any input rule as its own step. */
  insertText(text: string): boolean {
    if (!this.apply(insertText(this.state, text, this.transform), 'typing')) return false;
    const rule = applyInputRules(this.state, this.transform);
    if (rule?.ok) this.apply(rule, 'input-rule');
    return true;
  }

  /** Paste clipboard data as untrusted content; announces what happened. */
  paste(data: ClipboardLike): PasteResult {
    const pasted = readClipboard(data, this.transform);
    if (pasted.source === 'empty') return pasted;
    const ok = this.apply(replaceSelection(this.state, pasted.doc, this.transform));
    if (ok) this.say(this.labels.pasted(pasted.blocks, pasted.linksRemoved));
    return pasted;
  }

  /** A key intent from `editor-keymap`. Returns whether it was handled (so the surface prevents the default). */
  runKey(intent: EditorKeyIntent): boolean {
    const mark = MARK_INTENTS[intent];
    if (mark) {
      this.toggleMark(mark);
      return true;
    }
    if (intent.startsWith('heading-')) {
      this.setBlock('heading', Number(intent.slice(-1)) as 1 | 2 | 3 | 4);
      return true;
    }
    switch (intent) {
      case 'undo':
        this.undo();
        return true;
      case 'redo':
        this.redo();
        return true;
      case 'paragraph':
        this.setBlock('paragraph');
        return true;
      case 'bullet-list':
      case 'ordered-list':
      case 'todo-list':
        this.toggleList(intent.slice(0, -5) as 'bullet' | 'ordered' | 'todo');
        return true;
      case 'quote':
        this.toggleQuote();
        return true;
      case 'toggle-todo':
        this.toggleTodo();
        return true;
      case 'indent':
      case 'outdent':
        if (this.tabLeaves || !this.inList) {
          this.tabLeaves = false;
          return false;
        }
        if (intent === 'indent') this.indent();
        else this.outdent();
        return true;
      case 'escape':
        this.tabLeaves = true;
        return false;
      default:
        return false;
    }
  }

  /**
   * A `beforeinput` intent. Returns false for `composition` (the browser
   * keeps the DOM until `compositionend`) and for paste and drop (the surface
   * reads their data itself).
   */
  runInput(intent: EditorInputIntent, data: string | null = null): boolean {
    this.tabLeaves = false;
    if (this.composing || intent === 'composition') return false;
    const mark = MARK_INTENTS[intent];
    if (mark) {
      this.toggleMark(mark);
      return true;
    }
    const selection = this.state.selection;
    const range = selection.kind === 'node' || !isCollapsed(selection);
    // The six directional deletes: delete-[word-|line-](back|for)ward.
    if (intent.endsWith('ward')) {
      const unit = intent.includes('word') ? 'word' : intent.includes('line') ? 'line' : 'grapheme';
      const result = range
        ? deleteSelection(this.state, this.transform)
        : intent.endsWith('forward')
          ? deleteForward(this.state, unit, this.transform)
          : deleteBackward(this.state, unit, this.transform);
      this.apply(result, 'deletion');
      return true;
    }
    switch (intent) {
      case 'insert-text':
      case 'replace-text':
        if (data) this.insertText(data);
        return true;
      case 'split-block':
        this.apply(splitBlock(this.state, this.transform));
        return true;
      case 'insert-break':
        this.apply(insertBreak(this.state, this.transform), 'typing');
        return true;
      case 'delete-selection':
        this.apply(deleteSelection(this.state, this.transform), 'deletion');
        return true;
      case 'undo':
        this.undo();
        return true;
      case 'redo':
        this.redo();
        return true;
      default:
        return false;
    }
  }

  // ── composition (input methods) ──────────────────────────────────────

  compositionStart(): void {
    this.composing = true;
  }

  /**
   * The input method finished: diff the block's DOM text against the model
   * as one typing step, then re-render the block from the model.
   */
  compositionEnd(block: EditorBlockId | null, domText: string | null): boolean {
    this.composing = false;
    if (block === null || domText === null) return false;
    return this.syncFromDom(block, domText);
  }

  /** Apply what the browser wrote into a block (composition, or an input that could not be canceled). */
  syncFromDom(block: EditorBlockId, domText: string): boolean {
    const result = applyComposition(this.state, block, domText, this.transform);
    const epochs = new Map(this.epochs);
    epochs.set(block, (epochs.get(block) ?? 0) + 1);
    this.epochs = epochs;
    if (!result.ok && result.errors[0]?.code === 'nothing-to-do') return false;
    return this.apply(result, 'typing');
  }
}

/** A headless editor controller over the core texels. */
export const createEditorController = (options?: EditorControllerOptions): EditorController =>
  new EditorController(options);
