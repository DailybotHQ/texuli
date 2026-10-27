import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { validateCatalogManifests } from '@texuli/catalog/manifest';
import type { RenderCatalog } from '@texuli/catalog/render/renderer';
import { validateDraft } from '@texuli/catalog/validate';
import { createRawSnippet, tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPlayerCatalog } from '../src/catalog.ts';
import { CHAT_DISPLAY_MANIFESTS } from '../src/chat-manifests.ts';
import { sameConditionInputs, stateConditionInputs } from '../src/conditions.ts';
import { PLAYER_NODE_ERROR_CODES, placeholderMessage } from '../src/errors.ts';
import { withoutHostChrome, withoutHostChromeLoaders } from '../src/host-chrome.ts';
import { frameStops } from '../src/keyboard.ts';
import { DEFAULT_PLAYER_LABELS } from '../src/labels.ts';
import { G20_LAYOUT_MANIFESTS, PLAYER_GRAMMAR_ROLES } from '../src/layout-manifests.ts';
import { planFrames } from '../src/layouts/outline.ts';
import { PLAYER_LOADERS } from '../src/loaders.ts';
import { applyMediaPolicy, TRUST_PINNED_IDS } from '../src/media-policy.ts';
import { mountPlayer } from '../src/mount.ts';
import Player from '../src/Player.svelte';
import { HOST_REGION_ID, isHostRegionName } from '../src/region-manifests.ts';
import { skeletonFamily, withLoadTimeout } from '../src/skeletons.ts';
import { groupSlots } from '../src/slots.ts';
import { LOCAL_STATE_FORMAT } from '../src/state/bind.ts';
import type { PlayerPaintNode } from '../src/types.ts';
import HostRegionHarness from './HostRegionHarness.svelte';
import { scenario } from './scenario.ts';

describe('Player', () => {
  afterEach(cleanup);

  const blueprint = {
    id: 'layout-doc',
    props: { title: 'Fictional delivery report' },
    children: [
      {
        id: 'blocks-text',
        props: { block: { type: 'heading', level: 2, text: 'Weekly summary' } },
      },
      {
        id: 'blocks-text',
        props: { block: { type: 'text', markdown: 'All sample work is on track.' } },
      },
    ],
  };

  describe('Player', () => {
    it('validates and paints inside frame chrome, refuses invalid trees and contains failures', async () => {
      await scenario(
        'validates and paints a content blueprint inside visible frame chrome',
        async () => {
          render(Player, { props: { blueprint } });

          expect(screen.getByRole('region', { name: 'Blueprint preview' })).toBeTruthy();
          expect(screen.getByText('Draft')).toBeTruthy();
          expect(
            await screen.findByRole('heading', { level: 1, name: 'Fictional delivery report' })
          ).toBeTruthy();
          // A cold import of the text family can take about a second in happy-dom.
          expect(
            await screen.findByRole(
              'heading',
              { level: 2, name: 'Weekly summary' },
              { timeout: 5000 }
            )
          ).toBeTruthy();
          expect(screen.getByText('All sample work is on track.')).toBeTruthy();
        }
      );
      await scenario(
        'defaults to untrusted validation and refuses invalid trees without painting them',
        async () => {
          render(Player, {
            props: {
              blueprint: {
                id: 'layout-doc',
                props: { title: 'Must not paint', href: 'javascript:alert(1)' },
              },
            },
          });

          expect(screen.getByRole('alert').textContent).toContain('could not be validated');
          expect(screen.queryByRole('heading', { name: 'Must not paint' })).toBeNull();
        }
      );
      await scenario(
        'keeps unsupported valid catalog ids as visible no-loader placeholders',
        async () => {
          const catalog = createPlayerCatalog();
          render(Player, {
            props: {
              catalog,
              blueprint: {
                id: 'layout-page',
                props: { title: 'Page' },
                children: [
                  {
                    id: 'media-image',
                    props: { src: 'https://images.example/ok.png', alt: 'Sample' },
                  },
                ],
              },
              loaders: {
                'layout-page': async () =>
                  import('../src/layouts/ContentLayout.svelte').then((m) => m.default),
              },
            },
          });

          expect(await screen.findByRole('heading', { level: 1, name: 'Page' })).toBeTruthy();
          expect(await screen.findByText(/No painter for “media-image”/)).toBeTruthy();
        }
      );
      await scenario('contains a component paint exception to its own node', async () => {
        render(Player, {
          props: {
            blueprint,
            loaders: {
              ...PLAYER_LOADERS,
              'blocks-text': async () =>
                import('./ThrowingComponent.svelte').then((m) => m.default),
            },
          },
        });

        expect(await screen.findAllByText('“blocks-text” could not be shown')).toHaveLength(2);
        expect(
          screen.getByRole('heading', { level: 1, name: 'Fictional delivery report' })
        ).toBeTruthy();
      });
    });
  });
});

describe('per-node errors', () => {
  const layoutLoader = async () =>
    import('../src/layouts/ContentLayout.svelte').then((m) => m.default);

  const report = {
    id: 'layout-doc',
    props: { title: 'Fictional delivery report' },
    children: [
      { id: 'blocks-text', props: { block: { type: 'text', markdown: 'First sample.' } } },
      { id: 'blocks-text', props: { block: { type: 'text', markdown: 'Second sample.' } } },
    ],
  };

  describe('placeholderMessage', () => {
    it('has fixed copy for every stable code', () => {
      for (const code of PLAYER_NODE_ERROR_CODES) {
        expect(placeholderMessage(code).length).toBeGreaterThan(0);
      }
      expect(new Set(PLAYER_NODE_ERROR_CODES.map(placeholderMessage)).size).toBe(
        PLAYER_NODE_ERROR_CODES.length
      );
    });
  });

  describe('Player per-node error placeholders', () => {
    it('per-node error placeholders carry stable codes, never thrown messages, and report once', async () => {
      await scenario(
        'labels each placeholder with its stable code and never shows the thrown message',
        async () => {
          const onNodeError = vi.fn();
          const { container } = render(Player, {
            props: {
              blueprint: report,
              onNodeError,
              loaders: {
                ...PLAYER_LOADERS,
                'blocks-text': async () =>
                  import('./ThrowingComponent.svelte').then((m) => m.default),
              },
            },
          });

          const notes = await screen.findAllByRole('note', {
            name: '“blocks-text” could not be shown',
          });
          expect(notes).toHaveLength(2);
          for (const note of notes) {
            expect(note.getAttribute('data-tx-player-error')).toBe('node-error');
            expect(note.textContent).toContain(placeholderMessage('node-error'));
          }
          expect(container.textContent).not.toContain('Simulated component paint failure');
          expect(
            screen.getByRole('heading', { level: 1, name: 'Fictional delivery report' })
          ).toBeTruthy();

          expect(onNodeError).toHaveBeenCalledTimes(2);
          expect(onNodeError.mock.calls.map(([event]) => event.path).sort()).toEqual([
            '0.children.0',
            '0.children.1',
          ]);
          const [first] = onNodeError.mock.calls[0] ?? [];
          expect(first).toMatchObject({ code: 'node-error', id: 'blocks-text', phase: 'render' });
          expect(first.error).toBeInstanceOf(Error);
        }
      );
      await scenario('contains a loader that resolves to a non-component', async () => {
        const onNodeError = vi.fn();
        render(Player, {
          props: {
            blueprint: report,
            onNodeError,
            loaders: {
              'layout-doc': layoutLoader,
              'blocks-text': async () => ({ default: 'nope' }),
            },
          },
        });

        const notes = await screen.findAllByRole('note', {
          name: '“blocks-text” could not be shown',
        });
        expect(notes).toHaveLength(2);
        expect(onNodeError).toHaveBeenCalledWith(
          expect.objectContaining({ code: 'node-error', phase: 'invalid-component' })
        );
      });
      await scenario(
        'reports a rejected load once per node, however often the player repaints',
        async () => {
          const onNodeError = vi.fn();
          render(Player, {
            props: {
              blueprint: report,
              onNodeError,
              loaders: {
                'layout-doc': layoutLoader,
                'blocks-text': async () => Promise.reject(new Error('offline')),
              },
            },
          });

          expect(
            await screen.findAllByRole('note', { name: '“blocks-text” could not be shown' })
          ).toHaveLength(2);
          expect(onNodeError).toHaveBeenCalledTimes(2);
          expect(onNodeError.mock.calls.every(([event]) => event.phase === 'load')).toBe(true);
        }
      );
      await scenario('explains unknown ids in a preview with their own code', async () => {
        render(Player, {
          props: {
            invalidPolicy: 'preview',
            blueprint: {
              id: 'layout-page',
              props: { title: 'Preview' },
              children: [{ id: 'not-a-real-component', props: {} }],
            },
          },
        });

        const note = await screen.findByRole('note', {
          name: 'Unknown component “not-a-real-component”',
        });
        expect(note.getAttribute('data-tx-player-error')).toBe('unknown-id');
        expect(note.textContent).toContain(placeholderMessage('unknown-id'));
      });
    });
  });
});

describe('lazy loaders', () => {
  const layoutLoader = async () =>
    import('../src/layouts/ContentLayout.svelte').then((m) => m.default);

  function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => {
      resolve = r;
    });
    return { promise, resolve };
  }

  describe('skeletonFamily', () => {
    it('maps catalog id prefixes to skeleton shapes', () => {
      expect(skeletonFamily('layout-doc')).toBe('layout');
      expect(skeletonFamily('blocks-text')).toBe('block');
      expect(skeletonFamily('charts-bar')).toBe('chart');
      expect(skeletonFamily('media-image')).toBe('media');
      expect(skeletonFamily('something-else')).toBe('generic');
    });
  });

  describe('withLoadTimeout', () => {
    it('skeletonFamily and withLoadTimeout', async () => {
      await scenario('rejects a load that never settles once the timeout passes', async () => {
        vi.useFakeTimers();
        try {
          const loaders = withLoadTimeout({ slow: () => new Promise(() => {}) }, 50);
          const result = loaders.slow?.();
          const settled = expect(result).rejects.toThrow(/timed out after 50 ms/);
          await vi.advanceTimersByTimeAsync(60);
          await settled;
        } finally {
          vi.useRealTimers();
        }
      });
      await scenario(
        'passes resolved values and rejections through, and keeps loaders when disabled',
        async () => {
          const loaders = {
            ok: async () => 'value',
            bad: async () => Promise.reject(new Error('no')),
          };
          const wrapped = withLoadTimeout(loaders, 1000);
          await expect(wrapped.ok?.()).resolves.toBe('value');
          await expect(wrapped.bad?.()).rejects.toThrow('no');
          expect(withLoadTimeout(loaders, 0)).toBe(loaders);
          expect(withLoadTimeout(loaders, Number.POSITIVE_INFINITY)).toBe(loaders);
        }
      );
    });
  });

  describe('Player lazy loaders', () => {
    it('lazy loaders show family skeletons, load only used ids and time out to placeholders', async () => {
      await scenario(
        'shows a labelled family skeleton while a node loads, then the component',
        async () => {
          const gate = deferred<unknown>();
          const { container } = render(Player, {
            props: {
              blueprint: {
                id: 'layout-doc',
                props: { title: 'Fictional report' },
                children: [
                  {
                    id: 'blocks-text',
                    props: { block: { type: 'text', markdown: 'Loaded text.' } },
                  },
                ],
              },
              loaders: {
                'layout-doc': layoutLoader,
                'blocks-text': () => gate.promise,
              },
            },
          });

          expect(
            await screen.findByRole('heading', { level: 1, name: 'Fictional report' })
          ).toBeTruthy();
          const skeleton = container.querySelector('[data-tx-player-skeleton="blocks-text"]');
          expect(skeleton?.getAttribute('data-family')).toBe('block');
          expect(skeleton?.getAttribute('aria-busy')).toBe('true');
          // Not a live region: the player's one announcer speaks once the paint settles.
          expect(skeleton?.hasAttribute('role')).toBe(false);
          expect(skeleton?.textContent).toMatch(/Loading .+…/);

          gate.resolve(await PLAYER_LOADERS['blocks-text']?.());
          expect(await screen.findByText('Loaded text.')).toBeTruthy();
          expect(container.querySelector('[data-tx-player-skeleton]')).toBeNull();
        }
      );
      await scenario('only calls the loaders for the ids the blueprint paints', async () => {
        const used = vi.fn(layoutLoader);
        const unused = vi.fn(layoutLoader);
        render(Player, {
          props: {
            blueprint: { id: 'layout-page', props: { title: 'Lazy page' } },
            loaders: { 'layout-page': used, 'layout-doc': unused },
          },
        });

        expect(await screen.findByRole('heading', { level: 1, name: 'Lazy page' })).toBeTruthy();
        expect(used).toHaveBeenCalledTimes(1);
        expect(unused).not.toHaveBeenCalled();
      });
      await scenario(
        'replaces a skeleton that outlives loadTimeoutMs with an error placeholder',
        async () => {
          const { container } = render(Player, {
            props: {
              blueprint: { id: 'layout-page', props: { title: 'Never loads' } },
              loaders: { 'layout-page': () => new Promise(() => {}) },
              loadTimeoutMs: 20,
            },
          });

          expect(container.querySelector('[data-tx-player-skeleton="layout-page"]')).toBeTruthy();
          expect(await screen.findByText('“layout-page” could not be shown')).toBeTruthy();
          expect(container.querySelector('[data-tx-player-skeleton]')).toBeNull();
        }
      );
    });
  });
});

describe('block validation', () => {
  const layoutLoader = async () =>
    import('../src/layouts/ContentLayout.svelte').then((m) => m.default);

  /** Blocks the core parser does not know, but their own family renders (audit G05). */
  const FAMILY_ONLY: ReadonlyArray<[string, Record<string, unknown>]> = [
    [
      'blocks-diagram',
      {
        type: 'flow',
        nodes: [
          { id: 'plan', label: 'Plan' },
          { id: 'ship', label: 'Ship' },
        ],
        edges: [{ from: 'plan', to: 'ship' }],
      },
    ],
    ['blocks-embed', { type: 'link-preview', href: 'https://example.com/guide', title: 'Guide' }],
    [
      'blocks-map',
      {
        type: 'map',
        label: 'Fictional harbor',
        points: [{ id: 'north', label: 'North Pier', lat: 10, lng: 20 }],
      },
    ],
  ];

  function doc(id: string, block: unknown) {
    return {
      id: 'layout-doc',
      props: { title: 'Family report' },
      children: [{ id, props: { block } }],
    };
  }

  describe('Player block validation', () => {
    it('block validation accepts each family on its own id and refuses another family', async () => {
      await scenario(
        'accepts a valid block of every family checked by its own family',
        async () => {
          for (const [id, block] of FAMILY_ONLY) {
            cleanup();
            const onDiagnostics = vi.fn();
            render(Player, {
              props: {
                blueprint: doc(id, block),
                loaders: { 'layout-doc': layoutLoader, [id]: () => new Promise(() => {}) },
                loadTimeoutMs: 0,
                onDiagnostics,
              },
            });
            expect(screen.queryByRole('alert'), id).toBeNull();
            expect(onDiagnostics.mock.calls[0]?.[0].receipt.ok, id).toBe(true);
          }
        }
      );
      await scenario('refuses a block that another family renders', async () => {
        render(Player, {
          props: { blueprint: doc('blocks-text', FAMILY_ONLY[0]?.[1]) },
        });
        expect(screen.getByRole('alert').textContent).toContain('could not be validated');
      });
    });
  });
});

describe('chat display (G10)', () => {
  const stub = async () => import('./ChatStub.svelte').then((m) => m.default);

  function transcript(message: Record<string, unknown>, extra: unknown[] = []) {
    return {
      id: 'layout-doc',
      props: { title: 'Stand-up notes' },
      children: [
        {
          id: 'chat-thread',
          props: { label: 'Stand-up thread' },
          children: [{ id: 'chat-message', props: message, children: extra }, ...[]],
        },
      ],
    };
  }

  const agentReply = {
    author: 'Fictional Agent',
    role: 'agent',
    at: '2026-10-24T09:00:00Z',
    text: 'Two items are **blocked**.',
  };

  describe('G10 chat display ids', () => {
    it('G10 chat display: valid emittable manifests, untrusted validation, refusals and host-loaded painting', async () => {
      await scenario('ships valid manifests that agents may emit', async () => {
        expect(validateCatalogManifests(CHAT_DISPLAY_MANIFESTS)).toMatchObject({ valid: true });
        const catalog = createPlayerCatalog();
        for (const id of ['chat-thread', 'chat-message']) {
          expect(catalog.get(id)).toBeTruthy();
          expect(catalog.allows?.(id, 'untrusted')).toBe(true);
        }
      });
      await scenario(
        'validates a chat transcript with block children under the untrusted tier',
        async () => {
          const onDiagnostics = vi.fn();
          render(Player, {
            props: {
              blueprint: transcript(agentReply, [
                { id: 'blocks-text', props: { block: { type: 'text', markdown: 'Details.' } } },
              ]),
              loaders: {},
              onDiagnostics,
            },
          });
          const [event] = onDiagnostics.mock.calls[0] ?? [];
          expect(event.receipt.ok).toBe(true);
          expect(
            event.diagnostics.filter((d: { severity: string }) => d.severity === 'error')
          ).toEqual([]);
        }
      );
      await scenario('refuses an unknown role, a missing author and HTML text', async () => {
        for (const [name, message] of BAD_MESSAGES) {
          render(Player, { props: { blueprint: transcript(message), loaders: {} } });
          expect(screen.getByRole('alert').textContent, name).toContain('could not be validated');
          cleanup();
        }
      });
      await scenario('shows no-painter placeholders until the host adds chat loaders', async () => {
        render(Player, { props: { blueprint: transcript(agentReply) } });
        expect(await screen.findByText(/No painter for “chat-thread”/)).toBeTruthy();
      });
      await scenario('paints the thread, message and block body through host loaders', async () => {
        const { container } = render(Player, {
          props: {
            blueprint: transcript(agentReply, [
              { id: 'blocks-text', props: { block: { type: 'text', markdown: 'Body block.' } } },
            ]),
            loaders: { ...PLAYER_LOADERS, 'chat-thread': stub, 'chat-message': stub },
          },
        });
        expect(await screen.findByText('Fictional Agent')).toBeTruthy();
        expect(await screen.findByText('Body block.', {}, { timeout: 5000 })).toBeTruthy();
        const thread = container.querySelector('[aria-label="Stand-up thread"]');
        expect(thread?.querySelector('[data-role="agent"]')).toBeTruthy();
      });
    });

    const BAD_MESSAGES: ReadonlyArray<[string, Record<string, unknown>]> = [
      ['an unknown role', { ...agentReply, role: 'admin' }],
      ['a missing author', { role: 'agent', text: 'Hi' }],
      ['HTML text', { ...agentReply, text: '<img src=x onerror=alert(1)>' }],
    ];
  });
});

describe('host chrome', () => {
  const layoutLoader = async () =>
    import('../src/layouts/ContentLayout.svelte').then((m) => m.default);

  /** A host catalog that (wrongly) lists a composer as agent-emittable content. */
  function catalogWithComposer(): RenderCatalog {
    const base = createPlayerCatalog();
    const composer = {
      id: 'chat-composer',
      label: 'Chat composer',
      props: [],
      agentEmittable: true,
      emit: ['developer', 'untrusted'] as const,
    };
    return {
      get: (id) => (id === 'chat-composer' ? composer : base.get(id)),
      allows: (id, tier) => id === 'chat-composer' || (base.allows?.(id, tier) ?? false),
    };
  }

  const blueprint = {
    id: 'layout-page',
    props: { title: 'Thread artifact' },
    children: [{ id: 'chat-composer', props: {} }],
  };

  describe('composer host-chrome contract', () => {
    it('the composer is host chrome: denied at every tier, never loaded, placeholdered, and painted from the host snippet', async () => {
      await scenario(
        'denies host-chrome ids at every tier, even when the host catalog allows them',
        async () => {
          const catalog = withoutHostChrome(catalogWithComposer());
          expect(catalog.allows?.('chat-composer', 'developer')).toBe(false);
          expect(catalog.allows?.('chat-composer', 'untrusted')).toBe(false);
          expect(catalog.allows?.('layout-page', 'untrusted')).toBe(true);
          const loaders = withoutHostChromeLoaders({
            'chat-composer': layoutLoader,
            x: layoutLoader,
          });
          expect(Object.keys(loaders)).toEqual(['x']);
        }
      );
      await scenario(
        'refuses a blueprint that tries to paint a composer, and never loads its painter',
        async () => {
          const composerLoader = vi.fn(layoutLoader);
          render(Player, {
            props: {
              blueprint,
              catalog: catalogWithComposer(),
              tier: 'developer',
              loaders: { 'layout-page': layoutLoader, 'chat-composer': composerLoader },
            },
          });
          expect(screen.getByRole('alert').textContent).toContain('could not be validated');
          expect(composerLoader).not.toHaveBeenCalled();
        }
      );
      await scenario('shows the refused composer as a placeholder in a preview', async () => {
        const composerLoader = vi.fn(layoutLoader);
        const { container } = render(Player, {
          props: {
            blueprint,
            catalog: catalogWithComposer(),
            invalidPolicy: 'preview',
            loaders: { 'layout-page': layoutLoader, 'chat-composer': composerLoader },
          },
        });
        expect(
          await screen.findByRole('heading', { level: 1, name: 'Thread artifact' })
        ).toBeTruthy();
        expect(
          container
            .querySelector('[data-tx-player-node="chat-composer"]')
            ?.getAttribute('data-reason')
        ).toBe('tier-denied');
        expect(composerLoader).not.toHaveBeenCalled();
      });
      await scenario('paints the host composer snippet outside the validated surface', async () => {
        const composer = createRawSnippet(() => ({
          render: () =>
            '<form data-testid="host-composer"><label>Reply<textarea></textarea></label></form>',
        }));
        const { container } = render(Player, {
          props: {
            blueprint: { id: 'layout-page', props: { title: 'Artifact' } },
            loaders: { 'layout-page': layoutLoader },
            composer,
          },
        });
        await screen.findByRole('heading', { level: 1, name: 'Artifact' });
        const chrome = container.querySelector('[data-tx-player-host-chrome="composer"]');
        const surface = container.querySelector('[data-tx-player-surface]');
        expect(chrome?.contains(screen.getByTestId('host-composer'))).toBe(true);
        expect(surface?.contains(chrome ?? null)).toBe(false);
      });
    });
  });
});

describe('host regions', () => {
  /**
   * Host-owned regions (player design R21, audit G18; Task 62): a `host-region`
   * node reserves a named place, the host mounts its own component there with
   * no blueprint data, and a name the host does not provide paints the label.
   */

  const region = (name: string, label = 'Payment details') => ({
    id: HOST_REGION_ID,
    props: { name, label },
  });
  const checkout = (...children: object[]) => ({
    id: 'layout-page',
    props: { title: 'Checkout' },
    children: [{ id: 'layout-card', props: { title: 'Order summary' } }, ...children],
  });

  describe('host-region manifest', () => {
    it('host-region manifest is in both tiers and accepts only kebab-case names', () => {
      // is in the player catalog for both tiers
      {
        const catalog = createPlayerCatalog();
        expect(catalog.get(HOST_REGION_ID)?.props.map((p) => p.name)).toEqual(['name', 'label']);
        expect(catalog.allows?.(HOST_REGION_ID, 'untrusted')).toBe(true);
        expect(catalog.allows?.(HOST_REGION_ID, 'developer')).toBe(true);
      }
      for (const name of ['payment', 'sign-in', 'a1'])
        expect(isHostRegionName(name), name).toBe(true);
      for (const name of ['Payment', '__proto__', 'constructor!', '', '-x', 'a'.repeat(33)]) {
        expect(isHostRegionName(name), name).toBe(false);
      }
    });
  });

  describe('painting host regions', () => {
    it('host regions mount once in a labelled group, fall back to labels, and let host forms submit', async () => {
      await scenario(
        'mounts the host snippet in a labelled group, inside an untrusted blueprint',
        async () => {
          const { container } = render(HostRegionHarness, {
            props: { blueprint: checkout(region('payment')) },
          });
          const group = await screen.findByRole('group', { name: 'Payment details' });
          expect(group.getAttribute('data-tx-player-host-region')).toBe('payment');
          expect(group.querySelector('[data-host-form] input[name="card"]')).not.toBeNull();
          expect(container.querySelector('[data-tx-player-host-region-missing]')).toBeNull();
        }
      );
      await scenario('paints the label when the host does not provide the region', async () => {
        const { container } = render(HostRegionHarness, {
          props: { blueprint: checkout(region('sign-in', 'Sign in to continue')) },
        });
        expect(await screen.findByText('Sign in to continue')).toBeTruthy();
        expect(screen.getByText('Provided by the app; not available here.')).toBeTruthy();
        expect(container.querySelector('[data-host-form]')).toBeNull();
        expect(screen.queryByRole('group', { name: 'Sign in to continue' })).toBeNull();
      });
      await scenario('mounts a region name once: a second node shows its label', async () => {
        const { container } = render(HostRegionHarness, {
          props: { blueprint: checkout(region('payment'), region('payment', 'Pay again')) },
        });
        await screen.findByRole('group', { name: 'Payment details' });
        expect(container.querySelectorAll('[data-host-form]')).toHaveLength(1);
        expect(screen.getByText('Pay again')).toBeTruthy();
        expect(screen.getByText('Already shown above.')).toBeTruthy();
      });
      await scenario(
        'never mounts a host snippet for a name outside the region pattern',
        async () => {
          const { container } = render(HostRegionHarness, {
            props: {
              blueprint: checkout(region('Payment', 'Odd name')),
              provide: ['payment', 'Payment'],
            },
          });
          expect(await screen.findByText('Odd name')).toBeTruthy();
          expect(container.querySelector('[data-host-hostile]')).toBeNull();
          expect(container.querySelector('[data-host-form]')).toBeNull();
        }
      );
      await scenario(
        'lets a form the host mounted in its region submit, unlike painted content',
        async () => {
          const { container } = render(HostRegionHarness, {
            props: { blueprint: checkout(region('payment')) },
          });
          await screen.findByRole('group', { name: 'Payment details' });
          const form = container.querySelector<HTMLFormElement>(
            '[data-host-form]'
          ) as HTMLFormElement;
          const hostSubmit = new Event('submit', { bubbles: true, cancelable: true });
          form.dispatchEvent(hostSubmit);
          expect(hostSubmit.defaultPrevented).toBe(false);

          // A form outside a host region is still cancelled at the surface (D14).
          const painted = document.createElement('form');
          const card = container.querySelector('[data-tx-player-host-region]')?.parentElement;
          card?.parentElement?.append(painted);
          const paintedSubmit = new Event('submit', { bubbles: true, cancelable: true });
          painted.dispatchEvent(paintedSubmit);
          expect(paintedSubmit.defaultPrevented).toBe(true);
          painted.remove();
        }
      );
    });
  });
});

describe('media policy', () => {
  async function paint(children: unknown[], extra: Record<string, unknown> = {}) {
    const view = render(Player, {
      props: { blueprint: page(children), loaders: PLAYER_LOADERS, ...extra },
    });
    await screen.findByRole('heading', { level: 1, name: 'Media' }, { timeout: 5000 });
    await waitFor(
      () => expect(view.container.querySelector('[data-tx-player-skeleton]')).toBeNull(),
      {
        timeout: 10_000,
      }
    );
    return view;
  }

  const labels = DEFAULT_PLAYER_LABELS;
  const page = (children: unknown[]) => ({
    id: 'layout-page',
    props: { title: 'Media' },
    children,
  });

  describe('media policy', () => {
    it('media policy pins trust, disables autoplay and labels blank alts', () => {
      for (const id of TRUST_PINNED_IDS) {
        expect(applyMediaPolicy(id, { trust: 'developer', alt: 'x' }, labels).trust).toBe(
          'untrusted'
        );
        expect(applyMediaPolicy(id, { alt: 'x' }, labels).trust).toBe('untrusted');
      }
      // leaves non-media props as the same object
      {
        const props = { title: 'Card', trust: 'developer' };
        expect(applyMediaPolicy('layout-card', props, labels)).toBe(props);
        const image = { block: { type: 'image', src: 'media/a.png', alt: 'A' } };
        expect(applyMediaPolicy('blocks-media', image, labels)).toBe(image);
      }
      // turns off video autoplay and keeps its controls on
      {
        const out = applyMediaPolicy(
          'blocks-media',
          {
            block: {
              type: 'video',
              src: 'media/v.mp4',
              label: 'Demo',
              autoplay: true,
              muted: true,
              controls: false,
            },
          },
          labels
        );
        expect(out.block).toMatchObject({ autoplay: false, controls: true, muted: true });
      }
      expect(applyMediaPolicy('media-image', { alt: '  ' }, labels).alt).toBe(labels.mediaNoAlt);
      expect(applyMediaPolicy('media-image', { alt: 'Harbor' }, labels).alt).toBe('Harbor');
    });
  });

  describe('media nodes painted in the player', () => {
    it('painted media never autoplays, stays untrusted, has a text alternative and stays inert until loaded', async () => {
      await scenario('never autoplays agent video and keeps it keyboard-operable', async () => {
        const { container } = await paint([
          {
            id: 'blocks-media',
            props: {
              block: {
                type: 'video',
                src: 'media/demo.mp4',
                width: 640,
                height: 360,
                label: 'Fictional demo',
                autoplay: true,
                muted: true,
                controls: false,
              },
            },
          },
        ]);
        const video = await waitFor(() => {
          const element = container.querySelector('video');
          expect(element).not.toBeNull();
          return element as HTMLVideoElement;
        });
        expect(video.hasAttribute('autoplay')).toBe(false);
        expect(video.autoplay).toBe(false);
        expect(video.hasAttribute('controls')).toBe(true);
        expect(video.getAttribute('aria-label')).toBe('Fictional demo');
      });
      await scenario(
        'keeps media-image on the untrusted policy whatever trust the blueprint claims',
        async () => {
          const { container } = await paint(
            [
              {
                id: 'media-image',
                props: {
                  src: 'https://images.example/harbor.png',
                  srcset: 'http://images.example/harbor-2x.png 2x',
                  alt: 'Fictional harbor',
                  trust: 'developer',
                },
              },
            ],
            // Let the developer tier validate the HTTP candidate so this exercises
            // the player's paint-time clamp back to untrusted media policy.
            { tier: 'developer' }
          );
          const img = await waitFor(() => {
            const element = container.querySelector('img');
            expect(element).not.toBeNull();
            return element as HTMLImageElement;
          });
          expect(img.getAttribute('src')).toBe('https://images.example/harbor.png');
          // An HTTP srcset passes only developer trust; untrusted drops it.
          expect(img.getAttribute('srcset')).toBeNull();
          expect(img.getAttribute('referrerpolicy')).toBe('no-referrer');
          expect(img.getAttribute('alt')).toBe('Fictional harbor');
        }
      );
      await scenario('exposes a text alternative for a media-image with a blank alt', async () => {
        const { container } = await paint([
          { id: 'media-image', props: { src: 'https://images.example/a.png', alt: '' } },
        ]);
        const img = await waitFor(() => {
          const element = container.querySelector('img');
          expect(element).not.toBeNull();
          return element as HTMLImageElement;
        });
        expect(img.getAttribute('alt')).toBe('Image without a description');
      });
      await scenario(
        'keeps the block alt contract: decorative is silent, undescribed is refused',
        async () => {
          const { container } = await paint([
            {
              id: 'blocks-media',
              props: {
                block: {
                  type: 'image',
                  src: 'media/line.png',
                  decorative: true,
                  width: 640,
                  height: 4,
                },
              },
            },
          ]);
          await waitFor(() => expect(container.querySelector('img')?.getAttribute('alt')).toBe(''));
          const refused = render(Player, {
            props: {
              blueprint: page([
                {
                  id: 'blocks-media',
                  props: { block: { type: 'image', src: 'media/a.png', width: 640, height: 360 } },
                },
              ]),
              loaders: PLAYER_LOADERS,
            },
          });
          expect(refused.container.querySelector('[role="alert"]')?.textContent).toContain(
            'could not be validated'
          );
          expect(refused.container.querySelector('img')).toBeNull();
        }
      );
      await scenario('keeps media inert until its painter resolves', async () => {
        const { container } = render(Player, {
          props: {
            blueprint: page([
              {
                id: 'blocks-media',
                props: {
                  block: {
                    type: 'video',
                    src: 'media/m.mp4',
                    label: 'Clip',
                    width: 640,
                    height: 360,
                  },
                },
              },
            ]),
            loaders: { ...PLAYER_LOADERS, 'blocks-media': () => new Promise(() => {}) },
            loadTimeoutMs: 0,
          },
        });
        await screen.findByRole('heading', { level: 1, name: 'Media' }, { timeout: 5000 });
        const skeleton = container.querySelector('[data-tx-player-skeleton="blocks-media"]');
        expect(skeleton?.hasAttribute('inert')).toBe(true);
        expect(container.querySelector('video')).toBeNull();
      });
    });
  });
});

describe('landmarks', () => {
  async function paint(extra: object = {}) {
    const view = render(Player, {
      props: { blueprint, tier: 'developer', loaders: PLAYER_LOADERS, ...extra },
    });
    await screen.findAllByRole('heading', { level: 1 }, { timeout: 5000 });
    await waitFor(
      () => expect(view.container.querySelector('[data-tx-player-skeleton]')).toBeNull(),
      { timeout: 5000 }
    );
    await tick();
    return view;
  }

  const blueprint = { id: 'layout-page', props: { title: 'Thread artifact' } };

  afterEach(cleanup);

  describe('player landmark ownership', () => {
    it('the page layout is main by default and a section when the host owns the landmark', async () => {
      await scenario(
        'paints the page layout as main by default (standalone document)',
        async () => {
          const { container } = await paint();
          // A standalone document has no host main, so the page layout owns it.
          expect(container.querySelector('main.tx-player-layout--page')).not.toBeNull();
          expect(container.querySelector('section.tx-player-layout--page')).toBeNull();
        }
      );
      await scenario(
        'paints a section instead when the host owns the landmark (landmarks={false})',
        async () => {
          const { container } = await paint({ landmarks: false });
          // Embedded players must never claim a second main: the /builder/ page
          // fails the duplicate-main axe rule otherwise.
          expect(container.querySelector('section.tx-player-layout--page')).not.toBeNull();
          expect(container.querySelector('main')).toBeNull();
          expect(container.querySelector('h1')?.textContent).toBe('Thread artifact');
        }
      );
    });
  });
});

describe('layout painters', () => {
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

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('title headings follow the grammar titleHeading rule', () => {
    it('title headings follow titleHeading ranks with no skips', async () => {
      await scenario(
        'ranks fixed and nested titles, and untitled frames open no section',
        async () => {
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
        }
      );
      await scenario(
        'paints those ranks, and validateDraft finds no heading skips in the same tree',
        async () => {
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
          const validation = validateDraft(tree, {
            catalog: createPlayerCatalog(),
            tier: 'untrusted',
          });
          expect(validation.diagnostics.filter((d) => d.check === 'grammar')).toEqual([]);
          await paint(tree);
          expect(screen.getByRole('heading', { level: 1, name: 'Quarterly page' })).toBeTruthy();
          expect(screen.getByRole('heading', { level: 2, name: 'Revenue' })).toBeTruthy();
          expect(screen.getByRole('heading', { level: 3, name: 'Detail' })).toBeTruthy();
          expect(screen.getByRole('region', { name: 'Revenue' })).toBeTruthy();
        }
      );
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

      const onPage = planFrames(
        [plan('layout-page', { title: 'Page' }, [heading('Intro', 2)])],
        'p'
      );
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

    it('document layouts: decks, frame stops, locales, contents, grid gaps, unique ids and inactive decks', async () => {
      await scenario(
        'paints a deck as a document flow of slides, under the untrusted tier',
        async () => {
          const { container } = await paint(deck);
          expect(
            screen.getByRole('heading', { level: 1, name: 'Fictional planning deck' })
          ).toBeTruthy();
          expect(screen.getByRole('heading', { level: 2, name: 'Opening' })).toBeTruthy();
          expect(screen.getByRole('heading', { level: 3, name: 'Billing' })).toBeTruthy();
          expect(
            container.querySelector('article.tx-player-layout--deck')?.getAttribute('lang')
          ).toBe('en-GB');
          const notes = container.querySelector('details.tx-player-layout__notes');
          expect(notes?.querySelector('summary')?.textContent).toBe('Speaker notes');
          expect(notes?.textContent).toContain('Greet the team.');
          expect(await screen.findByText('On track.', {}, { timeout: 5000 })).toBeTruthy();
        }
      );
      await scenario('makes deck, slides and cards frame stops in reading order', async () => {
        const { container } = await paint(deck);
        expect(frameStops(container).map((frame) => frame.className.match(/--(\w+)/)?.[1])).toEqual(
          ['deck', 'slide', 'slide', 'card']
        );
      });
      await scenario(
        'drops a deck locale that is not a language tag; markup in it refuses the deck',
        async () => {
          const { container } = await paint({
            ...deck,
            props: { ...deck.props, locale: 'not a tag' },
          });
          expect(
            container.querySelector('article.tx-player-layout--deck')?.hasAttribute('lang')
          ).toBe(false);
          document.body.innerHTML = '';
          const hostile = render(Player, {
            props: {
              blueprint: { ...deck, props: { ...deck.props, locale: 'en" onload="x' } },
              loaders: PLAYER_LOADERS,
            },
          });
          expect(screen.getByRole('alert').textContent).toContain('could not be validated');
          expect(hostile.container.querySelector('[lang]')).toBeNull();
        }
      );
      await scenario(
        'lists a document’s titled frames as contents that focus the frame',
        async () => {
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
        }
      );
      await scenario(
        'omits contents when toc is false or fewer than two frames are titled',
        async () => {
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
        }
      );
      await scenario('localizes contents and speaker-notes labels', async () => {
        await paint(deck, { labels: { speakerNotes: 'Notas del orador' } });
        expect(document.querySelector('summary')?.textContent).toBe('Notas del orador');
      });
      await scenario('applies a bounded grid gap and refuses style injection', async () => {
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
        const style =
          container.querySelector('.tx-player-layout--grid')?.getAttribute('style') ?? '';
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
          const style = view.container
            .querySelector('.tx-player-layout--grid')
            ?.getAttribute('style');
          if (style !== undefined && style !== null) {
            expect(style.replace(/;\s*$/, '')).toBe('--tx-player-columns: 3');
          }
          view.unmount();
        }
      });
      await scenario('gives frames ids unique to each player', async () => {
        const tree = { id: 'layout-page', props: { title: 'Same tree' } };
        await paint(tree);
        await paint(tree);
        const ids = Array.from(document.querySelectorAll('main[data-tx-player-frame]')).map(
          (m) => m.id
        );
        expect(ids).toHaveLength(2);
        expect(new Set(ids).size).toBe(2);
      });
      await scenario('keeps an inactive deck out of the tab order', async () => {
        const { container } = await paint(deck, { active: false });
        expect(container.querySelector('[data-tx-player-surface]')?.hasAttribute('inert')).toBe(
          true
        );
      });
    });
  });
});

describe('G20 layouts', () => {
  async function paint(blueprint: unknown, extra: Record<string, unknown> = {}) {
    const view = render(Player, { props: { blueprint, loaders: PLAYER_LOADERS, ...extra } });
    await screen.findByRole('heading', { level: 1 }, { timeout: 5000 });
    await waitFor(
      () => expect(view.container.querySelector('[data-tx-player-skeleton]')).toBeNull(),
      {
        timeout: 5000,
      }
    );
    await tick();
    return view;
  }

  const card = (title: string) => ({ id: 'layout-card', props: { title } });

  /** A dashboard built only from the G20 vocabulary plus cards. */
  const dashboard = {
    id: 'layout-page',
    props: { title: 'Fictional operations' },
    children: [
      {
        id: 'layout-stack',
        props: { gap: 'small' },
        children: [
          {
            id: 'layout-row',
            props: { gap: 'small', align: 'center' },
            children: [card('Opened'), card('Solved')],
          },
          {
            id: 'layout-split',
            props: { ratio: '2:1', gap: 'large' },
            children: [card('Trend'), card('Notes')],
          },
        ],
      },
      {
        id: 'layout-grid',
        props: { columns: 3 },
        children: [
          { id: 'layout-tile', props: { title: 'Wide tile', span: 2, rowSpan: 2 } },
          { id: 'layout-tile', props: { title: 'Small tile' } },
        ],
      },
    ],
  };

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('G20 layout vocabulary', () => {
    it('G20 layouts: valid manifests, untrusted dashboards, closed tokens, clamped spans and frame stops', async () => {
      await scenario('ships valid, agent-emittable manifests and grammar roles', async () => {
        expect(validateCatalogManifests(G20_LAYOUT_MANIFESTS)).toMatchObject({ valid: true });
        const catalog = createPlayerCatalog();
        for (const id of ['layout-stack', 'layout-row', 'layout-split', 'layout-tile']) {
          expect(catalog.allows?.(id, 'untrusted')).toBe(true);
          expect(PLAYER_GRAMMAR_ROLES.get(id)?.role).toBe('container');
        }
        expect(PLAYER_GRAMMAR_ROLES.get('layout-tile')?.titleHeading).toBe('nested');
      });
      await scenario(
        'validates a G20 dashboard under the untrusted tier with no grammar issues',
        async () => {
          const validation = validateDraft(dashboard, {
            catalog: createPlayerCatalog(),
            tier: 'untrusted',
            roles: PLAYER_GRAMMAR_ROLES,
          });
          expect(validation.ok).toBe(true);
          expect(validation.diagnostics).toEqual([]);
        }
      );
      await scenario('paints each layout with closed tokens and keeps reading order', async () => {
        const { container } = await paint(dashboard);
        const stack = container.querySelector('.tx-player-layout--stack');
        const row = container.querySelector('.tx-player-layout--row');
        const split = container.querySelector('.tx-player-layout--split');
        expect(stack?.getAttribute('data-gap')).toBe('small');
        expect(row?.getAttribute('data-align')).toBe('center');
        expect(row?.getAttribute('data-wrap')).toBe('true');
        expect(split?.getAttribute('data-ratio')).toBe('2:1');
        expect(split?.getAttribute('data-gap')).toBe('large');
        for (const element of [stack, row, split])
          expect(element?.hasAttribute('style')).toBe(false);
        // DOM order is the tree order (no visual reordering).
        const titles = Array.from(container.querySelectorAll('.tx-player-layout__title')).map(
          (h) => h.textContent
        );
        expect(titles).toEqual([
          'Fictional operations',
          'Opened',
          'Solved',
          'Trend',
          'Notes',
          'Wide tile',
          'Small tile',
        ]);
      });
      await scenario(
        'ranks tile titles like cards and spans tiles with clamped integers',
        async () => {
          const { container } = await paint(dashboard);
          expect(screen.getByRole('heading', { level: 2, name: 'Wide tile' })).toBeTruthy();
          const tiles = container.querySelectorAll<HTMLElement>('.tx-player-layout--tile');
          expect(tiles[0]?.getAttribute('style')?.replace(/;\s*$/, '')).toBe(
            '--tx-player-span: 2; --tx-player-row-span: 2'
          );
          expect(tiles[1]?.getAttribute('style')?.replace(/;\s*$/, '')).toBe(
            '--tx-player-span: 1; --tx-player-row-span: 1'
          );
        }
      );
      await scenario('clamps out-of-range spans and refuses free-text tokens', async () => {
        const { container } = await paint({
          id: 'layout-page',
          props: { title: 'Clamp' },
          children: [
            {
              id: 'layout-grid',
              props: { columns: 2 },
              children: [
                { id: 'layout-tile', props: { title: 'Huge', span: 1e9, rowSpan: 9 } },
                { id: 'layout-tile', props: { title: 'Negative', span: -3, rowSpan: 0.5 } },
              ],
            },
          ],
        });
        const tiles = container.querySelectorAll<HTMLElement>('.tx-player-layout--tile');
        expect(tiles[0]?.getAttribute('style')?.replace(/;\s*$/, '')).toBe(
          '--tx-player-span: 4; --tx-player-row-span: 2'
        );
        expect(tiles[1]?.getAttribute('style')?.replace(/;\s*$/, '')).toBe(
          '--tx-player-span: 1; --tx-player-row-span: 1'
        );

        const hostile = validateDraft(
          {
            id: 'layout-page',
            props: { title: 'Hostile' },
            children: [
              { id: 'layout-stack', props: { gap: '1rem; background:url(javascript:alert(1))' } },
            ],
          },
          { catalog: createPlayerCatalog(), tier: 'untrusted', roles: PLAYER_GRAMMAR_ROLES }
        );
        expect(hostile.ok).toBe(false);
      });
      await scenario(
        'makes every G20 layout a frame stop that the roving and selection models use',
        async () => {
          const { container } = await paint(dashboard, { selectable: true });
          const classes = frameStops(container).map(
            (frame) => frame.className.match(/--(\w+)/)?.[1]
          );
          expect(classes).toEqual([
            'page',
            'stack',
            'row',
            'card',
            'card',
            'split',
            'card',
            'card',
            'grid',
            'tile',
            'tile',
          ]);
          const row = container.querySelector<HTMLElement>('.tx-player-layout--row') as HTMLElement;
          row.focus();
          await fireEvent.keyDown(row, { key: 'ArrowDown', bubbles: true, cancelable: true });
          expect(document.activeElement?.classList.contains('tx-player-layout--split')).toBe(true);
          await fireEvent.click(container.querySelector('.tx-player-layout--tile') as HTMLElement);
          expect(
            container
              .querySelector('.tx-player-layout--tile')
              ?.hasAttribute('data-tx-player-selected')
          ).toBe(true);
        }
      );
    });
  });
});

describe('slots and conditions', () => {
  /**
   * The Svelte adapter for the catalog's G04 named slots and G07 `when`
   * conditions: slotted children reach the component's named snippets, and
   * `when` reads the player's local state.
   */

  const layoutLoader = async () =>
    import('../src/layouts/ContentLayout.svelte').then((m) => m.default);
  const slotLoader = async () => import('./SlotStub.svelte').then((m) => m.default);

  const card = (title: string, extra: object = {}) => ({
    id: 'layout-card',
    props: { title },
    ...extra,
  });

  describe('stateConditionInputs', () => {
    it('passes numbers, maps booleans to 1 and 0, and leaves strings and enums out', () => {
      expect(
        stateConditionInputs({ limit: 5, details: true, hidden: false, week: 'Week 42' })
      ).toEqual({ limit: 5, details: 1, hidden: 0 });
      expect(sameConditionInputs({ a: 1 }, { a: 1 })).toBe(true);
      expect(sameConditionInputs({ a: 1 }, { a: 0 })).toBe(false);
      expect(sameConditionInputs({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    });
  });

  describe('groupSlots', () => {
    const node = (path: string, slot?: string) =>
      ({
        kind: 'placeholder',
        id: 'x',
        path,
        label: 'x',
        reason: 'unknown-id',
        slot,
      }) as PlayerPaintNode;

    it('slot grouping and condition inputs', () => {
      // groups named slots in first-seen order and keeps unsafe names in the default slot
      {
        const groups = groupSlots([
          node('a', 'footer'),
          node('b'),
          node('c', 'hero'),
          node('d', 'footer'),
          node('e', '__proto__'),
          node('f', 'children'),
        ]);
        expect(groups.names).toEqual(['footer', 'hero']);
        expect(groups.groups.footer?.map((n) => n.path)).toEqual(['a', 'd']);
        expect(groups.defaults.map((n) => n.path)).toEqual(['b', 'e', 'f']);
        expect(Object.hasOwn(groups.groups, '__proto__')).toBe(false);
      }
    });
  });

  describe('named slots in the Svelte player (G04)', () => {
    // A host catalog that adds one component with named slots to the player's own.
    const base = createPlayerCatalog();
    const catalog: RenderCatalog = {
      get: (id) =>
        id === 'slot-stub'
          ? {
              id,
              label: 'Slot stub',
              agentEmittable: true,
              emit: ['developer', 'untrusted'],
              props: [
                { name: 'hero', kind: 'slot' },
                { name: 'footer', kind: 'slot' },
                { name: 'children', kind: 'slot' },
              ],
            }
          : base.get(id),
      allows: (id, tier) => (id === 'slot-stub' ? true : (base.allows?.(id, tier) ?? false)),
    };

    it('routes each slotted child to the snippet it names', async () => {
      const { container } = render(Player, {
        props: {
          catalog,
          loaders: {
            'layout-page': layoutLoader,
            'layout-card': layoutLoader,
            'slot-stub': slotLoader,
          },
          blueprint: {
            id: 'layout-page',
            props: { title: 'Harbor Notes' },
            children: [
              {
                id: 'slot-stub',
                children: [
                  card('Footer card', { slot: 'footer' }),
                  card('Body card'),
                  card('Hero card', { slot: 'hero' }),
                ],
              },
            ],
          },
        },
      });
      await screen.findByText('Hero card');
      const region = (name: string) =>
        container.querySelector<HTMLElement>(`[data-region="${name}"]`) as HTMLElement;
      expect(within(region('hero')).getByText('Hero card')).toBeTruthy();
      expect(within(region('body')).getByText('Body card')).toBeTruthy();
      expect(within(region('footer')).getByText('Footer card')).toBeTruthy();
      expect(within(region('body')).queryByText('Hero card')).toBeNull();
    });
  });

  describe('when conditions in the Svelte player (G07)', () => {
    const details = {
      op: 'eq',
      left: { op: 'var', name: 'details' },
      right: { op: 'num', value: 1 },
    };
    const overLimit = {
      op: 'gt',
      left: { op: 'var', name: 'limit' },
      right: { op: 'num', value: 3 },
    };
    const blueprint = {
      format: LOCAL_STATE_FORMAT,
      version: 1,
      state: {
        details: { type: 'boolean' },
        limit: { type: 'number', min: 0, max: 10, initial: 5 },
        week: { type: 'enum', values: ['Week 41', 'Week 42'], initial: 'Week 42' },
      },
      blueprint: {
        id: 'layout-page',
        props: { title: 'Weekly report' },
        children: [
          card('Always shown'),
          card('Details card', { when: details }),
          card('Over the limit', { when: overLimit }),
          card('Reads an enum', {
            when: { op: 'eq', left: { op: 'var', name: 'week' }, right: { op: 'num', value: 1 } },
          }),
        ],
      },
    };
    const loaders = { 'layout-page': layoutLoader, 'layout-card': layoutLoader };

    it('shows and hides regions as the local state changes', async () => {
      const target = document.createElement('div');
      document.body.append(target);
      const mounted = mountPlayer(target, { blueprint, loaders });
      expect(await screen.findByText('Always shown')).toBeTruthy();
      expect(screen.getByText('Over the limit')).toBeTruthy();
      expect(screen.queryByText('Details card')).toBeNull();
      // An enum is not a number: the condition is unknown, so it stays hidden.
      expect(screen.queryByText('Reads an enum')).toBeNull();
      expect(target.querySelector('.tx-player__notice')).toBeNull();

      expect(mounted.setState('details', true)).toBe(true);
      expect(await screen.findByText('Details card')).toBeTruthy();
      expect(mounted.setState('limit', 2)).toBe(true);
      await expect.poll(() => screen.queryByText('Over the limit')).toBeNull();
      expect(mounted.setState('details', false)).toBe(true);
      await expect.poll(() => screen.queryByText('Details card')).toBeNull();
      expect(screen.getByText('Always shown')).toBeTruthy();
      mounted.dispose();
      target.remove();
    });
  });
});
