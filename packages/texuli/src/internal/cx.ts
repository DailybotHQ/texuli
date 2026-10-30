/**
 * Lightweight class name composer. No third-party deps (no clsx / tailwind-merge).
 *
 * Accepts Svelte 5's `ClassValue` (string, nested arrays, object maps) plus the
 * falsy / number shapes authors pass in expressions like `full && 'w-full'`.
 * Consumer classes are merged last by callers so cascade layers still win.
 */
import type { ClassValue as SvelteClassValue } from 'svelte/elements';
// The focus ring hook (data-tx-focus-ring-style) loads with every styled component.
import './focus-ring.css';

/** Svelte's class attribute type — re-exported so components and consumers share one name. */
export type ClassValue = SvelteClassValue;

/** Runtime input to `cx`: Svelte ClassValue plus common expression leftovers. */
export type ClassInput =
  | ClassValue
  | number
  | boolean
  | null
  | undefined
  | ClassDictionary
  | ClassInput[];

export type ClassDictionary = Record<string, unknown>;

function push(value: ClassInput, out: string[]): void {
  if (
    value === null ||
    value === undefined ||
    value === false ||
    value === true ||
    value === 0 ||
    value === ''
  ) {
    return;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const s = String(value).trim();
    if (s) out.push(s);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) push(item as ClassInput, out);
    return;
  }
  if (typeof value === 'object') {
    for (const [key, on] of Object.entries(value as ClassDictionary)) {
      if (on) out.push(key);
    }
  }
}

/**
 * Join class names the way components compose base + variants + consumer `class`.
 * Nested arrays, object maps and falsy entries match Svelte/clsx semantics.
 */
export function cx(...values: ClassInput[]): string {
  const out: string[] = [];
  for (const value of values) push(value, out);
  return out.join(' ');
}
