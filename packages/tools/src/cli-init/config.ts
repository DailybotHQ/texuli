import { FRAMEWORKS } from './detect.ts';
import { projectPathError } from './safe-path.ts';
import type { TexuliConfig } from './types.ts';

export const CONFIG_FILE = 'texuli.config.json';
const ID = /^[a-z][a-z0-9-]{0,79}$/;

/** Parses and validates `texuli.config.json`; returns errors for anything unsafe or unknown. */
export function parseConfig(text: string): { config: TexuliConfig } | { errors: string[] } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    return {
      errors: [
        `${CONFIG_FILE} is not JSON: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { errors: [`${CONFIG_FILE} must be a JSON object.`] };
  }
  const record = raw as Record<string, unknown>;
  const errors: string[] = [];
  if (!FRAMEWORKS.includes(record.framework as never)) {
    errors.push(`${CONFIG_FILE} framework must be one of ${FRAMEWORKS.join(', ')}.`);
  }
  for (const field of ['css', 'entry', 'document'] as const) {
    const error = projectPathError(`${CONFIG_FILE} ${field}`, record[field]);
    if (error) errors.push(error);
  }
  for (const field of ['theme', 'namespace'] as const) {
    if (typeof record[field] !== 'string' || !ID.test(record[field] as string)) {
      errors.push(`${CONFIG_FILE} ${field} must be a kebab-case id.`);
    }
  }
  if (errors.length > 0) return { errors };
  return {
    config: {
      framework: record.framework as TexuliConfig['framework'],
      css: record.css as string,
      entry: record.entry as string,
      document: record.document as string,
      theme: record.theme as string,
      namespace: record.namespace as string,
    },
  };
}

export function formatConfig(config: TexuliConfig): string {
  const ordered: TexuliConfig = {
    framework: config.framework,
    css: config.css,
    entry: config.entry,
    document: config.document,
    theme: config.theme,
    namespace: config.namespace,
  };
  return `${JSON.stringify(ordered, null, 2)}\n`;
}

export function isId(value: string): boolean {
  return ID.test(value);
}
