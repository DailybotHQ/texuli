/**
 * Sub-field schemas from the one source that has them: the chart prop
 * schemas. A catalog `charts-*` id maps to the chart schema of the same id.
 * Developer-only props (callbacks) are never offered.
 */
import {
  type ChartSchemaDefinitions,
  type ChartValueSchema,
  chartPropSchemas,
  chartSchemaDefinitions,
} from '@texuli/charts/schemas';

export interface StructSchema {
  schema: ChartValueSchema;
  defs: ChartSchemaDefinitions;
  /** Where the schema comes from, for the field's hint. */
  source: string;
}

export function chartStructSchema(id: string, name: string): StructSchema | undefined {
  if (!Object.hasOwn(chartPropSchemas, id)) return undefined;
  const component = chartPropSchemas[id as keyof typeof chartPropSchemas];
  const prop = component.props.find((candidate) => candidate.name === name);
  if (!prop || prop.exposure === 'developer' || prop.kind === 'event') return undefined;
  return {
    schema: prop,
    defs: chartSchemaDefinitions,
    source: `${component.component} chart schema`,
  };
}

export { chartPropSchemas, chartSchemaDefinitions };
