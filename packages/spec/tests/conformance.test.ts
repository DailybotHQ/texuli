// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { SpecCatalog } from '../src/catalog.ts';
import { checkConformance } from '../src/conformance.ts';
import type { Schema } from '../src/dialect.ts';
import { validateBlueprint } from '../src/validate.ts';
import { build, committedOutputs, json, normative } from './helpers.ts';

const committed = committedOutputs();

describe('conformance harness', () => {
  it('passes on the committed spec: digests, regenerate-and-diff, golden and invalid fixtures', () => {
    expect(checkConformance(normative, committed)).toEqual([]);
  });

  it('catches a hand-edited generated file, a missing one and an extra one', () => {
    const tsPath = 'generated/typescript/blueprint.ts';
    const edited = { ...committed, [tsPath]: `${committed[tsPath]}// edited\n` };
    expect(checkConformance(normative, edited).map((i) => `${i.check} ${i.path}`)).toEqual([
      `generated ${tsPath}`,
    ]);
    const { [tsPath]: _gone, ...missing } = committed;
    expect(checkConformance(normative, missing)[0]?.message).toBe('missing');
    const extra = { ...committed, 'generated/kotlin/com/texuli/spec/Stray.kt': '' };
    expect(checkConformance(normative, extra)[0]?.message).toMatch(/no generator/);
  });

  it('catches a normative file changed without regenerating', () => {
    const changed = { ...normative, 'catalog/capabilities.json': '{}\n\n' };
    const checks = new Set(checkConformance(changed, committed).map((i) => i.check));
    expect(checks.has('manifest')).toBe(true);
    expect(checks.has('generated')).toBe(true);
  });

  it('refuses an unaudited or unknown capability claim', () => {
    const claimed = { ...normative, 'catalog/capabilities.json': '{"no-such-id":"portable-core"}' };
    expect(checkConformance(claimed, committed).some((i) => i.check === 'capabilities')).toBe(true);
  });
});

describe('golden and invalid fixtures', () => {
  const documents = {
    blueprintSchema: json<Schema>('schemas/blueprint.schema.json'),
    catalog: json<SpecCatalog>('catalog/components.json'),
  };

  it('has golden blueprints for a report, a dashboard, a proactive deck and a conditional report', () => {
    const golden = Object.keys(normative).filter((p) => p.startsWith('fixtures/golden/'));
    expect(golden.sort()).toEqual([
      'fixtures/golden/conditional-report.json',
      'fixtures/golden/dashboard.json',
      'fixtures/golden/proactive-deck.json',
      'fixtures/golden/report-on-demand.json',
    ]);
    for (const path of golden) expect(validateBlueprint(json(path), documents).ok, path).toBe(true);
  });

  it('covers every stable diagnostic code with an invalid fixture', () => {
    const covered = new Set(
      Object.keys(normative)
        .filter((p) => p.startsWith('fixtures/invalid/'))
        .flatMap((p) => json<{ expect: string[] }>(p).expect)
    );
    const diagnostics = json<{ $defs: { diagnosticCode: { enum: string[] } } }>(
      'schemas/diagnostics.schema.json'
    );
    expect([...covered].sort()).toEqual([...diagnostics.$defs.diagnosticCode.enum].sort());
  });

  it('covers the slot and condition surface with golden and invalid fixtures', () => {
    const expectOf = (name: string) =>
      json<{ expect: string[] }>(`fixtures/invalid/${name}.json`).expect;
    expect(expectOf('unknown-slot')).toEqual(['unknown-slot']);
    expect(expectOf('unknown-slot-root')).toEqual(['unknown-slot']);
    expect(expectOf('condition-unknown-op')).toEqual(['schema']);
    expect(expectOf('condition-extra-field')).toEqual(['schema']);
    const golden = JSON.stringify(json('fixtures/golden/conditional-report.json'));
    expect(golden).toContain('"slot"');
    expect(golden).toContain('"when"');
  });

  it('refuses each slot and condition fixture with exactly its expected codes', () => {
    for (const name of [
      'unknown-slot',
      'unknown-slot-root',
      'condition-unknown-op',
      'condition-extra-field',
    ]) {
      const fixture = json<{ expect: string[]; blueprint: unknown }>(
        `fixtures/invalid/${name}.json`
      );
      const codes = validateBlueprint(fixture.blueprint, documents).diagnostics.map((d) => d.code);
      expect(codes, name).toEqual(fixture.expect);
    }
  });

  it('fails a portable profile closed while no id is audited portable', () => {
    expect(documents.catalog.components.every((c) => c.capability === 'unknown')).toBe(true);
    const portable = {
      ...json<Record<string, unknown>>('fixtures/golden/report-on-demand.json'),
      profile: 'portable',
    };
    expect(validateBlueprint(portable, documents).diagnostics[0]?.code).toBe('unsupported-profile');
  });

  it('keeps the stamp consistent with the manifest', () => {
    expect(committed['manifest.json']).toBe(build.manifest);
  });
});
