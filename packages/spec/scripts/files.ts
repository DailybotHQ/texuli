import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { NORMATIVE_DIRS } from '../src/build.ts';

/** The package root (`packages/spec`). */
export const SPEC_ROOT = join(import.meta.dirname, '..');

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

/** Every normative spec file (path relative to the package → exact text). */
export function readNormativeFiles(root = SPEC_ROOT): Record<string, string> {
  const out: Record<string, string> = {};
  for (const dir of NORMATIVE_DIRS) {
    for (const file of walk(join(root, dir))) {
      if (!file.endsWith('.json')) continue;
      out[relative(root, file).split('\\').join('/')] = readFileSync(file, 'utf8');
    }
  }
  return out;
}
