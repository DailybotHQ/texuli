/**
 * Framework-free model for structured (object and array) inspector fields.
 *
 * The catalog renderer checks only that an object prop is a plain object and
 * an array prop an array; it has no item schemas (gap G16). The one schema
 * that describes sub-fields today is the chart prop schemas
 * (`@texuli/charts/schemas`). This module validates a value against such a
 * schema and edits it immutably. Its verdicts are the schema's, not the
 * renderer's: the chart may still refuse to draw a value that breaks them.
 * The top-level container check is the renderer's own (`sanitizeProps`).
 * Imports only `@texuli/catalog` and chart schema types, so it can move into
 * a future `@texuli/builder`.
 */
import type { CatalogPropSchema } from '@texuli/catalog';
import { sanitizeProps } from '@texuli/catalog/render/renderer';
import type {
  ChartObjectFieldSchema,
  ChartSchemaDefinitions,
  ChartValueSchema,
} from '@texuli/charts/schemas';

export type Path = readonly (string | number)[];

export interface StructIssue {
  path: Path;
  message: string;
}

/** Deepest nesting the editor walks (recursive trees). */
export const MAX_DEPTH = 12;

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function resolve(schema: ChartValueSchema, defs: ChartSchemaDefinitions): ChartValueSchema {
  return schema.kind === 'reference' ? (defs[schema.ref] ?? schema) : schema;
}

export function kindLabel(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'a list';
  if (typeof value === 'object') return 'an object';
  return `a ${typeof value}`;
}

/** Every rule the schema states, applied to `value`. Issues carry the sub-field path. */
export function validate(
  schema: ChartValueSchema,
  value: unknown,
  defs: ChartSchemaDefinitions,
  path: Path = [],
  depth = 0
): StructIssue[] {
  const issue = (message: string): StructIssue[] => [{ path, message }];
  if (depth > MAX_DEPTH) return issue(`Nested more than ${MAX_DEPTH} levels deep.`);
  const node = resolve(schema, defs);
  switch (node.kind) {
    case 'reference':
      return issue(`Unknown schema reference "${node.ref}".`);
    case 'event':
      return value === undefined ? [] : issue('Set in code only; a blueprint cannot supply it.');
    case 'string': {
      if (typeof value !== 'string') return issue(`Expected text, got ${kindLabel(value)}.`);
      const c = node.constraints;
      if (c?.nonEmpty && value.trim() === '') return issue('Must not be empty.');
      if (c?.format === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return issue('Expected a date as YYYY-MM-DD.');
      }
      return [];
    }
    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return issue(`Expected a finite number, got ${kindLabel(value)}.`);
      }
      const c = node.constraints;
      if (c?.integer && !Number.isInteger(value)) return issue('Expected a whole number.');
      if (c?.minimum !== undefined && value < c.minimum)
        return issue(`Must be at least ${c.minimum}.`);
      if (c?.exclusiveMinimum !== undefined && value <= c.exclusiveMinimum) {
        return issue(`Must be greater than ${c.exclusiveMinimum}.`);
      }
      if (c?.maximum !== undefined && value > c.maximum)
        return issue(`Must be at most ${c.maximum}.`);
      return [];
    }
    case 'boolean':
      return typeof value === 'boolean'
        ? []
        : issue(`Expected on or off, got ${kindLabel(value)}.`);
    case 'enum':
      return node.enumValues.includes(value as string | number | boolean)
        ? []
        : issue(`Must be one of: ${node.enumValues.join(', ')}.`);
    case 'nullable':
      return value === null ? [] : validate(node.value, value, defs, path, depth + 1);
    case 'union': {
      const index = matchVariant(node.variants, value, defs);
      if (index === -1) return issue('Does not match any allowed shape.');
      return validate(node.variants[index] as ChartValueSchema, value, defs, path, depth + 1);
    }
    case 'array': {
      if (!Array.isArray(value)) return issue(`Expected a list, got ${kindLabel(value)}.`);
      const issues: StructIssue[] = [];
      const c = node.constraints;
      if (c?.minItems !== undefined && value.length < c.minItems) {
        issues.push({ path, message: `Needs at least ${c.minItems} items.` });
      }
      if (c?.maxItems !== undefined && value.length > c.maxItems) {
        issues.push({ path, message: `At most ${c.maxItems} items.` });
      }
      const seen = new Map<unknown, number>();
      value.forEach((item, index) => {
        issues.push(...validate(node.items, item, defs, [...path, index], depth + 1));
        if (c?.uniqueBy && isPlainObject(item) && item[c.uniqueBy] !== undefined) {
          const key = item[c.uniqueBy];
          const first = seen.get(key);
          if (first !== undefined) {
            issues.push({
              path: [...path, index, c.uniqueBy],
              message: `Duplicate ${c.uniqueBy} (also item ${first + 1}).`,
            });
          } else seen.set(key, index);
        }
      });
      return issues;
    }
    case 'tuple': {
      if (!Array.isArray(value) || value.length !== node.items.length) {
        return issue(`Expected exactly ${node.items.length} values.`);
      }
      return node.items.flatMap((item, index) =>
        validate(item, value[index], defs, [...path, index], depth + 1)
      );
    }
    case 'object': {
      if (!isPlainObject(value)) return issue(`Expected an object, got ${kindLabel(value)}.`);
      const issues: StructIssue[] = [];
      const known = new Set(node.properties.map((field) => field.name));
      for (const field of node.properties) {
        const present = Object.hasOwn(value, field.name) && value[field.name] !== undefined;
        if (!present) {
          if (field.required) issues.push({ path: [...path, field.name], message: 'Required.' });
          continue;
        }
        issues.push(...validate(field, value[field.name], defs, [...path, field.name], depth + 1));
      }
      for (const key of Object.keys(value)) {
        if (known.has(key)) continue;
        if (node.additionalProperties) {
          issues.push(
            ...validate(node.additionalProperties, value[key], defs, [...path, key], depth + 1)
          );
        } else {
          issues.push({
            path: [...path, key],
            message: `Unknown key "${key}" is not in the schema.`,
          });
        }
      }
      return issues;
    }
    case 'record': {
      if (!isPlainObject(value)) return issue(`Expected an object, got ${kindLabel(value)}.`);
      return Object.entries(value).flatMap(([key, item]) =>
        validate(node.values, item, defs, [...path, key], depth + 1)
      );
    }
  }
}

/** Single-value enum fields name a union variant ("number", "line · y"). */
export function variantLabel(schema: ChartValueSchema, index: number): string {
  if (schema.kind === 'object') {
    const tags = schema.properties
      .filter((field) => field.kind === 'enum' && field.enumValues.length === 1)
      .map((field) => String((field as { enumValues: readonly unknown[] }).enumValues[0]));
    if (tags.length) return tags.join(' · ');
  }
  return `Option ${index + 1}`;
}

/** The variant a value belongs to: by its single-value tags, else the first it fully meets; -1 if none. */
export function matchVariant(
  variants: readonly ChartValueSchema[],
  value: unknown,
  defs: ChartSchemaDefinitions
): number {
  if (isPlainObject(value)) {
    const tagged = variants.findIndex(
      (variant) =>
        variant.kind === 'object' &&
        variant.properties.some(
          (field) => field.kind === 'enum' && field.enumValues.length === 1
        ) &&
        variant.properties.every(
          (field) =>
            field.kind !== 'enum' ||
            field.enumValues.length !== 1 ||
            value[field.name] === field.enumValues[0]
        )
    );
    if (tagged !== -1) return tagged;
  }
  return variants.findIndex((variant) => validate(variant, value, defs).length === 0);
}

/** A value that meets the schema, built from its rules: what "Add item" inserts. */
export function sampleValue(
  schema: ChartValueSchema,
  defs: ChartSchemaDefinitions,
  depth = 0
): unknown {
  const node = resolve(schema, defs);
  switch (node.kind) {
    case 'string': {
      if (node.constraints?.format === 'date') return '2026-01-15';
      if (node.constraints?.format === 'css-color') return 'var(--tx-chart-1)';
      return node.constraints?.nonEmpty ? 'Sample' : '';
    }
    case 'number': {
      const c = node.constraints;
      let value = c?.minimum ?? (c?.exclusiveMinimum !== undefined ? c.exclusiveMinimum + 1 : 0);
      if (c?.maximum !== undefined && value > c.maximum) value = c.maximum;
      return c?.integer ? Math.ceil(value) : value;
    }
    case 'boolean':
      return false;
    case 'enum':
      return node.enumValues[0];
    case 'nullable':
      return null;
    case 'union':
      return sampleValue(node.variants[0] as ChartValueSchema, defs, depth + 1);
    case 'array':
      return Array.from({ length: node.constraints?.minItems ?? 0 }, (_, index) =>
        withUniqueKey(sampleValue(node.items, defs, depth + 1), node.constraints?.uniqueBy, index)
      );
    case 'tuple':
      return node.items.map((item) => sampleValue(item, defs, depth + 1));
    case 'object': {
      const out: Record<string, unknown> = {};
      for (const field of node.properties) {
        if (field.required) out[field.name] = sampleValue(field, defs, depth + 1);
      }
      return out;
    }
    case 'record':
      return {};
    case 'reference':
    case 'event':
      return undefined;
  }
}

/** Give a new list item a unique key (`item-2`) when the list requires unique values. */
export function withUniqueKey(item: unknown, uniqueBy: string | undefined, index: number): unknown {
  if (!uniqueBy || !isPlainObject(item) || typeof item[uniqueBy] !== 'string') return item;
  return { ...item, [uniqueBy]: `item-${index + 1}` };
}

/** The next free `item-N` key for a list with `uniqueBy`. */
export function nextUniqueItem(
  list: readonly unknown[],
  item: unknown,
  uniqueBy: string | undefined
): unknown {
  if (!uniqueBy) return item;
  const taken = new Set(list.map((entry) => (isPlainObject(entry) ? entry[uniqueBy] : undefined)));
  let index = list.length;
  let candidate = withUniqueKey(item, uniqueBy, index);
  while (isPlainObject(candidate) && taken.has(candidate[uniqueBy])) {
    index += 1;
    candidate = withUniqueKey(item, uniqueBy, index);
  }
  return candidate;
}

/** Fields of an object schema, for the editor. */
export function objectFields(schema: ChartValueSchema): readonly ChartObjectFieldSchema[] {
  return schema.kind === 'object' ? schema.properties : [];
}

/** Keys present on a value that the object schema does not declare. */
export function unknownKeys(schema: ChartValueSchema, value: unknown): string[] {
  if (schema.kind !== 'object' || schema.additionalProperties || !isPlainObject(value)) return [];
  const known = new Set(schema.properties.map((field) => field.name));
  return Object.keys(value).filter((key) => !known.has(key));
}

/** Set or (with `undefined`) remove one key, returning a new object. */
export function withKey(value: unknown, key: string, next: unknown): Record<string, unknown> {
  const base = isPlainObject(value) ? value : {};
  if (next === undefined) {
    const { [key]: _removed, ...rest } = base;
    return rest;
  }
  return { ...base, [key]: next };
}

export type ListEdit =
  | { action: 'set'; index: number; value: unknown }
  | { action: 'add'; value: unknown }
  | { action: 'remove'; index: number }
  | { action: 'move'; index: number; step: 1 | -1 };

/** Immutable list edits; out-of-range edits return the list unchanged. */
export function editList(list: unknown, edit: ListEdit): unknown[] {
  const items = Array.isArray(list) ? [...list] : [];
  if (edit.action === 'add') return [...items, edit.value];
  if (edit.index < 0 || edit.index >= items.length) return items;
  if (edit.action === 'set') items[edit.index] = edit.value;
  else if (edit.action === 'remove') items.splice(edit.index, 1);
  else {
    const to = edit.index + edit.step;
    if (to < 0 || to >= items.length) return items;
    const [moved] = items.splice(edit.index, 1);
    items.splice(to, 0, moved);
  }
  return items;
}

/** Issues at exactly this path (shown next to the field they belong to). */
export function issuesAt(issues: readonly StructIssue[], path: Path): StructIssue[] {
  return issues.filter(
    (issue) =>
      issue.path.length === path.length &&
      issue.path.every((segment, index) => segment === path[index])
  );
}

export type ContainerReading =
  | { state: 'unset' }
  | { state: 'set' }
  | { state: 'invalid'; message: string };

/** The renderer's verdict on the whole prop: present, absent, or refused (wrong container, HTML). */
export function readContainer(prop: CatalogPropSchema, value: unknown): ContainerReading {
  if (value === undefined) return { state: 'unset' };
  const result = sanitizeProps({ [prop.name]: value }, [prop], '', 'inspector');
  if (result.props && Object.hasOwn(result.props, prop.name)) return { state: 'set' };
  const reason = result.diagnostics.find((diagnostic) => diagnostic.message)?.message;
  return { state: 'invalid', message: reason ?? `Prop "${prop.name}" was refused.` };
}

const RAW_LIMIT = 60;

/** A value as short plain text (never markup): JSON, truncated. */
export function showRaw(raw: unknown): string {
  let text: string;
  try {
    text = JSON.stringify(raw) ?? String(raw);
  } catch {
    text = String(raw);
  }
  const chars = [...text];
  return chars.length > RAW_LIMIT ? `${chars.slice(0, RAW_LIMIT).join('')}…` : text;
}
