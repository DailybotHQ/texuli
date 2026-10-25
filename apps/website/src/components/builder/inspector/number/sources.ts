/**
 * Number hints from the one schema that documents ranges today: the chart
 * prop schemas. A catalog `charts-*` id maps to the chart schema of the
 * same id; other ids have no hints. Imports only `@texuli/charts/schemas`.
 */
import { chartPropSchemas } from '@texuli/charts/schemas';
import type { NumberBounds, NumberHints } from './model.ts';

/** The raw chart prop schemas, re-exported for hosts and tests. */
export { chartPropSchemas };

type NumberConstraints = {
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  integer?: boolean;
};

export function chartNumberHints(id: string, name: string): NumberHints | undefined {
  if (!Object.hasOwn(chartPropSchemas, id)) return undefined;
  const schema = chartPropSchemas[id as keyof typeof chartPropSchemas];
  const prop = schema.props.find((candidate) => candidate.name === name);
  if (prop?.kind !== 'number') return undefined;
  const constraints = (prop.constraints ?? {}) as NumberConstraints;
  const bounds: NumberBounds = {};
  if (constraints.exclusiveMinimum !== undefined) {
    bounds.min = constraints.exclusiveMinimum;
    bounds.exclusive = true;
  } else if (constraints.minimum !== undefined) {
    bounds.min = constraints.minimum;
  }
  if (constraints.maximum !== undefined) bounds.max = constraints.maximum;
  if (constraints.integer) bounds.integer = true;
  return {
    ...(Object.keys(bounds).length ? { bounds } : {}),
    ...(typeof prop.default === 'number' ? { default: prop.default } : {}),
    source: `${schema.component} chart schema`,
  };
}
