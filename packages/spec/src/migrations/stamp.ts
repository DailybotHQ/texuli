import type { SpecMigration } from './types.ts';

/** A step whose only change is the envelope's `spec` stamp (every step so far). */
export function stampMigration(from: string, to: string): SpecMigration {
  return Object.freeze({
    from,
    to,
    migrate: (envelope: Readonly<Record<string, unknown>>) => ({ ...envelope, spec: to }),
  });
}
