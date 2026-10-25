// @vitest-environment node
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import {
  type CatalogTreeInput,
  type RenderComponentSpec,
  renderCatalogFromSpecs,
  renderCatalogTree,
} from '@texuli/catalog/render/renderer';
import {
  A2UI_MESSAGE_SCHEMA,
  type A2uiIssueCode,
  a2uiToCatalogTree,
  catalogTreeToA2ui,
  checkJsonSchema,
  validateA2uiMessages,
} from '@texuli/tools/a2ui';
import { describe, expect, it } from 'vitest';

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`./fixtures/a2ui/${name}`, import.meta.url), 'utf8'));

const options = { surfaceId: 'report', catalogId: 'catalog-example.json' };
const tree = fixture('report-card.tree.json') as CatalogTreeInput;
const payload = fixture('report-card.a2ui.json');

const msg = (components: unknown[]) => [
  { version: 'v0.9', updateComponents: { surfaceId: 's', components } },
];

function codes(input: unknown): A2uiIssueCode[] {
  const result = a2uiToCatalogTree(input);
  if (result.ok) throw new Error('expected the conversion to fail');
  return result.diagnostics.map((d) => d.code);
}

describe('catalogTreeToA2ui', () => {
  it('turns the fixture tree into the fixture payload exactly', () => {
    const result = catalogTreeToA2ui(tree, options);
    expect(result).toEqual({ ok: true, messages: payload });
  });

  it('produces messages the v0.9 schema accepts', () => {
    const result = catalogTreeToA2ui(tree, options);
    if (!result.ok) throw new Error('conversion failed');
    expect(validateA2uiMessages(result.messages)).toEqual([]);
  });

  it('is deterministic and leaves the input untouched', () => {
    const before = JSON.stringify(tree);
    expect(catalogTreeToA2ui(tree, options)).toEqual(catalogTreeToA2ui(tree, options));
    expect(JSON.stringify(tree)).toBe(before);
  });

  it('wraps several roots, and none, in texuli-roots', () => {
    const two = catalogTreeToA2ui([{ id: 'text' }, { id: 'heading' }], options);
    expect(two.ok && two.messages[1]).toEqual({
      version: 'v0.9',
      updateComponents: {
        surfaceId: 'report',
        components: [
          { id: 'root', component: 'texuli-roots', children: ['n1', 'n2'] },
          { id: 'n1', component: 'text' },
          { id: 'n2', component: 'heading' },
        ],
      },
    });
    const none = catalogTreeToA2ui([], { ...options, createSurface: false });
    expect(none.ok && none.messages).toEqual([
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'report',
          components: [{ id: 'root', component: 'texuli-roots', children: [] }],
        },
      },
    ]);
  });

  it('refuses props that would change meaning in A2UI', () => {
    const result = catalogTreeToA2ui(
      {
        id: 'card',
        props: {
          id: 'x',
          children: [],
          bound: { path: '/user/name' },
          called: { call: 'formatDate', args: {} },
          ratio: Number.NaN,
          when: new Date(0),
        },
      },
      options
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics.map((d) => [d.code, d.path])).toEqual([
      ['reserved-prop', '$.props.id'],
      ['reserved-prop', '$.props.children'],
      ['binding', '$.props.bound'],
      ['binding', '$.props.called'],
      ['not-json', '$.props.ratio'],
      ['not-json', '$.props.when'],
    ]);
  });

  it('refuses malformed nodes, the wrapper id and prototype keys', () => {
    const hostile = JSON.parse('{"id":"card","props":{"meta":{"__proto__":{"polluted":true}}}}');
    const bad = catalogTreeToA2ui(
      [{ id: 'Card' }, { id: 'texuli-roots' }, { id: 'card', children: 'x' }, hostile] as never,
      options
    );
    expect(bad.ok ? [] : bad.diagnostics.map((d) => d.code)).toEqual([
      'invalid-node',
      'invalid-node',
      'invalid-node',
      'unsafe-key',
    ]);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('stops at the depth and component limits', () => {
    let deep: CatalogTreeInput = { id: 'text' };
    for (let i = 0; i < 10; i++) deep = { id: 'card', children: [deep] };
    const depth = catalogTreeToA2ui(deep, { ...options, maxDepth: 5 });
    expect(depth.ok ? [] : depth.diagnostics.map((d) => d.code)).toEqual(['limit']);
    const wide = { id: 'card', children: Array.from({ length: 5000 }, () => ({ id: 'text' })) };
    const many = catalogTreeToA2ui(wide, { ...options, maxComponents: 100 });
    expect(many.ok ? [] : many.diagnostics.map((d) => d.code)).toEqual(['limit']);
  });
});

describe('a2uiToCatalogTree', () => {
  it('turns the fixture payload into the fixture tree exactly', () => {
    expect(a2uiToCatalogTree(payload)).toEqual({
      ok: true,
      surfaceId: 'report',
      catalogId: 'catalog-example.json',
      roots: [tree],
      unused: [],
    });
  });

  it('round-trips tree → A2UI → tree', () => {
    const trees: CatalogTreeInput[][] = [
      [tree],
      [{ id: 'text' }, tree],
      [],
      [{ id: 'card', children: [] }],
    ];
    for (const roots of trees) {
      const out = catalogTreeToA2ui(roots, options);
      if (!out.ok) throw new Error('conversion failed');
      const back = a2uiToCatalogTree(JSON.parse(JSON.stringify(out.messages)));
      expect(back.ok && back.roots).toEqual(roots);
    }
  });

  it('follows a stream: upserts by id, single child, other surfaces and data ignored', () => {
    const result = a2uiToCatalogTree(fixture('streamed.a2ui.json'), {
      catalogId: 'catalog-example.json',
    });
    expect(result).toEqual({
      ok: true,
      surfaceId: 's1',
      catalogId: 'catalog-example.json',
      roots: [
        {
          id: 'card',
          children: [
            { id: 'text', props: { text: 'Ready.' } },
            { id: 'button', children: [{ id: 'text', props: { text: 'Open' } }] },
          ],
        },
      ],
      unused: ['draft'],
    });
    const other = a2uiToCatalogTree(fixture('streamed.a2ui.json'), { surfaceId: 'other' });
    expect(other.ok && other.roots).toEqual([{ id: 'text', props: { text: 'Another surface' } }]);
  });

  it('empties the surface after deleteSurface and allows re-creating it', () => {
    const create = { version: 'v0.9', createSurface: { surfaceId: 's', catalogId: 'c' } };
    const remove = { version: 'v0.9', deleteSurface: { surfaceId: 's' } };
    const deleted = a2uiToCatalogTree([
      create,
      ...msg([{ id: 'root', component: 'text' }]),
      remove,
    ]);
    expect(deleted.ok && deleted.roots).toEqual([]);
    const recreated = a2uiToCatalogTree([
      create,
      remove,
      create,
      ...msg([{ id: 'root', component: 'card' }]),
    ]);
    expect(recreated.ok && recreated.roots).toEqual([{ id: 'card' }]);
    expect(codes([create, create])).toEqual(['surface']);
    const mismatch = a2uiToCatalogTree([create], { catalogId: 'catalog-other.json' });
    expect(mismatch.ok ? [] : mismatch.diagnostics.map((d) => d.code)).toEqual(['surface']);
  });

  it('rejects every invalid fixture against the schema', () => {
    const cases = fixture('invalid.a2ui.json') as Record<string, unknown>;
    for (const [name, messages] of Object.entries(cases)) {
      expect(validateA2uiMessages(messages), name).not.toEqual([]);
      expect(codes(messages), name).toContain('schema');
    }
  });

  it('rejects broken trees: missing root or child, cycles, shared children', () => {
    expect(codes(msg([{ id: 'a', component: 'text' }]))).toEqual(['missing-root']);
    expect(codes(msg([{ id: 'root', component: 'card', children: ['gone'] }]))).toEqual([
      'missing-child',
    ]);
    expect(
      codes(
        msg([
          { id: 'root', component: 'card', children: ['a'] },
          { id: 'a', component: 'card', children: ['root'] },
        ])
      )
    ).toEqual(['cycle']);
    expect(codes(msg([{ id: 'root', component: 'card', child: 'root' }]))).toEqual(['cycle']);
    expect(
      codes(
        msg([
          { id: 'root', component: 'card', children: ['a', 'a'] },
          { id: 'a', component: 'text' },
        ])
      )
    ).toEqual(['shared-child']);
    expect(codes(msg([{ id: 'root', component: 'card', children: ['a'], child: 'a' }]))).toEqual([
      'invalid-node',
    ]);
    expect(
      codes(
        msg([
          { id: 'root', component: 'card', children: ['a'] },
          { id: 'a', component: 'texuli-roots' },
        ])
      )
    ).toEqual(['invalid-node']);
  });

  it('rejects templates, bindings, function calls and prototype keys', () => {
    expect(
      codes(
        msg([{ id: 'root', component: 'list', children: { componentId: 'row', path: '/rows' } }])
      )
    ).toEqual(['template-children']);
    expect(codes(msg([{ id: 'root', component: 'text', text: { path: '/user/name' } }]))).toEqual([
      'binding',
    ]);
    expect(
      codes(msg([{ id: 'root', component: 'text', text: { call: 'upper', returnType: 'string' } }]))
    ).toEqual(['binding']);
    const hostile = JSON.parse(
      '[{"version":"v0.9","updateComponents":{"surfaceId":"s","components":[{"id":"root","component":"card","__proto__":{"polluted":true},"meta":{"constructor":{"prototype":{"x":1}}}}]}}]'
    );
    expect(codes(hostile)).toEqual(['unsafe-key', 'unsafe-key']);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('bounds untrusted payloads before walking them', () => {
    const wide = msg(Array.from({ length: 2000 }, (_, i) => ({ id: `c${i}`, component: 'text' })));
    expect(codes(wide)).toEqual(['limit']);
    const fanOut = msg([{ id: 'root', component: 'card', children: Array(5000).fill('x') }]);
    expect(codes(fanOut)).toEqual(['limit']);
    const chain = Array.from({ length: 20 }, (_, i) => ({
      id: i === 0 ? 'root' : `c${i}`,
      component: 'card',
      children: i < 19 ? [`c${i + 1}`] : [],
    }));
    const deep = a2uiToCatalogTree(msg(chain), { maxDepth: 10 });
    expect(deep.ok ? [] : deep.diagnostics.map((d) => d.code)).toEqual(['limit']);
  });

  it('copies props instead of sharing them with the payload', () => {
    const input = msg([{ id: 'root', component: 'text', meta: { n: 1 } }]);
    const result = a2uiToCatalogTree(input);
    if (!result.ok) throw new Error('conversion failed');
    (result.roots[0]?.props?.meta as { n: number }).n = 2;
    expect(input[0]?.updateComponents.components[0]).toMatchObject({ meta: { n: 1 } });
  });
});

describe('the schema check', () => {
  it('reads $ref, oneOf, pattern and additionalProperties like JSON Schema', () => {
    expect(checkJsonSchema(A2UI_MESSAGE_SCHEMA, payload)).not.toEqual([]); // an array is not a message
    expect(validateA2uiMessages(payload)).toEqual([]);
    const [error] = validateA2uiMessages([{ version: 'v0.9', deleteSurface: { surfaceId: '' } }]);
    expect(error).toMatchObject({ code: 'schema', path: '$[0].deleteSurface.surfaceId' });
    expect(validateA2uiMessages({})).toMatchObject([{ path: '$' }]);
  });
});

describe('rendering an A2UI payload', () => {
  const specs: RenderComponentSpec[] = [
    {
      id: 'card',
      label: 'Card',
      emit: ['developer', 'untrusted'],
      props: [{ name: 'title', kind: 'string' }],
    },
    {
      id: 'text',
      label: 'Text',
      emit: ['developer', 'untrusted'],
      props: [{ name: 'text', kind: 'string' }],
    },
    { id: 'dialog', label: 'Dialog', agentEmittable: false, emit: ['developer'], props: [] },
  ];

  it('goes through the sink-free renderer: tiers and HTML rules still apply', () => {
    const result = a2uiToCatalogTree(
      msg([
        { id: 'root', component: 'card', title: 'Hi', class: 'evil', children: ['a', 'b', 'c'] },
        { id: 'a', component: 'text', text: 'Plain words' },
        { id: 'b', component: 'dialog' },
        { id: 'c', component: 'text', text: '<img src=x onerror=alert(1)>' },
      ])
    );
    if (!result.ok) throw new Error('conversion failed');
    const rendered = renderCatalogTree(result.roots, { catalog: renderCatalogFromSpecs(specs) });
    expect(rendered.roots).toEqual([
      {
        kind: 'component',
        id: 'card',
        props: { title: 'Hi' },
        children: [
          { kind: 'component', id: 'text', props: { text: 'Plain words' }, children: [] },
          {
            kind: 'placeholder',
            id: 'dialog',
            label: 'Dialog (not allowed)',
            reason: 'tier-denied',
          },
        ],
      },
    ]);
    expect(rendered.diagnostics.map((d) => d.code)).toEqual(
      expect.arrayContaining(['forbidden-prop', 'tier-denied', 'html-string'])
    );
  });
});
