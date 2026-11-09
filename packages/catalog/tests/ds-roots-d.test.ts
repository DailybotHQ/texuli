import { cleanup, render, waitFor } from '@testing-library/svelte';
import {
  DS_COMPONENT_ATTRIBUTE,
  DS_DENSITY_ATTRIBUTE,
  DS_SIZE_ATTRIBUTE,
  DS_TONE_ATTRIBUTE,
  DS_VARIANT_ATTRIBUTE,
} from '@texuli/spec/design-system';
import { afterEach, describe, expect, it } from 'vitest';
import { createDocumentPlayerHost } from '../../pages/src/host/index.ts';
import { PLAYER_LOADERS } from '../../player/src/loaders.ts';
import Player from '../../player/src/Player.svelte';
import { buildCatalog } from '../src/build/build.ts';
import { ALL_MANIFEST_GROUPS } from '../src/manifests/all.ts';

/**
 * Group D catalog ids (audit/roots.md): player painters, ContentLayout, pages
 * `document`, and `inline-text` (documented exception: escaped text node).
 */
const GROUP_D = [
  'action-form',
  'control-choice',
  'control-filter',
  'control-slider',
  'control-toggle',
  'deck-slide',
  'document',
  'flow-action',
  'flow-view',
  'form-field',
  'form-submit',
  'host-region',
  'inline-text',
  'layout-card',
  'layout-deck',
  'layout-doc',
  'layout-grid',
  'layout-page',
  'layout-row',
  'layout-split',
  'layout-stack',
  'layout-tile',
  'sortable-list',
] as const;

const EXCEPTION_IDS = new Set(['inline-text']);

const AXIS_ATTRIBUTES = [
  DS_VARIANT_ATTRIBUTE,
  DS_SIZE_ATTRIBUTE,
  DS_TONE_ATTRIBUTE,
  DS_DENSITY_ATTRIBUTE,
] as const;

const build = await buildCatalog(ALL_MANIFEST_GROUPS);
const byId = new Map(build.catalog.entries.map((entry) => [entry.id, entry]));
const documentHost = createDocumentPlayerHost({ loadPlayer: null });

function envelope(tree: unknown, extra: Record<string, unknown> = {}) {
  return {
    format: 'texuli-blueprint',
    version: 1,
    id: 'ds-roots-d',
    catalog: '0'.repeat(64),
    status: 'draft',
    createdAt: '2026-10-27T09:00:00Z',
    updatedAt: '2026-10-27T09:00:00Z',
    generator: { kind: 'agent', name: 'Fictional agent' },
    spec: '0.3.0',
    ...extra,
    tree,
  };
}

function page(children: unknown[]): unknown {
  return { id: 'layout-page', props: { title: 'Roots D' }, children };
}

function nodeFor(id: string): { tree: unknown; extra?: Record<string, unknown> } {
  const state = {
    details: { type: 'boolean' as const },
    week: { type: 'enum' as const, values: ['Week 41', 'Week 42'], initial: 'Week 42' },
    limit: { type: 'number' as const, min: 0, max: 10, initial: 5 },
    query: { type: 'string' as const, maxLength: 40, initial: '' },
    name: { type: 'string' as const, maxLength: 40, initial: '' },
    tasks: {
      type: 'list' as const,
      initial: [
        { id: 'a', label: 'Alpha' },
        { id: 'b', label: 'Beta' },
      ],
    },
  };
  const flow = {
    views: ['start'],
    initial: 'start',
    transitions: [{ from: 'start', to: 'start', on: 'next' }],
  };

  switch (id) {
    case 'layout-page':
      return { tree: { id, props: { title: 'Page' } } };
    case 'action-form':
      return {
        extra: { state },
        tree: page([{ id, props: { action: 'request-access', label: 'Request access' } }]),
      };
    case 'form-field':
      return {
        extra: { state },
        tree: page([
          {
            id: 'action-form',
            props: { action: 'request-access', label: 'Request access' },
            children: [{ id, props: { name: 'name', state: 'name', label: 'Name' } }],
          },
        ]),
      };
    case 'form-submit':
      return {
        extra: { state },
        tree: page([
          {
            id: 'action-form',
            props: { action: 'request-access', label: 'Request access' },
            children: [{ id, props: { label: 'Send' } }],
          },
        ]),
      };
    case 'control-toggle':
      return { extra: { state }, tree: page([{ id, props: { state: 'details', label: 'Show' } }]) };
    case 'control-choice':
      return { extra: { state }, tree: page([{ id, props: { state: 'week', label: 'Week' } }]) };
    case 'control-slider':
      return { extra: { state }, tree: page([{ id, props: { state: 'limit', label: 'Limit' } }]) };
    case 'control-filter':
      return { extra: { state }, tree: page([{ id, props: { state: 'query', label: 'Filter' } }]) };
    case 'flow-view':
      return {
        extra: { state, flow },
        tree: page([{ id, props: { name: 'start', label: 'Start' } }]),
      };
    case 'flow-action':
      return {
        extra: { state, flow },
        tree: page([{ id, props: { event: 'next', label: 'Next' } }]),
      };
    case 'sortable-list':
      return {
        extra: { state },
        tree: page([
          { id, props: { label: 'Priorities', reorder: { bind: { $state: 'tasks' } } } },
        ]),
      };
    case 'host-region':
      return { tree: page([{ id, props: { name: 'payment', label: 'Payment details' } }]) };
    case 'document':
      return {
        tree: {
          id,
          props: {
            label: 'Handbook',
            doc: {
              format: 'texuli-document',
              formatVersion: 1,
              meta: { title: 'Week 43 notes', locale: 'en' },
              blocks: [
                {
                  id: 'p1',
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Shipped on time.', marks: [] }],
                },
              ],
            },
          },
        },
      };
    case 'layout-deck':
      return { tree: { id, props: { title: 'Deck' } } };
    case 'layout-doc':
      return { tree: { id, props: { title: 'Handbook' } } };
    case 'layout-grid':
      return { tree: page([{ id, props: { columns: 2 } }]) };
    case 'layout-stack':
      return { tree: page([{ id, props: { gap: 'medium' } }]) };
    case 'layout-row':
      return { tree: page([{ id, props: { gap: 'small', align: 'center' } }]) };
    case 'layout-split':
      return { tree: page([{ id, props: { ratio: '2:1' } }]) };
    case 'layout-tile':
      return { tree: page([{ id, props: { title: 'Trend', span: 2 } }]) };
    case 'layout-card':
      return { tree: page([{ id, props: { title: 'Summary' } }]) };
    case 'deck-slide':
      return {
        tree: {
          id: 'layout-deck',
          props: { title: 'Deck' },
          children: [{ id, props: { slideId: 'opening', title: 'Slide' } }],
        },
      };
    case 'inline-text':
      return { tree: page([{ id, props: { text: 'Fictional label' } }]) };
    default:
      return { tree: page([{ id, props: { title: 'Frame' } }]) };
  }
}

async function paint(id: string) {
  const { tree, extra } = nodeFor(id);
  const errors: string[] = [];
  const view = render(Player, {
    props: {
      blueprint: envelope(tree, extra),
      loaders: PLAYER_LOADERS,
      documentHost: id === 'document' ? documentHost : undefined,
      onDiagnostics: (event: { diagnostics: readonly { message: string; severity: string }[] }) => {
        for (const item of event.diagnostics)
          if (item.severity === 'error') errors.push(item.message);
      },
    },
  });
  await waitFor(
    () => expect(view.container.querySelector('[data-tx-player-skeleton]')).toBeNull(),
    {
      timeout: 8000,
    }
  );
  if (errors.length > 0) throw new Error(`${id}: ${errors.join('; ')}`);
  await waitFor(
    () =>
      expect(view.container.querySelector(`[${DS_COMPONENT_ATTRIBUTE}="${id}"]`)).not.toBeNull(),
    { timeout: 10_000 }
  );
  return view;
}

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('group D catalog roots (data-tx-component)', () => {
  it('covers every Group D id from the audit', () => {
    expect(GROUP_D).toHaveLength(23);
    expect(new Set(GROUP_D).size).toBe(23);
    for (const id of GROUP_D) expect(byId.has(id), id).toBe(true);
  });

  it('paints data-tx-component on every Group D root except documented exceptions', async () => {
    for (const id of GROUP_D) {
      if (EXCEPTION_IDS.has(id)) continue;
      const { container } = await paint(id);
      const roots = container.querySelectorAll(`[${DS_COMPONENT_ATTRIBUTE}="${id}"]`);
      expect(roots.length, id).toBeGreaterThanOrEqual(1);
      const root = roots[0];
      if (!root) throw new Error(`missing root for ${id}`);
      expect(root.getAttribute(DS_COMPONENT_ATTRIBUTE)).toBe(id);
      const entry = byId.get(id);
      const axes = new Set((entry?.props ?? []).map((prop) => prop.name));
      for (const attr of AXIS_ATTRIBUTES) {
        if (attr === DS_VARIANT_ATTRIBUTE && axes.has('variant')) {
          expect(root.hasAttribute(attr), `${id} ${attr}`).toBe(true);
        } else if (attr === DS_SIZE_ATTRIBUTE && axes.has('size')) {
          expect(root.hasAttribute(attr), `${id} ${attr}`).toBe(true);
        } else if (attr === DS_TONE_ATTRIBUTE && axes.has('tone')) {
          expect(root.hasAttribute(attr), `${id} ${attr}`).toBe(true);
        } else if (attr === DS_DENSITY_ATTRIBUTE && axes.has('density')) {
          expect(root.hasAttribute(attr), `${id} ${attr}`).toBe(true);
        }
      }
    }
  });

  it('documents inline-text as a host text node, not a component root', () => {
    const entry = byId.get('inline-text');
    expect(entry?.id).toBe('inline-text');
    expect(entry?.agentEmittable).toBe(false);
    expect(EXCEPTION_IDS.has('inline-text')).toBe(true);
  });
});
