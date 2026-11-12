/**
 * PLAN_023 T-cmp-editor: HTML paste through `@texuli/core/html` and "Paste as Markdown"
 * (row 10), export to chat dialects (row 11), the block-type menu (row 12) and the
 * `:shortcode:` seam (row 9).
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { fromMarkdown, toMarkdown } from '@texuli/core/editor-markdown';
import { createEditorIds, type EditorDocument } from '@texuli/core/editor-model';
import { tick } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { BlockTypeMenu } from '../src/block-menu/index.ts';
import { EditorController } from '../src/controller/index.ts';
import { DialectExport } from '../src/export/index.ts';
import {
  documentToDialect,
  EDITOR_DIALECT_NAMES,
  EDITOR_EXPORT_DIALECTS,
  importMarkdown,
} from '../src/markdown/index.ts';
import { htmlToBlocks, importHtml, readClipboard, tokenizeHtml } from '../src/paste/index.ts';
import { EditorToolbar } from '../src/toolbar/index.ts';

afterEach(cleanup);

const doc = (source: string): EditorDocument =>
  fromMarkdown(source, { newId: createEditorIds('d'), trust: 'developer' }).doc;
const text = (d: EditorDocument) => toMarkdown(d).trim();
const clipboard = (data: Record<string, string>) => ({
  getData: (type: string) => data[type] ?? '',
});

describe('HTML paste through @texuli/core/html', () => {
  it('drops raw-text elements, handlers and styles, and keeps the vocabulary', () => {
    const pasted = importHtml(
      '<script>alert(1)</script><style>p{}</style><iframe src="https://example.com"></iframe>' +
        '<p onclick="x()" style="color:red"><b>bold</b> <a href="https://example.com/a">link</a></p>' +
        '<svg><text>hidden</text></svg><ol start="3"><li>three</li></ol>'
    );
    expect(pasted.source).toBe('html');
    expect(text(pasted.doc)).toBe('**bold** [link](https://example.com/a)\n\n3. three');
    expect(JSON.stringify(pasted.doc)).not.toMatch(/alert|onclick|color|hidden|iframe/);
  });

  it('counts refused links, keeps their text and reports link-rejected', () => {
    const pasted = importHtml(
      '<a href="javascript:alert(1)">js</a> <a href="http://example.com">http</a> <a href="&#106;avascript:x">ent</a>'
    );
    expect(text(pasted.doc)).toBe('js http ent');
    expect(pasted.linksRemoved).toBe(3);
    expect(pasted.diagnostics.map((d) => d.code)).toContain('link-rejected');
  });

  it('keeps table cells as paragraphs and mXSS shapes inert', () => {
    expect(text(importHtml('<table><tr><td>a</td><td>b</td></tr></table>').doc)).toBe('a\n\nb');
    const mxss = importHtml(
      '<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>' +
        '<noscript><p title="</noscript><img src=x onerror=alert(1)>">'
    );
    expect(JSON.stringify(mxss.doc)).not.toMatch(/onerror|alert/);
  });

  it('still exports the previous tokenizer for compatibility', () => {
    expect(tokenizeHtml('<b>x</b>').length).toBe(3);
    expect(htmlToBlocks('<p>x</p>').blocks.length).toBe(1);
  });
});

describe('Paste as Markdown', () => {
  it('reads Markdown only when asked; a plain paste stays plain', () => {
    const data = clipboard({ 'text/plain': '**bold** and [x](https://example.com)' });
    expect(text(readClipboard(data).doc)).toBe('\\*\\*bold\\*\\* and \\[x\\](https://example.com)');
    const asMarkdown = importMarkdown('**bold** and [x](https://example.com)');
    expect(asMarkdown.source).toBe('markdown');
    expect(text(asMarkdown.doc)).toBe('**bold** and [x](https://example.com)');
  });

  it('reads Markdown at the untrusted tier: raw HTML stays text, unsafe links are refused', () => {
    const pasted = importMarkdown('<b>x</b> [a](javascript:alert(1))');
    expect(JSON.stringify(pasted.doc)).not.toContain('javascript');
    expect(pasted.linksRemoved).toBe(1);
  });

  it('the controller loads the codec on demand and announces a Markdown paste', async () => {
    const said: string[] = [];
    const controller = new EditorController({ announce: (m) => said.push(m) });
    await controller.pasteMarkdown('- a\n- b');
    expect(text(controller.doc)).toBe('- a\n- b');
    expect(said.at(-1)).toBe('Pasted 1 block from Markdown');
  });
});

describe('export to chat dialects', () => {
  const source = doc(
    '# Plan\n\n**Bold** _em_ ~~old~~ [site](https://example.com) `code` @everyone @here\n\n- [x] done\n- [ ] todo\n\n> quoted\n\n```js\nx < 1\n```'
  );

  it('writes every format without throwing, with names for each', () => {
    for (const dialect of EDITOR_EXPORT_DIALECTS) {
      const { value } = documentToDialect(source, dialect);
      expect(value.length, dialect).toBeGreaterThan(0);
      expect(EDITOR_DIALECT_NAMES[dialect]).toBeTruthy();
    }
    expect(EDITOR_EXPORT_DIALECTS).toHaveLength(9);
  });

  it('never writes a live broadcast mention', () => {
    expect(documentToDialect(source, 'discord').value).toContain('@\u200beveryone');
    expect(documentToDialect(source, 'slack').value).toContain('@\u200bhere');
  });

  it('keeps checklist state as marks and reports what each format loses, grouped', () => {
    const slack = documentToDialect(source, 'slack');
    expect(slack.value).toContain('- ☑ done\n- ☐ todo');
    const messages = slack.losses.map((loss) => loss.message);
    expect(messages).toContain('Checklist items are written with ☑ and ☐ marks.');
    expect(messages).toContain('Headings are unsupported by this dialect.');
    expect(slack.losses.find((l) => l.message.startsWith('Checklist'))?.count).toBe(2);
    expect(documentToDialect(doc('plain words'), 'discord').losses).toEqual([]);
  });

  it('checks links again at the given tier', () => {
    const relative = doc('[docs](/docs/)');
    expect(documentToDialect(relative, 'discord').value).toBe('docs');
    expect(documentToDialect(relative, 'discord', { trust: 'developer' }).value).toBe(
      '[docs](/docs/)'
    );
  });
});

describe('controller commands', () => {
  it('setBlockKind is one undo step and is announced', () => {
    const said: string[] = [];
    const controller = new EditorController({
      doc: doc('- a\n  - b'),
      announce: (m) => said.push(m),
    });
    controller.select({
      kind: 'text',
      anchor: { block: 'd3', offset: 0 },
      focus: { block: 'd3', offset: 0 },
    } as never);
    const before = text(controller.doc);
    expect(controller.setBlockKind('heading-2')).toBe(true);
    expect(text(controller.doc)).not.toBe(before);
    expect(said.at(-1)).toBe('Heading 2');
    controller.undo();
    expect(text(controller.doc)).toBe(before);
  });

  it('runs the :shortcode: rule with the host lookup', () => {
    const controller = new EditorController({
      shortcodes: (name) => (name === 'tada' ? '🎉' : undefined),
    });
    controller.insertText('done :tada:');
    expect(text(controller.doc)).toBe('done 🎉');
    controller.undo();
    expect(text(controller.doc)).toBe('done :tada:');
  });
});

describe('BlockTypeMenu in the toolbar', () => {
  it('is a menu button in the toolbar whose radios set the block kind', async () => {
    const controller = new EditorController({ doc: doc('Hello') });
    render(EditorToolbar, { props: { controller, blockMenu: true } });
    const toolbar = screen.getByRole('toolbar');
    // The menu loads on demand.
    const trigger = await within(toolbar).findByRole('button', { name: 'Text style: Paragraph' });
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    // The block buttons give way to the menu; the divider stays.
    expect(within(toolbar).queryByRole('button', { name: 'Heading 1' })).toBeNull();
    expect(within(toolbar).getByRole('button', { name: 'Divider' })).toBeTruthy();
    await fireEvent.click(trigger);
    await tick();
    const menu = screen.getByRole('menu', { name: 'Text style: Paragraph' });
    const radios = within(menu).getAllByRole('menuitemradio');
    expect(
      radios.map((r) => r.textContent?.replace(/[●¶H1-4•.☑❝{}\s]+/g, ' ').trim())
    ).toHaveLength(10);
    expect(radios[0]?.getAttribute('aria-checked')).toBe('true');
    await fireEvent.click(within(menu).getByRole('menuitemradio', { name: /Heading 2/ }));
    await tick();
    expect(text(controller.doc)).toBe('## Hello');
    expect(trigger.getAttribute('aria-label')).toBe('Text style: Heading 2');
  });
});

describe('BlockTypeMenu standalone', () => {
  it('renders a plain menu button outside a toolbar', () => {
    render(BlockTypeMenu, {
      props: { controller: new EditorController({ doc: doc('# T') }), toolbarItem: false },
    });
    expect(
      screen.getByRole('button', { name: 'Text style: Heading 1' }).getAttribute('aria-haspopup')
    ).toBe('menu');
  });
});

describe('DialectExport', () => {
  it('shows the text, the losses and copies through the host', async () => {
    const controller = new EditorController({ doc: doc('# Title\n\nHello') });
    const copied: string[] = [];
    render(DialectExport, {
      props: {
        controller,
        onCopy: (value: string) => {
          copied.push(value);
          return true;
        },
      },
    });
    const region = screen.getByRole('region', { name: 'Export for chat' });
    const output = within(region).getByRole('textbox', {
      name: 'Slack text',
    }) as HTMLTextAreaElement;
    expect(output.readOnly).toBe(true);
    expect(output.value).toBe('Title\n\nHello');
    expect(within(region).getByText('Headings are unsupported by this dialect.')).toBeTruthy();
    await fireEvent.click(within(region).getByRole('button', { name: 'Copy' }));
    await tick();
    await tick();
    expect(copied).toEqual(['Title\n\nHello']);
    expect(within(region).getByRole('status').textContent).toBe('Copied');
  });

  it('writes the chosen format', () => {
    render(DialectExport, { props: { doc: doc('# Title'), dialect: 'discord' } });
    expect(
      (screen.getByRole('textbox', { name: 'Discord text' }) as HTMLTextAreaElement).value
    ).toBe('# Title');
    expect(screen.getByText('Nothing changes in this format.')).toBeTruthy();
  });
});

describe('editor emoji (row 9)', () => {
  it('insertEmoji is its own undo step, apart from typing', () => {
    const controller = new EditorController();
    controller.insertText('Party ');
    expect(controller.insertEmoji('🎉')).toBe(true);
    expect(text(controller.doc)).toBe('Party 🎉');
    controller.undo();
    expect(text(controller.doc)).toBe('Party');
    expect(controller.insertEmoji('')).toBe(false);
    expect(controller.insertEmoji('a\nb')).toBe(false);
    expect(controller.insertEmoji('x'.repeat(33))).toBe(false);
  });

  it('setShortcodes swaps the :shortcode: lookup after construction', () => {
    const controller = new EditorController();
    controller.insertText(':tada:');
    expect(text(controller.doc)).toBe(':tada:');
    controller.setShortcodes((name) => (name === 'smile' ? '😄' : undefined));
    controller.insertText(' :smile:');
    expect(text(controller.doc)).toBe(':tada: 😄');
    controller.setShortcodes(undefined);
    controller.insertText(' :smile:');
    expect(text(controller.doc)).toBe(':tada: 😄 :smile:');
  });

  it('the toolbar emoji button opens the picker in a popover and inserts the choice', async () => {
    const controller = new EditorController({ doc: doc('Hi') });
    render(EditorToolbar, { props: { controller, emoji: true } });
    // The emoji button is a lazy chunk: wait for it like the picker below (1 s missed it under load).
    const button = await within(screen.getByRole('toolbar')).findByRole(
      'button',
      { name: 'Emoji' },
      { timeout: 10_000 }
    );
    expect(button.getAttribute('aria-haspopup')).toBe('dialog');
    await fireEvent.click(button);
    const picker = await screen.findByRole('grid', {}, { timeout: 10_000 });
    const first = (
      await within(picker).findAllByRole('gridcell', {}, { timeout: 10_000 })
    )[0] as HTMLElement;
    await fireEvent.click(first);
    await tick();
    expect(text(controller.doc)).not.toBe('Hi');
    controller.undo();
    expect(text(controller.doc)).toBe('Hi');
  });
});
