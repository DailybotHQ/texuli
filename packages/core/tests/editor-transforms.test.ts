import { describe, expect, it } from 'vitest';
import {
  applyComposition,
  applyInputRules,
  deleteBackward,
  deleteForward,
  deleteSelection,
  insertBlock,
  insertBreak,
  insertText,
  liftListItem,
  moveBlock,
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
} from '../src/editor/edit.ts';
import { createEditorHistory, editorHistoryReducer } from '../src/editor/history.ts';
import { fromMarkdown, toMarkdown } from '../src/editor/markdown.ts';
import {
  caret,
  createEditorIds,
  type EditorState,
  type EditorTransformResult,
  editorLeaves,
  isTextBlock,
  nodeSelection,
  textSelection,
  validateEditorDocument,
} from '../src/editor/model.ts';

/** A state from Markdown, with ids b1, b2… in document order of creation. */
function md(source: string): EditorState {
  const { doc } = fromMarkdown(source, { newId: createEditorIds('b'), trust: 'developer' });
  const first = editorLeaves(doc).find(({ block }) => isTextBlock(block))?.block;
  return { doc, selection: caret(first?.id ?? 'none') };
}

/** The id of the n-th leaf (0-based) in document order. */
const leaf = (state: EditorState, n: number) => editorLeaves(state.doc)[n]?.block.id as string;

const at = (state: EditorState, n: number, offset: number): EditorState => ({
  ...state,
  selection: caret(leaf(state, n), offset),
});
const span = (state: EditorState, a: [number, number], b: [number, number]): EditorState => ({
  ...state,
  selection: textSelection(
    { block: leaf(state, a[0]), offset: a[1] },
    { block: leaf(state, b[0]), offset: b[1] }
  ),
});

function ok(result: EditorTransformResult): EditorState {
  if (!result.ok) throw new Error(`refused: ${result.errors.map((e) => e.code).join()}`);
  expect(validateEditorDocument(result.state.doc)).toEqual([]);
  return result.state;
}

const text = (state: EditorState) => toMarkdown(state.doc);
const ids = () => ({ newId: createEditorIds('n') });

describe('typing', () => {
  it('inserts text with the marks before the caret and moves the caret', () => {
    const state = ok(insertText(at(md('**bold** plain'), 0, 4), 'er', ids()));
    expect(text(state)).toBe('**bolder** plain');
    expect(state.selection).toEqual(caret(leaf(state, 0), 6));
  });

  it('uses stored marks after a toggle at a caret, then clears them', () => {
    const toggled = ok(toggleMark(at(md('ab'), 0, 1), 'strong'));
    expect(toggled.storedMarks).toEqual([{ type: 'strong' }]);
    const typed = ok(insertText(toggled, 'X'));
    expect(text(typed)).toBe('a**X**b');
    expect(typed.storedMarks).toBeNull();
  });

  it('replaces a range across blocks and strips unsafe characters', () => {
    const result = insertText(span(md('first\n\nsecond\n\nthird'), [0, 2], [2, 3]), 'X\u202E');
    const state = ok(result);
    expect(text(state)).toBe('fiXrd');
    expect(result.ok && result.diagnostics?.[0]?.code).toBe('characters-stripped');
  });

  it('turns newlines into breaks in rich text and keeps them in code', () => {
    expect(text(ok(insertText(at(md('ab'), 0, 1), '1\n2')))).toBe('a1\\\n2b');
    expect(text(ok(insertText(at(md('```\nab\n```'), 0, 1), '\t\n')))).toBe('```\na\t\nb\n```');
  });

  it('refuses text past the character cap', () => {
    const result = insertText(at(md('abc'), 0, 3), 'de', { limits: { chars: 4 } });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors[0]?.code).toBe('limit-reached');
  });

  it('replaces a selected void block with a paragraph', () => {
    const state = md('a\n\n---\n\nb');
    const typed = ok(insertText({ ...state, selection: nodeSelection(leaf(state, 1)) }, 'x'));
    expect(text(typed)).toBe('a\n\nx\n\nb');
  });
});

describe('Enter', () => {
  it('splits paragraphs and keeps marks on both halves', () => {
    const state = ok(splitBlock(at(md('**abcd**'), 0, 2), ids()));
    expect(text(state)).toBe('**ab**\n\n**cd**');
    expect(state.selection).toEqual(caret(leaf(state, 1), 0));
  });

  it('continues lists and leaves them from an empty item', () => {
    const next = ok(splitBlock(at(md('- one'), 0, 3), ids()));
    expect(text(next)).toBe('- one\n- ');
    const out = ok(splitBlock(next, ids()));
    expect(text(out)).toBe('- one');
    expect(out.doc.blocks.map((b) => b.type)).toEqual(['list', 'paragraph']);
    const todo = ok(splitBlock(at(md('- [x] done'), 0, 4), ids()));
    expect(text(todo)).toBe('- [x] done\n- [ ] ');
  });

  it('outdents an empty nested item one level', () => {
    const state = ok(splitBlock(at(md('- a\n    - b'), 1, 1), ids()));
    const lifted = ok(splitBlock(state, ids()));
    expect(text(lifted)).toBe('- a\n\n    - b\n- ');
  });

  it('starts a paragraph after a heading, and leaves a quote from its empty last paragraph', () => {
    expect(ok(splitBlock(at(md('# Title'), 0, 5), ids())).doc.blocks.map((b) => b.type)).toEqual([
      'heading',
      'paragraph',
    ]);
    const before = ok(splitBlock(at(md('# Title'), 0, 0), ids()));
    expect(before.doc.blocks.map((b) => b.type)).toEqual(['paragraph', 'heading']);
    expect(before.selection).toEqual(caret(leaf(before, 1), 0));
    const quoted = ok(splitBlock(at(md('> quote'), 0, 5), ids()));
    const left = ok(splitBlock(quoted, ids()));
    expect(left.doc.blocks.map((b) => b.type)).toEqual(['quote', 'paragraph']);
  });

  it('adds newlines in code and leaves it from an empty last line', () => {
    const once = ok(splitBlock(at(md('```\nx\n```'), 0, 1), ids()));
    expect(text(once)).toBe('```\nx\n\n```');
    const out = ok(splitBlock(once, ids()));
    expect(text(out)).toBe('```\nx\n```');
    expect(out.doc.blocks.map((b) => b.type)).toEqual(['code', 'paragraph']);
  });

  it('puts a hard break on Shift+Enter', () => {
    expect(text(ok(insertBreak(at(md('ab'), 0, 1))))).toBe('a\\\nb');
  });
});

describe('Backspace and Delete', () => {
  it('deletes graphemes, words and lines', () => {
    expect(text(ok(deleteBackward(at(md('a👨\u200d👩\u200d👧'), 0, 9))))).toBe('a');
    const flag = '🇨🇴';
    expect(text(ok(deleteBackward(at(md(`a${flag}`), 0, 1 + flag.length))))).toBe('a');
    expect(text(ok(deleteForward(at(md(`a${flag}b`), 0, 1))))).toBe('ab');
    expect(text(ok(deleteBackward(at(md('one two'), 0, 7), 'word')))).toBe('one');
    expect(text(ok(deleteForward(at(md('one two'), 0, 0), 'word')))).toBe('two');
    const line = ok(deleteBackward(at(md('ab\\\ncd'), 0, 5), 'line'));
    expect(line.doc.blocks[0]).toMatchObject({
      content: [{ type: 'text', text: 'ab' }, { type: 'break' }],
    });
  });

  it('lifts headings, code, list items and quotes at their start before joining', () => {
    expect(ok(deleteBackward(at(md('a\n\n# b'), 1, 0))).doc.blocks.map((b) => b.type)).toEqual([
      'paragraph',
      'paragraph',
    ]);
    expect(ok(deleteBackward(at(md('```\nx\n```'), 0, 0))).doc.blocks.map((b) => b.type)).toEqual([
      'paragraph',
    ]);
    expect(text(ok(deleteBackward(at(md('- a\n- b'), 1, 0), 'grapheme', ids())))).toBe('- a\n\nb');
    expect(text(ok(deleteBackward(at(md('> a\n>\n> b'), 0, 0))))).toBe('a\n\n> b');
    const joined = ok(deleteBackward(at(md('one\n\ntwo'), 1, 0)));
    expect(text(joined)).toBe('onetwo');
    expect(joined.selection).toEqual(caret(leaf(joined, 0), 3));
  });

  it('selects a void block first, then deletes it', () => {
    const selected = ok(deleteBackward(at(md('a\n\n---\n\nb'), 2, 0)));
    expect(selected.selection).toEqual(nodeSelection(leaf(selected, 1)));
    const removed = ok(deleteBackward(selected));
    expect(text(removed)).toBe('a\n\nb');
    expect(removed.selection).toEqual(caret(leaf(removed, 0), 1));
    expect(ok(deleteForward(at(md('a\n\n---'), 0, 1))).selection.kind).toBe('node');
  });

  it('refuses at the document edges', () => {
    expect(deleteBackward(at(md('a'), 0, 0)).ok).toBe(false);
    expect(deleteForward(at(md('a'), 0, 1)).ok).toBe(false);
    expect(deleteSelection(at(md('a'), 0, 0)).ok).toBe(false);
  });

  it('handles editing commands from an empty document', () => {
    const empty = md('');
    expect(deleteBackward(empty).ok).toBe(false);
    expect(deleteForward(empty).ok).toBe(false);
    expect(ok(splitBlock(empty, ids())).doc.blocks).toHaveLength(2);
    expect(ok(toggleMark(empty, 'strong')).storedMarks).toEqual([{ type: 'strong' }]);
  });

  it('deletes ranges across containers and prunes emptied ones', () => {
    const state = ok(
      deleteSelection(span(md('start\n\n> q1\n>\n> q2\n\n- i1\n- i2\n\nend'), [0, 2], [4, 1]))
    );
    expect(text(state)).toBe('st2\n\nend');
  });
});

describe('block types, lists and quotes', () => {
  it('sets block types and keeps a list item first block a paragraph', () => {
    expect(text(ok(setBlockType(at(md('x'), 0, 0), 'heading', 3)))).toBe('### x');
    expect(text(ok(setBlockType(at(md('a\\\nb'), 0, 0), 'code')))).toBe('```\na\nb\n```');
    expect(setBlockType(at(md('- x'), 0, 0), 'heading', 2).ok).toBe(false);
    expect(setBlockType(at(md('x'), 0, 0), 'paragraph').ok).toBe(false);
  });

  it('wraps, retypes and unwraps lists', () => {
    const wrapped = ok(toggleList(span(md('a\n\nb'), [0, 0], [1, 0]), 'bullet', ids()));
    expect(text(wrapped)).toBe('- a\n- b');
    const ordered = ok(toggleList(wrapped, 'ordered'));
    expect(text(ordered)).toBe('1. a\n2. b');
    const todo = ok(toggleList(ordered, 'todo'));
    expect(text(todo)).toBe('- [ ] a\n- [ ] b');
    expect(text(ok(toggleTodo(todo)))).toBe('- [ ] a\n- [x] b');
    expect(text(ok(toggleList(todo, 'todo', ids())))).toBe('a\n\n- [ ] b');
    expect(toggleList(at(md('---'), 0, 0), 'bullet').ok).toBe(false);
  });

  it('indents and outdents list items', () => {
    const state = at(md('- a\n- b\n- c'), 1, 0);
    const sunk = ok(sinkListItem(state, ids()));
    expect(text(sunk)).toBe('- a\n\n    - b\n- c');
    expect(sinkListItem(at(md('- a'), 0, 0)).ok).toBe(false);
    expect(text(ok(liftListItem(sunk, ids())))).toBe('- a\n- b\n- c');
    expect(liftListItem(at(md('a'), 0, 0)).ok).toBe(false);
  });

  it('keeps nesting within the depth cap', () => {
    const deep = md('- a\n    - b\n        - c\n            - d\n            - e');
    const refused = sinkListItem(at(deep, 4, 0), ids());
    expect(!refused.ok && refused.errors[0]?.code).toBe('depth-capped');
  });

  it('wraps and unwraps quotes', () => {
    const quoted = ok(toggleQuote(span(md('a\n\nb'), [0, 0], [1, 0])));
    expect(text(quoted)).toBe('> a\n>\n> b');
    expect(text(ok(toggleQuote(quoted)))).toBe('a\n\nb');
  });

  it('moves blocks and items', () => {
    expect(text(ok(moveBlock(at(md('a\n\nb'), 1, 0), 'up')))).toBe('b\n\na');
    expect(text(ok(moveBlock(at(md('- a\n- b'), 0, 0), 'down')))).toBe('- b\n- a');
    expect(moveBlock(at(md('a'), 0, 0), 'up').ok).toBe(false);
  });

  it('inserts dividers and media references', () => {
    expect(text(ok(insertBlock(at(md('ab'), 0, 1), { type: 'divider' }, ids())))).toBe(
      'a\n\n---\n\nb'
    );
    const media = ok(
      insertBlock(at(md('ab'), 0, 2), { type: 'media', ref: 'asset-1', alt: 'A chart' }, ids())
    );
    expect(text(media)).toBe('ab\n\n![A chart](asset-1)');
    expect(insertBlock(at(md('```\nx\n```'), 0, 0), { type: 'divider' }).ok).toBe(false);
    expect(insertBlock(at(md('a'), 0, 0), { type: 'media', ref: ' ' }).ok).toBe(false);
  });
});

describe('marks and links', () => {
  it('toggles a mark over a range across blocks, and code excludes other marks', () => {
    const bold = ok(toggleMark(span(md('ab\n\ncd'), [0, 1], [1, 1]), 'strong'));
    expect(text(bold)).toBe('a**b**\n\n**c**d');
    expect(text(ok(toggleMark(bold, 'strong')))).toBe('ab\n\ncd');
    const code = ok(toggleMark(span(md('**ab**'), [0, 0], [0, 2]), 'code'));
    expect(text(code)).toBe('`ab`');
    expect(toggleMark(span(code, [0, 0], [0, 2]), 'strong').ok).toBe(false);
    expect(toggleMark(at(md('```\nx\n```'), 0, 0), 'em').ok).toBe(false);
  });

  it('links only what the URL policy accepts', () => {
    const linked = ok(setLink(span(md('see docs'), [0, 4], [0, 8]), 'https://example.com/docs'));
    expect(text(linked)).toBe('see [docs](https://example.com/docs)');
    const refused = setLink(span(md('x'), [0, 0], [0, 1]), 'javascript:alert(1)');
    expect(!refused.ok && refused.errors[0]?.code).toBe('link-rejected');
    expect(setLink(span(md('x'), [0, 0], [0, 1]), '/relative').ok).toBe(false);
    expect(setLink(span(md('x'), [0, 0], [0, 1]), '/relative', { trust: 'developer' }).ok).toBe(
      true
    );
  });

  it('updates and removes the link around a caret, and inserts linked text', () => {
    const state = at(md('[docs](https://example.com/a) more'), 0, 2);
    expect(text(ok(setLink(state, 'https://example.com/b')))).toBe(
      '[docs](https://example.com/b) more'
    );
    expect(text(ok(removeLink(state)))).toBe('docs more');
    expect(removeLink(at(md('plain'), 0, 1)).ok).toBe(false);
    expect(text(ok(setLink(at(md('ab'), 0, 1), 'https://example.com', { text: 'site' })))).toBe(
      'a[site](https://example.com)b'
    );
  });
});

describe('paste', () => {
  it('pastes one paragraph inline and several blocks around the caret', () => {
    const inline = ok(replaceSelection(at(md('ad'), 0, 1), fromMarkdown('**bc**').doc));
    expect(text(inline)).toBe('a**bc**d');
    expect(inline.selection).toEqual(caret(leaf(inline, 0), 3));
    const blocks = ok(
      replaceSelection(at(md('ad'), 0, 1), fromMarkdown('b\n\n- list\n\nc').doc, ids())
    );
    expect(text(blocks)).toBe('ab\n\n- list\n\ncd');
    expect(blocks.selection).toEqual(caret(leaf(blocks, 2), 1));
  });

  it('gives pasted blocks fresh ids, so the same fragment pastes twice', () => {
    const fragment = fromMarkdown('x\n\ny').doc;
    const once = ok(replaceSelection(at(md('ab'), 0, 1), fragment, ids()));
    const twice = ok(replaceSelection(once, fragment, { newId: createEditorIds('m') }));
    expect(validateEditorDocument(twice.doc)).toEqual([]);
  });

  it('flattens pasted nesting past the cap and cuts blocks past the size cap', () => {
    const deep = at(md('- a\n    - b\n        - c\n            - d'), 3, 1);
    const result = replaceSelection(deep, fromMarkdown('x\n\n- y\n\nz').doc, ids());
    const state = ok(result);
    expect(result.ok && result.diagnostics?.map((d) => d.code)).toContain('depth-capped');
    expect(text(state)).not.toContain('- y');
    const many = fromMarkdown(Array.from({ length: 40 }, (_, i) => `p${i}`).join('\n\n')).doc;
    const cut = replaceSelection(at(md('ab'), 0, 1), many, { ...ids(), limits: { blocks: 10 } });
    expect(cut.ok && cut.diagnostics?.map((d) => d.code)).toContain('limit-reached');
  });

  it('pastes plain text into code', () => {
    expect(
      text(ok(replaceSelection(at(md('```\nab\n```'), 0, 1), fromMarkdown('**x**\n\ny').doc)))
    ).toBe('```\nax\nyb\n```');
  });
});

describe('composition and input rules', () => {
  it('applies a composed span as one edit', () => {
    const state = at(md('ka'), 0, 2);
    const composed = ok(applyComposition(state, leaf(state, 0), 'kかa'));
    expect(text(composed)).toBe('kかa');
    expect(composed.selection).toEqual(caret(leaf(state, 0), 2));
    expect(applyComposition(state, leaf(state, 0), 'ka').ok).toBe(false);
    expect(text(ok(applyComposition(state, leaf(state, 0), 'k')))).toBe('k');
  });

  /** A paragraph holding exactly `raw`, with the caret at its end. */
  const typed = (raw: string): EditorState => ({
    doc: {
      version: 1,
      blocks: [{ id: 'p', type: 'paragraph', content: [{ type: 'text', text: raw, marks: [] }] }],
    },
    selection: caret('p', raw.length),
  });

  it('turns block prefixes into blocks', () => {
    expect(text(ok(applyInputRules(typed('## ')) as EditorTransformResult))).toBe('##');
    expect(ok(applyInputRules(typed('## ')) as EditorTransformResult).doc.blocks[0]).toMatchObject({
      type: 'heading',
      level: 2,
    });
    expect(ok(applyInputRules(typed('- ')) as EditorTransformResult).doc.blocks[0]?.type).toBe(
      'list'
    );
    const ordered = ok(applyInputRules(typed('3. ')) as EditorTransformResult);
    expect(ordered.doc.blocks[0]).toMatchObject({ type: 'list', kind: 'ordered', start: 3 });
    expect(ok(applyInputRules(typed('[x] ')) as EditorTransformResult).doc.blocks[0]).toMatchObject(
      { kind: 'todo', items: [{ checked: true }] }
    );
    expect(ok(applyInputRules(typed('> ')) as EditorTransformResult).doc.blocks[0]?.type).toBe(
      'quote'
    );
    expect(
      ok(applyInputRules(typed('```ts ')) as EditorTransformResult).doc.blocks[0]
    ).toMatchObject({ type: 'code', lang: 'ts' });
    expect(
      ok(applyInputRules(typed('---')) as EditorTransformResult).doc.blocks.map((b) => b.type)
    ).toEqual(['divider', 'paragraph']);
    expect(applyInputRules(typed('plain '))).toBeNull();
  });

  it('marks delimited text and autolinks typed URLs through the policy', () => {
    const bold = ok(applyInputRules(typed('a **b**')) as EditorTransformResult);
    expect(text(bold)).toBe('a **b**');
    expect(bold.selection).toEqual(caret(leaf(bold, 0), 3));
    expect(text(ok(applyInputRules(typed('`x`')) as EditorTransformResult))).toBe('`x`');
    expect(text(ok(applyInputRules(typed('~~x~~')) as EditorTransformResult))).toBe('~~x~~');
    expect(text(ok(applyInputRules(typed('*x*')) as EditorTransformResult))).toBe('*x*');
    expect(
      text(ok(applyInputRules(typed('go https://example.com ')) as EditorTransformResult))
    ).toBe('go [https://example.com](https://example.com)');
    expect(applyInputRules(typed('go javascript:alert(1) '))).toBeNull();
  });

  it('is its own undo step, so undo restores the typed characters', () => {
    let history = createEditorHistory(md(''));
    for (const [i, ch] of [...'## '].entries()) {
      history = editorHistoryReducer(history, {
        type: 'apply',
        result: insertText(history.present, ch),
        kind: 'typing',
        at: i * 10,
      });
    }
    const rule = applyInputRules(history.present) as EditorTransformResult;
    history = editorHistoryReducer(history, {
      type: 'apply',
      result: rule,
      kind: 'input-rule',
      at: 40,
    });
    expect(history.present.doc.blocks[0]?.type).toBe('heading');
    history = editorHistoryReducer(history, { type: 'undo' });
    expect(text(history.present)).toBe('\\##');
    history = editorHistoryReducer(history, { type: 'undo' });
    expect(text(history.present)).toBe('');
  });
});

describe('structural sharing', () => {
  it('keeps every untouched block identical', () => {
    const state = md('a\n\n> b\n\n- c\n- d');
    const next = ok(insertText(at(state, 0, 1), 'x'));
    expect(next.doc.blocks[1]).toBe(state.doc.blocks[1]);
    expect(next.doc.blocks[2]).toBe(state.doc.blocks[2]);
    expect(next.doc.blocks[0]).not.toBe(state.doc.blocks[0]);
  });
});

/** Deterministic PRNG (mulberry32). */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let x = Math.imul(s ^ (s >>> 15), 1 | s);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4_294_967_296;
  };
}

describe('seeded random edits', () => {
  it('keeps every accepted state valid across 1,500 random transforms', () => {
    const random = rng(20261025);
    const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T;
    const options = { newId: createEditorIds('r'), limits: { chars: 3_000, blocks: 300 } };
    let state = md(
      '# Start\n\nSome **bold** and [a link](https://example.com).\n\n- one\n- [two](https://example.com/2)\n\n> quoted\n\n```js\ncode\n```\n\n---'
    );
    let accepted = 0;
    for (let step = 0; step < 1_500; step += 1) {
      const leaves = editorLeaves(state.doc);
      const randomPoint = () => {
        const { block } = pick(leaves);
        const length = isTextBlock(block)
          ? block.type === 'code'
            ? block.text.length
            : block.content.reduce((n, c) => n + (c.type === 'text' ? c.text.length : 1), 0)
          : 0;
        return { block: block.id, offset: Math.floor(random() * (length + 1)) };
      };
      const roll = random();
      const base: EditorState =
        roll < 0.1 && leaves.some(({ block }) => !isTextBlock(block))
          ? {
              ...state,
              selection: nodeSelection(
                pick(leaves.filter(({ block }) => !isTextBlock(block))).block.id
              ),
            }
          : {
              ...state,
              selection:
                roll < 0.4
                  ? textSelection(randomPoint(), randomPoint())
                  : textSelection(randomPoint()),
            };
      const actions: (() => EditorTransformResult | null)[] = [
        () => insertText(base, pick(['a', ' ', 'é', '👍', 'word ', '\n', 'x\u202E'])),
        () => splitBlock(base, options),
        () => insertBreak(base, options),
        () => deleteBackward(base, pick(['grapheme', 'word', 'line'] as const), options),
        () => deleteForward(base, pick(['grapheme', 'word', 'line'] as const), options),
        () => deleteSelection(base, options),
        () => toggleMark(base, pick(['strong', 'em', 'strike', 'code'] as const), options),
        () => setLink(base, pick(['https://example.com/x', 'javascript:x']), options),
        () => removeLink(base, options),
        () =>
          setBlockType(
            base,
            pick(['paragraph', 'heading', 'code'] as const),
            pick([1, 2, 3, 4] as const),
            options
          ),
        () => toggleList(base, pick(['bullet', 'ordered', 'todo'] as const), options),
        () => toggleQuote(base, options),
        () => sinkListItem(base, options),
        () => liftListItem(base, options),
        () => toggleTodo(base, options),
        () => moveBlock(base, pick(['up', 'down'] as const), options),
        () =>
          insertBlock(
            base,
            pick([
              { type: 'divider' as const },
              { type: 'media' as const, ref: 'img-1', alt: 'alt' },
            ]),
            options
          ),
        () =>
          replaceSelection(
            base,
            fromMarkdown(pick(['pasted', 'a\n\n- b\n\nc', '> q\n\nz', '**x** y'])).doc,
            options
          ),
        () => applyInputRules(base, options),
      ];
      const result = pick(actions)();
      if (!result?.ok) continue;
      const issues = validateEditorDocument(result.state.doc);
      if (issues.length)
        throw new Error(
          `step ${step}: ${JSON.stringify(issues)}\n${JSON.stringify(result.state.doc)}`
        );
      expect(
        result.state.selection.kind === 'node' ||
          editorLeaves(result.state.doc).some(
            ({ block }) =>
              result.state.selection.kind === 'text' &&
              block.id === result.state.selection.focus.block
          )
      ).toBe(true);
      state = result.state;
      accepted += 1;
    }
    expect(accepted).toBeGreaterThan(600);
  });
});
