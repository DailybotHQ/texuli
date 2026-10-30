// @vitest-environment node
import { BLOCK_FAMILY_TYPES } from '@texuli/catalog/render/renderer';
import { expect, it } from 'vitest';
import { rawFamilyCheck } from '../src/internal/family-check.ts';
import { texuliOps } from '../src/ops/index.ts';
import { scenario } from './scenario.ts';

/**
 * `block.list` and `block.schema` (INV-agent-first): every block type the
 * validator accepts is served with a shape and valid examples, and a
 * `block-schema` diagnostic names the shape expected where it failed.
 */

// biome-ignore lint/suspicious/noExplicitAny: operation outputs are JSON this test inspects.
type Json = any;

async function output(name: string, input: Record<string, unknown>): Promise<Json> {
  const outcome = await texuliOps.invoke(name, input);
  if (!outcome.ok) throw new Error(`${outcome.error.code}: ${outcome.error.message}`);
  return outcome.output;
}

/**
 * Block types no instance of which passes blueprint.validate at the
 * untrusted tier: the tree parser requires `style`, and the draft sink scan
 * refuses every `style` key. Remove a type when that conflict is fixed.
 */
const UNUSABLE = ['tree'];

const VALIDATED = Object.entries(BLOCK_FAMILY_TYPES).flatMap(([component, types]) =>
  types.map((type) => ({ type, component }))
);

async function blockMessages(component: string, block: unknown): Promise<string[]> {
  const result = await output('blueprint.validate', {
    draft: { id: component, props: { block } },
    fragment: true,
  });
  return result.diagnostics.map((diagnostic: Json) => diagnostic.message);
}

it('serves every block type the validator accepts, each with a shape and examples the validator passes', async () => {
  await scenario('block.list lists exactly the validated types, by component', async () => {
    const listed = await output('block.list', {});
    expect(listed.blocks.map((block: Json) => [block.type, block.component])).toEqual(
      VALIDATED.map((item) => [item.type, item.component])
    );
    expect(listed.total).toBe(VALIDATED.length);
    const data = await output('block.list', { component: 'blocks-data' });
    expect(data.blocks.map((block: Json) => block.type)).toEqual(BLOCK_FAMILY_TYPES['blocks-data']);
    const questions = await output('block.list', { query: 'question' });
    expect(questions.blocks.map((block: Json) => block.type)).toEqual(
      expect.arrayContaining(['poll', 'quiz'])
    );
  });
  for (const { type, component } of VALIDATED) {
    await scenario(`block.schema ${type}`, async () => {
      const schema = await output('block.schema', { type });
      expect(schema).toMatchObject({ type, component });
      expect(schema.shape).toMatch(new RegExp(`^\\{ type: '${type}'`, 'u'));
      expect(schema.schema.properties.type).toEqual({ const: type });
      expect(schema.schema.required).toContain('type');
      expect(schema.usableInBlueprint).toBe(!UNUSABLE.includes(type));
      if (UNUSABLE.includes(type)) {
        // No instance passes a blueprint today: say why instead of serving a failing example.
        expect(schema.examples).toEqual([]);
        expect(schema.notes.join(' ')).toMatch(/forbidden "style" key/u);
        return;
      }
      expect(schema.examples.length).toBeGreaterThan(0);
      for (const example of schema.examples) {
        expect(rawFamilyCheck(example, component)).toEqual({ success: true });
        const draft = await output('blueprint.validate', {
          draft: { id: component, props: { block: example } },
          fragment: true,
        });
        expect(draft.diagnostics).toEqual([]);
        // Every required field is one the validator refuses the example without.
        for (const key of schema.schema.required) {
          const { [key]: _dropped, ...rest } = example;
          expect(rawFamilyCheck(rest, component).success, `${type} without ${key}`).toBe(false);
        }
      }
    });
  }
  await scenario('an unknown or prototype type is refused by the input schema', async () => {
    for (const type of ['tabel', '__proto__', 'constructor', '']) {
      const outcome = await texuliOps.invoke('block.schema', { type });
      expect(outcome.ok, type).toBe(false);
      if (!outcome.ok) expect(outcome.error.code).toBe('invalid-input');
    }
  });
});

it('names the expected shape in block-schema diagnostics, generated from the shapes', async () => {
  await scenario('a guessed table names the column and row shapes', async () => {
    const [columns] = await blockMessages('blocks-data', {
      type: 'table',
      columns: ['Feature', 'Free'],
      rows: [{ feature: 'Boards' }],
    });
    expect(columns).toMatch(/columns\.0/u);
    expect(columns).toContain('{ id: string, label: string }');
    expect(columns).toContain('block.schema with type "table"');
    const [rows] = await blockMessages('blocks-data', {
      type: 'table',
      columns: [{ id: 'feature', label: 'Feature' }],
      rows: [['Boards']],
    });
    expect(rows).toContain('{ [id]: string | number }');
  });
  await scenario(
    'a wrong leaf names its type; a missing field names the parent shape',
    async () => {
      const [value] = await blockMessages('blocks-data', {
        type: 'stat',
        items: [{ label: 'Active', value: 128 }],
      });
      expect(value).toMatch(/items\.0\.value.*Expected shape: string/u);
      const messages = await blockMessages('blocks-structure', {
        type: 'cta',
        actions: [{ label: 'Docs' }],
      });
      expect(messages).toEqual([
        expect.stringMatching(/actions\.0\.href: .*Expected shape: string\./u),
      ]);
    }
  );
  await scenario('valid blocks gain no text, and other checks keep their messages', async () => {
    expect(
      await blockMessages('blocks-data', {
        type: 'table',
        columns: [{ id: 'a', label: 'A' }],
        rows: [{ a: 1 }],
      })
    ).toEqual([]);
  });
});
