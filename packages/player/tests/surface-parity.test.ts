import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  checkStateSurface,
  SPEC_CONTROL_STATE_TYPES,
  SURFACE_PLAYER_CODES,
  surfaceInputs,
  validateBlueprint,
} from '@texuli/spec';
import { validateWorkflowGraph } from '@texuli/spec/workflow';
import { describe, expect, it } from 'vitest';
import { checkActionNodes } from '../src/actions.ts';
import { CONTROL_STATE_TYPES } from '../src/control-manifests.ts';
import { checkHostBoundWriters } from '../src/host-data.ts';
import { checkControlBindings } from '../src/state/controls.ts';
import { checkFlowNodes, parseFlowDeclaration } from '../src/state/flow.ts';
import { coerceList, parseStateDeclarations } from '../src/state/schema.ts';

/**
 * A blueprint that validates always paints: the spec's state surface rules
 * (`checkStateSurface`, which the spec and catalog validators run) refuse
 * exactly what the player's paint-time checks refuse, node for node, with
 * the same message and the mapped code. List item text follows one rule.
 */

type Bag = Record<string, unknown>;
const field = (extra: Bag = {}) => ({
  id: 'form-field',
  props: { name: 'email', label: 'Email', state: 'email', ...extra },
});
const submit = { id: 'form-submit', props: { label: 'Send' } };
const form = (children: unknown[], action = 'send-request') => ({
  id: 'action-form',
  props: { action, label: 'Send' },
  children,
});
const control = (id: string, state: string) => ({ id, props: { label: 'L', state } });
const state = {
  email: { type: 'string' },
  count: { type: 'number', min: 0, max: 9 },
  open: { type: 'boolean' },
  tab: { type: 'enum', values: ['a', 'b'] },
  title: { type: 'string', source: 'report.title' },
};
const flow = {
  views: ['start', 'done'],
  initial: 'start',
  transitions: [{ from: 'start', to: 'done', on: 'next' }],
};

/** Trees, each checked with state and flow, with state only, and with neither. */
const CORPUS: Record<string, unknown[]> = {
  'a valid form': [
    form([field(), field({ name: 'count', state: 'count', kind: 'number' }), submit]),
  ],
  'fields and submits outside a form': [field(), submit],
  'a nested form': [form([form([field()])])],
  'a bad action name': [form([field()], 'bad name!')],
  'a duplicate field name': [form([field(), field()])],
  'field type mismatches': [
    form([field({ kind: 'number' }), field({ name: 'count', state: 'count' })]),
  ],
  'an undeclared field variable': [form([field({ state: 'ghost' })])],
  'a field without a name': [form([field({ name: 'bad name' })])],
  'every control, well and badly bound': [
    control('control-toggle', 'open'),
    control('control-choice', 'tab'),
    control('control-slider', 'count'),
    control('control-filter', 'email'),
    control('control-toggle', 'email'),
    control('control-filter', 'ghost'),
  ],
  'writers of a host-bound variable': [
    control('control-filter', 'title'),
    form([field({ name: 'title', state: 'title' })]),
  ],
  'flow nodes': [
    { id: 'flow-view', props: { name: 'start' } },
    { id: 'flow-view', props: { name: 'nowhere' } },
    { id: 'flow-action', props: { event: 'next', label: 'Next' } },
    { id: 'flow-action', props: { event: 'jump', label: 'Jump' } },
  ],
};

const ENVELOPES = {
  'state and flow': { state, flow },
  'state only': { state },
  neither: {},
} as const;

function envelope(children: unknown[], extra: Bag): Bag {
  return {
    format: 'texuli-blueprint',
    version: 1,
    id: 'surface-parity',
    catalog: '0'.repeat(64),
    status: 'draft',
    createdAt: '2026-10-27T09:00:00Z',
    updatedAt: '2026-10-27T09:00:00Z',
    generator: { kind: 'agent', name: 'Fictional agent' },
    spec: '0.3.0',
    ...extra,
    tree: { id: 'layout-page', props: { title: 'Surface' }, children },
  };
}

/** The player's issues, as Player.svelte gathers them for a stateful or a plain blueprint. */
function playerIssues(blueprint: Bag): string[] {
  const stateful = Object.hasOwn(blueprint, 'state') || Object.hasOwn(blueprint, 'flow');
  const parsed = parseStateDeclarations(blueprint.state ?? {});
  if (!parsed.ok) throw new Error('declarations');
  const declarations = stateful ? parsed.declarations : null;
  const parsedFlow = blueprint.flow ? parseFlowDeclaration(blueprint.flow) : null;
  if (parsedFlow && !parsedFlow.ok) throw new Error('flow');
  const flowDeclaration = parsedFlow?.ok ? parsedFlow.flow : null;
  const issues = [
    ...checkControlBindings(blueprint, declarations),
    ...checkFlowNodes(blueprint, flowDeclaration),
    ...checkActionNodes(blueprint, declarations),
    ...(declarations ? checkHostBoundWriters(blueprint, declarations) : []),
  ];
  return issues
    .map((issue) => {
      const code = SURFACE_PLAYER_CODES[issue.code as keyof typeof SURFACE_PLAYER_CODES];
      return `${code ?? `unmapped:${issue.code}`} ${issue.path} ${issue.message}`;
    })
    .sort();
}

function specIssues(blueprint: Bag): string[] {
  return checkStateSurface(blueprint.tree, surfaceInputs(blueprint))
    .map(
      (issue) => `${issue.code} 0${issue.at.map((i) => `.children.${i}`).join('')} ${issue.message}`
    )
    .sort();
}

describe('the state surface: spec and player refuse the same nodes', () => {
  it('the control state types are the catalog’s', () => {
    expect(SPEC_CONTROL_STATE_TYPES).toEqual(CONTROL_STATE_TYPES);
  });

  for (const [name, children] of Object.entries(CORPUS)) {
    for (const [context, extra] of Object.entries(ENVELOPES)) {
      it(`${name} (${context})`, () => {
        const blueprint = envelope(children, extra);
        const player = playerIssues(blueprint);
        expect(specIssues(blueprint)).toEqual(player);
        if (name !== 'a valid form' || context === 'neither') return;
        expect(player).toEqual([]);
      });
    }
  }

  it('the corpus exercises every player code', () => {
    const seen = new Set<string>();
    for (const children of Object.values(CORPUS))
      for (const extra of Object.values(ENVELOPES))
        for (const issue of playerIssues(envelope(children, extra)))
          seen.add(issue.split(' ')[0] as string);
    expect([...seen].sort()).toEqual([...new Set(Object.values(SURFACE_PLAYER_CODES))].sort());
  });

  it('the spec validator refuses what the player refuses, with the spec code at the spec path', () => {
    const SPEC = join(import.meta.dirname, '../../spec');
    const read = (path: string): unknown => JSON.parse(readFileSync(join(SPEC, path), 'utf8'));
    const documents = {
      blueprintSchema: read('schemas/blueprint.schema.json'),
      catalog: read('catalog/components.json'),
      workflowSchema: read('schemas/workflow.schema.json'),
      validateWorkflowGraph,
    } as Parameters<typeof validateBlueprint>[1];
    const outside = envelope([field()], { state });
    const found = validateBlueprint(outside, documents).diagnostics.map((d) => ({
      code: d.code,
      path: d.path,
      message: d.message,
    }));
    expect(found).toEqual([
      {
        code: 'action',
        path: '$.tree.children[0]',
        message: '"form-field" must be inside an "action-form".',
      },
    ]);
  });
});

describe('list item text: the player refuses what the spec refuses', () => {
  it('refuses controls, bidirectional overrides and isolates, and invisible formatting', () => {
    for (const label of [
      'a‮b',
      'a⁦b',
      'a​b',
      'a‎b',
      'a⁠b',
      'a﻿b',
      'a؜b',
      'a\u0000b',
      'a\nb',
      'a\u0085b',
    ]) {
      expect(coerceList([{ id: 'x', label }], 10), JSON.stringify(label)).toBeUndefined();
      expect(
        parseStateDeclarations({ tasks: { type: 'list', initial: [{ id: 'x', label }] } }).ok
      ).toBe(false);
    }
  });

  it('keeps plain text, emoji joiners and script joiners', () => {
    for (const label of ['Bug report', 'Café 3 €', '👩‍💻', 'می‌خواهم'])
      expect(coerceList([{ id: 'x', label }], 10), label).toBeDefined();
  });
});
