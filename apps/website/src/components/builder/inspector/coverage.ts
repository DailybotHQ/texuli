/**
 * Inspector coverage: props the inspector deliberately does not offer, each
 * with its reason, so a missing field is never a silent hole. Today that is
 * one case: a chart prop the catalog types as text while the chart schema
 * expects another kind (a boolean, a range, a list or a number). The
 * renderer accepts only text for it, and text is not what the chart reads,
 * so no value a blueprint can carry works; a field would only produce
 * refusals or ignored values. `fieldFamily` is the inspector's one
 * prop → editor rule, so tests audit exactly what the page renders.
 */
import type { CatalogPropSchema } from '@texuli/catalog';
import { chartPropSchemas } from '@texuli/charts/schemas';
import { isChoiceProp } from './choice/model.ts';
import { isAltProp, urlRoleOf } from './media/model.ts';
import { isNumberProp } from './number/model.ts';
import { isStringProp } from './string/model.ts';
import { chartStructSchema } from './struct/sources.ts';

/** The cartesian chart dispatches to these families, whose schemas agree on the shared props. */
const SCHEMA_STAND_IN: Readonly<Record<string, string>> = Object.freeze({
  'charts-cartesian': 'charts-line',
});

const KIND_NAMES: Readonly<Record<string, string>> = Object.freeze({
  boolean: 'a true or false value',
  tuple: 'a two-value range',
  array: 'a list',
  number: 'a number',
  object: 'an object',
  record: 'an object',
});

/** Why the inspector does not offer `prop` on `id`, or `undefined` when it does. */
export function unsupportedReason(id: string, prop: CatalogPropSchema): string | undefined {
  if (prop.kind !== 'string') return undefined;
  const schemaId = SCHEMA_STAND_IN[id] ?? id;
  if (!Object.hasOwn(chartPropSchemas, schemaId)) return undefined;
  const component = chartPropSchemas[schemaId as keyof typeof chartPropSchemas];
  const schema = component.props.find((candidate) => candidate.name === prop.name);
  // Text, enum, nullable and union schemas can take a string: only the others never can.
  const expected = schema ? KIND_NAMES[schema.kind] : undefined;
  if (!expected) return undefined;
  return `The catalog accepts only text here, but the ${component.component} chart reads ${expected}, so no blueprint value works yet.`;
}

/** The editor a prop gets in the inspector (the order BuilderApp picks them in). */
export type FieldFamily =
  | 'text-block'
  | 'media-block'
  | 'url'
  | 'alt'
  | 'choice'
  | 'number'
  | 'struct'
  | 'string'
  | 'json'
  | 'unsupported';

/**
 * Which editor `prop` on `id` gets. Every prop the inspector offers lands on
 * a working field; one it cannot offer is `unsupported`, with a reason.
 */
export function fieldFamily(id: string, prop: CatalogPropSchema): FieldFamily {
  if (unsupportedReason(id, prop)) return 'unsupported';
  if (id === 'blocks-text' && prop.name === 'block') return 'text-block';
  if (id === 'blocks-media' && prop.name === 'block') return 'media-block';
  if (urlRoleOf(id, prop.name)) return 'url';
  if (isAltProp(id, prop.name)) return 'alt';
  if (isChoiceProp(prop)) return 'choice';
  if (isNumberProp(prop)) return 'number';
  if ((prop.kind === 'object' || prop.kind === 'array') && chartStructSchema(id, prop.name)) {
    return 'struct';
  }
  if (isStringProp(prop)) return 'string';
  return 'json';
}
