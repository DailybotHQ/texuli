/** Minimal parse/safeParse contract for data validation without a runtime dependency. */
export interface ValidationIssue {
  readonly message: string;
}

export class ValidationError extends TypeError {
  readonly issues: readonly ValidationIssue[];

  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
    this.issues = [{ message }];
  }
}

export type SafeParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: ValidationError };

export interface DataSchema<T> {
  parse(input: unknown): T;
  safeParse(input: unknown): SafeParseResult<T>;
}

export function createSchema<T>(parseInput: (input: unknown) => T): DataSchema<T> {
  return {
    parse: parseInput,
    safeParse(input) {
      try {
        return { success: true, data: parseInput(input) };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid data';
        return { success: false, error: new ValidationError(message) };
      }
    },
  };
}

export function recordOf(input: unknown, name: string): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new ValidationError(`${name} must be an object`);
  }
  return input as Record<string, unknown>;
}

export function strictKeys(
  record: Record<string, unknown>,
  keys: readonly string[],
  name: string
): void {
  const allowed = new Set(keys);
  const extra = Object.keys(record).find((key) => !allowed.has(key));
  if (extra) throw new ValidationError(`${name} contains an unknown key: ${extra}`);
}

export function boundedString(
  input: unknown,
  name: string,
  min: number,
  max: number,
  trim = false
): string {
  if (typeof input !== 'string') throw new ValidationError(`${name} must be a string`);
  const value = trim ? input.trim() : input;
  if (value.length < min || value.length > max) {
    throw new ValidationError(`${name} must be between ${min} and ${max} characters`);
  }
  return value;
}

export function boundedNumber(
  input: unknown,
  name: string,
  min: number,
  max: number,
  integer = false
): number {
  if (
    typeof input !== 'number' ||
    !Number.isFinite(input) ||
    (integer && !Number.isInteger(input)) ||
    input < min ||
    input > max
  ) {
    throw new ValidationError(
      `${name} must be a ${integer ? 'whole ' : ''}number from ${min} to ${max}`
    );
  }
  return input;
}

export function enumValue<const T extends readonly string[]>(
  input: unknown,
  values: T,
  name: string
): T[number] {
  if (typeof input !== 'string' || !values.includes(input)) {
    throw new ValidationError(`${name} must be one of ${values.join(', ')}`);
  }
  return input as T[number];
}
