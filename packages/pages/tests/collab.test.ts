import { fireEvent, render, waitFor } from '@testing-library/svelte';
import type { DocumentBlock, TexuliDocument } from '@texuli/document/model';
import { createMemorySyncHub, type MemorySyncHub } from '@texuli/document/sync';
import { pointToDom } from '@texuli/editor/editor';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CollabEditor from '../src/collab/CollabEditor.svelte';
import { feedKeydown } from '../src/collab/feed.ts';
import { HIGHLIGHT_NAMES, HighlightLayer } from '../src/collab/highlights.ts';
import { landmarkPerson } from '../src/collab/labels.ts';
import {
  type CollabSession,
  createCollabSession,
  presenceColor,
} from '../src/collab/session.svelte.ts';
import { PagesEditor } from '../src/editor/state.svelte.ts';
import { samplePage } from './fixtures.ts';

/*
 * @texuli/pages/collab in happy-dom: two CollabEditors on one in-memory hub
 * converge through their op logs, undo is selective, comments (composer,
 * feed keyboard, resolve), suggestion mode with accept, version restore,
 * the collaborator list and the editor seams (sync entries, caret mapping).
 */

const frame = () => new Promise((resolve) => setTimeout(resolve, 40));
const plain = (doc: TexuliDocument, id: string) => {
  const block = doc.blocks.find((entry) => entry.id === id) as DocumentBlock | undefined;
  return block && 'content' in block
    ? block.content.map((part) => ('text' in part ? part.text : '\n')).join('')
    : '';
};

const sessions: CollabSession[] = [];
afterEach(() => {
  for (const session of sessions.splice(0)) session.close();
  document.body.innerHTML = '';
});

function mount(
  hub: MemorySyncHub,
  replica: string,
  color: number,
  extra: Record<string, unknown> = {}
) {
  const session = createCollabSession({
    replica,
    document: samplePage(),
    author: { name: replica === 'ada' ? 'Ada' : 'Lin', color },
    adapter: hub.adapter(),
  });
  sessions.push(session);
  const announce = vi.fn<(message: string) => void>();
  let editor: PagesEditor | undefined;
  const view = render(CollabEditor, {
    props: {
      ...extra,
      session,
      motion: false,
      announce,
      get editor() {
        return editor;
      },
      set editor(value: PagesEditor | undefined) {
        editor = value;
      },
    },
  });
  const root = view.container as HTMLElement;
  const surface = (id: string) =>
    root.querySelector(`[data-sortable-item="${id}"] [role="textbox"]`) as HTMLElement;
  const select = (id: string, from: number, to = from) => {
    const block = surface(id).querySelector('[data-tx-block]') as Element;
    const start = pointToDom(block, from);
    const end = pointToDom(block, to);
    surface(id).focus();
    document.getSelection()?.setBaseAndExtent(start.node, start.offset, end.node, end.offset);
    document.dispatchEvent(new Event('selectionchange'));
  };
  const type = async (id: string, data: string) => {
    surface(id).dispatchEvent(
      new InputEvent('beforeinput', {
        inputType: 'insertText',
        data,
        cancelable: true,
        bubbles: true,
      })
    );
    await tick();
  };
  const button = (name: string | RegExp) =>
    [...root.querySelectorAll('button')].find((element) =>
      typeof name === 'string'
        ? element.textContent?.trim() === name
        : name.test(element.textContent ?? '')
    ) as HTMLButtonElement;
  return { session, root, announce, state: () => editor as PagesEditor, select, type, button };
}

function pair(extra: Record<string, unknown> = {}) {
  const hub = createMemorySyncHub({ manual: true });
  const ada = mount(hub, 'ada', 1, extra);
  const lin = mount(hub, 'lin', 4, extra);
  const flush = async () => {
    for (let i = 0; i < 4; i += 1) hub.flush();
    await tick();
  };
  return { hub, ada, lin, flush };
}

describe('CollabEditor', () => {
  it('converges two editors through their op logs, and undo is selective', async () => {
    const { ada, lin, flush } = pair();
    await flush();
    ada.select('p1', 5);
    await ada.type('p1', '!');
    lin.select('p2', 0);
    await lin.type('p2', '>');
    await flush();
    for (const side of [ada, lin]) {
      expect(plain(side.state().doc, 'p1')).toBe('First! paragraph');
      expect(plain(side.state().doc, 'p2')).toBe('>Second paragraph');
      expect(side.state().doc).toEqual(side.session.document);
    }
    // Remote changes are sync entries of the op log, not local undo steps.
    expect(
      lin
        .state()
        .log()
        .some((entry) => entry.kind === 'sync' && entry.origin === 'remote')
    ).toBe(true);
    await fireEvent.click(ada.button('Undo'));
    await flush();
    expect(plain(lin.state().doc, 'p1')).toBe('First paragraph');
    expect(plain(lin.state().doc, 'p2')).toBe('>Second paragraph');
    // The peer's own row shows the merged text.
    await waitFor(() =>
      expect(lin.root.querySelector('[data-sortable-item="p1"]')?.textContent).toContain(
        'First paragraph'
      )
    );
  });

  it('comments on a selection: composer, feed keyboard, peer view, resolve', async () => {
    const { ada, lin, flush } = pair();
    await flush();
    ada.select('p1', 0, 5);
    await frame();
    await fireEvent.click(ada.button('Comment'));
    const composer = ada.root.querySelector(
      '.tx-pages-collab__composer textarea'
    ) as HTMLTextAreaElement;
    expect(composer).toBeTruthy();
    expect(ada.root.querySelector('.tx-pages-collab__composer label')?.textContent).toContain(
      'Comment on “First”'
    );
    await waitFor(() => expect(document.activeElement).toBe(composer));
    await fireEvent.input(composer, { target: { value: 'Shorter? @{u-lin|Lin}' } });
    await fireEvent.submit(composer.closest('form') as HTMLFormElement);
    expect(ada.announce).toHaveBeenCalledWith('Comment added.');
    await flush();
    const article = lin.root.querySelector('[role="feed"] article') as HTMLElement;
    expect(article.getAttribute('aria-posinset')).toBe('1');
    expect(article.textContent).toContain('Ada on “First”');
    expect(article.querySelector('.tx-pages-collab__mention')?.textContent).toBe('@Lin');
    // A second thread, then Page Down and Page Up move between articles (APG feed).
    ada.session.addComment({ block: 'p2' }, 'Whole block');
    await flush();
    const feed = lin.root.querySelector('[role="feed"]') as HTMLElement;
    const articles = [...feed.querySelectorAll('article')] as HTMLElement[];
    expect(articles).toHaveLength(2);
    articles[0]?.focus();
    expect(feedKeydown(new KeyboardEvent('keydown', { key: 'a' }), feed)).toBe(false);
    const down = new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true, cancelable: true });
    articles[0]?.dispatchEvent(down);
    expect(document.activeElement).toBe(articles[1]);
    articles[1]?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'PageUp', bubbles: true, cancelable: true })
    );
    expect(document.activeElement).toBe(articles[0]);
    await fireEvent.click(lin.button('Resolve'));
    await flush();
    expect(ada.session.threads[0]?.status).toBe('resolved');
    expect(ada.root.querySelector('article[data-status="resolved"]')).toBeTruthy();
  });

  it('suggests in suggestion mode and accepts the suggestion', async () => {
    const { ada, lin, flush } = pair();
    await flush();
    const toggle = ada.button('Suggesting');
    await fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(ada.announce).toHaveBeenCalledWith('Suggesting: your edits are suggestions.');
    ada.select('p1', 5);
    await ada.type('p1', '!');
    await flush();
    const article = lin.root.querySelector('[data-suggestion]') as HTMLElement;
    expect(article.textContent).toContain('Suggestion by Ada');
    expect(article.textContent).toContain('Insert “!”');
    await fireEvent.click(lin.button('Accept'));
    await flush();
    expect(ada.session.suggestions).toEqual([]);
    expect(plain(ada.state().doc, 'p1')).toBe('First! paragraph');
  });

  it('saves a version and restores it for everyone', async () => {
    const { ada, lin, flush } = pair();
    await flush();
    const history = ada.button('Version history');
    await fireEvent.click(history);
    expect(history.getAttribute('aria-expanded')).toBe('true');
    const name = ada.root.querySelector('.tx-pages-collab__save input') as HTMLInputElement;
    await fireEvent.input(name, { target: { value: 'Draft one' } });
    await fireEvent.submit(name.closest('form') as HTMLFormElement);
    await flush();
    lin.select('p1', 0);
    await lin.type('p1', '#');
    await flush();
    await fireEvent.click(ada.button(/Changes since/));
    expect(ada.root.querySelector('.tx-pages-collab__diff')?.textContent).toContain(
      'Edited “First paragraph” to “#First paragraph”'
    );
    await fireEvent.click(ada.button('Restore “Draft one”'));
    await flush();
    expect(plain(lin.state().doc, 'p1')).toBe('First paragraph');
    expect(ada.announce).toHaveBeenCalledWith('Restored the version “Draft one”.');
  });

  it('lists collaborators accessibly and keeps carets aria-hidden', async () => {
    const { ada, lin, flush } = pair();
    await flush();
    lin.select('p2', 3);
    await frame();
    await flush();
    const people = [...ada.root.querySelectorAll('.tx-pages-collab__person')].map((item) =>
      item.textContent?.trim()
    );
    expect(people).toEqual(['Ada (you)', 'Lin, in “Second paragraph”']);
    expect(ada.root.querySelector('.tx-pages-collab__overlay')?.getAttribute('aria-hidden')).toBe(
      'true'
    );
    expect(presenceColor(9)).toBe('var(--tx-chart-2, Highlight)');
  });

  it('names every landmark for its person, so two editors on one page never repeat one', async () => {
    // axe `landmark-unique`: before, both editors named their region after the
    // document title and their sidebar, people list and panels "Collaboration",
    // "People here", "Comments", "Suggestions" and "Version history".
    const { ada, lin, flush } = pair({ trail: [{ ref: 'pages/home', title: 'Home' }] });
    await flush();
    for (const side of [ada, lin]) await fireEvent.click(side.button('Version history'));
    const roles: Record<string, string> = {
      SECTION: 'region',
      ASIDE: 'complementary',
      NAV: 'navigation',
    };
    // Callouts are document content (an `aside` named by its title), not the
    // collaboration UI: two views of one document show the same callout.
    const landmarks = [
      ...document.body.querySelectorAll('section, aside:not(.tx-pages-callout), nav'),
    ].flatMap((element) => {
      const labelledby = element.getAttribute('aria-labelledby');
      const name =
        element.getAttribute('aria-label') ??
        (labelledby
          ? labelledby
              .split(/\s+/)
              .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
              .join(' ')
          : '');
      // An unnamed section is not a landmark.
      if (element.tagName === 'SECTION' && !name) return [];
      return [`${roles[element.tagName]}: ${name}`];
    });
    expect(landmarks.length).toBeGreaterThanOrEqual(14);
    expect(new Set(landmarks).size).toBe(landmarks.length);
    for (const person of ['Ada', 'Lin']) {
      for (const landmark of [
        `region: Field notes (${person})`,
        `navigation: Breadcrumb (${person})`,
        `complementary: Collaboration (${person})`,
        `region: People here (${person})`,
        `region: Comments (${person})`,
        `region: Suggestions (${person})`,
        `region: Version history (${person})`,
      ])
        expect(landmarks).toContain(landmark);
    }
    // The visible headings stay plain; a host label and `landmark` override still win.
    expect(ada.root.querySelector('.tx-pages-collab__heading')?.textContent).toBe('Comments');
    expect(landmarkPerson({ author: { name: '  ' }, replica: 'r-7' })).toBe('r-7');
    const named = mount(createMemorySyncHub({ manual: true }), 'kim', 2, {
      label: 'Kim’s draft',
      collabLabels: { landmark: (name: string) => `${name}, review copy` },
    });
    expect(named.root.querySelector('section.tx-pages-editor')?.getAttribute('aria-label')).toBe(
      'Kim’s draft'
    );
    expect(
      named.root.querySelector('aside.tx-pages-collab__sidebar')?.getAttribute('aria-label')
    ).toBe('Collaboration, review copy');
  });
});

describe('editor seams and highlights', () => {
  it('applies external changes off the undo stack and maps carets through them', () => {
    const editor = new PagesEditor({ document: samplePage(), announce: () => {} });
    editor.apply([{ op: 'insert-text', id: 'p1', offset: 0, text: 'A' }]);
    const since = editor.lastSeq();
    expect(
      editor.applyExternal([
        {
          op: 'replace-text',
          id: 'p1',
          from: 0,
          to: 0,
          content: [{ type: 'text', text: '>> ', marks: [] }],
        },
      ]).ok
    ).toBe(true);
    expect(editor.log().at(-1)?.kind).toBe('sync');
    expect(editor.mapPoint({ block: 'p1', offset: 4 }, since)).toEqual({ block: 'p1', offset: 7 });
    expect(editor.mapPoint({ block: 'p2', offset: 4 }, since)).toEqual({ block: 'p2', offset: 4 });
    // A connected session takes commits and undo.
    const commit = vi.fn();
    editor.connectSync({
      commit,
      undo: () => true,
      redo: () => false,
      canUndo: true,
      canRedo: false,
    });
    editor.setIdPrefix('nada-');
    expect(editor.newId()).toMatch(/^nada-/);
    editor.apply([{ op: 'insert-text', id: 'p1', offset: 0, text: 'B' }], { group: 'typing' });
    expect(commit).toHaveBeenCalledWith(editor.doc, 'typing');
    expect(editor.canUndo).toBe(true);
    expect(editor.synced).toBe(true);
  });

  it('shares page highlights between layers and removes only its own ranges', () => {
    const highlights = new Map<string, Set<unknown> & { priority: number }>();
    class FakeHighlight extends Set<unknown> {
      priority = 0;
    }
    vi.stubGlobal('Highlight', FakeHighlight);
    vi.stubGlobal('CSS', {
      ...(globalThis.CSS ?? {}),
      highlights,
      escape: (value: string) => value,
    });
    try {
      const a = new HighlightLayer();
      const b = new HighlightLayer();
      const one = document.createRange();
      const two = document.createRange();
      a.set(HIGHLIGHT_NAMES.comment, [one]);
      b.set(HIGHLIGHT_NAMES.comment, [two]);
      expect(highlights.get('tx-pages-comment')?.size).toBe(2);
      a.clear();
      expect([...(highlights.get('tx-pages-comment') ?? [])]).toEqual([two]);
      expect(HIGHLIGHT_NAMES.remote(9)).toBe('tx-pages-remote-2');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
