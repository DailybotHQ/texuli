// @vitest-environment node
import { readFileSync } from 'node:fs';
import { type Schema, validateBlueprint } from '@texuli/spec';
import { projectCatalog } from '@texuli/spec/codegen';
import type { SpecSourceDescriptor } from '@texuli/spec/source';
import { describe, expect, it } from 'vitest';
import blueprintJson from '../../spec/schemas/blueprint.schema.json';
import { buildCatalog } from '../src/build/build.ts';
import { discoverManifestGroups } from '../src/build/node.ts';
import { validateCatalogManifest } from '../src/manifest/validate.ts';
import { DATA_MANIFESTS } from '../src/manifests/data/index.ts';
import { renderCatalogFromBuild } from '../src/render/renderer/index.ts';
import { type DraftValidation, validateDraft } from '../src/validate/index.ts';

/**
 * Data-source bindings in validateDraft (spec 0.8.0, ADR-015): a whole
 * sourceable prop names a source the host registered and sends a closed
 * query, checked against the host's descriptors. With no descriptors every
 * binding is refused; the renderer checks an empty list meanwhile, and the
 * player fills it with the source's rows at paint time.
 */

const build = await buildCatalog(await discoverManifestGroups());
const catalog = renderCatalogFromBuild(build.catalog);
const read = (path: string) =>
  JSON.parse(readFileSync(new URL(`../../spec/${path}`, import.meta.url), 'utf8'));
const sources = (read('fixtures/sources.json') as { sources: SpecSourceDescriptor[] }).sources;
const golden = read('fixtures/golden/source-tickets.json') as Record<string, unknown>;

const codes = (result: DraftValidation) =>
  result.diagnostics.filter((d) => d.severity === 'error').map((d) => `${d.check}:${d.code}`);
const grid = (rows: unknown) => ({
  ...golden,
  tree: {
    id: 'layout-page',
    props: { title: 'Tickets' },
    children: [
      {
        id: 'data-grid',
        props: { caption: 'Tickets', columns: [{ id: 'title', header: 'Title' }], rows },
      },
    ],
  },
});

describe('data-source bindings in validateDraft', () => {
  it('accepts the source golden against the host, and paints an empty list until rows arrive', () => {
    const result = validateDraft(golden, { catalog, sources });
    expect(codes(result)).toEqual([]);
    const page = result.roots[0];
    const gridNode = page?.kind === 'component' ? page.children[0] : undefined;
    expect(gridNode?.kind === 'component' && gridNode.props.rows).toEqual([]);
  });

  it('refuses every binding when the host passes no sources (fail closed)', () => {
    expect(codes(validateDraft(golden, { catalog }))).toEqual([
      'interaction:source',
      'interaction:source',
    ]);
  });

  it('agrees with the spec validator on every refusal', () => {
    const documents = {
      blueprintSchema: blueprintJson as unknown as Schema,
      catalog: projectCatalog(build.catalog, build.hash),
      sources,
    };
    const cases: [unknown, string][] = [
      [{ $source: 'payments' }, 'unknown-source'],
      [{ $source: 'https://attacker.example/rows.json' }, 'source'],
      [{ $source: 'tickets', url: '/api' }, 'source'],
      [{ $source: 'tickets', query: { pageSize: 101 } }, 'source'],
      [{ $source: 'tickets', query: { fields: ['passwordHash'] } }, 'source'],
      [{ $source: 'tickets', query: { sort: [{ field: 'assignee' }] } }, 'source'],
      [
        {
          $source: 'tickets',
          query: { filter: { type: 'condition', field: 'status', operator: 'eq', value: 'lost' } },
        },
        'source',
      ],
      [{ $source: 'tickets', map: { cells: 'nope' } }, 'source'],
      [{ $source: 'tickets', $state: 'rows' }, 'source'],
    ];
    for (const [rows, code] of cases) {
      const label = JSON.stringify(rows);
      // A URL-looking member is also a sink finding; the binding refusal is always there.
      expect(codes(validateDraft(grid(rows), { catalog, sources })), label).toContain(
        `interaction:${code}`
      );
      const spec = validateBlueprint(grid(rows), documents).diagnostics.map((d) => d.code);
      expect(spec, label).toEqual([code]);
    }
    // Only whole sourceable props read a source.
    expect(
      codes(
        validateDraft(
          {
            ...golden,
            tree: {
              id: 'data-grid',
              props: { caption: 'x', columns: { $source: 'tickets' }, rows: [] },
            },
          },
          { catalog, sources }
        )
      )
    ).toContain('interaction:source');
  });

  it('checks a manifest sourceable list: declared array props only', () => {
    const grid = DATA_MANIFESTS.find((manifest) => manifest.id === 'data-grid');
    if (!grid) throw new Error('data-grid manifest');
    expect(grid.sourceable).toEqual(['rows']);
    for (const [sourceable, code] of [
      [['caption'], 'invalid-sourceable'],
      [['nope'], 'invalid-sourceable'],
      ['rows', 'invalid-type'],
    ] as const) {
      const result = validateCatalogManifest({ ...grid, sourceable } as never);
      expect(
        result.diagnostics.map((d) => d.code),
        String(sourceable)
      ).toContain(code);
    }
    expect(validateCatalogManifest(grid).diagnostics).toEqual([]);
  });
});
