/*
 * Hostile chart input corpus. Chart data can come from an agent or a user, so
 * every family must either draw finite geometry or reject the input with a
 * TypeError; it must never overflow the stack, allocate without bound, emit
 * NaN or Infinity into SVG attributes, or render a label as markup.
 *
 * Fictional data only. Test-only: nothing here ships in a package entry.
 */

export interface HostileValues {
  id: string;
  title: string;
  values: readonly unknown[];
}

/** Larger than V8 accepts as spread arguments (around 120k on default stacks). */
export const HUGE_LENGTH = 300_000;

const huge = Array.from({ length: HUGE_LENGTH }, (_, i) => i % 97);
const sparse: (number | undefined)[] = [];
sparse[0] = 1;
sparse[9] = 2;

export const HOSTILE_VALUES: readonly HostileValues[] = [
  { id: 'empty', title: 'No values', values: [] },
  { id: 'all-null', title: 'Only gaps', values: [null, null, null] },
  {
    id: 'non-finite',
    title: 'NaN and infinities',
    values: [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 4],
  },
  { id: 'extreme', title: 'Largest finite magnitudes', values: [-1e308, 1e308, 0] },
  { id: 'subnormal', title: 'Subnormal spread', values: [0, 5e-324, 1e-320] },
  { id: 'single', title: 'One value', values: [42] },
  { id: 'constant', title: 'One repeated value', values: [7, 7, 7, 7, 7] },
  { id: 'negative-zero', title: 'Negative zero', values: [-0, 0, -0] },
  {
    id: 'wrong-types',
    title: 'Strings, objects and booleans posing as numbers',
    values: ['12', { valueOf: () => 3 }, true, [5], '1e3', 9],
  },
  { id: 'sparse', title: 'Sparse array holes', values: sparse },
  { id: 'huge', title: `${HUGE_LENGTH.toLocaleString('en-US')} values`, values: huge },
];

/** Labels an agent could emit: markup, script URLs, bidi spoofing, giant and invisible text. */
export const HOSTILE_LABELS: readonly string[] = [
  '<script>window.__chartHostile = 1</script>',
  '"><svg onload="window.__chartHostile=1">',
  '<img src=x onerror="window.__chartHostile=1">',
  'javascript:alert(document.domain)',
  '\u202egnp.exe\u202c Revenue',
  '\u200b\u200b\u200b',
  '{@html "<b>bold</b>"}',
  `Visit https://phish.example/${'a'.repeat(64)}`,
  'x'.repeat(10_000),
];

/** Group payloads with duplicate, blank, prototype-shaped and oversized ids. */
export function hostileGroups(): unknown[] {
  return [
    null,
    42,
    { id: '', label: 'Blank id', values: [1, 2] },
    { id: '__proto__', label: 'Prototype id', values: [1, 2, 3] },
    { id: 'constructor', label: 'Constructor id', values: [4, 5] },
    { id: 'dup', label: 'First', values: [1, 2, 3] },
    { id: 'dup', label: 'Second', values: [9, 9, 9] },
    { id: 'no-values', label: 'Missing values' },
    { id: 'string-values', label: 'Values is a string', values: '1,2,3' },
    ...HOSTILE_LABELS.map((label, i) => ({ id: `label-${i}`, label, values: [i, i + 1, i + 3] })),
    ...Array.from({ length: 500 }, (_, i) => ({
      id: `extra-${i}`,
      label: `Extra ${i}`,
      values: [i],
    })),
  ];
}

/** Size and domain options that could produce NaN geometry or unbounded loops. */
export const HOSTILE_OPTIONS: readonly Record<string, unknown>[] = [
  { width: Number.NaN, height: Number.NaN },
  { width: -500, height: 0 },
  { width: Number.POSITIVE_INFINITY, height: Number.POSITIVE_INFINITY },
  { domain: [Number.NaN, 5] },
  { domain: [10, 0] },
  { domain: [3, 3] },
  { domain: [0, Number.POSITIVE_INFINITY] },
  { whisker: -1, bandwidth: -2, points: 1e9 },
  { whisker: Number.NaN, bandwidth: Number.NaN, points: Number.NaN },
];

/** Every number in an SVG path or attribute string must be finite. */
export function hasNonFiniteGeometry(text: string): boolean {
  return /NaN|Infinity|undefined/.test(text);
}

/** Keys that hold caller text, not geometry. */
const TEXT_KEYS = new Set(['id', 'label']);

/** Every numeric leaf in a layout object must be finite (strings other than ids and labels are checked as geometry). */
export function nonFiniteLeaves(value: unknown, path = '$', out: string[] = []): string[] {
  if (out.length > 10) return out;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) out.push(`${path}=${value}`);
  } else if (typeof value === 'string') {
    if (hasNonFiniteGeometry(value)) out.push(`${path}="${value.slice(0, 40)}"`);
  } else if (Array.isArray(value)) {
    const step = Math.max(1, Math.floor(value.length / 200));
    for (let i = 0; i < value.length; i += step) nonFiniteLeaves(value[i], `${path}[${i}]`, out);
  } else if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (!TEXT_KEYS.has(key)) nonFiniteLeaves(child, `${path}.${key}`, out);
    }
  }
  return out;
}
