import { render, screen } from '@testing-library/svelte';
import { buildCatalog } from '@texuli/catalog/build';
import { describe, expect, it } from 'vitest';
import Player from '../src/Player.svelte';
import { testCanvasHost } from './canvas-host.ts';
import { CATALOG_GROUPS } from './catalog-groups.ts';
import { testDocumentHost } from './document-host.ts';
import { testFormHost } from './form-host.ts';
import { testSheetHost } from './sheet-host.ts';

/**
 * Every manifest example of every agent-emittable id paints in the Player
 * (happy-dom) with no placeholder and no node error. Examples that read a
 * `$state` list get it declared with two items.
 */

const entries = (await buildCatalog(CATALOG_GROUPS)).catalog.entries;

/** `$state` names an example reads, declared as lists with two items. */
function stateNames(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) for (const item of value) stateNames(item, out);
  else if (value && typeof value === 'object') {
    const bag = value as Record<string, unknown>;
    if (typeof bag.$state === 'string') out.add(bag.$state);
    for (const entry of Object.values(bag)) stateNames(entry, out);
  }
  return out;
}

/** What an example needs around it to be a valid blueprint: state, a flow, an enclosing form. */
function contextFor(id: string, props: Readonly<Record<string, unknown>>) {
  const state: Record<string, unknown> = {};
  let flow: Record<string, unknown> | undefined;
  let wrap = (tree: unknown): unknown => tree;
  const name = typeof props.state === 'string' ? props.state : undefined;
  const control: Record<string, unknown> = {
    'control-toggle': { type: 'boolean' },
    'control-choice': { type: 'enum', values: ['this-week', 'last-week'] },
    'control-slider': { type: 'number', min: 0, max: 10 },
    'control-filter': { type: 'string' },
    'form-field':
      props.kind === 'number' ? { type: 'number', min: 0, max: 100 } : { type: 'string' },
  };
  if (name && control[id]) state[name] = control[id];
  if (id === 'flow-view') flow = { views: [props.name], initial: props.name, transitions: [] };
  if (id === 'flow-action') {
    flow = {
      views: ['start', 'end'],
      initial: 'start',
      transitions: [{ from: 'start', to: 'end', on: props.event }],
    };
  }
  if (id === 'form-field' || id === 'form-submit') {
    wrap = (tree) => ({
      id: 'action-form',
      props: { action: 'request', label: 'Request' },
      children: [tree],
    });
  }
  // Spec 0.8.0: a dashboard widget paints inside a dashboard.
  if (id === 'data-dashboard-widget') {
    wrap = (tree) => ({ id: 'data-dashboard', props: { label: 'Example' }, children: [tree] });
  }
  return { state, flow, wrap };
}

/** Ids happy-dom cannot paint, with the reason (browser e2e covers them). */
const DOM_LIMITS: Readonly<Record<string, string>> = {
  'media-composition-canvas': 'happy-dom has no 2D canvas context',
};

describe('every emittable example paints', () => {
  const cases = entries
    .filter((entry) => entry.agentEmittable)
    .flatMap((entry) => entry.examples.map((example) => ({ entry, example })));

  for (const { entry, example } of cases) {
    const limit = DOM_LIMITS[entry.id];
    it.skipIf(limit !== undefined)(
      `${entry.id} / ${example.id}${limit ? ` (skipped: ${limit})` : ''}`,
      { timeout: 20_000 },
      async () => {
        const names = [...stateNames(example.props)];
        const context = contextFor(entry.id, example.props);
        const blueprint = {
          format: 'texuli-blueprint',
          version: 1,
          id: `paint-${entry.id}`,
          catalog: '0'.repeat(64),
          status: 'draft',
          createdAt: '2026-10-27T09:00:00Z',
          updatedAt: '2026-10-27T09:00:00Z',
          generator: { kind: 'tool', name: 'parity' },
          ...(names.length > 0 || Object.keys(context.state).length > 0 || context.flow
            ? {
                state: {
                  ...context.state,
                  ...Object.fromEntries(
                    names.map((name) => [
                      name,
                      {
                        type: 'list',
                        initial: [
                          { id: 'one', label: 'One' },
                          { id: 'two', label: 'Two' },
                        ],
                      },
                    ])
                  ),
                },
              }
            : {}),
          ...(context.flow ? { flow: context.flow } : {}),
          tree: context.wrap({ id: entry.id, props: example.props }),
        };
        const errors: string[] = [];
        const { container } = render(Player, {
          props: {
            blueprint,
            label: 'Parity',
            // Examples are fragments: the frame-root rule is the only refusal allowed.
            invalidPolicy: 'preview',
            // A document example (spec 0.7.0) is checked and painted through a document host.
            documentHost: testDocumentHost().host,
            // A canvas example (spec 0.8.0) likewise, through a canvas host.
            canvasHost: testCanvasHost().host,
            formHost: testFormHost(),
            // A spreadsheet example (spec 0.8.0) through a sheet host.
            sheetHost: testSheetHost(),
            onDiagnostics: (event: {
              diagnostics: readonly {
                check: string;
                code: string;
                severity: string;
                message: string;
              }[];
              stateIssues: readonly { message: string }[];
            }) => {
              for (const d of event.diagnostics) {
                if (d.severity === 'error' && d.check !== 'root')
                  errors.push(`${d.check}:${d.code} ${d.message}`);
              }
              for (const issue of event.stateIssues) errors.push(`state: ${issue.message}`);
            },
          },
        });
        await expect
          .poll(() => container.querySelector('[data-tx-player-skeleton]'), { timeout: 15_000 })
          .toBeNull();
        expect(errors).toEqual([]);
        expect(
          container.querySelector('[data-tx-player-error]'),
          container.innerHTML.slice(0, 400)
        ).toBeNull();
        expect(screen.queryByText(/could not be shown/)).toBeNull();
      }
    );
  }
});
