import { isRecord } from '../dialect.ts';
import { SPEC_VERSION } from '../version.ts';
import { migration020to030 } from './0.2.0-0.3.0.ts';
import type { SpecMigration, SpecMigrationResult } from './types.ts';

export type { SpecMigration, SpecMigrationResult };

/** The version an envelope without `spec` was written for. */
export const UNDECLARED_SPEC_VERSION = '0.2.0';

/** Every step, in order; each `to` is the next step's `from`. */
export const SPEC_MIGRATIONS: readonly SpecMigration[] = Object.freeze([migration020to030]);

/**
 * Bring a blueprint envelope up to `target` (the current spec by default)
 * before validation. Never throws and never mutates its input: a value that
 * is not an envelope, or one declaring a version no chain starts from, passes
 * through with no step applied (validation then refuses an unknown `spec`).
 * Only the envelope's `spec` field changes, so the tree, status, provenance
 * and activation digest stay as they were. Idempotent.
 */
export function migrateBlueprint(
  input: unknown,
  target: string = SPEC_VERSION
): SpecMigrationResult {
  if (!isRecord(input)) {
    return {
      blueprint: input,
      from: UNDECLARED_SPEC_VERSION,
      to: UNDECLARED_SPEC_VERSION,
      applied: [],
    };
  }
  const declared = Object.hasOwn(input, 'spec') ? input.spec : UNDECLARED_SPEC_VERSION;
  if (typeof declared !== 'string') {
    return {
      blueprint: input,
      from: UNDECLARED_SPEC_VERSION,
      to: UNDECLARED_SPEC_VERSION,
      applied: [],
    };
  }
  let blueprint: Record<string, unknown> = input;
  let current = declared;
  const applied: string[] = [];
  for (let step = 0; step < SPEC_MIGRATIONS.length && current !== target; step += 1) {
    const migration = SPEC_MIGRATIONS.find((m) => m.from === current);
    if (!migration) break;
    blueprint = migration.migrate(blueprint);
    applied.push(`${migration.from}->${migration.to}`);
    current = migration.to;
  }
  if (current !== target) {
    return { blueprint: input, from: declared, to: declared, applied: [] };
  }
  return { blueprint, from: declared, to: current, applied };
}
