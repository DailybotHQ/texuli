// @vitest-environment node
import { ACTION_FIELDS, SPEC_EVENT_NAMES, SPEC_PROP_REFS, SPEC_VERSION } from '@texuli/spec';
import { UNDECLARED_SPEC_VERSION } from '@texuli/spec/migrate';
import { describe, expect, it } from 'vitest';
import blueprintJson from '../../spec/schemas/blueprint.schema.json';
import { buildCatalog } from '../src/build/index.ts';
import { discoverManifestGroups } from '../src/build/node.ts';
import { parseEnvelope, SUPPORTED_SPEC_VERSIONS } from '../src/envelope/index.ts';
import {
  CATALOG_EVENT_NAMES,
  CATALOG_SCHEMA_REFS,
  validateCatalogManifest,
} from '../src/manifest/index.ts';
import { renderCatalogFromBuild } from '../src/render/renderer/index.ts';
import { validateDraft } from '../src/validate/index.ts';
import { INTERACTION_ACTION_FIELDS, initialStateValue } from '../src/validate/interaction.ts';

const build = await buildCatalog(await discoverManifestGroups());
const catalog = renderCatalogFromBuild(build.catalog);

function envelope(tree: unknown, extra: Record<string, unknown> = {}) {
  return {
    format: 'texuli-blueprint',
    version: 1,
    id: 'interaction-test',
    catalog: build.hash,
    status: 'draft',
    createdAt: '2026-10-27T09:00:00Z',
    updatedAt: '2026-10-27T09:00:00Z',
    generator: { kind: 'agent', name: 'Fictional agent' },
    ...extra,
    tree,
  };
}
/** A flow declaring the views and events the flow nodes below use (the player refuses them otherwise). */
const flow = {
  views: ['a', 'b'],
  initial: 'a',
  transitions: [
    { from: 'a', to: 'b', on: 'next' },
    { from: 'a', to: 'b', on: 'e' },
  ],
};
const run = (input: unknown, options: Partial<Parameters<typeof validateDraft>[1]> = {}) =>
  validateDraft(input, { catalog, frameRoots: false, ...options });
const codes = (result: ReturnType<typeof run>) =>
  result.diagnostics.filter((d) => d.severity === 'error').map((d) => `${d.check}:${d.code}`);

describe('mirrors of the spec contract', () => {
  it('the closed action set, events and schema refs equal @texuli/spec', () => {
    expect(INTERACTION_ACTION_FIELDS).toEqual(ACTION_FIELDS);
    expect([...CATALOG_EVENT_NAMES]).toEqual([...SPEC_EVENT_NAMES]);
    expect([...CATALOG_SCHEMA_REFS]).toEqual([...SPEC_PROP_REFS]);
  });
});

describe('envelope 0.3.0 fields and migration', () => {
  it('migrates a 0.2.0 envelope before parsing, so the validated envelope carries the current spec', () => {
    const result = run(envelope({ id: 'layout-stack', props: { gap: 'small' } }));
    expect(codes(result)).toEqual([]);
    expect(result.envelope?.spec).toBe(SUPPORTED_SPEC_VERSIONS[SUPPORTED_SPEC_VERSIONS.length - 1]);
  });

  it('spec versions: the schema enum parses, undeclared parses, an explicit 0.2.0 only migrates', () => {
    const tree = { id: 'layout-stack', props: {} };
    const schema = blueprintJson as unknown as { properties: { spec: { enum: string[] } } };
    expect([...SUPPORTED_SPEC_VERSIONS]).toEqual(schema.properties.spec.enum);
    expect(SUPPORTED_SPEC_VERSIONS).not.toContain(UNDECLARED_SPEC_VERSION);
    for (const spec of SUPPORTED_SPEC_VERSIONS) {
      expect(parseEnvelope(envelope(tree, { spec })).issues, spec).toEqual([]);
    }
    // Undeclared: parses as is, and validateDraft stamps the current version.
    expect(parseEnvelope(envelope(tree)).issues).toEqual([]);
    // Declared 0.2.0: refused by parseEnvelope alone, accepted through migration.
    const legacy = envelope(tree, { spec: UNDECLARED_SPEC_VERSION });
    expect(parseEnvelope(legacy).issues.map((issue) => issue.code)).toEqual(['unsupported-spec']);
    const migrated = run(legacy);
    expect(codes(migrated)).toEqual([]);
    expect(migrated.envelope?.spec).toBe(SPEC_VERSION);
    // Migration never mutates its input.
    expect((legacy as Record<string, unknown>).spec).toBe(UNDECLARED_SPEC_VERSION);
  });

  it('accepts spec, state and flow; refuses an unknown spec and non-object state', () => {
    const tree = { id: 'layout-stack', props: {} };
    expect(
      parseEnvelope(
        envelope(tree, { spec: '0.3.0', state: {}, flow: { views: ['a'], initial: 'a' } })
      ).issues
    ).toEqual([]);
    expect(parseEnvelope(envelope(tree, { spec: '9.0.0' })).issues.map((i) => i.code)).toEqual([
      'unsupported-spec',
    ]);
    expect(parseEnvelope(envelope(tree, { state: [] })).issues.map((i) => i.code)).toEqual([
      'invalid-field',
    ]);
    expect(codes(run(envelope(tree, { spec: '9.9.9' })))).toContain('envelope:unsupported-spec');
  });

  it('runs the host spec check when given, and skips it otherwise', () => {
    const input = envelope({ id: 'layout-stack', props: {} });
    expect(run(input).checks.spec).toBe('skipped');
    const refused = run(input, {
      checkSpec: () => ({
        ok: false,
        diagnostics: [{ code: 'state', path: '$.state', message: 'Refused.' }],
      }),
    });
    expect(codes(refused)).toEqual(['spec:state']);
    expect(run(input, { checkSpec: () => ({ ok: true, diagnostics: [] }) }).checks.spec).toBe(
      'pass'
    );
  });
});

describe('bindings, bind and on', () => {
  const state = {
    open: { type: 'boolean', initial: true },
    limit: { type: 'number', min: 1, max: 9 },
    range: { type: 'enum', values: ['week', 'month'] },
    query: { type: 'string' },
    tasks: { type: 'list', initial: [{ id: 'a', label: 'Alpha' }] },
  };

  it('paints $state bindings at their first values and keeps the raw draft', () => {
    const tree = {
      id: 'layout-tile',
      props: { title: { $state: 'query' }, span: { $state: 'limit' } },
    };
    const result = run(envelope(tree, { state }));
    expect(codes(result)).toEqual([]);
    expect(result.roots[0]).toMatchObject({ kind: 'component', props: { title: '', span: 1 } });
    expect(result.draft).toEqual(tree);
    expect(initialStateValue(state.range)).toBe('week');
    expect(initialStateValue(state.open)).toBe(true);
  });

  it('keeps reorder.bind a binding for the painter and checks its name', () => {
    const tree = {
      id: 'sortable-list',
      props: { label: 'Tasks', reorder: { bind: { $state: 'tasks' } } },
    };
    const result = run(envelope(tree, { state }));
    expect(codes(result)).toEqual([]);
    expect(result.roots[0]).toMatchObject({ props: { reorder: { bind: { $state: 'tasks' } } } });
    expect(
      codes(
        run(
          envelope(
            { ...tree, props: { ...tree.props, reorder: { bind: { $state: 'nope' } } } },
            { state }
          )
        )
      )
    ).toEqual(['interaction:unknown-state']);
  });

  it('accepts bind on bindable props and on for fired events with closed actions', () => {
    const files = {
      id: 'data-files',
      props: { label: 'Drive', entries: [] },
      bind: { layout: { $state: 'layout' } },
      on: {
        select: [
          { op: 'setState', state: 'query', fromEvent: 'value' },
          { op: 'emit', intent: 'open-file', values: { id: { $state: 'query' } } },
        ],
      },
    };
    const withLayout = { ...state, layout: { type: 'enum', values: ['grid', 'list'] } };
    expect(codes(run(envelope(files, { state: withLayout })))).toEqual([]);
    const toggle = {
      id: 'flow-action',
      props: { event: 'next', label: 'Next' },
      on: {
        press: [
          { op: 'flowGo', event: 'next' },
          { op: 'toggleState', state: 'open' },
        ],
      },
    };
    expect(codes(run(envelope(toggle, { state, flow })))).toEqual([]);
  });

  it('refuses undeclared names, unbindable props, unfired events and actions outside the closed set', () => {
    const bad = (tree: unknown) => codes(run(envelope(tree, { state, flow })));
    expect(bad({ id: 'layout-tile', props: { title: { $state: 'ghost' } } })).toEqual([
      'interaction:unknown-state',
    ]);
    expect(
      bad({
        id: 'data-files',
        props: { label: 'D', entries: [] },
        bind: { label: { $state: 'query' } },
      })
    ).toEqual(['interaction:binding']);
    expect(
      bad({
        id: 'data-files',
        props: { label: 'D', entries: [], layout: 'grid' },
        bind: { layout: { $state: 'range' } },
      })
    ).toEqual(['interaction:binding']);
    expect(
      bad({ id: 'flow-view', props: { name: 'a' }, on: { press: [{ op: 'submit' }] } })
    ).toEqual(['interaction:unknown-event']);
    expect(
      bad({
        id: 'flow-action',
        props: { event: 'e', label: 'L' },
        on: { press: [{ op: 'fetch', url: 'x' }] },
      })
    ).toEqual(['interaction:action']);
    expect(
      bad({ id: 'flow-action', props: { event: 'e', label: 'L' }, on: { press: [] } })
    ).toEqual(['interaction:action']);
    expect(
      bad({
        id: 'flow-action',
        props: { event: 'e', label: 'L' },
        on: { press: [{ op: 'emit', intent: 'save', values: { 'bad key <x>': 'y' } }] },
      })
    ).toEqual(['interaction:action']);
    expect(
      bad({
        id: 'flow-action',
        props: { event: 'e', label: 'L' },
        on: { press: [{ op: 'setState' }] },
      })
    ).toEqual(['interaction:action']);
    expect(bad({ id: 'layout-tile', props: { title: { $state: 'query', extra: 1 } } })).toEqual([
      'interaction:binding',
    ]);
  });

  it('reads $data only as a whole scalar prop, painting a kind placeholder', () => {
    const ok = run(envelope({ id: 'layout-tile', props: { title: { $data: 'report.title' } } }));
    expect(codes(ok)).toEqual([]);
    expect(ok.roots[0]).toMatchObject({ props: { title: '' } });
    expect(codes(run(envelope({ id: 'layout-tile', props: { title: { $data: '' } } })))).toEqual([
      'interaction:binding',
    ]);
    expect(
      codes(run(envelope({ id: 'sortable-list', props: { label: 'L', reorder: { $data: 'x' } } })))
    ).toContain('interaction:binding');
  });
});

describe('manifest format (events, bindable, schemas, deprecation)', () => {
  const base = {
    id: 'sample',
    package: 'texuli',
    label: 'Sample',
    summary: 'A sample.',
    tier: 'content',
    useWhen: ['x'],
    dontUseWhen: ['y'],
    a11y: 'z',
    props: [
      {
        name: 'items',
        kind: 'array',
        schema: {
          type: 'array',
          items: { type: 'object', properties: { id: { type: 'string' } } },
        },
      },
      { name: 'onPick', kind: 'event' },
    ],
    examples: [],
  };
  const problems = (extra: Record<string, unknown>) =>
    validateCatalogManifest({ ...base, ...extra }).diagnostics.map((d) => d.code);

  it('accepts closed events, data bindable props, schemas and deprecations', () => {
    expect(
      problems({
        events: ['select', 'move'],
        bindable: ['items'],
        deprecated: { since: '0.3.0', replacement: 'other' },
      })
    ).toEqual([]);
  });

  it('refuses unknown events, non-data bindable props and bad schemas', () => {
    expect(problems({ events: ['hover'] })).toEqual(['invalid-event']);
    expect(problems({ events: ['move', 'move'] })).toEqual(['duplicate-event']);
    expect(problems({ bindable: ['onPick'] })).toEqual(['invalid-bindable']);
    expect(problems({ bindable: ['missing'] })).toEqual(['invalid-bindable']);
    expect(problems({ deprecated: { since: 'soon' } })).toEqual(['invalid-deprecated']);
    const schema = (value: unknown, kind = 'array') =>
      problems({ props: [{ name: 'items', kind, schema: value }] });
    expect(schema({ type: 'array', pattern: '.*' })).toEqual(['invalid-schema']);
    expect(schema({ $ref: '#/$defs/script' })).toEqual(['invalid-schema']);
    expect(schema({ $ref: '#/$defs/reorder', type: 'object' })).toEqual(['invalid-schema']);
    expect(schema({ items: {} })).toEqual(['invalid-schema', 'invalid-schema']);
    expect(schema({ type: 'string' }, 'string')).toEqual(['schema-unexpected']);
  });
});

describe('the state surface, without a host spec check', () => {
  const state = { query: { type: 'string' } };
  const errors = (input: unknown) =>
    run(input)
      .diagnostics.filter((d) => d.severity === 'error')
      .map((d) => `${d.code} ${d.path}`);

  it('refuses control, bidirectional and invisible characters in list item text', () => {
    const list = (label: string) =>
      envelope(
        { id: 'sortable-list', props: { label: 'Tasks', reorder: { bind: { $state: 'tasks' } } } },
        { state: { tasks: { type: 'list', initial: [{ id: 't1', label }] } } }
      );
    for (const label of ['a\u202Eb', 'a\u2067b', 'a\u200Bb', 'a\uFEFFb', 'a\u0007b', 'a\u0085b']) {
      expect(errors(list(label)), JSON.stringify(label)).toEqual([
        'state state.tasks.initial[0].label',
      ]);
    }
    // Joiners some scripts and emoji need stay allowed.
    for (const label of ['Bug report', '👩\u200D💻', 'می\u200Cخواهم']) {
      expect(errors(list(label)), JSON.stringify(label)).toEqual([]);
    }
  });

  it('refuses forms, controls and flow nodes the player would refuse, at their paths', () => {
    const page = (children: unknown[], extra: Record<string, unknown> = {}) =>
      envelope({ id: 'layout-stack', props: {}, children }, extra);
    expect(
      errors(
        page([{ id: 'form-field', props: { name: 'q', label: 'Q', state: 'query' } }], { state })
      )
    ).toEqual(['action 0.children.0']);
    expect(errors(page([{ id: 'form-submit', props: { label: 'Go' } }], { state }))).toEqual([
      'action 0.children.0',
    ]);
    expect(
      errors(page([{ id: 'control-toggle', props: { label: 'T', state: 'query' } }], { state }))
    ).toEqual(['binding 0.children.0']);
    expect(errors(page([{ id: 'flow-view', props: { name: 'a' } }]))).toEqual([
      'state 0.children.0',
    ]);
    // In a form, with a declared variable of its type, a field is fine.
    const form = {
      id: 'action-form',
      props: { action: 'search', label: 'Search' },
      children: [
        { id: 'form-field', props: { name: 'q', label: 'Q', state: 'query' } },
        { id: 'form-submit', props: { label: 'Go' } },
      ],
    };
    expect(errors(page([form], { state }))).toEqual([]);
  });
});
