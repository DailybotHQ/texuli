// @vitest-environment node
import { ENVELOPE_STATUSES, MAX_PROVENANCE, MAX_SOURCES } from '@texuli/catalog/envelope';
import { describe, expect, it } from 'vitest';
import { projectLiveCatalog } from '../scripts/bootstrap-catalog.ts';
import type { SpecCatalog } from '../src/catalog.ts';
import { json } from './helpers.ts';

/**
 * Drift between the spec and the shipped web packages is a failed gate.
 * Refresh with `pnpm exec tsx packages/spec/scripts/bootstrap-catalog.ts`
 * and `pnpm exec tsx packages/spec/scripts/generate.ts`, then review the diff.
 */
describe('parity with the web packages', () => {
  it('catalog/components.json is the projection of the live built catalog', async () => {
    expect(json<SpecCatalog>('catalog/components.json')).toEqual(await projectLiveCatalog());
  });

  it('the blueprint schema matches the envelope the catalog reads', () => {
    const schema = json<{
      $defs: { status: { enum: string[] } };
      properties: { sources: { maxItems: number }; provenance: { maxItems: number } };
    }>('schemas/blueprint.schema.json');
    expect(schema.$defs.status.enum).toEqual([...ENVELOPE_STATUSES]);
    expect(schema.properties.sources.maxItems).toBe(MAX_SOURCES);
    expect(schema.properties.provenance.maxItems).toBe(MAX_PROVENANCE);
  });

  it('marks slot, event and unknown props and CSS or renderer props as web extensions', () => {
    const catalog = json<SpecCatalog>('catalog/components.json');
    const props = catalog.components.flatMap((c) => c.props);
    for (const prop of props) {
      const webOnly =
        ['slot', 'event', 'unknown'].includes(prop.kind) ||
        ['class', 'className', 'style', 'renderer'].includes(prop.name);
      expect(prop.extension === 'web', `${prop.name} (${prop.kind})`).toBe(webOnly);
    }
  });
});
