import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readNormativeFiles, SPEC_ROOT } from '../scripts/files.ts';
import { buildSpec } from '../src/build.ts';

export const normative = readNormativeFiles();
export const build = buildSpec(normative);

/** The committed outputs the harness compares with a fresh build. */
export function committedOutputs(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const path of [
    'manifest.json',
    'generated-manifest.json',
    ...Object.keys(build.generated),
  ]) {
    const file = join(SPEC_ROOT, path);
    if (existsSync(file)) out[path] = readFileSync(file, 'utf8');
  }
  return out;
}

export const json = <T>(path: string): T => JSON.parse(normative[path] as string) as T;
