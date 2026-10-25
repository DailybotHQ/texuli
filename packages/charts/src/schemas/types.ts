/** JSON data accepted by chart prop schema defaults. */
export type ChartSchemaJson =
  | null
  | boolean
  | number
  | string
  | readonly ChartSchemaJson[]
  | { readonly [key: string]: ChartSchemaJson };

/** Stable inspector group used to order top-level chart props. */
export type ChartPropGroup =
  | 'accessibility'
  | 'data'
  | 'series'
  | 'axes'
  | 'bins'
  | 'layout'
  | 'appearance'
  | 'interaction'
  | 'localization';

export interface ChartStringSchema {
  readonly kind: 'string';
  readonly constraints?: {
    readonly nonEmpty?: boolean;
    readonly format?: 'date' | 'css-color';
  };
}

export interface ChartNumberSchema {
  readonly kind: 'number';
  readonly constraints?: {
    readonly finite?: boolean;
    readonly integer?: boolean;
    readonly minimum?: number;
    readonly maximum?: number;
    readonly exclusiveMinimum?: number;
  };
}

export interface ChartBooleanSchema {
  readonly kind: 'boolean';
}

export interface ChartEnumSchema {
  readonly kind: 'enum';
  readonly enumValues: readonly (string | number | boolean)[];
}

export interface ChartNullableSchema {
  readonly kind: 'nullable';
  readonly value: ChartValueSchema;
}

export interface ChartUnionSchema {
  readonly kind: 'union';
  readonly variants: readonly ChartValueSchema[];
}

export interface ChartArraySchema {
  readonly kind: 'array';
  readonly items: ChartValueSchema;
  readonly constraints?: {
    readonly minItems?: number;
    readonly maxItems?: number;
    readonly uniqueBy?: string;
  };
}

export interface ChartTupleSchema {
  readonly kind: 'tuple';
  readonly items: readonly ChartValueSchema[];
}

export type ChartObjectFieldSchema = {
  readonly name: string;
  readonly label: string;
  readonly description: string;
  readonly required: boolean;
  readonly default?: ChartSchemaJson;
} & ChartValueSchema;

export interface ChartObjectSchema {
  readonly kind: 'object';
  readonly properties: readonly ChartObjectFieldSchema[];
  readonly additionalProperties?: false | ChartValueSchema;
}

export interface ChartRecordSchema {
  readonly kind: 'record';
  readonly values: ChartValueSchema;
}

/** A named, JSON-safe recursive definition from {@link chartSchemaDefinitions}. */
export interface ChartReferenceSchema {
  readonly kind: 'reference';
  readonly ref: string;
}

/** Developer-only callback metadata. It is described, never serialized as a prop value. */
export interface ChartEventSchema {
  readonly kind: 'event';
  readonly signature: string;
}

/** Closed value vocabulary understood by the builder inspector. */
export type ChartValueSchema =
  | ChartStringSchema
  | ChartNumberSchema
  | ChartBooleanSchema
  | ChartEnumSchema
  | ChartNullableSchema
  | ChartUnionSchema
  | ChartArraySchema
  | ChartTupleSchema
  | ChartObjectSchema
  | ChartRecordSchema
  | ChartReferenceSchema
  | ChartEventSchema;

/** One public component prop and the JSON-safe editor contract for it. */
export type ChartPropSchema = {
  readonly name: string;
  readonly label: string;
  readonly description: string;
  readonly group: ChartPropGroup;
  readonly required: boolean;
  readonly default?: ChartSchemaJson;
  /** Developer-only props are visible to tooling but are not blueprint-editable. */
  readonly exposure?: 'blueprint' | 'developer';
} & ChartValueSchema;

export type ChartFamilyId =
  | 'cartesian'
  | 'part-whole'
  | 'matrix'
  | 'compact'
  | 'flow'
  | 'geo'
  | 'histogram'
  | 'pack'
  | 'calendar';

/** Introspectable props for one blueprint-rendered chart component. */
export interface ChartComponentPropSchema {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly component: string;
  readonly family: ChartFamilyId;
  readonly props: readonly ChartPropSchema[];
}

export type ChartSchemaDefinitions = Readonly<Record<string, ChartValueSchema>>;
