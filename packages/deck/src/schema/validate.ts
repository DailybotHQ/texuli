/**
 * The validator: one walk over the input, driven by the schema data, that
 * collects every issue (up to the cap) and builds a fresh plain-data copy.
 *
 * It never throws and does bounded work on hostile input: own data
 * properties only (getters, throwing proxies and class instances are
 * refused), prototype keys refused, cycles detected, nesting capped by
 * `maxDepth`, every visited value counted against `maxNodes`, arrays and
 * records validated only up to their `max`, and the walk stops once the issue
 * cap is reached (`truncated`). Recursion depth is bounded by the schema tree
 * plus `maxDepth`; `t.json` values are walked iteratively.
 */
import {
  SCHEMA_CODES as C,
  createDiagnostic,
  type DeckDiagnostic,
  type DiagnosticSeverity,
  MAX_DIAGNOSTICS,
  type PathSegment,
  toJsonPath,
  toPointer,
} from './diagnostics.ts';
import {
  acceptedTypes,
  codePointLength,
  compilePattern,
  describeChar,
  discriminatorIndex,
  exceedsCodePoints,
  isUnsafeKey,
  type JsonType,
  typeName,
  unsafeTextIndex,
  unwrapObject,
} from './internal.ts';
import type {
  ArraySchema,
  EnumSchema,
  Infer,
  JsonValueSchema,
  LazySchema,
  LiteralSchema,
  NumberSchema,
  ObjectSchema,
  RecordSchema,
  RefineSchema,
  Schema,
  SchemaNode,
  StringSchema,
  UnionSchema,
} from './types.ts';

export interface ValidateOptions {
  /** Diagnostics kept before the walk stops with `truncated: true` (default 200). */
  maxIssues?: number;
  /** Nested arrays, objects, records and lazy entries along one path (default 64). */
  maxDepth?: number;
  /** Values visited before the walk stops with `too-large` (default 1,000,000). */
  maxNodes?: number;
  /** A prefix for every reported path, e.g. `['slides', 3, 'props']`. */
  path?: readonly PathSegment[];
}

/** A change the validator made to the input on the way to `value`. */
export interface SchemaNormalization {
  kind: 'trim' | 'default';
  path: PathSegment[];
  jsonPath: string;
  pointer: string;
}

export type ValidateResult<T> =
  | {
      ok: true;
      value: T;
      /** Warnings only (refinements may raise them). */
      issues: DeckDiagnostic[];
      normalized: SchemaNormalization[];
      truncated: boolean;
    }
  | {
      ok: false;
      value?: undefined;
      issues: DeckDiagnostic[];
      normalized: SchemaNormalization[];
      truncated: boolean;
    };

export const DEFAULT_MAX_DEPTH = 64;
export const DEFAULT_MAX_NODES = 1_000_000;

interface Budget {
  nodes: number;
  readonly maxNodes: number;
}

interface Context {
  issues: DeckDiagnostic[];
  normalized: SchemaNormalization[];
  errors: number;
  truncated: boolean;
  aborted: boolean;
  depth: number;
  readonly path: PathSegment[];
  readonly ancestors: object[];
  readonly lazyDepth: Map<LazySchema, number>;
  readonly budget: Budget;
  readonly maxIssues: number;
  readonly maxDepth: number;
}

/** Validate `input` against `schema`: every issue, a fresh value, never a throw. */
export function validate<S extends Schema>(
  schema: S,
  input: unknown,
  options: ValidateOptions = {}
): ValidateResult<Infer<S>> {
  const ctx: Context = {
    issues: [],
    normalized: [],
    errors: 0,
    truncated: false,
    aborted: false,
    depth: 0,
    path: [...(options.path ?? [])],
    ancestors: [],
    lazyDepth: new Map(),
    budget: { nodes: 0, maxNodes: positive(options.maxNodes, DEFAULT_MAX_NODES) },
    maxIssues: positive(options.maxIssues, MAX_DIAGNOSTICS),
    maxDepth: positive(options.maxDepth, DEFAULT_MAX_DEPTH),
  };
  let value: unknown;
  try {
    value = visit(schema as Schema as SchemaNode, input, ctx);
  } catch {
    // Last resort (an exotic input or a broken custom schema): report, never throw.
    ctx.aborted = false;
    report(ctx, C.invalidInput, 'Validation stopped: the input could not be read as plain data.');
  }
  const { issues, normalized, truncated } = ctx;
  if (ctx.errors === 0)
    return { ok: true, value: value as Infer<S>, issues, normalized, truncated };
  return { ok: false, issues, normalized, truncated };
}

/** True when `input` validates without errors (a type guard). */
export function is<S extends Schema>(schema: S, input: unknown): input is Infer<S> {
  return validate(schema, input).ok;
}

function positive(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function report(
  ctx: Context,
  code: string,
  message: string,
  extra: { fix?: string; severity?: DiagnosticSeverity; path?: readonly PathSegment[] } = {}
): void {
  const severity = extra.severity ?? 'error';
  if (severity === 'error') ctx.errors++;
  if (ctx.aborted) return;
  if (ctx.issues.length >= ctx.maxIssues) {
    ctx.truncated = true;
    ctx.aborted = true;
    return;
  }
  const diagnostic: { severity: DiagnosticSeverity; fix?: string } = { severity };
  if (extra.fix !== undefined) diagnostic.fix = extra.fix;
  ctx.issues.push(createDiagnostic(code, message, extra.path ?? ctx.path, diagnostic));
}

function normalize(ctx: Context, kind: SchemaNormalization['kind']): void {
  if (ctx.normalized.length >= ctx.maxIssues) return;
  ctx.normalized.push({
    kind,
    path: [...ctx.path],
    jsonPath: toJsonPath(ctx.path),
    pointer: toPointer(ctx.path),
  });
}

function typeError(ctx: Context, expected: string, value: unknown): undefined {
  report(ctx, C.invalidType, `Expected ${expected}, received ${article(typeName(value))}.`);
  return undefined;
}

function article(name: string): string {
  if (name === 'null' || name === 'undefined') return name;
  return /^[aeiou]/.test(name) ? `an ${name}` : `a ${name}`;
}

function list(values: readonly unknown[], limit = 24): string {
  const shown = values.slice(0, limit).map((value) => JSON.stringify(value));
  return values.length > limit ? `${shown.join(', ')}, …` : shown.join(', ');
}

const MISSING = Symbol('missing');
const REFUSED = Symbol('refused');

/** An own data property, `MISSING`, or `REFUSED` (an accessor or a throwing read, reported). */
function readOwn(ctx: Context, target: object, key: PathSegment): unknown {
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(target, key);
  } catch {
    report(ctx, C.invalidInput, 'The property could not be read.');
    return REFUSED;
  }
  if (descriptor === undefined) return MISSING;
  if (!('value' in descriptor)) {
    report(ctx, C.invalidInput, 'Accessor properties are not data; use a plain value.');
    return REFUSED;
  }
  return descriptor.value;
}

/** `null`-prototype or an `Object.prototype` from any realm; never arrays or class instances. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  try {
    if (Array.isArray(value)) return false;
    const proto = Object.getPrototypeOf(value);
    return proto === null || Object.getPrototypeOf(proto) === null;
  } catch {
    return false;
  }
}

/** Shared entry for containers: cycle and depth checks. Returns false when refused. */
function enter(ctx: Context, value: object): boolean {
  if (ctx.ancestors.includes(value)) {
    report(ctx, C.cycle, 'The value contains itself (a cyclic reference).');
    return false;
  }
  if (ctx.depth >= ctx.maxDepth) {
    report(ctx, C.tooDeep, `Nesting is deeper than ${ctx.maxDepth} levels.`);
    return false;
  }
  ctx.ancestors.push(value);
  ctx.depth++;
  return true;
}

function leave(ctx: Context): void {
  ctx.ancestors.pop();
  ctx.depth--;
}

function visit(node: SchemaNode, value: unknown, ctx: Context): unknown {
  if (ctx.aborted) return undefined;
  if (++ctx.budget.nodes > ctx.budget.maxNodes) {
    report(ctx, C.tooLarge, `The input has more than ${ctx.budget.maxNodes} values.`);
    ctx.aborted = true;
    return undefined;
  }
  switch (node.kind) {
    case 'string':
      return visitString(node, value, ctx);
    case 'number':
      return visitNumber(node, value, ctx);
    case 'boolean':
      return typeof value === 'boolean' ? value : typeError(ctx, 'a boolean', value);
    case 'null':
      return value === null ? null : typeError(ctx, 'null', value);
    case 'literal':
      return visitLiteral(node, value, ctx);
    case 'enum':
      return visitEnum(node, value, ctx);
    case 'array':
      return visitArray(node, value, ctx);
    case 'object':
      return visitObject(node, value, ctx);
    case 'record':
      return visitRecord(node, value, ctx);
    case 'union':
      return node.discriminator === undefined
        ? visitUnion(node, value, ctx)
        : visitDiscriminated(node, value, ctx);
    case 'nullable':
      return value === null ? null : visit(node.inner as SchemaNode, value, ctx);
    case 'optional':
      if (value !== undefined) return visit(node.inner as SchemaNode, value, ctx);
      if (!node.hasDefault) return undefined;
      normalize(ctx, 'default');
      return copyDefault(node.default);
    case 'lazy':
      return visitLazy(node, value, ctx);
    case 'refine':
      return visitRefine(node, value, ctx);
    case 'json':
      return visitJson(node, value, ctx);
    default:
      report(ctx, C.invalidInput, 'Unknown schema node.');
      return undefined;
  }
}

function visitString(node: StringSchema, value: unknown, ctx: Context): unknown {
  if (typeof value !== 'string') return typeError(ctx, 'a string', value);
  let text = value;
  if (node.trim) {
    const trimmed = text.trim();
    if (trimmed !== text) {
      normalize(ctx, 'trim');
      text = trimmed;
    }
  }
  if (node.max !== undefined && exceedsCodePoints(text, node.max)) {
    // Too long: report and skip the scans (bounded work on huge strings).
    report(ctx, C.tooLong, `Use at most ${node.max} characters.`, {
      fix: `Shorten the text to ${node.max} characters or fewer.`,
    });
    return text;
  }
  if (node.min !== undefined && text.length < node.min * 2 && codePointLength(text) < node.min) {
    report(
      ctx,
      C.tooShort,
      node.min === 1 ? 'Must not be empty.' : `Use at least ${node.min} characters.`
    );
  }
  if (node.text !== undefined) {
    const index = unsafeTextIndex(text, node.text);
    if (index >= 0) {
      report(
        ctx,
        C.unsafeText,
        `Character ${describeChar(text, index)} at index ${index} is not allowed here.`,
        { fix: 'Remove control, line-break or bidi-override characters.' }
      );
    }
  }
  if (node.pattern !== undefined && !compilePattern(node.pattern).test(text)) {
    report(ctx, C.pattern, `Does not match the pattern ${node.pattern}.`);
  }
  if (node.not?.includes(text)) {
    report(ctx, C.reserved, `${JSON.stringify(text)} is reserved here.`);
  }
  return text;
}

function visitNumber(node: NumberSchema, value: unknown, ctx: Context): unknown {
  if (typeof value !== 'number') return typeError(ctx, 'a number', value);
  if (Number.isNaN(value) || (node.finite && !Number.isFinite(value))) {
    report(ctx, C.notFinite, 'Must be a finite number.');
    return value;
  }
  if (node.int && !Number.isInteger(value)) report(ctx, C.notInteger, 'Must be an integer.');
  if (
    (node.min !== undefined && value < node.min) ||
    (node.max !== undefined && value > node.max)
  ) {
    const range =
      node.min !== undefined && node.max !== undefined
        ? `between ${node.min} and ${node.max}`
        : node.min !== undefined
          ? `at least ${node.min}`
          : `at most ${node.max}`;
    report(ctx, C.outOfRange, `Must be ${range}.`);
  }
  return value;
}

function visitLiteral(node: LiteralSchema, value: unknown, ctx: Context): unknown {
  if (value === node.value) return value;
  report(ctx, node.code ?? C.enum, `Expected ${JSON.stringify(node.value)}.`, {
    fix: `Use ${JSON.stringify(node.value)}.`,
  });
  return undefined;
}

function visitEnum(node: EnumSchema, value: unknown, ctx: Context): unknown {
  if (typeof value === 'string' && node.values.includes(value)) return value;
  report(
    ctx,
    node.code ?? C.enum,
    typeof value === 'string'
      ? `Unknown value ${JSON.stringify(value)}.`
      : `Expected one of the listed strings, received ${article(typeName(value))}.`,
    { fix: `Use one of: ${list(node.values)}.` }
  );
  return undefined;
}

function visitArray(node: ArraySchema, value: unknown, ctx: Context): unknown {
  let length: number;
  try {
    if (!Array.isArray(value)) return typeError(ctx, 'an array', value);
    length = value.length;
  } catch {
    report(ctx, C.invalidInput, 'The array could not be read.');
    return undefined;
  }
  if (node.min !== undefined && length < node.min) {
    report(ctx, C.tooFew, `Use at least ${node.min} item${node.min === 1 ? '' : 's'}.`);
  }
  let limit = length;
  if (node.max !== undefined && length > node.max) {
    report(
      ctx,
      C.tooMany,
      `Use at most ${node.max} item${node.max === 1 ? '' : 's'} (got ${length}).`
    );
    limit = node.max;
  }
  if (!enter(ctx, value)) return undefined;
  const out: unknown[] = [];
  const item = node.item as SchemaNode;
  for (let i = 0; i < limit && !ctx.aborted; i++) {
    ctx.path.push(i);
    const raw = readOwn(ctx, value, i);
    if (raw !== REFUSED) out.push(visit(item, raw === MISSING ? undefined : raw, ctx));
    ctx.path.pop();
  }
  leave(ctx);
  return out;
}

function ownKeys(ctx: Context, value: object): string[] | undefined {
  try {
    return Object.keys(value);
  } catch {
    report(ctx, C.invalidInput, 'The object keys could not be read.');
    return undefined;
  }
}

function visitObject(node: ObjectSchema, value: unknown, ctx: Context): unknown {
  if (!isPlainObject(value)) return typeError(ctx, 'an object', value);
  if (!enter(ctx, value)) return undefined;
  const out: Record<string, unknown> = {};
  const shape = node.shape;
  for (const key of Object.keys(shape)) {
    if (ctx.aborted) break;
    const field = shape[key] as SchemaNode;
    ctx.path.push(key);
    const raw = readOwn(ctx, value, key);
    if (raw !== REFUSED) {
      if ((raw === MISSING || raw === undefined) && field.kind !== 'optional') {
        report(ctx, C.required, `Missing required key ${JSON.stringify(key)}.`);
      } else {
        const result = visit(field, raw === MISSING ? undefined : raw, ctx);
        if (result !== undefined) out[key] = result;
      }
    }
    ctx.path.pop();
  }
  const keys = ownKeys(ctx, value);
  if (keys) {
    for (const key of keys) {
      if (ctx.aborted) break;
      if (Object.hasOwn(shape, key)) continue;
      if (isUnsafeKey(key)) {
        ctx.path.push(key);
        report(ctx, C.unsafeKey, `The key ${JSON.stringify(key)} is not allowed.`, {
          fix: 'Remove the key.',
        });
        ctx.path.pop();
      } else if (node.strict) {
        ctx.path.push(key);
        report(ctx, C.unknownKey, `Unknown key ${JSON.stringify(key)}.`, {
          fix: `Remove it, or use one of: ${list(Object.keys(shape))}.`,
        });
        ctx.path.pop();
      }
    }
  }
  leave(ctx);
  return out;
}

function visitRecord(node: RecordSchema, value: unknown, ctx: Context): unknown {
  if (!isPlainObject(value)) return typeError(ctx, 'an object', value);
  const keys = ownKeys(ctx, value);
  if (!keys) return undefined;
  if (node.min !== undefined && keys.length < node.min) {
    report(ctx, C.tooFew, `Use at least ${node.min} key${node.min === 1 ? '' : 's'}.`);
  }
  let limit = keys.length;
  if (node.max !== undefined && keys.length > node.max) {
    report(ctx, C.tooMany, `Use at most ${node.max} keys (got ${keys.length}).`);
    limit = node.max;
  }
  if (!enter(ctx, value)) return undefined;
  const out: Record<string, unknown> = {};
  const item = node.value as SchemaNode;
  for (let i = 0; i < limit && !ctx.aborted; i++) {
    const key = keys[i] as string;
    ctx.path.push(key);
    if (isUnsafeKey(key)) {
      report(ctx, C.unsafeKey, `The key ${JSON.stringify(key)} is not allowed.`, {
        fix: 'Remove the key.',
      });
    } else {
      if (node.key) visitString(node.key, key, ctx);
      const raw = readOwn(ctx, value, key);
      if (raw !== REFUSED) out[key] = visit(item, raw === MISSING ? undefined : raw, ctx);
    }
    ctx.path.pop();
  }
  leave(ctx);
  return out;
}

/** A child context for a union trial: own issues, shared path, ancestors and budget. */
function trial(ctx: Context): Context {
  return {
    ...ctx,
    issues: [],
    normalized: [],
    errors: 0,
    truncated: false,
    aborted: false,
  };
}

function merge(ctx: Context, from: Context): void {
  for (const issue of from.issues) {
    if (ctx.aborted) break;
    if (ctx.issues.length >= ctx.maxIssues) {
      ctx.truncated = true;
      ctx.aborted = true;
      break;
    }
    ctx.issues.push(issue);
  }
  // Errors dropped by the cap still count, so the result stays invalid.
  ctx.errors += from.errors;
  if (from.truncated) ctx.truncated = true;
  for (const entry of from.normalized) {
    if (ctx.normalized.length >= ctx.maxIssues) break;
    ctx.normalized.push(entry);
  }
}

function jsonType(value: unknown): JsonType | undefined {
  const name = typeName(value);
  return name === 'string' ||
    name === 'number' ||
    name === 'boolean' ||
    name === 'null' ||
    name === 'array' ||
    name === 'object'
    ? name
    : undefined;
}

function visitUnion(node: UnionSchema, value: unknown, ctx: Context): unknown {
  const type = jsonType(value);
  const candidates = node.options.filter(
    (option) => type !== undefined && acceptedTypes(option).has(type)
  );
  if (candidates.length === 0) {
    const expected = new Set<string>();
    for (const option of node.options) for (const name of acceptedTypes(option)) expected.add(name);
    return typeError(ctx, `one of: ${[...expected].join(', ')}`, value);
  }
  const depth = ctx.depth;
  const pathLength = ctx.path.length;
  const ancestors = ctx.ancestors.length;
  let best: Context | undefined;
  let bestValue: unknown;
  for (const option of candidates) {
    const attempt = trial(ctx);
    const result = visit(option as SchemaNode, value, attempt);
    // Restore the shared stacks in case the attempt stopped early.
    ctx.path.length = pathLength;
    ctx.ancestors.length = ancestors;
    ctx.depth = depth;
    if (attempt.errors === 0 && !attempt.aborted) {
      merge(ctx, attempt);
      return result;
    }
    if (!best || attempt.errors < best.errors) {
      best = attempt;
      bestValue = result;
    }
  }
  // No option fits: report the closest one (fewest errors, first on a tie).
  if (best) merge(ctx, best);
  return bestValue;
}

function visitDiscriminated(node: UnionSchema, value: unknown, ctx: Context): unknown {
  const key = node.discriminator as string;
  const index = discriminatorIndex(node);
  if (!isPlainObject(value)) return typeError(ctx, 'an object', value);
  ctx.path.push(key);
  const raw = readOwn(ctx, value, key);
  let chosen: number | undefined;
  if (raw === MISSING || raw === undefined) {
    report(ctx, C.required, `Missing required key ${JSON.stringify(key)}.`, {
      fix: `Set ${JSON.stringify(key)} to one of: ${list(index.values)}.`,
    });
  } else if (raw !== REFUSED) {
    chosen = index.map.get(raw as never);
    if (chosen === undefined && typeof raw === 'string') {
      for (const fallback of index.fallbacks) {
        const field = unwrapObject(node.options[fallback] as Schema)?.shape[key] as
          | StringSchema
          | undefined;
        if (field && probe(field, raw, ctx)) {
          chosen = fallback;
          break;
        }
      }
    }
    if (chosen === undefined) {
      report(
        ctx,
        node.code ?? C.unknownKind,
        `Unknown ${key} ${typeof raw === 'string' ? JSON.stringify(raw) : `(${typeName(raw)})`}.`,
        { fix: `Use one of: ${list(index.values)}.` }
      );
    }
  }
  ctx.path.pop();
  if (chosen === undefined) return undefined;
  return visit(node.options[chosen] as SchemaNode, value, ctx);
}

/** Whether a string fits a fallback discriminator, without reporting anything. */
function probe(field: StringSchema, value: string, ctx: Context): boolean {
  const attempt = trial(ctx);
  visitString(field, value, attempt);
  return attempt.errors === 0;
}

function visitLazy(node: LazySchema, value: unknown, ctx: Context): unknown {
  const limit = node.maxDepth ?? ctx.maxDepth;
  const depth = (ctx.lazyDepth.get(node) ?? 0) + 1;
  if (depth > limit) {
    report(ctx, C.tooDeep, `Nesting is deeper than ${limit} levels.`);
    return undefined;
  }
  let target: Schema;
  try {
    target = node.get();
  } catch {
    report(ctx, C.invalidInput, 'The lazy schema could not be resolved.');
    return undefined;
  }
  ctx.lazyDepth.set(node, depth);
  const result = visit(target as SchemaNode, value, ctx);
  ctx.lazyDepth.set(node, depth - 1);
  return result;
}

function visitRefine(node: RefineSchema, value: unknown, ctx: Context): unknown {
  const before = ctx.errors;
  const result = visit(node.inner as SchemaNode, value, ctx);
  if (ctx.errors !== before || ctx.aborted) return result;
  const base = [...ctx.path];
  try {
    node.check(result as never, {
      path: base,
      issue(issue) {
        const extra: { fix?: string; severity?: DiagnosticSeverity; path: PathSegment[] } = {
          path: issue.path ? [...base, ...issue.path] : base,
        };
        if (issue.fix !== undefined) extra.fix = issue.fix;
        if (issue.severity !== undefined) extra.severity = issue.severity;
        report(ctx, issue.code ?? node.code, issue.message, extra);
      },
    });
  } catch {
    report(ctx, node.code, 'The check failed unexpectedly.', { path: base });
  }
  return result;
}

function copyDefault(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(copyDefault);
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value))
    out[key] = copyDefault((value as Record<string, unknown>)[key]);
  return out;
}

interface JsonFrame {
  readonly value: unknown;
  readonly depth: number;
  readonly parent: JsonFrame | undefined;
  readonly key: PathSegment | undefined;
  readonly target: Record<PathSegment, unknown>;
  readonly slot: PathSegment;
}

function framePath(ctx: Context, frame: JsonFrame | undefined, extra?: PathSegment): PathSegment[] {
  const rel: PathSegment[] = [];
  if (extra !== undefined) rel.push(extra);
  for (let f = frame; f && f.key !== undefined; f = f.parent) rel.push(f.key);
  rel.reverse();
  return [...ctx.path, ...rel];
}

/** Bounded JSON, walked with an explicit stack (no recursion on the input's depth). */
function visitJson(node: JsonValueSchema, value: unknown, ctx: Context): unknown {
  const holder: Record<PathSegment, unknown> = {};
  const stack: JsonFrame[] = [
    { value, depth: 0, parent: undefined, key: undefined, target: holder, slot: 'root' },
  ];
  while (stack.length > 0 && !ctx.aborted) {
    const frame = stack.pop() as JsonFrame;
    if (++ctx.budget.nodes > ctx.budget.maxNodes) {
      report(ctx, C.tooLarge, `The input has more than ${ctx.budget.maxNodes} values.`);
      ctx.aborted = true;
      break;
    }
    const at = (): PathSegment[] => framePath(ctx, frame);
    const current = frame.value;
    switch (typeof current) {
      case 'string': {
        if (exceedsCodePoints(current, node.maxString)) {
          report(ctx, C.tooLong, `Use at most ${node.maxString} characters.`, { path: at() });
        } else if (node.text !== undefined) {
          const index = unsafeTextIndex(current, node.text);
          if (index >= 0) {
            report(
              ctx,
              C.unsafeText,
              `Character ${describeChar(current, index)} at index ${index} is not allowed here.`,
              { path: at() }
            );
          }
        }
        frame.target[frame.slot] = current;
        continue;
      }
      case 'number':
        if (!Number.isFinite(current)) {
          report(ctx, C.notFinite, 'Must be a finite number.', { path: at() });
        }
        frame.target[frame.slot] = current;
        continue;
      case 'boolean':
        frame.target[frame.slot] = current;
        continue;
      case 'object':
        break;
      default:
        report(ctx, C.invalidType, `Expected JSON data, received ${article(typeName(current))}.`, {
          path: at(),
        });
        continue;
    }
    if (current === null) {
      frame.target[frame.slot] = null;
      continue;
    }
    let isArray: boolean;
    try {
      isArray = Array.isArray(current);
    } catch {
      report(ctx, C.invalidInput, 'The value could not be read.', { path: at() });
      continue;
    }
    if (!isArray && !isPlainObject(current)) {
      report(ctx, C.invalidType, 'Expected JSON data, received a non-plain object.', {
        path: at(),
      });
      continue;
    }
    let cyclic = false;
    for (let f = frame.parent; f; f = f.parent) {
      if (f.value === current) {
        cyclic = true;
        break;
      }
    }
    if (cyclic) {
      report(ctx, C.cycle, 'The value contains itself (a cyclic reference).', { path: at() });
      continue;
    }
    if (frame.depth >= node.depth || ctx.depth + frame.depth >= ctx.maxDepth) {
      report(ctx, C.tooDeep, `Nesting is deeper than ${node.depth} levels.`, { path: at() });
      continue;
    }
    const children: JsonFrame[] = [];
    const childDepth = frame.depth + 1;
    const read = (key: PathSegment): unknown => {
      let descriptor: PropertyDescriptor | undefined;
      try {
        descriptor = Object.getOwnPropertyDescriptor(current, key);
      } catch {
        report(ctx, C.invalidInput, 'The property could not be read.', {
          path: framePath(ctx, frame, key),
        });
        return REFUSED;
      }
      if (descriptor && !('value' in descriptor)) {
        report(ctx, C.invalidInput, 'Accessor properties are not data; use a plain value.', {
          path: framePath(ctx, frame, key),
        });
        return REFUSED;
      }
      return descriptor?.value;
    };
    if (isArray) {
      const items = current as unknown[];
      let length: number;
      try {
        length = items.length;
      } catch {
        report(ctx, C.invalidInput, 'The array could not be read.', { path: at() });
        continue;
      }
      let limit = length;
      if (length > node.maxItems) {
        report(ctx, C.tooMany, `Use at most ${node.maxItems} items (got ${length}).`, {
          path: at(),
        });
        limit = node.maxItems;
      }
      const out: unknown[] = [];
      frame.target[frame.slot] = out;
      for (let i = 0; i < limit; i++) {
        const child = read(i);
        if (child === REFUSED) continue;
        children.push({
          value: child,
          depth: childDepth,
          parent: frame,
          key: i,
          target: out as unknown as Record<PathSegment, unknown>,
          slot: children.length,
        });
      }
    } else {
      let keys: string[];
      try {
        keys = Object.keys(current);
      } catch {
        report(ctx, C.invalidInput, 'The object keys could not be read.', { path: at() });
        continue;
      }
      let limit = keys.length;
      if (keys.length > node.maxKeys) {
        report(ctx, C.tooMany, `Use at most ${node.maxKeys} keys (got ${keys.length}).`, {
          path: at(),
        });
        limit = node.maxKeys;
      }
      const out: Record<string, unknown> = {};
      frame.target[frame.slot] = out;
      for (let i = 0; i < limit; i++) {
        const key = keys[i] as string;
        if (isUnsafeKey(key)) {
          report(ctx, C.unsafeKey, `The key ${JSON.stringify(key)} is not allowed.`, {
            path: framePath(ctx, frame, key),
            fix: 'Remove the key.',
          });
          continue;
        }
        if (exceedsCodePoints(key, node.maxKeyLength)) {
          report(ctx, C.tooLong, `Keys use at most ${node.maxKeyLength} characters.`, {
            path: framePath(ctx, frame, key),
          });
          continue;
        }
        const child = read(key);
        if (child === REFUSED) continue;
        children.push({
          value: child,
          depth: childDepth,
          parent: frame,
          key,
          target: out,
          slot: key,
        });
      }
    }
    // Push in reverse so children are visited (and reported) in document order.
    for (let i = children.length - 1; i >= 0; i--) stack.push(children[i] as JsonFrame);
  }
  return holder.root;
}
