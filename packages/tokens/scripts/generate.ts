/**
 * Regenerate the token contract v2 surfaces:
 *   pnpm exec tsx packages/tokens/scripts/generate.ts          (write)
 *   pnpm exec tsx packages/tokens/scripts/generate.ts --check  (fail on drift)
 * Outputs: renames.json, docs/tokens-components.md and the Tokens section of
 * every texuli component page (packages/texuli/docs/ui-<subpath>.md).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  componentDocPath,
  componentDocSubpaths,
  renderRenamesJson,
  renderTokenTablesDoc,
  withComponentTokensSection,
} from './render.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const outputs: Record<string, string> = {
  'src/renames/renames.json': renderRenamesJson(),
  'docs/tokens-components.md': renderTokenTablesDoc(),
};
// Each texuli component page carries a generated Tokens section.
for (const subpath of componentDocSubpaths()) {
  const path = `../texuli/docs/${componentDocPath(subpath)}`;
  outputs[path] = withComponentTokensSection(readFileSync(join(ROOT, path), 'utf8'), subpath);
}

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
