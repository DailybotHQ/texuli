// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { PLAYER_MANIFESTS, projectPlayerSpecs } from '../scripts/render-specs.ts';
import { PLAYER_RENDER_SPECS } from '../src/render-specs.ts';

/**
 * The player's default catalog is built from generated lean specs. They must
 * equal the projection of the live catalog manifests: regenerate with
 * `pnpm exec tsx packages/player/scripts/render-specs.ts` (then Biome) when
 * a manifest changes.
 */
describe('generated render specs', () => {
  it('equal the projection of the live manifests', () => {
    expect(JSON.parse(JSON.stringify(PLAYER_RENDER_SPECS))).toEqual(
      JSON.parse(JSON.stringify(projectPlayerSpecs()))
    );
  });

  it('keep everything validation and painting read', () => {
    const byId = new Map(PLAYER_RENDER_SPECS.map((spec) => [spec.id, spec]));
    for (const manifest of PLAYER_MANIFESTS) {
      const spec = byId.get(manifest.id);
      expect(spec?.label, manifest.id).toBe(manifest.label);
      expect(
        spec?.props.map((p) => [p.name, p.kind, p.required === true, p.enumValues ?? null])
      ).toEqual(
        manifest.props.map((p) => [p.name, p.kind, p.required === true, p.enumValues ?? null])
      );
      expect(spec?.events ?? null).toEqual(manifest.events ?? null);
      expect(spec?.bindable ?? null).toEqual(manifest.bindable ?? null);
    }
    expect(byId.get('sortable-list')?.props.find((p) => p.name === 'reorder')?.schema).toEqual({
      $ref: '#/$defs/reorder',
    });
  });
});
