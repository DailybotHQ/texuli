/**
 * Read the provenance header `texuli add` stamps on copied files.
 */
import type { ProvenanceMeta } from '../cli-add/provenance.ts';

export interface ParsedProvenance {
  meta: ProvenanceMeta;
  /** The file without its header: the text the merge compares. */
  body: string;
}

const BEGIN = '@texuli/add — copied styled source. Do not remove this block.';
const FIELDS = ['id', 'package', 'version', 'source'] as const;

/** Each header form `provenanceHeader` writes: opening line, line prefix, closing line. */
const FORMS: ReadonlyArray<{ open: string | null; prefix: string; close: string | null }> = [
  { open: '/**', prefix: ' * ', close: ' */' },
  { open: '<!--', prefix: '  ', close: '-->' },
  { open: null, prefix: '# ', close: null },
];

/**
 * Parse the header at the very start of `content`, or `null` when the file
 * has none (a file the consumer added, or a header they edited away).
 */
export function parseProvenance(content: string): ParsedProvenance | null {
  for (const form of FORMS) {
    const expected = 1 + FIELDS.length + (form.open ? 1 : 0) + (form.close ? 1 : 0);
    const lines = content.split('\n', expected);
    if (lines.length < expected) continue;
    let at = 0;
    if (form.open !== null && lines[at++] !== form.open) continue;
    if (lines[at++] !== `${form.prefix}${BEGIN}`) continue;
    const values: Partial<Record<(typeof FIELDS)[number], string>> = {};
    let valid = true;
    for (const field of FIELDS) {
      const line = lines[at++] ?? '';
      const head = `${form.prefix}${field}: `;
      if (!line.startsWith(head)) {
        valid = false;
        break;
      }
      values[field] = line.slice(head.length);
    }
    if (!valid) continue;
    if (form.close !== null && lines[at++] !== form.close) continue;
    const headerLength = lines.slice(0, at).join('\n').length + 1;
    return {
      meta: {
        id: values.id ?? '',
        package: values.package ?? '',
        version: values.version ?? '',
        source: values.source ?? '',
      },
      body: content.slice(headerLength),
    };
  }
  return null;
}
