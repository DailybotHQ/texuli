/**
 * Shared entry for family-scoped block parsing (no family parser imported here).
 */
import { type BlockBase, fail, ok, type ParseResult, parseBlockBase } from './primitives.ts';

export function plainObject(
  value: unknown,
  path: (string | number)[]
): ParseResult<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return fail(path, 'Expected a plain block object');
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return fail(path, 'Block objects must be plain JSON data');
  }
  return ok(value as Record<string, unknown>);
}

/** One family's parser: the block for `type`, or `null` when the type is not the family's. */
export type FamilyParser = (
  type: string,
  record: Record<string, unknown>,
  path: (string | number)[],
  base: BlockBase
) => ParseResult<unknown> | null;

/**
 * Parses one untrusted block with only the given family parsers: the plain
 * object and the shared base fields first, then the family's own rules. A
 * family renderer uses this instead of \`safeParseBlock\`, so it bundles its
 * own parser and not every family's. A type no parser claims is rejected.
 */
export function parseFamilyBlock<T>(
  value: unknown,
  parsers: readonly FamilyParser[],
  family: string
): ParseResult<T> {
  const object = plainObject(value, []);
  if (!object.success) return object;
  const record = object.data;
  if (typeof record.type !== 'string') return fail(['type'], 'block type is required');
  const base = parseBlockBase(record, []);
  if (!base.success) return base;
  for (const parse of parsers) {
    const parsed = parse(record.type, record, [], base.data);
    if (parsed) return parsed as ParseResult<T>;
  }
  return fail(['type'], `"${record.type}" is not a ${family} block`);
}
