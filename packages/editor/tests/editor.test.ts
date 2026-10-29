/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { fromMarkdown, toMarkdown } from '@texuli/core/editor-markdown';
import { createEditorIds, type EditorDocument } from '@texuli/core/editor-model';
import { detectPlatform } from '@texuli/core/keyboard';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorController } from '../src/controller/index.ts';
import { pointToDom } from '../src/editor/dom.ts';
import EditorSurface from '../src/editor/EditorSurface.svelte';
import RichTextEditor from '../src/editor/RichTextEditor.svelte';

// RichTextEditor: no HTML sinks, link URL tiers re-checked at render,
// sanitized paste, read-only, the link dialog error, and the theme contract.

describe('editor', () => {
  afterEach(cleanup);

  /** The platform's Mod key, as the editor keymap reads it. */
  const MOD = detectPlatform(navigator) === 'mac' ? { metaKey: true } : { ctrlKey: true };

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
    const event = new InputEvent('beforeinput', {
      inputType,
      data,
      cancelable: true,
      bubbles: true,
    });
    surface.dispatchEvent(event);
    await tick();
    return event;
  }

  describe('RichTextEditor rendering', () => {
    it('uses the external controller URL tier when rendering existing links', () => {
      const doc = fromMarkdown('[internal](http://example.com/docs)', {
        newId: createEditorIds('dev-link'),
        trust: 'developer',
      }).doc;
      const controller = new EditorController({ doc, trust: 'developer' });
      const view = render(RichTextEditor, { props: { controller, label: 'Notes' } });
      expect(view.container.querySelector('a')?.getAttribute('href')).toBe(
        'http://example.com/docs'
      );
    });

    it('renders host extension entities as a span with their name and id, keeping them through edits (G48)', async () => {
      const extensions = [{ name: 'mention', sigil: '@' as const }];
      const doc = fromMarkdown('Hi @{person-1|Ada}', {
        newId: createEditorIds('ext'),
        extensions,
      }).doc;
      const onChange = vi.fn<(doc: EditorDocument) => void>();
      render(RichTextEditor, { props: { value: doc, onChange, label: 'Notes' } });
      const surface = screen.getByRole('textbox', { name: 'Notes' });
      const entity = surface.querySelector('.tx-editor-extension');
      expect(entity?.getAttribute('data-tx-extension')).toBe('mention');
      expect(entity?.getAttribute('data-tx-entity')).toBe('person-1');
      expect(entity?.textContent).toBe('Ada');
      placeCaret(surface, 0, 6);
      await beforeinput(surface, 'insertText', '.');
      // Typing right after the entity keeps it, and it does not grow.
      expect(toMarkdown(onChange.mock.lastCall?.[0] ?? doc, { extensions })).toBe(
        'Hi @{person-1|Ada}.'
      );
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
                {
                  type: 'text',
                  text: 'bad',
                  marks: [{ type: 'link', href: 'javascript:alert(1)' }],
                },
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

  describe('editing through beforeinput', () => {
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
});

describe('editor-css', () => {
  const css = readFileSync(join(process.cwd(), 'packages/editor/src/editor/editor.css'), 'utf8');

  describe('editor theme contract', () => {
    it('makes the todo checkbox itself a 24px target (WCAG 2.5.8)', () => {
      // The checkbox sits inside the editor textbox, so axe measures the input's
      // own box: a larger wrapper or label does not satisfy target-size.
      expect(css).toMatch(
        /\.tx-editor-check input\s*\{[^}]*inline-size:\s*1\.5rem;[^}]*block-size:\s*1\.5rem;/
      );
    });

    it('uses the AA-gated link role for rendered links', () => {
      expect(css).toMatch(/\.tx-editor-link\s*\{[^}]*color:\s*var\(--tx-link, LinkText\)/);
    });
  });
});
