// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { COMPOSITION_LIMITS, validateComposition } from '../src/index.ts';

function scene(layers: unknown[] = []) {
  return { version: 1, width: 1200, height: 800, durationMs: 12_000, layers };
}

function frame() {
  return { x: 0, y: 0, width: 100, height: 80 };
}

function shape(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    type: 'shape',
    shape: 'rectangle',
    frame: frame(),
    fill: { kind: 'solid', color: '#16324f' },
    ...overrides,
  };
}

function image(id: string, src: unknown, overrides: Record<string, unknown> = {}) {
  return {
    id,
    type: 'image',
    frame: frame(),
    src,
    alt: 'Fictional image',
    ...overrides,
  };
}

describe('validateComposition', () => {
  it('preserves bounded generation provenance on image layers, and 11 related cases', async () => {
    {
      // preserves bounded generation provenance on image layers
      const provenance = {
        source: 'model',
        createdAt: '2026-10-24T18:30:00.000Z',
        generatorKind: 'image',
        providerLabel: 'host:mock',
        promptHash: 'a'.repeat(64),
        options: { aspectRatio: '16:9' },
      } as const;
      const result = validateComposition(
        scene([image('generated-cover', 'https://images.example.com/harbor.png', { provenance })])
      );

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.composition.layers[0]).toMatchObject({ provenance });
    }
    // accepts shapes, text, images, gradients, masks, blend modes and numeric transforms
    await (async () => {
      const input = scene([
        shape('backdrop', {
          fill: {
            kind: 'linear-gradient',
            angle: 135,
            stops: [
              { offset: 0, color: '#16324f' },
              { offset: 1, color: '#4c91a8' },
            ],
          },
        }),
        image('portrait', '/assets/portrait.webp', {
          transform: { rotateDeg: 3, scaleX: 1.1, translateY: -2 },
          blendMode: 'multiply',
          mask: { layerId: 'portrait-mask', mode: 'alpha' },
        }),
        shape('portrait-mask', { shape: 'ellipse' }),
        {
          id: 'headline',
          type: 'text',
          frame: frame(),
          text: 'A scene, described as data',
          paint: { kind: 'solid', color: '#ffffff' },
          fontSize: 48,
          fontWeight: 700,
          align: 'start',
        },
      ]);

      const result = validateComposition(input);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.composition.layers).toHaveLength(4);
      expect(result.composition.layers[1]).toMatchObject({
        id: 'portrait',
        type: 'image',
        src: '/assets/portrait.webp',
        mask: { layerId: 'portrait-mask', mode: 'alpha' },
        transform: { rotateDeg: 3, scaleX: 1.1, translateY: -2 },
      });
    })();
    {
      // accepts radial gradients and ordered hard-stop offsets
      const result = validateComposition(
        scene([
          shape('glow', {
            fill: {
              kind: 'radial-gradient',
              center: { x: 0.5, y: 0.25 },
              radius: 0.75,
              stops: [
                { offset: 0, color: '#fff' },
                { offset: 0.5, color: '#ffffff80' },
                { offset: 0.5, color: '#000000' },
              ],
            },
          }),
        ])
      );
      expect(result.ok).toBe(true);
    }
    // defaults to untrusted sources and rejects executable, protocol-relative, data, and malformed image URLs
    for (const src of [
      'javascript:alert(1)',
      '//media.example.test/image.webp',
      'data:image/png;base64,iVBORw0KGgo=',
      'https://user:pass@media.example.test/image.webp',
      'https://media.example.test/has space.webp',
    ]) {
      const result = validateComposition(scene([image('photo', src)]));
      expect(result.ok, String(src)).toBe(false);
      if (!result.ok)
        expect(result.errors.some((issue) => issue.code === 'unsafe-source')).toBe(true);
    }
    {
      // allows only bounded developer-authored raster data images when explicitly requested
      const source = 'data:image/png;base64,iVBORw0KGgo=';
      expect(validateComposition(scene([image('photo', source)])).ok).toBe(false);
      const result = validateComposition(scene([image('photo', source)]), { trust: 'developer' });
      expect(result.ok).toBe(true);
      expect(
        validateComposition(scene([image('photo', 'data:image/svg+xml;base64,PHN2Zz4=')]), {
          trust: 'developer',
        }).ok
      ).toBe(false);
    }
    {
      // rejects unknown properties and CSS or markup strings instead of preserving them
      const result = validateComposition(
        scene([
          shape('unsafe', {
            style: 'background:url(javascript:alert(1))',
            fill: { kind: 'solid', color: 'url(https://evil.example)' },
          }),
        ])
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.map((issue) => issue.code)).toContain('unknown-field');
        expect(result.errors.some((issue) => issue.path.endsWith('.fill.color'))).toBe(true);
      }
    }
    {
      // does not echo control or bidirectional characters from unknown property names into error paths
      const spoofKey = `${String.fromCharCode(0x202e)}payload`;
      const result = validateComposition(scene([shape('unsafe', { [spoofKey]: true })]));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const unknownField = result.errors.find((issue) => issue.code === 'unknown-field');
        expect(unknownField?.path).toBe('layers[0].<unknown>');
        expect(unknownField?.path).not.toContain('\u202E');
      }
    }
    {
      // enforces dimensions, layer count, duration, text, and serialized-size limits
      expect(validateComposition({ ...scene(), width: 0 }).ok).toBe(false);
      expect(
        validateComposition({ ...scene(), height: COMPOSITION_LIMITS.maxDimension + 1 }).ok
      ).toBe(false);
      expect(
        validateComposition({ ...scene(), durationMs: COMPOSITION_LIMITS.maxDurationMs + 1 }).ok
      ).toBe(false);
      expect(
        validateComposition(
          scene(
            Array.from({ length: COMPOSITION_LIMITS.maxLayers + 1 }, (_, i) => shape(`layer-${i}`))
          )
        ).ok
      ).toBe(false);
      expect(
        validateComposition(
          scene([
            {
              id: 'long-copy',
              type: 'text',
              frame: frame(),
              text: 'x'.repeat(COMPOSITION_LIMITS.maxTextLength + 1),
              paint: { kind: 'solid', color: '#fff' },
              fontSize: 12,
            },
          ])
        ).ok
      ).toBe(false);
      const largeSource = `data:image/png;base64,${'A'.repeat(1_398_100)}`;
      const oversized = scene([image('large-one', largeSource), image('large-two', largeSource)]);
      const oversizedResult = validateComposition(oversized, { trust: 'developer' });
      expect(oversizedResult.ok).toBe(false);
      if (!oversizedResult.ok) {
        expect(oversizedResult.errors.some((issue) => issue.code === 'limit-exceeded')).toBe(true);
      }
    }
    // rejects duplicate ids, missing mask references, self masks, and mask cycles
    expect(validateComposition(scene([shape('same'), shape('same')])).ok).toBe(false);
    expect(
      validateComposition(scene([shape('shape', { mask: { layerId: 'missing', mode: 'alpha' } })]))
        .ok
    ).toBe(false);
    expect(
      validateComposition(scene([shape('self', { mask: { layerId: 'self', mode: 'alpha' } })])).ok
    ).toBe(false);
    expect(
      validateComposition(
        scene([
          shape('one', { mask: { layerId: 'two', mode: 'alpha' } }),
          shape('two', { mask: { layerId: 'one', mode: 'luminance' } }),
        ])
      ).ok
    ).toBe(false);
    // rejects invalid numeric transforms, unordered gradient stops, and unknown layer kinds
    expect(
      validateComposition(
        scene([shape('bad-scale', { transform: { scaleX: Number.POSITIVE_INFINITY } })])
      ).ok
    ).toBe(false);
    expect(
      validateComposition(
        scene([
          shape('bad-gradient', {
            fill: {
              kind: 'linear-gradient',
              angle: 20,
              stops: [
                { offset: 0.8, color: '#000' },
                { offset: 0.2, color: '#fff' },
              ],
            },
          }),
        ])
      ).ok
    ).toBe(false);
    expect(validateComposition(scene([{ id: 'unknown', type: 'video', frame: frame() }])).ok).toBe(
      false
    );
    {
      // returns a sanitized copy and does not mutate the author input
      const input = scene([shape('background')]);
      const original = structuredClone(input);
      const result = validateComposition(input);
      expect(result.ok).toBe(true);
      expect(input).toEqual(original);
      if (result.ok) expect(result.composition).not.toBe(input);
    }
    {
      // fails closed for cyclic values and non-plain objects
      const cyclic: Record<string, unknown> = scene();
      cyclic.self = cyclic;
      expect(validateComposition(cyclic).ok).toBe(false);
      expect(validateComposition(new Date()).ok).toBe(false);
    }
  });
});
