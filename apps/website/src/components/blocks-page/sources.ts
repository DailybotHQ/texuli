/**
 * The section sources as text, read at build time (no runtime fetch), keyed by
 * file name: what the page shows and copies is exactly what renders.
 */
const RAW = import.meta.glob('./sections/*.svelte', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export function blockSource(file: string): string {
  const source = RAW[`./sections/${file}`];
  if (typeof source !== 'string') throw new Error(`Missing block source: ${file}`);
  return source;
}
