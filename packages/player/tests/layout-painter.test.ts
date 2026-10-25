import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { validateDraft } from '@texuli/catalog/validate';
import { tick } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { createPlayerCatalog } from '../src/catalog.ts';
import { frameStops } from '../src/keyboard.ts';
import { planFrames } from '../src/layouts/outline.ts';
import { PLAYER_LOADERS } from '../src/loaders.ts';
import Player from '../src/Player.svelte';

const text = (markdown: string) => ({
  id: 'blocks-text',
  props: { block: { type: 'text', markdown } },
});

/** A component plan node, for planFrames without a player. */
function plan(
  id: string,
  props: Record<string, unknown>,
  children: unknown[] = [],
  path = '0'
): never {
  return {
    kind: 'component',
    id,
    path,
    props,
    children: (
      children as Array<{ id: string; props: Record<string, unknown>; children?: unknown[] }>
    ).map((child, index) =>
      plan(child.id, child.props, child.children ?? [], `${path}.children.${index}`)
    ),
  } as never;
}

async function paint(blueprint: unknown, extra: object = {}) {
  const view = render(Player, { props: { blueprint, loaders: PLAYER_LOADERS, ...extra } });
  await screen.findAllByRole('heading', { level: 1 }, { timeout: 5000 });
  // Each id loads on its own; wait until every skeleton has become its painter.
  await waitFor(
    () => expect(view.container.querySelector('[data-tx-player-skeleton]')).toBeNull(),
    { timeout: 5000 }
  );
  await tick();
  return view;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('title headings follow the grammar titleHeading rule', () => {
  it('ranks fixed and nested titles, and untitled frames open no section', () => {
    const frames = planFrames(
      [
        plan('layout-page', { title: 'Page' }, [
          {
            id: 'layout-card',
            props: { title: 'Card' },
            children: [{ id: 'layout-card', props: { title: 'Inner' } }],
          },
          {
            id: 'layout-card',
            props: {},
            children: [{ id: 'layout-card', props: { title: 'Under untitled' } }],
          },
          {
            id: 'layout-grid',
            props: {},
            children: [{ id: 'layout-card', props: { title: 'Tile' } }],
          },
        ]),
      ],
      'p'
    );
    const level = (path: string) => frames.get(path)?.headingLevel;
    expect(level('0')).toBe(1);
    expect(level('0.children.0')).toBe(2);
    expect(level('0.children.0.children.0')).toBe(3);
    expect(level('0.children.1')).toBeNull();
    expect(level('0.children.1.children.0')).toBe(2);
    expect(level('0.children.2.children.0')).toBe(2);
  });

  it('paints those ranks, and validateDraft finds no heading skips in the same tree', async () => {
    const tree = {
      id: 'layout-page',
      props: { title: 'Quarterly page' },
      children: [
        {
          id: 'layout-card',
          props: { title: 'Revenue' },
          children: [
            { id: 'layout-card', props: { title: 'Detail' }, children: [text('Fictional.')] },
          ],
        },
      ],
    };
    const validation = validateDraft(tree, { catalog: createPlayerCatalog(), tier: 'untrusted' });
    expect(validation.diagnostics.filter((d) => d.check === 'grammar')).toEqual([]);
    await paint(tree);
    expect(screen.getByRole('heading', { level: 1, name: 'Quarterly page' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Revenue' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 3, name: 'Detail' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Revenue' })).toBeTruthy();
  });
});

describe('document contents from heading blocks', () => {
  const heading = (text: string, level: unknown) => ({
    id: 'blocks-text',
    props: { block: { type: 'heading', level, text } },
  });

  it('lists heading blocks inside a doc as anchored contents, and nothing outside one', () => {
    const inDoc = planFrames(
      [
        plan('layout-doc', { title: 'Doc' }, [
          heading('Intro', 2),
          heading('Bad', 9),
          heading('Deep', 3),
        ]),
      ],
      'p'
    );
    expect(inDoc.get('0')?.toc.map((entry) => `${entry.level} ${entry.title}`)).toEqual([
      '2 Intro',
      '3 Deep',
    ]);
    expect(inDoc.get('0.children.0')).toMatchObject({
      anchor: true,
      frameId: 'p-anchor-0-children-0',
    });
    expect(inDoc.has('0.children.1')).toBe(false);

    const onPage = planFrames([plan('layout-page', { title: 'Page' }, [heading('Intro', 2)])], 'p');
    expect(onPage.has('0.children.0')).toBe(false);
  });
});

describe('document layouts', () => {
  const deck = {
    id: 'layout-deck',
    props: { title: 'Fictional planning deck', locale: 'en-GB', aspect: '16:9' },
    children: [
      {
        id: 'deck-slide',
        props: { slideId: 'opening', title: 'Opening', notes: 'Greet the team.' },
        children: [text('Week 43.')],
      },
      {
        id: 'deck-slide',
        props: { slideId: 'risks', title: 'Risks' },
        children: [
          { id: 'layout-card', props: { title: 'Billing' }, children: [text('On track.')] },
        ],
      },
    ],
  };

  it('paints a deck as a document flow of slides, under the untrusted tier', async () => {
    const { container } = await paint(deck);
    expect(screen.getByRole('heading', { level: 1, name: 'Fictional planning deck' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Opening' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 3, name: 'Billing' })).toBeTruthy();
    expect(container.querySelector('article.tx-player-layout--deck')?.getAttribute('lang')).toBe(
      'en-GB'
    );
    const notes = container.querySelector('details.tx-player-layout__notes');
    expect(notes?.querySelector('summary')?.textContent).toBe('Speaker notes');
    expect(notes?.textContent).toContain('Greet the team.');
    expect(await screen.findByText('On track.', {}, { timeout: 5000 })).toBeTruthy();
  });

  it('makes deck, slides and cards frame stops in reading order', async () => {
    const { container } = await paint(deck);
    expect(frameStops(container).map((frame) => frame.className.match(/--(\w+)/)?.[1])).toEqual([
      'deck',
      'slide',
      'slide',
      'card',
    ]);
  });

  it('drops a deck locale that is not a language tag; markup in it refuses the deck', async () => {
    const { container } = await paint({ ...deck, props: { ...deck.props, locale: 'not a tag' } });
    expect(container.querySelector('article.tx-player-layout--deck')?.hasAttribute('lang')).toBe(
      false
    );
    document.body.innerHTML = '';
    const hostile = render(Player, {
      props: {
        blueprint: { ...deck, props: { ...deck.props, locale: 'en" onload="x' } },
        loaders: PLAYER_LOADERS,
      },
    });
    expect(screen.getByRole('alert').textContent).toContain('could not be validated');
    expect(hostile.container.querySelector('[lang]')).toBeNull();
  });

  it('lists a document’s titled frames as contents that focus the frame', async () => {
    const doc = {
      id: 'layout-doc',
      props: { title: 'Fictional guide' },
      children: [
        { id: 'layout-card', props: { title: 'Setup' }, children: [text('One.')] },
        {
          id: 'layout-card',
          props: { title: 'Usage' },
          children: [{ id: 'layout-card', props: { title: 'Advanced' } }],
        },
      ],
    };
    const { container } = await paint(doc);
    const nav = screen.getByRole('navigation', { name: 'Contents' });
    const links = Array.from(nav.querySelectorAll('a'));
    expect(links.map((link) => link.textContent)).toEqual(['Setup', 'Usage', 'Advanced']);
    expect(links[2]?.parentElement?.getAttribute('data-level')).toBe('3');
    await fireEvent.click(links[1] as HTMLElement);
    expect(document.activeElement?.id).toBe(links[1]?.getAttribute('href')?.slice(1));
    expect(frameStops(container)).toContain(document.activeElement);
  });

  it('omits contents when toc is false or fewer than two frames are titled', async () => {
    await paint({
      id: 'layout-doc',
      props: { title: 'No toc', toc: false },
      children: [
        { id: 'layout-card', props: { title: 'A' } },
        { id: 'layout-card', props: { title: 'B' } },
      ],
    });
    expect(screen.queryByRole('navigation')).toBeNull();
    document.body.innerHTML = '';
    await paint({
      id: 'layout-doc',
      props: { title: 'One' },
      children: [{ id: 'layout-card', props: { title: 'Only' } }],
    });
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('localizes contents and speaker-notes labels', async () => {
    await paint(deck, { labels: { speakerNotes: 'Notas del orador' } });
    expect(document.querySelector('summary')?.textContent).toBe('Notas del orador');
  });

  it('applies a bounded grid gap and refuses style injection', async () => {
    const grid = (gap: string) => ({
      id: 'layout-page',
      props: { title: 'Grid' },
      children: [
        {
          id: 'layout-grid',
          props: { columns: 3, gap },
          children: [{ id: 'layout-card', props: { title: 'A' } }],
        },
      ],
    });
    const { container } = await paint(grid('2rem'));
    const style = container.querySelector('.tx-player-layout--grid')?.getAttribute('style') ?? '';
    expect(style).toContain('--tx-player-columns: 3');
    expect(style).toContain('--tx-player-gap: 2rem');
    document.body.innerHTML = '';
    for (const gap of [
      '1rem; background: url(javascript:alert(1))',
      'calc(1px)',
      '999rem',
      'expression(alert(1))',
    ]) {
      // Either validateDraft's sink scan refuses the tree, or the painter drops the gap.
      const view = render(Player, { props: { blueprint: grid(gap), loaders: PLAYER_LOADERS } });
      await waitFor(
        () =>
          expect(
            view.container.querySelector('[role="alert"], .tx-player-layout--grid')
          ).not.toBeNull(),
        { timeout: 5000 }
      );
      const styled = Array.from(view.container.querySelectorAll('[style]'));
      expect(styled.map((element) => element.getAttribute('style')).join(' ')).not.toMatch(
        /background|javascript|expression|calc|999rem/
      );
      const style = view.container.querySelector('.tx-player-layout--grid')?.getAttribute('style');
      if (style !== undefined && style !== null) {
        expect(style.replace(/;\s*$/, '')).toBe('--tx-player-columns: 3');
      }
      view.unmount();
    }
  });

  it('gives frames ids unique to each player', async () => {
    const tree = { id: 'layout-page', props: { title: 'Same tree' } };
    await paint(tree);
    await paint(tree);
    const ids = Array.from(document.querySelectorAll('main[data-tx-player-frame]')).map(
      (m) => m.id
    );
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  it('keeps an inactive deck out of the tab order', async () => {
    const { container } = await paint(deck, { active: false });
    expect(container.querySelector('[data-tx-player-surface]')?.hasAttribute('inert')).toBe(true);
  });
});
