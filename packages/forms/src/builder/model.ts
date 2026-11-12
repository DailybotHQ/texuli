import {
  FORM_FIELD_TYPES,
  type FormField,
  type FormFieldType,
  type FormSchema,
} from '../model/types.ts';

export interface BuilderField extends FormField {
  readonly name: string;
  readonly label: string;
}

/** Read the editable, single-page field list from a schema. */
export function builderFields(schema: FormSchema): readonly BuilderField[] {
  if (schema.fields) return schema.fields;
  if (schema.sections) return schema.sections.flatMap((section) => section.fields);
  if (schema.steps)
    return schema.steps.flatMap((step) => [
      ...(step.fields ?? []),
      ...(step.sections ?? []).flatMap((section) => section.fields),
    ]);
  return [];
}

/** Create a safe, minimally valid field for a palette choice. */
export function createBuilderField(
  type: FormFieldType,
  fields: readonly FormField[]
): BuilderField | null {
  if (!(FORM_FIELD_TYPES as readonly string[]).includes(type) || fields.length >= 200) return null;
  const base = type.replace(/[^a-z0-9]+/g, '_');
  let name = base;
  for (let suffix = 2; fields.some((field) => field.name === name); suffix += 1)
    name = `${base}_${suffix}`;
  const field: Record<string, unknown> = {
    name,
    type,
    label: type[0]?.toUpperCase() + type.slice(1),
  };
  if (type === 'select' || type === 'multiselect' || type === 'radio') {
    field.options = [{ value: 'option_1', label: 'Option 1' }];
  }
  if (type === 'custom') field.kind = 'custom';
  return field as unknown as BuilderField;
}

/** Replace the top-level fields with the builder's edited order and values. */
export function withBuilderFields(schema: FormSchema, fields: readonly FormField[]): FormSchema {
  return {
    title: schema.title,
    ...(schema.description ? { description: schema.description } : {}),
    ...(schema.submitLabel ? { submitLabel: schema.submitLabel } : {}),
    ...(schema.rules ? { rules: schema.rules } : {}),
    fields,
  };
}

/** Move an item to a final index; invalid indices and ids leave the list intact. */
export function reorderBuilderFields<T extends { readonly name: string }>(
  fields: readonly T[],
  name: string,
  index: number
): readonly T[] {
  const from = fields.findIndex((field) => field.name === name);
  if (from < 0 || !Number.isInteger(index) || index < 0 || index >= fields.length || from === index)
    return fields;
  const next = [...fields];
  const [field] = next.splice(from, 1);
  next.splice(index, 0, field as T);
  return next;
}
