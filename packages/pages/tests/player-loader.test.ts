// @vitest-environment happy-dom
import { cleanup, render, waitFor } from '@testing-library/svelte';
import type { DocumentBlock } from '@texuli/document/model';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CollabEditorCore from '../src/collab/CollabEditorCore.svelte';
import { createCollabSession } from '../src/collab/session.svelte.ts';
import PageEditor from '../src/editor/PageEditor.svelte';
import PageEditorCore from '../src/editor/PageEditorCore.svelte';
import { createDocumentPlayerHost, createDocumentPlayerHostCore } from '../src/host/index.ts';
import PagedViewCore from '../src/paged/PagedViewCore.svelte';
import PageReader from '../src/reader/PageReader.svelte';
import PageReaderCore from '../src/reader/PageReaderCore.svelte';
import type { PagesPlayerLoader } from '../src/shared/player-loader.ts';
import { doc } from './fixtures.ts';
import HostBlockStub from './HostBlockStub.svelte';
import PlayerStub from './PlayerStub.svelte';

/*
 * G123: the core components (`editor-core`, `reader-core`, `paged-core`,
 * `collab-core`, `host-core`) paint live embeds only with the host's
 * `loadPlayer`. Without one, an embed that needs the player shows the
 * accessible notice (or goes to the host's block renderer when it claims
 * the fallback); with one, the host's loader paints it, once per loader.
 * The default components keep painting, and `loadPlayer={null}` turns
 * them off.
 */

afterEach(cleanup);

const KPI: DocumentBlock = {
  id: 'kpi',
  type: 'embed',
  kind: 'component',
  title: 'Signups',
  inline: { id: 'charts-donut', props: {} },
};
const DECK: DocumentBlock = {
  id: 'deck',
  type: 'embed',
  kind: 'deck',
  title: 'Review',
  inline: { meta: { title: 'Review' }, slides: [{ id: 's1', props: { title: 'Intro' } }] },
};
const SHEET: DocumentBlock = {
  id: 'sheet',
  type: 'embed',
  kind: 'sheet',
  ref: 'sheets/budget',
  title: 'Budget',
};
const page = () => doc([KPI, DECK, SHEET]);

const states = (root: ParentNode) =>
  [...root.querySelectorAll('figure.tx-pages-embed')].map((item) => [
    item.getAttribute('data-kind'),
    item.getAttribute('data-state'),
  ]);

// biome-ignore lint/suspicious/noExplicitAny: each core takes its own props.
type Mount = (props: Record<string, unknown>) => { container: HTMLElement; props: any };
const cores: [string, Mount][] = [
  [
    'PageEditorCore',
    (props) => ({
      container: render(PageEditorCore, { props: { document: page(), ...props } }).container,
      props,
    }),
  ],
  [
    'PageReaderCore',
    (props) => ({
      container: render(PageReaderCore, { props: { document: page(), ...props } }).container,
      props,
    }),
  ],
  [
    'PagedViewCore',
    (props) => ({
      container: render(PagedViewCore, { props: { document: page(), ...props } }).container,
      props,
    }),
  ],
  [
    'CollabEditorCore',
    (props) => ({
      container: render(CollabEditorCore, {
        props: {
          session: createCollabSession({
            replica: 'ada',
            document: page(),
            author: { name: 'Ada', color: 0 },
          }),
          ...props,
        },
      }).container,
      props,
    }),
  ],
];

/** The collab session's replica keeps no inline deck embed today, so its row checks the component only. */
const withDeck = (name: string) => name !== 'CollabEditorCore';

describe('the player seam (G123)', () => {
  it('shows the notice on every core component with no loader, and keeps references as they were', async () => {
    for (const [name, mount] of cores) {
      const { container } = mount({});
      const expected = [
        ['component', 'off'],
        ...(withDeck(name) ? [['deck', 'off']] : []),
        ['sheet', 'reference'],
      ];
      await waitFor(
        () =>
          expect(
            states(container).filter(([kind]) => kind !== null),
            name
          ).toEqual(expect.arrayContaining(expected)),
        { timeout: 10_000 }
      );
      const notices = [...container.querySelectorAll('[data-player-off]')];
      expect(notices.length, name).toBe(withDeck(name) ? 2 : 1);
      expect(
        notices.every((notice) => notice.getAttribute('role') === 'note'),
        name
      ).toBe(true);
      expect(notices[0]?.textContent, name).toBe(
        'Component embeds are not shown here; the embed is kept.'
      );
      expect(container.querySelector('[data-tx-player]'), name).toBeNull();
      cleanup();
    }
  }, 60_000);

  it('paints with the host loader on every core component, loading it once per loader', async () => {
    for (const [name, mount] of cores) {
      const loadPlayer = vi.fn<PagesPlayerLoader>(async () => ({
        Player: PlayerStub,
      }));
      const { container } = mount({ loadPlayer });
      await waitFor(
        () =>
          expect(
            [...container.querySelectorAll('[data-player-stub]')].map((item) =>
              item.getAttribute('data-player-stub')
            ),
            name
          ).toEqual(
            expect.arrayContaining(
              withDeck(name) ? ['layout-page', 'layout-deck'] : ['layout-page']
            )
          ),
        { timeout: 10_000 }
      );
      expect(container.querySelector('[data-player-off]'), name).toBeNull();
      expect(loadPlayer, name).toHaveBeenCalledTimes(1);
      cleanup();
    }
  }, 60_000);

  it('shows the refused notice when the host loader fails or has no Player', async () => {
    for (const loadPlayer of [
      async () => {
        throw new Error('offline');
      },
      async () => ({}) as never,
    ]) {
      const { container } = render(PageReaderCore, {
        props: { document: doc([KPI]), loadPlayer },
      });
      await waitFor(() => expect(states(container)).toEqual([['component', 'refused']]));
      expect(container.querySelector('[data-refused]')).not.toBeNull();
      cleanup();
    }
  });

  it('hands an embed to the host block renderer when it claims the fallback and no loader paints it', async () => {
    const { container } = render(PageReaderCore, {
      props: {
        document: doc([KPI]),
        blockHost: { claim: () => 'fallback' as const, component: HostBlockStub },
      },
    });
    await waitFor(() =>
      expect(container.querySelector('[data-tx-pages-host] [data-host-node="kpi"]')).not.toBeNull()
    );
    expect(container.querySelector('[data-player-off]')).toBeNull();
  });

  it('turns live embeds off on the default components with loadPlayer={null}', async () => {
    const views = [
      () => render(PageEditor, { props: { document: doc([KPI]), loadPlayer: null } }),
      () => render(PageReader, { props: { document: doc([KPI]), loadPlayer: null } }),
    ];
    for (const view of views) {
      const { container } = view();
      await waitFor(() => expect(states(container)).toEqual([['component', 'off']]));
      cleanup();
    }
  });

  it('passes the loader to the reader the document host mounts, and has none on the core host', async () => {
    const loadPlayer = vi.fn<PagesPlayerLoader>(async () => ({
      Player: PlayerStub,
    }));
    const request = (target: HTMLElement) => ({
      doc: doc([KPI]),
      outline: false,
      tier: 'untrusted' as const,
      label: 'Agent document',
      active: true,
      target,
    });
    const core = document.createElement('div');
    const painted = document.createElement('div');
    const defaults = document.createElement('div');
    document.body.append(core, painted, defaults);
    const stops = [
      createDocumentPlayerHostCore().present(request(core)),
      createDocumentPlayerHostCore({ loadPlayer }).present(request(painted)),
      createDocumentPlayerHost({ loadPlayer: null }).present(request(defaults)),
    ];
    await waitFor(() => {
      expect(states(core)).toEqual([['component', 'off']]);
      expect(painted.querySelector('[data-player-stub="layout-page"]')).not.toBeNull();
      expect(states(defaults)).toEqual([['component', 'off']]);
    });
    expect(loadPlayer).toHaveBeenCalledTimes(1);
    for (const stop of stops) stop?.();
    core.remove();
    painted.remove();
    defaults.remove();
  });
});
