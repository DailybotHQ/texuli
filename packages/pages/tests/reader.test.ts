import { render, screen, waitFor } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { documentOutline, slugify } from '../src/reader/outline.ts';
import PageReader from '../src/reader/PageReader.svelte';
import { doc, para, samplePage, text } from './fixtures.ts';

describe('reader outline', () => {
  it('anchors every heading in reading order with unique, fragment-safe slugs', () => {
    const page = doc([
      { id: 'a', type: 'heading', level: 1, content: text('Release notes') },
      { id: 'b', type: 'heading', level: 2, content: text('Release notes') },
      {
        id: 'c',
        type: 'callout',
        tone: 'info',
        blocks: [{ id: 'd', type: 'heading', level: 3, content: text('Título <b>') }],
      },
      { id: 'e', type: 'heading', level: 2, content: text('Release notes 2') },
      { id: 'f', type: 'heading', level: 2, content: [] },
    ]);
    expect(documentOutline(page).map((entry) => [entry.id, entry.anchor, entry.level])).toEqual([
      ['a', 'release-notes', 1],
      ['b', 'release-notes-2', 2],
      ['d', 'titulo-b', 3],
      ['e', 'release-notes-2-2', 2],
      ['f', 'section', 2],
    ]);
    expect(documentOutline(page, { prefix: 'doc-' })[0]?.anchor).toBe('doc-release-notes');
    expect(slugify('x'.repeat(500))).toHaveLength(64);
  });

  it('keeps the host anchor from anchorFor when it is fragment-safe and unique (G132)', () => {
    const page = doc([
      { id: 'overview', type: 'heading', level: 2, content: text('Where we stand') },
      { id: 'overview2', type: 'heading', level: 2, content: text('Where we stand') },
      { id: 'bad id', type: 'heading', level: 2, content: text('Unsafe id') },
      { id: 'dup', type: 'heading', level: 2, content: text('Duplicate') },
    ]);
    const anchorFor = (block: { id: string }) => (block.id === 'dup' ? 'overview' : block.id);
    expect(documentOutline(page, { anchorFor }).map((entry) => entry.anchor)).toEqual([
      'overview',
      'overview2',
      'unsafe-id',
      'duplicate',
    ]);
    expect(documentOutline(page, { prefix: 'doc-', anchorFor })[0]?.anchor).toBe('doc-overview');
    const throwing = () => {
      throw new Error('host bug');
    };
    expect(documentOutline(page, { anchorFor: throwing })[0]?.anchor).toBe('where-we-stand');
  });

  it('stays linear on many headings', () => {
    const blocks = Array.from({ length: 2_000 }, (_, i) => ({
      id: `h${i}`,
      type: 'heading' as const,
      level: 2 as const,
      content: text('Same title'),
    }));
    const started = performance.now();
    const outline = documentOutline(doc(blocks));
    expect(new Set(outline.map((entry) => entry.anchor)).size).toBe(2_000);
    expect(performance.now() - started).toBeLessThan(2_000);
  });
});

describe('PageReader', () => {
  it('renders the same document read-only with anchored headings and an outline', () => {
    const page = samplePage();
    page.blocks.push({ id: 'h2', type: 'heading', level: 2, content: text('Next steps') });
    render(PageReader, { props: { document: page } });
    const article = screen.getByRole('article', { name: 'Field notes' });
    expect(article.querySelector('[contenteditable]')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    const heading = screen.getByRole('heading', { level: 2, name: 'Next steps' });
    expect(heading.id).toBe('next-steps');
    const outline = screen.getByRole('navigation', { name: 'On this page' });
    expect(
      Array.from(outline.querySelectorAll('a')).map((a) => [a.textContent, a.getAttribute('href')])
    ).toEqual([
      ['Field notes', '#field-notes'],
      ['Next steps', '#next-steps'],
    ]);
    expect(article.querySelector('aside')?.textContent).toContain('Inside the callout');
    expect(article.querySelectorAll('.tx-pages-column')).toHaveLength(2);
  });

  it('renders host anchors on the headings and in the outline alike (G132)', () => {
    const page = doc([
      { id: 'overview', type: 'heading', level: 2, content: text('Where we stand') },
      { id: 'next', type: 'heading', level: 2, content: text('Next steps') },
    ]);
    render(PageReader, { props: { document: page, anchorFor: (block) => block.id } });
    expect(screen.getByRole('heading', { level: 2, name: 'Where we stand' }).id).toBe('overview');
    const outline = screen.getByRole('navigation', { name: 'On this page' });
    expect(Array.from(outline.querySelectorAll('a')).map((a) => a.getAttribute('href'))).toEqual([
      '#overview',
      '#next',
    ]);
  });

  it('renders marks sink-free and links through the URL policy', () => {
    render(PageReader, {
      props: {
        document: doc([
          {
            id: 'p',
            type: 'paragraph',
            content: [
              { type: 'text', text: '<script>x</script>', marks: [{ type: 'strong' }] },
              {
                type: 'text',
                text: 'safe',
                marks: [{ type: 'link', href: 'https://example.com/a' }],
              },
              {
                type: 'text',
                text: 'unsafe',
                marks: [{ type: 'link', href: 'javascript:alert(1)' }],
              },
            ],
          },
        ]),
      },
    });
    const article = screen.getByRole('article');
    expect(article.querySelector('script')).toBeNull();
    expect(article.querySelector('strong')?.textContent).toBe('<script>x</script>');
    const links = Array.from(article.querySelectorAll('a'));
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['https://example.com/a']);
    expect(links[0]?.getAttribute('rel')).toBe('noopener noreferrer nofollow');
    expect(article.textContent).toContain('unsafe');
  });

  it('navigates nested pages and shows todo state as text', async () => {
    const onNavigate = vi.fn();
    render(PageReader, {
      props: {
        document: doc([
          { id: 'pl', type: 'page-link', ref: 'pages/roadmap', title: 'Roadmap' },
          {
            id: 'l',
            type: 'list',
            kind: 'todo',
            items: [{ id: 'i', checked: true, blocks: [para('ip', 'Ship')] }],
          },
        ]),
        onNavigate,
        pageHref: (ref: string) => `/${ref}/`,
      },
    });
    const link = screen.getByRole('link', { name: 'Open page Roadmap' });
    expect(link.getAttribute('href')).toBe('/pages/roadmap/');
    link.click();
    expect(onNavigate).toHaveBeenCalledWith('pages/roadmap');
    expect(screen.getByRole('listitem').textContent).toContain('Done');
  });

  it('paints embeds with the player in the reader too', async () => {
    render(PageReader, {
      props: {
        document: doc([
          {
            id: 'e',
            type: 'embed',
            kind: 'component',
            title: 'Broken',
            inline: { id: 'no-such-component' },
          },
        ]),
      },
    });
    await waitFor(
      () => expect(document.querySelector('figure')?.getAttribute('data-state')).toBe('refused'),
      { timeout: 30_000 }
    );
  }, 60_000);
});
