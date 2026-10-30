/**
 * Regenerate the token contract v2 surfaces:
 *   pnpm exec tsx packages/tokens/scripts/generate.ts          (write)
 *   pnpm exec tsx packages/tokens/scripts/generate.ts --check  (fail on drift)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderRenamesJson, renderTokenTablesDoc } from './render.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const outputs: Record<string, string> = {
  'src/renames/renames.json': renderRenamesJson(),
  'docs/tokens-components.md': renderTokenTablesDoc(),
};

const check = process.argv.includes('--check');
const drift: string[] = [];
for (const [path, text] of Object.entries(outputs)) {
  const file = join(ROOT, path);
  let current: string | undefined;
  try {
    current = readFileSync(file, 'utf8');
  } catch {
    current = undefined;
  }
  if (current === text) continue;
  if (check) drift.push(path);
  else writeFileSync(file, text);
}
if (drift.length > 0) {
  console.error(`tokens drift: ${drift.join(', ')}`);
  process.exit(1);
}
console.log(`${check ? 'checked' : 'wrote'} ${Object.keys(outputs).length} files`);
