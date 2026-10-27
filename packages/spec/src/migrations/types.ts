/** One pure step between two adjacent spec versions. */
export interface SpecMigration {
  readonly from: string;
  readonly to: string;
  /** Pure: never mutates its input; unchanged subtrees may be shared. */
  migrate(envelope: Readonly<Record<string, unknown>>): Record<string, unknown>;
}

/** What {@link migrateBlueprint} did: the result and the steps applied (`"0.2.0->0.3.0"`). */
export interface SpecMigrationResult {
  blueprint: unknown;
  from: string;
  to: string;
  applied: readonly string[];
}
