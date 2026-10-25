import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { fromMarkdown, toMarkdown } from '@texuli/core/editor-markdown';
import {
  blockText,
  createEditorIds,
  type EditorDocument,
  editorLeaves,
  isTextBlock,
} from '@texuli/core/editor-model';
import { detectPlatform } from '@texuli/core/keyboard';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorController } from '../src/controller/index.ts';
import { domBlockText, domToPoint, pointToDom } from '../src/editor/dom.ts';
import EditorSurface from '../src/editor/EditorSurface.svelte';
import RichTextEditor from '../src/editor/RichTextEditor.svelte';

afterEach(cleanup);

/** The platform's Mod key, as the editor keymap reads it. */
const MOD = detectPlatform(navigator) === 'mac' ? { metaKey: true } : { ctrlKey: true };

/** The first text node inside an element (Svelte adds comment anchors around blocks). */
function firstText(element: Element): Text {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  return walker.nextNode() as Text;
}

const load = (markdown: string) => fromMarkdown(markdown, { newId: createEditorIds('e') }).doc;

function mount(markdown: string, props: Record<string, unknown> = {}) {
  const value = load(markdown);
  const onChange = vi.fn<(doc: EditorDocument) => void>();
  const view = render(RichTextEditor, { props: { value, onChange, label: 'Notes', ...props } });
  const surface = screen.getByRole('textbox', { name: 'Notes' });
  const latest = () => onChange.mock.lastCall?.[0] ?? value;
  return { view, surface, onChange, md: () => toMarkdown(latest()) };
}

function placeCaret(surface: HTMLElement, blockIndex: number, offset: number) {
  const block = surface.querySelectorAll('[data-tx-block]')[blockIndex] as Element;
  const point = pointToDom(block, offset);
  surface.focus();
  document.getSelection()?.setBaseAndExtent(point.node, point.offset, point.node, point.offset);
  document.dispatchEvent(new Event('selectionchange'));
}

async function beforeinput(surface: HTMLElement, inputType: string, data: string | null = null) {
  const event = new InputEvent('beforeinput', { inputType, data, cancelable: true, bubbles: true });
  surface.dispatchEvent(event);
  await tick();
  return event;
}

describe('RichTextEditor rendering', () => {
  it('is a labelled multiline textbox described by its keyboard help', () => {
    const { surface } = mount('Hello');
    expect(surface.getAttribute('aria-multiline')).toBe('true');
    expect(surface.getAttribute('contenteditable')).toBe('true');
    const help = document.getElementById(surface.getAttribute('aria-describedby') ?? '');
    expect(help?.textContent).toMatch(/bold.*italic.*link.*undo/);
    expect(screen.getByRole('toolbar', { name: 'Formatting' })).toBeTruthy();
  });

  it('renders the vocabulary as real elements and DOM text that equals the model text', () => {
    const markdown = [
      '# Title',
      'Some **bold _both_** and `code` with [a link](https://example.com)  \nafter break',
      '- one\n  - nested\n- [ ] todo',
      '> quoted',
      '```ts\nlet a = 1;\n```',
      '---',
    ].join('\n\n');
    const doc = load(markdown);
    const { surface } = mount(markdown);
    expect(surface.querySelector('h1')?.textContent).toBe('Title');
    expect(surface.querySelector('strong em')?.textContent).toBe('both');
    expect(surface.querySelector('code.tx-editor-code')?.textContent).toBe('code');
    const link = surface.querySelector('a') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('https://example.com');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer nofollow');
    expect(link.hasAttribute('target')).toBe(false);
    expect(surface.querySelector('blockquote')).toBeTruthy();
    expect(surface.querySelector('pre')?.getAttribute('data-lang')).toBe('ts');
    expect(surface.querySelector('hr')).toBeTruthy();
    expect(surface.querySelector('[data-tx-void]')?.getAttribute('contenteditable')).toBe('false');
    expect(screen.getAllByRole('checkbox', { name: 'Not done' }).length).toBeGreaterThan(0);
    const rendered = [...surface.querySelectorAll('[data-tx-block]')].map(domBlockText);
    const model = editorLeaves(doc).flatMap(({ block }) =>
      isTextBlock(block) ? [blockText(block)] : []
    );
    expect(rendered).toEqual(model);
  });

  it('renders hostile content as text: no script, no handler, no unsafe link (fails with an HTML sink)', () => {
    const { surface } = mount(
      '<script>window.__x=1</script> <img src=x onerror=alert(1)> [js](javascript:alert(1)) [data](data:text/html,x)'
    );
    expect(surface.querySelector('script, img, iframe')).toBeNull();
    expect(surface.querySelectorAll('a')).toHaveLength(0);
    expect(surface.textContent).toContain('<script>window.__x=1</script>');
    expect(surface.querySelector('[onerror], [onclick], [style]')).toBeNull();
  });

  it('re-checks link hrefs at render and degrades a refused one to marked text', () => {
    const controller = new EditorController({
      doc: {
        version: 1,
        blocks: [
          {
            id: 'p',
            type: 'paragraph',
            content: [
              { type: 'text', text: 'bad', marks: [{ type: 'link', href: 'javascript:alert(1)' }] },
            ],
          },
        ],
      },
    });
    const { container } = render(EditorSurface, { props: { controller, label: 'Raw' } });
    expect(container.querySelector('a')).toBeNull();
    expect(container.querySelector('.tx-editor-link-rejected')?.textContent).toBe('bad');
  });
});

describe('selection mapping', () => {
  it('maps model offsets to DOM points and back across marks and breaks', () => {
    const { surface } = mount('ab **cd** e  \nfg');
    const block = surface.querySelector('[data-tx-block]') as Element;
    expect(domBlockText(block)).toBe('ab cd e\nfg');
    for (let offset = 0; offset <= 10; offset += 1) {
      const point = pointToDom(block, offset);
      expect(domToPoint(surface, point.node, point.offset)).toEqual({
        block: block.getAttribute('data-tx-block'),
        offset,
      });
    }
  });
});

describe('editing through beforeinput', () => {
  it('prevents the browser edit, applies the transform and re-renders', async () => {
    const { surface, md } = mount('Hello');
    placeCaret(surface, 0, 5);
    const event = await beforeinput(surface, 'insertText', '?');
    expect(event.defaultPrevented).toBe(true);
    expect(md()).toBe('Hello?');
    expect(surface.textContent).toContain('Hello?');
    await beforeinput(surface, 'insertParagraph');
    await beforeinput(surface, 'insertText', 'Two');
    expect(md()).toBe('Hello?\n\nTwo');
    const refused = await beforeinput(surface, 'formatUnderline');
    expect(refused.defaultPrevented).toBe(true);
    expect(md()).toBe('Hello?\n\nTwo');
  });

  it('runs the keymap: Mod+B, Mod+Z, Tab in lists only', async () => {
    const { surface, md } = mount('word');
    placeCaret(surface, 0, 4);
    await fireEvent.keyDown(surface, { key: 'b', code: 'KeyB', ...MOD });
    await beforeinput(surface, 'insertText', 'X');
    expect(md()).toBe('word**X**');
    await fireEvent.keyDown(surface, { key: 'z', code: 'KeyZ', ...MOD });
    expect(md()).toBe('word');
    const tab = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true, bubbles: true });
    surface.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(false);
  });

  it('pastes clipboard HTML as sanitized content and never renders it raw', async () => {
    const { surface, md } = mount('');
    placeCaret(surface, 0, 0);
    const paste = new Event('paste', { cancelable: true, bubbles: true }) as ClipboardEvent;
    Object.defineProperty(paste, 'clipboardData', {
      value: {
        getData: (type: string) =>
          type === 'text/html'
            ? '<p onclick="x()">Hi <b>there</b><script>window.__pasted=1</script><img src=x onerror=alert(1)></p><a href="javascript:alert(1)">bad</a>'
            : '',
      },
    });
    surface.dispatchEvent(paste);
    await tick();
    expect(paste.defaultPrevented).toBe(true);
    expect(md()).toBe('Hi **there**\n\nbad');
    expect(surface.querySelector('script, img, [onclick]')).toBeNull();
    expect(surface.querySelectorAll('a')).toHaveLength(0);
  });

  it('leaves the DOM to the input method until compositionend, then applies it once', async () => {
    const { surface, md, onChange } = mount('Hi');
    placeCaret(surface, 0, 2);
    await fireEvent.compositionStart(surface);
    const composing = await beforeinput(surface, 'insertCompositionText', 'か');
    expect(composing.defaultPrevented).toBe(false);
    // The browser writes the composed text into the block's DOM.
    const text = firstText(surface.querySelector('[data-tx-block]') as Element);
    text.data = 'Hiかな';
    const stray = await beforeinput(surface, 'insertText', 'x');
    expect(stray.defaultPrevented).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
    await fireEvent.compositionEnd(surface);
    await tick();
    expect(md()).toBe('Hiかな');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(surface.querySelector('[data-tx-block]')?.textContent).toBe('Hiかな');
  });

  it('read-only keeps the textbox and refuses every edit', async () => {
    const { surface, md } = mount('Fixed', { readonly: true });
    expect(surface.getAttribute('aria-readonly')).toBe('true');
    expect(surface.getAttribute('contenteditable')).toBe('false');
    expect(screen.queryByRole('toolbar')).toBeNull();
    const event = await beforeinput(surface, 'insertText', 'x');
    expect(event.defaultPrevented).toBe(true);
    expect(md()).toBe('Fixed');
  });
});

describe('toolbar and link dialog', () => {
  it('exposes pressed state and shortcuts, and toggles marks on the selection', async () => {
    const { surface, md } = mount('**bold** plain');
    placeCaret(surface, 0, 2);
    await tick();
    const bold = screen.getByRole('button', { name: 'Bold' });
    expect(bold.getAttribute('aria-pressed')).toBe('true');
    expect(bold.getAttribute('aria-keyshortcuts')).toMatch(/B$/);
    expect(screen.getByRole('button', { name: 'Undo' }).getAttribute('aria-disabled')).toBe('true');
    await fireEvent.click(screen.getByRole('button', { name: 'Heading 2' }));
    expect(md()).toBe('## **bold** plain');
    expect(screen.getByRole('button', { name: 'Heading 2' }).getAttribute('aria-pressed')).toBe(
      'true'
    );
  });

  it('shows a visible error for a refused address and links an accepted one', async () => {
    const { surface, md } = mount('click here');
    const block = surface.querySelector('[data-tx-block]') as Element;
    const from = pointToDom(block, 0);
    const to = pointToDom(block, 5);
    surface.focus();
    document.getSelection()?.setBaseAndExtent(from.node, from.offset, to.node, to.offset);
    document.dispatchEvent(new Event('selectionchange'));
    await fireEvent.keyDown(surface, { key: 'k', code: 'KeyK', ...MOD });
    const dialog = await screen.findByRole('dialog', { name: 'Edit link' });
    const field = screen.getByRole('textbox', { name: 'Link address' }) as HTMLInputElement;
    await fireEvent.input(field, { target: { value: 'javascript:alert(1)' } });
    await fireEvent.submit(dialog.querySelector('form') as HTMLFormElement);
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(dialog.textContent).toContain('This address is not allowed');
    expect(md()).toBe('click here');
    await fireEvent.input(field, { target: { value: 'https://example.com/docs' } });
    await fireEvent.submit(dialog.querySelector('form') as HTMLFormElement);
    expect(md()).toBe('[click](https://example.com/docs) here');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(surface.querySelector('a')?.getAttribute('href')).toBe('https://example.com/docs');
  });
});
