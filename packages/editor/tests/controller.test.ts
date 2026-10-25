import { intentFromInputType } from '@texuli/core/editor-keymap';
import { fromMarkdown, toMarkdown } from '@texuli/core/editor-markdown';
import {
  caret,
  createEditorIds,
  type EditorDocument,
  editorLeaves,
  textSelection,
  validateEditorDocument,
} from '@texuli/core/editor-model';
import { describe, expect, it, vi } from 'vitest';
import { EditorController } from '../src/controller/index.ts';

function setup(
  markdown = 'Hello',
  options: ConstructorParameters<typeof EditorController>[0] = {}
) {
  const newId = createEditorIds('c');
  const { doc } = fromMarkdown(markdown, { newId });
  let clock = 0;
  const announce = vi.fn();
  const onChange = vi.fn();
  const editor = new EditorController({
    doc,
    newId,
    announce,
    onChange,
    now: () => (clock += 1_000),
    ...options,
  });
  const first = () => editorLeaves(editor.doc)[0]?.block.id as string;
  return { editor, announce, onChange, first, md: () => toMarkdown(editor.doc) };
}

const clipboard = (types: Record<string, string>) => ({
  getData: (type: string) => types[type] ?? '',
});

describe('EditorController commands', () => {
  it('types, splits, deletes and undoes through beforeinput intents', () => {
    const { editor, first, md, onChange } = setup('Hello');
    editor.select(caret(first(), 5));
    expect(editor.runInput('insert-text', ' world')).toBe(true);
    expect(md()).toBe('Hello world');
    editor.runInput('split-block');
    editor.runInput('insert-text', 'Next');
    expect(md()).toBe('Hello world\n\nNext');
    editor.runInput('delete-backward');
    expect(md()).toBe('Hello world\n\nNex');
    editor.runInput('delete-word-backward');
    expect(md()).toBe('Hello world');
    expect(onChange).toHaveBeenCalled();
    expect(editor.undo()).toBe(true);
    expect(md()).toBe('Hello world\n\nNex');
    expect(editor.redo()).toBe(true);
    expect(md()).toBe('Hello world');
  });

  it('maps every key intent to a transform and announces mark and block changes', () => {
    const { editor, first, md, announce } = setup('Title');
    const id = first();
    editor.select(textSelection({ block: id, offset: 0 }, { block: id, offset: 5 }));
    expect(editor.runKey('toggle-strong')).toBe(true);
    expect(md()).toBe('**Title**');
    expect(editor.active.marks.has('strong')).toBe(true);
    editor.runKey('heading-2');
    expect(md()).toBe('## **Title**');
    expect(announce).toHaveBeenLastCalledWith('Heading 2');
    editor.select(caret(id, 5));
    editor.runKey('toggle-em');
    expect(announce).toHaveBeenLastCalledWith('Italic on');
    editor.runKey('toggle-em');
    expect(announce).toHaveBeenLastCalledWith('Italic off');
    editor.runKey('paragraph');
    editor.runKey('bullet-list');
    expect(editor.active.list).toBe('bullet');
    expect(md()).toBe('- **Title**');
    editor.runKey('todo-list');
    editor.runKey('toggle-todo');
    expect(md()).toBe('- [x] **Title**');
    expect(validateEditorDocument(editor.doc)).toEqual([]);
    const quoted = setup('Said');
    quoted.editor.select(caret(quoted.first(), 1));
    quoted.editor.runKey('quote');
    expect(quoted.editor.active.quote).toBe(true);
    expect(quoted.md()).toBe('> Said');
  });

  it('lets Tab move focus outside lists and after Escape', () => {
    const { editor, first } = setup('- one\n- two');
    const leaves = editorLeaves(editor.doc);
    const second = leaves[1]?.block.id as string;
    editor.select(caret(second, 0));
    expect(editor.runKey('indent')).toBe(true);
    expect(editor.runKey('outdent')).toBe(true);
    expect(editor.runKey('escape')).toBe(false);
    expect(editor.runKey('indent')).toBe(false);
    editor.select(caret(first(), 0));
    const plain = setup('Plain');
    plain.editor.select(caret(plain.first(), 0));
    expect(plain.editor.runKey('indent')).toBe(false);
  });

  it('runs input rules as their own undo step', () => {
    const { editor, first, md } = setup('');
    editor.select(caret(first(), 0));
    editor.runInput('insert-text', '#');
    editor.runInput('insert-text', ' ');
    expect(md()).toBe('#');
    expect(editor.active.block).toEqual({ type: 'heading', level: 1 });
    editor.undo();
    expect(editor.active.block).toEqual({ type: 'paragraph' });
  });

  it('announces refusals without throwing', () => {
    const { editor, first, announce } = setup('x', { limits: { chars: 3 } });
    editor.select(caret(first(), 1));
    editor.runInput('insert-text', 'too long');
    expect(editor.errors[0]?.code).toBe('limit-reached');
    expect(announce).toHaveBeenLastCalledWith('The document is full.');
  });
});

describe('IME composition never mutates the model mid-composition', () => {
  it('ignores input while composing and applies the composed text once at compositionend', () => {
    const { editor, first, md, onChange } = setup('Hi');
    const id = first();
    editor.select(caret(id, 2));
    const before = editor.doc;
    editor.compositionStart();
    // The browser sends composition beforeinput events and even stray intents.
    expect(
      editor.runInput(intentFromInputType('insertCompositionText') ?? 'composition', 'k')
    ).toBe(false);
    expect(editor.runInput('insert-text', 'ka')).toBe(false);
    expect(editor.runInput('split-block')).toBe(false);
    expect(editor.doc).toBe(before);
    expect(onChange).not.toHaveBeenCalled();
    expect(editor.compositionEnd(id, 'Hiかな')).toBe(true);
    expect(md()).toBe('Hiかな');
    expect(editor.epoch(id)).toBe(1);
    expect(editor.composing).toBe(false);
    editor.undo();
    expect(md()).toBe('Hi');
  });

  it('a cancelled composition changes nothing but still re-renders the block', () => {
    const { editor, first, md } = setup('Hi');
    editor.compositionStart();
    expect(editor.compositionEnd(first(), 'Hi')).toBe(false);
    expect(md()).toBe('Hi');
    expect(editor.epoch(first())).toBe(1);
  });
});

describe('paste and links go through the URL policy', () => {
  it('pastes as untrusted even when the editor trusts developer links (fails without the guard)', () => {
    const { editor, first, md, announce } = setup('', { trust: 'developer' });
    editor.select(caret(first(), 0));
    editor.paste(
      clipboard({
        'text/html':
          '<p><a href="http://example.com">plain</a> <a href="javascript:alert(1)">js</a> <a href="https://example.com/a">ok</a></p><p>two</p>',
      })
    );
    expect(md()).toBe('plain js [ok](https://example.com/a)\n\ntwo');
    expect(announce).toHaveBeenLastCalledWith('Pasted 2 blocks; 2 links removed');
    // The developer tier still applies to links the author types.
    editor.select(textSelection({ block: first(), offset: 0 }, { block: first(), offset: 5 }));
    expect(editor.setLink('http://example.com').ok).toBe(true);
  });

  it('refuses unsafe typed links and keeps the document (fails without the guard)', () => {
    const { editor, first, md, announce } = setup('click');
    const id = first();
    editor.select(textSelection({ block: id, offset: 0 }, { block: id, offset: 5 }));
    for (const href of [
      'javascript:alert(1)',
      'data:text/html,x',
      'http://example.com',
      '//evil.example',
    ]) {
      const result = editor.setLink(href);
      expect(result.ok).toBe(false);
      expect(md()).toBe('click');
    }
    expect(announce).toHaveBeenLastCalledWith('That link is not allowed.');
    expect(editor.setLink('https://example.com').ok).toBe(true);
    expect(md()).toBe('[click](https://example.com)');
    expect(editor.active.link).toBe('https://example.com');
    editor.select(caret(id, 2));
    expect(editor.removeLink()).toBe(true);
    expect(md()).toBe('click');
  });

  it('inserts linked text at a caret and pastes the editor clipboard', () => {
    const { editor, first, md } = setup('a');
    editor.select(caret(first(), 1));
    editor.setLink('mailto:team@example.com', ' mail');
    expect(md()).toBe('a[ mail](mailto:team@example.com)');
    const own: EditorDocument = { version: 1, blocks: [{ id: 'x', type: 'divider' }] };
    editor.paste(clipboard({ 'application/x-texuli-editor+json': JSON.stringify(own) }));
    expect(editor.doc.blocks.some((b) => b.type === 'divider')).toBe(true);
  });
});
