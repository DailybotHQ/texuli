/**
 * `@texuli/spec/motion` — the closed motion vocabulary of spec 0.6.0
 * (ADR-012, ADR-013) in code, mirrored from `schemas/blueprint.schema.json`
 * (`tests/spec.test.ts` asserts they stay equal), and the one structural
 * check every runtime shares: `@texuli/catalog` refuses with it, and
 * `@texuli/player` paints only what it accepted.
 *
 * Agents name presets and token steps. Nothing here is CSS, keyframes, a
 * duration in milliseconds or code. No imports at runtime.
 */

import type {
  BlueprintEnvelopeMotion,
  BlueprintMotionDuration,
  BlueprintMotionLevel,
  BlueprintMotionPreset,
  BlueprintMotionStagger,
  BlueprintNodeMotion,
} from '../generated/typescript/blueprint.ts';

export type {
  BlueprintEnvelopeMotion,
  BlueprintMotionDuration,
  BlueprintMotionLevel,
  BlueprintMotionPreset,
  BlueprintMotionStagger,
  BlueprintNodeMotion,
};

/** Enter and exit presets (`$defs.motionPreset`). */
export const SPEC_MOTION_PRESETS: readonly BlueprintMotionPreset[] = Object.freeze([
  'fade',
  'rise',
  'scale',
  'slide-start',
  'slide-end',
]);

/** Duration token steps (`$defs.motionDuration`); `base` when omitted. */
export const SPEC_MOTION_DURATIONS: readonly BlueprintMotionDuration[] = Object.freeze([
  'fast',
  'base',
  'slow',
]);

/** Stagger token steps between entering children (`$defs.motionStagger`). */
export const SPEC_MOTION_STAGGERS: readonly BlueprintMotionStagger[] = Object.freeze([
  'none',
  'fast',
  'base',
]);

/** Motion ceilings (`$defs.motionLevel`), highest first. */
export const SPEC_MOTION_LEVELS: readonly BlueprintMotionLevel[] = Object.freeze([
  'full',
  'subtle',
  'none',
]);

/** The fields a node `motion` takes (`$defs.nodeMotion`). */
export const SPEC_NODE_MOTION_FIELDS: readonly string[] = Object.freeze([
  'enter',
  'exit',
  'layout',
  'stagger',
  'duration',
]);

export type SpecMotionCheck<T> =
  | { ok: true; motion: Readonly<T> }
  /** `path` is relative to the motion value (`""`, `.enter` …). */
  | { ok: false; path: string; message: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** A short, single-line label for a refused value: never the value itself in full. */
function describe(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value.slice(0, 24));
  if (Array.isArray(value)) return 'an array';
  return value === null ? 'null' : typeof value;
}

function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string
): { ok: true; value: T } | { ok: false; path: string; message: string } {
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) {
    return { ok: true, value: value as T };
  }
  return {
    ok: false,
    path: `.${field}`,
    message: `"${field}" must be one of ${allowed.join(', ')} (got ${describe(value)}).`,
  };
}

/**
 * Check a node `motion` against the closed vocabulary. Returns a frozen
 * copy with only the known fields, or the first refusal. Linear in the
 * number of keys, and it stops at the first unknown one.
 */
export function checkNodeMotion(value: unknown): SpecMotionCheck<BlueprintNodeMotion> {
  if (!isRecord(value)) {
    return { ok: false, path: '', message: `"motion" must be an object (got ${describe(value)}).` };
  }
  const out: { -readonly [K in keyof BlueprintNodeMotion]: BlueprintNodeMotion[K] } = {};
  for (const key of Object.keys(value)) {
    if (!SPEC_NODE_MOTION_FIELDS.includes(key)) {
      return {
        ok: false,
        path: `.${key.slice(0, 32)}`,
        message: `"motion" takes only ${SPEC_NODE_MOTION_FIELDS.join(', ')}; no CSS, keyframes or code.`,
      };
    }
    const entry = value[key];
    if (key === 'layout') {
      if (typeof entry !== 'boolean') {
        return {
          ok: false,
          path: '.layout',
          message: `"layout" must be a boolean (got ${describe(entry)}).`,
        };
      }
      out.layout = entry;
      continue;
    }
    if (key === 'enter' || key === 'exit') {
      const checked = oneOf(entry, SPEC_MOTION_PRESETS, key);
      if (!checked.ok) return checked;
      out[key] = checked.value;
    } else if (key === 'stagger') {
      const checked = oneOf(entry, SPEC_MOTION_STAGGERS, key);
      if (!checked.ok) return checked;
      out.stagger = checked.value;
    } else {
      const checked = oneOf(entry, SPEC_MOTION_DURATIONS, key);
      if (!checked.ok) return checked;
      out.duration = checked.value;
    }
  }
  return { ok: true, motion: Object.freeze(out) };
}

/** Check an envelope `motion` (`{ level }`). Returns a frozen copy, or the first refusal. */
export function checkEnvelopeMotion(value: unknown): SpecMotionCheck<BlueprintEnvelopeMotion> {
  if (!isRecord(value)) {
    return { ok: false, path: '', message: `"motion" must be an object (got ${describe(value)}).` };
  }
  for (const key of Object.keys(value)) {
    if (key !== 'level') {
      return {
        ok: false,
        path: `.${key.slice(0, 32)}`,
        message: 'The envelope "motion" takes only "level".',
      };
    }
  }
  const level = oneOf(value.level, SPEC_MOTION_LEVELS, 'level');
  if (!level.ok) return level;
  return { ok: true, motion: Object.freeze({ level: level.value }) };
}
