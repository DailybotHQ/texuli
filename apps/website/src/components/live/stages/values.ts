/**
 * Typed reads of props-panel values for live stages. Each read falls back
 * when the value is missing or has the wrong type, so a stage never passes
 * a malformed prop to a component.
 */
export type StageValues = Readonly<Record<string, unknown>>;

export function readers(values: () => StageValues) {
  return {
    str(key: string, fallback = ''): string {
      const v = values()[key];
      return typeof v === 'string' && v !== '' ? v : fallback;
    },
    num(key: string, fallback = 0): number {
      const v = values()[key];
      return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
    },
    bool(key: string, fallback = false): boolean {
      const v = values()[key];
      return typeof v === 'boolean' ? v : fallback;
    },
    /** An enum value, only when it is one of `options`. */
    pick<T extends string>(key: string, options: readonly T[], fallback: T): T {
      const v = values()[key];
      return typeof v === 'string' && (options as readonly string[]).includes(v)
        ? (v as T)
        : fallback;
    },
  };
}
