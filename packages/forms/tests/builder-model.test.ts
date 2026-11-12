import { describe, expect, it } from 'vitest';
import {
  builderFields,
  createBuilderField,
  reorderBuilderFields,
  sortableDropIndex,
  withBuilderFields,
} from '../src/builder/model.ts';
import type { FormField, FormSchema } from '../src/model/types.ts';

const fields: FormField[] = [
  { name: 'first', type: 'text', label: 'First' },
  { name: 'second', type: 'select', label: 'Second', options: [{ value: 'one', label: 'One' }] },
];

describe('form builder model', () => {
  it('reads fields from flat, section and step layouts', () => {
    expect(builderFields({ title: 'Flat', fields })).toEqual(fields);
    expect(builderFields({ title: 'Section', sections: [{ id: 's', fields }] })).toEqual(fields);
    expect(
      builderFields({
        title: 'Steps',
        steps: [{ id: 's', title: 'Step', sections: [{ id: 'g', fields }] }],
      })
    ).toEqual(fields);
  });

  it('creates unique fields and initializes choice options', () => {
    expect(createBuilderField('text', fields)?.name).toBe('text');
    expect(createBuilderField('select', fields)).toMatchObject({
      name: 'select',
      options: [{ value: 'option_1', label: 'Option 1' }],
    });
    expect(
      createBuilderField(
        'text',
        Array.from({ length: 200 }, (_, index) => ({
          name: `field_${index}`,
          type: 'text' as const,
          label: 'Field',
        }))
      )
    ).toBeNull();
  });

  it('reorders to a final index and preserves input on invalid moves', () => {
    expect(reorderBuilderFields(fields, 'second', 0).map((field) => field.name)).toEqual([
      'second',
      'first',
    ]);
    expect(reorderBuilderFields(fields, 'missing', 0)).toBe(fields);
    expect(reorderBuilderFields(fields, 'first', 5)).toBe(fields);
  });

  it('converts pointer insertion slots to final drop indices around the source item', () => {
    expect(sortableDropIndex(0, 2, false, 3)).toBe(1);
    expect(sortableDropIndex(0, 2, true, 3)).toBe(2);
    expect(sortableDropIndex(2, 0, false, 3)).toBe(0);
    expect(sortableDropIndex(2, 0, true, 3)).toBe(1);
    expect(sortableDropIndex(1, 1, true, 3)).toBe(1);
    expect(sortableDropIndex(0, null, false, 3)).toBe(2);
  });

  it('normalizes an edited layout to the validator supported flat schema', () => {
    const original: FormSchema = {
      title: 'Form',
      sections: [{ id: 'group', fields }],
      rules: [
        { id: 'confirmed', test: { op: 'bool', value: true }, message: 'Confirm the details.' },
      ],
    };
    expect(withBuilderFields(original, fields)).toEqual({
      title: 'Form',
      rules: original.rules,
      fields,
    });
  });
});
