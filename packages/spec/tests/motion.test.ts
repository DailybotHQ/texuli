import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SPEC_ROOT } from '../scripts/files.ts';
import type { SpecCatalog } from '../src/catalog.ts';
import type { Schema } from '../src/dialect.ts';
import { migrateBlueprint } from '../src/migrations/index.ts';
import {
  checkEnvelopeMotion,
  checkNodeMotion,
  SPEC_MOTION_DURATIONS,
  SPEC_MOTION_LEVELS,
  SPEC_MOTION_PRESETS,
  SPEC_MOTION_STAGGERS,
  SPEC_NODE_MOTION_FIELDS,
} from '../src/motion.ts';
import { validateBlueprint } from '../src/validate.ts';
import { SPEC_VERSION } from '../src/version.ts';
import { json } from './helpers.ts';

type Defs = Record<string, Schema & { properties?: Record<string, Schema> }>;
const schema = json<{ $defs: Defs; properties: Record<string, Schema> }>(
  'schemas/blueprint.schema.json'
);
const documents = {
  blueprintSchema: json<Schema>('schemas/blueprint.schema.json'),
  catalog: json<SpecCatalog>('catalog/components.json'),
};
const golden = () => json<Record<string, unknown>>('fixtures/golden/app-dashboard.json');

/** Put `motion` on the golden's first child, or on the envelope. */
function withMotion(node: unknown, envelope?: unknown): Record<string, unknown> {
  const blueprint = golden();
  const tree = blueprint.tree as { children: Record<string, unknown>[] };
  const first = tree.children[0] as Record<string, unknown>;
  if (node !== undefined) first.motion = node;
  else delete first.motion;
  if (envelope !== undefined) blueprint.motion = envelope;
  return blueprint;
}

const codes = (blueprint: unknown) =>
  validateBlueprint(blueprint, documents).diagnostics.map((d) => d.code);

describe('spec 0.6.0: the closed motion vocabulary', () => {
  it('mirrors the schema in code and is reachable from nodes and the envelope', () => {
    const d = schema.$defs;
    expect(d.motionPreset?.enum).toEqual([...SPEC_MOTION_PRESETS]);
    expect(d.motionDuration?.enum).toEqual([...SPEC_MOTION_DURATIONS]);
    expect(d.motionStagger?.enum).toEqual([...SPEC_MOTION_STAGGERS]);
    expect(d.motionLevel?.enum).toEqual([...SPEC_MOTION_LEVELS]);
    expect(Object.keys(d.nodeMotion?.properties ?? {})).toEqual([...SPEC_NODE_MOTION_FIELDS]);
    expect(d.nodeMotion?.additionalProperties).toBe(false);
    expect(d.envelopeMotion?.additionalProperties).toBe(false);
    expect(d.node?.properties?.motion).toEqual({ $ref: '#/$defs/nodeMotion' });
    expect(schema.properties.motion).toEqual({ $ref: '#/$defs/envelopeMotion' });
    expect(schema.properties.spec?.enum).toContain(SPEC_VERSION);
    // Token names only: no value of the vocabulary looks like a CSS length, time or function.
    for (const value of [
      ...SPEC_MOTION_PRESETS,
      ...SPEC_MOTION_DURATIONS,
      ...SPEC_MOTION_STAGGERS,
    ]) {
      expect(value).toMatch(/^[a-z]+(-[a-z]+)?$/);
    }
  });

  it('accepts every preset, step and level on a node and the envelope', () => {
    expect(codes(golden())).toEqual([]);
    for (const enter of SPEC_MOTION_PRESETS) {
      for (const duration of SPEC_MOTION_DURATIONS) {
        const motion = { enter, exit: enter, layout: true, stagger: 'base', duration };
        expect(codes(withMotion(motion)), `${enter} ${duration}`).toEqual([]);
        expect(checkNodeMotion(motion)).toEqual({ ok: true, motion });
      }
    }
    for (const level of SPEC_MOTION_LEVELS) {
      expect(codes(withMotion(undefined, { level })), level).toEqual([]);
      expect(checkEnvelopeMotion({ level })).toEqual({ ok: true, motion: { level } });
    }
    expect(codes(withMotion({}))).toEqual([]);
    expect(checkNodeMotion({})).toEqual({ ok: true, motion: {} });
  });

  it('refuses raw CSS, milliseconds, keyframes, unknown names and a huge stagger, in both checks', () => {
    const hostile: [string, unknown][] = [
      ['raw css field', { enter: 'fade', css: 'transition: all 9s linear' }],
      ['style field', { style: 'animation: spin 1s infinite' }],
      ['keyframes', { enter: [{ opacity: 0 }, { opacity: 1 }] }],
      ['easing function', { enter: 'fade', easing: 'cubic-bezier(0, 0, 1, 1)' }],
      ['duration in ms', { enter: 'rise', duration: '350ms' }],
      ['numeric duration', { enter: 'rise', duration: 350 }],
      ['unknown preset', { enter: 'spin' }],
      ['css as a preset', { enter: 'opacity 0.2s' }],
      ['case variant', { enter: 'Fade' }],
      ['huge stagger', { stagger: 100000 }],
      ['stagger in ms', { stagger: '9999ms' }],
      ['unknown stagger step', { stagger: 'slower' }],
      ['layout as text', { layout: 'true' }],
      ['level on a node', { level: 'full' }],
      ['not an object', 'fade'],
      ['an array', ['fade']],
      ['null', null],
    ];
    for (const [name, motion] of hostile) {
      expect(codes(withMotion(motion)), name).toEqual(['schema']);
      const checked = checkNodeMotion(motion);
      expect(checked.ok, name).toBe(false);
    }
    for (const level of ['max', 'reduce', 0, null, ['full']]) {
      expect(codes(withMotion(undefined, { level })), String(level)).toEqual(['schema']);
      expect(checkEnvelopeMotion({ level }).ok).toBe(false);
    }
    expect(codes(withMotion(undefined, 'full'))).toEqual(['schema']);
    expect(codes(withMotion(undefined, { level: 'full', durationScale: 3 }))).toEqual(['schema']);
    expect(checkEnvelopeMotion({ level: 'full', durationScale: 3 }).ok).toBe(false);
    expect(checkEnvelopeMotion({}).ok).toBe(false);
  });

  it('keeps refusal messages short and never echoes a long value', () => {
    const long = 'x'.repeat(100_000);
    const checked = checkNodeMotion({ enter: long });
    expect(checked.ok).toBe(false);
    if (!checked.ok) {
      expect(checked.path).toBe('.enter');
      expect(checked.message.length).toBeLessThan(200);
    }
    const key = checkNodeMotion({ [long]: 'fade' });
    expect(!key.ok && key.path.length).toBeLessThanOrEqual(33);
    // Linear and stops at the first unknown key, even on a wide object.
    const wide = Object.fromEntries(Array.from({ length: 50_000 }, (_, i) => [`k${i}`, i]));
    const started = performance.now();
    expect(checkNodeMotion(wide).ok).toBe(false);
    expect(performance.now() - started).toBeLessThan(500);
  });

  it('freezes what it accepts and drops nothing it knows', () => {
    const checked = checkNodeMotion({ enter: 'scale', layout: false });
    expect(checked.ok && Object.isFrozen(checked.motion)).toBe(true);
    expect(checked.ok && checked.motion).toEqual({ enter: 'scale', layout: false });
  });

  it('migrates a 0.5.0 envelope by stamping spec only', () => {
    const input: Record<string, unknown> = { ...withMotion(undefined), spec: '0.5.0' };
    delete input.motion;
    const result = migrateBlueprint(input);
    expect(result.applied).toEqual(['0.5.0->0.6.0']);
    expect(result.blueprint).toEqual({ ...input, spec: '0.6.0' });
    expect((result.blueprint as { tree: unknown }).tree).toBe(input.tree);
    expect(codes(result.blueprint)).toEqual([]);
  });

  it('ships as its own runtime subpath with no runtime imports', () => {
    const pkg = JSON.parse(readFileSync(join(SPEC_ROOT, 'package.json'), 'utf8'));
    expect(pkg.exports['./motion']).toEqual({
      types: './src/motion.ts',
      default: './src/motion.ts',
    });
    const source = readFileSync(join(SPEC_ROOT, 'src/motion.ts'), 'utf8');
    const imports = source.match(/^import .*$/gm) ?? [];
    expect(imports.every((line) => line.startsWith('import type'))).toBe(true);
  });
});
