/**
 * Regenerate the manifests and every TypeScript and Kotlin projection:
 *   pnpm exec tsx packages/spec/scripts/generate.ts          (write)
 *   pnpm exec tsx packages/spec/scripts/generate.ts --check  (fail on drift)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { buildSpec } from '../src/build.ts';
import { readNormativeFiles, SPEC_ROOT } from './files.ts';

const build = buildSpec(readNormativeFiles());
const outputs: Record<string, string> = {
  'manifest.json': build.manifest,
  'generated-manifest.json': build.generatedManifest,
  ...build.generated,
};
const check = process.argv.includes('--check');
const drift: string[] = [];
for (const [path, text] of Object.entries(outputs)) {
  const file = join(SPEC_ROOT, path);
  const current = existsSync(file) ? readFileSync(file, 'utf8') : undefined;
  if (current === text) continue;
  if (check) drift.push(path);
  else {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text);
  }
}
if (check && drift.length > 0) {
  console.error(`spec drift: ${drift.join(', ')}`);
  process.exit(1);
}
console.log(
  `${check ? 'checked' : 'wrote'} ${Object.keys(outputs).length} files (spec ${build.stamp.specVersion})`
);
