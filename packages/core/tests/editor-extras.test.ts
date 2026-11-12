// @vitest-environment node
/**
 * PLAN_023 T-cmp-editor in the core editor texels: the one-step block-kind transform (row 12),
 * the `:shortcode:` input rule seam (row 9), the tree projection used by HTML paste (row 10)
 * and the "Paste as Markdown" chord.
 */
import { describe, expect, it } from 'vitest';
import { applyInputRules, blockKindAt, insertText, setBlockKind } from '../src/editor/edit.ts';
import { createEditorKeymap } from '../src/editor/keymap.ts';
import { fromMarkdown, fromMarkdownTree, toMarkdown } from '../src/editor/markdown.ts';
import {
  caret,
  createEditorIds,
  type EditorState,
  editorLeaves,
  isTextBlock,
} from '../src/editor/model.ts';
import { htmlToMarkdownTree } from '../src/html/index.ts';

function md(source: string): EditorState {
  const { doc } = fromMarkdown(source, { newId: createEditorIds('b'), trust: 'developer' });
  const first = editorLeaves(doc).find(({ block }) => isTextBlock(block))?.block;
  return { doc, selection: caret(first?.id ?? 'none') };
}

const at = (state: EditorState, n: number, offset = 0): EditorState => ({
  ...state,
  selection: caret(editorLeaves(state.doc)[n]?.block.id as string, offset),
});

const write = (state: EditorState) => toMarkdown(state.doc).trim();

function kind(state: EditorState, choice: Parameters<typeof setBlockKind>[1]): EditorState {
  const result = setBlockKind(state, choice, { newId: createEditorIds('n') });
  if (!result.ok) throw new Error(result.errors.map((e) => e.code).join());
  return result.state;
}

describe('setBlockKind (block-type menu)', () => {
  it('sets every kind from a paragraph', () => {
    const base = md('Text');
    expect(write(kind(base, 'heading-2'))).toBe('## Text');
    expect(write(kind(base, 'heading-4'))).toBe('#### Text');
    expect(write(kind(base, 'bullet'))).toBe('- Text');
    expect(write(kind(base, 'ordered'))).toBe('1. Text');
    expect(write(kind(base, 'todo'))).toBe('- [ ] Text');
    expect(write(kind(base, 'quote'))).toBe('> Text');
    expect(write(kind(base, 'code'))).toBe('```\nText\n```');
  });

  it('leaves nested lists and quotes in one step for a plain block', () => {
    const nested = at(md('- a\n  - b'), 1);
    expect(blockKindAt(nested)).toBe('bullet');
    expect(write(kind(nested, 'paragraph'))).toBe('- a\n\nb');
    const quoted = md('> q');
    expect(blockKindAt(quoted)).toBe('quote');
    expect(write(kind(quoted, 'heading-1'))).toBe('# q');
  });

  it('changes a list kind in place and turns code into a list item', () => {
    expect(write(kind(md('- a\n- b'), 'todo'))).toBe('- [ ] a\n- [ ] b');
    expect(write(kind(md('```\nx\n```'), 'bullet'))).toBe('- x');
    expect(write(kind(md('## h'), 'ordered'))).toBe('1. h');
  });

  it('reports nothing to do for the current kind and refuses what cannot be set', () => {
    const same = setBlockKind(md('## h'), 'heading-2');
    expect(same.ok).toBe(false);
    if (!same.ok) expect(same.errors[0]?.code).toBe('nothing-to-do');
    const divider = { ...md('a\n\n---'), selection: { kind: 'node', block: 'x' } } as never;
    expect(setBlockKind(divider, 'paragraph').ok).toBe(false);
  });

  it('reads the kind at the caret: list, then quote, then the block', () => {
    expect(blockKindAt(md('# h'))).toBe('heading-1');
    expect(blockKindAt(md('```\nc\n```'))).toBe('code');
    expect(blockKindAt(md('> - x'))).toBe('bullet');
    expect(blockKindAt(md('plain'))).toBe('paragraph');
  });
});

describe(':shortcode: input rule (the emoji seam)', () => {
  const lookup = (name: string) => ({ smile: '😄', thumbs_up: '👍' })[name];
  const type = (text: string, shortcodes = lookup) => {
    let state = md('x');
    state = {
      ...state,
      doc: { version: 1, blocks: [{ id: 'p', type: 'paragraph', content: [] }] },
      selection: caret('p', 0),
    };
    const typed = insertText(state, text);
    if (!typed.ok) throw new Error('insert');
    return applyInputRules(typed.state, { shortcodes });
  };

  it('replaces a known :name: with its text and puts the caret after it', () => {
    const result = type('hi :smile:');
    expect(result?.ok).toBe(true);
    if (result?.ok) {
      expect(write(result.state)).toBe('hi 😄');
      expect(result.state.selection).toMatchObject({ focus: { offset: 3 + '😄'.length } });
    }
    const upper = type(':THUMBS_UP:');
    expect(upper?.ok && write(upper.state)).toBe('👍');
  });

  it('leaves unknown names, glued words, escapes, code and missing lookups alone', () => {
    expect(type('hi :nope:')).toBeNull();
    expect(type('time:smile:')).toBeNull();
    expect(type('a\\:smile:')).toBeNull();
    expect(type(':smile:', (() => undefined) as never)).toBeNull();
    // Without a lookup the rule does not run at all.
    const plain = md('x');
    expect(
      applyInputRules({
        ...plain,
        doc: {
          version: 1,
          blocks: [
            { id: 'p', type: 'paragraph', content: [{ type: 'text', text: ':smile:', marks: [] }] },
          ],
        },
        selection: caret('p', 7),
      })
    ).toBeNull();
    const code = md('`x` ');
    const inCode = {
      ...code,
      doc: {
        version: 1 as const,
        blocks: [
          {
            id: 'c',
            type: 'paragraph' as const,
            content: [
              { type: 'text' as const, text: ':smile:', marks: [{ type: 'code' as const }] },
            ],
          },
        ],
      },
      selection: caret('c', 7),
    };
    expect(applyInputRules(inCode, { shortcodes: lookup })).toBeNull();
  });

  it('refuses a lookup that throws or returns something that is not a short single line', () => {
    expect(
      type(':smile:', () => {
        throw new Error('boom');
      })
    ).toBeNull();
    expect(type(':smile:', () => 'x'.repeat(33))).toBeNull();
    expect(type(':smile:', () => 'a\nb')).toBeNull();
    expect(type(':smile:', () => '')).toBeNull();
  });
});

describe('fromMarkdownTree (HTML paste projection)', () => {
  const paste = (html: string) =>
    fromMarkdownTree(htmlToMarkdownTree(html, { trust: 'untrusted' }).tree, {
      trust: 'untrusted',
      images: 'text',
      newId: createEditorIds('h'),
    });

  it('maps the HTML vocabulary onto the editor and clamps headings', () => {
    const { doc, diagnostics } = paste(
      '<h1>T</h1><h6>deep</h6><p><b>b</b> <i>i</i> <s>s</s> <code>c</code> <a href="https://example.com/">l</a></p><ul><li><input type=checkbox checked> done</li></ul><blockquote><p>q</p></blockquote><pre><code class="language-js">x</code></pre><hr>'
    );
    expect(toMarkdown(doc).trim()).toBe(
      '# T\n\n#### deep\n\n**b** *i* ~~s~~ `c` [l](https://example.com/)\n\n- [x] done\n\n> q\n\n```js\nx\n```\n\n---'
    );
    expect(diagnostics.map((d) => d.code)).toContain('heading-clamped');
  });

  it('keeps an image as its alt text, cells, footnotes and mentions as text', () => {
    const { doc } = paste(
      '<p><img src="https://example.com/a.png" alt="A cat"></p><table><tr><td>one</td><td>two</td></tr></table><p><span data-mention="user" data-mention-id="U1">@Ada</span></p>'
    );
    expect(toMarkdown(doc).trim()).toBe('A cat\n\none\n\ntwo\n\n@Ada');
  });

  it('unwraps nesting past the depth cap and reports it', () => {
    const { doc, diagnostics } = paste(`${'<blockquote>'.repeat(8)}deep`);
    expect(JSON.stringify(doc)).toContain('deep');
    expect(diagnostics.map((d) => d.code)).toContain('depth-capped');
  });

  it('turns private-use placeholder characters into U+FFFD, never into syntax', () => {
    const { doc } = paste('<p>ab</p>');
    expect(toMarkdown(doc).trim()).toBe('a�b');
  });

  it('never throws on a malformed tree', () => {
    expect(() => fromMarkdownTree(null as never)).not.toThrow();
    expect(() => fromMarkdownTree({ type: 'root' } as never)).not.toThrow();
  });
});

describe('"Paste as Markdown" chord', () => {
  it('is Mod+Alt+Shift+V on every platform', () => {
    const mac = createEditorKeymap('mac');
    const other = createEditorKeymap('other');
    expect(
      mac.match({ key: 'V', metaKey: true, altKey: true, shiftKey: true, ctrlKey: false })
    ).toBe('paste-markdown');
    expect(
      other.match({ key: 'V', ctrlKey: true, altKey: true, shiftKey: true, metaKey: false })
    ).toBe('paste-markdown');
    expect(
      other.match({ key: 'v', ctrlKey: true, altKey: false, shiftKey: false, metaKey: false })
    ).toBeNull();
  });
});
