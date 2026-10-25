/**
 * Framework-free model for number inspector fields.
 *
 * Catalog manifests declare no ranges for number props (only `kind`,
 * sometimes `default`), and the renderer accepts any finite number. Ranges
 * and defaults come only from a real schema that declares them: today the
 * chart prop schemas (`@texuli/charts/schemas`), supplied by the host as
 * `NumberHints`. Nothing here invents a bound. Imports only
 * `@texuli/catalog`, so it can move into a future `@texuli/builder`.
 */
import type { CatalogPropSchema } from '@texuli/catalog';
import { sanitizeProps } from '@texuli/catalog/render/renderer';

export type NumberProp = CatalogPropSchema & { kind: 'number' };

export function isNumberProp(prop: CatalogPropSchema): prop is NumberProp {
  return prop.kind === 'number';
}

/** A documented range. `exclusive` marks `min` as "greater than". */
export interface NumberBounds {
  min?: number;
  exclusive?: boolean;
  max?: number;
  integer?: boolean;
}

/** What a schema documents for one prop, beyond the catalog manifest. */
export interface NumberHints {
  bounds?: NumberBounds;
  default?: number;
  /** Where the hints come from, for the field's hint text. */
  source: string;
}

export type NumberReading =
  | { state: 'unset' }
  | { state: 'set'; value: number }
  | { state: 'invalid'; raw: unknown; message: string };

/** Read a value the way the renderer will (`sanitizeProps`): unset, accepted or refused. */
export function readNumber(prop: NumberProp, value: unknown): NumberReading {
  if (value === undefined) return { state: 'unset' };
  const result = sanitizeProps({ [prop.name]: value }, [prop], '', 'inspector');
  if (result.props && Object.hasOwn(result.props, prop.name)) {
    return { state: 'set', value: value as number };
  }
  const reason = result.diagnostics.find((diagnostic) => diagnostic.message)?.message;
  return { state: 'invalid', raw: value, message: reason ?? `Prop "${prop.name}" was refused.` };
}

/** Plain-language range, for hints and warnings ("greater than 0", "0 to 0.85"). */
export function describeBounds(bounds: NumberBounds): string | undefined {
  const parts: string[] = [];
  if (bounds.min !== undefined && bounds.max !== undefined && !bounds.exclusive) {
    parts.push(`${bounds.min} to ${bounds.max}`);
  } else {
    if (bounds.min !== undefined) {
      parts.push(`${bounds.exclusive ? 'greater than' : 'at least'} ${bounds.min}`);
    }
    if (bounds.max !== undefined) parts.push(`at most ${bounds.max}`);
  }
  if (bounds.integer) parts.push('a whole number');
  return parts.length ? parts.join(', ') : undefined;
}

/** Whether a finite value meets the documented range. */
export function withinBounds(value: number, bounds: NumberBounds | undefined): boolean {
  if (!bounds) return true;
  if (bounds.min !== undefined) {
    if (bounds.exclusive ? !(value > bounds.min) : !(value >= bounds.min)) return false;
  }
  if (bounds.max !== undefined && !(value <= bounds.max)) return false;
  if (bounds.integer && !Number.isInteger(value)) return false;
  return true;
}

export interface NumberIssue {
  severity: 'error' | 'warning';
  message: string;
}

const RAW_LIMIT = 60;

/** A refused value as short plain text (never markup). */
export function showRaw(raw: unknown): string {
  let text: string;
  try {
    text = JSON.stringify(raw) ?? String(raw);
  } catch {
    text = String(raw);
  }
  const chars = [...text];
  return chars.length > RAW_LIMIT ? `${chars.slice(0, RAW_LIMIT).join('')}…` : text;
}

/**
 * Errors are what the paint refuses (or a missing required value). A value
 * outside a documented range is a warning: the renderer still accepts it,
 * so calling it refused would be false.
 */
export function numberIssues(prop: NumberProp, value: unknown, hints?: NumberHints): NumberIssue[] {
  const reading = readNumber(prop, value);
  if (reading.state === 'invalid') {
    return [
      {
        severity: 'error',
        message: `${reading.message} The value ${showRaw(reading.raw)} will be refused at paint.`,
      },
    ];
  }
  if (reading.state === 'unset') {
    return prop.required === true
      ? [{ severity: 'error', message: 'Required: enter a number.' }]
      : [];
  }
  const bounds = hints?.bounds;
  if (!withinBounds(reading.value, bounds)) {
    return [
      {
        severity: 'warning',
        message: `Outside the documented range (${describeBounds(bounds ?? {})}); the chart may not draw as intended.`,
      },
    ];
  }
  return [];
}

/** A slider needs a documented range on both sides; otherwise a number input. */
export function numberControl(hints?: NumberHints): 'slider' | 'input' {
  const bounds = hints?.bounds;
  return bounds?.min !== undefined && bounds.max !== undefined && !bounds.exclusive
    ? 'slider'
    : 'input';
}

/** Slider step: 1 for whole numbers, else a hundredth of the range. */
export function sliderStep(bounds: NumberBounds): number {
  if (bounds.integer) return 1;
  const span = (bounds.max ?? 1) - (bounds.min ?? 0);
  return span > 0 ? span / 100 : 1;
}

export type NumberInput = { ok: true; value: number | undefined } | { ok: false; message: string };

/**
 * Text from a number box → the value to store. Empty clears an optional
 * prop; anything that is not a finite number is refused and not stored.
 */
export function parseNumberInput(prop: NumberProp, raw: string): NumberInput {
  const text = raw.trim();
  if (text === '') {
    return prop.required === true
      ? { ok: false, message: 'Required: enter a number.' }
      : { ok: true, value: undefined };
  }
  const value = Number(text);
  if (!Number.isFinite(value)) return { ok: false, message: 'Enter a finite number.' };
  return { ok: true, value };
}

/** The default a field shows as a placeholder: the manifest's, else the schema hint's. Never written. */
export function shownDefault(prop: NumberProp, hints?: NumberHints): number | undefined {
  if (typeof prop.default === 'number' && Number.isFinite(prop.default)) return prop.default;
  return hints?.default;
}
