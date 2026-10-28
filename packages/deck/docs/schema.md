# Schema kit (`@texuli/deck/schema`)

The owned, dependency-free schema kit behind deck model v2 (ADR-009). Schemas
are plain frozen data: the combinators in `t` build a description of a
shape, `validate` walks it, `toJsonSchema` writes JSON Schema 2020-12 from the
same data, and `Infer<typeof S>` reads the TypeScript type. One definition
therefore gives all-issues validation, types and a schema document that
never drift apart. There is no third-party schema library.

> **Status:** in the repository as `@texuli/deck` `0.4.0`, not on npm.

```ts
import { type Infer, t, toJsonSchema, validate } from '@texuli/deck/schema';

const Person = t.object({
  name: t.string({ min: 1, max: 80, trim: true, text: 'line' }),
  role: t.optional(t.enum(['design', 'engineering'])),
  tags: t.array(t.string({ max: 24 }), { max: 8 }),
});
type Person = Infer<typeof Person>;
// { name: string; tags: string[]; role?: 'design' | 'engineering' }

const result = validate(Person, { name: '  Ada Example ', tags: [], colour: 'teal' });
// result.ok === false; result.issues[0].code === 'unknown-key' at $.colour

const schema = toJsonSchema(Person, { title: 'Person' });
```

## Combinators

`t` is one frozen object. Every builder takes an optional `description`
(`Described`), which is copied into the JSON Schema. Builders throw a
`TypeError` on a malformed schema (a developer error at module load);
validation itself never throws.

| Builder | Options | Notes |
| --- | --- | --- |
| `t.string(options?)` | `StringOptions`: `min`, `max` (code points, after trimming), `pattern` (an anchored source, compiled with `u`; no flags), `not` (refused values, code `reserved`), `trim`, `text` | `text: 'line'` refuses C0 and C1 controls (tab and newlines included), U+2028 and U+2029 and the bidi overrides and isolates; `text: 'multiline'` allows tab, LF and CR. |
| `t.number(options?)`, `t.int(options?)` | `NumberOptions`: `min`, `max`, `finite` (default `true`) | NaN is always refused. |
| `t.boolean()`, `t.null()` | | |
| `t.literal(value, options?)` | `CodeOptions`: `code` (reported instead of `enum`) | `formatVersion` uses `code: 'unsupported-version'`. |
| `t.enum(values, options?)` | `CodeOptions` | Values must be unique. |
| `t.array(item, options?)` | `SizeOptions`: `min`, `max` | Items past `max` are reported once (`too-many`) and not validated. |
| `t.object(shape, options?)` | `ObjectOptions`: `strict` (default `true`) | Strict objects report unknown keys; non-strict ones drop them. `__proto__`, `constructor` and `prototype` cannot be declared. |
| `t.record(value, options?)` | `RecordOptions`: `key` (a string schema), `min`, `max` | Prototype keys are always refused. |
| `t.union(options, settings?)` | `UnionOptions`: `discriminator`, `code` | With a discriminator, an unknown value is one issue (default `unknown-kind`) instead of one per option. |
| `t.nullable(inner)` | | |
| `t.optional(inner, options?)` | `OptionalOptions`: `default` | A default must validate; it is applied as a fresh copy and reported in `normalized`. |
| `t.lazy(get, options?)` | `LazyOptions`: `name` (the `$defs` name), `maxDepth` | Recursive schemas; annotate the type: `const Node: Schema<TreeNode> = t.object({ kids: t.array(t.lazy(() => Node)) })`. |
| `t.refine(inner, options)` | `RefineOptions`: `code` (kebab-case), `check(value, context)` | A named custom rule that runs only when the inner schema passed; raise issues with `context.issue` (`RefineContext`, `RefineIssue`). The `description` documents the rule in JSON Schema, which cannot express it. |
| `t.json(options?)` | `JsonOptions`: `depth`, `maxKeys`, `maxItems`, `maxString`, `maxKeyLength`, `text` | Bounded plain JSON, walked iteratively. `JSON_DEFAULTS`: depth 4, 100 keys, 200 items, 2,000-code-point strings, 64-character keys. |
| `t.describe(schema, text)` | | A copy with a description. |
| `t.extend(base, shape, options?)` | `ObjectOptions` | An object schema with more or replaced fields. |
| `t.pick(base, keys)`, `t.omit(base, keys)` | | Object schemas with a subset of fields. |

`objectOf(schema)` returns the object schema under any refinements (the field
schema of a discriminated union option). `UNSAFE_KEYS` lists the prototype
keys refused everywhere.

## Schema types

Every node extends `Schema<T>` (its `kind` is a `SchemaKind`) and the closed
union of node shapes is `SchemaNode`: `StringSchema`, `NumberSchema`,
`BooleanSchema`, `NullSchema`, `LiteralSchema` (of a `LiteralValue`),
`EnumSchema`, `ArraySchema`, `ObjectSchema` (over a `Shape`), `RecordSchema`,
`UnionSchema`, `NullableSchema`, `OptionalSchema`, `LazySchema`,
`RefineSchema` and `JsonValueSchema` (whose output is a `JsonValue`).
`Infer<S>` is the output type of a schema value and `InferShape<S>` the
output of an object shape (optional fields without a default become optional
keys). `TextMode` is `'line' | 'multiline'`.

## Validating

```ts
validate(schema, input, options?): ValidateResult<Infer<typeof schema>>
is(schema, input): input is Infer<typeof schema>
```

`validate` makes one walk over the input, collects every issue up to the cap,
and builds a fresh plain-data copy (trimmed strings, defaults applied). It
never throws and does bounded work on hostile input: own data properties
only (getters, throwing proxies and class instances are refused), prototype
keys refused, cycles detected, nesting capped, every visited value counted,
arrays and records validated only up to their `max`, and the walk stops at
the issue cap.

`ValidateOptions`:

| Option | Default |
| --- | --- |
| `maxIssues` | `MAX_DIAGNOSTICS` (200); past it the result is `truncated` |
| `maxDepth` | `DEFAULT_MAX_DEPTH` (64) nested arrays, objects, records and lazy entries along one path |
| `maxNodes` | `DEFAULT_MAX_NODES` (1,000,000) values visited before `too-large` |
| `path` | A prefix for every reported path, such as `['slides', 3, 'props']` |

`ValidateResult` is `{ ok: true, value, issues, normalized, truncated }`
(issues are warnings only) or `{ ok: false, issues, normalized, truncated }`.
Each `SchemaNormalization` records a `trim` or `default` change with its
`path`, `jsonPath` and `pointer`. `is` is the type-guard shorthand.

String lengths count Unicode code points everywhere (`codePointLength`), the
same as JSON Schema `minLength` and `maxLength`. `unsafeTextIndex(value, mode)`
returns the index of the first character a text mode refuses, or `-1`.

## Diagnostics

The one issue shape of the deck engine, shared by validation, the Markdown
dialect, lint and the loader:

```ts
interface DeckDiagnostic {
  code: string;
  severity: 'error' | 'warning';
  path: (string | number)[];
  jsonPath: string; // $.slides[2].props.title
  pointer: string; // /slides/2/props/title (RFC 6901)
  message: string;
  fix?: string;
  slideId?: string;
  source?: { line: number; column: number; endLine?: number; endColumn?: number };
  rule?: string; // lint only
}
```

Types: `DeckDiagnostic`, `DiagnosticSeverity`, `DiagnosticSource` (1-based
line and column, set by the Markdown dialect), `PathSegment` and
`DiagnosticExtra` (the optional fields `createDiagnostic` accepts).

- `createDiagnostic(code, message, path, extra?)` builds one with both
  derived path forms.
- `toJsonPath(path)` writes `$.slides[2].props.title` (odd keys use
  `['…']`); `toPointer(path)` writes an RFC 6901 pointer (`~` → `~0`, `/` →
  `~1`; the root is `''`).
- `formatDiagnostic(diagnostic)` gives one line for logs, CLIs and agent
  feedback: `error unknown-key at $.style.colour (3:5): Unknown key "colour". Fix: …`.
- `MAX_DIAGNOSTICS` (200) is the default cap.

The kit's own codes are `SCHEMA_CODES` (type `SchemaCode`): `invalid-type`,
`required`, `unknown-key`, `too-short`, `too-long`, `too-few`, `too-many`,
`out-of-range`, `not-integer`, `not-finite`, `pattern`, `reserved`, `enum`,
`unknown-kind`, `unsafe-text`, `unsafe-key`, `too-deep`, `cycle`, `too-large`
and `invalid-input`. The model adds its own; the full table is in
[model](model.md#diagnostics).

## JSON Schema export

```ts
toJsonSchema(schema, options?): JsonSchema
```

Writes a JSON Schema 2020-12 document (`JSON_SCHEMA_DIALECT` is its
`$schema`) from the same schema data `validate` walks. `JsonSchemaOptions`
takes an `$id`, a `title` and a `description`. Lazy schemas with a `name`
become `$defs` entries, bounded JSON unrolls into one definition per
remaining depth, and refinements and trimming, which JSON Schema cannot
express, are documented in `description`. `JsonSchema` is the plain object
type of the result. The deck's own document is `deckJsonSchema()` in
[model](model.md#validating-parsedeck).
