/**
 * Provenance header stamped on every file `texuli add` writes.
 * Later `texuli update` / `diff` tasks read this block.
 */

export type ProvenanceMeta = {
  id: string;
  package: string;
  version: string;
  /** Source path relative to the monorepo/package root. */
  source: string;
};

const BEGIN = '@texuli/add — copied styled source. Do not remove this block.';

/** Build the multi-line provenance comment body (no surrounding markers). */
export function provenanceBody(meta: ProvenanceMeta): string {
  return [
    BEGIN,
    `id: ${meta.id}`,
    `package: ${meta.package}`,
    `version: ${meta.version}`,
    `source: ${meta.source}`,
  ].join('\n');
}

/** Block comment for TypeScript / CSS / JavaScript. */
export function provenanceBlockComment(meta: ProvenanceMeta): string {
  const lines = provenanceBody(meta)
    .split('\n')
    .map((line) => ` * ${line}`)
    .join('\n');
  return `/**\n${lines}\n */\n`;
}

/** HTML comment for Svelte markup files (safe above `<script>`). */
export function provenanceHtmlComment(meta: ProvenanceMeta): string {
  return `<!--\n${provenanceBody(meta)
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n')}\n-->\n`;
}

/** Choose a header form from the destination file extension. */
export function provenanceHeader(meta: ProvenanceMeta, fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.svelte')) return provenanceHtmlComment(meta);
  if (
    lower.endsWith('.ts') ||
    lower.endsWith('.js') ||
    lower.endsWith('.css') ||
    lower.endsWith('.mjs') ||
    lower.endsWith('.cjs')
  ) {
    return provenanceBlockComment(meta);
  }
  // Other text files get a # style header when they look like scripts; else HTML.
  if (lower.endsWith('.md') || lower.endsWith('.txt')) {
    return provenanceBody(meta)
      .split('\n')
      .map((line) => `# ${line}`)
      .join('\n')
      .concat('\n');
  }
  return provenanceHtmlComment(meta);
}

/**
 * The `source` a header records: the component directory relative to the
 * source root (both real paths, computed by the caller) joined with the file's
 * relative path, using `/`. Returns null when the result is not a plain
 * relative path inside the root: empty, absolute, a `.` or `..` segment, a
 * backslash, or a character that would break the header (`\0`, a line break,
 * a comment end).
 */
export function provenanceSource(sourceDir: string, relativePath: string): string | null {
  const source = [sourceDir, relativePath].filter((part) => part.length > 0).join('/');
  return isPlainSourcePath(source) ? source : null;
}

/** Whether `source` is safe to stamp: relative, inside the root, header-safe. */
export function isPlainSourcePath(source: string): boolean {
  if (source.length === 0 || source.startsWith('/') || /^[A-Za-z]:/.test(source)) return false;
  if (/[\\\0\r\n]/.test(source) || source.includes('*/') || source.includes('-->')) return false;
  return source
    .split('/')
    .every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

/** True when file contents already carry a texuli add provenance block. */
export function hasProvenance(content: string): boolean {
  return content.includes('@texuli/add');
}
